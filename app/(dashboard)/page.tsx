'use client'

import { useAuthUser } from '@/components/AuthUserProvider'

export default function HomePage() {
  const user = useAuthUser()

  if (!user) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#1F2A44]">노트</h2>
      </div>
      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <h3 className="mb-4 text-xl font-semibold text-[#1F2A44]">환영합니다!</h3>
        <p className="text-[#1F2A44]">{user.email}로 로그인되었습니다.</p>
      </div>
    </div>
  )
}
