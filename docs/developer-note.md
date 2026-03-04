# 개발자 노트 2 — 랜딩·이용요금·약관/개인정보·헤더/푸터 정리

---

주요 기능 추가:

- **비로그인 랜딩/이용요금 헤더·네비게이션 정리**
  - 랜딩(`/`)·이용요금(`/pricing`) 상단 헤더를 통일: 좌측 CommitPush 로고, 중앙 `서비스`/`이용요금` 텍스트 네비게이션, 우측 `로그인` 버튼 구조로 고정.
  - `서비스`/`이용요금`은 링크처럼 보이지만 **손가락 커서 대신 기본 커서**를 사용하고, 호버 시에만 옅은 회색(`hover:bg-gray-100`, 다크 `dark:hover:bg-gray-800`) 배경이 적용되도록 변경.
  - 로그인 버튼은 shadcn Button variant="outline" + `border-input`를 유지하면서, 호버 시 옅은 회색 음영만 들어가도록 통일(`hover:bg-gray-100`, 다크 `dark:hover:bg-gray-800`).
- **서비스 이용약관·개인정보 처리방침 페이지 추가**
  - `/terms` 경로에 CommitPush용 **서비스 이용약관** 페이지 추가: 서비스 정의, 이용계약, 요금·결제, 이용자/회사 의무, 책임 제한, 분쟁 해결, 사업자 정보(씨큐브드(C Cubed))까지 포함.
  - `/privacy` 경로에 CommitPush용 **개인정보 처리방침** 페이지 추가: 수집 항목, 이용 목적, 보유 기간, 제3자 제공·위탁, 쿠키, 안전성 확보조치, 문의처(씨큐브드(C Cubed), 이메일·주소 포함)까지 정리.
  - 두 페이지 모두 **시행일자(2026-02-16)** 를 명시하고, 서로를 교차 링크(`/terms` ↔ `/privacy`) 하도록 구성.
- **랜딩 CTA 하단 약관 동의 문구·푸터 사업자 정보 표기**
  - 랜딩의 `지금 시작하기` 버튼 하단에 `"지금 시작하기 클릭 시 서비스 이용약관 및 개인정보 처리방침에 동의하는 것입니다."` 문구 추가.
  - 문구 내에서 `서비스 이용약관`은 `/terms`, `개인정보 처리방침`은 `/privacy`로 직접 이동 가능하도록 링크 처리.
  - 랜딩 최하단에 사업자 정보 푸터 한 줄 추가: `상호: 씨큐브드(C Cubed) ｜ 대표자명: 이세명 ｜ 사업자등록번호: 781-47-00894 ｜ 주소: 경기도 이천시 백사면 원적로617번길 150-18 ｜ 이메일: 2tpaud@gmail.com` + 다음 줄에 `© {연도} 씨큐브드(C Cubed). All rights reserved.` 노출.
- **비로그인 공개 라우트 확장**
  - 인증 레이아웃에서 비로그인 시 허용되는 공개 경로에 `/terms`(서비스 이용약관), `/privacy`(개인정보 처리방침)를 추가해, 로그인 없이도 약관·정책을 열람할 수 있도록 구조 정리.

---

UI·API:

- **대시보드 레이아웃·공개 라우트** (`app/(dashboard)/layout.tsx`)
  - 세션 상태에 따라 비로그인 시 허용하는 공개 경로를 `['/', '/login', '/pricing']`에서 `['/', '/login', '/pricing', '/terms', '/privacy']`로 확장.
  - `loading` 이후 `!user` 인 경우:
    - `pathname === '/'` → `LandingPage` 렌더,
    - `'/pricing'`, `'/terms'`, `'/privacy'` → 그대로 `children` 렌더,
    - 그 외 경로는 `null` 반환(실제 사용자는 `/`로 리다이렉트).
- **랜딩 페이지 UI** (`src/components/LandingPage.tsx`)
  - 헤더:
    - 좌측: CommitPush 로고(`commitpush-logo.png`) + 텍스트.
    - 중앙: `서비스`, `이용요금` 텍스트 네비게이션 — `rounded px-2 py-1 text-sm text-muted-foreground transition-colors` + `hover:bg-gray-100 dark:hover:bg-gray-800`, `style={{ cursor: 'default' }}`로 손가락 커서 제거.
    - 우측: 로그인 버튼 — `variant="outline" size="sm" className="border-input hover:bg-gray-100 dark:hover:bg-gray-800"`, 클릭 시 Google OAuth(`supabase.auth.signInWithOAuth`) 바로 호출.
  - 본문:
    - 모토·슬로건 문구 하단에 `지금 시작하기` 버튼(시그니처 컬러 배경) 배치.
    - 버튼 바로 아래 `text-[11px] text-muted-foreground/80` 스타일로 약관 동의 문구 표시, `Link`로 `/terms`, `/privacy` 연결.
  - 푸터:
    - `border-t bg-card px-4 py-5 text-[11px] text-muted-foreground` 컨테이너 안에 사업자 정보 한 줄, 그 아래 줄에 `© {연도} 씨큐브드(C Cubed). All rights reserved.` 표시.
