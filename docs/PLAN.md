# CommitPush 요금제(Plan) 안내

SaaS 확장을 위한 요금제 구조와 `users` 테이블 연동, 한도 정책을 정리한 문서입니다.

---

## 1. 개요

- **플랜 구분**: `free` / `pro` / `team` (DB `users.plan` 값과 1:1 대응)
- **한도 기준**: `users.total_notes`, `users.total_commits` 캐시 필드를 사용해 노트·커밋 사용량 제한
- **만료 관리**: 유료 플랜은 `users.plan_expires_at`으로 구독 만료 시점 관리

---

## 2. DB 스키마 (users 테이블)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `plan` | text | 요금제 구분. `free` / `pro` / `team` 등. 기본값 `free`. |
| `plan_expires_at` | timestamptz | 유료 플랜 만료 시점. 구독 갱신/취소 시 업데이트. |
| `total_notes` | integer | 사용자가 생성한 총 노트 수. 성능/한도 체크용 캐시. |
| `total_commits` | integer | 사용자가 생성한 총 커밋 수. 통계/한도 체크용 캐시. |

- 트리거 또는 앱 로직으로 노트/커밋 생성·삭제 시 `total_notes`, `total_commits`를 갱신해야 한도가 정확히 동작합니다.

---

## 3. 플랜별 한도·가격·기능

코드 상 정의: `src/lib/planLimits.ts`의 `PLAN_LIMITS` (Plan 페이지·헤더 게이지 공용).

| 플랜 | 가격 | 노트 한도 | 커밋 한도 | 비고 |
|------|------|-----------|-----------|------|
| **Free** | 0원/월 | 50개 | 200개 | 기본 플랜, 기본 노트/커밋 관리 |
| **Pro** | 5,000원/월 | 500개 | 2,000개 | 노트 외부공유 가능 (결제 연동 완료) |
| **Team** | 7,000원/월 | 2,000개+ | 10,000개+ | 팀 공동작업 가능 (결제 연동 완료) |

- 실제 제한 적용은 서버/Edge에서 `users.total_notes`, `users.total_commits`와 위 한도를 비교해 수행하는 것을 권장합니다.
- **노트 외부 공유**(공유여부 ON)는 Pro/Team 플랜에서만 가능하며, Free 플랜에서 ON 시도 시 AlertDialog로 업그레이드 유도합니다.
- **커밋 첨부파일**: 구글 드라이브에서 선택(앱 자체 피커 다이얼로그) 또는 링크 추가로 `commits.attachments`에 링크만 저장. 구현 완료.

---

## 4. UI/진입 경로

- **랜딩**: `/` — 비로그인 시 노출. 로고+CommitPush, 서비스, 이용요금, 로그인(Google 직접), 모토·슬로건, 지금 시작하기(Google 직접). 전용 로그인 페이지 없음.
- **이용요금(공개)**: `/pricing` — 비로그인 접근 가능. 플랜별 가격·한도 카드, 로그인/지금 시작하기 클릭 시 Google OAuth.
- **Plan 페이지**: `/plan` (로그인 필요, `app/(dashboard)/plan/page.tsx`) — 결제·청구 내역·구독 관리.
- **헤더 (상단 우측)** (로그인 후): **커밋푸시 아이콘**(MessageCircleMore), **새 노트 생성 아이콘**(FilePlus), **알림(벨) 아이콘**(Bell) → 클릭 시 각각 CommitPushDialog / NewNoteDialog / 알림 드롭다운. 그 우측에 **프로필 드롭다운**(아바타, 사용량 게이지, Billing 링크, 로그아웃). 드롭다운 열 때마다 프로필(사용량) 재조회.
  - 프로필 드롭다운 사용량 상단에는 현재 플랜 배지를 표시하며, 유료 플랜(Pro/Team)인 경우 배지 옆에 `plan_expires_at` 만료일과 `D-N일`을 함께 표시.
