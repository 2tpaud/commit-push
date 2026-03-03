# 결제·취소 테스트 체크리스트

결제 및 결제 취소 기능 테스트 시 확인할 항목입니다. PLAN.md, ARCHITECTURE.md 기준으로 정리했습니다.

---

## 1. 사전 준비

- [ ] `.env.local`에 결제 관련 환경 변수 설정
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (return URL에서 결제 조회·갱신용, 결제 사용 시 필수)
  - `NEXT_PUBLIC_NICE_PAY_CLIENT_ID` (나이스페이: **Server 승인** 타입), `NICE_PAY_SECRET_KEY` (**Basic 인증** 타입, REST 승인/취소 공용)
  - `NICE_PAY_API_BASE` (테스트: `https://sandbox-api.nicepay.co.kr`)
  - `NEXT_PUBLIC_NICE_PAY_SDK_URL` (테스트: `https://sandbox-pay.nicepay.co.kr/v1/js/`)
- [ ] 나이스페이 개발정보에서 테스트용 키 발급·등록 (클라이언트 키: Server 승인, 시크릿 키: **Basic 인증**)
- [ ] 로그인 상태에서 `/plan` 접근 가능한지 확인
- [ ] Vercel 배포 시 위 환경 변수 동일하게 등록
  - `SUPABASE_SERVICE_ROLE_KEY` (결제 return·웹훅 필수)
  - **실결제 시** `NICE_PAY_API_BASE=https://api.nicepay.co.kr` 반드시 등록 (미등록 시 승인 401)

---

## 2. 결제 흐름 테스트

- [ ] **결제하기 클릭**
  - Pro 또는 Team 플랜 카드에서 "결제하기" 클릭 (월/연 탭 선택에 따라 월·연 결제)
  - **연 구독**: "연 구독 20% 할인" 탭 선택 후 결제하기 → 연 구독 금액·만료일(결제일+12개월 또는 기존 만료일+12개월) 반영
  - 나이스페이 결제창 정상 오픈
  - (선택) 결제창·영수증에 구매자명(users.full_name), 이메일 전달 여부 확인
- [ ] **결제 완료**
  - 테스트 카드로 결제 진행
  - 결제 후 `/plan`으로 리다이렉트
- [ ] **DB 반영**
  - `payments`: `status='paid'`, `tid`, `paid_at` 채워짐
  - `users`: `plan`, `plan_expires_at` 갱신
- [ ] **알림**
  - 헤더 벨 아이콘에 `payment_approved` 알림 표시
  - 알림 클릭 시 `/plan` 이동
- [ ] **UI**
  - Plan 페이지 상단 사용량 카드에 Pro/Team 플랜, 만료일 표시
  - 청구 내역에 해당 건 **승인**으로 표시

---

## 3. 결제 취소 테스트 (24시간 이내, REST 취소 API)

- [ ] **결제취소 버튼 노출**
  - `status='paid'`이고 `paid_at` 기준 24시간 이내 건에만 버튼 노출
- [ ] **결제취소 클릭**
  - "결제취소" 클릭 → "취소 처리 중…" 표시
  - 취소 완료 후 목록 재조회
- [ ] **취소 후 DB**
  - `payments.status='cancelled'` (REST 취소 API `resultCode='0000'` 기준)
  - `users.plan='free'`, `plan_expires_at=null`
- [ ] **취소 후 알림**
  - `payment_cancelled` 알림 생성
  - 벨 아이콘에서 확인 가능
- [ ] **취소 후 UI**
  - 청구 내역에 **취소완료** 표시
  - 결제취소 버튼 사라짐
  - 프로필 드롭다운에서 플랜이 Free로 표시

---

## 4. 만료일 계산 (선택)

- [ ] **첫 구독·만료 후 재구독**: 결제일 기준 +1개월(월) 또는 +12개월(연)으로 `plan_expires_at` 설정
- [ ] **기존 유료 사용자 연 구독**: 같은 플랜·만료일 미래인 상태에서 연 구독 결제 시, 만료일이 **현재 만료일 +12개월**로 갱신되는지 확인

---

## 5. 예외·경계 케이스

- [ ] **결제창 취소**
  - 결제창에서 취소/닫기 → `/plan?error=cancelled`로 이동
- [ ] **24시간 초과**
  - `paid_at` 기준 24시간 지난 건에는 결제취소 버튼 미노출
- [ ] **타인 결제 건**
  - 다른 사용자 결제 건에 대한 취소 요청 시 차단
- [ ] **이미 취소된 건**
  - `status='cancelled'` 건에 대한 중복 취소 시도 차단

---

## 6. DB 직접 확인 (선택)

- [ ] `payments` 테이블: `order_id`, `status`, `tid`, `paid_at` 확인
- [ ] `users` 테이블: `plan`, `plan_expires_at` 확인
- [ ] `notifications` 테이블: `type` (`payment_approved`, `payment_cancelled`) 확인

---

## 7. 웹훅 (선택, 나중에)

- [ ] 나이스페이 개발정보 > 웹훅에 `https://{도메인}/api/payment/webhook` 등록
- [ ] TEST 호출로 응답 확인

---

**테스트 순서 권장**: 사전 준비 → 결제 1건 성공 → 즉시 결제취소 → DB·알림·UI 확인.
