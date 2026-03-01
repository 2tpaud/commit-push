/**
 * POST /api/pushmind/chat
 * PushMind RAG — 질문 → embedding 검색 → context → Chat Completions → 답변 + 출처
 * 설계: docs/PUSHMIND-RAG.md
 *
 * Body: { message: string }
 * 응답: { answer: string, sources: { source_type, source_id, note_id, similarity }[] }
 *
 * 인증: 쿠키 세션 또는 Authorization: Bearer
 */

import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabaseServer'
import { getEmbedding, searchSimilar, type MatchRow } from '@/lib/pushmind'
import OpenAI from 'openai'

const CHAT_MODEL = 'gpt-4o-mini'
const MAX_TOKENS = 1024
const TEMPERATURE = 0.3
const MAX_QUESTION_LENGTH = 2000
const MATCH_COUNT = 10
const DAILY_REQUEST_LIMIT = 50

const SYSTEM_PROMPT = `당신은 PushMind입니다. 사용자의 노트와 커밋(생각의 기록)을 기반으로 질문에 답하는 챗봇이에요.
답변할 때는 반드시 아래 [참고]에 제공된 내용만 사용하세요. 참고에 없는 내용은 추측하지 말고 "제가 가진 기록에는 그 내용이 없어요"라고 답하세요.
답변 본문에 "해당 내용은 노트 N, 커밋 N에서 참고했어요" 같은 출처 문구를 넣지 마세요. 출처는 별도로 표시됩니다.
사용자 개인정보를 답변에 포함하지 마세요.`

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

async function getAuthUser(request: Request): Promise<{ id: string } | null> {
  const supabase = await createServerSupabase()
  let session = (await supabase.auth.getSession()).data.session
  let user = session?.user

  if (!user) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data: { user: u } } = await client.auth.getUser()
      if (u) user = u
    }
  }

  return user ? { id: user.id } : null
}

function buildContext(matches: MatchRow[]): string {
  return matches
    .map((m, i) => {
      const label = m.source_type === 'note' ? '노트' : '커밋'
      return `[${label} ${i + 1}]\n${m.content_text}`
    })
    .join('\n\n')
}

type UserLlmUsageRow = {
  id: string
  request_count: number | null
  input_tokens: number | null
  output_tokens: number | null
}

async function upsertUsage(
  supabase: SupabaseClient,
  userId: string,
  inputTokens: number,
  outputTokens: number
) {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('user_llm_usage')
    .select('id, request_count, input_tokens, output_tokens')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const existing = data as UserLlmUsageRow | null
  if (existing) {
    const payload = {
      request_count: (existing.request_count ?? 0) + 1,
      input_tokens: (existing.input_tokens ?? 0) + inputTokens,
      output_tokens: (existing.output_tokens ?? 0) + outputTokens,
    }
    // @ts-ignore -- Supabase user_llm_usage 테이블 타입 미정의 시 로컬/배포 환경별 never 추론 차이 대응
    await supabase.from('user_llm_usage').update(payload).eq('id', existing.id)
  } else {
    // @ts-ignore -- Supabase user_llm_usage 테이블 타입 미정의 시 로컬/배포 환경별 never 추론 차이 대응
    await supabase.from('user_llm_usage').insert({ user_id: userId, date: today, request_count: 1, input_tokens: inputTokens, output_tokens: outputTokens })
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  let body: { message?: string } = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    // ignore
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (message.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 }
    )
  }

  const supabaseAdmin = getServiceSupabase()
  const userId = user.id

  const today = new Date().toISOString().slice(0, 10)
  const { data: usageRow } = await supabaseAdmin
    .from('user_llm_usage')
    .select('request_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const currentCount = usageRow?.request_count ?? 0
  if (currentCount >= DAILY_REQUEST_LIMIT) {
    return NextResponse.json(
      {
        error: 'limit_exceeded',
        message: `오늘 PushMind 사용 한도(${DAILY_REQUEST_LIMIT}회)를 모두 사용했어요. 내일 다시 이용해 주세요.`,
      },
      { status: 429 }
    )
  }

  try {
    const queryEmbedding = await getEmbedding(message)
    const matches = await searchSimilar(supabaseAdmin, userId, queryEmbedding, MATCH_COUNT)

    if (matches.length === 0) {
      return NextResponse.json({
        answer:
          '관련된 노트나 커밋을 찾지 못했어요. 아직 노트·커밋이 인덱싱되지 않았을 수 있어요. PushMind 패널 상단의 "동기화" 버튼을 눌러 주세요. 동기화 후에도 같은 메시지가 나오면, 질문을 다르게 바꿔 보시거나 노트/커밋에 해당 내용이 있는지 확인해 주세요.',
        sources: [],
      })
    }

    const context = buildContext(matches)
    const userContent = `[참고]\n${context}\n\n[질문]\n${message}`

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const choice = completion.choices[0]
    const answer = choice?.message?.content?.trim() ?? '답변을 생성하지 못했어요.'
    const usage = completion.usage

    if (usage) {
      await upsertUsage(
        supabaseAdmin,
        userId,
        usage.prompt_tokens ?? 0,
        usage.completion_tokens ?? 0
      )
    }

    const noteIds = [...new Set(matches.map((m) => m.note_id).filter(Boolean))] as string[]
    const commitIds = [...new Set(matches.filter((m) => m.source_type === 'commit').map((m) => m.source_id))]

    const noteTitleMap: Record<string, string> = {}
    const commitTitleMap: Record<string, string> = {}
    if (noteIds.length > 0) {
      const { data: notes } = await supabaseAdmin
        .from('notes')
        .select('id, title')
        .in('id', noteIds)
      notes?.forEach((n) => { noteTitleMap[n.id] = n.title ?? '' })
    }
    if (commitIds.length > 0) {
      const { data: commits } = await supabaseAdmin
        .from('commits')
        .select('id, title')
        .in('id', commitIds)
      commits?.forEach((c) => { commitTitleMap[c.id] = c.title ?? '' })
    }

    const sources = matches.map((m) => {
      const title =
        m.source_type === 'note'
          ? noteTitleMap[m.note_id!] ?? ''
          : commitTitleMap[m.source_id] ?? ''
      return {
        source_type: m.source_type,
        source_id: m.source_id,
        note_id: m.note_id,
        similarity: Math.round(m.similarity * 100) / 100,
        title: title || undefined,
      }
    })
    const topSim = sources[0]?.similarity
    const topSources = sources.filter((s) => s.similarity === topSim)

    return NextResponse.json({ answer, sources: topSources })
  } catch (err) {
    console.error('PushMind chat error:', err)
    const message = err instanceof Error ? err.message : '답변 생성에 실패했어요.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
