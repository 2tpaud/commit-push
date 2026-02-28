# 결제 승인 후 취소(환불) 24시간 정책·PG 연동·취소 알림 최신화

주요 기능 추가:

**Plan 청구 내역 결제취소(24시간 제한)**
- **배경**: 결제 승인 후 일정 시간 내 사용자가 직접 취소할 수 있어야 하고, 이후에는 버튼이 노출되지 않아야 함.
- **요구사항 반영**: `paid_at` 기준 **24시간 이내** 결제 건만 청구 내역에 **결제취소** 버튼 노출.
- **조회 범위 확장**: 청구 내역은 `payments.status in ('paid','cancelled')`를 조회해 승인/취소완료를 함께 표시.
- **상태 표시**: `paid`는 **승인**, `cancelled`는 **취소완료**로 표기.

**나이스페이 취소 API 연동 (`/api/payment/cancel`)**
- **엔드포인트 추가**: `POST /api/payment/cancel` 구현.
- **검증 로직**:
  - 본인 결제 건인지 확인 (`payments.user_id`)
  - `status='paid'`인지 확인
  - `paid_at` 기준 24시간 이내인지 확인
  - `tid` 존재 여부 확인
- **PG 요청**:
  - 취소 URL: 실결제 시 `dc1-api.nicepay.co.kr`(api.nicepay.co.kr은 404). `NICE_PAY_CANCEL_API_URL`로 오버라이드 가능.
  - 요청 타입: `application/x-www-form-urlencoded`
  - 주요 파라미터: `TID`, `MID`, `Moid(order_id)`, `CancelAmt`, `CancelMsg`, `PartialCancelCode=0`, `EdiDate`, `SignData`
  - 서명: `hex(sha256(MID + CancelAmt + EdiDate + SecretKey))`
- **성공 처리**:
  - `payments.status='cancelled'` 업데이트
  - `users.plan='free'`, `plan_expires_at=null` 복구
  - 취소 알림(`payment_cancelled`) 생성

**웹훅 취소 이벤트 처리 강화 (`/api/payment/webhook`)**
- **배경**: 나이스페이 문서 기준으로 웹훅은 승인뿐 아니라 취소(API/관리자 취소) 이벤트도 전달 가능.
- **구현**:
  - 승인 이벤트: 기존과 동일하게 승인 반영 + `payment_approved` 알림
  - 취소 이벤트(API/관리자 취소): `payments.status='cancelled'` + 사용자 플랜 Free 복구 + `payment_cancelled` 알림
- **중복 방지**: 이미 `cancelled` 상태면 취소 알림을 중복 생성하지 않도록 처리.

**알림 정책 확장**
- **기존**: 결제 승인 시 `payment_approved`
- **추가**: 결제 취소 시 `payment_cancelled`
- **UX**: 헤더 벨 알림에서 취소 알림도 확인 가능, 결제 관련 알림 클릭 시 `/plan` 이동 흐름 유지.

**프로필 드롭다운 플랜 만료일 가시화**
- **요구사항**: 상단 프로필 드롭다운에서 현재 유료 플랜 옆에 만료일과 남은 기간이 보여야 함.
- **구현**:
  - `SharedAppLayout`의 프로필 조회에 `plan_expires_at` 포함
  - 사용량 게이지 상단의 플랜 배지 옆에 `YYYY.MM.DD (D-N일)` 형태 표시
  - Free 플랜은 만료일/잔여일 미표시

**만료 임박 알림(D-3 / D-1) 추가**
- **배경**: 유료 구독 만료 전에 사용자에게 사전 안내가 필요함.
- **구현 위치**: `/api/plan/check-expiry`
- **동작**:
  - 로그인/대시보드 진입 시 호출되는 `check-expiry`에서 `plan_expires_at` 기준 잔여일 계산
  - `3일`, `1일` 남았을 때 각각 `plan_expiry_3days`, `plan_expiry_1day` 알림 insert
  - 같은 날 같은 타입 알림은 중복 삽입되지 않도록 방지
- **UX**:
  - 벨 알림에서 만료 임박 알림 표시
  - 클릭 시 `/plan`으로 이동

**결제 return URL 세션 오류 수정**
- **배경**: PG(나이스페이)에서 return URL로 POST할 때 브라우저가 세션 쿠키를 보내지 않아 "로그인이 필요합니다" 오류 발생.
- **구현**:
  - return POST에서 **세션 없이** 처리. `SUPABASE_SERVICE_ROLE_KEY`로 Supabase 클라이언트 생성.
  - 나이스페이가 넘긴 `order_id`로 `payments` 조회 후 `payment.user_id` 기준으로 `users`·`notifications` 갱신.
  - 결제 승인 검증은 나이스페이 승인 API 호출로 수행(위변조 방지).
- **환경 변수**: `SUPABASE_SERVICE_ROLE_KEY` 필수(로컬·Vercel 모두). ANON KEY와 다름.