- Plan 페이지에서 표시하는 내용:
  - 상단 **2열 레이아웃**: 좌측 **현재 사용량** 카드(플랜, 만료일, 노트/커밋 게이지), 우측 **청구 내역** 카드(`payments` 테이블에서 `status in ('paid','cancelled')` 조회, 승인일·금액·플랜·상태·동작 표시, 사용량 카드와 동일 높이·길면 스크롤).
  - 월/연 구독 탭, Free / Pro / Team 플랜 카드(가격, 특징, "현재 플랜" 뱃지). **카드 클릭 시 해당 플랜 선택**(링 강조).
  - **현재 플랜이 Pro/Team일 때**: 해당 카드에는 "결제하기" 대신 **구독 취소** 버튼. 클릭 시 **구독 취소 AlertDialog** — 제목 "구독 취소", 본문에 현재 플랜명·만료일, "구독 취소 시 만료일까지 사용 가능하며 만료일 이후 Free 플랜으로 전환됩니다" 안내, 버튼 "확인"(다이얼로그만 닫힘).
  - **청구 내역 결제취소 버튼**: `status='paid'`이면서 `paid_at` 기준 24시간 이내 결제 건에만 **결제취소** 버튼 노출. 취소 성공 시 해당 건은 `status='cancelled'`(UI: 취소완료)로 표기되며 버튼은 사라짐.

---

## 5. 결제 연동 (나이스페이)

