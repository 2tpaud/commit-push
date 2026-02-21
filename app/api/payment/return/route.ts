import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID
const secretKey = process.env.NICE_PAY_SECRET_KEY

function getBasicAuth(): string {
  if (!clientId || !secretKey) {
    throw new Error('Missing NicePay keys')
  }
  const credentials = `${clientId}:${secretKey}`
  return Buffer.from(credentials, 'utf8').toString('base64')
}

export async function POST(request: Request) {
  const planPageUrl = new URL('/plan', request.url)
  const fail = (reason: string) => {
    planPageUrl.searchParams.set('error', reason)
    return NextResponse.redirect(planPageUrl.toString())
  }
  const success = () => {
    planPageUrl.searchParams.set('success', '1')
    return NextResponse.redirect(planPageUrl.toString())
  }

  let form: Record<string, string>
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const raw = await request.text()
    form = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>
  } else {
    form = await request.json().catch(() => ({})) as Record<string, string>
  }

  const authResultCode = form.authResultCode
  const tid = form.tid
  const orderId = form.orderId
  const amountStr = form.amount

  if (authResultCode !== '0000') {
    return fail('auth_failed')
  }
  if (!tid || !orderId || amountStr === undefined) {
    return fail('invalid_callback')
  }

  const amount = parseInt(amountStr, 10)
  if (Number.isNaN(amount) || amount <= 0) {
    return fail('invalid_amount')
  }

  const supabase = await createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) {
    return fail('unauthorized')
  }

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, user_id, plan, amount, status, billing_cycle')
    .eq('order_id', orderId)
    .single()

  if (fetchError || !payment) {
    return fail('order_not_found')
  }
  if (payment.user_id !== user.id) {
    return fail('forbidden')
  }
  if (payment.amount !== amount) {
    return fail('amount_mismatch')
  }
  if (payment.status === 'paid') {
    return success()
  }

  if (!clientId || !secretKey) {
    return fail('config_error')
  }

  const approvalUrl = `${NICEPAY_API_BASE.replace(/\/$/, '')}/v1/payments/${tid}`
  const res = await fetch(approvalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${getBasicAuth()}`,
    },
    body: JSON.stringify({ amount: payment.amount }),
  })

  const result = await res.json().catch(() => ({})) as { resultCode?: string; status?: string }
  if (result.resultCode !== '0000' || result.status !== 'paid') {
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)
    return fail('approval_failed')
  }

  const expiresAt = new Date()
  const isAnnual =
    (payment as { billing_cycle?: string })?.billing_cycle === 'annual' ||
    payment.amount === 48000 ||
    payment.amount === 67200
  expiresAt.setMonth(expiresAt.getMonth() + (isAnnual ? 12 : 1))

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      plan: payment.plan,
      plan_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateUserError) {
    console.error('Update user plan error:', updateUserError)
    return fail('update_failed')
  }

  await supabase
    .from('payments')
    .update({
      status: 'paid',
      tid,
      paid_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  const planLabel = payment.plan === 'team' ? 'Team' : 'Pro'
  const isAnnual =
    (payment as { billing_cycle?: string })?.billing_cycle === 'annual' ||
    payment.amount === 48000 ||
    payment.amount === 67200
  const cycleLabel = isAnnual ? '1년' : '1개월'
  await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'payment_approved',
    payment_id: payment.id,
    title: '결제가 완료되었습니다',
    body: `${planLabel} ${cycleLabel} 구독이 적용되었습니다.`,
  }).then(() => {}).catch(() => {})

  return success()
}
