import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID
const secretKey = process.env.NICE_PAY_SECRET_KEY

/** text/html "OK" 응답 (나이스페이 웹훅 필수) */
function okResponse() {
  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  })
}

function failResponse() {
  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  })
}

/** 웹훅 서명 검증: hex(sha256(tid + amount + ediDate + SecretKey)) */
function verifySignature(tid: string, amount: number, ediDate: string, signature: string): boolean {
  if (!secretKey || !signature) return false
  const payload = `${tid}${amount}${ediDate}${secretKey}`
  const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
  if (hash.length !== signature.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(signature, 'utf8'))
  } catch {
    return false
  }
}

/** 나이스페이 웹훅 URL 등록 시 GET/HEAD/OPTIONS로 검증하는 경우 200 반환 */
export async function GET() {
  return okResponse()
}

export async function HEAD() {
  return okResponse()
}

export async function OPTIONS() {
  return okResponse()
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return okResponse()
  }

  const resultCode = String(body.resultCode ?? '')
  const status = String(body.status ?? '')
  const orderId = String(body.orderId ?? '')
  const tid = String(body.tid ?? '')
  const amount = Number(body.amount ?? 0)
  const ediDate = String(body.ediDate ?? '')
  const signature = String(body.signature ?? '')

  if (resultCode !== '0000' || status !== 'paid' || !orderId || !tid || amount <= 0) {
    return okResponse()
  }

  if (!secretKey || !clientId) {
    return okResponse()
  }

  if (signature && !verifySignature(tid, amount, ediDate, signature)) {
    return failResponse()
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return okResponse()
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    { auth: { persistSession: false } }
  )

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, user_id, plan, amount, status, billing_cycle')
    .eq('order_id', orderId)
    .single()

  if (fetchError || !payment) {
    return okResponse()
  }
  if (payment.amount !== amount) {
    return okResponse()
  }

  if (payment.status !== 'paid') {
    const approvalUrl = `${NICEPAY_API_BASE.replace(/\/$/, '')}/v1/payments/${tid}`
    const credentials = Buffer.from(`${clientId}:${secretKey}`, 'utf8').toString('base64')
    const res = await fetch(approvalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ amount: payment.amount }),
    })
    const result = (await res.json().catch(() => ({}))) as { resultCode?: string; status?: string }
    if (result.resultCode !== '0000' || result.status !== 'paid') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return okResponse()
    }

    const expiresAt = new Date()
    const isAnnual =
      (payment as { billing_cycle?: string }).billing_cycle === 'annual' ||
      payment.amount === 48000 ||
      payment.amount === 67200
    expiresAt.setMonth(expiresAt.getMonth() + (isAnnual ? 12 : 1))

    await supabase
      .from('users')
      .update({
        plan: payment.plan,
        plan_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.user_id)

    await supabase
      .from('payments')
      .update({
        status: 'paid',
        tid,
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
  }

  const planLabel = payment.plan === 'team' ? 'Team' : 'Pro'
  const cycleLabel = payment.amount === 48000 || payment.amount === 67200 ? '1년' : '1개월'
  try {
    await supabase.from('notifications').insert({
      user_id: payment.user_id,
      type: 'payment_approved',
      payment_id: payment.id,
      title: '결제가 완료되었습니다',
      body: `${planLabel} ${cycleLabel} 구독이 적용되었습니다.`,
    })
  } catch {
    // 알림 실패해도 웹훅 응답은 OK 유지
  }

  return okResponse()
}
