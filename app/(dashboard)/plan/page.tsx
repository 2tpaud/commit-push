'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, CreditCard, Zap, Users } from 'lucide-react'
import { PLAN_LIMITS, type PlanId } from '@/lib/planLimits'

export { PLAN_LIMITS, type PlanId }

interface UserProfile {
  plan: string | null
  plan_expires_at: string | null
  total_notes: number
  total_commits: number
}

const PLAN_META: Record<
  PlanId,
  { name: string; price: string; description: string; icon: React.ReactNode; features: string[] }
> = {
  free: {
    name: 'Free',
    price: '0원/월',
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
    price: '5,000원/월',
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
    price: '7,000원/월',
    description: '팀 협업과 넉넉한 사용량',
    icon: <Users className="h-5 w-5" />,
    features: [
      `노트 ${PLAN_LIMITS.team.maxNotes}+`,
      `커밋 ${PLAN_LIMITS.team.maxCommits}+`,
      '팀 공동작업 가능',
    ],
  },
}

export default function PlanPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#1F2A44]">요금제</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          현재 플랜과 사용량을 확인하고, 필요 시 업그레이드할 수 있습니다.
        </p>
      </div>

      <div className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-[#1F2A44]">현재 사용량</h2>
        <div className="mb-4 flex flex-wrap items-center gap-6">
          <div>
            <span className="text-sm text-muted-foreground">플랜</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{PLAN_META[currentPlan]?.name ?? currentPlan}</Badge>
              {expiresAt && (
                <span className="text-xs text-muted-foreground">
                  만료: {expiresAt.toLocaleDateString('ko-KR')}
                </span>
              )}
            </div>
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

      <div className="grid gap-6 md:grid-cols-3">
        {(Object.keys(PLAN_META) as PlanId[]).map((planId) => {
          const meta = PLAN_META[planId]
          const isCurrent = currentPlan === planId
          return (
            <div
              key={planId}
              className={`rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                isCurrent ? 'ring-2 ring-[#1F2A44]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#1F2A44]">{meta.icon}<span className="font-semibold">{meta.name}</span></div>
                {isCurrent && <Badge variant="default">현재 플랜</Badge>}
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{meta.price}</p>
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
                <Button variant="outline" className="w-full" disabled>
                  {isCurrent ? '사용 중' : '준비 중'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        결제 연동은 PG사 연동 후 제공될 예정입니다. <Link href="/" className="underline hover:text-foreground">홈으로</Link>
      </p>
    </div>
  )
}