- **이용요금 페이지 UI** (`app/(dashboard)/pricing/page.tsx`)
  - 헤더:
    - 랜딩과 동일한 구조/스타일을 사용하도록 refactor:
      - `nav` gap 조정(`gap-4 md:gap-6`), `서비스`/`이용요금` 텍스트는 랜딩과 같은 hover/커서 스타일(`hover:bg-gray-100 dark:hover:bg-gray-800`, `cursor: default`).
      - 로그인 버튼은 outline + `hover:bg-gray-100 dark:hover:bg-gray-800`로 Landing과 동일하게 통일.
  - 본문:
    - 상단 제목/부제 + 우측 상단 **Tabs** 를 사용한 월/연 구독 탭(`TabsList`, `TabsTrigger`).
    - Free/Pro/Team 카드에서 Plan 페이지와 동일한 가격·한도·PushMind 기능 설명만 노출하고, 실제 결제/구독 버튼은 두지 않음.
    - 하단 `지금 시작하기` 버튼은 Landing과 동일하게 Google OAuth로 바로 진입.
- **서비스 이용약관 페이지** (`app/(dashboard)/terms/page.tsx`)
  - CommitPush 서비스 정의, 이용계약, 요금 및 결제, 이용자 의무, 회사 의무, 개인정보 보호, 서비스 중단, 책임 제한, 분쟁 해결, 사업자 정보 섹션으로 구성.
  - 사업자 정보: `상호: 씨큐브드(C Cubed)`, `대표자명: 이세명`, `사업자등록번호: 781-47-00894`, `주소: 경기도 이천시 백사면 원적로617번길 150-18`, `이메일: 2tpaud@gmail.com`.
  - 개인정보 보호 조항에서 `/privacy` 페이지로 링크 연결.
- **개인정보 처리방침 페이지** (`app/(dashboard)/privacy/page.tsx`)
  - 수집 항목, 이용 목적, 보유·이용 기간, 제3자 제공, 처리 위탁, 이용자 권리, 쿠키 사용, 안전성 확보조치, 제3자 서비스, 개인정보 보호책임자 및 문의처 등 일반적인 SaaS 개인정보 처리방침 구조.
  - PushMind, Supabase, 나이스페이 등 외부 서비스 사용을 현재 아키텍처 수준에서 설명.
  - 문의처/책임자 정보에 씨큐브드(C Cubed) 상호, 이메일, 주소를 명시하고, 마지막에 시행일자 표기.

---

문서화:

- **ARCHITECTURE.md**
  - Authentication 섹션에서 **공개 라우트**를 `/`(랜딩), `/pricing`(이용요금)에 더해 `/terms`(서비스 이용약관), `/privacy`(개인정보 처리방침)까지 포함하도록 설명 업데이트.
  - 기타 결제·PushMind 아키텍처 설명은 이전 개발자 노트 기준(NicePay REST, PushMind RAG)과 동일하게 유지.
- **DESIGN.md**
  - "라우트 그룹 (dashboard) 및 인증" 섹션에서 비로그인 공개 경로 목록에 `/terms`, `/privacy`를 추가해, UI/UX 관점에서도 약관/정책 페이지 접근이 명확히 드러나도록 수정.
  - "랜딩 페이지 (비로그인 홈)" 섹션을 현재 구현 기준으로 상세화:
    - 헤더 구조(로고, `서비스`/`이용요금`, 로그인), 네비게이션 hover/커서 스타일, 로그인 버튼 hover 배경, `지금 시작하기` 하단 동의 문구, `/terms`·`/privacy` 링크, 푸터 사업자 정보 한 줄 레이아웃까지 기술.
  - "이용요금 페이지 (비로그인 공개)" 섹션을 현재 UI 기준으로 확장:
    - 랜딩과 동일한 헤더/스타일 사용, 월/연 구독 탭, Free/Pro/Team 카드 구조, 하단 CTA 버튼 동작(로그인/회원가입 진입)까지 반영.
- **기타 문서**
  - `DATABASE.md`, `PAYMENT-TEST-CHECKLIST.md`, `PLAN.md`, `PRODUCT.md`, `PUSHMIND-RAG.md`는 본 작업(랜딩/이용요금, 약관/개인정보, 헤더/푸터)과 직접적인 스키마·플로우 변경이 없어 내용 유지.

---

파일 구조:

- `src/components/LandingPage.tsx` — 비로그인 랜딩 페이지 UI, 헤더(서비스/이용요금/로그인), 모토·슬로건, `지금 시작하기` 버튼, 하단 동의 문구, 사업자 정보 푸터.
- `app/(dashboard)/pricing/page.tsx` — 비로그인 이용요금 페이지, 랜딩과 동일한 헤더, 월/연 구독 탭 + Free/Pro/Team 카드, 하단 `지금 시작하기` 버튼.
- `app/(dashboard)/layout.tsx` — 대시보드 공통 레이아웃 및 인증 라우팅, 비로그인 공개 경로(`/`, `/pricing`, `/terms`, `/privacy`) 처리.
- `app/(dashboard)/terms/page.tsx` — CommitPush 서비스 이용약관 페이지, 서비스 정의·이용계약·요금·책임·분쟁 해결·사업자 정보.
- `app/(dashboard)/privacy/page.tsx` — CommitPush 개인정보 처리방침 페이지, 수집 항목·이용 목적·보유 기간·제3자 제공·위탁·쿠키·보호조치·문의처.
- `docs/ARCHITECTURE.md` — Authentication 섹션 공개 라우트 목록에 `/terms`·`/privacy` 추가.
- `docs/DESIGN.md` — 라우트 그룹 공개 경로, 랜딩/이용요금 페이지 헤더/CTA/푸터·약관 동의 문구·링크 구조 최신화.

