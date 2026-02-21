'use client'

import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { PLAN_LIMITS, type PlanId } from '@/lib/planLimits'
import { CreditCard, Zap, Users } from 'lucide-react'

const PLAN_MONTHLY_PRICE: Record<PlanId, number> = {
  free: 0,
  pro: 5000,
  team: 7000,
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

const PLANS: PlanId[] = ['free', 'pro', 'team']

export default function PricingPage() {
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
        <nav className="flex items-center gap-6">
          <Link
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            서비스
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-foreground"
          >
            이용요금
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="border-input"
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
          <p className="mb-8 text-sm text-muted-foreground">
            플랜별 가격과 한도를 확인하세요
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((planId) => {
              const meta = PLAN_META[planId]
              const price = PLAN_MONTHLY_PRICE[planId]
              return (
                <div
                  key={planId}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-2 text-foreground">
                    {meta.icon}
                    <span className="font-semibold">{meta.name}</span>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {meta.description}
                  </p>
                  <p className="mb-4 text-xl font-semibold text-foreground">
                    {price === 0
                      ? '0원/월'
                      : `${price.toLocaleString('ko-KR')}원/월`}
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {meta.features.map((f, i) => (
                      <li key={i}>{f}</li>
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
