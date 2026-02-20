# CommitPush 디자인 가이드

## 레이아웃 및 네비게이션

### 라우트 그룹 (dashboard) 및 인증
- **위치**: `app/(dashboard)/layout.tsx`
- **역할**: 인증 구간을 한 번만 감싸고, 로그인 후 모든 대시보드 페이지에서 **동일한 레이아웃이 한 번만 마운트**되도록 함. 페이지 이동 시 레이아웃이 다시 로딩되지 않아 **깜빡임 없음**.
- **동작**:
  - 세션 확인 후, 비로그인이고 path가 `/`이면 `LoginForm`만 렌더
  - 비로그인이고 path가 `/`가 아니면 `/`로 리다이렉트
  - 로그인 시: `AuthUserProvider` → `CommitSheetProvider` → `SharedAppLayout` 순으로 `children` 감쌈
- **프로바이더**: 각 페이지는 `useAuthUser()`, `useCommitSheet()` 훅으로 접근.
- **대시보드 라우트** (URL에 `(dashboard)`는 포함되지 않음):
  - `/` → `app/(dashboard)/page.tsx` (홈)
  - `/activity` → `app/(dashboard)/activity/page.tsx` (작업 로그)
  - `/developer-notes` → `app/(dashboard)/developer-notes/page.tsx` (개발자 노트)
  - `/plan` → `app/(dashboard)/plan/page.tsx` (요금제)
  - `/notes/[id]` → `app/(dashboard)/notes/[id]/page.tsx` (노트 상세)
  - `/notes/new` → `app/(dashboard)/notes/new/page.tsx` (새 노트)

### 로그인 화면
- **위치**: `src/components/LoginForm.tsx`
- 비로그인 사용자가 path `/`일 때만 `(dashboard)/layout.tsx`에서 `LoginForm`을 렌더. 그 외 비로그인 경로는 `/`로 리다이렉트.

### 공통 레이아웃 (SharedAppLayout)
- **위치**: `src/components/SharedAppLayout.tsx`
- **역할**: 로그인 후 (dashboard) 레이아웃 내 모든 페이지에서 동일한 사이드바 + 헤더 유지 (한 번만 마운트됨)
- **구성**:
  - **헤더** (`h-14`, `border-b border-border bg-card`): SidebarTrigger, CommitPush 로고(클릭 시 홈 `/` 이동), 이메일, 로그아웃 버튼
  - **메인**: `children`으로 페이지별 콘텐츠
- **사용 페이지**: 홈(`/`), 작업 로그(`/activity`), 개발자 노트(`/developer-notes`), 요금제(`/plan`), 노트 상세(`/notes/[id]`), 새 노트(`/notes/new`) — 모두 `(dashboard)` 하위에서 layout이 한 번만 SharedAppLayout을 렌더

### 사이드바 (AppSidebar)
- **위치**: `src/components/AppSidebar.tsx`
- **UI 컴포넌트**: `src/components/ui/sidebar.tsx` (Sidebar, SidebarContent, SidebarTrigger), `src/components/ui/collapsible.tsx`
- **상단 아이콘 행** (헤더 CommitPush와 동일 선상 `h-14`, `border-b`):
  - **FileText**: 노트 분류 트리 뷰
  - **Search**: 제목·태그 검색 뷰
  - **LayoutDashboard**: 대시보드 메뉴(준비 중)
  - **ScrollText**: 작업 로그 (`/activity`) 링크, `prefetch` 적용
  - **BookOpen**: 개발자 노트 (`/developer-notes`) 링크, `prefetch` 적용
  - (요금제 `/plan` 등 추가 링크는 헤더/사이드바에서 필요 시 동일 방식으로 추가)
- **메인 영역** (비율 4/5):
  - **파일 뷰**: 고정 라벨 "워크 스페이스" + 대분류 > 중분류 > 소분류 트리 (Collapsible, 노트 개수 표시)
  - **검색 뷰**: 제목/태그 탭, 검색 입력, 자동완성 노트 제목 목록
  - **대시보드 뷰**: 플레이스홀더 문구
