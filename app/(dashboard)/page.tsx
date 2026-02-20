'use client'

import { useState } from 'react'
import { useAuthUser } from '@/components/AuthUserProvider'
import NewNoteDialog from '@/components/NewNoteDialog'
import CommitPushDialog from '@/components/CommitPushDialog'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const user = useAuthUser()
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [showCommitPushDialog, setShowCommitPushDialog] = useState(false)

  if (!user) return null

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[#1F2A44]">노트</h2>
          <div className="flex gap-2">
            <Button variant="default" onClick={() => setShowCommitPushDialog(true)}>
              커밋푸시
            </Button>
            <Button variant="default" onClick={() => setShowNewNoteDialog(true)}>
              새 노트 생성
            </Button>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <h3 className="mb-4 text-xl font-semibold text-[#1F2A44]">환영합니다!</h3>
          <p className="text-[#1F2A44]">{user.email}로 로그인되었습니다.</p>
        </div>
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
    </>
  )
}
