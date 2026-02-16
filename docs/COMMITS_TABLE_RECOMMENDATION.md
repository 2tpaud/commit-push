# commits 테이블 설계 권장안

## 1. 요구사항 정리

| 항목 | 내용 |
|------|------|
| 커밋 작성 버튼 | UI에 "커밋 작성" 또는 "커밋푸시" 버튼 추가 |
| 커밋 다이얼로그 | 노트 선택 → 첨부파일/참고URL 입력 → 푸시 |
| 노트 선택 | 어느 노트에 커밋을 붙일지 선택 (필수) |
| 생성일 | 커밋푸시 버튼 클릭 시점에 자동 저장 |
| 첨부파일 | 파일 첨부 가능, 최초 시 Google Drive 연결 → 지정 폴더에 저장, 경로/파일명 저장으로 커밋보드에서 클릭 시 열기 |
| 참고URL | 다중 입력 가능 |

---

## 2. 필수 컬럼 (요구사항 기준)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | 작성자 (RLS용) |
| note_id | uuid | FK → notes.id, 이 커밋이 속한 노트 |
| created_at | timestamptz | **커밋푸시 버튼 클릭 시점** (자동) |
| attachments | jsonb 또는 text[] | 첨부파일 경로/파일명 (아래 4. 참고) |
| reference_urls | text[] | 참고 URL 다중 입력 |

---

## 3. 확장용 추천 컬럼

커밋이 “노트의 시간축 기록”이자 프로그램 핵심이므로, 아래 컬럼을 미리 두면 이후 기능 확장이 수월합니다.

### 3.1 강하게 추천 (우선 적용 권장)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| **title** | text | 커밋 제목 (예: "API 수정", "버그 픽스"). 커밋보드/타임라인에서 한 줄로 보여주기 좋음. |
| **message** | text | 커밋 본문 (선택). 짧은 메모나 상세 설명. |
| **updated_at** | timestamptz | 수정 시각. 첨부/URL만 나중에 수정할 경우 대비. |
| **sequence** | integer | 같은 노트 내 커밋 순서(1, 2, 3…). 노트별 타임라인 정렬·표시용. |

### 3.2 선택 추천 (필요 시 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| status | text | 'pushed' \| 'draft' \| 'archived'. 초안 저장 후 나중에 푸시하는 플로우 대비. |
| category_large / category_medium / category_small | text | 노트와 별도로 커밋 단위 분류가 필요할 때. 기본은 노트 카테고리 상속으로 구현 가능. |
| tags | text[] | 커밋 단위 태그. 노트 태그와 별도 필터링용. |
| scheduled_at | timestamptz | “예약 푸시” 시 예정 시각. |
| external_id | text | 추후 Git 등 외부 시스템 연동 시 해당 커밋 ID/hash 저장. |

### 3.3 notes 테이블과의 연동

- notes.commit_count: 커밋 추가/삭제 시 트리거로 갱신.
- notes.last_commit_at: 해당 노트의 가장 최근 커밋 created_at으로 갱신.

---

## 4. 첨부파일(attachments) 구조 권장

Google Drive 연동 + “경로/파일명으로 클릭 시 열기”를 고려하면, **파일마다 식별자와 링크를 함께 저장**하는 편이 안전합니다.

### 옵션 A: jsonb (권장)

```json
[
  {
    "file_id": "Google Drive file ID",
    "name": "파일명.pdf",
    "web_view_link": "https://drive.google.com/...",
    "mime_type": "application/pdf"
  }
]
```

- **file_id**: Drive API로 업로드 시 반환되는 ID. 나중에 권한/다운로드 처리 시 사용.
- **name**: 표시용 파일명.
- **web_view_link**: 커밋보드에서 “클릭 시 열기”용. 브라우저에서 바로 열 수 있음.
- **mime_type**: 선택. 미리보기/아이콘 구분용.

컬럼 타입: `attachments jsonb default '[]'`.

### 옵션 B: text[] (단순화)

- `['https://drive.google.com/file/d/XXX/view', '파일명.pdf']` 처럼 URL+이름만 저장.
- 구현은 단순하지만, 파일별 메타데이터 확장에는 한계가 있음.

**정리**: 확장성과 “클릭 시 열기”를 고려하면 **옵션 A(jsonb)** 를 추천합니다.

---

## 5. 참고URL(reference_urls)

- 타입: `text[]` (기존 notes.reference_urls와 동일).
- UI: 한 줄에 하나씩 또는 태그 형태로 다중 입력.

---

## 6. Google Drive 연동 요약

1. **최초 첨부 시**: Google Drive OAuth 연결 후, 앱에서 사용할 **기본 폴더(예: CommitPush/첨부)** 생성 또는 선택.
2. **폴더 ID 저장**: user 설정 또는 별도 테이블에 `user_id`, `drive_folder_id` 저장.
3. **업로드**: 선택한 파일을 해당 폴더에 업로드 → 반환된 file_id, web_view_link, name 등을 `attachments` jsonb에 append.
4. **커밋보드**: 목록/타임라인에서 `attachments[].web_view_link` 또는 `file_id`로 “클릭 시 새 탭에서 열기” 제공.

---

## 7. 권장 최소 스키마 요약

첫 버전에서 넣기 좋은 **최소 권장 컬럼**만 정리하면 다음과 같습니다.

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK auth.users, RLS |
| note_id | uuid | FK notes.id, NOT NULL |
| title | text | 커밋 제목, NOT NULL 권장 |
| message | text | 본문, 선택 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now(), 트리거 갱신 |
| attachments | jsonb | default '[]', 4장 구조 |
| reference_urls | text[] | default '{}' |
| sequence | integer | 노트 내 순서 (선택) |

이렇게 하면 “노트 선택 → 제목/메시지 → 첨부/참고URL → 생성일 자동” 요구사항을 만족하면서, 나중에 상태/카테고리/태그/예약/외부 연동까지 확장하기 좋습니다.  
이 구성을 기준으로 `docs/DATABASE.md`에 commits DDL을 추가하고, 커밋 작성 버튼·다이얼로그(노트 선택, 첨부, 참고URL)를 구현하면 됩니다.
