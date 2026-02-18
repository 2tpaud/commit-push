'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface CommitSheetContextType {
  isOpen: boolean
  openSheet: () => void
  closeSheet: () => void
  currentNoteId: string | null
  setCurrentNoteId: (noteId: string | null) => void
}

const CommitSheetContext = createContext<CommitSheetContextType | undefined>(undefined)

export function CommitSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)

  const openSheet = () => setIsOpen(true)
  const closeSheet = () => setIsOpen(false)

  return (
    <CommitSheetContext.Provider
      value={{
        isOpen,
        openSheet,
        closeSheet,
        currentNoteId,
        setCurrentNoteId,
      }}
    >
      {children}
    </CommitSheetContext.Provider>
  )
}

export function useCommitSheet() {
  const context = useContext(CommitSheetContext)
  if (context === undefined) {
    throw new Error('useCommitSheet must be used within a CommitSheetProvider')
  }
  return context
}
