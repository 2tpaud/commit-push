'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getDriveAccessToken } from '@/lib/googleDrivePicker'
import type { PickedDriveFile } from '@/lib/googleDrivePicker'
import { FolderOpen, FileText, ArrowLeft, Loader2 } from 'lucide-react'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

interface DriveItem {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
}

interface DrivePickerDialogProps {
  isOpen: boolean
  /** 닫을 때 현재 보고 있던 폴더 ID 전달. 루트에서 닫으면 null → 다음에 루트에서 열림 */
  onClose: (lastViewedFolderId?: string | null) => void
  onSelect: (files: PickedDriveFile[], parentFolderId?: string) => void
  startFolderId?: string
}

export default function DrivePickerDialog({
  isOpen,
  onClose,
  onSelect,
  startFolderId,
}: DrivePickerDialogProps) {
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<DriveItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState(startFolderId ?? 'root')
  const [folderStack, setFolderStack] = useState<string[]>([])
  const [pathNames, setPathNames] = useState<string[]>([]) // 폴더 경로 표시용 (이름)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadFolder = useCallback(async (folderId: string, accessToken: string) => {
    setLoading(true)
    setTokenError(null)
    try {
      const q = `'${folderId}' in parents and trashed = false`
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink)&orderBy=folder,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Drive 요청 실패 (${res.status})`)
      }
      const data = await res.json()
      setItems((data.files ?? []) as DriveItem[])
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setCurrentFolderId(startFolderId ?? 'root')
    setFolderStack([])
    setPathNames([])
    setSelected(new Set())
    setTokenError(null)
    setToken(null)
    getDriveAccessToken()
      .then((t) => setToken(t))
      .catch((e) => setTokenError(e instanceof Error ? e.message : 'Drive 권한이 필요합니다.'))
  }, [isOpen, startFolderId])

  useEffect(() => {
    if (!isOpen || !token) return
    loadFolder(currentFolderId, token)
  }, [isOpen, token, currentFolderId, loadFolder])

  // 하위 폴더에 있는데 스택이 비었을 때만 부모 체인 조회 → "위로" 버튼 표시/동작
  // (닫았다 다시 열었을 때도 스택이 []이므로 이때도 조회함. "위로"로 이동한 뒤에는 스택이 있으므로 덮어쓰지 않음)
  useEffect(() => {
    if (!isOpen || !token || currentFolderId === 'root' || folderStack.length > 0) return
    const ac = new AbortController()
    const buildStack = async (): Promise<string[]> => {
      const chain: string[] = []
      let id: string | null = currentFolderId
      while (id) {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${id}?fields=parents`,
          { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal }
        )
        if (!res.ok) return chain
        const data = (await res.json()) as { parents?: string[] }
        const parentId = data?.parents?.[0] ?? null
        if (!parentId) break
        chain.push(parentId)
        id = parentId
      }
      return chain
    }
    buildStack().then((chain) => {
      if (ac.signal.aborted) return
      if (chain.length > 0) setFolderStack([...chain].reverse())
      else setCurrentFolderId('root') // 부모 없음 = 루트 폴더(실제 id로 열린 경우) → 'root'로 통일
    }).catch(() => { /* 재시도는 다음 effect 실행 시 */ })
    return () => ac.abort()
  }, [isOpen, token, currentFolderId, folderStack.length])

  const enterFolder = (id: string, name: string) => {
    setFolderStack((prev) => [...prev, currentFolderId])
    setPathNames((prev) => [...prev, name || '(이름 없음)'])
    setCurrentFolderId(id)
  }

  const goBack = () => {
    if (folderStack.length === 0) return
    const parent = folderStack[folderStack.length - 1]
    setFolderStack((prev) => prev.slice(0, -1))
    setPathNames((prev) => prev.slice(0, -1))
    setCurrentFolderId(parent)
  }

  const toggleSelect = (item: DriveItem) => {
    if (item.mimeType === FOLDER_MIME) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  const handleConfirm = () => {
    const files: PickedDriveFile[] = items
      .filter((f) => f.mimeType !== FOLDER_MIME && selected.has(f.id))
      .map((f) => ({
        name: f.name || '첨부파일',
        web_view_link: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      }))
    const parentId = currentFolderId !== 'root' ? currentFolderId : undefined
    onSelect(files, parentId)
    onClose(currentFolderId === 'root' ? null : currentFolderId)
  }

  const atRoot = currentFolderId === 'root'
  const pathDisplay = atRoot ? '내 드라이브' : ['내 드라이브', ...pathNames].join(' / ')

  const handleClose = () => {
    onClose(currentFolderId === 'root' ? null : currentFolderId)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="w-[36rem] h-[32rem] max-w-[95vw] max-h-[85vh] flex flex-col z-[100]"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement
          if (target.closest?.('[data-drive-toolbar]')) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            구글 드라이브에서 선택
          </DialogTitle>
        </DialogHeader>

        {tokenError && (
          <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
            {tokenError}
          </div>
        )}

        <div
          data-drive-toolbar
          className="flex items-center gap-2 border-b pb-2 shrink-0 relative z-20 bg-background"
          style={{ pointerEvents: 'auto' }}
        >
          {!atRoot && folderStack.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onPointerDownCapture={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goBack()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goBack()
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              위로
            </Button>
          )}
          <span className="text-sm text-muted-foreground truncate min-w-0" title={pathDisplay}>
            {pathDisplay}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md relative z-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {tokenError ? '' : '이 폴더에 항목이 없습니다.'}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const isFolder = item.mimeType === FOLDER_MIME
                return (
                  <li key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => (isFolder ? enterFolder(item.id, item.name || '(이름 없음)') : toggleSelect(item))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (isFolder) enterFolder(item.id, item.name || '(이름 없음)')
                          else toggleSelect(item)
                        }
                      }}
                    >
                      {isFolder ? (
                        <FolderOpen className="h-5 w-5 text-amber-600 shrink-0" />
                      ) : (
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate flex-1">{item.name || '(이름 없음)'}</span>
                      {!isFolder && <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => handleClose()}>
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || !!tokenError}
          >
            선택 ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
