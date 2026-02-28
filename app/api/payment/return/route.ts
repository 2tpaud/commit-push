import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const NICEPAY_API_BASE = process.env.NICE_PAY_API_BASE ?? 'https://sandbox-api.nicepay.co.kr'
const clientId = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID
const secretKey = process.env.NICE_PAY_SECRET_KEY

/** 나이스페이 returnUrl POST는 PG 리다이렉트로 오므로 세션 쿠키가 없을 수 있음. order_id로 결제 조회 후 승인 처리. */
function getSupabaseForReturn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

function getBasicAuth(): string {
  if (!clientId || !secretKey) {
    throw new Error('Missing NicePay keys')
  }
  const credentials = `${clientId}:${secretKey}`
  return Buffer.from(credentials, 'utf8').toString('base64')
}

/**
 * returnUrl 공통 응답: PC/모바일 구분 없이 항상 200 + HTML로 /plan 이동.
 * (성공·취소·실패 모두 동일한 형식으로 응답)
 */
function redirectToPlan(request: Request, path = '/plan', searchParams?: Record<string, string>) {
  const origin = new URL(request.url).origin
  const url = new URL(path, origin)
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const target = url.toString()
  const targetEscaped = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const script = `
    (function(){
      var t = ${JSON.stringify(target)};
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.replace(t);
        } else {
          window.location.replace(t);
        }
      } catch (e) {
        window.location.replace(t);
      }
    })();
  `
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${targetEscaped}"></head><body><p>이동 중...</p><script>${script}</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  return redirectToPlan(request, '/plan', { error: 'cancelled' })
}

export async function POST(request: Request) {
  const fail = (reason: string) => redirectToPlan(request, '/plan', { error: reason })
  const success = () => redirectToPlan(request, '/plan', { success: '1' })

  let form: Record<string, string>
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const raw = await request.text()
    form = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>
  } else {
    form = await request.json().catch(() => ({})) as Record<string, string>
  }

  const authResultCode = String(form.authResultCode ?? '').trim()
  const authResultMsg = String(form.authResultMsg ?? '').trim()
  const tid = form.tid
  const orderId = form.orderId
  const amountStr = form.amount

  // 나이스페이: authResultCode '0000'만 인증 성공. 그 외(사용자 취소·창 닫기 등)는 취소로 통일해 PC 동작과 맞춤
  if (authResultCode !== '0000') {
    return fail('cancelled')
  }
  // 인증 성공이어도 메시지에 취소/실패 문구가 있으면 취소로 간주 (모바일 등)
  if (/취소|cancel|실패|fail|오류|error/i.test(authResultMsg)) {
    return fail('cancelled')
  }
  if (!tid || !orderId || amountStr === undefined) {
    return fail('invalid_callback')
  }

  const amount = parseInt(amountStr, 10)
  if (Number.isNaN(amount) || amount <= 0) {
    return fail('invalid_amount')
  }

  const supabase = getSupabaseForReturn()
  if (!supabase) {
    return fail('config_error')
  }

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, user_id, plan, amount, status, billing_cycle')
    .eq('order_id', orderId)
    .single()

  if (fetchError || !payment) {
    return fail('order_not_found')
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

  const result = await res.json().catch(() => ({})) as {
    resultCode?: string
    status?: string
    paidAt?: string | null
    amount?: number
  }
  const approved =
    result.resultCode === '0000' &&
    result.status === 'paid' &&
    typeof result.paidAt === 'string' &&
    result.paidAt.trim() !== '' &&
    result.paidAt !== '0' &&
    Number(result.amount) === payment.amount
  if (!approved) {
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
    .eq('id', payment.user_id)

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
  const cycleLabel = isAnnual ? '1년' : '1개월'
  try {
    await supabase.from('notifications').insert({
      user_id: payment.user_id,
      type: 'payment_approved',
      payment_id: payment.id,
      title: '결제가 완료되었습니다',
      body: `${planLabel} ${cycleLabel} 구독이 적용되었습니다.`,
    })
  } catch {
    // 알림 실패해도 결제 완료 플로우는 유지
  }

  return success()
}