**승인 방식: v1 API vs 레거시 (U103 / A301 대응)**
- **U103**(사용자 인증타입이 맞지 않습니다): 실결제에서 v1 API 호출 시 나이스페이 시크릿 키가 **Token 인증** 타입이면 발생. → **Basic 인증** 타입 시크릿 키로 재발급 후 v1 API 사용.
- **A301**(가맹점키 조회 오류): 레거시 승인(pay_process.jsp)은 **상점키(Merchant Key)** 로 SignData 생성. 가맹점 관리자에 상점키가 없으면 발생. → **가맹점키 없이** 운영하려면 **v1 API만** 사용.
- **현재 동작**: `NICE_PAY_MERCHANT_KEY`가 **설정되어 있으면** 레거시 승인, **없으면** v1 API(Basic 인증)만 사용. 클라이언트 키는 **Server 승인**, 시크릿 키는 **Basic 인증** 타입 사용 권장.

**check-expiry 401 수정 (배포 환경)**
- **배경**: 배포 환경(www)에서 쿠키가 전달되지 않아 `GET /api/plan/check-expiry` 401 발생.
- **구현**: 쿠키 세션 우선, 없으면 `Authorization: Bearer` 토큰으로 인증. layout에서 `access_token` 전달.
- **결과**: 로컬·배포 모두 정상 동작.

**취소 API 401/404 수정**
- **401**: 배포 환경에서 쿠키 미전달 시 Bearer fallback 추가(notifications·check-expiry와 동일).
- **404**: 실결제 시 `api.nicepay.co.kr/webapi/cancel_process.jsp`는 404. `dc1-api.nicepay.co.kr/webapi/cancel_process.jsp` 사용.

**결제 후 알림창에 알림이 안 뜨는 문제**
- **배경**: 결제 return으로 `/plan` 복귀 시 쿠키 미전달로 `GET /api/notifications` 401 → 알림 목록 빈 배열, 벨 클릭 시 "알림이 없습니다"만 표시.
- **구현**: `/api/notifications` GET·PATCH `/api/notifications/[id]/read`에 쿠키 없을 때 **Bearer fallback** 추가. `SharedAppLayout`에서 `useAuthSession()`으로 토큰 넘겨 알림 조회·읽음 처리 시 Bearer 헤더 전달.
- **결과**: 결제 완료/취소 알림이 알림창에 정상 표시.

**나이스페이 승인 API 401(U116) 대응**
- **배경**: 실결제 시 `NICE_PAY_API_BASE` 미등록으로 기본값(sandbox) 사용 → 나이스페이 401 "사용자 정보가 존재하지 않습니다".
- **구현**: 나이스페이 승인 API가 401 반환 시 `nicepay_auth` 에러로 분리, Plan 페이지에 환경 변수 확인 안내 메시지 표시.
- **환경 변수**: 실결제(운영) 시 Vercel에 `NICE_PAY_API_BASE=https://api.nicepay.co.kr` **반드시** 등록.

---

UI 컴포넌트:

**Plan 페이지 (`app/(dashboard)/plan/page.tsx`)**
- 청구 내역 테이블에 동작 열 유지/활성화
- 24시간 조건부 `결제취소` 버튼 노출
- 취소 중 버튼 비활성화 + 문구(`취소 처리 중…`)
- 취소 후 메시지/목록 재조회로 즉시 `취소완료` 반영
- `nicepay_auth` 에러 시 환경 변수 확인 안내

**헤더/프로필 드롭다운 (`src/components/SharedAppLayout.tsx`)**
- 유료 플랜일 때 플랜 배지 옆 만료일 + `D-N일` 표시
- 결제/취소/만료 임박 알림 타입 클릭 시 `/plan` 이동

---

API 컴포넌트:

**취소 API**
- `app/api/payment/cancel/route.ts` 추가
- 인증: 쿠키 세션 우선, 없으면 Bearer(배포 환경 401 대비). 취소 가능 조건/권한/기간 체크 + PG 취소 호출 + DB 반영 + 취소 알림 생성. 실결제 시 취소 URL은 dc1-api.nicepay.co.kr(api.nicepay.co.kr은 404).

**웹훅**
- `app/api/payment/webhook/route.ts`에 취소 이벤트 분기 추가
- 승인/취소 이벤트별 DB/알림 반영 로직 분리

**만료 점검 API**
- `app/api/plan/check-expiry/route.ts`: 쿠키 + Bearer 이중 인증, 만료 전환 + 만료 임박 알림(`D-3`, `D-1`) 생성

**결제 return**
- `app/api/payment/return/route.ts`: 세션 미사용, 서비스 롤로 `order_id` 기준 조회·승인·갱신. **NICE_PAY_MERCHANT_KEY 없으면** v1 API(Basic 인증), **있으면** 레거시 pay_process.jsp 승인. 나이스페이 401 시 `nicepay_auth` 반환.