- **하단 영역** (기본 비율 1/5, 조절 가능):
  - 리사이즈 핸들: 메인 영역과 하단 영역 사이 경계선에 마우스 호버 시 `row-resize` 커서 표시, 드래그로 크기 조절 (최소 20% = 1/5, 최대 50%)
  - 토글 버튼: "최근 항목" 라벨 우측에 위치
    - 작을 때(≤20%): 위쪽 화살표(`ChevronUp`) → 클릭 시 최대 범위(50%)로 확대
    - 클 때(>20%): 아래쪽 화살표(`ChevronDown`) → 클릭 시 기본값(20%)으로 축소
  - 상태 유지: localStorage에 저장되어 페이지 이동 후에도 크기 유지
  - 구분선(`border-t`) + 고정 라벨 "최근 항목" + 최근 수정일 순 노트 제목 목록 (스크롤)
- **정렬**: SidebarContent에 `p-0` 적용해 아이콘 행이 헤더와 높이·라인 정렬

### 홈 화면 (로그인 후)
- **위치**: `app/(dashboard)/page.tsx`
- SharedAppLayout 내부: 노트 제목, **커밋푸시**·**새 노트 생성** 버튼, 환영 문구, NewNoteDialog, CommitPushDialog. 개발자 노트·작업 로그·요금제는 사이드바/헤더로 이동.

### 노트 상세 페이지 (`/notes/[id]`)
- **위치**: `app/(dashboard)/notes/[id]/page.tsx`
- **레이아웃**: 
  - 동적 가운데 정렬: 사이드바와 커밋 내역 Sheet 상태에 따라 컨테이너가 사용 가능한 공간에서 가운데 정렬
  - 최대 폭: `max-w-4xl` (896px)
- **머리글 영역**:
  - 카테고리: 좌측 정렬, `category_large > category_medium > category_small` 형식
  - 최종 수정일: 우측 정렬
  - 뒤로 가기 버튼: 연관 노트에서 이동한 경우에만 표시 (`?from=노트ID` 파라미터 기반)
- **타이틀 영역**:
  - 제목: 좌측 정렬, `text-3xl font-bold`
  - 커밋 내역 아이콘: 우측 정렬, `MessageCircleMore` 아이콘, 커밋 개수 표시
- **속성 섹션** (아이콘 + 속성명 + 값 형식):
  - 생성일: `Calendar` 아이콘, `formatDateTime()` 형식
  - tags: `Tag` 아이콘, Badge variant="outline"로 표시 (`#{tag}` 형식)
  - 참고URL: `LinkIcon` 아이콘, 링크 형태로 표시
  - 상태: 상태에 따라 아이콘 변경 (`active`: `CircleCheck`, `archived`: `Archive`, `completed`: `CheckCircle2`), 한글 표시 (활성화/보관/완료)
  - 공유여부: `Globe`(공개) 또는 `Lock`(비공개) 아이콘, Switch 컴포넌트로 토글. **Pro/Team 플랜에서만 공유 ON 가능**하며, Free 플랜에서 ON 시도 시 AlertDialog로 업그레이드 유도(확인, 요금제 보기).
  - 공유URL: `is_public`이 `true`이고 `share_token`이 있을 때만 표시, 복사 버튼 포함
- **커밋 내역 Sheet**:
  - 위치: 우측 슬라이드 패널 (`Sheet` 컴포넌트)
  - 트리거: 타이틀 우측의 커밋 내역 아이콘 클릭
  - 상태 관리: `CommitSheetProvider`로 전역 상태 관리 (페이지 이동 시에도 열림 상태 유지)
  - 기능:
    - 정렬: `ArrowUp`/`ArrowDown` 아이콘으로 `created_at` 기준 오름/내림차순 정렬
    - 커밋 카드: 날짜(좌측 상단, 볼드), 제목, 시간(우측 상단), 메시지
    - 닫기: 커스텀 닫기 버튼 (외부 클릭/ESC로 닫히지 않음)
- **설명**: `whitespace-pre-wrap`로 줄바꿈 유지
- **연관 노트**:
  - 제목: `GitBranch` 아이콘 + "연관 노트"
  - 목록: 각 항목 앞에 `FileText` 아이콘, 링크 형태
  - 이동 시: `?from=현재노트ID` 파라미터 추가하여 뒤로 가기 버튼 활성화

---

