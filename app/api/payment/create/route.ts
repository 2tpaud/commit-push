import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_MONTHLY: Record<string, number> = {
  pro: 5000,
  team: 7000,
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date)
  out.setMonth(out.getMonth() + months)
  return out
}

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/** 결제일/만료일 기준과 동일한 로직으로 이용 기간 시작·종료일 계산 */
function getPeriodRange(
  billingCycle: 'monthly' | 'annual',
  currentPlan: string | null,
  planExpiresAt: string | null,
  payingPlan: string
): { start: Date; end: Date } {
  const addMonthsCount = billingCycle === 'annual' ? 12 : 1
  const now = new Date()
  const currentExpires = planExpiresAt ? new Date(planExpiresAt) : null
  const isSamePlan = currentPlan === payingPlan
  const hasFutureExpiry =
    currentExpires != null &&
    !Number.isNaN(currentExpires.getTime()) &&
    currentExpires.getTime() > now.getTime()
  const baseDate = isSamePlan && hasFutureExpiry ? currentExpires : now
  const start = baseDate
  const end = addMonths(baseDate, addMonthsCount)
  return { start, end }
}

function getAmountAndGoodsName(plan: string, billingCycle: 'monthly' | 'annual') {
  const monthly = PLAN_MONTHLY[plan] ?? 0
  if (billingCycle === 'annual') {
    const annualAmount = Math.round(monthly * 12 * 0.8)
    const baseName = plan === 'pro' ? 'CommitPush Pro 1년' : 'CommitPush Team 1년'
    return { amount: annualAmount, baseGoodsName: baseName }
  }
  const baseName = plan === 'pro' ? 'CommitPush Pro 1개월' : 'CommitPush Team 1개월'
  return { amount: monthly, baseGoodsName: baseName }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { plan?: string; billingCycle?: string }
  const plan = (body.plan as string)?.toLowerCase()
  const billingCycle = (body.billingCycle === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual'
  if (plan !== 'pro' && plan !== 'team') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

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

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, plan, plan_expires_at')
    .eq('id', user.id)
    .single()

  const { amount, baseGoodsName } = getAmountAndGoodsName(plan, billingCycle)
  const { start, end } = getPeriodRange(
    billingCycle,
    profile?.plan ?? null,
    profile?.plan_expires_at ?? null,
    plan
  )
  const periodStr = ` (${formatYMD(start)}~${formatYMD(end)})`
  const goodsName = (baseGoodsName + periodStr).slice(0, 80)
  const orderId = crypto.randomUUID()
  const buyerName = (profile?.full_name ?? '').trim().slice(0, 30)
  const buyerEmail = (user.email ?? '').trim().slice(0, 60)

  let error = (await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    plan,
    amount,
    status: 'pending',
    billing_cycle: billingCycle,
  })).error

  if (error) {
    const isColumnMissing = error.code === '42703' || /billing_cycle|column/.test(error.message ?? '')
    if (isColumnMissing) {
      error = (await supabase.from('payments').insert({
        order_id: orderId,
        user_id: user.id,
        plan,
        amount,
        status: 'pending',
      })).error
    }
  }
  if (error) {
    console.error('Payment create error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  return NextResponse.json({
    orderId,
    amount,
    goodsName,
    buyerName: buyerName || undefined,
    buyerEmail: buyerEmail || undefined,
  })
}
