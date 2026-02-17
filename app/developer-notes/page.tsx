'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { TablePageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Edit, Plus, FileText } from 'lucide-react'
import SharedAppLayout from '@/components/SharedAppLayout'

interface DeveloperNote {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export default function DeveloperNotesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      loadNotes(session.user.id).finally(() => setLoading(false))
    })
  }, [router])

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
      // 수정 모드
      const result = await supabase
        .from('developer_notes')
        .update(noteData)
        .eq('id', editingNoteId)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // 생성 모드
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

    // 폼 리셋
    setTitle('')
    setContent('')
    setEditingNoteId(null)
    setShowDialog(false)
    setSubmitting(false)

    // 목록 새로고침
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

  if (loading) {
    return <TablePageLoadingSkeleton tabCount={1} />
  }

  if (!user) {
    return null
  }

  return (
    <SharedAppLayout user={user}>
      <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-foreground" />
              <h2 className="text-2xl font-semibold text-foreground">
                개발자 노트
              </h2>
            </div>
            <Button variant="default" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              새 노트 작성
            </Button>
          </div>

          {notes.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="mb-4 text-muted-foreground">
                작성된 개발자 노트가 없습니다.
              </p>
              <Button onClick={handleCreate}>첫 노트 작성하기</Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">제목</TableHead>
                    <TableHead>내용 미리보기</TableHead>
                    <TableHead className="w-[180px]">생성일</TableHead>
                    <TableHead className="w-[180px]">수정일</TableHead>
                    <TableHead className="w-[100px]">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((note) => (
                    <TableRow
                      key={note.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleView(note)}
                    >
                      <TableCell className="font-medium">
                        {note.title}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[500px] truncate text-sm text-muted-foreground">
                          {note.content}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(note.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(note.updated_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(note)}
                            title="노트 수정"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteAlert(note.id)}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </div>

      {/* 작성/수정 다이얼로그 */}
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

      {/* 상세 보기 다이얼로그 */}
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
                  <div className="mt-2 whitespace-pre-wrap font-mono text-sm text-foreground bg-muted p-4 rounded-md">
                    {viewingNote.content}
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
    </SharedAppLayout>
  )
}