- **구현 상태**: Plan 페이지에서 Pro/Team 플랜에 대해 "결제하기" 버튼으로 나이스페이 결제창(Server 승인) 연동 완료.
- **흐름**: 주문 생성(`POST /api/payment/create`) → 결제창 호출(JS SDK `AUTHNICE.requestPay`) → 인증 후 `returnUrl`로 POST → 서버에서 승인 API 호출 → `users.plan` / `users.plan_expires_at` 갱신, `payments` 이력 저장.
- **returnUrl 동작**: 나이스페이는 인증 결과를 **POST**로만 전송하나, 결제창 닫기 시 모바일 등에서 **GET**으로만 오는 경우가 있음. `GET /api/payment/return`은 무조건 취소로 간주하고 `/plan?error=cancelled`로 응답. POST는 `authResultCode`가 `'0000'`이고 메시지에 취소/실패 문구가 없을 때만 승인 API 호출. ([나이스페이 로그/개발 가이드](https://start.nicepay.co.kr/manual/admin/developers/log/info.do) 참고)
- **returnUrl 응답 형식**: PC/모바일 구분 없이 **200 + HTML**(`window.location.replace` 또는 `window.top.location.replace`로 `/plan` 이동)만 사용. 302 리다이렉트는 사용하지 않음.
- **DB**: 결제 이력·멱등성용 `payments` 테이블 사용. 스키마는 `docs/DATABASE.md`의 "payments 테이블 (PG 결제 이력)" 참고.

### 5.1 환경 변수 (필수)

배포 시 **전체 환경 변수 목록**은 [ARCHITECTURE.md](./ARCHITECTURE.md) 참고. 아래는 결제 연동에 필요한 값 요약이며, [나이스페이 개발정보](https://start.nicepay.co.kr/manual/admin/developers/key/info.do)에서 발급한 값을 사용합니다.

| 변수명 | 용도 | 노출 |
|--------|------|------|
| `NEXT_PUBLIC_NICE_PAY_CLIENT_ID` | 결제창 JS SDK용 클라이언트 키 (나이스페이: **Server 승인** 타입) | 브라우저 (공개) |
| `NICE_PAY_SECRET_KEY` | 승인 API 호출용 시크릿 키. **Basic 인증** 타입 사용 권장 (Token 인증 시 v1 API에서 U103 발생 가능). **절대 클라이언트/저장소에 올리지 말 것.** | 서버 전용 |
| `NICE_PAY_MID` | 취소 API 서명·요청용 MID | 서버 전용 (미설정 시 clientId 사용) |
| `SUPABASE_SERVICE_ROLE_KEY` | return URL·웹훅에서 결제 조회·갱신용 (세션 없이 동작). **서버 전용, 노출 금지.** | 서버 전용 |

선택(기본값 있음):

| 변수명 | 용도 | 기본값 |
|--------|------|--------|
| `NICE_PAY_API_BASE` | 승인 API 도메인 | `https://sandbox-api.nicepay.co.kr` (테스트) |
| `NICE_PAY_MERCHANT_KEY` | 레거시 승인·**취소 API 서명**용 가맹점키 | return: 미설정 시 v1 API만 사용. **취소**: cancel_process.jsp의 SignData에 사용(미설정 시 secretKey로 시도, "가맹점키 조회 오류" A301 시 나이스페이에서 가맹점키 발급 후 설정) |
| `NICE_PAY_CANCEL_API_URL` | 취소 API URL | 실결제 기본 `dc1-api.nicepay.co.kr`, 테스트 `{NICE_PAY_API_BASE}/webapi/cancel_process.jsp` |
| `NEXT_PUBLIC_NICE_PAY_SDK_URL` | 결제창 JS 스크립트 URL | `https://sandbox-pay.nicepay.co.kr/v1/js/` (테스트) |

**운영 전환 시**: 위 두 기본값을 각각 `https://api.nicepay.co.kr`, `https://pay.nicepay.co.kr/v1/js/`로 변경하고, 클라이언트 키(**Server 승인**)·시크릿 키(**Basic 인증**)를 운영계 키로 교체해야 합니다.

### 5.2 결제 승인 API (구현 완료)

- **내부 엔드포인트**: `POST /api/payment/return`
- **역할**: 결제 인증 결과를 수신한 뒤, 서버에서 나이스페이 **승인 API**를 호출해 최종 결제 확정 처리.
- **세션 미사용**: PG에서 return URL로 POST할 때 브라우저가 세션 쿠키를 보내지 않을 수 있음. 따라서 **세션 없이** `SUPABASE_SERVICE_ROLE_KEY`로 `order_id` 기준 `payments` 조회 후 `payment.user_id`로 `users`·`notifications` 갱신.
- **승인 경로**:
  - **`NICE_PAY_MERCHANT_KEY` 없음** (권장): **v1 API** `POST {NICE_PAY_API_BASE}/v1/payments/{tid}`, **Basic 인증**(Base64(clientId:secretKey)), body `{ amount }`. 나이스페이 개발정보에서 시크릿 키는 **Basic 인증** 타입으로 발급.
  - **`NICE_PAY_MERCHANT_KEY` 있음**: 레거시 **pay_process.jsp**(NextAppURL 등)로 form-urlencoded 승인. 상점키(가맹점키)가 별도 발급된 경우에만 사용.
- **승인 호출 조건**:
  - `authResultCode='0000'`
  - 메시지에 취소/실패 문구가 없을 것
  - `order_id`에 해당하는 `payments` 레코드가 존재할 것
- **PG 승인 요청**:
  - 승인 API 도메인: `NICE_PAY_API_BASE` (기본 `https://sandbox-api.nicepay.co.kr`), v1 사용 시 동일 도메인
  - 주요 검증 입력: `tid`, `amount`, `order_id`
- **응답 검증**:
  - `resultCode='0000'`
  - `status='paid'`
  - `paidAt` 유효
  - 승인 응답의 `amount`가 주문 금액과 일치
- **성공 처리**:
  - `users.plan`을 결제 플랜(pro/team)으로 업데이트
  - `users.plan_expires_at` 설정(월 1개월 / 연 12개월)
  - `payments.status='paid'`, `tid`, `paid_at` 업데이트
  - `notifications`에 `type='payment_approved'` 1건 삽입
- **실패 처리**:
  - `payments.status='failed'` 업데이트
  - 플랜(`users`)은 변경하지 않음

### 5.3 결제 승인 후 취소(환불) API

- **엔드포인트**: `POST /api/payment/cancel`
- **취소 조건**:
  - 요청 사용자의 본인 결제 건이어야 함 (`payments.user_id`)
  - `payments.status='paid'`
  - `payments.paid_at` 기준 24시간 이내
- **PG 연동**: 나이스페이 **레거시** 취소 API(`cancel_process.jsp`, `application/x-www-form-urlencoded`) 호출
  - 서명: **SignData = sha256(MID + CancelAmt + EdiDate + MerchantKey)**. `NICE_PAY_MERCHANT_KEY`가 있으면 사용, 없으면 secretKey로 시도(실결제에서 A301/가맹점키 조회 오류 시 가맹점키 발급 후 설정).
  - 기본 URL: 실결제(`api.nicepay.co.kr`) 시 `dc1-api.nicepay.co.kr/webapi/cancel_process.jsp`(api.nicepay.co.kr은 404). 테스트는 `{NICE_PAY_API_BASE}/webapi/cancel_process.jsp`
  - 요청 값: `TID`, `MID`, `Moid(order_id)`, `CancelAmt`, `CancelMsg`, `PartialCancelCode=0`, `EdiDate`, `SignData`
  - 서명: `hex(sha256(MID + CancelAmt + EdiDate + SecretKey))`
- **성공 처리**:
  - `payments.status='cancelled'`로 업데이트
  - 현재 사용자 플랜이 해당 결제로 반영된 상태라면 `users.plan='free'`, `plan_expires_at=null`로 즉시 복구
  - `notifications`에 `type='payment_cancelled'` 알림 1건 삽입(결제 취소 안내)
  - 청구 내역 UI 상태는 **취소완료**로 표시

### 5.4 웹훅(PG사 콜백) 설정 (구현 완료)

**엔드포인트**
   - `POST /api/payment/webhook`
   - [나이스페이 웹훅 가이드](https://start.nicepay.co.kr/manual/admin/developers/hook/info.do)에 따라 결제(승인/취소) 이벤트를 수신합니다.

**처리 내용**
   - 수신 payload의 `signature`를 검증합니다. (`hex(sha256(tid+amount+ediDate+SecretKey))`)
   - 승인 이벤트(`resultCode=0000`, `status=paid`)는 `orderId`로 `payments` 조회 후 승인 API 호출 → `payments`·`users` 갱신 → `notifications`에 `payment_approved` 삽입(결제당 1건, `payment_id` unique).
   - 취소 이벤트(API/관리자 취소)는 `orderId` 또는 `tid`로 `payments` 조회 후 `payments.status='cancelled'`, `users.plan='free'`, `plan_expires_at=null` 반영 및 `notifications`에 `payment_cancelled` 삽입.
   - 응답 형식은 `Content-Type: text/html`, body `"OK"` 고정입니다.

**알림**
   - 결제 승인 시 `payment_approved`, 결제 취소 시 `payment_cancelled`를 `notifications`에 삽입합니다.
   - 헤더 **알림(벨) 아이콘**에서 조회·표시하며, 결제 관련 알림 클릭 시 `/plan`으로 이동합니다. `/api/notifications`는 쿠키 세션 우선, 없으면 `Authorization: Bearer`로 인증(결제 return 후 알림 표시 대비).
   - `/api/plan/check-expiry` 호출 시 만료 임박(`D-3`, `D-1`) 알림 `plan_expiry_3days`, `plan_expiry_1day`를 삽입합니다(동일 타입·동일 일자 중복 삽입 방지).

**등록 방법**
   - 나이스페이 개발정보 > 웹훅에서 결제수단 선택 후 웹훅 URL을 `https://{도메인}/api/payment/webhook` 로 등록합니다.
   - 등록 후 TEST 호출로 동작을 확인합니다.

**환경 변수**
   - 웹훅에서 DB 갱신·알림 삽입을 위해 **서버 전용** `SUPABASE_SERVICE_ROLE_KEY` 가 필요합니다.

**웹훅 필요성**
   - **필수는 아님**: return 흐름만으로도 “결제 완료 → 플랜 반영”은 동작합니다.
   - **권장되는 경우**:
     - 사용자가 return URL 로딩 전에 탭을 닫아 서버에 도달하지 못한 경우
     - PG 정책상 결제 결과 알림 URL 등록이 필요한 경우
     - 환불·취소 같은 비동기 이벤트를 서버에서 수신해야 하는 경우
   - 운영 전 PG 관리자/개발 문서에서 “결제 결과 통보 URL”, “웹훅”, “비동기 알림”의 필수 여부를 반드시 확인합니다.

### 5.5 결제 주기 · 수단

- **결제 주기**: 플랜 페이지에서 **월 구독** / **연 구독 (20% 할인)** 중 선택 가능. 연 구독은 월 구독료×12×0.8 (Pro 48,000원/년, Team 67,200원/년)로 결제되며, 만료일은 결제일 기준 12개월 후로 설정됩니다.
- **결제 수단**: 결제하기 클릭 시 **신용카드 · 간편결제**(`cardAndEasyPay`)로만 결제창을 띄웁니다. (카드 + 네이버페이, 카카오페이, 페이코, 삼성페이, SSGPAY)

### 5.6 결제 완료/취소 시 DB 변화

Plan 페이지에서 결제하기 클릭부터 PG 결제 완료, 그리고 결제 취소까지 DB가 어떻게 바뀌는지 요약합니다.

**1) 결제하기 클릭 — `POST /api/payment/create`**

| 테이블 | 동작 | 내용 |
|--------|------|------|
| **payments** | INSERT 1건 | `order_id`(UUID), `user_id`, `plan`, `amount`, `status='pending'`, `billing_cycle` |

- 이 시점에서는 **users** 변경 없음. 결제창에 넘길 `orderId`, `amount`, `goodsName`만 반환.

**2) PG 결제 완료 후 — Return URL (`POST /api/payment/return`)**

사용자가 결제창에서 결제 완료 후 우리 서버로 돌아올 때 호출됩니다.

1. **payments** 조회: `order_id`로 1건 조회.
2. PG **승인 API** 호출(tid, amount로 승인).
3. 승인 응답 검증: `resultCode='0000'`, `status='paid'` 외에 **paidAt** 유효 여부, **amount** 일치 여부 확인. 하나라도 불일치 시 승인 실패 처리(`payments.status='failed'`).
4. 승인 성공 시:

| 테이블 | 동작 | 변경 내용 |
|--------|------|-----------|
| **users** | UPDATE | `plan` = 결제한 플랜(pro/team), `plan_expires_at` = 만료일(월 1개월 / 연 12개월), `updated_at` = now |
| **payments** | UPDATE | `status='paid'`, `tid` = PG 거래키, `paid_at` = now |
| **notifications** | INSERT 1건 | `user_id`, `type='payment_approved'`, `payment_id`, 제목·본문(결제 완료 / Pro·Team 구독 적용) |

5. 승인 실패 시: **payments**만 `status='failed'`로 UPDATE. (결제 실패 시 `notifications` INSERT 없음 — 알림은 성공 건만.)

**3) PG 웹훅 — `POST /api/payment/webhook`**

PG사가 결제 승인 시점에 서버로 POST합니다. 이미 `payments.status='paid'`이면 users·payments는 건드리지 않고, **notifications INSERT만 시도**(이미 있으면 `payment_id` unique로 실패 가능). 아직 `pending`이면 return과 동일하게 승인 API 호출 후 **users** UPDATE, **payments** UPDATE, **notifications** INSERT 수행.

**결제 성공 시 최종 정리**

| 테이블 | 변경되는 컬럼/내용 |
|--------|-------------------|
| **payments** | `status` → `'paid'`, `tid`, `paid_at` 채움 |
| **users** | `plan`, `plan_expires_at`, `updated_at` 갱신 |
| **notifications** | 결제당 1건 INSERT (`type='payment_approved'`, `payment_id` 등) |

- Return과 웹훅 둘 다 오더라도, 먼저 처리된 쪽이 `payments.status='paid'`로 바꾸므로 나중 쪽은 users·payments는 수정하지 않고 알림만 넣는 **멱등** 구조입니다.

**4) 결제 취소 시 — `POST /api/payment/cancel` 또는 PG 취소 웹훅**

