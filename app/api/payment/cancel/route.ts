import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerSupabase } from '@/lib/supabaseServer'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const NICEPAY_CANCEL_API_URL = process.env.NICE_PAY_CANCEL_API_URL
const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID
const secretKey = process.env.NICE_PAY_SECRET_KEY
const mid = process.env.NICE_PAY_MID ?? process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID

type CancelBody = {
  paymentId?: string
  reason?: string
}

function getEdiDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

function isWithin24Hours(paidAt: string | null): boolean {
  if (!paidAt) return false
  const paid = new Date(paidAt)
  if (Number.isNaN(paid.getTime())) return false
  return Date.now() - paid.getTime() <= 24 * 60 * 60 * 1000
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CancelBody
  const paymentId = String(body.paymentId ?? '').trim()
  const reason = String(body.reason ?? 'user_requested_cancel').trim().slice(0, 100) || 'user_requested_cancel'

  if (!paymentId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  if (!mid || !secretKey || !clientId) {
    return NextResponse.json({ error: 'config_error' }, { status: 500 })
  }

  const supabase = await createServerSupabase()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
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

  const ediDate = getEdiDate()
  const cancelAmt = String(payment.amount)
  const signData = crypto.createHash('sha256').update(`${mid}${cancelAmt}${ediDate}${secretKey}`, 'utf8').digest('hex')
  const cancelUrl = NICEPAY_CANCEL_API_URL ?? `${NICEPAY_API_BASE.replace(/\/$/, '')}/webapi/cancel_process.jsp`

  const form = new URLSearchParams({
    TID: payment.tid,
    MID: mid,
    Moid: payment.order_id,
    CancelAmt: cancelAmt,
    CancelMsg: reason,
    PartialCancelCode: '0',
    EdiDate: ediDate,
    SignData: signData,
    CharSet: 'utf-8',
    EdiType: 'JSON',
  })

  const cancelRes = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${secretKey}`, 'utf8').toString('base64')}`,
    },
    body: form.toString(),
  })

  const text = await cancelRes.text()
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(text) as Record<string, unknown>
  } catch {
    payload = Object.fromEntries(new URLSearchParams(text))
  }

  const code = String(payload.ResultCode ?? payload.resultCode ?? payload.resultCd ?? '')
  const ok = code === '2001' || code === '0000'
  if (!ok) {
    return NextResponse.json(
      {
        error: 'cancel_failed',
        resultMsg: String(payload.ResultMsg ?? payload.resultMsg ?? payload.resultCd ?? '결제 취소에 실패했습니다.'),
        pgResult: payload,
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
    const planLabel = payment.amount === 67200 || payment.amount === 7000 ? 'Team' : 'Pro'
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
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const NICEPAY_CANCEL_API_URL =
  process.env.NICE_PAY_CANCEL_API_URL ??
  `${NICEPAY_API_BASE.replace(/\/$/, '')}/webapi/cancel_process.jsp`
const NICEPAY_MID = process.env.NICE_PAY_MID
const NICEPAY_SECRET_KEY = process.env.NICE_PAY_SECRET_KEY

function getEdiDate(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`
}

function within24Hours(paidAt: string): boolean {
  const paid = new Date(paidAt).getTime()
  if (Number.isNaN(paid)) return false
  return Date.now() - paid <= 24 * 60 * 60 * 1000
}

function parseCancelResponse(raw: string): { resultCode: string; resultMsg: string } {
  try {
    const json = JSON.parse(raw) as Record<string, unknown>
    return {
      resultCode: String(json.ResultCode ?? json.resultCode ?? ''),
      resultMsg: String(json.ResultMsg ?? json.resultMsg ?? ''),
    }
  } catch {
    const params = new URLSearchParams(raw)
    return {
      resultCode: String(params.get('ResultCode') ?? ''),
      resultMsg: String(params.get('ResultMsg') ?? ''),
    }
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { paymentId?: string }
  const paymentId = String(body.paymentId ?? '').trim()
  if (!paymentId) {
    return NextResponse.json({ error: 'invalid_payment' }, { status: 400 })
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, user_id, order_id, amount, status, tid, paid_at, plan')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
  }
  if (payment.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (payment.status !== 'paid') {
    return NextResponse.json({ error: 'already_processed' }, { status: 400 })
  }
  if (!payment.paid_at || !within24Hours(payment.paid_at)) {
    return NextResponse.json({ error: 'cancel_window_expired' }, { status: 400 })
  }
  if (!payment.tid) {
    return NextResponse.json({ error: 'missing_tid' }, { status: 400 })
  }
  if (!NICEPAY_MID || !NICEPAY_SECRET_KEY) {
    return NextResponse.json({ error: 'config_error' }, { status: 500 })
  }

  const cancelAmt = String(payment.amount)
  const ediDate = getEdiDate()
  const signData = crypto
    .createHash('sha256')
    .update(`${NICEPAY_MID}${cancelAmt}${ediDate}${NICEPAY_SECRET_KEY}`, 'utf8')
    .digest('hex')

  const form = new URLSearchParams({
    TID: payment.tid,
    MID: NICEPAY_MID,
    Moid: payment.order_id,
    CancelAmt: cancelAmt,
    CancelMsg: 'USER_REQUEST',
    PartialCancelCode: '0',
    EdiDate: ediDate,
    SignData: signData,
    EdiType: 'JSON',
    CharSet: 'utf-8',
  })

  const cancelRes = await fetch(NICEPAY_CANCEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: form.toString(),
  })

  const rawText = await cancelRes.text()
  const { resultCode, resultMsg } = parseCancelResponse(rawText)
  if (resultCode !== '2001') {
    return NextResponse.json(
      { error: 'cancel_failed', resultCode, resultMsg: resultMsg || '취소 처리에 실패했습니다.' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const { error: updatePaymentError } = await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('id', payment.id)

  if (updatePaymentError) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // 현재 플랜이 취소 대상 결제로 반영된 상태라면 즉시 free로 되돌린다.
  const { data: userRow } = await supabase.from('users').select('plan').eq('id', user.id).single()
  if (userRow?.plan === payment.plan) {
    await supabase
      .from('users')
      .update({
        plan: 'free',
        plan_expires_at: null,
        updated_at: now,
      })
      .eq('id', user.id)
  }

  return NextResponse.json({ ok: true })
}
