# 개발자 노트 — PushMind 하이브리드 (RAG + 구조적 쿼리)·문서 정리

---

주요 기능 추가:

- **PushMind 하이브리드 (RAG + 구조적 쿼리)**
  - **배경**: 노트·커밋에 대한 질문을 의미 검색(RAG)만이 아니라 "가장 최근 커밋", "노트 몇 개", "태그에 X 있는 노트" 등 DB 직접 조회로도 답할 수 있도록 확장.
  - **의도 분류**: 규칙 기반 `classifyIntent()` (구체적 구문만 사용, "수" 단독 제거로 "1차수" 오분류 방지). structural로 분류됐는데 패턴이 없으면 `classifyIntentWithLlm()` 호출 후 semantic이면 RAG 재시도.
  - **구조적 쿼리**: `queryStructured()` — 최근/첫 커밋(N개), 커밋한 노트, 최근/처음 만든/오래 안 수정한 노트, 커밋 없는 노트, 연관 노트 목록, 노트/커밋 개수, 카테고리·태그·상태별 노트, 특정 노트의 최신 커밋·연관 노트 등. 구현: `src/lib/pushmindStructured.ts`. 유형 추가 시 `structuralPhrases` + 패턴 매칭·runner 함수 추가.
  - **RAG 청크 확장**: 노트 청크에 태그·카테고리·상태·연관 노트 제목·reference_urls(최대 3)·last_commit_at, 커밋 청크에 첨부 파일명·reference_urls·created_at 포함. embed API select 확장, `related_note_ids` → 제목 조회 후 청크 반영.
  - **출처**: structural일 때는 구조적 쿼리 결과만 출처로 표시, hybrid일 때는 structural + RAG 상위 유사도 병합·중복 제거.
- **의도 분류·패턴 수정**
  - "1차수"가 structural로 오분류되던 문제 → structural 구문을 구체적 구문만 사용하도록 변경.
  - "마지막 수정한 노트", "가장 마지막에 커밋한 노트", "태그에 베트남이 있는 노트" 등 패턴·정규식 추가 및 태그 추출 정규식 수정(`태그에 X이/가 있는 노트`).
- **문서 정리**
  - PUSHMIND-HYBRID.md 설계 내용를 ARCHITECTURE, DATABASE, DESIGN, PRODUCT, PUSHMIND-RAG.md로 분산 기재 후 `docs/PUSHMIND-HYBRID.md` 삭제. 코드·ARCHITECTURE·docs API에서 pushmind-hybrid 참조 제거.

---

UI·API:

- **PushMindChatPanel** — 변경 없음. 의도 분류·구조적 쿼리는 chat API 내부에서 처리.
- **`/api/pushmind/embed`** — 노트·커밋 select 확장(청크 확장 필드), `fetchRelatedNoteTitles()`로 연관 노트 제목 조회 후 청크에 반영.
- **`/api/pushmind/chat`** — `classifyIntent` → semantic/structural/hybrid 분기. structural 시 `queryStructured()` 호출, null이면 `classifyIntentWithLlm()` 폴백. structural·hybrid 시 context에 구조적 결과 포함, 출처 병합.

---

문서화:

- **PUSHMIND-RAG.md** — §13 하이브리드 확장(의도 분류, 구조적 쿼리 유형 표·구현 함수·유형 추가 방법, RAG 청크 확장 요약), §10 API Route 표에 의도 분류·구조적 쿼리 반영.
- **ARCHITECTURE.md** — pushmind/embed·chat 설명에 하이브리드(청크 확장·의도 분류·구조적 쿼리) 반영. `/api/docs/[slug]`에서 pushmind-hybrid 제거.
- **DATABASE.md** — embeddings.content_text comment 확장, "PushMind 하이브리드에서 notes/commits 활용" 절 추가.
- **DESIGN.md** — 홈 PushMind 문단에 의미 검색/구조적 쿼리 설명 추가.
- **PRODUCT.md** — 사용자 흐름 하단에 PushMind 하이브리드 한 줄 추가.

---

파일 구조:

- `src/lib/pushmind.ts` — `NoteForChunk`, `CommitForChunk`, `buildNoteContentText`, `buildCommitContentText`, 청크 확장. 설계 참조를 PUSHMIND-RAG.md만 사용.
- `src/lib/pushmindStructured.ts` — `classifyIntent`, `classifyIntentWithLlm`, `queryStructured`, 구조적 쿼리 유형별 runner 함수. 설계: PUSHMIND-RAG.md §13.
- `app/api/pushmind/embed/route.ts` — select 확장, `fetchRelatedNoteTitles`, 확장된 note/commit으로 `buildChunks`·`buildCommitChunk` 호출.
- `app/api/pushmind/chat/route.ts` — 의도 분류·structural null 시 LLM 폴백·structural/hybrid 시 context·출처 병합.
- `app/api/docs/[slug]/route.ts` — pushmind-hybrid slug 제거.
- `docs/PUSHMIND-HYBRID.md` — 삭제됨.
