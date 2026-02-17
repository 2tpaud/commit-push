'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronRight, ChevronDown, FileText, Search, LayoutDashboard, ScrollText, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

type SidebarView = 'tree' | 'search' | 'dashboard'
type SearchMode = 'title' | 'tag'

interface Note {
  id: string
  title: string
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
  updated_at: string
}

/** 노트 목록을 대분류 > 중분류 > 소분류 트리로 변환 */
function buildCategoryTree(notes: Note[]) {
  type MediumMap = Map<string, Map<string, Note[]>>
  type LargeMap = Map<string, MediumMap>
  const tree: LargeMap = new Map()

  const empty = '(미분류)'
  for (const note of notes) {
    const large = note.category_large?.trim() || empty
    const medium = note.category_medium?.trim() || empty
    const small = note.category_small?.trim() || empty

    if (!tree.has(large)) tree.set(large, new Map())
    const medMap = tree.get(large)!
    if (!medMap.has(medium)) medMap.set(medium, new Map())
    const smallMap = medMap.get(medium)!
    if (!smallMap.has(small)) smallMap.set(small, [])
    smallMap.get(small)!.push(note)
  }

  return tree
}

export default function AppSidebar({ userId }: { userId: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarView, setSidebarView] = useState<SidebarView>('tree')
  const [searchMode, setSearchMode] = useState<SearchMode>('title')
  const [searchQuery, setSearchQuery] = useState('')

  /** 작업 로그·개발자 노트 페이지 프리페치로 이동 시 버벅임 완화 */
  useEffect(() => {
    router.prefetch('/activity')
    router.prefetch('/developer-notes')
  }, [router])

  useEffect(() => {
    let mounted = true
    supabase
      .from('notes')
      .select('id, title, category_large, category_medium, category_small, tags, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Error loading notes for sidebar:', error)
          return
        }
        setNotes((data as Note[]) ?? [])
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [userId])

  const tree = useMemo(() => buildCategoryTree(notes), [notes])

  /** 최근 수정일 순 노트 (하단 목록용) */
  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [notes]
  )

  /** 검색 자동완성: 제목 또는 태그로 필터 */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return notes.slice(0, 20)
    if (searchMode === 'title') {
      return notes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 20)
    }
    return notes
      .filter((n) => {
        const tags = n.tags ?? []
        return tags.some((t) => String(t).toLowerCase().includes(q))
      })
      .slice(0, 20)
  }, [notes, searchQuery, searchMode])

  const iconButtonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <Sidebar>
      {/* p-0으로 상단 패딩 제거 → 아이콘 행이 헤더와 동일 높이·라인 정렬 */}
      <SidebarContent className="flex flex-col min-h-0 p-0">
        {/* 뷰 전환: 홈 CommitPush 로고와 동일 선상(h-14) + 라인 정렬 */}
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
          <button
            type="button"
            onClick={() => setSidebarView('tree')}
            className={cn(
              iconButtonClass,
              sidebarView === 'tree' && 'bg-accent text-accent-foreground'
            )}
            title="노트 분류 트리"
            aria-label="노트 분류 트리"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarView('search')}
            className={cn(
              iconButtonClass,
              sidebarView === 'search' && 'bg-accent text-accent-foreground'
            )}
            title="제목·태그 검색"
            aria-label="제목·태그 검색"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarView('dashboard')}
            className={cn(
              iconButtonClass,
              sidebarView === 'dashboard' && 'bg-accent text-accent-foreground'
            )}
            title="대시보드 메뉴"
            aria-label="대시보드 메뉴"
          >
            <LayoutDashboard className="h-4 w-4" />
          </button>
          <Link
            href="/activity"
            className={cn(iconButtonClass)}
            title="작업 로그"
            aria-label="작업 로그"
            prefetch
          >
            <ScrollText className="h-4 w-4" />
          </Link>
          <Link
            href="/developer-notes"
            className={cn(iconButtonClass)}
            title="개발자 노트"
            aria-label="개발자 노트"
            prefetch
          >
            <BookOpen className="h-4 w-4" />
          </Link>
        </div>

        {/* 메인 영역: 트리 / 검색 / 대시보드 (4/5 비율) */}
        <div className="flex-[4] min-h-0 overflow-auto px-2">
          {loading ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">로딩 중...</p>
          ) : sidebarView === 'tree' ? (
            notes.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">노트가 없습니다.</p>
            ) : (
              <>
                <p className="sticky top-0 z-10 bg-sidebar px-2 py-2 text-xs font-semibold text-foreground">
                  워크 스페이스
                </p>
                <SidebarMenu className="gap-0.5">
                {Array.from(tree.entries()).map(([largeKey]) => {
                  const medMap = tree.get(largeKey)!
                  const largeCount = Array.from(medMap.values()).reduce(
                    (acc, smallMap) =>
                      acc + Array.from(smallMap.values()).reduce((a, arr) => a + arr.length, 0),
                    0
                  )
                  return (
                    <SidebarMenuItem key={largeKey}>
                      <Collapsible defaultOpen className="group/collapsible">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="w-full justify-between gap-0 px-2 py-1.5">
                            <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                              <ChevronRight
                                className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90"
                                aria-hidden
                              />
                              <span className="truncate">{largeKey}</span>
                              <span className="shrink-0 text-muted-foreground">
                                ({largeCount})
                              </span>
                            </span>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3 ml-2">
                            {Array.from(medMap.entries()).map(([mediumKey, smallMap]) => {
                              const mediumCount = Array.from(smallMap.values()).reduce(
                                (acc, arr) => acc + arr.length,
                                0
                              )
                              return (
                                <li key={mediumKey}>
                                  <Collapsible defaultOpen={false} className="group/collapsible-medium">
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className={cn(
                                          'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium',
                                          'hover:bg-accent hover:text-accent-foreground',
                                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                        )}
                                      >
                                        <ChevronRight
                                          className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/collapsible-medium:rotate-90"
                                          aria-hidden
                                        />
                                        <span className="truncate">{mediumKey}</span>
                                        <span className="shrink-0 text-muted-foreground">
                                          ({mediumCount})
                                        </span>
                                      </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3 ml-2">
                                        {Array.from(smallMap.entries()).map(
                                          ([smallKey, smallNotes]) => (
                                            <li key={smallKey}>
                                              <Collapsible
                                                defaultOpen={false}
                                                className="group/collapsible-small"
                                              >
                                                <CollapsibleTrigger asChild>
                                                  <button
                                                    type="button"
                                                    className={cn(
                                                      'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs',
                                                      'hover:bg-accent hover:text-accent-foreground',
                                                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                                    )}
                                                  >
                                                    <ChevronDown
                                                      className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]/collapsible-small:rotate-180"
                                                      aria-hidden
                                                    />
                                                    <span className="truncate">{smallKey}</span>
                                                    <span className="shrink-0 text-muted-foreground">
                                                      ({smallNotes.length})
                                                    </span>
                                                  </button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-3 ml-2">
                                                    {smallNotes.map((note) => (
                                                      <li key={note.id}>
                                                        <Link
                                                          href={`/notes/${note.id}`}
                                                          className={cn(
                                                            'flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs',
                                                            'hover:bg-accent hover:text-accent-foreground',
                                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                                          )}
                                                        >
                                                          <FileText
                                                            className="h-3 w-3 shrink-0 text-muted-foreground"
                                                            aria-hidden
                                                          />
                                                          <span className="truncate">
                                                            {note.title}
                                                          </span>
                                                        </Link>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </CollapsibleContent>
                                              </Collapsible>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </li>
                              )
                            })}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
              </>
            )
          ) : sidebarView === 'search' ? (
            <div className="flex flex-col gap-2 px-2 py-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSearchMode('title')}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    searchMode === 'title'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  제목
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('tag')}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    searchMode === 'tag'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  태그
                </button>
              </div>
              <input
                type="text"
                placeholder={searchMode === 'title' ? '제목으로 검색...' : '태그로 검색...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex flex-col gap-0.5">
                {searchResults.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate block">{note.title}</span>
                  </Link>
                ))}
                {searchQuery.trim() && searchResults.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">검색 결과 없음</p>
                )}
              </div>
            </div>
          ) : (
            <div className="px-2 py-4 text-xs text-muted-foreground">
              대시보드 메뉴는 준비 중입니다.
            </div>
          )}
        </div>

        {/* 구분선 + 하단 1/5: 최근 항목 고정 라벨 + 최근 수정일 순 노트 제목, 스크롤 */}
        <div className="flex-[1] flex min-h-0 flex-col border-t border-border px-2">
          <p className="shrink-0 bg-sidebar py-2 text-xs font-semibold text-foreground">
            최근 항목
          </p>
          <div className="overflow-y-auto flex-1 min-h-0 pb-2">
            {recentNotes.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">최근 노트 없음</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={`/notes/${note.id}`}
                      className="block truncate rounded-md px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {note.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}
