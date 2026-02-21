'use client'

import { useAuthUser } from '@/components/AuthUserProvider'
import { ContributionGraph } from '@/components/ContributionGraph'

export default function HomePage() {
  const user = useAuthUser()

  if (!user) return null

  return <ContributionGraph />
}