## 폰트

### 기본 폰트
- **Noto Sans** (Google Fonts)
- 가중치: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- 서브셋: latin, latin-ext
- 폴백: Arial, Helvetica, sans-serif

### 설정 위치
- `app/layout.tsx`: Next.js Google Fonts를 통한 폰트 로드 (`Noto_Sans`, variable `--font-noto-sans`)
- `app/globals.css`: 전역 폰트 패밀리 및 배경/전경색 적용 (`body { font-family: var(--font-noto-sans), ... }`)

```typescript
// app/layout.tsx
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
```

```css
/* app/globals.css */
body {
  font-family: var(--font-noto-sans), Arial, Helvetica, sans-serif;
}
```

## 색상 시스템

### 시그니처 컬러
- **CommitPush 브랜드 컬러**: `#1F2A44`
  - HEX: `#1F2A44`
  - RGB: `31, 42, 68`
  - CMYK: `54, 38, 0, 73`
  - HSL: `222, 37%, 19%` (대략)
  - 사용 위치: CommitPush 로고, 텍스트, 주요 버튼 배경, 자동완성 하이라이트 등

### 기본 원칙
- **시그니처 컬러(`#1F2A44`), 화이트, 그레이톤 사용**
- 기존 블랙(`#000000`) 대신 시그니처 컬러(`#1F2A44`)를 주요 액센트 컬러로 사용
- 다크모드 자동 지원 (CSS 변수 기반)

### 색상 변수 (CSS Variables)

#### 라이트 모드
- `--background`: 0 0% 100% (흰색)
- `--foreground`: 222 37% 19% (시그니처 컬러 `#1F2A44`)
- `--card`: 0 0% 100% (흰색)
- `--card-foreground`: 222 37% 19% (시그니처 컬러 `#1F2A44`)
- `--primary`: 222 37% 19% (시그니처 컬러 `#1F2A44`)
- `--primary-foreground`: 0 0% 100% (흰색)
- `--secondary`: 0 0% 96% (밝은 회색)
- `--secondary-foreground`: 222 37% 19% (시그니처 컬러 `#1F2A44`)
- `--muted`: 0 0% 96% (밝은 회색)
- `--muted-foreground`: 0 0% 45% (중간 회색)
- `--accent`: 0 0% 96% (밝은 회색)
- `--accent-foreground`: 222 37% 19% (시그니처 컬러 `#1F2A44`)
- `--border`: 0 0% 90% (밝은 회색)
- `--input`: 0 0% 90% (밝은 회색)
- `--ring`: 222 37% 19% (시그니처 컬러 `#1F2A44`)

#### 다크 모드
- `--background`: 0 0% 0% (검정색)
- `--foreground`: 0 0% 100% (흰색)
- `--card`: 0 0% 0% (검정색)
- `--card-foreground`: 0 0% 100% (흰색)
- `--primary`: 0 0% 100% (흰색)
- `--primary-foreground`: 0 0% 0% (검정색)
- `--secondary`: 0 0% 10% (어두운 회색)
- `--muted`: 0 0% 10% (어두운 회색)
- `--muted-foreground`: 0 0% 65% (밝은 회색)
- `--border`: 0 0% 20% (어두운 회색)
- `--input`: 0 0% 20% (어두운 회색)

#### 사이드바 전용 (globals.css)
- `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` 등
- 라이트: 밝은 배경·어두운 텍스트, 다크: 어두운 배경·밝은 텍스트

기타 컴포넌트에서 사용하는 변수(`--popover`, `--accent`, `--accent-foreground`, `--ring`, `--radius`, `--destructive` 등)는 `app/globals.css` 참고. Tailwind는 `@import "tailwindcss"`로 로드.

## UI 컴포넌트 라이브러리

### shadcn/ui
- **기본 UI 컴포넌트 라이브러리**
- Radix UI 기반
- TailwindCSS로 스타일링
- 컴포넌트 위치: `src/components/ui/`

