'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthUser } from '@/components/AuthUserProvider'
import { useCommitSheet } from '@/components/CommitSheetProvider'
import { recordNoteOpened, notifySidebarNotesRefresh } from '@/lib/sidebarRecentOpened'
import { useSidebar } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import CommitPushDialog from '@/components/CommitPushDialog'
import RelatedNoteSearchDialog from '@/components/RelatedNoteSearchDialog'
import RichTextEditor from '@/components/RichTextEditor'
import { MessageCircleMore, X, Calendar, Tag, Link as LinkIcon, ArrowUp, ArrowDown, CircleCheck, Archive, CheckCircle2, Globe, Lock, GitBranch, FileText, ArrowLeft, Copy, Check, Paperclip, List, FolderTree, ChevronRight, Plus, Edit, ChevronLeft } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { remarkHighlightMark } from 'remark-highlight-mark'
import { remarkRehypeOptions, proseBlockquoteHrAlign } from '@/lib/markdownProse'

/** p를 div로 렌더링하여 <div> inside <p> hydration 오류 방지 */
const markdownComponents = { p: ({ children }: { children?: React.ReactNode }) => <div className="my-1 first:mt-0 last:mb-0">{children}</div> }

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

interface CommitAttachment {
  name: string
  web_view_link: string
}

interface Commit {
  id: string
  title: string
  message: string | null
  created_at: string
  attachments?: CommitAttachment[] | null
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

/** datetime-local input용 문자열 (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(dateString: string): string {
  const d = new Date(dateString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export default function NoteDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawId = params?.id
  const noteId = (typeof rawId === 'string' ? rawId : rawId?.[0] ?? '') || ''
  const fromNoteId = searchParams?.get('from') ?? null
  const openCommitId = searchParams?.get('openCommit') ?? null

  const user = useAuthUser()
  const { isOpen, openSheet, closeSheet, currentNoteId, setCurrentNoteId, commitSheetExpanded, setCommitSheetExpanded } = useCommitSheet()
  const { open: isSidebarOpen } = useSidebar()
  const [note, setNote] = useState<Note | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([])
  const [windowWidth, setWindowWidth] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [commitViewMode, setCommitViewMode] = useState<'list' | 'tree'>('tree')
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({})
  const [expandedYearMonths, setExpandedYearMonths] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [proRequiredOpen, setProRequiredOpen] = useState(false)
  const [highlightedCommitId, setHighlightedCommitId] = useState<string | null>(null)
  const [showCommitPushDialog, setShowCommitPushDialog] = useState(false)
  const [editingCommitId, setEditingCommitId] = useState<string | null>(null)
  const [editingMetaField, setEditingMetaField] = useState<'created_at' | 'tags' | 'reference_urls' | 'status' | 'description' | null>(null)
  const [editingTags, setEditingTags] = useState<string[]>([])
  const [editingTagInput, setEditingTagInput] = useState('')
  const [editingUrls, setEditingUrls] = useState<string[]>([])
  const [editingUrlInput, setEditingUrlInput] = useState('')
  const [editingDescriptionOriginal, setEditingDescriptionOriginal] = useState<string>('')
  const metaEditRef = useRef<HTMLDivElement>(null)

  const [showRelatedNoteDialog, setShowRelatedNoteDialog] = useState(false)

  useEffect(() => {
    if (editingMetaField !== 'tags' && editingMetaField !== 'reference_urls' && editingMetaField !== 'description') return
    const handleClickOutside = (e: MouseEvent) => {
      if (metaEditRef.current && !metaEditRef.current.contains(e.target as Node)) {
        setEditingMetaField(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingMetaField])

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
    if (openCommitId && noteId) {
      openSheet()
      setHighlightedCommitId(openCommitId)
    }
  }, [openCommitId, noteId, openSheet])

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
      recordNoteOpened(noteId)

      const relatedIds = (noteData as Note).related_note_ids
      const [commitsRes, relatedRes] = await Promise.all([
        supabase
          .from('commits')
          .select('id, title, message, created_at, attachments')
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
        .select('id, title, message, created_at, attachments')
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
        .select('id, title, message, created_at, attachments')
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

  const { containerStyle, commitSheetWidth } = useMemo(() => {
    if (windowWidth === 0) {
      return {
        containerStyle: {
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: '896px',
        } as React.CSSProperties,
        commitSheetWidth: 0,
      }
    }

    const sidebarWidth = isSidebarOpen ? 256 : 0
    const maxContentWidth = 896
    const sidebarInsetWidth = windowWidth - sidebarWidth
    const minSheetWidth = windowWidth >= 640 ? 384 : windowWidth * 0.75
    const maxSheetWidth = Math.floor(sidebarInsetWidth / 3)
    const sheetWidth = isOpen
      ? (commitSheetExpanded ? maxSheetWidth : minSheetWidth)
      : 0

    const availableWidth = sidebarInsetWidth - sheetWidth
    const centerOffset = Math.max(0, (availableWidth - maxContentWidth) / 2)
    const marginLeft = centerOffset
    const marginRight = sheetWidth + centerOffset

    return {
      containerStyle: {
        marginLeft: `${marginLeft}px`,
        marginRight: `${marginRight}px`,
        maxWidth: `${maxContentWidth}px`,
      },
      commitSheetWidth: sheetWidth,
    }
  }, [windowWidth, isSidebarOpen, isOpen, commitSheetExpanded])

  const sortedCommits = useMemo(() => {
    const sorted = [...commits].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
    return sorted
  }, [commits, sortOrder])

  /** 트리 뷰: 년 > 월 계층 구조. sortOrder에 따라 년·월 순서 결정 */
  const commitsByYearMonth = useMemo(() => {
    const byYear = new Map<number, Map<number, Commit[]>>()
    for (const c of sortedCommits) {
      const d = new Date(c.created_at)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      if (!byYear.has(y)) byYear.set(y, new Map())
      const monthMap = byYear.get(y)!
      const arr = monthMap.get(m) ?? []
      arr.push(c)
      monthMap.set(m, arr)
    }
    const years = Array.from(byYear.keys()).sort((a, b) =>
      sortOrder === 'desc' ? b - a : a - b
    )
    return years.map((year) => {
      const monthMap = byYear.get(year)!
      const months = Array.from(monthMap.entries())
        .map(([month, commits]) => ({ month, commits }))
        .sort((a, b) => (sortOrder === 'desc' ? b.month - a.month : a.month - b.month))
      return { year, months }
    })
  }, [sortedCommits, sortOrder])

