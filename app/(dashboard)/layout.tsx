'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import PageLoadingSkeleton from '@/components/PageLoadingSkeleton'
import SharedAppLayout from '@/components/SharedAppLayout'
import LandingPage from '@/components/LandingPage'
import { AuthUserProvider } from '@/components/AuthUserProvider'
import { CommitSheetProvider } from '@/components/CommitSheetProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const clearEmptyHash = () => {
    if (typeof window === 'undefined') return
    const h = window.location.hash
    if (h === '' || h === '#') {
      const path = window.location.pathname || '/'
      const search = window.location.search || ''
      window.history.replaceState(null, '', path + search)
    }
  }

  useEffect(() => {
    clearEmptyHash()
    const onHashChange = () => clearEmptyHash()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let mounted = true
    const applySession = (s: Session | null) => {
      if (!mounted) return
      const u = s?.user ?? null
      setUser(u)
      setSession(s)
      setLoading(false)
      requestAnimationFrame(() => clearEmptyHash())
      setTimeout(clearEmptyHash, 150)
      if (u?.id && s?.access_token) {
        fetch('/api/plan/check-expiry', {
          headers: { Authorization: `Bearer ${s.access_token}` },
        }).catch(() => { /* ignore */ })
      }
    }
    // 구독 먼저 등록 → 캐시된 세션이 있으면 onAuthStateChange가 먼저 콜백 호출 → 화면 진입 빠름
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const publicPaths = ['/', '/login', '/pricing']
  const isPublicPath = publicPaths.includes(pathname)

  useEffect(() => {
    if (loading) return
    if (!user && !isPublicPath) {
      router.replace('/')
    }
  }, [loading, user, pathname, isPublicPath, router])

  useEffect(() => {
    if (!user) return
    const t = setTimeout(clearEmptyHash, 300)
    return () => clearTimeout(t)
  }, [user])

  if (loading) return <PageLoadingSkeleton />
  if (!user) {
    if (pathname === '/') return <LandingPage />
    if (pathname === '/pricing') return children
    return null
  }

  return (
    <AuthUserProvider user={user} session={session}>
      <CommitSheetProvider>
        <SharedAppLayout user={user}>{children}</SharedAppLayout>
      </CommitSheetProvider>
    </AuthUserProvider>
  )
}
