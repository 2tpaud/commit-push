'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { CreditCard, LogOut, FilePlus, MessageCircleMore, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import NewNoteDialog from '@/components/NewNoteDialog'
import CommitPushDialog from '@/components/CommitPushDialog'
import { getLimitsForPlan } from '@/lib/planLimits'
import AppSidebar from './AppSidebar'
import { Button } from './ui/button'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Badge } from './ui/badge'
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar'

interface SharedAppLayoutProps {
  user: User
  children: React.ReactNode
}

interface UserProfile {
  avatar_url: string | null
  full_name: string | null
  total_notes: number
  total_commits: number
  plan: string | null
}

/** 플랜명 표시용 (free -> Free, pro -> Pro, team -> Team) */
function getPlanDisplayName(plan: string | null): string {
  const planMap: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    team: 'Team',
  }
  return planMap[plan ?? 'free'] ?? 'Free'
}

/** 사용량 게이지 (드롭다운 메뉴 내부용) */
function UsageGaugesInMenu({ profile }: { profile: UserProfile }) {
  const limits = getLimitsForPlan(profile.plan)
  const notePct = Math.min(100, (profile.total_notes / limits.maxNotes) * 100)
  const commitPct = Math.min(100, (profile.total_commits / limits.maxCommits) * 100)
  const planName = getPlanDisplayName(profile.plan)

  return (
    <div className="px-2 py-1.5">
      <div className="mb-2 flex items-center">
        <Badge variant="outline" className="border-border font-medium text-foreground">
          {planName}
        </Badge>
      </div>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">노트</span>
            <span className="font-medium tabular-nums">
              {profile.total_notes} / {limits.maxNotes}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full border border-border bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1F2A44] transition-all"
              style={{ width: `${notePct}%` }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">커밋</span>
            <span className="font-medium tabular-nums">
              {profile.total_commits} / {limits.maxCommits}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full border border-border bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1F2A44] transition-all"
              style={{ width: `${commitPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 이메일에서 추출한 이니셜 (2자) */
function getInitials(email: string): string {
  const part = email.split('@')[0] || ''
  if (part.length >= 2) return part.slice(0, 2).toUpperCase()
  return part.slice(0, 1).toUpperCase() || '?'
}

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

/** 페이지 이동 시 프로필 재로딩 방지용 캐시 (같은 user.id면 캐시에서 바로 표시) */
const profileCache: Record<string, UserProfile> = {}

/** 프로필 조회 (캐시 갱신) */
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('avatar_url, full_name, total_notes, total_commits, plan')
    .eq('id', userId)
    .single()
  if (error || !data) {
    return {
      avatar_url: null,
      full_name: null,
      total_notes: 0,
      total_commits: 0,
      plan: 'free',
    }
  }
  return {
    avatar_url: data.avatar_url ?? null,
    full_name: data.full_name ?? null,
    total_notes: data.total_notes ?? 0,
    total_commits: data.total_commits ?? 0,
    plan: data.plan ?? 'free',
  }
}

/** 사이드바 + 헤더(CommitPush, 로그아웃)를 공통으로 쓰는 레이아웃. 모든 페이지에서 동일한 사이드바 유지 */
export default function SharedAppLayout({ user, children }: SharedAppLayoutProps) {
  const [profile, setProfile] = useState<UserProfile | null>(() => profileCache[user.id] ?? null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [showCommitPushDialog, setShowCommitPushDialog] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [notificationOpen, setNotificationOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchUserProfile(user.id).then((next) => {
      if (!mounted) return
      setProfile(next)
      profileCache[user.id] = next
    })
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: NotificationRow[]) => {
        if (!mounted) return
        setNotifications(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [user.id])

  const refetchProfile = () => {
    fetchUserProfile(user.id).then((next) => {
      setProfile(next)
      profileCache[user.id] = next
    })
  }

  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabaseClient')
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const displayName = profile?.full_name?.trim() || user.email || ''

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar userId={user.id} />
        <SidebarInset>
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
              <div className="flex w-full items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-xl font-semibold text-card-foreground">
                    <Link
                      href="/"
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <Image
                        src="/commitpush-logo.png"
                        alt="CommitPush"
                        width={42}
                        height={42}
                        className="h-[42px] w-[42px]"
                        priority
                      />
                      <span style={{ color: '#1F2A44' }}>CommitPush</span>
                    </Link>
                  </h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800"
                    onClick={() => setShowCommitPushDialog(true)}
                    title="커밋푸시"
                    aria-label="커밋푸시"
                  >
                    <MessageCircleMore className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800"
                    onClick={() => setShowNewNoteDialog(true)}
                    title="새 노트 생성"
                    aria-label="새 노트 생성"
                  >
                    <FilePlus className="h-5 w-5" />
                  </Button>
                  <DropdownMenu open={notificationOpen} onOpenChange={(open) => {
                    setNotificationOpen(open)
                    if (open) {
                      fetch('/api/notifications')
                        .then((res) => res.ok ? res.json() : [])
                        .then((list: NotificationRow[]) => setNotifications(Array.isArray(list) ? list : []))
                        .catch(() => setNotifications([]))
                    }
                  }}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative shrink-0 text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800"
                        title="알림"
                        aria-label="알림"
                      >
                        <Bell className="h-5 w-5" />
                        {notifications.some((n) => !n.read_at) ? (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1F2A44] text-[10px] font-medium text-white">
                            {notifications.filter((n) => !n.read_at).length}
                          </span>
                        ) : null}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-80 max-h-[min(24rem,70vh)] overflow-y-auto border border-gray-200 bg-white p-0 shadow-md dark:border-gray-700 dark:bg-zinc-900"
                    >
                      <DropdownMenuLabel className="border-b border-border px-3 py-2 text-sm font-medium">
                        알림
                      </DropdownMenuLabel>
                      {notifications.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          알림이 없습니다.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            className="flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                            onSelect={async (e) => {
                              e.preventDefault()
                              if (!n.read_at) {
                                await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
                                setNotifications((prev) =>
                                  prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
                                )
                              }
                              if (n.type === 'payment_approved') {
                                window.location.href = '/plan'
                              }
                            }}
                          >
                            <span className="font-medium text-foreground">{n.title}</span>
                            {n.body ? (
                              <span className="text-xs text-muted-foreground">{n.body}</span>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {new Date(n.created_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="w-56 min-w-[14rem] rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                    <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
                      setDropdownOpen(open)
                      if (open) refetchProfile()
                    }}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex h-auto w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            {profile?.avatar_url ? (
                              <AvatarImage src={profile.avatar_url} alt={displayName} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {getInitials(user.email ?? '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="hidden min-w-0 flex-1 flex-col items-start truncate text-left sm:flex">
                            <span className="truncate text-sm font-medium text-foreground">
                              {profile?.full_name?.trim() || '사용자'}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 min-w-[14rem] border border-gray-200 bg-white p-0 shadow-md dark:border-gray-700 dark:bg-zinc-900"
                      >
                        <DropdownMenuLabel className="p-0">
                          <div className="flex items-center gap-3 px-2 py-1.5">
                            <Avatar className="h-8 w-8 shrink-0">
                              {profile?.avatar_url ? (
                                <AvatarImage src={profile.avatar_url} alt={displayName} />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {getInitials(user.email ?? '')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 flex-col truncate">
                              <span className="block truncate text-sm font-medium">
                                {profile?.full_name?.trim() || '사용자'}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {profile && <UsageGaugesInMenu profile={profile} />}
                        <DropdownMenuItem asChild>
                          <Link href="/plan" className="flex !cursor-default items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Billing
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleLogout}
                          className="!cursor-default text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                        >
                          <LogOut className="h-4 w-4" />
                          Log out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
      <NewNoteDialog
        user={user}
        isOpen={showNewNoteDialog}
        onClose={() => setShowNewNoteDialog(false)}
      />
      <CommitPushDialog
        user={user}
        isOpen={showCommitPushDialog}
        onClose={() => setShowCommitPushDialog(false)}
      />
    </SidebarProvider>
  )
}
