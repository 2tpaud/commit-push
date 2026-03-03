# 개발자 노트 — NicePay REST 전환·결제 문서 최신화

---

주요 기능 추가:

- **결제 승인 API (`POST /api/payment/return`) REST 전용 통일**
  - 나이스페이 승인 호출을 **항상** `POST {NICE_PAY_API_BASE}/v1/payments/{tid}` + `Authorization: Basic base64(clientId:secretKey)`로만 수행.
  - `resultCode === "0000"`, `amount` 일치, `status === "paid"` 또는 `paidAt` 존재일 때만 승인으로 간주.
  - 기존 로직(주문 조회, 중복 결제 우회, 금액 검증, 플랜 연장, `payments.status='paid'`, `notifications.payment_approved`)은 그대로 유지.
- **결제 취소 API (`POST /api/payment/cancel`) REST 전용 통일**
  - 레거시 `cancel_process.jsp` + MID/MerchantKey/SignData/EdiDate 서명 제거.
  - 항상 `POST {NICE_PAY_API_BASE}/v1/payments/{tid}/cancel` + Basic 인증, body `{ amount, reason }` 사용.
  - `resultCode === "0000"`일 때만 성공 처리, 401 → `nicepay_auth`, 그 외 → `cancel_failed`.
- **레거시 NicePay 의존성 제거**
  - 코드·문서에서 `pay_process.jsp`, `cancel_process.jsp`, `MID`, `MerchantKey`, `SignData`, `EdiDate`, `NICE_PAY_MID`, `NICE_PAY_MERCHANT_KEY`, `NICE_PAY_CANCEL_API_URL` 전부 제거.
- **문서 최신화**
  - `ARCHITECTURE.md`, `PLAN.md`, `PAYMENT-TEST-CHECKLIST.md`를 REST + Basic 인증 기준으로 업데이트.

---

UI·API:

- **결제 승인 API** (`app/api/payment/return/route.ts`)
  - 입력: 나이스페이 returnUrl 콜백(POST), `authResultCode`, `authResultMsg`, `tid`, `orderId`, `amount`.
  - 처리:
    - `authResultCode !== "0000"` 또는 메시지에 “취소/실패” 포함 → `/plan?error=cancelled`.
    - `order_id`로 `payments` 조회, 금액·상태 검증, `status='paid'`면 중복 승인 없이 성공 처리.
    - 승인 호출: `POST {NICE_PAY_API_BASE}/v1/payments/{tid}` + Basic, `{ amount: payment.amount }`.
    - 응답 검증 후 `users.plan`·`plan_expires_at` 연장, `payments.status='paid'`, `tid`, `paid_at`, `notifications.payment_approved` 삽입.
    - 실패 시 `payments.status='failed'`로 업데이트, 401이면 `/plan?error=nicepay_auth`, 그 외 `/plan?error=approval_failed`.
- **결제 취소 API** (`app/api/payment/cancel/route.ts`)
  - 입력: `paymentId`, `reason` (JSON), 인증은 Supabase 세션(쿠키) 우선, 없으면 Authorization: Bearer.
  - 처리:
    - `payments`에서 해당 결제 조회, 소유자(`payments.user_id === user.id`) 및 상태(`status='paid'`), 24시간 이내(`paid_at`) 검증, `tid` 필수.
    - 취소 호출: `POST {NICE_PAY_API_BASE}/v1/payments/{tid}/cancel` + Basic, `{ amount, reason }`.
    - `resultCode !== "0000"` → 로그 남기고 HTTP 401이면 `nicepay_auth`, 그 외 `cancel_failed` 리턴.
    - 성공 시 `payments.status='cancelled'`, `users.plan='free'`, `plan_expires_at=null`, `notifications.payment_cancelled` 삽입.
- **환경 변수**
  - 사용: `NEXT_PUBLIC_NICE_PAY_CLIENT_ID`, `NICE_PAY_SECRET_KEY`, `NICE_PAY_API_BASE`, `NEXT_PUBLIC_NICE_PAY_SDK_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  - 미사용(삭제 대상): `NICE_PAY_MID`, `NICE_PAY_MERCHANT_KEY`, `NICE_PAY_CANCEL_API_URL` 및 레거시 JSP 전용 값.

---

문서화:

- **ARCHITECTURE.md**
  - `/api/payment/return`, `/api/payment/cancel` 설명을 REST v1 + Basic 인증 한 가지 경로로만 서술.
  - 승인/취소 성공 조건, 오류 코드(`nicepay_auth`, `approval_failed`, `cancel_failed`)를 현재 구현 기준으로 정리.
  - 레거시 pay_process/cancel_process + MID/MerchantKey/SignData/EdiDate 관련 문구 삭제.
- **PLAN.md**
  - 5.1 환경 변수에서 MID/MERCHANT_KEY/CANCEL_API_URL 제거, REST용 env만 남김.
  - 5.2: 승인 경로를 `POST {NICE_PAY_API_BASE}/v1/payments/{tid}` + Basic 한 가지로 명시.
  - 5.3: 취소 경로를 `POST {NICE_PAY_API_BASE}/v1/payments/{tid}/cancel` + Basic, `resultCode='0000'` 기준으로 설명.
- **PAYMENT-TEST-CHECKLIST.md**
  - 사전 준비에서 MID/MerchantKey 제거, REST용 env만 체크.
  - 취소 테스트를 “REST 취소 API `resultCode='0000'` 기준으로 `payments.status='cancelled'`”로 정리, 가맹점키/서명 관련 내용 삭제.
- **DESIGN.md / DATABASE.md / PRODUCT.md / PUSHMIND-RAG.md**
  - 결제 레이어 의존성이 없는 부분(제품 개념, RAG, DB 구조 등)은 현 상태 유지.

---

파일 구조:

- `app/api/payment/return/route.ts` — NicePay returnUrl 처리, REST 승인 API 호출, `users`·`payments`·`notifications` 갱신.
- `app/api/payment/cancel/route.ts` — Plan 페이지에서 24시간 이내 결제 취소 처리, REST 취소 API 호출.
- `app/api/payment/webhook/route.ts` — 나이스페이 웹훅(승인/취소 이벤트) 처리, 승인/취소 멱등 반영.
- `app/(dashboard)/plan/page.tsx` — 요금제/결제 UI, 결제하기/결제취소 버튼, 청구 내역 테이블.
- `docs/ARCHITECTURE.md` — API 레이어·환경 변수 구조 최신화(REST 기준).
- `docs/PLAN.md` — 플랜/결제 흐름·env·승인/취소 API 설명 최신화(REST 기준).
- `docs/PAYMENT-TEST-CHECKLIST.md` — 결제/취소 테스트 체크리스트 REST 기준으로 정리.
