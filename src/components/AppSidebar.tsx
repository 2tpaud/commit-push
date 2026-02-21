'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
import { ChevronRight, ChevronDown, ChevronUp, FileText, Search, LayoutDashboard, ScrollText, BookOpen } from 'lucide-react'
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
  
  // 최근 항목 영역 높이 비율 (0.0 ~ 1.0, 기본값 0.2 = 1/5)
  // localStorage에서 저장된 값 불러오기
  const [recentItemsRatio, setRecentItemsRatio] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarRecentItemsRatio')
      if (saved) {
        const ratio = parseFloat(saved)
        // 유효한 범위인지 확인 (0.2 ~ 0.5)
        if (!isNaN(ratio) && ratio >= 0.2 && ratio <= 0.5) {
          return ratio
        }
      }
    }
    return 0.2
  })
  const isResizing = useRef(false)
  const sidebarContentRef = useRef<HTMLDivElement>(null)
  
  // recentItemsRatio 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarRecentItemsRatio', recentItemsRatio.toString())
    }
  }, [recentItemsRatio])
  
  // 토글 핸들러: 작을 때는 최대로 확대, 클 때는 기본값(1/5)로 축소
  const handleToggleRatio = useCallback(() => {
    const defaultRatio = 0.2
    const maxRatio = 0.5
    
    // 현재 비율이 기본값 이하이면 최대로 확대, 초과이면 기본값으로 축소
    if (recentItemsRatio <= defaultRatio) {
      setRecentItemsRatio(maxRatio)
    } else {
      setRecentItemsRatio(defaultRatio)
    }
  }, [recentItemsRatio])
  
  // 아이콘 결정: 작을 때는 위쪽 화살표, 클 때는 아래쪽 화살표
  const isExpanded = recentItemsRatio > 0.2

  /** 작업 로그·개발자 노트 페이지 프리페치로 이동 시 버벅임 완화 */
  useEffect(() => {
    router.prefetch('/activity')
    router.prefetch('/developer-notes')
  }, [router])

  useEffect(() => {
    let mounted = true
    void Promise.resolve(
      supabase
        .from('notes')
        .select('id, title, category_large, category_medium, category_small, tags, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ).then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.error('Error loading notes for sidebar:', error)
      } else {
        setNotes((data as Note[]) ?? [])
      }
    }).finally(() => {
      if (mounted) setLoading(false)
    })
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

  // 리사이즈 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !sidebarContentRef.current) return
      
      const sidebarContent = sidebarContentRef.current
      const rect = sidebarContent.getBoundingClientRect()
      const totalHeight = rect.height
      // 마우스 위치에서 사이드바 상단까지의 거리
      const mouseY = e.clientY - rect.top
      
      // 최근 항목 영역의 높이 비율 계산 (하단에서 위로)
      // 최소 20% (1/5), 최대 50%로 제한
      const newRatio = Math.max(0.2, Math.min(0.5, (totalHeight - mouseY) / totalHeight))
      setRecentItemsRatio(newRatio)
    }

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const iconButtonClass =
    'flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-md border border-transparent text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-gray-800'

  const mainRatio = 1 - recentItemsRatio

  return (
    <Sidebar>
      {/* p-0으로 상단 패딩 제거 → 아이콘 행이 헤더와 동일 높이·라인 정렬 */}
      <SidebarContent ref={sidebarContentRef} className="flex flex-col min-h-0 p-0">
        {/* 뷰 전환: 홈 CommitPush 로고와 동일 선상(h-14) + 라인 정렬 */}
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
          <button
            type="button"
            onClick={() => setSidebarView('tree')}
            className={cn(
              iconButtonClass,
              sidebarView === 'tree' && 'bg-gray-100 text-[#1F2A44] dark:bg-gray-800'
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
              sidebarView === 'search' && 'bg-gray-100 text-[#1F2A44] dark:bg-gray-800'
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
              sidebarView === 'dashboard' && 'bg-gray-100 text-[#1F2A44] dark:bg-gray-800'
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

        {/* 메인 영역: 트리 / 검색 / 대시보드 */}
        <div 
          className="min-h-0 overflow-auto px-2"
          style={{ flex: mainRatio }}
        >
          {loading ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">로딩 중...</p>
          ) : sidebarView === 'tree' ? (
            notes.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">노트가 없습니다.</p>
            ) : (
              <>
                <p className="sticky top-0 z-10 bg-sidebar px-2 py-2 text-xs font-semibold text-[#1F2A44]">
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
                          <SidebarMenuButton className="w-full justify-between gap-0 px-2 py-1.5 text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800">
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
                                          'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium text-[#1F2A44]',
                                          'hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800',
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
                                                      'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#1F2A44]',
                                                      'hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800',
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
                                                            'flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs text-[#1F2A44]',
                                                            'hover:bg-gray-100 hover:text-[#1F2A44] dark:hover:bg-gray-800',
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
                      ? 'bg-accent text-[#1F2A44]'
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
                      ? 'bg-accent text-[#1F2A44]'
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
                    className="rounded-md px-2 py-1.5 text-xs text-[#1F2A44] hover:bg-accent hover:text-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        {/* 리사이즈 핸들 */}
        <div
          className="relative shrink-0 cursor-row-resize border-t border-border bg-transparent transition-colors hover:bg-accent/50"
          style={{ height: '4px' }}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-label="최근 항목 영역 크기 조정"
          aria-orientation="vertical"
        >
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
        </div>

        {/* 하단: 최근 항목 고정 라벨 + 최근 수정일 순 노트 제목, 스크롤 */}
        <div 
          className="flex min-h-0 flex-col px-2"
          style={{ flex: recentItemsRatio }}
        >
          <div className="shrink-0 flex items-center justify-between bg-sidebar py-2">
            <p className="text-xs font-semibold text-[#1F2A44]">
              최근 항목
            </p>
            <button
              type="button"
              onClick={handleToggleRatio}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#1F2A44] hover:bg-accent hover:text-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              title={isExpanded ? "최소 범위로 축소" : "최대 범위로 확대"}
              aria-label={isExpanded ? "최근 항목 영역을 최소 범위로 축소" : "최근 항목 영역을 최대 범위로 확대"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 pb-2">
            {recentNotes.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">최근 노트 없음</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recentNotes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={`/notes/${note.id}`}
                      className="block cursor-default truncate rounded-md px-2 py-1 text-xs text-[#1F2A44] hover:bg-gray-100 hover:text-[#1F2A44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-gray-800"
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