| 테이블 | 동작 | 변경 내용 |
|--------|------|-----------|
| **payments** | UPDATE | `status='cancelled'` |
| **users** | UPDATE | `plan='free'`, `plan_expires_at=null`, `updated_at=now` |
| **notifications** | INSERT 1건 | `type='payment_cancelled'`, 제목·본문(결제 취소 안내) |

---

## 6. 한도 체크 (구현 완료)

- **노트 생성**: `NewNoteDialog`, `app/(dashboard)/notes/new/page.tsx`에서 제출 전 `users`에서 `plan`, `total_notes` 조회 후 `total_notes >= getLimitsForPlan(plan).maxNotes`이면 insert 차단, 안내 메시지 표시.
- **커밋 생성**: `CommitPushDialog`에서 새 커밋 제출 전 `total_commits >= getLimitsForPlan(plan).maxCommits`이면 insert 차단, 안내 메시지 표시.
- **만료**: 대시보드 진입·로그인 시 `/api/plan/check-expiry` 호출.
  - `plan !== 'free'`이고 `plan_expires_at < now()`이면 `users.plan`을 `free`로, `plan_expires_at`을 `null`로 갱신.
  - 만료 전 남은 일수 기준으로 `D-3`, `D-1` 알림(`plan_expiry_3days`, `plan_expiry_1day`) 생성.
  - 즉 **만료일 이후 Free 플랜 전환은 check-expiry로 구현됨** (구독 취소 버튼과 무관).

