'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PLAN_LIMITS, type PlanId } from '@/lib/planLimits'
import { Check, CreditCard, Zap, Users } from 'lucide-react'

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
      'PushMind\n구조 기반 질문에 최적화된 AI',
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
      'PushMind Hybrid\n맥락까지 이해하는 확장형 AI',
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
      'PushMind Hybrid\n맥락까지 이해하는 확장형 AI',
    ],
  },
}

const PLANS: PlanId[] = ['free', 'pro', 'team']

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        queryParams: { prompt: 'consent' },
      },
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/commitpush-logo.png"
            alt="CommitPush"
            width={36}
            height={36}
            className="h-9 w-9"
          />
          <span className="text-lg font-semibold" style={{ color: '#1F2A44' }}>
            CommitPush
          </span>
        </Link>
        <nav className="flex items-center gap-4 md:gap-6">
          <Link
            href="#"
            className="rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ cursor: 'default' }}
          >
            서비스
          </Link>
          <Link
            href="/pricing"
            className="rounded px-2 py-1 text-sm text-foreground transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ cursor: 'default' }}
          >
            이용요금
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="border-input hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handleGoogleLogin}
          >
            로그인
          </Button>
        </nav>
      </header>

      <main className="flex-1 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-2 text-2xl font-semibold text-foreground">
            이용요금
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            플랜별 가격과 한도를 확인하세요
          </p>

          <div className="mb-6 flex justify-end">
            <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'annual')}>
              <TabsList>
                <TabsTrigger value="monthly">월 구독</TabsTrigger>
                <TabsTrigger value="annual">연 구독 <span className="text-primary">20% 할인</span></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((planId) => {
              const meta = PLAN_META[planId]
              return (
                <div
                  key={planId}
                  className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#1F2A44]">
                      {meta.icon}
                      <span className="font-semibold">{meta.name}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatPrice(planId, billingCycle)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {meta.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {meta.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span className="whitespace-pre-line text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <Button
              className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
              onClick={handleGoogleLogin}
            >
              지금 시작하기
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
