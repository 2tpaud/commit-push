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

type TabType = 'notes' | 'commits'

export default function ActivityPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      setLoading(false)
      loadNotes(session.user.id)
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
    // TODO: 커밋 삭제 로직 구현 (커밋 테이블 생성 후)
    console.log('Delete commit:', commitId)
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
                  커밋푸시 내역 (0)
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
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-8 text-center">
                  <p className="mb-2 text-muted-foreground">
                    커밋푸시 내역이 없습니다.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    커밋 기능은 준비 중입니다.
                  </p>
                </div>

                {/* 커밋 목록 폼 (데이터 없음) */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="mb-4 text-lg font-semibold text-card-foreground">
                    커밋 목록 (준비 중)
                  </h3>
                  <div className="space-y-3">
                    {/* 예시 커밋 항목 (UI만) */}
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4 opacity-50">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            예시 커밋 메시지
                          </span>
                          <Badge variant="secondary">카테고리</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          노트: 예시 노트 제목
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          2024-01-01 12:00:00
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        title="커밋 삭제 (준비 중)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    커밋 테이블 생성 후 실제 데이터가 표시됩니다.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {user && (
        <>
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
