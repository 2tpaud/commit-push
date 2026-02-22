'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getLimitsForPlan } from '@/lib/planLimits'
import type { User } from '@supabase/supabase-js'
import NoteSelectDialog from './NoteSelectDialog'
import { DialogFormSkeleton } from './PageLoadingSkeleton'
import { useSkeletonTiming } from '@/hooks/useSkeletonTiming'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Paperclip, X, FolderOpen } from 'lucide-react'
import DrivePickerDialog from './DrivePickerDialog'
import { getDrivePickerLastFolderId, setDrivePickerLastFolderId } from '@/lib/googleDrivePicker'

interface AttachmentEntry {
  name: string
  web_view_link: string
}

interface CommitPushDialogProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  /** 수정 시 전달. 있으면 해당 커밋 로드 후 수정 모드 */
  commitId?: string
}

export default function CommitPushDialog({
  user,
  isOpen,
  onClose,
  onSuccess,
  commitId,
}: CommitPushDialogProps) {
  const [noteId, setNoteId] = useState('')
  const [selectedNoteTitle, setSelectedNoteTitle] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [referenceUrls, setReferenceUrls] = useState<string[]>([''])
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([])
  const [customCreatedAt, setCustomCreatedAt] = useState('') // 비어 있으면 미지정(버튼 클릭 시점으로 저장), 있으면 이 날짜로 저장
  const [showAdditionalFields, setShowAdditionalFields] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showNoteSearchDialog, setShowNoteSearchDialog] = useState(false)
  const [loadingCommit, setLoadingCommit] = useState(false)
  const [lastPickerFolderId, setLastPickerFolderId] = useState<string | null>(null)
  const [showDrivePickerDialog, setShowDrivePickerDialog] = useState(false)
  /** 피커를 열 때마다 그 시점의 시작 폴더를 고정해서 전달 (루트/마지막 경로 혼선 방지) */
  const [pickerStartFolderId, setPickerStartFolderId] = useState<string | undefined>(undefined)
  const showSkeleton = useSkeletonTiming(loadingCommit, { delayBeforeShow: 100, minShowMs: 280 })

  useEffect(() => {
    setLastPickerFolderId((prev) => prev ?? getDrivePickerLastFolderId())
  }, [])

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  useEffect(() => {
    if (isOpen && commitId) {
      setLoadingCommit(true)
      supabase
        .from('commits')
        .select('id, note_id, title, message, reference_urls, attachments, created_at, created_at_is_custom')
        .eq('id', commitId)
        .single()
        .then(async ({ data, error }) => {
          if (error || !data) {
            setLoadingCommit(false)
            return
          }
          setNoteId(data.note_id)
          setTitle(data.title ?? '')
          setMessage(data.message ?? '')
          setReferenceUrls(
            data.reference_urls && data.reference_urls.length > 0
              ? [...data.reference_urls, '']
              : ['']
          )
          const att = data.attachments as AttachmentEntry[] | null
          setAttachments(
            att && att.length > 0
              ? att.map((a) => ({ name: a.name ?? '', web_view_link: a.web_view_link ?? '' }))
              : []
          )
          if (data.created_at_is_custom && data.created_at) {
            setCustomCreatedAt(toDatetimeLocal(data.created_at))
          } else {
            setCustomCreatedAt('')
          }
          setShowAdditionalFields(false)
          const { data: noteData } = await supabase
            .from('notes')
            .select('title')
            .eq('id', data.note_id)
            .single()
          if (noteData?.title) setSelectedNoteTitle(noteData.title)
          setLoadingCommit(false)
        })
    }
    if (isOpen && !commitId) {
      setNoteId('')
      setSelectedNoteTitle('')
      setTitle('')
      setMessage('')
      setReferenceUrls([''])
      setAttachments([])
      setCustomCreatedAt('')
      setShowAdditionalFields(false)
    }
  }, [isOpen, commitId])

  const handleNoteSelect = (id: string) => {
    setNoteId(id)
    supabase
      .from('notes')
      .select('title')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data?.title) setSelectedNoteTitle(data.title)
      })
    setShowNoteSearchDialog(false)
  }

  const handleAddReferenceUrl = () => {
    setReferenceUrls((prev) => [...prev, ''])
  }

  const handleRemoveReferenceUrl = (index: number) => {
    setReferenceUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleReferenceUrlChange = (index: number, value: string) => {
    setReferenceUrls((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleAddAttachmentLink = () => {
    setAttachments((prev) => [...prev, { name: '', web_view_link: '' }])
  }

  const handleOpenGoogleDrivePicker = () => {
    const startId = lastPickerFolderId ?? getDrivePickerLastFolderId() ?? undefined
    setPickerStartFolderId(startId)
    setShowDrivePickerDialog(true)
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAttachmentChange = (
    index: number,
    field: 'name' | 'web_view_link',
    value: string
  ) => {
    setAttachments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !noteId.trim()) return

    setSubmitting(true)

    const urls = referenceUrls.map((u) => u.trim()).filter(Boolean)
    const attachmentList = attachments.filter(
      (a) => a.name.trim() && a.web_view_link.trim()
    )

    const basePayload = {
      note_id: noteId,
      title: title.trim() || '',
      message: message.trim() || null,
      reference_urls: urls.length > 0 ? urls : null,
      attachments:
        attachmentList.length > 0
          ? attachmentList.map((a) => ({
              name: a.name.trim(),
              web_view_link: a.web_view_link.trim(),
            }))
          : [],
    }

    const hasCustomCreatedAt = customCreatedAt.trim().length > 0

    if (commitId) {
      const updatePayload: Record<string, unknown> = { ...basePayload }
      if (hasCustomCreatedAt) {
        updatePayload.created_at = new Date(customCreatedAt.trim()).toISOString()
        updatePayload.created_at_is_custom = true
      } else {
        updatePayload.created_at_is_custom = false
      }
      const { error } = await supabase.from('commits').update(updatePayload).eq('id', commitId)
      if (error) {
        console.error('Error updating commit:', error)
        alert('커밋 수정에 실패했습니다.')
        setSubmitting(false)
        return
      }
    } else {
      const { data: profile } = await supabase
        .from('users')
        .select('plan, total_commits')
        .eq('id', user.id)
        .single()
      const limits = getLimitsForPlan(profile?.plan ?? null)
      const totalCommits = profile?.total_commits ?? 0
      if (totalCommits >= limits.maxCommits) {
        alert(`커밋 한도를 초과했습니다. (${totalCommits}/${limits.maxCommits}) 플랜 업그레이드를 원하시면 플랜 페이지를 확인해 주세요.`)
        setSubmitting(false)
        return
      }
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        ...basePayload,
        created_at_is_custom: hasCustomCreatedAt,
      }
      if (hasCustomCreatedAt) {
        insertPayload.created_at = new Date(customCreatedAt.trim()).toISOString()
      }
      const { error } = await supabase.from('commits').insert(insertPayload)
      if (error) {
        console.error('Error creating commit:', error)
        alert('커밋 저장에 실패했습니다.')
        setSubmitting(false)
        return
      }
    }

    setNoteId('')
    setSelectedNoteTitle('')
    setTitle('')
    setMessage('')
    setReferenceUrls([''])
    setAttachments([])
    setCustomCreatedAt('')
    setSubmitting(false)
    onClose()
    onSuccess?.()
  }

  const handleClose = () => {
    if (!submitting) {
      setNoteId('')
      setSelectedNoteTitle('')
      setTitle('')
      setMessage('')
      setReferenceUrls([''])
      setAttachments([])
      setCustomCreatedAt('')
      setShowAdditionalFields(false)
      onClose()
    }
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) handleClose()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{commitId ? '커밋푸시 수정' : '커밋푸시'}</DialogTitle>
          </DialogHeader>
          {showSkeleton ? (
            <DialogFormSkeleton />
          ) : loadingCommit ? (
            <div className="min-h-[200px]" aria-hidden />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 노트 선택 - 연관 노트 검색과 동일(검색 버튼 → 다이얼로그, 단일 선택) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>노트 선택 <span className="text-red-500">*</span></Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNoteSearchDialog(true)}
                >
                  검색
                </Button>
              </div>
              {noteId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 pr-1">
                    {selectedNoteTitle || '선택된 노트'}
                    <button
                      type="button"
                      onClick={() => {
                        setNoteId('')
                        setSelectedNoteTitle('')
                      }}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  검색 버튼을 눌러 커밋을 추가할 노트를 선택하세요.
                </p>
              )}
            </div>

            {/* 제목 (선택) */}
            <div>
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: API 수정, 버그 픽스"
                className="mt-2"
              />
            </div>

            {/* 메모 */}
            <div>
              <Label htmlFor="message">메모</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="커밋에 대한 간단한 설명을 입력하세요"
                className="mt-2"
                rows={3}
              />
            </div>

            {/* 추가정보입력/수정 클릭 시 펼침 */}
            {!showAdditionalFields ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdditionalFields(true)}
              >
                {commitId ? '추가정보수정' : '추가정보입력'}
              </Button>
            ) : (
              <>
                {/* 생성일 지정 (선택) */}
                <div>
                  <Label htmlFor="custom-created-at">생성일 지정</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    비워두면 커밋푸시 버튼 클릭 시점이 생성일로 저장됩니다. 날짜를 지정하면 해당 날짜가 생성일로 저장됩니다.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="custom-created-at"
                      type="datetime-local"
                      value={customCreatedAt}
                      onChange={(e) => setCustomCreatedAt(e.target.value)}
                      className="max-w-xs"
                    />
                    {customCreatedAt ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomCreatedAt('')}
                      >
                        지우기
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* 참고 URL */}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">참고 URL</h3>
                  <div className="space-y-2">
                    {referenceUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="url"
                          value={url}
                          onChange={(e) =>
                            handleReferenceUrlChange(index, e.target.value)
                          }
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveReferenceUrl(index)}
                          disabled={referenceUrls.length <= 1}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddReferenceUrl}
                    className="mt-2"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    URL 추가
                  </Button>
                </div>

                {/* 첨부파일 */}
                <div>
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">첨부파일</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    구글 드라이브에서 폴더·파일을 선택하거나, 링크를 직접 입력할 수 있습니다.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenGoogleDrivePicker}
                    >
                      <FolderOpen className="mr-1 h-3 w-3" />
                      구글 드라이브에서 선택
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAttachmentLink}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      링크 추가
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((att, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 rounded-md border border-border p-2"
                        >
                          <div className="flex gap-2">
                            <Input
                              value={att.name}
                              onChange={(e) =>
                                handleAttachmentChange(index, 'name', e.target.value)
                              }
                              placeholder="파일명"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveAttachment(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            type="url"
                            value={att.web_view_link}
                            onChange={(e) =>
                              handleAttachmentChange(
                                index,
                                'web_view_link',
                                e.target.value
                              )
                            }
                            placeholder="https://drive.google.com/..."
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="border-t pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={submitting || !noteId.trim()}
              >
                {submitting ? '저장 중...' : commitId ? '수정' : '커밋푸시'}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <NoteSelectDialog
        user={user}
        isOpen={showNoteSearchDialog}
        onClose={() => setShowNoteSearchDialog(false)}
        onSelect={handleNoteSelect}
      />
      <DrivePickerDialog
        isOpen={showDrivePickerDialog}
        onClose={(lastViewedFolderId) => {
          if (lastViewedFolderId != null) {
            if (lastViewedFolderId) {
              setLastPickerFolderId(lastViewedFolderId)
              setDrivePickerLastFolderId(lastViewedFolderId)
              setPickerStartFolderId(lastViewedFolderId)
            }
          } else {
            setLastPickerFolderId(null)
            setDrivePickerLastFolderId(null)
            setPickerStartFolderId(undefined)
          }
          setShowDrivePickerDialog(false)
        }}
        onSelect={(files, parentFolderId) => {
          setAttachments((prev) => [...prev, ...files])
          if (parentFolderId) {
            setLastPickerFolderId(parentFolderId)
            setDrivePickerLastFolderId(parentFolderId)
            setPickerStartFolderId(parentFolderId)
          }
          setShowDrivePickerDialog(false)
        }}
        startFolderId={pickerStartFolderId}
      />
    </>
  )
}
