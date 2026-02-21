'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, CreditCard, Zap, Users } from 'lucide-react'
import { PLAN_LIMITS, type PlanId } from '@/lib/planLimits'

const NICE_PAY_SDK_URL =
  typeof process.env.NEXT_PUBLIC_NICE_PAY_SDK_URL !== 'undefined'
    ? process.env.NEXT_PUBLIC_NICE_PAY_SDK_URL
    : 'https://pay.nicepay.co.kr/v1/js/'
const NICE_PAY_CLIENT_ID = process.env.NEXT_PUBLIC_NICE_PAY_CLIENT_ID ?? ''

export { PLAN_LIMITS, type PlanId }

interface UserProfile {
  plan: string | null
  plan_expires_at: string | null
  total_notes: number
  total_commits: number
}

interface PaymentRow {
  paid_at: string | null
  amount: number
  plan: string
  status: string
}

const PLAN_MONTHLY_PRICE: Record<PlanId, number> = {
  free: 0,
  pro: 5000,
  team: 7000,
}

function getAnnualAmount(planId: PlanId): number {
  const monthly = PLAN_MONTHLY_PRICE[planId] ?? 0
  return Math.round(monthly * 12 * 0.8)
}

function formatPrice(planId: PlanId, billingCycle: 'monthly' | 'annual'): React.ReactNode {
  if (planId === 'free') return '0원/월'
  const monthly = PLAN_MONTHLY_PRICE[planId] ?? 0
  if (billingCycle === 'monthly') {
    return `${monthly.toLocaleString('ko-KR')}원/월`
  }
  const annual = getAnnualAmount(planId)
  const monthlyEquivalent = Math.round(monthly * 0.8)
  return (
    <>
      {annual.toLocaleString('ko-KR')}원/년{' '}
      <span className="text-base font-normal text-muted-foreground">(월 {monthlyEquivalent.toLocaleString('ko-KR')}원)</span>
    </>
  )
}

const PLAN_META: Record<
  PlanId,
  { name: string; description: string; icon: React.ReactNode; features: string[] }
> = {
  free: {
    name: 'Free',
    description: '개인 사용을 위한 기본 플랜',
    icon: <CreditCard className="h-5 w-5" />,
    features: [
      `노트 ${PLAN_LIMITS.free.maxNotes}개`,
      `커밋 ${PLAN_LIMITS.free.maxCommits}개`,
      '기본 노트/커밋 관리',
    ],
  },
  pro: {
    name: 'Pro',
    description: '더 많은 노트와 커밋, 노트 외부 공유',
    icon: <Zap className="h-5 w-5" />,
    features: [
      `노트 ${PLAN_LIMITS.pro.maxNotes}개`,
      `커밋 ${PLAN_LIMITS.pro.maxCommits}개`,
      '노트 외부공유 가능',
    ],
  },
  team: {
    name: 'Team',
    description: '팀 협업과 넉넉한 사용량',
    icon: <Users className="h-5 w-5" />,
    features: [
      `노트 ${PLAN_LIMITS.team.maxNotes}+`,
      `커밋 ${PLAN_LIMITS.team.maxCommits}+`,
      '팀 공동작업 가능',
    ],
  },
}

type NicePayMethod = 'cardAndEasyPay' | 'vbank' | 'bank'

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (opts: {
        clientId: string
        method: string
        orderId: string
        amount: number
        goodsName: string
        returnUrl: string
        vbankHolder?: string
        fnError?: (r: { errorMsg?: string }) => void
      }) => void
    }
  }
}

