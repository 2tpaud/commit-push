'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import NewNoteDialog from './NewNoteDialog'
import CommitPushDialog from './CommitPushDialog'
import { Button } from './ui/button'

export default function Auth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [showCommitPushDialog, setShowCommitPushDialog] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'consent',
        },
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 rounded-lg border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-semibold text-card-foreground">
            CommitPush에 로그인
          </h1>
          <p className="text-sm text-muted-foreground">
            계속하려면 Google 계정으로 로그인하세요
          </p>
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="flex items-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 로그인
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-card-foreground">
            CommitPush
          </h1>
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
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">
              노트
            </h2>
            <div className="flex gap-2">
              <Button variant="default" asChild>
                <a href="/developer-notes">개발자 노트</a>
              </Button>
              <Button variant="default" asChild>
                <a href="/activity">작업 로그</a>
              </Button>
              <Button variant="default" onClick={() => setShowCommitPushDialog(true)}>
                커밋푸시
              </Button>
              <Button variant="default" onClick={() => setShowNewNoteDialog(true)}>
                새 노트 생성
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-semibold text-card-foreground">
              환영합니다!
            </h3>
            <p className="text-muted-foreground">
              {user.email}로 로그인되었습니다.
            </p>
          </div>
        </div>
      </main>

      {user && (
        <>
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
        </>
      )}
    </div>
  )
}
