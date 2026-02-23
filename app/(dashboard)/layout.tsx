'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
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
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session?.user?.id && session.access_token) {
        try {
          await fetch('/api/plan/check-expiry', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        } catch {
          // ignore
        }
      }
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
      requestAnimationFrame(() => clearEmptyHash())
      setTimeout(clearEmptyHash, 150)
    }
    run()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user?.id && session?.access_token) {
        try {
          await fetch('/api/plan/check-expiry', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        } catch {
          // ignore
        }
      }
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
      requestAnimationFrame(() => clearEmptyHash())
      setTimeout(clearEmptyHash, 150)
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
    <AuthUserProvider user={user}>
      <CommitSheetProvider>
        <SharedAppLayout user={user}>{children}</SharedAppLayout>
      </CommitSheetProvider>
    </AuthUserProvider>
  )
}
