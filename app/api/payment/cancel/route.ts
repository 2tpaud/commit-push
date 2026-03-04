import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabaseServer'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID
const secretKey = process.env.NICE_PAY_SECRET_KEY

type CancelBody = {
  paymentId?: string
  reason?: string
}

function isWithin24Hours(paidAt: string | null): boolean {
  if (!paidAt) return false
  const paid = new Date(paidAt)
  if (Number.isNaN(paid.getTime())) return false
  return Date.now() - paid.getTime() <= 24 * 60 * 60 * 1000
}

function getBasicAuth(): string {
  if (!clientId || !secretKey) {
    throw new Error('Missing NicePay keys')
  }
  const credentials = `${clientId}:${secretKey}`
  return Buffer.from(credentials, 'utf8').toString('base64')
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CancelBody
  const paymentId = String(body.paymentId ?? '').trim()
  const reason =
    String(body.reason ?? 'user_requested_cancel').trim().slice(0, 100) ||
    'user_requested_cancel'

  if (!paymentId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  if (!clientId || !secretKey) {
    return NextResponse.json({ error: 'config_error' }, { status: 500 })
  }

  let supabase = await createServerSupabase()
  let session = (await supabase.auth.getSession()).data.session
  let user = session?.user

  if (!user) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (
      token &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const {
        data: { user: u },
      } = await client.auth.getUser()
      if (u) {
        user = u
        supabase = client
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, order_id, user_id, amount, status, paid_at, tid')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
  }
  if (payment.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (payment.status === 'cancelled') {
    return NextResponse.json({ error: 'already_processed' }, { status: 400 })
  }
  if (payment.status !== 'paid') {
    return NextResponse.json({ error: 'already_processed' }, { status: 400 })
  }
  if (!isWithin24Hours(payment.paid_at ?? null)) {
    return NextResponse.json({ error: 'cancel_window_expired' }, { status: 400 })
  }
  if (!payment.tid) {
    return NextResponse.json({ error: 'missing_tid' }, { status: 400 })
  }

  // NicePay REST 결제 취소 (v1/payments/{tid}/cancel, Basic 인증)
  const cancelUrl = `${NICEPAY_API_BASE.replace(/\/$/, '')}/v1/payments/${payment.tid}/cancel`

  const cancelRes = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${getBasicAuth()}`,
    },
    body: JSON.stringify({
      orderId: payment.order_id,
      amount: String(payment.amount),
      reason,
    }),
  })

  const raw = (await cancelRes.json().catch(() => ({}))) as Record<string, unknown>
  const result = (raw?.result != null ? raw.result : raw) as {
    resultCode?: string | number
    status?: string
    cancelledAt?: string | number | null
  }

  const resultCode = String(result?.resultCode ?? '')
  const ok = resultCode === '0000'

  if (!ok) {
    console.error('[payment/cancel] pg_cancel_failed', {
      paymentId,
      tid: payment.tid,
      resultCode,
      resStatus: cancelRes.status,
      payload: raw,
    })

    if (cancelRes.status === 401) {
      return NextResponse.json({ error: 'nicepay_auth' }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: 'cancel_failed',
        resultCode,
        pgResult: raw,
      },
      { status: 400 }
    )
  }

  const { error: updatePaymentError } = await supabase
    .from('payments')
    .update({
      status: 'cancelled',
    })
    .eq('id', payment.id)

  if (updatePaymentError) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      plan: 'free',
      plan_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateUserError) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  try {
    const planLabel =
      payment.amount === 67200 || payment.amount === 7000 ? 'Team' : 'Pro'
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'payment_cancelled',
      payment_id: null,
      title: '결제가 취소되었습니다',
      body: `${planLabel} 결제가 취소되어 Free 플랜으로 전환되었습니다.`,
    })
  } catch {
    // 알림 실패는 취소 완료를 롤백하지 않음
  }

  return NextResponse.json({ ok: true })
}
