'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { TablePageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { useSkeletonTiming } from '@/hooks/useSkeletonTiming'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Edit, Plus, ArrowUpDown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuthUser } from '@/components/AuthUserProvider'

interface DeveloperNote {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

const DOC_TABS = [
  { value: 'product', label: '프로덕트' },
  { value: 'architecture', label: '아키텍처' },
  { value: 'database', label: '데이터베이스' },
  { value: 'design', label: '디자인' },
  { value: 'plan', label: '플랜' },
] as const

const markdownProseClass =
  'rounded-md border border-border bg-muted/50 p-6 text-sm text-foreground [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:mt-4 [&_h1]:mt-0 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:border-collapse [&_th,_td]:border [&_th,_td]:border-border [&_th,_td]:px-3 [&_th,_td]:py-2 [&_th]:bg-muted'

function DocTabContent({ slug }: { slug: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/docs/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? '문서를 찾을 수 없습니다.' : '로드 실패')
        return res.json()
      })
      .then((data: { content: string }) => setContent(data.content ?? ''))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card p-12">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
        {error}
      </div>
    )
  }
  if (!content) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        내용이 없습니다.
      </div>
    )
  }
  return (
    <div className={`overflow-y-auto ${markdownProseClass}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export default function DeveloperNotesPage() {
  const user = useAuthUser()
  const [loading, setLoading] = useState(true)
  const showSkeleton = useSkeletonTiming(loading)
  const [notes, setNotes] = useState<DeveloperNote[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [viewingNote, setViewingNote] = useState<DeveloperNote | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }])
  const [activeTab, setActiveTab] = useState('notes')

  useEffect(() => {
    if (!user) return
    loadNotes(user.id).finally(() => setLoading(false))
  }, [user])

  const loadNotes = async (userId: string) => {
    const { data, error } = await supabase
      .from('developer_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading developer notes:', error)
      return
    }

    if (data) {
      setNotes(data)
    }
  }

  const handleCreate = () => {
    setTitle('')
    setContent('')
    setEditingNoteId(null)
    setShowDialog(true)
  }

  const handleView = (note: DeveloperNote) => {
    setViewingNote(note)
    setShowViewDialog(true)
  }

  const handleEdit = (note: DeveloperNote) => {
    setTitle(note.title)
    setContent(note.content)
    setEditingNoteId(note.id)
    setShowDialog(true)
  }

  const openDeleteAlert = (noteId: string) => {
    setPendingDeleteId(noteId)
    setDeleteAlertOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return
    const noteId = pendingDeleteId
    setPendingDeleteId(null)
    setDeleteAlertOpen(false)
    setDeletingNoteId(noteId)

    const { error } = await supabase
      .from('developer_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      console.error('Error deleting developer note:', error)
      alert('개발자 노트 삭제에 실패했습니다.')
      setDeletingNoteId(null)
      return
    }

    setNotes(notes.filter((note) => note.id !== noteId))
    setDeletingNoteId(null)
  }

  const handleDeleteCancel = () => {
    setPendingDeleteId(null)
    setDeleteAlertOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim() || !content.trim()) return

    setSubmitting(true)

    const noteData = {
      title: title.trim(),
      content: content.trim(),
    }

    let data, error

    if (editingNoteId) {
      const result = await supabase
        .from('developer_notes')
        .update(noteData)
        .eq('id', editingNoteId)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      const result = await supabase
        .from('developer_notes')
        .insert({
          ...noteData,
          user_id: user.id,
        })
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error(`Error ${editingNoteId ? 'updating' : 'creating'} developer note:`, error)
      alert(`개발자 노트 ${editingNoteId ? '수정' : '생성'}에 실패했습니다.`)
      setSubmitting(false)
      return
    }

    setTitle('')
    setContent('')
    setEditingNoteId(null)
    setShowDialog(false)
    setSubmitting(false)

    if (user) {
      loadNotes(user.id)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setTitle('')
      setContent('')
      setEditingNoteId(null)
      setShowDialog(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const columns = useMemo<ColumnDef<DeveloperNote>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              column.toggleSorting(column.getIsSorted() === 'asc')
            }}
            className="h-8 px-2"
          >
            제목
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-card-foreground">{row.original.title}</div>
        ),
      },
      {
        accessorKey: 'content',
        header: '내용 미리보기',
        cell: ({ row }) => (
          <div className="max-w-[500px] truncate text-sm text-muted-foreground">
            {row.original.content}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              column.toggleSorting(column.getIsSorted() === 'asc')
            }}
            className="h-8 px-2"
          >
            생성일
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground">
            {formatDate(row.original.created_at)}
          </div>
        ),
      },
      {
        accessorKey: 'updated_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              column.toggleSorting(column.getIsSorted() === 'asc')
            }}
            className="h-8 px-2"
          >
            수정일
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground">
            {formatDate(row.original.updated_at)}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '작업',
        cell: ({ row }) => {
          const note = row.original
          return (
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(note)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>노트 수정</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteAlert(note.id)
                      }}
                      disabled={deletingNoteId === note.id}
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
                  </span>
                </TooltipTrigger>
                <TooltipContent>노트 삭제</TooltipContent>
              </Tooltip>
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
    state: { sorting },
  })

  if (showSkeleton) {
    return <TablePageLoadingSkeleton tabCount={1} />
  }
  if (loading) {
    return null
  }

  if (!user) {
    return null
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-semibold text-foreground">
          개발자 노트
        </h2>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="notes">
                작업 내역 ({notes.length})
              </TabsTrigger>
              {DOC_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeTab === 'notes' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleCreate}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>새 노트 작성</TooltipContent>
              </Tooltip>
            )}
          </div>

          <TabsContent value="notes">
            {notes.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">
                  작성된 개발자 노트가 없습니다.
                </p>
                <Button onClick={handleCreate} className="mt-4">
                  첫 노트 작성하기
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleView(row.original)}
                          data-state={row.getIsSelected() && 'selected'}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              onClick={
                                cell.column.id === 'actions'
                                  ? (e) => e.stopPropagation()
                                  : undefined
                              }
                            >
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
          {DOC_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <DocTabContent slug={tab.value} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingNoteId ? '개발자 노트 수정' : '새 개발자 노트 작성'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-6">
              <div>
                <Label htmlFor="title">제목</Label>
                <Textarea
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="feat: 새로운 기능 추가"
                  className="mt-2 font-mono text-sm"
                  rows={2}
                  required
                />
              </div>

              <div>
                <Label htmlFor="content">내용</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="주요 기능 추가:&#10;- 기능 1&#10;- 기능 2&#10;&#10;UI/UX 개선:&#10;- 개선 사항 1"
                  className="mt-2 font-mono text-sm"
                  rows={20}
                  required
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  커밋 메시지 형식으로 작성하세요. 날짜와 시간은 자동으로 저장됩니다.
                </p>
              </div>
            </div>

            <DialogFooter className="border-t p-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? '저장 중...'
                  : editingNoteId
                    ? '수정'
                    : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingNote?.title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {viewingNote && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">생성일</Label>
                  <p className="text-sm">{formatDate(viewingNote.created_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">수정일</Label>
                  <p className="text-sm">{formatDate(viewingNote.updated_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">내용</Label>
                  <div className="mt-2 rounded-md border border-border bg-muted/50 p-4 text-sm text-foreground [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:mt-3 [&_h1]:mt-0 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingNote.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t p-6">
            <Button
              variant="outline"
              onClick={() => {
                if (viewingNote) {
                  handleEdit(viewingNote)
                  setShowViewDialog(false)
                }
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              수정
            </Button>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAlertOpen} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>개발자 노트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 개발자 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-[#1F2A44] text-white hover:bg-[#1F2A44]/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