### 주요 사용 컴포넌트
- **Button**
- **Dialog**
- **Input**, **Textarea**, **Label**
- **Badge**, **Checkbox**
- **Switch** — 공유여부 토글 등
- **Sheet** — 커밋 내역 슬라이드 패널
- **Tabs**, **Table**
- **Skeleton** (로딩 플레이스홀더: `PageLoadingSkeleton`, `TablePageLoadingSkeleton`, `DialogTableSkeleton`, `DialogFormSkeleton` 활용)
- **Sidebar** (SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger) — 레이아웃·사이드바 트리
- **Collapsible** (CollapsibleTrigger, CollapsibleContent) — 사이드바 대·중·소분류 펼침/접힘
- **AlertDialog** — 삭제 확인, Pro 플랜 업그레이드 유도(노트 공유) 등

## 버튼 스타일

### 기본 버튼 (variant="default")
- 배경: 시그니처 컬러 (`bg-[#1F2A44]` 또는 커스텀 클래스)
- 텍스트: 흰색 (`text-white`)
- 호버: 시그니처 컬러 90% 투명도 (`hover:bg-[#1F2A44]/90`)
- 사용 예: 로그아웃, 새 노트 추가, 커밋푸시, 홈의 커밋푸시·새 노트 생성, 작업 로그/개발자 노트 페이지 내 액션 등

### 아웃라인 버튼 (variant="outline")
- 배경: 투명
- 테두리: `border-input`
- 호버: `bg-accent`

### 고스트 버튼 (variant="ghost")
- 배경: 없음
- 호버: `bg-accent`
- 사용 예: SidebarTrigger(사이드바 열기/닫기)

### 버튼 크기 (size)
- `default`: h-9 px-4 py-2
- `sm`, `lg`: 작은/큰 버튼
- `icon`: h-9 w-9 (아이콘 전용, 예: 작업 로그의 새 노트·커밋푸시 추가 버튼)

## 다이얼로그 스타일

### 오버레이
- 배경: 검정색 80% 투명도 (`bg-black/80`) - 다이얼로그 오버레이는 어두운 배경 유지
- 전체 화면 덮음

### 다이얼로그 콘텐츠
- 배경: 흰색 (`bg-white`), 테두리: `border`, 그림자: `shadow-lg`, 둥근 모서리: `sm:rounded-lg`
- 구현: `src/components/ui/dialog.tsx` (DialogOverlay `bg-black/80`, DialogContent `border bg-white p-6 shadow-lg sm:rounded-lg`)

## 입력 필드 스타일

### 기본 Input
- 테두리: `border-input`
- 배경: 투명 (`bg-transparent`)
- 포커스: `focus-visible:ring-1 focus-visible:ring-ring`

### Textarea
- Input과 동일한 스타일
- 다중 줄 입력 지원

## 배지(Badge) 스타일

### 기본 배지 (variant="default")
- 배경: `bg-primary`
- 텍스트: `text-primary-foreground`

### 보조 배지 (variant="secondary")
- 배경: `bg-secondary`
- 텍스트: `text-secondary-foreground`
- 사용 예: 카테고리 표시

### 아웃라인 배지 (variant="outline")
- 테두리만 표시
- 배경 없음
- 사용 예: 태그 표시 (`#{tag}` 형식)

## Switch 스타일

### 기본 Switch
- 높이: `h-5`
- 너비: `w-10`
- checked 상태: 시그니처 컬러 배경 (`bg-[#1F2A44]`)
- unchecked 상태: 회색 배경 (`bg-gray-300` 다크모드: `bg-gray-600`)
- thumb: 흰색 원형 (`bg-white`, `h-4 w-4`)
- 사용 예: 노트 상세 페이지의 공유여부 토글

## Sheet 스타일 (슬라이드 패널)

### 커밋 내역 Sheet
- 위치: 우측 슬라이드 (`side="right"`)
- 너비: 데스크톱 `384px`, 모바일 `75vw`
- 배경: `bg-white` (다크모드: `bg-black`)
- 오버레이: 기본 Radix UI 오버레이 사용
- 닫기 동작: 외부 클릭/ESC로 닫히지 않음 (`onInteractOutside`, `onEscapeKeyDown` preventDefault)
- 헤더: 제목 + 정렬 버튼 + 닫기 버튼
- 내용: 커밋 카드 목록 (스크롤 가능)

## 탭(Tabs) 스타일