---

## 7. 관련 파일

- **한도 상수**: `src/lib/planLimits.ts` — `PLAN_LIMITS`, `getLimitsForPlan()` (Plan 페이지·헤더 게이지 공용)
- **헤더**: `src/components/SharedAppLayout.tsx` — 커밋푸시/새 노트 아이콘, **알림(벨) 아이콘**(결제 완료/취소/만료 임박 알림 표시), 프로필 드롭다운(사용량 게이지, 유료 플랜 만료일·D-N, Billing, 로그아웃), NewNoteDialog·CommitPushDialog 렌더 (드롭다운 오픈 시 프로필 재조회)
- **한도 차단**: `src/components/NewNoteDialog.tsx`, `src/components/CommitPushDialog.tsx`, `app/(dashboard)/notes/new/page.tsx` — 노트/커밋 생성 전 한도 초과 시 insert 차단 및 안내
- **아바타 UI**: `src/components/ui/avatar.tsx` — shadcn 스타일 Avatar (AvatarImage, AvatarFallback)
- **페이지**: `app/(dashboard)/plan/page.tsx` — 요금제 제목, 2열(현재 사용량 | 청구 내역), 월/연 탭, 플랜 카드(클릭 선택), 결제하기/구독 취소 (`@/lib/planLimits` 사용)
- **결제 취소 API**: `app/api/payment/cancel/route.ts` — 결제 승인 후 24시간 이내 PG 취소(환불) 처리
- **API**: `app/api/plan/check-expiry/route.ts` — 만료된 유료 플랜을 free로 갱신하고, 만료 임박 `D-3`/`D-1` 알림 생성
- **레이아웃**: Plan은 `app/(dashboard)/layout.tsx` 하위에서 인증·SharedAppLayout 공유 (별도 plan 전용 layout 없음)
- **노트 공유 제한**: `app/(dashboard)/notes/[id]/page.tsx` — 공유여부 Switch는 Pro/Team일 때만 ON 가능, Free 시 AlertDialog로 업그레이드 유도

이 문서는 요금제 구조와 DB 연동을 정리한 안내서이며, 실제 결제·약관은 PG 및 법적 요구사항에 맞춰 별도 보완해야 합니다.
