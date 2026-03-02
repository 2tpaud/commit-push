# 개발자 노트 — 노트 상세 인라인 편집·마크다운 렌더링·UI 정리

---

주요 기능 추가:

- **노트 상세 페이지 속성 인라인 편집**
  - **생성일, tags, 참고URL, 상태**: 마우스 호버 시 옅은 회색 배경(`hover:bg-gray-100`), 클릭 시 수정 모드. 편집 중에는 호버 효과 없음.
  - **생성일**: `datetime-local` 입력, Enter/blur 시 저장.
  - **tags**: 콤마(,)로 여러 태그 입력, Enter 저장, 바깥 클릭 시 취소. 저장/취소 버튼 없음. 입력창 `min-w-[400px]`.
  - **참고URL**: URL 입력 후 Enter 저장, 바깥 클릭 시 취소. 저장/취소 버튼 없음. 입력창 `min-w-[400px]`.
  - **상태**: DropdownMenu로 선택(활성화/보관/완료). 선택 항목은 호버 시 옅은 회색만 적용(시그니처 컬러 하이라이트 없음).
  - **속성 간격**: `mb-4` → `mb-2`로 축소.
- **설명 영역 인라인 편집**
  - 클릭 시 RichTextEditor + `resize-y` 드래그로 높이 조절(`min-h-[120px]`, `max-h-[400px]`). 저장/취소 버튼으로 완료.
  - 마크다운 렌더링: ReactMarkdown + remark-gfm, remark-highlight-mark, rehype-raw. 형광펜(`==text==`)이 `<mark>`로 표시. prose 스타일(제목·목록·인용·구분선·정렬) 적용.
- **연관 노트**
  - **+ 버튼**: 마지막 연관 노트 밑(또는 "연관 노트가 없습니다" 밑)에 위치, 호버 시 표시. 클릭 시 `RelatedNoteSearchDialog` 열림(다중 선택).
- **커밋 내역 Sheet 유지**
  - 사이드바·최근 항목(`data-keep-sheet-open`) 클릭 시 `onInteractOutside`에서 `preventDefault`로 시트 유지. 다른 노트로 이동해도 시트는 열린 채 유지.
- **새 노트 다이얼로그 카테고리 자동완성**
  - 대·중·소분류 드롭다운 선택 항목 하이라이트를 시그니처 컬러(`bg-[#1F2A44] text-white`)에서 옅은 회색(`bg-gray-100`)으로 변경.
- **노트 선택·연관 노트 검색 다이얼로그**
  - `NoteSelectDialog`(커밋푸시용): RelatedNoteSearchDialog와 동일한 UI — "총 N개 노트" 표시, `min-h-[320px]` 테이블 영역.
  - `RelatedNoteSearchDialog`: 다중 선택, 동일 스타일 적용.

---

UI·API:

- **노트 상세 페이지** (`app/(dashboard)/notes/[id]/page.tsx`) — 속성 인라인 편집(생성일·tags·참고URL·상태), 설명 RichTextEditor·resize-y, 연관 노트 + 버튼·RelatedNoteSearchDialog, 커밋 Sheet `onInteractOutside` 처리.
- **NewNoteDialog** — 카테고리(대·중·소분류) 자동완성 드롭다운 선택 항목 `bg-gray-100`.
- **NoteSelectDialog** — 커밋푸시용 단일 노트 선택. RelatedNoteSearchDialog와 동일한 테이블·"총 N개 노트" UI.
- **RelatedNoteSearchDialog** — 연관 노트 다중 선택. `min-h-[320px]`, "총 N개 노트" 표시.
- **RichTextEditor** — `fixMarkdownInsideMarkTags`로 `<mark>` 내부 마크다운(**, *** 등) HTML 변환. 저장 시 `<mark>**text**</mark>` 형태 로드 시 정상 표시.

---

문서화:

- **DESIGN.md** — 노트 상세 속성 인라인 편집·설명·연관 노트 + 버튼, 자동완성 드롭다운 스타일(카테고리 옅은 회색/기타 시그니처 컬러), NewNoteDialog 카테고리 하이라이트, 향후 작업 참고사항 §6 반영.

---

파일 구조:

- `app/(dashboard)/notes/[id]/page.tsx` — 속성 인라인 편집, 설명 RichTextEditor·resize-y, ReactMarkdown·remark-gfm·remark-highlight-mark·rehype-raw, 연관 노트 + 버튼·RelatedNoteSearchDialog, Sheet onInteractOutside.
- `src/components/NewNoteDialog.tsx` — 대·중·소분류 드롭다운 선택 항목 `bg-gray-100`.
- `src/components/NoteSelectDialog.tsx` — "총 N개 노트", `min-h-[320px]` 테이블.
- `src/components/RelatedNoteSearchDialog.tsx` — 다중 선택, 동일 UI.
- `src/components/CommitPushDialog.tsx` — NoteSelectDialog 사용.
- `src/components/RichTextEditor.tsx` — `fixMarkdownInsideMarkTags` 적용.
- `src/lib/markdownInMark.ts` — `<mark>` 태그 안 마크다운(**, *** 등) HTML 변환.
- `src/lib/markdownProse.ts` — prose 스타일(blockquote·hr·정렬·제목·목록), remark-highlight-mark의 highlight → `<mark>` 핸들러.
- `src/lib/markdownRender.ts` — remark-rehype highlight → mark 변환 옵션(remarkProse와 중복 가능, 노트 상세는 markdownProse 사용).
- `src/extensions/HighlightWithColor.ts` — TipTap 형광펜 색상 마크다운 저장(`<mark data-color="..." style="...">`).
- `src/components/AppSidebar.tsx` — `data-keep-sheet-open` 속성.
- **package.json** — react-markdown, rehype-raw, remark-gfm, remark-highlight-mark 추가.
- `docs/DESIGN.md` — 노트 상세·자동완성·NewNoteDialog 스타일 최신화.
