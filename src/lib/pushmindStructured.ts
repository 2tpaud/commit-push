/**
 * PushMind 구조적 쿼리 — DB 직접 조회
 * 설계: docs/PUSHMIND-RAG.md §13 하이브리드 확장
 *
 * "가장 마지막 커밋", "노트 몇 개", "활성 상태 노트" 등 메타·집계 질문 처리
 * 규칙이 애매할 때 LLM으로 의도 분류 (4단계)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export type Intent = 'semantic' | 'structural' | 'hybrid'

const INTENT_CLASSIFY_MODEL = 'gpt-4o-mini'
const INTENT_CLASSIFY_MAX_TOKENS = 10

export interface StructuredResult {
  text: string
  sources: { source_type: string; source_id: string; note_id: string | null; title?: string }[]
}

/** 규칙 기반 의도 분류 — 키워드가 너무 넓으면 semantic 질문을 structural로 오분류함 (예: "1차수"의 "수") */
export function classifyIntent(question: string): Intent {
  const q = question.trim().toLowerCase()
  // 구체적 구문만 사용. "수" 단독 제거 (1차수, 인수, 횟수 등과 충돌)
  const structuralPhrases = [
    '가장 마지막', '가장 최근', '가장 최신', '마지막 커밋', '최근 커밋',
    '커밋한 노트', '마지막에 커밋',
    '최근 수정한 노트', '마지막 수정한 노트', '가장 최근 노트', '마지막 노트',
    '첫 번째 커밋', '첫 커밋', '가장 처음 커밋', '오래된 커밋',
    '가장 처음 만든 노트', '첫 노트', '오래된 노트', '오래 안 수정한 노트',
    '커밋 없는 노트', '연관된 노트', '연관 노트',
    '몇 개', '몇개', '개수', '노트 수', '커밋 수', '총 노트', '총 커밋',
    '합계', '평균', '정렬', '필터', '목록', '리스트',
    '카테고리별', '상태별', '태그별', '태그에', '태그가 있는',
    '노트 알려줘', '노트 알려', '노트 목록', '노트 리스트',
    '활성 상태', 'archived', 'completed', '보관', '완료',
  ]
  const hasStructural = structuralPhrases.some((p) => q.includes(p))

  // "최근 수정한 노트 중 X 관련" → hybrid
  const hybridPatterns = [
    /최근.*노트.*중.*관련/,
    /최근.*노트.*중.*있어/,
    /가장.*노트.*중.*관련/,
    /노트.*중.*가장.*최근/,
  ]
  const hasHybrid = hybridPatterns.some((p) => p.test(q))

  if (hasHybrid) return 'hybrid'
  if (hasStructural) return 'structural'
  return 'semantic'
}

