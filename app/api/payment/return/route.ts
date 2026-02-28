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

/**
 * 가맹점 결과 페이지(Plan)로 이동하는 HTML 응답.
 * @param status - 취소/실패 시 400을 주면 PG사가 returnUrl 응답을 실패로 기록해, PC(실패 로그)와 모바일 동작을 맞출 수 있음. 성공 시 200.
 */
function redirectToPlan(
  request: Request,
  path = '/plan',
  searchParams?: Record<string, string>,
  status = 200
) {
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
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * GET: 결제창 닫기 등으로 returnUrl에 GET만 오는 경우. 400으로 응답해 PG 로그에 실패로 남기고(PC와 동일), 본문 HTML로 /plan 이동.
 */
export async function GET(request: Request) {
  return redirectToPlan(request, '/plan', { error: 'cancelled' }, 400)
}

export async function POST(request: Request) {
  /** 취소/실패 시 400 응답 → PG사가 returnUrl 호출을 실패로 기록, PC와 동일하게 로그 통일 */
  const fail = (reason: string) => redirectToPlan(request, '/plan', { error: reason }, 400)
  const success = () => redirectToPlan(request, '/plan', { success: '1' }, 200)

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
  const cycleLabel = isAnnual ? '1년' : '1개월'
  try {
    await supabase.from('notifications').insert({
      user_id: user.id,
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
