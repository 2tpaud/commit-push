'use client'

import * as React from 'react'
import type { User } from '@supabase/supabase-js'

const AuthUserContext = React.createContext<User | null>(null)

export function AuthUserProvider({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>
}

export function useAuthUser() {
  return React.useContext(AuthUserContext)
}

