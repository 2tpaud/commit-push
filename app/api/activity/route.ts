import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 활동 기여도용 데이터 소스 (docs/DATABASE.md 기준)
 * - 노트 활동: public.notes (created_at, updated_at) — 해당 날짜 생성·수정 건수
 * - 커밋 활동: public.commits (created_at) — 해당 날짜 생성 건수
 * - 기간: query year 파라미터 기준 해당 연도 1월 1일(KST) ~ 12월 31일(KST) 전체
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

type DayMap = Record<string, { notes: number; commits: number }>

/** 시각(ms)을 KST 기준 날짜 문자열 YYYY-MM-DD로 변환 (서버·클라이언트 동일) */
function dateKeyKST(timestampMs: number): string {
  const d = new Date(timestampMs + KST_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const parsed = yearParam ? parseInt(yearParam, 10) : NaN
  const year = Number.isNaN(parsed) ? new Date(Date.now() + KST_OFFSET_MS).getUTCFullYear() : Math.min(2100, Math.max(2000, parsed))
  const startMs = Date.UTC(year, 0, 1) - KST_OFFSET_MS
  const startNextYearMs = Date.UTC(year + 1, 0, 1) - KST_OFFSET_MS

  const [notesRes, commitsRes] = await Promise.all([
    supabase
      .from('notes')
      .select('created_at, updated_at')
      .eq('user_id', uid)
      .limit(10000),
    supabase
      .from('commits')
      .select('created_at')
      .eq('user_id', uid)
      .limit(10000),
  ])

  if (notesRes.error) {
    return NextResponse.json({ error: notesRes.error.message }, { status: 500 })
  }
  if (commitsRes.error) {
    return NextResponse.json(
      { error: commitsRes.error.message },
      { status: 500 }
    )
  }

  const byDate: DayMap = {}
  const dayMs = 24 * 60 * 60 * 1000
  for (let t = startMs; t < startNextYearMs; t += dayMs) {
    byDate[dateKeyKST(t)] = { notes: 0, commits: 0 }
  }

  for (const n of notesRes.data ?? []) {
    const createdAt = n.created_at ? new Date(n.created_at).getTime() : 0
    const updatedAt = n.updated_at ? new Date(n.updated_at).getTime() : 0
    if (createdAt && createdAt >= startMs && createdAt < startNextYearMs) {
      const key = dateKeyKST(createdAt)
      if (byDate[key] !== undefined) byDate[key].notes += 1
    }
    if (updatedAt && updatedAt >= startMs && updatedAt < startNextYearMs && updatedAt !== createdAt) {
      const key = dateKeyKST(updatedAt)
      if (byDate[key] !== undefined) byDate[key].notes += 1
    }
  }

  for (const c of commitsRes.data ?? []) {
    const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0
    if (createdAt >= startMs && createdAt < startNextYearMs) {
      const key = dateKeyKST(createdAt)
      if (byDate[key] !== undefined) byDate[key].commits += 1
    }
  }

  const notesFetched = notesRes.data?.length ?? 0
  const commitsFetched = commitsRes.data?.length ?? 0

  const yearsSet = new Set<number>()
  for (const n of notesRes.data ?? []) {
    if (n.created_at) yearsSet.add(new Date(new Date(n.created_at).getTime() + KST_OFFSET_MS).getUTCFullYear())
    if (n.updated_at) yearsSet.add(new Date(new Date(n.updated_at).getTime() + KST_OFFSET_MS).getUTCFullYear())
  }
  for (const c of commitsRes.data ?? []) {
    if (c.created_at) yearsSet.add(new Date(new Date(c.created_at).getTime() + KST_OFFSET_MS).getUTCFullYear())
  }
  let availableYears = Array.from(yearsSet).sort((a, b) => a - b)
  if (availableYears.length === 0) {
    availableYears = [new Date(Date.now() + KST_OFFSET_MS).getUTCFullYear()]
  }

  return NextResponse.json({
    byDate,
    meta: { notesFetched, commitsFetched, availableYears },
  })
}
