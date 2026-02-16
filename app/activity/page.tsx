'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import NewNoteDialog from '@/components/NewNoteDialog'
import CommitPushDialog from '@/components/CommitPushDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Edit, Plus, ArrowUpDown } from 'lucide-react'

interface Note {
  id: string
  title: string
  description: string | null
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

interface CommitRow {
  id: string
  note_id: string
  title: string
  message: string | null
  reference_urls: string[] | null
  created_at: string
  updated_at: string
}

type CommitSortKey = 'note' | 'title' | 'message' | 'created_at' | 'updated_at'

type TabType = 'notes' | 'commits'

export default function ActivityPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [commits, setCommits] = useState<CommitRow[]>([])
  const [noteTitleByNoteId, setNoteTitleByNoteId] = useState<Record<string, string>>({})
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [deletingCommitId, setDeletingCommitId] = useState<string | null>(null)
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [showCommitPushDialog, setShowCommitPushDialog] = useState(false)
  const [editingCommitId, setEditingCommitId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }])
  const [commitSort, setCommitSort] = useState<{ key: CommitSortKey; asc: boolean }>({ key: 'updated_at', asc: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      setLoading(false)
      loadNotes(session.user.id)
      loadCommits(session.user.id)
    })
  }, [router])

  const loadNotes = async (userId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      return
    }

    if (data) {
      setNotes(data)
    }
  }

  const loadCommits = async (userId: string) => {
    const { data, error } = await supabase
      .from('commits')
      .select('id, note_id, title, message, reference_urls, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading commits:', error)
      return
    }

    const list = (data as CommitRow[]) ?? []
    setCommits(list)

    const noteIds = [...new Set(list.map((c) => c.note_id).filter(Boolean))]
    if (noteIds.length > 0) {
      const { data: notesData } = await supabase
        .from('notes')
        .select('id, title')
        .in('id', noteIds)
      const map: Record<string, string> = {}
      notesData?.forEach((n: { id: string; title: string }) => {
        map[n.id] = n.title ?? ''
      })
      setNoteTitleByNoteId(map)
    } else {
      setNoteTitleByNoteId({})
    }
  }

  const sortedCommits = useMemo(() => {
    const { key, asc } = commitSort
    return [...commits].sort((a, b) => {
      let cmp = 0
      if (key === 'note') {
        const na = noteTitleByNoteId[a.note_id] ?? ''
        const nb = noteTitleByNoteId[b.note_id] ?? ''
        cmp = na.localeCompare(nb, 'ko')
      } else if (key === 'title') cmp = (a.title ?? '').localeCompare(b.title ?? '', 'ko')
      else if (key === 'message') cmp = (a.message ?? '').localeCompare(b.message ?? '', 'ko')
      else if (key === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (key === 'updated_at') cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      return asc ? cmp : -cmp
    })
  }, [commits, commitSort, noteTitleByNoteId])

  const toggleCommitSort = (key: CommitSortKey) => {
    setCommitSort((prev) => (prev?.key === key ? { key, asc: !prev.asc } : { key, asc: true }))
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('이 노트를 삭제하시겠습니까?')) {
      return
    }

    setDeletingNoteId(noteId)

    const { error } = await supabase.from('notes').delete().eq('id', noteId)

    if (error) {
      console.error('Error deleting note:', error)
      alert('노트 삭제에 실패했습니다.')
      setDeletingNoteId(null)
      return
    }

    setNotes(notes.filter((note) => note.id !== noteId))
    setDeletingNoteId(null)
  }

  const handleDeleteCommit = async (commitId: string) => {
    if (!confirm('이 커밋을 삭제하시겠습니까?')) {
      return
    }
    setDeletingCommitId(commitId)
    const { error } = await supabase.from('commits').delete().eq('id', commitId)
    if (error) {
      console.error('Error deleting commit:', error)
      alert('커밋 삭제에 실패했습니다.')
      setDeletingCommitId(null)
      return
    }
    setCommits((prev) => prev.filter((c) => c.id !== commitId))
    setDeletingCommitId(null)
  }

  const columns = useMemo<ColumnDef<Note>[]>(
    () => [
      {
        accessorKey: 'category',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2"
            >
              카테고리
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const note = row.original
          const category = [
            note.category_large,
            note.category_medium,
            note.category_small,
          ]
            .filter(Boolean)
            .join(' > ')
          return category ? (
            <Badge variant="secondary">{category}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
        sortingFn: (rowA, rowB) => {
          const getCategory = (note: Note) =>
            [
              note.category_large,
              note.category_medium,
              note.category_small,
            ]
              .filter(Boolean)
              .join(' > ') || ''
          return getCategory(rowA.original).localeCompare(
            getCategory(rowB.original),
            'ko'
          )
        },
      },
      {
        accessorKey: 'title',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2"
            >
              제목
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div className="font-medium text-card-foreground">{row.original.title}</div>
          )
        },
      },
      {
        accessorKey: 'tags',
        header: '태그',
        cell: ({ row }) => {
          const tags = row.original.tags
          return tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2"
            >
              생성일
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div className="text-xs text-muted-foreground">
              {new Date(row.original.created_at).toLocaleString('ko-KR')}
            </div>
          )
        },
      },
      {
        accessorKey: 'updated_at',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2"
            >
              최종 수정일
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div className="text-xs text-muted-foreground">
              {new Date(row.original.updated_at).toLocaleString('ko-KR')}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '작업',
        cell: ({ row }) => {
          const note = row.original
          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingNoteId(note.id)}
                title="노트 수정"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteNote(note.id)}
                disabled={deletingNoteId === note.id}
                title="노트 삭제"
              >
                {deletingNoteId === note.id ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )
        },
      },
    ],
    [deletingNoteId]
  )

  const table = useReactTable({
    data: notes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-card-foreground">
            CommitPush
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <Button variant="default" onClick={() => router.push('/')}>
              홈으로
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">
            작업 로그
          </h2>

          {/* 탭 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="notes">
                  노트 생성 내역 ({notes.length})
                </TabsTrigger>
                <TabsTrigger value="commits">
                  커밋푸시 내역 ({commits.length})
                </TabsTrigger>
              </TabsList>
              {activeTab === 'notes' && (
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => setShowNewNoteDialog(true)}
                  title="새 노트 추가"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {activeTab === 'commits' && (
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => {
                    setEditingCommitId(null)
                    setShowCommitPushDialog(true)
                  }}
                  title="커밋푸시 작성"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* 노트 생성 내역 탭 */}
            <TabsContent value="notes">
              {notes.length === 0 ? (
                <div className="rounded-lg border bg-card p-8 text-center">
                  <p className="text-muted-foreground">
                    생성된 노트가 없습니다.
                  </p>
                  <Button onClick={() => setShowNewNoteDialog(true)} className="mt-4">
                    첫 노트 생성하기
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            return (
                              <TableHead key={header.id}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && 'selected'}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            결과가 없습니다.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* 커밋푸시 내역 탭 */}
            <TabsContent value="commits">
              {commits.length === 0 ? (
                <div className="rounded-lg border bg-card p-8 text-center">
                  <p className="mb-2 text-muted-foreground">
                    커밋푸시 내역이 없습니다.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    헤더의 &apos;커밋푸시&apos; 버튼으로 노트에 커밋을 추가할 수 있습니다.
                  </p>
                  <Button onClick={() => setShowCommitPushDialog(true)} className="mt-4">
                    커밋푸시 하기
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => toggleCommitSort('note')}
                            className="h-8 px-2"
                          >
                            노트
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => toggleCommitSort('title')}
                            className="h-8 px-2"
                          >
                            제목
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => toggleCommitSort('message')}
                            className="h-8 px-2"
                          >
                            메모
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => toggleCommitSort('created_at')}
                            className="h-8 px-2"
                          >
                            생성일
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => toggleCommitSort('updated_at')}
                            className="h-8 px-2"
                          >
                            최종 수정일
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="w-24">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCommits.map((commit) => (
                        <TableRow key={commit.id}>
                          <TableCell className="font-medium">
                            {noteTitleByNoteId[commit.note_id] ?? '-'}
                          </TableCell>
                          <TableCell>{commit.title || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {commit.message || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(commit.created_at).toLocaleString('ko-KR')}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(commit.updated_at).toLocaleString('ko-KR')}
                          </TableCell>
                          <TableCell className="w-24">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setShowCommitPushDialog(false)
                                  setEditingCommitId(commit.id)
                                }}
                                title="커밋 수정"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCommit(commit.id)}
                                disabled={deletingCommitId === commit.id}
                                title="커밋 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {user && (
        <>
          <CommitPushDialog
            user={user}
            isOpen={showCommitPushDialog || !!editingCommitId}
            onClose={() => {
              setShowCommitPushDialog(false)
              setEditingCommitId(null)
            }}
            onSuccess={() => {
              if (user) loadCommits(user.id)
            }}
            commitId={editingCommitId ?? undefined}
          />
          <NewNoteDialog
            user={user}
            isOpen={showNewNoteDialog}
            onClose={() => setShowNewNoteDialog(false)}
            onSuccess={() => {
              if (user) {
                loadNotes(user.id)
              }
            }}
          />
          <NewNoteDialog
            user={user}
            isOpen={!!editingNoteId}
            noteId={editingNoteId || undefined}
            onClose={() => setEditingNoteId(null)}
            onSuccess={() => {
              if (user) {
                loadNotes(user.id)
              }
              setEditingNoteId(null)
            }}
          />
        </>
      )}
    </div>
  )
}
