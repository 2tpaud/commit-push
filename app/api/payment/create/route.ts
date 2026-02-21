import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_MONTHLY: Record<string, number> = {
  pro: 5000,
  team: 7000,
}

function getAmountAndGoodsName(plan: string, billingCycle: 'monthly' | 'annual') {
  const monthly = PLAN_MONTHLY[plan] ?? 0
  if (billingCycle === 'annual') {
    const annualAmount = Math.round(monthly * 12 * 0.8)
    const goodsName = plan === 'pro' ? 'CommitPush Pro 1년' : 'CommitPush Team 1년'
    return { amount: annualAmount, goodsName }
  }
  const goodsName = plan === 'pro' ? 'CommitPush Pro 1개월' : 'CommitPush Team 1개월'
  return { amount: monthly, goodsName }
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

  const { amount, goodsName } = getAmountAndGoodsName(plan, billingCycle)
  const orderId = crypto.randomUUID()

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
  })
}
