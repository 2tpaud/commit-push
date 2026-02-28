import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabaseServer'

function getDaysLeft(expiresAt: Date): number {
  const diffMs = expiresAt.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

async function notifyPlanExpiry(
  supabase: SupabaseClient,
  userId: string,
  plan: string,
  expiresAt: Date,
  daysLeft: number
) {
  const type = daysLeft === 3 ? 'plan_expiry_3days' : daysLeft === 1 ? 'plan_expiry_1day' : null
  if (!type) return

  // 같은 날짜/유형 중복 알림 방지
  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString())
    .limit(1)

  if (existing && existing.length > 0) return

  const planLabel = plan === 'team' ? 'Team' : plan === 'pro' ? 'Pro' : plan
  const expiresLabel = expiresAt.toLocaleDateString('ko-KR')
  const dayLabel = `D-${daysLeft}`

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    payment_id: null,
    title: `${planLabel} 플랜 만료 ${dayLabel}`,
    body: `현재 ${planLabel} 플랜이 ${expiresLabel}에 만료됩니다. (${dayLabel})`,
  })
}

/**
 * GET: plan_expires_at이 지났으면 해당 사용자를 free 플랜으로 전환합니다.
 * 인증: 1) 쿠키 세션 2) 없으면 Authorization: Bearer (배포 환경에서 쿠키 미전달 시 대비).
 */
export async function GET(request: Request) {
  let supabase = await createServerSupabase()
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
      if (u) {
        user = u
        supabase = client
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error: fetchError } = await supabase
    .from('users')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const plan = (row.plan as string) ?? 'free'
  const planExpiresAt = row.plan_expires_at

  if (plan === 'free' || !planExpiresAt) {
    return NextResponse.json({ ok: true, updated: false })
  }

  const expiresAt = new Date(planExpiresAt)
  if (expiresAt > new Date()) {
    const daysLeft = getDaysLeft(expiresAt)
    if (daysLeft === 3 || daysLeft === 1) {
      await notifyPlanExpiry(supabase, user.id, plan, expiresAt, daysLeft)
    }
    return NextResponse.json({ ok: true, updated: false })
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      plan: 'free',
      plan_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('Plan check-expiry update error:', updateError)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: true })
}
