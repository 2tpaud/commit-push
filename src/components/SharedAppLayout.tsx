'use client'

import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import AppSidebar from './AppSidebar'
import { Button } from './ui/button'
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar'

interface SharedAppLayoutProps {
  user: User
  children: React.ReactNode
}

/** 사이드바 + 헤더(CommitPush, 로그아웃)를 공통으로 쓰는 레이아웃. 모든 페이지에서 동일한 사이드바 유지 */
export default function SharedAppLayout({ user, children }: SharedAppLayoutProps) {
  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabaseClient')
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar userId={user.id} />
        <SidebarInset>
          <div className="flex min-h-screen flex-col">
            <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
              <div className="flex w-full items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-xl font-semibold text-card-foreground">
                    <Link href="/" className="hover:opacity-80 transition-opacity">
                      CommitPush
                    </Link>
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                  <Button onClick={handleLogout} variant="default">
                    로그아웃
                  </Button>
                </div>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