/** 규칙이 애매할 때 LLM으로 의도 분류 (4단계). semantic/structural/hybrid 중 하나 반환 */
export async function classifyIntentWithLlm(question: string): Promise<Intent> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return 'semantic'

  const openai = new OpenAI({ apiKey: key })
  const prompt = `다음 질문을 분류하세요. 답은 반드시 한 단어만: semantic, structural, hybrid 중 하나.
- semantic: 노트/커밋 내용(무엇, 어떻게, 관련)을 의미 검색으로 찾는 질문
- structural: 가장 최근, 마지막, 몇 개, 개수, 정렬, 필터, 카테고리/태그/상태별 목록 등 DB 직접 조회 질문
- hybrid: "최근 노트 중 X 관련"처럼 구조적 조건 + 의미 검색이 모두 필요한 질문

질문: ${question}
답:`

  try {
    const res = await openai.chat.completions.create({
      model: INTENT_CLASSIFY_MODEL,
      max_tokens: INTENT_CLASSIFY_MAX_TOKENS,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.choices[0]?.message?.content?.trim()?.toLowerCase() ?? ''
    if (text.includes('structural')) return 'structural'
    if (text.includes('hybrid')) return 'hybrid'
    return 'semantic'
  } catch {
    return 'semantic'
  }
}

/** 구조적 쿼리 실행 → LLM context용 텍스트 + 출처 반환 */
export async function queryStructured(
  supabase: SupabaseClient,
  userId: string,
  question: string
): Promise<StructuredResult | null> {
  const q = question.trim().toLowerCase()

  // 0. 특정 노트의 최신 커밋 ("노트 [제목]의 마지막 커밋") — 일반 "최근 커밋"보다 먼저
  const noteTitleForCommitMatch = q.match(/노트\s+([^의]+)\s*의\s*(?:가장\s*)?(?:최근|마지막)\s*커밋/)
  if (noteTitleForCommitMatch) {
    const noteTitle = noteTitleForCommitMatch[1].trim()
    if (noteTitle.length > 0 && noteTitle.length < 100) return runLatestCommitByNoteTitle(supabase, userId, noteTitle)
  }

  // 0-2. 노트 X와 연관된 노트 ("노트 [제목]과 연관된 노트") — 일반 "연관 노트"보다 먼저
  const noteTitleForRelatedMatch = q.match(/노트\s+([^과와의]+)\s*(?:과|와|의)\s*연관/)
  if (noteTitleForRelatedMatch) {
    const noteTitle = noteTitleForRelatedMatch[1].trim()
    if (noteTitle.length > 0 && noteTitle.length < 100) return runRelatedNotesOfNote(supabase, userId, noteTitle)
  }

  // 1. 최근 커밋 N개 (N 생략 시 1)
  const latestCommitsMatch = q.match(/(?:가장\s*)?(?:마지막|최근|최신)\s*(?:에\s*)?커밋\s*(\d+)\s*개?/)
  const latestCommitsN = latestCommitsMatch ? Math.min(parseInt(latestCommitsMatch[1], 10) || 1, 20) : 1
  if (/가장\s*(마지막|최근|최신)\s*(?:에\s*)?커밋(?:\s*\d+\s*개)?|(?:마지막|최근)\s*(?:에\s*)?커밋(?:\s*\d+\s*개)?/.test(q) && !/커밋한\s*노트/.test(q)) {
    return runLatestCommits(supabase, userId, latestCommitsN)
  }
  // 1-2. "커밋한 노트" (가장 최근 커밋이 속한 노트 1개)
  if (/가장\s*(마지막|최근|최신)\s*(?:에\s*)?커밋한\s*노트|마지막\s*(?:에\s*)?커밋한\s*노트|최근\s*(?:에\s*)?커밋한\s*노트/.test(q)) {
    return runLatestCommit(supabase, userId)
  }

  // 2. 가장 처음/첫/오래된 커밋
  if (/가장\s*(처음|첫|오래된)\s*커밋|첫\s*(?:번째\s*)?커밋|처음\s*커밋/.test(q)) {
    return runFirstCommit(supabase, userId)
  }

  // 3. 가장/최근/마지막 수정한 노트 (N개, 기본 1)
  const latestNotesMatch = q.match(/(?:가장|최근|마지막)\s*(?:수정한?|수정된?)?\s*노트\s*(\d+)\s*개?/)
  const latestNotesN = latestNotesMatch ? Math.min(parseInt(latestNotesMatch[1], 10) || 1, 20) : 1
  if (/가장\s*(최근|마지막|최신)\s*(?:수정한?|수정된?)?\s*노트|(?:최근|마지막)\s*(?:수정한?|수정된?)?\s*노트/.test(q)) {
    return runLatestNotes(supabase, userId, latestNotesN)
  }

  // 4. 가장 처음 만든 노트 / 오래된 노트 (N개)
  const oldestNotesMatch = q.match(/(?:가장\s*)?(?:처음|첫|오래된)\s*(?:만든\s*)?노트\s*(\d+)\s*개?/)
  const oldestNotesN = oldestNotesMatch ? Math.min(parseInt(oldestNotesMatch[1], 10) || 1, 20) : 1
  if (/가장\s*(처음|첫|오래된)\s*(?:만든\s*)?노트|첫\s*(?:번째\s*)?노트|처음\s*만든\s*노트/.test(q)) {
    return runOldestNotes(supabase, userId, oldestNotesN)
  }

  // 5. 오래 안 수정한 노트 (updated_at 오름차순)
  if (/오래\s*안\s*수정한\s*노트|수정한\s*지\s*오래된\s*노트|오랫동안\s*안\s*수정/.test(q)) {
    return runLeastRecentlyUpdatedNotes(supabase, userId)
  }

  // 6. 커밋이 없는 노트
  if (/커밋\s*(?:이\s*)?(?:없는|한\s*개도\s*없는)\s*노트|커밋\s*없는\s*노트/.test(q)) {
    return runNotesWithNoCommits(supabase, userId)
  }

  // 7. 연관된 노트가 있는 노트 목록
  if (/연관\s*(?:된\s*)?노트|연관\s*노트\s*목록/.test(q)) {
    return runNotesWithRelated(supabase, userId)
  }

  // 9-2. "[카테고리명] 노트는 몇 개" / "X 노트 몇 개" — 카테고리별 노트 개수
  const catCountMatch = q.match(/^(.+?)\s+노트\s*(?:는|가)?\s*몇\s*개/)
  if (catCountMatch) {
    const prefix = catCountMatch[1].trim()
    if (prefix.length >= 2 && !/^(가장|최근|마지막|첫|오래|총|전체)$/.test(prefix)) {
      return runNotesByCategory(supabase, userId, prefix)
    }
  }

  // 9-3. "[카테고리명] 노트 알려줘" — 카테고리별 노트 목록 (RAG 대신 구조적 조회로 정확한 결과)
  const catListMatch = q.match(/^(.+?)\s+노트\s*(?:알려줘|알려\s*주|알려\s*주세요|목록|리스트|보여줘)/)
  if (catListMatch) {
    const prefix = catListMatch[1].trim()
    if (prefix.length >= 2 && !/^(가장|최근|마지막|첫|오래|총|전체)$/.test(prefix)) {
      return runNotesByCategory(supabase, userId, prefix)
    }
  }

  // 10. 노트 개수
  if (/노트\s*(?:가\s*)?몇\s*개|노트\s*개수|노트\s*수|총\s*노트/.test(q)) {
    return runNoteCount(supabase, userId)
  }

  // 11. 커밋 개수
  if (/커밋\s*(?:가\s*)?몇\s*개|커밋\s*개수|커밋\s*수|총\s*커밋/.test(q)) {
    return runCommitCount(supabase, userId)
  }

  // 12. 활성/archived/completed 상태 노트
  const statusMatch = q.match(/(?:활성|active|archived|completed|완료|보관)\s*(?:상태\s*)?노트|노트\s*(?:중\s*)?(?:활성|active)/)
  if (statusMatch) {
    let status = 'active'
    if (/archived|보관/.test(q)) status = 'archived'
    else if (/completed|완료/.test(q)) status = 'completed'
    return runNotesByStatus(supabase, userId, status)
  }

  // 13. 카테고리 X인 노트 (간단 패턴)
  const catMatch = q.match(/(?:카테고리|대분류|중분류)\s*[이가]?\s*["']?([^"'\s]+)["']?\s*(?:인|의)\s*노트/)
  if (catMatch) {
    const catValue = catMatch[1].trim()
    return runNotesByCategory(supabase, userId, catValue)
  }

  // 14. 태그 X 포함 노트 ("태그에 X이/가 있는 노트", "태그 X 포함 노트" 등)
  const tagMatch =
    q.match(/태그에\s+([^\s"']+)\s*(?:이|가)\s*있는\s*노트들?/) ||
    q.match(/(?:태그|#)\s*["']?([^"'\s]+)["']?\s*(?:포함|있는|인)\s*노트/) ||
    q.match(/태그\s*["']?([^"'\s]+)["']?/)
  if (tagMatch) {
    const tag = (tagMatch[1] || '').trim()
    if (tag && tag.length < 50) return runNotesByTag(supabase, userId, tag)
  }

  return null
}

async function runLatestCommit(
  supabase: SupabaseClient,
  userId: string
): Promise<StructuredResult> {
  const { data: commits } = await supabase
    .from('commits')
    .select('id, note_id, title, message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const c = commits?.[0]
  if (!c) {
    return { text: '가장 최근 커밋이 없어요.', sources: [] }
  }

  const { data: note } = await supabase
    .from('notes')
    .select('title')
    .eq('id', c.note_id)
    .single()

  const createdAt = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : ''
  const text = `[가장 최근 커밋]
노트: ${note?.title ?? '(알 수 없음)'}
커밋 제목: ${c.title}
메시지: ${c.message ?? '(없음)'}
작성일: ${createdAt}`

  return {
    text,
    sources: [{ source_type: 'commit', source_id: c.id, note_id: c.note_id, title: c.title }],
  }
}

async function runLatestCommits(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<StructuredResult> {
  const { data: commits } = await supabase
    .from('commits')
    .select('id, note_id, title, message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!commits?.length) {
    return { text: '최근 커밋이 없어요.', sources: [] }
  }

  const noteIds = [...new Set(commits.map((c) => c.note_id))]
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title')
    .in('id', noteIds)
  const noteMap = new Map((notes ?? []).map((n) => [n.id, n.title]))

  const lines = commits.map((c, i) => {
    const noteTitle = noteMap.get(c.note_id) ?? '(알 수 없음)'
    const created = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : ''
    return `${i + 1}. [${noteTitle}] ${c.title} (${created})`
  })
  const text = `[가장 최근 커밋 ${commits.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: commits.map((c) => ({ source_type: 'commit' as const, source_id: c.id, note_id: c.note_id, title: c.title })),
  }
}

async function runFirstCommit(supabase: SupabaseClient, userId: string): Promise<StructuredResult> {
  const { data: commits } = await supabase
    .from('commits')
    .select('id, note_id, title, message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  const c = commits?.[0]
  if (!c) {
    return { text: '커밋이 없어요.', sources: [] }
  }

  const { data: note } = await supabase
    .from('notes')
    .select('title')
    .eq('id', c.note_id)
    .single()

  const createdAt = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : ''
  const text = `[가장 처음 커밋]
노트: ${note?.title ?? '(알 수 없음)'}
커밋 제목: ${c.title}
메시지: ${c.message ?? '(없음)'}
작성일: ${createdAt}`

  return {
    text,
    sources: [{ source_type: 'commit', source_id: c.id, note_id: c.note_id, title: c.title }],
  }
}

async function runLatestNotes(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!notes?.length) {
    return { text: '최근 수정한 노트가 없어요.', sources: [] }
  }

  const lines = notes.map((n, i) => {
    const updated = n.updated_at ? new Date(n.updated_at).toLocaleString('ko-KR') : ''
    return `${i + 1}. ${n.title} (수정: ${updated})`
  })
  const text = `[가장 최근 수정한 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runOldestNotes(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!notes?.length) {
    return { text: '노트가 없어요.', sources: [] }
  }

  const lines = notes.map((n, i) => {
    const created = n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : ''
    return `${i + 1}. ${n.title} (생성: ${created})`
  })
  const text = `[가장 처음 만든 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runLeastRecentlyUpdatedNotes(
  supabase: SupabaseClient,
  userId: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true })
    .limit(10)

  if (!notes?.length) {
    return { text: '노트가 없어요.', sources: [] }
  }

  const lines = notes.map((n, i) => {
    const updated = n.updated_at ? new Date(n.updated_at).toLocaleString('ko-KR') : ''
    return `${i + 1}. ${n.title} (마지막 수정: ${updated})`
  })
  const text = `[오래 안 수정한 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runNotesWithNoCommits(
  supabase: SupabaseClient,
  userId: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .eq('commit_count', 0)
    .limit(50)

  if (!notes?.length) {
    return { text: '커밋이 하나도 없는 노트가 없어요.', sources: [] }
  }

  const lines = notes.map((n, i) => `${i + 1}. ${n.title}`)
  const text = `[커밋이 없는 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runNotesWithRelated(
  supabase: SupabaseClient,
  userId: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, related_note_ids')
    .eq('user_id', userId)
    .not('related_note_ids', 'is', null)
    .limit(30)

  const withRelated = (notes ?? []).filter((n) => {
    const ids = n.related_note_ids as string[] | null
    return ids && ids.length > 0
  })

  if (!withRelated.length) {
    return { text: '연관 노트가 설정된 노트가 없어요.', sources: [] }
  }

  const allRelatedIds = withRelated.flatMap((n) => (n.related_note_ids ?? []) as string[])
  const uniqueIds = [...new Set(allRelatedIds)]
  const { data: relatedNotes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', uniqueIds)
  const titleMap = new Map((relatedNotes ?? []).map((n) => [n.id, n.title]))

  const lines = withRelated.map((n, i) => {
    const ids = (n.related_note_ids ?? []) as string[]
    const titles = ids.map((id) => titleMap.get(id) ?? id).filter(Boolean)
    return `${i + 1}. ${n.title} → 연관: ${titles.join(', ') || '-'}`
  })
  const text = `[연관 노트가 있는 노트 ${withRelated.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: withRelated.map((n) => ({ source_type: 'note' as const, source_id: n.id, note_id: n.id, title: n.title })),
  }
}

/** 특정 노트(제목 일치)의 가장 최근 커밋 */
async function runLatestCommitByNoteTitle(
  supabase: SupabaseClient,
  userId: string,
  noteTitle: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .ilike('title', `%${noteTitle}%`)
    .limit(1)

  const note = notes?.[0]
  if (!note) {
    return { text: `"${noteTitle}"(이)라는 제목의 노트를 찾지 못했어요.`, sources: [] }
  }

  const { data: commits } = await supabase
    .from('commits')
    .select('id, note_id, title, message, created_at')
    .eq('user_id', userId)
    .eq('note_id', note.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const c = commits?.[0]
  if (!c) {
    return { text: `"${note.title}" 노트에는 아직 커밋이 없어요.`, sources: [] }
  }

  const createdAt = c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : ''
  const text = `[노트 "${note.title}"의 가장 최근 커밋]
커밋 제목: ${c.title}
메시지: ${c.message ?? '(없음)'}
작성일: ${createdAt}`

  return {
    text,
    sources: [{ source_type: 'commit', source_id: c.id, note_id: c.note_id, title: c.title }],
  }
}

/** 특정 노트(제목 일치)의 연관 노트 목록 (related_note_ids) */
async function runRelatedNotesOfNote(
  supabase: SupabaseClient,
  userId: string,
  noteTitle: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, related_note_ids')
    .eq('user_id', userId)
    .ilike('title', `%${noteTitle}%`)
    .limit(1)

  const note = notes?.[0]
  if (!note) {
    return { text: `"${noteTitle}"(이)라는 제목의 노트를 찾지 못했어요.`, sources: [] }
  }

  const relatedIds = (note.related_note_ids ?? []) as string[]
  if (relatedIds.length === 0) {
    return { text: `"${note.title}" 노트에는 연관 노트가 설정되어 있지 않아요.`, sources: [] }
  }

  const { data: relatedNotes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', relatedIds)

  if (!relatedNotes?.length) {
    return { text: `"${note.title}"에 연결된 연관 노트를 찾지 못했어요. (삭제되었을 수 있어요)`, sources: [] }
  }

  const lines = relatedNotes.map((n, i) => `${i + 1}. ${n.title}`)
  const text = `["${note.title}"와 연관된 노트 ${relatedNotes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: relatedNotes.map((n) => ({ source_type: 'note' as const, source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runNoteCount(supabase: SupabaseClient, userId: string): Promise<StructuredResult> {
  const { count, error } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) return { text: '노트 개수를 조회하지 못했어요.', sources: [] }
  return { text: `노트는 총 ${count ?? 0}개예요.`, sources: [] }
}

async function runCommitCount(supabase: SupabaseClient, userId: string): Promise<StructuredResult> {
  const { count, error } = await supabase
    .from('commits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) return { text: '커밋 개수를 조회하지 못했어요.', sources: [] }
  return { text: `커밋은 총 ${count ?? 0}개예요.`, sources: [] }
}

async function runNotesByStatus(
  supabase: SupabaseClient,
  userId: string,
  status: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .eq('status', status)
    .limit(50)

  const statusLabel = status === 'active' ? '활성' : status === 'archived' ? '보관' : '완료'
  if (!notes?.length) {
    return { text: `${statusLabel} 상태 노트가 없어요.`, sources: [] }
  }

  const lines = notes.map((n, i) => `${i + 1}. ${n.title}`)
  const text = `[${statusLabel} 상태 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runNotesByCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryValue: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, category_large, category_medium, category_small')
    .eq('user_id', userId)
    .or(`category_large.ilike.%${categoryValue}%,category_medium.ilike.%${categoryValue}%,category_small.ilike.%${categoryValue}%`)
    .limit(50)

  if (!notes?.length) {
    return { text: `"${categoryValue}" 카테고리 노트가 없어요.`, sources: [] }
  }

  const lines = notes.map((n, i) => {
    const cat = [n.category_large, n.category_medium, n.category_small].filter(Boolean).join(' > ')
    return `${i + 1}. ${n.title} (${cat || '-'})`
  })
  const text = `[카테고리 "${categoryValue}" 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}

async function runNotesByTag(
  supabase: SupabaseClient,
  userId: string,
  tag: string
): Promise<StructuredResult> {
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, tags')
    .eq('user_id', userId)
    .contains('tags', [tag])
    .limit(50)

  if (!notes?.length) {
    return { text: `태그 "${tag}"가 있는 노트가 없어요.`, sources: [] }
  }

  const lines = notes.map((n, i) => `${i + 1}. ${n.title}`)
  const text = `[태그 "${tag}" 노트 ${notes.length}개]\n${lines.join('\n')}`

  return {
    text,
    sources: notes.map((n) => ({ source_type: 'note', source_id: n.id, note_id: n.id, title: n.title })),
  }
}
