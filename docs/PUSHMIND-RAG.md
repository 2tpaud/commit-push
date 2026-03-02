# PushMind — RAG 기반 지식 챗봇 설계서

CommitPush 서비스 내 노트·커밋 내용을 질의할 수 있는 RAG(Retrieval-Augmented Generation) 기반 지식 챗봇의 설계 문서입니다. LLM은 **OpenAI GPT** 모델을 사용하며, [OpenAI API 문서](https://developers.openai.com/api/docs)를 참조하여 구축합니다.

---

## 1. 브랜딩 및 개념

### 챗봇명

**PushMind**

### 관점 정의

- **Commit** = 생각을 기록하는 행위  
- **Push** = 기록을 구조 속으로 보내는 행위  

### 모토 및 개념

- 기록이 모여 있는 책장 속의 집단적 사고  
- 커밋들이 만들어낸 하나의 마음  
- **"기록이 만들어낸 또 하나의 브레인"**

---

## 2. 기능 목적 및 범위

### 핵심 기능

| 기능 | 설명 |
|------|------|
| **질의 응답** | 노트·커밋 내용을 질문하면 관련 내용을 검색해 답변 |
| **요약** | 특정 노트/커밋 또는 검색 결과에 대한 요약 제공 |
| **출처 표시** | 답변에 사용된 노트·커밋 출처 명시 |
| **노트/커밋 이동** | 출처 클릭 시 해당 노트 상세 또는 커밋 위치로 이동 (딥링크) |
| **유사도·관련도 표시** | 검색된 청크/문서에 대한 유사도 점수 또는 관련도 표시 (UI) |

### 부가 고려 기능 (설계서에 포함 권장)

- **무관 질문 처리**: 노트/커밋과 무관한 질문일 때 “제가 아는 건 당신의 노트와 커밋이에요” 등 안내 후 범위 밖임을 명시  
- **검색 결과 없음**: 관련 내용이 없을 때 “관련 노트/커밋을 찾지 못했어요” + 저장된 데이터 범위 안내  
- **스트리밍 응답**: 긴 답변은 OpenAI 스트리밍으로 실시간 표시 (체감 속도·UX)  
- **대화 이력**: 세션/탭 단위 또는 DB 저장으로 이전 질문·답변 유지 (선택)  
- **플랜별 제한**: 현재는 일 50회(LLM 호출 건수) 동일. 추후 Free/Pro/Team별 일일 쿼리·토큰 차등 연동 가능.

---

## 3. 아키텍처 설계

### 3.1 전체 흐름

```
[사용자 질문]
      ↓
[Next.js API Route] (인증·RLS·비용 체크)
      ↓
[질문 텍스트 → OpenAI Embeddings API] → query embedding
      ↓
[Supabase] embeddings 테이블에서 user_id 일치 + 유사도 검색 (pgvector 또는 코사인 유사도)
      ↓
[상위 K개 청크 조회] → 노트/커밋 메타 및 원문 수집
      ↓
[Context 구성] system prompt + retrieved chunks + user message
      ↓
[OpenAI Chat Completions API] (GPT 모델) → 답변 생성
      ↓
[응답 반환] 답변 텍스트 + 출처 목록( note_id, commit_id, score 등) → 프론트
      ↓
[프론트] 답변 표시, 출처 링크(노트/커밋 이동), 유사도·관련도 표시
```

### 3.2 구성 요소

| 구분 | 기술 | 비고 |
|------|------|------|
| **LLM** | OpenAI GPT (gpt-4o-mini / gpt-4o 등) | [Chat Completions API](https://developers.openai.com/api/docs) |
| **Embedding** | OpenAI Embeddings (text-embedding-3-small 등) | [Embeddings API](https://developers.openai.com/api/docs) |
| **벡터 저장·검색** | Supabase (PostgreSQL + pgvector) | embeddings 테이블, user_id 필터 |
| **API** | Next.js Route Handlers (서버 전용) | API 키·비용 제어 서버에서만 수행 |
| **인증** | Supabase Auth (기존 세션) | RLS로 본인 데이터만 검색·노출 |

### 3.3 OpenAI API 참조

구축 시 [OpenAI API 문서](https://developers.openai.com/api/docs)를 기준으로 합니다.

| 용도 | 참조 |
|------|------|
| **챗 완성(답변 생성)** | [Chat Completions](https://developers.openai.com/api/docs) — 모델(gpt-4o-mini, gpt-4o 등), `max_tokens`, `temperature`, 스트리밍(`stream`) |
| **임베딩** | [Embeddings](https://platform.openai.com/docs/api-reference/embeddings/create) — `text-embedding-3-small` / `text-embedding-3-large`, `dimensions` 파라미터 |
| **한도·에러** | Rate limits, 에러 코드, 비용 정책 — 동일 문서 내 정책 섹션 참고 |

---

## 4. RAG 구조 설계

### 4.1 데이터 소스

- **notes**: `id`, `user_id`, `title`, `description`, `category_*`, `tags`, `updated_at` 등  
- **commits**: `id`, `user_id`, `note_id`, `title`, `message`, `sequence`, `created_at` 등  

RAG에는 **노트 단위 요약 + 커밋 단위(또는 청크)** 를 조합하는 방식 권장.

### 4.2 청크(Chunk) 전략

| 전략 | 설명 | 장단점 |
|------|------|--------|
| **노트 1건 = 1청크** | 노트 메타(title, description) + 해당 노트 커밋 제목·메시지 일부를 하나의 텍스트로 | 구현 단순, 노트 단위 이동에 유리. 긴 노트는 토큰 초과 가능 |
| **커밋 1건 = 1청크** | 커밋 title + message를 하나의 텍스트로 | 검색 정밀도 높음, 출처를 커밋 단위로 이동 가능. 청크 수 많아짐 |
| **하이브리드** | 노트 요약 1청크 + 노트 내 커밋별 1청크 | 검색 품질·출처 이동 모두 고려 가능 (권장) |

**권장**:  
- Embedding 대상: **커밋 1건 = 1청크** (title + message 결합).  
- 선택: 노트 `title` + `description`만 묶은 “노트 요약” 청크를 추가하면 “이 노트 전반이 어떤 내용인지” 검색에 유리.

### 4.3 Embedding 생성

1. **대상**  
   - 기존 `notes`·`commits`에 대해 **청크 텍스트** 구성 (위 전략에 따라).  
   - 신규/수정 노트·커밋은 **트리거 또는 배치**로 embedding 갱신.
2. **API**  
   - [OpenAI Embeddings API](https://developers.openai.com/api/docs) 사용.  
   - 모델: `text-embedding-3-small` (비용·성능 균형) 또는 `text-embedding-3-large` (품질 우선).  
   - `dimensions` 파라미터로 차원 축소 가능 (저장·검색 비용 절감).
3. **저장**  
   - `embeddings` 테이블에 `(user_id, source_type, source_id, chunk_text, embedding)` 등 저장 (5단계 DB 설계 참고).

### 4.4 검색 흐름

1. 사용자 **질문** → 동일 Embedding 모델로 **query embedding** 생성.  
2. **Supabase**에서 `user_id = auth.uid()` 조건으로 **유사도 검색** (pgvector `<=>` 코사인 거리 또는 내적).  
3. **상위 K개** (예: 5~10) 청크 조회.  
4. 각 청크의 `source_id`로 **notes**/ **commits**에서 메타·원문 수집 (제목, 노트 경로 등).  
5. **Context** 문자열 구성:  
   - “다음은 사용자의 노트/커밋 내용이다. 이에 기반해 질문에 답하라. 출처는 반드시 명시하라.”  
   - + 청크별 텍스트 (노트명, 커밋 제목, 발췌 등).  
6. **Chat Completions** 호출:  
   - `system`: 역할 + 출처 표기 형식 지시.  
   - `user`: 위 context + “질문: {user_question}”  
7. 응답과 함께 **출처 목록** (note_id, commit_id, score 등) 반환 → 프론트에서 링크 및 유사도 표시.

### 4.5 추가 고려 사항

- **청크 텍스트 길이**: OpenAI embedding 입력 토큰 제한에 맞게 잘라내기 (8K 등).  
- **동기화**: 노트/커밋 수정·삭제 시 해당 embedding 갱신/삭제 (트리거 또는 주기 배치).  
- **다국어**: 한글·영문 혼용이면 `text-embedding-3-*` 사용만으로도 대부분 처리 가능.

---

## 5. DB 설계 확장 (embeddings 테이블)

### 5.1 embeddings 테이블

```sql
-- 예시 스키마 (pgvector 확장 필요)
create extension if not exists vector;

create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  source_type text not null,  -- 'note' | 'commit'
  source_id uuid not null,   -- notes.id or commits.id
  note_id uuid references public.notes(id) on delete cascade,  -- commit인 경우 노트 참조

  chunk_index integer default 0,  -- 동일 source 내 청크 순서
  content_text text not null,     -- embedding에 사용한 원문(검색 결과 미리보기 등에 사용 가능)

  embedding vector(1536),         -- text-embedding-3-small 기본 차원; 모델 변경 시 dimensions 맞출 것

  created_at timestamp with time zone default now()
);

-- RLS
alter table public.embeddings enable row level security;

create policy "Users can manage own embeddings"
  on public.embeddings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 유사도 검색용 인덱스 (코사인 거리)
create index if not exists idx_embeddings_user_vector
  on public.embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

- **vector 크기**: `text-embedding-3-small` 기본 1536, `dimensions`로 줄이면 그에 맞게 `vector(N)` 변경.  
- **source_type/source_id**: 출처 링크 생성 시 `/notes/[id]`, `/notes/[noteId]#commit-[commitId]` 등으로 이동 지원.

### 5.2 인덱스·성능

- `user_id` + `embedding` 복합 조건으로 검색하므로 `user_id` 인덱스 권장.  
- 데이터량이 많아지면 `ivfflat`의 `lists` 값 조정 또는 `hnsw` 검토.

---

## 6. 보안 설계

| 항목 | 내용 |
|------|------|
| **API 호출 위치** | OpenAI API(Embeddings, Chat) 호출은 **서버 전용** (Next.js API Route). 클라이언트에는 API 키 노출하지 않음. |
| **API 키 보관** | `OPENAI_API_KEY` 등은 환경 변수(`.env.local`, Vercel Environment Variables)에만 저장. |
| **RLS** | `embeddings` 테이블은 `user_id = auth.uid()`로만 접근. 검색·노출은 모두 “본인 데이터”만. |
| **인증** | 챗봇 API Route는 Supabase 세션(쿠키 또는 Bearer) 확인 후 처리. 미인증 시 401. |
| **입력 검증** | 질문 길이·특수문자 등 제한으로 악의적 입력 및 과도한 토큰 소비 완화. |

---

## 7. 비용 통제 설계

### 7.1 파라미터 제한

- **Chat Completions**: `max_tokens` 상한 (예: 1024), `temperature` 고정 (예: 0.3~0.7).  
- **Embeddings**: 요청당 토큰 제한(문서화된 제한 참고), 불필요한 재생성 최소화.

### 7.2 사용량 한도 (현재 구현)

- **일일 한도**: 사용자별(또는 플랜별) “일일 쿼리 수” 또는 “일일 토큰 합계” 상한.  
- **저장**: `user_llm_usage`(또는 `chat_usage`) 테이블에 `user_id`, `date`, `request_count`, `input_tokens`, `output_tokens` 등 누적.  
- **판단**: API Route에서 “오늘 사용량 + 이번 요청 예상 토큰”이 한도를 넘으면 429 또는 안내 메시지 반환.

**현재 구현**: 일 50회는 **LLM 호출 건수**만 집계(플랜 구분 없음). chat 진입 시 `user_llm_usage.request_count`(당일) 조회 후 50 이상이면 429 + `limit_exceeded`. LLM 호출 후에만 `upsertUsage`로 count+1·토큰 누적. 요청당 max_tokens 1024, 질문 2000자 상한. 토큰 일일 상한 없음.

**일일 쿼리 수 한도(50회) 상세**

- **의미**: 사용자당 하루 50회까지 **LLM(Chat Completions)을 호출해 답변을 생성한 요청**만 한도에 포함된다. 즉, 채팅으로 답변을 받는 횟수가 일 50회 한도이다. 플랜(Free/Pro/Team) 구분 없이 동일.
- **50회에 포함되는 경우**: (1) 구조적 쿼리 결과를 context로 LLM에 넘겨 답변 문장을 생성한 경우, (2) RAG 검색 결과를 context로 LLM에 넘겨 답변을 생성한 경우. 둘 다 LLM 호출 1회로 `request_count`가 1 증가한다.
- **50회에 포함되지 않는 경우(무제한)**: LLM을 호출하지 않고 고정 안내만 반환할 때. (1) Free 사용자가 의미 검색 질문을 했을 때 Pro 플랜 안내만 반환, (2) 구조적 질문인데 패턴 미매칭으로 구조적 조회 안내만 반환, (3) context 없음으로 관련 노트/커밋 없음 안내만 반환. 이때는 `request_count`를 증가시키지 않으므로 일일 한도와 무관하게 무제한이다.
- **적용**: chat API 진입 시 당일 `request_count` 조회, 50 이상이면 429 + limit_exceeded로 차단. LLM 호출 후에만 `upsertUsage`로 count+1·토큰 누적. `user_llm_usage`에 user_id·date·request_count·input_tokens·output_tokens 저장.

### 7.3 사용량 기록 테이블 (예시)

```sql
create table if not exists public.user_llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,

  request_count integer default 0,
  input_tokens integer default 0,
  output_tokens integer default 0,

  unique(user_id, date)
);

-- RLS: 본인만 조회/삽입 가능 (서버는 service role로 upsert)
```

- 매 쿼리 후 Chat 응답의 `usage` 필드로 `input_tokens`/`output_tokens` 읽어 upsert.

---

## 8. 멀티 AI 구조 설계 (확장)

### 8.1 개념

- **대분류/중분류별 담당 AI**: 예) “기획” 노트는 요약 위주, “개발” 노트는 코드·커밋 위주 등으로 system prompt 분리.  
- **구현**:  
  - 검색된 청크의 `category_large`/`category_medium`(또는 노트 메타)로 “역할” 결정.  
  - 역할별 **system prompt** 매핑 테이블 또는 설정 파일.  
  - 단일 GPT 모델 호출 시 `system`만 바꿔서 사용.

### 8.2 설계 포인트

- 기본은 **단일 system prompt**로 출발하고, 필요 시 “카테고리 → prompt 키” 매핑만 추가.  
- 프론트에서 “어떤 AI가 답했는지” 표시할지 여부는 UX 요구에 따라 선택.

---

## 9. 프론트 UX 설계

### 9.1 배치·진입

- **우측 하단** 고정 영역에 **PushMind 챗봇 아이콘** 배치.  
- 아이콘 클릭 시 **채팅 형태** 패널(Sheet) 오픈.  
- **동기화**: 패널을 **열 때마다** 클라이언트에서 `POST /api/pushmind/embed` 전체 동기화를 호출해 최신 노트·커밋이 인덱싱되도록 함. 상단에 수동 동기화 버튼은 없음. 동기화 중에는 입력 비활성화 + placeholder "동기화 중...".

### 9.2 채팅 UI

- **헤더**: 제목 "PushMind" 아래 슬로건 "기록이 만들어낸 또 하나의 브레인 PushMind" 표시.  
- **환영 메시지**: 동기화 완료 후 첫 메시지로 "무엇을 도와드릴까요?"만 표시 (인덱싱 건수 등 기술 문구 없음).  
- **메시지 목록**: 사용자 질문 + 어시스턴트 답변 (말풍선, 스크롤). **대화 state**는 SharedAppLayout에서 보관해 페이지 이동 시에도 유지.  
- **입력창**: 질문 입력 후 전송 (Enter 또는 버튼).  
- **참고한 출처**: 답변 하단에 유사도 **최고 1개** 표시(동률이면 모두 표시). 노트/커밋 제목 + "질문과의 관련도 N%". 툴팁으로 "질문과 해당 출처 내용 간의 관련도이며, 답변 정확도를 나타내지 않습니다" 안내.  
- **출처 클릭**: 노트 출처 → 해당 노트 페이지로 이동. 커밋 출처 → 해당 노트 페이지로 이동 + 커밋 내역 Sheet 자동 오픈 + 해당 커밋 카드 하이라이트(약 1초).  
- **답변 본문**: LLM에게 "해당 내용은 노트 N, 커밋 N에서 참고했어요" 문구를 넣지 말도록 지시(출처는 별도 블록으로만 표시).

### 9.3 상태·에러

- 로딩: “검색하고 있어요” / “답변을 만들고 있어요” 등.  
- 스트리밍 사용 시: 토큰 단위로 텍스트 추가 표시.  
- 에러: “일시적 오류”, “한도 초과” 등 사용자 친화 메시지 + 재시도 유도.

### 9.4 접근성

- 키보드만으로 채팅 열기/닫기/전송 가능.  
- 스크린 리더 대응 (역할, 라벨).

---

## 10. API Route 설계 (요약)

| Method | 경로 (예) | 역할 |
|--------|------------|------|
| POST | `/api/pushmind/chat` | 질문 수신 → **의도 분류**(semantic/structural/hybrid) → RAG 유사도 검색 또는 구조적 쿼리(`queryStructured`) 또는 병합 → context 구성 → Chat Completions 호출 → 답변 + 출처 반환. 일일 한도 50회. |
| POST | `/api/pushmind/embed` | 노트·커밋 청크(태그·카테고리·연관 노트 제목·첨부 파일명 등 포함) embedding 생성·갱신. **호출**: 클라이언트에서 패널 열 때마다 전체 동기화 호출. |

- 인증: 모든 Route에서 Supabase Auth 확인.  
- 비용: `user_llm_usage` 조회/갱신 및 한도 체크.

---

## 11. 부족·추가 고려 사항 정리

- **Rate limit**: OpenAI 단위당 제한 있음. 재시도·백오프 및 “잠시 후 다시 시도해 주세요” 안내.  
- **타임아웃**: Chat/Embedding 호출 타임아웃 설정 및 클라이언트에서 중단·재시도 처리.  
- **출처 순서**: 검색 점수 순으로 정렬해 사용자에게 동일 순서로 노출.  
- **개인정보**: system prompt에 “사용자 개인정보를 답변에 포함하지 말 것” 등 지시 권장.  
- **감사 로그**: (선택) 질문/답변 요약을 로그로 남겨 남용·품질 분석에 활용.  
- **플랜 연동**: 현재 PushMind 일일 한도는 플랜 구분 없음(§7.2). 추후 PLAN.md 한도와 연동해 일일 쿼리/토큰 차등 적용 가능.

---

## 12. 단계별 구현 순서 제안

1. **아키텍처·브랜딩 확정** — 본 설계서 기준으로 팀 합의.  
2. **DB 확장** — pgvector 확장, `embeddings`, `user_llm_usage` 테이블 생성 및 RLS.  
3. **RAG 파이프라인** — 청크 전략 결정, embedding 생성(배치/트리거), 유사도 검색 API.  
4. **보안·비용** — API Route, env, RLS, 사용량 테이블 및 한도 체크.  
5. **Chat API 연동** — context 조합, Chat Completions 호출, 출처 포맷 통일.  
6. **프론트** — 우측 하단 아이콘, 채팅 패널, 출처 링크, 유사도 표시.  
7. **멀티 AI(선택)** — 카테고리별 system prompt 도입.

---

## 13. 하이브리드 확장 (RAG + 구조적 쿼리)

PushMind는 **의미 검색(RAG)** 과 **구조적 쿼리(DB 직접 조회)** 를 조합한 하이브리드 방식으로 동작한다.

- **플랜별 제공**: **Free** — 구조적 쿼리만(최근 커밋·노트 개수 등). semantic 질문 시 "노트·커밋 내용 검색은 Pro 플랜 이상에서 이용할 수 있어요" 안내. **Pro/Team** — 하이브리드(구조적 쿼리 + RAG). chat API에서 `getEffectivePlan()`으로 만료일 포함해 유효 플랜 판단.

### 13.1 의도 분류

| 의도 | 처리 |
|------|------|
| **semantic** | RAG만 사용 (노트·커밋 내용 질의) |
| **structural** | `queryStructured()`로 DB 직접 조회 → 결과를 context로 LLM에 전달, 출처는 structural만 |
| **hybrid** | 구조적 쿼리 + RAG 동시 실행 → context·출처 병합 |

- **규칙 기반**: `classifyIntent()` — 구체적 구문만 사용(예: "태그에", "마지막 수정한 노트", "노트 알려줘", "노트 목록").
- **LLM 폴백**: 규칙이 structural로 분류했는데 패턴이 없을 때 `classifyIntentWithLlm()` 호출 → semantic이면 RAG로 재시도.

### 13.2 구조적 쿼리 유형

구현: `src/lib/pushmindStructured.ts`의 `queryStructured()`. **유형 추가 시** (1) `classifyIntent()`의 `structuralPhrases`에 구체적 구문 추가, (2) `queryStructured()` 내부에 패턴 매칭 순서와 runner 함수 추가.

| 유형 | 예시 질문 | 쿼리/로직 | 구현 함수 |
|------|-----------|-----------|-----------|
| 특정 노트의 최신 커밋 | "노트 [제목]의 마지막 커밋" | 노트 제목 ILIKE → `commits` WHERE note_id = ? ORDER BY created_at DESC LIMIT 1 | `runLatestCommitByNoteTitle` |
| 노트 X와 연관된 노트 | "노트 [제목]과 연관된 노트" | 노트 제목 ILIKE → 해당 노트.related_note_ids로 notes 조회 | `runRelatedNotesOfNote` |
| 최근 커밋 N개 | "가장 마지막 커밋", "최근 커밋 5개" | `commits` ORDER BY created_at DESC LIMIT N (N 생략 시 1, 최대 20) | `runLatestCommits` |
| 커밋한 노트 | "가장 마지막에 커밋한 노트는?" | 최신 커밋 1건 → 해당 note 정보 | `runLatestCommit` |
| 처음/오래된 커밋 | "첫 번째 커밋", "가장 처음 커밋" | `commits` ORDER BY created_at ASC LIMIT 1 | `runFirstCommit` |
| 최근 수정한 노트 N개 | "마지막 수정한 노트", "최근 수정한 노트 5개" | `notes` ORDER BY updated_at DESC LIMIT N (기본 1, 최대 20) | `runLatestNotes` |
| 처음 만든 노트 N개 | "가장 처음 만든 노트", "첫 노트" | `notes` ORDER BY created_at ASC LIMIT N | `runOldestNotes` |
| 오래 안 수정한 노트 | "오래 안 수정한 노트" | `notes` ORDER BY updated_at ASC LIMIT 10 | `runLeastRecentlyUpdatedNotes` |
| 커밋 없는 노트 | "커밋이 없는 노트" | `notes` WHERE commit_count = 0 | `runNotesWithNoCommits` |
| 연관 노트 있는 목록 | "연관된 노트", "연관 노트 목록" | `notes` WHERE related_note_ids IS NOT NULL 및 배열 비어있지 않음 | `runNotesWithRelated` |
| 노트 개수 | "노트 몇 개", "노트 개수" | `notes` COUNT(*) | `runNoteCount` |
| 커밋 개수 | "커밋 몇 개", "커밋 개수" | `commits` COUNT(*) | `runCommitCount` |
| 상태별 노트 | "활성 상태 노트", "archived 노트" | `notes` WHERE status = X (active/archived/completed) | `runNotesByStatus` |
| 카테고리 X인 노트 | "카테고리 업무용인 노트" | `notes` WHERE category_* ILIKE X | `runNotesByCategory` |
| [카테고리명] 노트 몇 개/알려줘 | "마케팅 관리 노트는 몇개 있어?", "마케팅 관리 노트 알려줘" | `notes` WHERE category_* ILIKE X. "노트 몇 개"·"노트 알려줘" 패턴으로 카테고리 추출 | `runNotesByCategory` |
| 태그 X 포함 노트 | "태그에 베트남이 있는 노트들" | `notes` WHERE tags @> ARRAY['X']. 태그 추출: `태그에 X이/가 있는 노트`, `태그 X 포함 노트` 등 | `runNotesByTag` |

**패턴 매칭 순서**: 특정 노트 지정(노트 [제목]의/과 …)이 먼저 오고, 그 다음 일반 패턴(최근 커밋, 최근 노트 등). 동일 의도라도 더 구체적인 패턴을 위에 두어 오매칭을 줄인다.

### 13.3 RAG 청크 확장

노트 청크: `title`, `description`, 카테고리, 태그, 상태, 연관 노트 제목, reference_urls(최대 3), last_commit_at.  
커밋 청크: `title`, `message`, 첨부 파일명, reference_urls(최대 3), created_at.  
청크 길이 상한(예: 6000자) 유지. 데이터 소스별 활용 상세는 [DATABASE.md](./DATABASE.md)의 "PushMind 하이브리드에서 notes/commits 활용" 참고.

---

이 문서는 [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md)와 함께 참고하며, OpenAI API 문서(https://developers.openai.com/api/docs)는 구현 시 최신 스펙 확인용으로 사용하면 됩니다.
