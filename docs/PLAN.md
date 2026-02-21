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
| **Pro** | 5,000원/월 | 500개 | 2,000개 | 노트 외부공유 가능 (결제 연동 예정) |
| **Team** | 7,000원/월 | 2,000개+ | 10,000개+ | 팀 공동작업 가능 (결제 연동 예정) |

- 실제 제한 적용은 서버/Edge에서 `users.total_notes`, `users.total_commits`와 위 한도를 비교해 수행하는 것을 권장합니다.
- **노트 외부 공유**(공유여부 ON)는 Pro/Team 플랜에서만 가능하며, Free 플랜에서 ON 시도 시 AlertDialog로 업그레이드 유도합니다.

---

## 4. UI/진입 경로

- **Plan 페이지**: `/plan` (로그인 필요, `app/(dashboard)/plan/page.tsx`)
- **헤더 (상단 우측)**: **커밋푸시 아이콘**(MessageCircleMore), **새 노트 생성 아이콘**(FilePlus) → 클릭 시 각각 CommitPushDialog / NewNoteDialog 오픈. 그 우측에 **프로필 드롭다운**(아바타, 사용량 게이지, Billing 링크, 로그아웃). 드롭다운 열 때마다 프로필(사용량) 재조회.
- Plan 페이지에서 표시하는 내용:
  - 상단 **2열 레이아웃**: 좌측 **현재 사용량** 카드(플랜, 만료일, 노트/커밋 게이지), 우측 **청구 내역** 카드(`payments` 테이블에서 `status = 'paid'`만 조회, 승인일·금액·플랜·상태 표시, 사용량 카드와 동일 높이·길면 스크롤).
  - 월/연 구독 탭, Free / Pro / Team 플랜 카드(가격, 특징, "현재 플랜" 뱃지). **카드 클릭 시 해당 플랜 선택**(링 강조).

---

## 5. 결제 연동 (나이스페이)

- **구현 상태**: Plan 페이지에서 Pro/Team 플랜에 대해 "결제하기" 버튼으로 나이스페이 결제창(Server 승인) 연동 완료.
- **흐름**: 주문 생성(`POST /api/payment/create`) → 결제창 호출(JS SDK `AUTHNICE.requestPay`) → 인증 후 `returnUrl`로 POST → 서버에서 승인 API 호출 → `users.plan` / `users.plan_expires_at` 갱신, `payments` 이력 저장.
- **DB**: 결제 이력·멱등성용 `payments` 테이블 사용. 스키마는 `docs/DATABASE.md`의 "payments 테이블 (PG 결제 이력)" 참고.

### 5.1 환경 변수 (필수)