**알림 API**
- `app/api/notifications/route.ts`, `app/api/notifications/[id]/read/route.ts`: 쿠키 세션 없으면 `Authorization: Bearer`로 인증(결제 return 후 알림 표시용). `SharedAppLayout`: `useAuthSession()`으로 토큰 전달해 조회·읽음 처리.

---

문서화:

**ARCHITECTURE.md**
- `/api/payment/return`에 승인 방식(v1 vs 레거시·NICE_PAY_MERCHANT_KEY), Basic 인증 키 권장, PG 리다이렉트 시 세션 없이 서비스 롤 사용 명시
- `NICE_PAY_MERCHANT_KEY` 선택 변수, `NICE_PAY_MID` 선택(미설정 시 clientId) 반영
- `/api/notifications` GET·PATCH에 쿠키 없을 때 Bearer fallback(결제 return 후 알림 표시용) 명시
- `/api/payment/cancel` 역할 명시
- `/api/payment/webhook`에 승인/취소 이벤트 처리 및 `payment_cancelled` 알림 반영 내용 추가
- `/api/plan/check-expiry`에 만료 임박 알림(`plan_expiry_3days`, `plan_expiry_1day`) 생성 내용 추가
- `SUPABASE_SERVICE_ROLE_KEY`를 결제 사용 시 필수, return URL·웹훅 용도로 정리
- `NICE_PAY_API_BASE` 실결제 시 `https://api.nicepay.co.kr` 반드시 등록 (미등록 시 401/U116)
- `/api/docs/[slug]`에 `payment-test-checklist` 추가

**PLAN.md**
- 5.1 환경 변수에 `SUPABASE_SERVICE_ROLE_KEY` 추가, Server 승인·Basic 인증 키 권장, `NICE_PAY_MERCHANT_KEY` 선택 추가
- 5.2 결제 승인 API에 승인 경로(v1 Basic vs 레거시)·세션 미사용(서비스 롤·order_id 기준) 설명 추가
- 청구 내역의 `paid/cancelled` 조회 및 24시간 결제취소 정책 명시
- 취소 API(요청 파라미터/서명/성공 처리) 상세 추가
- 취소 이벤트 시 알림(`payment_cancelled`) 및 DB 변화 섹션 보강
- 프로필 드롭다운 만료일+D-N 표기, 만료 임박 알림(`D-3`, `D-1`) 정책 추가

**DATABASE.md**
- `payments.status` 설명에 `cancelled` 포함
- `notifications.type`에 `payment_cancelled`, `plan_expiry_3days`, `plan_expiry_1day` 포함
- 알림 사용처를 승인/취소/만료 임박 모두 반영하도록 업데이트

**DESIGN.md**
- `/plan` 청구 내역 동작 열(24시간 결제취소 버튼)과 취소 알림 UX 문구 추가
- 프로필 드롭다운 만료일+D-N 표기, 만료 임박 알림 UX 추가

**PAYMENT-TEST-CHECKLIST.md**
- 사전 준비에 Basic 인증 키·NICE_PAY_MERCHANT_KEY 선택, Server 승인/Basic 인증 타입 안내 추가
- 실결제 시 `NICE_PAY_API_BASE=https://api.nicepay.co.kr` 반드시 등록 (미등록 시 승인 401)

---

파일 구조:

- `app/api/payment/cancel/route.ts` — 결제 승인 후 24시간 이내 PG 취소(환불) API 연동 및 상태/알림 반영
- `app/api/payment/webhook/route.ts` — 승인 이벤트 + 취소 이벤트(API/관리자 취소) 처리
- `app/api/payment/return/route.ts` — 세션 없이 서비스 롤로 결제 조회·승인·DB 갱신, nicepay_auth(401) 분기
- `app/api/plan/check-expiry/route.ts` — 쿠키+Bearer 이중 인증, 만료 전환 + 만료 임박 알림(D-3/D-1) 생성
- `app/(dashboard)/plan/page.tsx` — 청구 내역 `paid/cancelled` 조회, 24시간 결제취소 버튼, nicepay_auth 안내
- `app/(dashboard)/layout.tsx` — check-expiry 호출 시 Bearer 토큰 전달
- `src/components/SharedAppLayout.tsx` — 프로필 드롭다운 만료일+D-N 표시, 결제/만료 관련 알림 이동 처리
- `docs/ARCHITECTURE.md` — 결제 return·취소 API/웹훅/만료 임박 알림·환경 변수(NICE_PAY_API_BASE 실결제 필수) 반영
- `docs/PLAN.md` — 결제 승인 API(세션 미사용), 취소 정책/취소 API/DB 변화/만료 임박 알림 최신화
- `docs/DATABASE.md` — `payments.status`, `notifications.type` 설명 최신화
- `docs/DESIGN.md` — Plan 페이지 취소 버튼 노출 규칙, 취소/만료 임박 알림 UX, 프로필 표시 최신화
- `docs/PAYMENT-TEST-CHECKLIST.md` — 결제·취소 테스트 체크리스트(환경 변수, 실결제 NICE_PAY_API_BASE 포함)
