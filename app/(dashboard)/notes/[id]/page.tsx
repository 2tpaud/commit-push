'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthUser } from '@/components/AuthUserProvider'
import { useCommitSheet } from '@/components/CommitSheetProvider'
import { useSidebar } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { MessageCircleMore, X, Calendar, Tag, Link as LinkIcon, ArrowUp, ArrowDown, CircleCheck, Archive, CheckCircle2, Globe, Lock, GitBranch, FileText, ArrowLeft, Copy, Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Note {
  id: string
  title: string
  description: string | null
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
  reference_urls: string[] | null
  related_note_ids: string[] | null
  status: string | null
  is_public: boolean
  share_token: string | null
  commit_count: number
  created_at: string
  updated_at: string
}

interface Commit {
  id: string
  title: string
  message: string | null
  created_at: string
}

interface RelatedNote {
  id: string
  title: string
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  const ampm = hours >= 12 ? '오후' : '오전'
  const displayHours = hours % 12 || 12
  const displayMinutes = minutes.toString().padStart(2, '0')
  
  return `${year}년 ${month}월 ${day}일 ${ampm} ${displayHours}:${displayMinutes}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  return `${year}년 ${month}월 ${day}일`
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  const ampm = hours >= 12 ? '오후' : '오전'
  const displayHours = hours % 12 || 12
  const displayMinutes = minutes.toString().padStart(2, '0')
  
  return `${ampm} ${displayHours}:${displayMinutes}`
}

function formatStatus(status: string | null): string {
  if (!status) return '상태 없음'
  
  const statusMap: Record<string, string> = {
    'active': '활성화',
    'archived': '보관',
    'completed': '완료'
  }
  
  return statusMap[status] || status
}

export default function NoteDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const noteId = params.id as string
  const fromNoteId = searchParams.get('from')
  
  const user = useAuthUser()
  const { isOpen, openSheet, closeSheet, currentNoteId, setCurrentNoteId } = useCommitSheet()
  const { open: isSidebarOpen } = useSidebar()
  const [note, setNote] = useState<Note | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([])
  const [windowWidth, setWindowWidth] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [copied, setCopied] = useState(false)
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [proRequiredOpen, setProRequiredOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setWindowWidth(window.innerWidth)
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setCurrentNoteId(noteId)
  }, [noteId, setCurrentNoteId])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setUserPlan(data?.plan ?? 'free'))
  }, [user?.id])

  useEffect(() => {
    if (!user || !noteId) return

    let cancelled = false

    const loadNote = async () => {
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .eq('user_id', user.id)
        .single()

      if (cancelled) return

      if (noteError || !noteData) {
        console.error('Error loading note:', noteError)
        return
      }

      setNote(noteData as Note)

      const relatedIds = (noteData as Note).related_note_ids
      const [commitsRes, relatedRes] = await Promise.all([
        supabase
          .from('commits')
          .select('id, title, message, created_at')
          .eq('note_id', noteId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        relatedIds && relatedIds.length > 0
          ? supabase
              .from('notes')
              .select('id, title')
              .in('id', relatedIds)
              .eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null } as const),
      ])

      if (cancelled) return

      if (!commitsRes.error && commitsRes.data) setCommits(commitsRes.data as Commit[])
      else setCommits([])

      if (!relatedRes.error && relatedRes.data) setRelatedNotes(relatedRes.data as RelatedNote[])
      else setRelatedNotes([])
    }

    loadNote()

    return () => {
      cancelled = true
    }
  }, [user?.id, noteId])

  useEffect(() => {
    if (!isOpen || !user || !noteId) return

    let cancelled = false

    const loadCommits = async () => {
      const { data, error } = await supabase
        .from('commits')
        .select('id, title, message, created_at')
        .eq('note_id', noteId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (!error && data) {
        setCommits(data as Commit[])
      } else {
        setCommits([])
      }
    }

    loadCommits()

    return () => {
      cancelled = true
    }
  }, [isOpen, user?.id, noteId])

  useEffect(() => {
    if (!isOpen || !user || !currentNoteId || currentNoteId !== noteId) return

    let cancelled = false

    const loadCommits = async () => {
      const { data, error } = await supabase
        .from('commits')
        .select('id, title, message, created_at')
        .eq('note_id', currentNoteId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (!error && data) {
        setCommits(data as Commit[])
      } else {
        setCommits([])
      }
    }

    loadCommits()

    return () => {
      cancelled = true
    }
  }, [isOpen, user?.id, currentNoteId, noteId])

  const containerStyle = useMemo(() => {
    if (windowWidth === 0) {
      return {
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '896px',
      }
    }

    const sidebarWidth = isSidebarOpen ? 256 : 0
    const maxContentWidth = 896
    const sheetWidth = isOpen ? (windowWidth >= 640 ? 384 : windowWidth * 0.75) : 0
    
    const sidebarInsetWidth = windowWidth - sidebarWidth
    const availableWidth = sidebarInsetWidth - sheetWidth
    const centerOffset = Math.max(0, (availableWidth - maxContentWidth) / 2)
    const marginLeft = centerOffset
    const marginRight = sheetWidth + centerOffset
    
    return {
      marginLeft: `${marginLeft}px`,
      marginRight: `${marginRight}px`,
      maxWidth: `${maxContentWidth}px`,
    }
  }, [windowWidth, isSidebarOpen, isOpen])

  const sortedCommits = useMemo(() => {
    const sorted = [...commits].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
    return sorted
  }, [commits, sortOrder])

  if (!note) {
    return (
      <div 
        className="px-4 py-8 transition-all duration-300"
        style={containerStyle}
      >
        <p className="text-center text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  const categoryParts = [
    note.category_large,
    note.category_medium,
    note.category_small,
  ].filter(Boolean)

  return (
    <>
    <div
      className="px-4 py-8 transition-all duration-300"
      style={containerStyle}
    >
        {fromNoteId && (
          <div className="mb-4">
            <Link
              href={`/notes/${fromNoteId}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>이전 노트로 돌아가기</span>
            </Link>
          </div>
        )}
        
        <div className="mb-4 flex items-start justify-between">
          <div className="text-left text-sm text-muted-foreground">
            {categoryParts.length > 0 ? (
              <span>{categoryParts.join(' > ')}</span>
            ) : (
              <span className="text-muted-foreground">카테고리 없음</span>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            최종 수정일 : {formatDateTime(note.updated_at)}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-left text-3xl font-bold text-[#1F2A44]">
            {note.title}
          </h1>
          <Sheet 
            open={isOpen} 
            onOpenChange={(open) => {
              if (open) {
                openSheet()
              }
            }}
            modal={false}
          >
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 rounded-md text-[#1F2A44] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="커밋 내역"
                aria-label={isOpen ? "커밋 내역 닫기" : "커밋 내역 열기"}
                onClick={(e) => {
                  e.preventDefault()
                  if (isOpen) {
                    closeSheet()
                  } else {
                    openSheet()
                  }
                }}
              >
                <MessageCircleMore className="h-5 w-5" aria-hidden />
                <span className="text-xs font-medium">{note.commit_count || 0}</span>
              </button>
            </SheetTrigger>
            <SheetContent 
              side="right"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              className="[&>button]:hidden"
            >
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>커밋 내역</SheetTitle>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      title={sortOrder === 'asc' ? '내림차순 정렬' : '오름차순 정렬'}
                    >
                      {sortOrder === 'desc' ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeSheet}
                      className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-4 overflow-auto">
                {sortedCommits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">커밋 내역이 없습니다.</p>
                ) : (
                  sortedCommits.map((commit) => (
                    <div
                      key={commit.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-[#1F2A44]">
                            {formatDate(commit.created_at)}
                          </span>
                          <h3 className="text-sm font-semibold text-[#1F2A44]">
                            {commit.title}
                          </h3>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTime(commit.created_at)}
                        </span>
                      </div>
                      {commit.message && (
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {commit.message}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mb-3 flex items-center text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>생성일</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <span className="text-foreground">{formatDateTime(note.created_at)}</span>
        </div>

        <div className="mb-3 flex items-start text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>tags</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <div className="flex flex-wrap items-center gap-2">
            {note.tags && note.tags.length > 0 ? (
              note.tags.map((tag, index) => (
                <Badge key={index} variant="outline">
                  #{tag}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground"></span>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-start text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <LinkIcon className="h-4 w-4" />
            <span>참고URL</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <div className="flex flex-wrap gap-2">
            {note.reference_urls && note.reference_urls.length > 0 ? (
              note.reference_urls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {url}
                </a>
              ))
            ) : (
              <span className="text-muted-foreground"></span>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            {note.status === 'active' && <CircleCheck className="h-4 w-4" />}
            {note.status === 'archived' && <Archive className="h-4 w-4" />}
            {note.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
            {(!note.status || !['active', 'archived', 'completed'].includes(note.status)) && <CircleCheck className="h-4 w-4" />}
            <span>상태</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <span className="text-foreground">{formatStatus(note.status)}</span>
        </div>

        <div className="mb-3 flex items-center text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            {note.is_public ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            <span>공유여부</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <Switch
            checked={note.is_public}
            onCheckedChange={async (checked) => {
              if (!user || !noteId) return
              if (checked && (userPlan === 'free' || userPlan === null)) {
                setProRequiredOpen(true)
                return
              }
              let shareToken = note.share_token
              if (checked && !shareToken) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
                shareToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                  .map(x => chars[x % chars.length])
                  .join('')
              } else if (!checked) {
                shareToken = null
              }
              const { error } = await supabase
                .from('notes')
                .update({
                  is_public: checked,
                  share_token: shareToken
                })
                .eq('id', noteId)
                .eq('user_id', user.id)
              if (!error) {
                setNote({ ...note, is_public: checked, share_token: shareToken })
              }
            }}
          />
        </div>

        {note.is_public && note.share_token && (
          <div className="mb-3 flex items-center text-left text-sm">
            <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
              <LinkIcon className="h-4 w-4" />
              <span>공유URL</span>
            </div>
            <span className="mx-3 text-muted-foreground">:</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground break-all">
                {(() => {
                  if (typeof window === 'undefined') return ''
                  const shareDomain = process.env.NEXT_PUBLIC_SHARE_DOMAIN || window.location.origin
                  return `${shareDomain}/notes/shared/${note.share_token}`
                })()}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (typeof window === 'undefined') return
                  const shareDomain = process.env.NEXT_PUBLIC_SHARE_DOMAIN || window.location.origin
                  const shareUrl = `${shareDomain}/notes/shared/${note.share_token}`
                  await navigator.clipboard.writeText(shareUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="링크 복사"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="my-6 border-t border-border"></div>

        <div className="mb-6 whitespace-pre-wrap text-left text-foreground">
          {note.description || ''}
        </div>

        <div className="my-6 border-t border-border"></div>

        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-left">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-[#1F2A44]">
              연관 노트
            </h2>
          </div>
          {relatedNotes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {relatedNotes.map((relatedNote) => (
                <Link
                  key={relatedNote.id}
                  href={`/notes/${relatedNote.id}?from=${noteId}`}
                  className="flex items-center gap-2 text-left text-foreground transition-colors hover:text-[#1F2A44]"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{relatedNote.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">연관 노트가 없습니다.</p>
          )}
        </div>
    </div>

      <AlertDialog open={proRequiredOpen} onOpenChange={setProRequiredOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pro 플랜이 필요합니다</AlertDialogTitle>
            <AlertDialogDescription>
              노트 외부 공유는 Pro 플랜에서 이용할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setProRequiredOpen(false)}
              className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90"
            >
              확인
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Link
                href="/plan"
                onClick={() => setProRequiredOpen(false)}
                className="border border-input bg-background hover:bg-accent"
              >
                요금제 보기
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