아래 키는 [나이스페이 개발정보](https://start.nicepay.co.kr/manual/admin/developers/key/info.do)에서 발급한 값을 사용합니다.

| 변수명 | 용도 | 노출 |
|--------|------|------|
| `NEXT_PUBLIC_NICE_PAY_CLIENT_ID` | 결제창 JS SDK용 클라이언트 키 | 브라우저 (공개) |
| `NICE_PAY_SECRET_KEY` | 승인 API 호출용 시크릿 키. **절대 클라이언트/저장소에 올리지 말 것.** | 서버 전용 |

선택(기본값 있음):

| 변수명 | 용도 | 기본값 |
|--------|------|--------|
| `NICE_PAY_API_BASE` | 승인 API 도메인 | `https://sandbox-api.nicepay.co.kr` (테스트) |
| `NEXT_PUBLIC_NICE_PAY_SDK_URL` | 결제창 JS 스크립트 URL | `https://sandbox-pay.nicepay.co.kr/v1/js/` (테스트) |

**운영 전환 시**: 위 두 기본값을 각각 `https://api.nicepay.co.kr`, `https://pay.nicepay.co.kr/v1/js/`로 변경하고, 클라이언트 키·시크릿 키를 운영계 키로 교체해야 합니다.

### 5.2 웹훅(PG사 콜백) 설정 (구현 완료)

- **엔드포인트**: `POST /api/payment/webhook` — [나이스페이 웹훅 가이드](https://start.nicepay.co.kr/manual/admin/developers/hook/info.do)에 따라 결제(승인) 시점에 PG가 호출합니다.
- **처리 내용**: 수신 payload의 `signature` 검증(`hex(sha256(tid+amount+ediDate+SecretKey))`) 후, `resultCode=0000`, `status=paid`일 때만 처리. `orderId`로 `payments` 조회 후 미승인이면 승인 API 호출 후 `payments`·`users` 갱신. 그다음 `notifications` 테이블에 알림 1건 삽입(결제당 1건, `payment_id` unique). 응답은 **Content-Type: text/html**, body **"OK"** 필수.
- **알림**: return URL에서도 결제 완료 시 동일하게 `notifications`에 삽입. 헤더 **알림(벨) 아이콘**에서 조회·표시하며, 클릭 시 읽음 처리 및 결제 알림이면 `/plan`으로 이동.
- **등록 방법**: 나이스페이 개발정보 > 웹훅에서 결제수단 선택 후 웹훅 URL을 `https://{도메인}/api/payment/webhook` 로 등록. 등록 후 TEST 호출로 동작 확인 권장.
- **환경 변수**: 웹훅에서 DB 갱신·알림 삽입을 위해 **서버 전용** `SUPABASE_SERVICE_ROLE_KEY` 가 필요합니다. (Vercel 등 서버 환경 변수에만 설정.)

- **웹훅이 꼭 필요할까?**
  - **필수는 아닙니다.** 위 return 흐름만으로도 “결제 완료 → 플랜 반영”은 동작합니다.
  - **웹훅을 두면 좋은 경우**: (1) 사용자가 return URL 로딩 전에 탭을 닫아서 우리 서버에 한 번도 도달하지 못한 경우, (2) PG사가 정책/운영상 “결제 결과 알림 URL” 등록을 요구하는 경우, (3) 환불·취소 등 비동기 이벤트를 PG가 서버로 알려줘야 하는 경우.
- **나이스페이 기준**: PG사 관리자/개발 문서에서 “결제 결과 통보 URL”, “웹훅”, “비동기 알림” 등록이 **필수**인지 확인하는 것이 좋습니다. 운영 전환 시 요구사항이 있을 수 있습니다.
- **웹훅을 쓸 경우**: 예) `POST /api/payment/webhook` 같은 엔드포인트를 만들고, PG에서 전달하는 서명/payload를 검증한 뒤 `orderId` 기준으로 `payments`·`users`를 갱신하고, return URL에서 이미 처리된 주문은 멱등하게 스킵하도록 구현하면 됩니다. 웹훅 URL은 나이스페이 개발자 콘솔/관리자에서 등록합니다.

### 5.3 결제 주기 · 수단

- **결제 주기**: 플랜 페이지에서 **월 구독** / **연 구독 (20% 할인)** 중 선택 가능. 연 구독은 월 구독료×12×0.8 (Pro 48,000원/년, Team 67,200원/년)로 결제되며, 만료일은 결제일 기준 12개월 후로 설정됩니다.
- **결제 수단**: 결제하기 클릭 시 **신용카드 · 간편결제**(`cardAndEasyPay`)로만 결제창을 띄웁니다. (카드 + 네이버페이, 카카오페이, 페이코, 삼성페이, SSGPAY)

---

## 6. 한도 체크 (구현 완료)

- **노트 생성**: `NewNoteDialog`, `app/(dashboard)/notes/new/page.tsx`에서 제출 전 `users`에서 `plan`, `total_notes` 조회 후 `total_notes >= getLimitsForPlan(plan).maxNotes`이면 insert 차단, 안내 메시지 표시.
- **커밋 생성**: `CommitPushDialog`에서 새 커밋 제출 전 `total_commits >= getLimitsForPlan(plan).maxCommits`이면 insert 차단, 안내 메시지 표시.
- **만료**: 대시보드 진입·로그인 시 `/api/plan/check-expiry` 호출. `plan !== 'free'`이고 `plan_expires_at < now()`이면 `users.plan`을 `free`로 갱신.

---

## 7. 관련 파일

- **한도 상수**: `src/lib/planLimits.ts` — `PLAN_LIMITS`, `getLimitsForPlan()` (Plan 페이지·헤더 게이지 공용)
- **헤더**: `src/components/SharedAppLayout.tsx` — 커밋푸시/새 노트 아이콘, **알림(벨) 아이콘**(결제 완료 등 웹훅·return 알림 표시), 프로필 드롭다운(사용량 게이지, Billing, 로그아웃), NewNoteDialog·CommitPushDialog 렌더 (드롭다운 오픈 시 프로필 재조회)
- **한도 차단**: `src/components/NewNoteDialog.tsx`, `src/components/CommitPushDialog.tsx`, `app/(dashboard)/notes/new/page.tsx` — 노트/커밋 생성 전 한도 초과 시 insert 차단 및 안내
- **아바타 UI**: `src/components/ui/avatar.tsx` — shadcn 스타일 Avatar (AvatarImage, AvatarFallback)
- **페이지**: `app/(dashboard)/plan/page.tsx` — 요금제 제목, 2열(현재 사용량 | 청구 내역), 월/연 탭, 플랜 카드(클릭 선택), 결제하기/구독 취소 (`@/lib/planLimits` 사용)
- **API**: `app/api/plan/check-expiry/route.ts` — 만료된 유료 플랜을 free로 갱신
- **레이아웃**: Plan은 `app/(dashboard)/layout.tsx` 하위에서 인증·SharedAppLayout 공유 (별도 plan 전용 layout 없음)
- **노트 공유 제한**: `app/(dashboard)/notes/[id]/page.tsx` — 공유여부 Switch는 Pro/Team일 때만 ON 가능, Free 시 AlertDialog로 업그레이드 유도

이 문서는 요금제 구조와 DB 연동을 정리한 안내서이며, 실제 결제·약관은 PG 및 법적 요구사항에 맞춰 별도 보완해야 합니다.
