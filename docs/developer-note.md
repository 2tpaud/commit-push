# 개발자 노트 — PushMind·Plan·프로필 UI (RAG 챗봇·만료일 표기·청구 내역·버튼 호버)

---

주요 기능 추가:

- **PushMind (RAG 챗봇)**
  - **배경**: 노트·커밋 내용을 질의할 수 있는 RAG 기반 지식 챗봇. 우측 하단 플로팅 버튼으로 진입, Sheet 채팅 패널로 질문·답변·출처 제공.
  - **구현**: 패널 열 때마다 `POST /api/pushmind/embed` 전체 동기화 자동 호출. 동기화 중 입력 비활성화 + "동기화 중..." 표시. 대화 state는 SharedAppLayout에서 보관해 페이지 이동 시에도 유지. 헤더에 슬로건 "기록이 만들어낸 또 하나의 브레인 PushMind", 환영 메시지는 "무엇을 도와드릴까요?"만 표시. 참고한 출처는 유사도 최고 1건(동률이면 모두), 노트 클릭 시 노트 페이지, 커밋 클릭 시 노트 페이지 + 커밋 시트 열림 + 해당 커밋 1초 하이라이트(`openCommit` 쿼리). [PUSHMIND-RAG.md](./PUSHMIND-RAG.md) 참고.
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
  - PushMind: `pushMindMessages` state 보관, `PushMindChatPanel`에 `messages`·`setMessages` props 전달.
- **PushMindChatPanel (`src/components/PushMindChatPanel.tsx`)**
  - 패널 열 때마다 embed 동기화 호출. 헤더에 제목·슬로건, 환영 메시지 "무엇을 도와드릴까요?". 참고한 출처(유사도 최고 1건/동률 모두), 출처 클릭 시 노트 페이지 또는 노트+커밋 시트·하이라이트.
- **Plan 페이지 (`app/(dashboard)/plan/page.tsx`)**
  - 청구 내역: 테이블 컬럼 승인일·금액·플랜·상태만 유지, 동작 컬럼 제거. 결제취소 버튼은 상태 셀 내부에 배치(Badge 스타일). 테이블 `text-xs`, 승인일 날짜/시간 두 줄, 결제취소·구독 취소 버튼 호버 스타일.
  - 플랜 카드: Free 카드는 하단 버튼 없음(현재 플랜일 때만 배지). Pro/Team: 월 구독 탭·현재 플랜이면 구독 취소, 연 구독 탭이면 결제하기(연 구독 결제). 유료 사용 시 Free 카드 선택 불가. 결제 시 `doPaymentWithMethod(planId, method, billingCycle)`로 탭(월/연) 전달. 페이지 로드 시 check-expiry 호출 후 프로필 조회(만료 시 plan=free 반영).
- **노트 상세 (`app/(dashboard)/notes/[id]/page.tsx`)**
  - `openCommit` 쿼리 시 커밋 내역 Sheet 자동 오픈, 해당 커밋 카드 하이라이트(약 1초).
- **결제 승인 시 만료일 계산** (`/api/payment/return`, `/api/payment/webhook`)
  - 첫 구독 또는 만료 후 재구독: **결제일 기준** +1개월(월)/+12개월(연).
  - 이미 같은 플랜·만료일 미래(연 구독 전환 등): **현재 만료일 기준** +1개월/+12개월.

---

문서화:

- **DESIGN.md**
  - **프로필 드롭다운 플랜 표시**: 만료일 앞 **~** 표기(예: ~2025.12.31 (D-30일)) 문구 추가.
  - **요금제 페이지**: 청구 내역을 승인일·금액·플랜·상태 테이블(동작 컬럼 없음), `text-xs`, 승인일 날짜/시간 두 줄, 결제취소는 상태 셀에 배치로 정리. 결제취소·구독 취소 버튼 호버(`hover:bg-gray-100`, 다크 `dark:hover:bg-gray-800`) 명시.
  - **PushMind**: 패널 열 때마다 자동 동기화, 대화 유지(SharedAppLayout), 참고 출처·출처 클릭 동작 반영.
- **PUSHMIND-RAG.md**, **ARCHITECTURE.md**
  - PushMind 프론트 UX(동기화 주기, 환영/슬로건, 출처 표시·클릭), embed 호출 주기(패널 열 때마다), API 설명 반영.

---

파일 구조:

- `src/components/SharedAppLayout.tsx` — UsageGaugesInMenu 만료일 앞 `~` 추가. PushMind 대화 state(`pushMindMessages`) 보관.
- `src/components/PushMindChatPanel.tsx` — 채팅 패널, 동기화·환영·출처·출처 클릭(노트/커밋 이동·하이라이트).
- `app/(dashboard)/plan/page.tsx` — 청구 내역·플랜 카드(Free 버튼 없음, 탭별 구독 취소/결제하기, Free 선택 제한, billingCycle 전달)·check-expiry 선 호출.
- `app/(dashboard)/notes/[id]/page.tsx` — `openCommit` 쿼리 시 커밋 시트 오픈·해당 커밋 하이라이트.
- `app/api/pushmind/embed/route.ts`, `app/api/pushmind/chat/route.ts` — PushMind 동기화·질의 API.
- `app/api/payment/return/route.ts`, `app/api/payment/webhook/route.ts` — 만료일 계산(첫/만료 후 = 결제일 기준, 동일 플랜 만료일 있으면 만료일 기준).
- `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PUSHMIND-RAG.md` — 만료일 정책·Plan UI·PushMind UX·API 반영.
