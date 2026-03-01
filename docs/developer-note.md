# Plan·프로필 UI 정리 (만료일 표기·청구 내역·버튼 호버)

주요 기능 추가:

- **프로필 드롭다운 만료일 앞 "~" 표시**
  - **배경**: 상단 프로필 영역 드롭다운에서 플랜명·만료일·D-N일 표시 시, 만료일 앞에 **~** 를 붙여 "~2025.12.31 (D-30일)" 형태로 표기.
  - **구현**: `SharedAppLayout.tsx`의 `UsageGaugesInMenu`에서 유료 플랜 만료일 문자열 앞에 `~` 추가.
- **청구 내역 테이블 정리**
  - **동작 컬럼 제거**: 청구 내역에서 **동작** 컬럼(헤더·열) 제거. **결제취소** 버튼은 **상태** 셀 안에만 노출(24시간 이내 건).
  - **글자 크기·단락**: 컨테이너 크기 유지. 테이블 헤더·셀에 `text-xs` 적용해 단락 넘김 최소화. 금액·플랜·상태는 `whitespace-nowrap`으로 한 줄 유지.
  - **승인일**: 날짜와 시간을 두 줄로 표기(날짜 한 줄, 시간 한 줄). 예: `2025. 01. 15` / `오후 2:30`.
- **결제취소·구독 취소 버튼 호버**
  - **요구사항**: DESIGN.md 기준 아이콘·버튼 호버 시 옅은 회색 배경.
  - **구현**: **결제취소** 버튼(청구 내역 상태 셀), **구독 취소** 버튼(Pro 플랜 카드)에 `hover:bg-gray-100 dark:hover:bg-gray-800` 적용.

---

UI 컴포넌트:

- **SharedAppLayout (`src/components/SharedAppLayout.tsx`)**
  - `UsageGaugesInMenu`: 유료 플랜 만료일 표기 시 `~{날짜} (D-N일)` 형태로 변경.
- **Plan 페이지 (`app/(dashboard)/plan/page.tsx`)**
  - 청구 내역: 테이블 컬럼 승인일·금액·플랜·상태만 유지, 동작 컬럼 제거. 결제취소 버튼은 상태 셀 내부에 배치(Badge 스타일). 테이블 `text-xs`, 승인일 날짜/시간 두 줄, 결제취소·구독 취소 버튼 호버 스타일.
  - 플랜 카드: Free 카드는 하단 버튼 없음(현재 플랜일 때만 배지). Pro/Team: 월 구독 탭·현재 플랜이면 구독 취소, 연 구독 탭이면 결제하기(연 구독 결제). 유료 사용 시 Free 카드 선택 불가. 결제 시 `doPaymentWithMethod(planId, method, billingCycle)`로 탭(월/연) 전달. 페이지 로드 시 check-expiry 호출 후 프로필 조회(만료 시 plan=free 반영).

- **결제 승인 시 만료일 계산** (`/api/payment/return`, `/api/payment/webhook`)
  - 첫 구독 또는 만료 후 재구독: **결제일 기준** +1개월(월)/+12개월(연).
  - 이미 같은 플랜·만료일 미래(연 구독 전환 등): **현재 만료일 기준** +1개월/+12개월.

---

문서화:

- **DESIGN.md**
  - **프로필 드롭다운 플랜 표시**: 만료일 앞 **~** 표기(예: ~2025.12.31 (D-30일)) 문구 추가.
  - **요금제 페이지**: 청구 내역을 승인일·금액·플랜·상태 테이블(동작 컬럼 없음), `text-xs`, 승인일 날짜/시간 두 줄, 결제취소는 상태 셀에 배치로 정리. 결제취소·구독 취소 버튼 호버(`hover:bg-gray-100`, 다크 `dark:hover:bg-gray-800`) 명시.

---

파일 구조:

- `src/components/SharedAppLayout.tsx` — UsageGaugesInMenu 만료일 앞 `~` 추가.
- `app/(dashboard)/plan/page.tsx` — 청구 내역·플랜 카드(Free 버튼 없음, 탭별 구독 취소/결제하기, Free 선택 제한, billingCycle 전달)·check-expiry 선 호출.
- `app/api/payment/return/route.ts`, `app/api/payment/webhook/route.ts` — 만료일 계산(첫/만료 후 = 결제일 기준, 동일 플랜 만료일 있으면 만료일 기준).
- `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md` — 만료일 정책·Plan UI·연 구독 탭 반영.