export default function PlanPage() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sdkReady, setSdkReady] = useState(false)
  const [clientIdFromApi, setClientIdFromApi] = useState<string | null>(null)
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null)
  const [cancelPlanDialogOpen, setCancelPlanDialogOpen] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  /** 카드 클릭 시 선택 표시용 (null이면 현재 플랜 카드가 선택된 것처럼 표시) */
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const effectiveClientId = NICE_PAY_CLIENT_ID || clientIdFromApi || ''

  const refetchProfile = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('users')
      .select('plan, plan_expires_at, total_notes, total_commits')
      .eq('id', user.id)
      .single()
    if (!error && data) {
      setProfile({
        plan: data.plan ?? 'free',
        plan_expires_at: data.plan_expires_at ?? null,
        total_notes: data.total_notes ?? 0,
        total_commits: data.total_commits ?? 0,
      })
    }
  }, [user])

  const refetchPayments = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('payments')
      .select('paid_at, amount, plan, status')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setPayments(data as PaymentRow[])
    } else {
      setPayments([])
    }
  }, [user])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === '1') {
      setMessage({ type: 'success', text: '결제가 완료되었습니다. 플랜이 적용되었습니다.' })
      window.history.replaceState({}, '', '/plan')
      refetchProfile()
      refetchPayments()
    } else if (error) {
      const messages: Record<string, string> = {
        auth_failed: '인증에 실패했습니다.',
        invalid_callback: '결제 정보가 올바르지 않습니다.',
        invalid_amount: '결제 금액이 올바르지 않습니다.',
        order_not_found: '주문을 찾을 수 없습니다.',
        amount_mismatch: '결제 금액이 일치하지 않습니다.',
        approval_failed: '승인 처리에 실패했습니다.',
        config_error: '결제 설정을 확인해 주세요.',
        update_failed: '플랜 반영에 실패했습니다.',
        unauthorized: '로그인이 필요합니다.',
        forbidden: '권한이 없습니다.',
      }
      setMessage({ type: 'error', text: messages[error] ?? '결제 처리 중 오류가 발생했습니다.' })
      window.history.replaceState({}, '', '/plan')
    }
  }, [searchParams, refetchProfile, refetchPayments])

  useEffect(() => {
    if (searchParams.get('success') === '1' && user) {
      refetchProfile()
      refetchPayments()
    }
  }, [searchParams, user, refetchProfile, refetchPayments])

  useEffect(() => {
    if (NICE_PAY_CLIENT_ID) return
    fetch('/api/payment/config')
      .then((r) => r.json())
      .then((data: { clientId?: string }) => setClientIdFromApi(data?.clientId ?? null))
      .catch(() => setClientIdFromApi(null))
  }, [])

  const doPaymentWithMethod = useCallback(
    async (planId: PlanId, method: NicePayMethod) => {
      if (planId !== 'pro' && planId !== 'team') return
      if (!effectiveClientId) {
        setMessage({
          type: 'error',
          text: '클라이언트 키가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_NICE_PAY_CLIENT_ID를 넣은 뒤 개발 서버를 재시작해 주세요.',
        })
        return
      }
      setPayingPlan(planId)
      setMessage(null)

      const ensureNicePay = (): Promise<void> => {
        if (typeof window !== 'undefined' && window.AUTHNICE?.requestPay) return Promise.resolve()
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${NICE_PAY_SDK_URL}"]`)) {
            let n = 0
            const t = setInterval(() => {
              if (window.AUTHNICE?.requestPay) { clearInterval(t); resolve() }
              else if (++n > 50) { clearInterval(t); reject(new Error('timeout')) }
            }, 200)
            return
          }
          const script = document.createElement('script')
          script.src = NICE_PAY_SDK_URL
          script.async = true
          script.onload = () => {
            let n = 0
            const t = setInterval(() => {
              if (window.AUTHNICE?.requestPay) { clearInterval(t); resolve() }
              else if (++n > 50) { clearInterval(t); reject(new Error('timeout')) }
            }, 200)
          }
          script.onerror = () => reject(new Error('script load failed'))
          document.body.appendChild(script)
        })
      }

      try {
        await ensureNicePay()
      } catch {
        setMessage({ type: 'error', text: '결제 스크립트를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.' })
        setPayingPlan(null)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMessage({ type: 'error', text: '로그인 세션이 없습니다. 다시 로그인해 주세요.' })
        setPayingPlan(null)
        return
      }

      try {
        const res = await fetch('/api/payment/create', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan: planId, billingCycle }),
        })
        const data = await res.json().catch(() => ({})) as {
          error?: string
          orderId?: string
          amount?: number
          goodsName?: string
        }
        if (!res.ok) {
          const msg = res.status === 401
            ? '로그인 세션이 만료되었을 수 있습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.'
            : (data.error ?? '주문 생성에 실패했습니다.')
          setMessage({ type: 'error', text: msg })
          return
        }
        const { orderId, amount, goodsName } = data
        if (orderId == null || amount == null || goodsName == null) {
          setMessage({ type: 'error', text: '주문 정보를 받지 못했습니다.' })
          return
        }
        const authNice = typeof window !== 'undefined' ? window.AUTHNICE : undefined
        if (!authNice || typeof authNice.requestPay !== 'function') {
          setMessage({ type: 'error', text: '결제 모듈을 불러올 수 없습니다.' })
          return
        }
        const returnUrl = `${window.location.origin}/api/payment/return`
        authNice.requestPay({
          clientId: effectiveClientId,
          method,
          orderId,
          amount,
          goodsName,
          returnUrl,
          ...(method === 'vbank' && { vbankHolder: 'CommitPush' }),
          fnError(result) {
            const msg = result?.errorMsg ?? '결제창 오류가 발생했습니다.'
            setPaymentErrorMsg(msg)
          },
        })
      } catch {
        setMessage({ type: 'error', text: '주문 생성 중 오류가 발생했습니다.' })
      } finally {
        setPayingPlan(null)
      }
    },
    [effectiveClientId, billingCycle]
  )


  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user ?? null
      if (!mounted) return
      setUser(u)
      if (u) {
        const { data, error } = await supabase
          .from('users')
          .select('plan, plan_expires_at, total_notes, total_commits')
          .eq('id', u.id)
          .single()
        if (mounted && !error && data) {
          setProfile({
            plan: data.plan ?? 'free',
            plan_expires_at: data.plan_expires_at ?? null,
            total_notes: data.total_notes ?? 0,
            total_commits: data.total_commits ?? 0,
          })
        } else if (mounted) {
          setProfile({
            plan: 'free',
            plan_expires_at: null,
            total_notes: 0,
            total_commits: 0,
          })
        }
        if (mounted && u) {
          const { data: payData } = await supabase
            .from('payments')
            .select('paid_at, amount, plan, status')
            .eq('user_id', u.id)
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
          if (mounted && payData) setPayments(payData as PaymentRow[])
        }
      }
      setLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg border bg-card" />
          ))}
        </div>
      </div>
    )
  }

  const currentPlan = (profile?.plan ?? 'free') as PlanId
  const limits = PLAN_LIMITS[currentPlan] ?? PLAN_LIMITS.free
  const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const canPay = Boolean(effectiveClientId)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Script
        src={NICE_PAY_SDK_URL}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      {message && (
        <div
          className={`mb-4 rounded-lg border p-4 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-[#1F2A44]">요금제</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 플랜과 사용량을 확인하고, 필요 시 업그레이드할 수 있습니다.
          </p>
        </div>
        <div className="grid min-h-0 gap-6 md:grid-cols-2 md:items-stretch">
          {/* 좌측: 현재 사용량 */}
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 shrink-0 text-lg font-medium text-[#1F2A44]">현재 사용량</h2>
            <div className="mb-4 flex items-start text-left text-sm">
              <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>플랜</span>
              </div>
              <span className="mx-3 text-muted-foreground">:</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{PLAN_META[currentPlan]?.name ?? currentPlan}</Badge>
                {expiresAt && (
                  <span className="text-xs text-muted-foreground">
                    만료: {expiresAt.toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">노트</span>
                  <span className="font-medium tabular-nums">{profile?.total_notes ?? 0} / {limits.maxNotes}</span>
                </div>
                <div className="h-2.5 w-full rounded-full border border-border bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1F2A44] transition-all"
                    style={{ width: `${Math.min(100, ((profile?.total_notes ?? 0) / limits.maxNotes) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">커밋</span>
                  <span className="font-medium tabular-nums">{profile?.total_commits ?? 0} / {limits.maxCommits}</span>
                </div>
                <div className="h-2.5 w-full rounded-full border border-border bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1F2A44] transition-all"
                    style={{ width: `${Math.min(100, ((profile?.total_commits ?? 0) / limits.maxCommits) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 청구 내역 - 사용량 카드와 동일 높이, 길면 스크롤 */}
          <div className="flex min-h-0 flex-col rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 shrink-0 text-lg font-medium text-[#1F2A44]">청구 내역</h2>
            <div className="min-h-0 flex-1 overflow-auto">
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">결제 내역이 없습니다.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[#1F2A44]">승인일</TableHead>
                      <TableHead className="text-[#1F2A44]">금액</TableHead>
                      <TableHead className="text-[#1F2A44]">플랜</TableHead>
                      <TableHead className="text-[#1F2A44]">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {row.paid_at
                            ? new Date(row.paid_at).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.amount != null ? `${Number(row.amount).toLocaleString('ko-KR')}원` : '-'}
                        </TableCell>
                        <TableCell>
                          {PLAN_META[row.plan as PlanId]?.name ?? row.plan}
                        </TableCell>
                        <TableCell>승인</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'annual')}>
          <TabsList>
            <TabsTrigger value="monthly">월 구독</TabsTrigger>
            <TabsTrigger value="annual">연 구독 <span className="text-primary">20% 할인</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {(Object.keys(PLAN_META) as PlanId[]).map((planId) => {
          const meta = PLAN_META[planId]
          const isCurrent = currentPlan === planId
          const isSelected = (selectedPlanId ?? currentPlan) === planId
          return (
            <div
              key={planId}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPlanId(planId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlanId(planId) } }}
              className={`cursor-default rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                isSelected ? 'ring-2 ring-[#1F2A44]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#1F2A44]">{meta.icon}<span className="font-semibold">{meta.name}</span></div>
                {isCurrent && <Badge variant="outline">현재 플랜</Badge>}
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPrice(planId, billingCycle)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
              <ul className="mt-4 space-y-2">
                {meta.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  (planId === 'pro' || planId === 'team') ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setCancelPlanDialogOpen(true)}
                    >
                      구독 취소
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      사용 중
                    </Button>
                  )
                ) : (planId === 'pro' || planId === 'team') ? (
                  <Button
                    variant="outline"
                    className="w-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    disabled={!canPay || payingPlan !== null}
                    onClick={() => doPaymentWithMethod(planId, 'cardAndEasyPay')}
                  >
                    {payingPlan === planId ? '결제창 열기 중…' : '결제하기'}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    현재 플랜
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline hover:text-foreground">홈으로</Link>
      </p>

      <AlertDialog open={!!paymentErrorMsg} onOpenChange={(open) => !open && setPaymentErrorMsg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결제 오류</AlertDialogTitle>
            <AlertDialogDescription>{paymentErrorMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setPaymentErrorMsg(null)}
              className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelPlanDialogOpen} onOpenChange={(open) => !open && setCancelPlanDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>구독 취소</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  현재 사용 중인 플랜: <strong>{PLAN_META[currentPlan]?.name ?? currentPlan}</strong>
                </p>
                {expiresAt && (
                  <p>
                    만료일: <strong>{expiresAt.toLocaleDateString('ko-KR')}</strong>
                  </p>
                )}
                <p className="text-muted-foreground">
                  구독 취소 시 만료일({expiresAt ? expiresAt.toLocaleDateString('ko-KR') : '-'})까지 사용 가능하며, 만료일 이후에는 Free 플랜으로 전환됩니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setCancelPlanDialogOpen(false)}
              className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