  useEffect(() => {
    if (!isOpen || !highlightedCommitId || !sortedCommits.some((c) => c.id === highlightedCommitId)) return
    const el = document.getElementById(`commit-${highlightedCommitId}`)
    if (el) {
      const t = setTimeout(() => {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [isOpen, highlightedCommitId, sortedCommits])

  useEffect(() => {
    if (!highlightedCommitId) return
    const t = setTimeout(() => {
      setHighlightedCommitId(null)
      if (openCommitId && typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('openCommit')
        router.replace(url.pathname + url.search, { scroll: false })
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [highlightedCommitId, openCommitId, router])

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
              } else if (!showCommitPushDialog) {
                closeSheet()
              }
            }}
            modal={false}
          >
            <SheetTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center gap-1 rounded-md text-[#1F2A44] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                </TooltipTrigger>
                <TooltipContent>커밋 내역</TooltipContent>
              </Tooltip>
            </SheetTrigger>
            <SheetContent 
              side="right"
              onEscapeKeyDown={(e) => e.preventDefault()}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => {
                if ((e.target as HTMLElement).closest?.('[data-keep-sheet-open]')) e.preventDefault()
              }}
              className="[&>button]:hidden"
              style={commitSheetWidth > 0 ? { width: `${commitSheetWidth}px`, maxWidth: 'none' } : undefined}
            >
              <SheetHeader className="border-b border-border pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TooltipProvider delayDuration={600}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setCommitSheetExpanded((p) => !p)}
                            className="flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            aria-label={commitSheetExpanded ? '축소' : '확대'}
                          >
                            {commitSheetExpanded ? (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronLeft className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{commitSheetExpanded ? '최소 범위로 축소' : '최대 범위로 확대'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <SheetTitle>커밋 내역</SheetTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider delayDuration={600}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                          type="button"
                          onClick={() => {
                            setEditingCommitId(null)
                            setShowCommitPushDialog(true)
                          }}
                          className="flex items-center gap-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          aria-label="커밋 추가"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>커밋 추가</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setCommitViewMode('tree')}
                            className={`flex items-center gap-1 rounded-sm ring-offset-background transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                              commitViewMode === 'tree' ? 'opacity-100 text-[#1F2A44]' : 'opacity-70 hover:opacity-100'
                            }`}
                            aria-label="트리 뷰"
                          >
                            <FolderTree className="h-4 w-4" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>트리 뷰</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setCommitViewMode('list')}
                            className={`flex items-center gap-1 rounded-sm ring-offset-background transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                              commitViewMode === 'list' ? 'opacity-100 text-[#1F2A44]' : 'opacity-70 hover:opacity-100'
                            }`}
                            aria-label="목록 뷰"
                          >
                            <List className="h-4 w-4" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>목록 뷰</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            {sortOrder === 'desc' ? (
                              <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUp className="h-4 w-4" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{sortOrder === 'asc' ? '내림차순 정렬' : '오름차순 정렬'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

              <div className="mt-4 space-y-4 overflow-auto">
                {sortedCommits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">커밋 내역이 없습니다.</p>
                ) : commitViewMode === 'list' ? (
                  sortedCommits.map((commit) => (
                    <button
                      key={commit.id}
                      type="button"
                      id={`commit-${commit.id}`}
                      onClick={() => {
                        setEditingCommitId(commit.id)
                        setShowCommitPushDialog(true)
                      }}
                      className={`group/card w-full rounded-lg border p-4 text-left transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-gray-800 ${
                        highlightedCommitId === commit.id
                          ? 'border-[#1F2A44] bg-[#1F2A44]/10 ring-2 ring-[#1F2A44] ring-offset-2 shadow-md'
                          : 'border-border bg-card'
                      }`}
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
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {formatTime(commit.created_at)}
                          <Edit className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover/card:opacity-70" aria-hidden />
                        </span>
                      </div>
                      {commit.message && (
                        <div className={`commit-message-prose text-sm text-foreground ${proseBlockquoteHrAlign} [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:mt-2 [&_h1]:mt-0 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:no-underline [&_mark]:rounded [&_mark]:px-0.5 [&_mark]:py-0.5 [&_mark]:bg-yellow-200/70 dark:[&_mark]:bg-yellow-500/30`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlightMark]} rehypePlugins={[rehypeRaw]} remarkRehypeOptions={remarkRehypeOptions} components={markdownComponents}>{commit.message}</ReactMarkdown>
                        </div>
                      )}
                      {commit.attachments && commit.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          {commit.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.web_view_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {att.name || '첨부파일'}
                            </a>
                          ))}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  commitsByYearMonth.map(({ year, months }) => {
                    const yearKey = String(year)
                    const yearOpen = expandedYears[yearKey] ?? true
                    return (
                      <div key={year} className="space-y-3">
                        <h3 className="sticky top-0 z-10 bg-background/95 py-1 text-sm font-semibold text-[#1F2A44]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedYears((prev) => ({
                                ...prev,
                                [yearKey]: !(prev[yearKey] ?? true),
                              }))
                            }
                            className="flex w-full items-center justify-between gap-2 rounded-md px-1 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="flex items-center gap-1.5">
                              <ChevronRight
                                className={`h-3.5 w-3.5 shrink-0 transition-transform ${yearOpen ? 'rotate-90' : ''}`}
                                aria-hidden
                              />
                              <span>{year}년</span>
                            </span>
                          </button>
                        </h3>
                        {yearOpen && (
                          <div className="space-y-4 border-l border-border pl-3">
                            {months.map(({ month, commits: monthCommits }) => {
                              const ymKey = `${year}-${month}`
                              const monthOpen = expandedYearMonths[ymKey] ?? true
                              return (
                                <div key={ymKey} className="space-y-2 pl-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedYearMonths((prev) => ({
                                        ...prev,
                                        [ymKey]: !(prev[ymKey] ?? true),
                                      }))
                                    }
                                    className="flex items-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <ChevronRight
                                      className={`h-3 w-3 shrink-0 transition-transform ${monthOpen ? 'rotate-90' : ''}`}
                                      aria-hidden
                                    />
                                    <span>{month}월</span>
                                  </button>
                                  {monthOpen && (
                                    <div className="space-y-3">
                                      {monthCommits.map((commit) => (
                                        <button
                                          key={commit.id}
                                          type="button"
                                          id={`commit-${commit.id}`}
                                          onClick={() => {
                                            setEditingCommitId(commit.id)
                                            setShowCommitPushDialog(true)
                                          }}
                                          className={`group/card w-full rounded-lg border p-4 text-left transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-gray-800 ${
                                            highlightedCommitId === commit.id
                                              ? 'border-[#1F2A44] bg-[#1F2A44]/10 ring-2 ring-[#1F2A44] ring-offset-2 shadow-md'
                                              : 'border-border bg-card'
                                          }`}
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
                                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                              {formatTime(commit.created_at)}
                                              <Edit className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover/card:opacity-70" aria-hidden />
                                            </span>
                                          </div>
                                          {commit.message && (
                                            <div className={`commit-message-prose text-sm text-foreground ${proseBlockquoteHrAlign} [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:mt-2 [&_h1]:mt-0 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:no-underline [&_mark]:rounded [&_mark]:px-0.5 [&_mark]:py-0.5 [&_mark]:bg-yellow-200/70 dark:[&_mark]:bg-yellow-500/30`}>
                                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlightMark]} rehypePlugins={[rehypeRaw]} remarkRehypeOptions={remarkRehypeOptions} components={markdownComponents}>{commit.message}</ReactMarkdown>
                                            </div>
                                          )}
                                          {commit.attachments && commit.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                              {commit.attachments.map((att, idx) => (
                                                <a
                                                  key={idx}
                                                  href={att.web_view_link}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-sm text-blue-600 hover:underline"
                                                >
                                                  {att.name || '첨부파일'}
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mb-2 flex items-center text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>생성일</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <div
            className={`group flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 transition-colors ${editingMetaField !== 'created_at' ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80' : ''}`}
            onClick={() => setEditingMetaField('created_at')}
          >
            {editingMetaField === 'created_at' ? (
              <Input
                type="datetime-local"
                defaultValue={toDatetimeLocal(note.created_at)}
                className="h-8 max-w-[220px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingMetaField(null)
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                onBlur={async (e) => {
                  const val = e.target.value
                  setEditingMetaField(null)
                  if (!val || !user || !noteId) return
                  const iso = new Date(val).toISOString()
                  const { error } = await supabase.from('notes').update({ created_at: iso }).eq('id', noteId).eq('user_id', user.id)
                  if (!error) {
                    setNote({ ...note, created_at: iso })
                    notifySidebarNotesRefresh()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-foreground">{formatDateTime(note.created_at)}</span>
            )}
          </div>
        </div>

        <div className="mb-2 flex items-start text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>tags</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <div
            ref={editingMetaField === 'tags' ? metaEditRef : undefined}
            className={`group flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded px-1 py-0.5 transition-colors ${editingMetaField !== 'tags' ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80' : ''}`}
            onClick={() => {
              if (editingMetaField !== 'tags') {
                setEditingTags(note.tags ? [...note.tags] : [])
                setEditingTagInput('')
                setEditingMetaField('tags')
              }
            }}
          >
            {editingMetaField === 'tags' ? (
              <div
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {editingTags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="gap-1 pr-1">
                    #{tag}
                    <button type="button" onClick={() => setEditingTags((p) => p.filter((_, j) => j !== i))} className="rounded hover:bg-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  placeholder="태그 입력 (콤마로 구분, Enter 저장)"
                  value={editingTagInput}
                  onChange={(e) => setEditingTagInput(e.target.value)}
                  className="h-7 min-w-[400px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setEditingMetaField(null)
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const parts = editingTagInput.split(',').map((s) => s.trim()).filter(Boolean)
                      const newTags = [...editingTags]
                      for (const t of parts) {
                        if (t && !newTags.includes(t)) newTags.push(t)
                      }
                      setEditingTagInput('')
                      if (!user || !noteId) return
                      supabase.from('notes').update({ tags: newTags }).eq('id', noteId).eq('user_id', user.id).then(({ error }) => {
                        if (!error) {
                          setNote({ ...note, tags: newTags })
                          setEditingMetaField(null)
                          notifySidebarNotesRefresh()
                        }
                      })
                      return
                    }
                    if (e.key === ',') {
                      e.preventDefault()
                      const parts = editingTagInput.split(',').map((s) => s.trim()).filter(Boolean)
                      setEditingTags((p) => {
                        const next = [...p]
                        for (const t of parts) {
                          if (t && !next.includes(t)) next.push(t)
                        }
                        return next
                      })
                      setEditingTagInput('')
                    }
                  }}
                />
              </div>
            ) : (
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
            )}
          </div>
        </div>

        <div
          ref={editingMetaField === 'reference_urls' ? metaEditRef : undefined}
          className="mb-2 flex items-start text-left text-sm"
        >
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            <LinkIcon className="h-4 w-4" />
            <span>참고URL</span>
          </div>
          <span className="mx-3 shrink-0 text-muted-foreground">:</span>
          <div
            className={`flex min-h-[1.5rem] min-w-0 flex-1 flex-wrap items-center gap-2 self-stretch rounded px-1 py-0.5 transition-colors ${editingMetaField !== 'reference_urls' ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80' : ''}`}
            onClick={() => {
              if (editingMetaField !== 'reference_urls') {
                setEditingUrls(note.reference_urls ? [...note.reference_urls] : [])
                setEditingUrlInput('')
                setEditingMetaField('reference_urls')
              }
            }}
          >
            {editingMetaField === 'reference_urls' ? (
              <div
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {editingUrls.map((url, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="max-w-[180px] truncate text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {url}
                    </a>
                    <button type="button" onClick={() => setEditingUrls((p) => p.filter((_, j) => j !== i))} className="rounded hover:bg-muted-foreground/20">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Input
                  placeholder="URL 입력 후 Enter 저장"
                  value={editingUrlInput}
                  onChange={(e) => setEditingUrlInput(e.target.value)}
                  className="h-7 min-w-[400px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setEditingMetaField(null)
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      let finalUrls = [...editingUrls]
                      const u = editingUrlInput.trim()
                      if (u && !finalUrls.includes(u)) finalUrls.push(u)
                      setEditingUrlInput('')
                      if (!user || !noteId) return
                      supabase.from('notes').update({ reference_urls: finalUrls }).eq('id', noteId).eq('user_id', user.id).then(({ error }) => {
                        if (!error) {
                          setNote({ ...note, reference_urls: finalUrls })
                          setEditingMetaField(null)
                          notifySidebarNotesRefresh()
                        }
                      })
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[1.5rem] flex-1 flex-wrap items-center gap-2">
                {note.reference_urls && note.reference_urls.length > 0 ? (
                  note.reference_urls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {url}
                    </a>
                  ))
                ) : (
                  <span className="text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-2 flex items-center text-left text-sm">
          <div className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
            {note.status === 'active' && <CircleCheck className="h-4 w-4" />}
            {note.status === 'archived' && <Archive className="h-4 w-4" />}
            {note.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
            {(!note.status || !['active', 'archived', 'completed'].includes(note.status)) && <CircleCheck className="h-4 w-4" />}
            <span>상태</span>
          </div>
          <span className="mx-3 text-muted-foreground">:</span>
          <div className="group flex min-w-0 flex-1 items-center gap-2">
            <DropdownMenu
              onOpenChange={(open) => {
                if (!open) setEditingMetaField(null)
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 ${editingMetaField !== 'status' ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80' : ''}`}
                >
                  <span>{formatStatus(note.status)}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[8rem] border-border bg-white shadow-lg dark:bg-black">
                <DropdownMenuItem
                  onClick={async () => {
                    if (!user || !noteId || note.status === 'active') return
                    const { error } = await supabase.from('notes').update({ status: 'active' }).eq('id', noteId).eq('user_id', user.id)
                    if (!error) {
                      setNote({ ...note, status: 'active' })
                      setEditingMetaField(null)
                      notifySidebarNotesRefresh()
                    }
                  }}
                >
                  활성화
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!user || !noteId || note.status === 'archived') return
                    const { error } = await supabase.from('notes').update({ status: 'archived' }).eq('id', noteId).eq('user_id', user.id)
                    if (!error) {
                      setNote({ ...note, status: 'archived' })
                      setEditingMetaField(null)
                      notifySidebarNotesRefresh()
                    }
                  }}
                >
                  보관
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!user || !noteId || note.status === 'completed') return
                    const { error } = await supabase.from('notes').update({ status: 'completed' }).eq('id', noteId).eq('user_id', user.id)
                    if (!error) {
                      setNote({ ...note, status: 'completed' })
                      setEditingMetaField(null)
                      notifySidebarNotesRefresh()
                    }
                  }}
                >
                  완료
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-2 flex items-center text-left text-sm">
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
                notifySidebarNotesRefresh()
              }
            }}
          />
        </div>

        {note.is_public && note.share_token && (
          <div className="mb-2 flex items-center text-left text-sm">
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
              <Tooltip>
                <TooltipTrigger asChild>
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
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>링크 복사</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="my-6 border-t border-border"></div>

        <div
          ref={editingMetaField === 'description' ? metaEditRef : undefined}
          className={`mb-6 rounded px-1 py-0.5 transition-colors ${editingMetaField !== 'description' ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80' : ''}`}
          onClick={() => {
            if (editingMetaField !== 'description') {
              setEditingDescriptionOriginal(note.description ?? '')
              setEditingMetaField('description')
            }
          }}
        >
          {editingMetaField === 'description' ? (
            <div className="flex flex-col gap-3 rounded-md border border-input bg-background p-3 shadow-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex h-[220px] min-h-[120px] max-h-[400px] resize-y flex-col overflow-hidden rounded-lg border border-input">
                <RichTextEditor
                  value={note.description || ''}
                  onChange={(val) => setNote({ ...note, description: val ?? '' })}
                  placeholder="설명을 입력하세요."
                  className="rich-text-editor-root min-h-0 flex-1"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={async () => {
                    if (!user || !noteId) return
                    const { error } = await supabase.from('notes').update({ description: note.description }).eq('id', noteId).eq('user_id', user.id)
                    if (!error) {
                      setEditingMetaField(null)
                      notifySidebarNotesRefresh()
                    }
                  }}
                >
                  저장
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                    setNote({ ...note, description: editingDescriptionOriginal })
                    setEditingMetaField(null)
                  }}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
            <div className={`note-description-prose text-left text-foreground ${proseBlockquoteHrAlign} [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:mt-4 [&_h1]:mt-0 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:no-underline [&_mark]:rounded [&_mark]:px-0.5 [&_mark]:py-0.5 [&_mark]:bg-yellow-200/70 dark:[&_mark]:bg-yellow-500/30`}>
              {note.description ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlightMark]} rehypePlugins={[rehypeRaw]} remarkRehypeOptions={remarkRehypeOptions} components={markdownComponents}>{note.description}</ReactMarkdown>
              ) : (
                <span className="text-muted-foreground">설명 없음 (클릭하여 추가)</span>
              )}
            </div>
          )}
        </div>

        <div className="my-6 border-t border-border"></div>

        <div className="mb-6 group/related">
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
              <button
                type="button"
                onClick={() => setShowRelatedNoteDialog(true)}
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded text-muted-foreground opacity-0 transition-opacity hover:bg-gray-100 hover:text-foreground group-hover/related:opacity-100 dark:hover:bg-gray-800"
                aria-label="연관 노트 추가"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">연관 노트가 없습니다.</p>
              <button
                type="button"
                onClick={() => setShowRelatedNoteDialog(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded text-muted-foreground opacity-0 transition-opacity hover:bg-gray-100 hover:text-foreground group-hover/related:opacity-100 dark:hover:bg-gray-800"
                aria-label="연관 노트 추가"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
    </div>

      {user && (
        <RelatedNoteSearchDialog
          user={user}
          isOpen={showRelatedNoteDialog}
          onClose={() => setShowRelatedNoteDialog(false)}
          onSelect={async (selectedIds) => {
            if (!noteId || !user || !note) return
            const existing = note.related_note_ids || []
            const merged = [...new Set([...existing, ...selectedIds])].filter((id) => id !== noteId)
            const { error } = await supabase.from('notes').update({ related_note_ids: merged }).eq('id', noteId).eq('user_id', user.id)
            if (!error) {
              setNote({ ...note, related_note_ids: merged })
              if (merged.length > 0) {
                const { data } = await supabase.from('notes').select('id, title').in('id', merged).eq('user_id', user.id)
                setRelatedNotes((data as RelatedNote[]) || [])
              } else {
                setRelatedNotes([])
              }
              setShowRelatedNoteDialog(false)
              notifySidebarNotesRefresh()
            }
          }}
          excludeNoteIds={[noteId, ...(note?.related_note_ids || [])]}
          singleSelect={false}
          dialogTitle="연관 노트 추가"
        />
      )}

      {user && (
        <CommitPushDialog
          user={user}
          isOpen={showCommitPushDialog}
          onClose={() => {
            setShowCommitPushDialog(false)
            setEditingCommitId(null)
          }}
          onSuccess={() => {
            setEditingCommitId(null)
            if (note?.id && user) {
              supabase
                .from('commits')
                .select('id, title, message, created_at, attachments')
                .eq('note_id', note.id)
                .eq('user_id', user.id)
                .order('created_at', { ascending: sortOrder === 'asc' })
                .then(({ data }) => {
                  setCommits((data as Commit[]) ?? [])
                  setNote((prev) =>
                    prev ? { ...prev, commit_count: (data?.length ?? prev.commit_count) } : null
                  )
                })
            }
          }}
          commitId={editingCommitId ?? undefined}
          defaultNoteId={editingCommitId ? undefined : note?.id}
        />
      )}

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