- 활성 탭: 흰색 배경(`bg-background`), 시그니처 컬러 텍스트(`text-[#1F2A44]`), 그림자(`shadow`) (globals.css `.tabs-trigger[data-state="active"]`)
- 비활성 탭: 시그니처 컬러 텍스트(`text-[#1F2A44]`)
- 호버: `hover:bg-accent`
- 사용 위치: 작업 로그 페이지 탭, 연관 노트 검색 다이얼로그 탭, 노트 선택 다이얼로그 탭

## 자동완성 드롭다운 스타일

### 드롭다운 컨테이너
- 배경: 흰색 (`bg-white`)
- 테두리: `border-border`
- 그림자: `shadow-lg`
- 위치: 입력 필드 하단에 절대 위치 (`absolute z-20`)

### 드롭다운 항목
- 기본 상태: 흰색 배경, 검정색 텍스트
- 호버 상태: 밝은 회색 배경 (`hover:bg-gray-100`)
- 선택된 항목: 시그니처 컬러 배경, 흰색 텍스트 (`bg-[#1F2A44] text-white`)
- 키보드 네비게이션 지원 (ArrowDown/Up, Enter, Escape)

## Data Table 스타일 (작업 로그, 연관 노트 검색, 노트 선택, 개발자 노트)

### 사용 위치
- 작업 로그 페이지 (`app/(dashboard)/activity/page.tsx`) — 노트 생성 내역 탭, 커밋푸시 내역 탭
- 연관 노트 검색 다이얼로그 (`RelatedNoteSearchDialog`) — 다중/단일 노트 선택 목록
- 노트 선택 다이얼로그 (`NoteSelectDialog`) — 커밋푸시용 단일 노트 선택
- 개발자 노트 페이지 (`app/(dashboard)/developer-notes/page.tsx`) — 노트 목록

### 테이블 스타일
- 컨테이너: `rounded-md border`
- 정렬: 컬럼 헤더 클릭 시 정렬 (작업 로그 노트/커밋 탭, 연관 노트 검색, 노트 선택)
- 행 호버: `hover:bg-muted/50`
- 선택 행 강조: `data-state="selected"` 또는 `bg-muted` (연관 노트 검색, 노트 선택)
- 라이브러리: shadcn Table + `@tanstack/react-table`

### 작업 로그 컬럼
- **노트 생성 내역**: 카테고리, 제목, 태그, 생성일, 최종 수정일, 작업(버튼). 설명(description) 컬럼은 사용하지 않음.
- **커밋푸시 내역**: 노트(제목), 제목, 메모, 생성일, 최종 수정일, 작업(편집/삭제 버튼)

### 연관 노트 검색 / 노트 선택 테이블 컬럼
- 선택(체크박스), 카테고리, 제목, 태그, 생성일, 최종 수정일, 정렬 버튼

### 개발자 노트 컬럼
- 제목, 내용 미리보기, 생성일, 수정일, 작업(버튼). 제목·생성일·수정일 컬럼 헤더 클릭 시 정렬 가능.

## 카드뷰 스타일 (참고용)

다른 화면에서 카드 형태 레이아웃이 필요할 때 참고.

### 카드 컨테이너
- 배경: `bg-card`
- 테두리: `border-border`
- 패딩: `p-6`
- 그림자: `shadow-sm`
- 호버: `hover:shadow-md`
- 위치: `relative` (카테고리 Badge 절대 위치용)

### 카드 내부 레이아웃
- **카테고리**: 좌측 상단에 절대 위치 (`absolute left-4 top-4`)
  - Badge variant="secondary"
  - 형식: "대분류 > 중분류 > 소분류"
- **제목**: 카테고리 아래 (`pt-6`), `text-lg font-semibold`
- **설명**: 제목 아래, `text-sm text-muted-foreground` (필요 시)
- **태그 및 날짜**: 같은 줄에 좌우 정렬
  - 태그: 좌측 정렬, Badge variant="outline", `#{tag}` 형식
  - 날짜: 우측 정렬, `text-xs text-muted-foreground`

## 공유 기능

