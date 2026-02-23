'use client'

import * as React from 'react'
import type { User, Session } from '@supabase/supabase-js'

const AuthUserContext = React.createContext<User | null>(null)
const AuthSessionContext = React.createContext<Session | null>(null)

export function AuthUserProvider({
  user,
  session = null,
  children,
}: {
  user: User
  session?: Session | null
  children: React.ReactNode
}) {
  return (
    <AuthSessionContext.Provider value={session}>
      <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>
    </AuthSessionContext.Provider>
  )
}

export function useAuthUser() {
  return React.useContext(AuthUserContext)
}

/** 레이아웃에서 넘긴 세션(access_token 포함). 활동 그래프 등 API 호출 시 getSession() 대기 없이 사용 가능. */
export function useAuthSession() {
  return React.useContext(AuthSessionContext)
}

