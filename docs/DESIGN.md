# CommitPush 디자인 가이드

## 폰트

### 기본 폰트
- **Noto Sans** (Google Fonts)
- 가중치: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- 서브셋: latin, latin-ext
- 폴백: Arial, Helvetica, sans-serif

### 설정 위치
- `app/layout.tsx`: Next.js Google Fonts를 통한 폰트 로드
- `app/globals.css`: 전역 폰트 패밀리 설정

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

### 기본 원칙
- **블랙, 화이트, 그레이톤만 사용**
- 채도(saturation) 0%의 무채색만 사용
- 다크모드 자동 지원 (CSS 변수 기반)

### 색상 변수 (CSS Variables)

#### 라이트 모드
- `--background`: 0 0% 100% (흰색)
- `--foreground`: 0 0% 0% (검정색)
- `--card`: 0 0% 100% (흰색)
- `--card-foreground`: 0 0% 0% (검정색)
- `--primary`: 0 0% 0% (검정색)
- `--primary-foreground`: 0 0% 100% (흰색)
- `--secondary`: 0 0% 96% (밝은 회색)
- `--muted`: 0 0% 96% (밝은 회색)
- `--muted-foreground`: 0 0% 45% (중간 회색)
- `--border`: 0 0% 90% (밝은 회색)
- `--input`: 0 0% 90% (밝은 회색)

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

## UI 컴포넌트 라이브러리

### shadcn/ui
- **기본 UI 컴포넌트 라이브러리**
- Radix UI 기반
- TailwindCSS로 스타일링
- 컴포넌트 위치: `src/components/ui/`

### 주요 사용 컴포넌트
- Button
- Dialog
- Input
- Textarea
- Label
- Badge
- Checkbox
- Tabs
- Table

## 버튼 스타일

### 기본 버튼 (variant="default")
- 배경: 검정색 (`bg-black`)
- 텍스트: 흰색 (`text-white`)
- 호버: 검정색 90% 투명도 (`hover:bg-black/90`)
- 사용 예: 로그아웃, 새 노트 생성, 작업 로그, 개발자 노트, 홈으로

### 아웃라인 버튼 (variant="outline")
- 배경: 투명
- 테두리: `border-input`
- 호버: `bg-accent`

### 고스트 버튼 (variant="ghost")
- 배경: 없음
- 호버: `bg-accent`

## 다이얼로그 스타일

### 오버레이
- 배경: 검정색 80% 투명도 (`bg-black/80`)
- 전체 화면 덮음

### 다이얼로그 콘텐츠
- 배경: 흰색 (`bg-white`)
- 테두리: `border`
- 그림자: `shadow-lg`
- 둥근 모서리: `sm:rounded-lg`

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

## 탭(Tabs) 스타일

- 활성 탭: `bg-background`, `text-foreground`, `shadow`
- 비활성 탭: 기본 스타일
- 호버: `hover:bg-accent`

## 자동완성 드롭다운 스타일

### 드롭다운 컨테이너
- 배경: 흰색 (`bg-white`)
- 테두리: `border-border`
- 그림자: `shadow-lg`
- 위치: 입력 필드 하단에 절대 위치 (`absolute z-20`)

### 드롭다운 항목
- 기본 상태: 흰색 배경, 검정색 텍스트
- 호버 상태: 밝은 회색 배경 (`hover:bg-gray-100`)
- 선택된 항목: 검정색 배경, 흰색 텍스트 (`bg-black text-white`)
- 키보드 네비게이션 지원 (ArrowDown/Up, Enter, Escape)

## Data Table 스타일 (작업 로그, 연관 노트 검색, 개발자 노트)

### 사용 위치
- 작업 로그 페이지 (`app/activity/page.tsx`) — 노트 생성 내역
- 연관 노트 검색 다이얼로그 — 노트 선택 목록
- 개발자 노트 페이지 (`app/developer-notes/page.tsx`) — 노트 목록

### 테이블 스타일
- 컨테이너: `rounded-md border`
- 정렬: 컬럼 헤더 클릭 시 정렬 (작업 로그, 연관 노트 검색)
- 행 호버: `hover:bg-muted/50`
- 선택 행 강조: `data-state="selected"` 또는 `bg-muted` (연관 노트 검색)

### 작업 로그 / 연관 노트 검색 컬럼
- 카테고리, 제목, 태그, 생성일, 최종 수정일, 작업(버튼)
- 설명(description) 컬럼은 사용하지 않음

### 개발자 노트 컬럼
- 제목, 내용 미리보기, 생성일, 수정일, 작업(버튼)

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

## 디자인 원칙

1. **미니멀리즘**: 불필요한 장식 제거
2. **일관성**: 모든 컴포넌트에서 동일한 스타일 가이드 적용
3. **가독성**: 충분한 대비와 간격 유지
4. **접근성**: 키보드 네비게이션 및 포커스 상태 명확히 표시
5. **반응형**: 모바일부터 데스크톱까지 지원

## 향후 작업 시 참고사항

1. **새로운 색상 추가 금지**: 블랙, 화이트, 그레이톤만 사용
2. **폰트 변경 시**: `app/layout.tsx`와 `app/globals.css` 동시 수정
3. **새 컴포넌트 추가 시**: shadcn/ui 컴포넌트 우선 사용
4. **커스텀 스타일 필요 시**: TailwindCSS 유틸리티 클래스 사용
5. **다크모드 지원**: CSS 변수 사용으로 자동 지원되도록 유지
6. **자동완성 하이라이트**: 검정색 배경(`bg-black`)과 흰색 텍스트(`text-white`) 사용
7. **태그 표시**: 항상 Badge variant="outline" 사용, `#{tag}` 형식 유지
8. **Data Table**: 작업 로그, 연관 노트 검색, 개발자 노트는 shadcn Table + @tanstack/react-table 사용
9. **카드뷰 레이아웃**: 카드 형태 UI가 필요할 때 위 카드뷰 스타일 참고
