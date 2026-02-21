'use client'

import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
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
            priority
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
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mx-auto max-w-[520px] space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              <span className="block whitespace-nowrap">"당신의 작업을 커밋처럼 기록하고,</span>
              <span className="mt-2 block whitespace-nowrap">당신의 실행력을 시각화하는 시스템"</span>
            </h1>
            <p className="text-base text-muted-foreground">
              생각과 업무를 버전관리하는 시스템을 지향합니다
            </p>
          </div>
          <Button
            size="lg"
            className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
            onClick={handleGoogleLogin}
          >
            지금 시작하기
          </Button>
        </div>
      </main>
    </div>
  )
}
