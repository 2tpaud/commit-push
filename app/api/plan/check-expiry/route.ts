import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET: plan_expires_at이 지났으면 해당 사용자를 free 플랜으로 전환합니다.
 * Authorization: Bearer <access_token> 필요.
 */
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