### 공유 링크 생성
- **조건**: `is_public`이 `true`로 설정될 때 자동 생성
- **share_token**: 32자리 랜덤 문자열 (영문 대소문자 + 숫자)
- **공유 URL 형식**: `${NEXT_PUBLIC_SHARE_DOMAIN}/notes/shared/${share_token}`
- **환경 변수**: `.env.local`에 `NEXT_PUBLIC_SHARE_DOMAIN` 설정 (예: `http://commitpush.cloud`)
- **표시 위치**: 노트 상세 페이지의 공유여부 속성 아래
- **복사 기능**: 복사 버튼 클릭 시 클립보드에 복사, 성공 시 체크 아이콘 표시

## 디자인 원칙

1. **미니멀리즘**: 불필요한 장식 제거
2. **일관성**: 모든 컴포넌트에서 동일한 스타일 가이드 적용
3. **가독성**: 충분한 대비와 간격 유지
4. **접근성**: 키보드 네비게이션 및 포커스 상태 명확히 표시
5. **반응형**: 모바일부터 데스크톱까지 지원
6. **동적 레이아웃**: 사이드바와 Sheet 상태에 따라 컨테이너가 자동으로 가운데 정렬

## 향후 작업 시 참고사항

1. **시그니처 컬러 사용**: 주요 액센트 컬러는 시그니처 컬러(`#1F2A44`) 사용. 블랙 대신 시그니처 컬러 적용
2. **폰트 변경 시**: `app/layout.tsx`와 `app/globals.css` 동시 수정
3. **새 컴포넌트 추가 시**: shadcn/ui 컴포넌트 우선 사용
4. **커스텀 스타일 필요 시**: TailwindCSS 유틸리티 클래스 사용
5. **다크모드 지원**: CSS 변수 사용으로 자동 지원되도록 유지
6. **자동완성 하이라이트**: 시그니처 컬러 배경(`bg-[#1F2A44]`)과 흰색 텍스트(`text-white`) 사용
7. **태그 표시**: 항상 Badge variant="outline" 사용, `#{tag}` 형식 유지
8. **Data Table**: 작업 로그(노트/커밋푸시 탭), 연관 노트 검색, 노트 선택 다이얼로그, 개발자 노트는 shadcn Table + @tanstack/react-table 사용
9. **카드뷰 레이아웃**: 카드 형태 UI가 필요할 때 위 카드뷰 스타일 참고
10. **공통 레이아웃**: 모든 인증 페이지는 `app/(dashboard)/layout.tsx`에서 한 번만 `AuthUserProvider` → `CommitSheetProvider` → `SharedAppLayout`으로 감싸며, 페이지 이동 시 레이아웃이 다시 마운트되지 않아 깜빡임이 없음. CommitPush 로고는 홈(`/`) 링크.
11. **사이드바**: 상단 아이콘 행은 헤더와 `h-14`·`border-b` 정렬; 하단 "최근 항목" 영역은 기본 1/5 비율이며 드래그로 조절 가능(최소 20%, 최대 50%), localStorage로 상태 유지.
12. **탭 컬러**: 활성/비활성 탭 모두 시그니처 컬러(`#1F2A44`) 텍스트 사용.
13. **노트 상세 페이지**: 속성 섹션은 아이콘 + 속성명 + 콜론 + 값 형식으로 일관되게 표시. 속성명은 고정 폭(`w-24`)으로 값이 같은 위치에 정렬.
14. **커밋 내역 Sheet**: `CommitSheetProvider`로 전역 상태 관리하여 페이지 이동 시에도 열림 상태 유지. 외부 클릭/ESC로 닫히지 않도록 설정.
15. **동적 가운데 정렬**: 사이드바와 커밋 내역 Sheet 상태에 따라 노트 컨테이너가 사용 가능한 공간에서 자동으로 가운데 정렬 (`useMemo`로 계산).
16. **공유 기능**: 노트 외부 공유는 Pro/Team 플랜에서만 ON 가능. Free 시 AlertDialog로 업그레이드 유도. `is_public`이 `true`일 때 `share_token` 자동 생성, 공유 URL은 `NEXT_PUBLIC_SHARE_DOMAIN` 사용.
17. **아이콘 사용**: 속성별로 적절한 아이콘 사용 (Calendar, Tag, LinkIcon, CircleCheck/Archive/CheckCircle2, Globe/Lock, GitBranch, FileText 등).
