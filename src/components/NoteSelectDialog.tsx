'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ArrowUpDown } from 'lucide-react'

interface Note {
  id: string
  title: string
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

interface NoteSelectDialogProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSelect: (noteId: string) => void
}

export default function NoteSelectDialog({
  user,
  isOpen,
  onClose,
  onSelect,
}: NoteSelectDialogProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [titleSearch, setTitleSearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  type SortKey = 'category' | 'title' | 'created_at' | 'updated_at'
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      loadNotes()
      setSelectedId(null)
      setTitleSearch('')
      setTagSearch('')
    }
  }, [isOpen, user])

  const loadNotes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, category_large, category_medium, category_small, tags, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      console.error(error)
      return
    }
    setNotes(data ?? [])
  }

  const filteredNotes = useMemo(() => {
    let list = [...notes]
    if (titleSearch.trim()) {
      const q = titleSearch.trim().toLowerCase()
      list = list.filter((note) => note.title.toLowerCase().includes(q))
    }
    if (tagSearch.trim()) {
      const tags = tagSearch.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      if (tags.length > 0) {
        list = list.filter((note) => {
          if (!note.tags?.length) return false
          return tags.some((t) => note.tags!.some((nt) => nt.toLowerCase().includes(t)))
        })
      }
    }
    if (sort) {
      const { key: sortKey, asc: sortAsc } = sort
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'category') {
          const cat = (n: Note) => [n.category_large, n.category_medium, n.category_small].filter(Boolean).join(' > ') || ''
          cmp = cat(a).localeCompare(cat(b), 'ko')
        } else if (sortKey === 'title') cmp = a.title.localeCompare(b.title, 'ko')
        else if (sortKey === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        else if (sortKey === 'updated_at') cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        return sortAsc ? cmp : -cmp
      })
    }
    return list
  }, [notes, titleSearch, tagSearch, sort])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev?.key === key ? { key, asc: !prev.asc } : { key, asc: true }))
  }

  const handleApply = () => {
    if (selectedId) {
      onSelect(selectedId)
      onClose()
    }
  }

  const handleCancel = () => {
    setSelectedId(null)
    setTitleSearch('')
    setTagSearch('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>노트 선택</DialogTitle>
        </DialogHeader>

        {/* 연관 노트 검색과 동일: 검색 영역 (탭) */}
        <div className="border-b bg-muted p-6">
          <Tabs
            defaultValue="title"
            className="w-full"
            onValueChange={() => {
              setTitleSearch('')
              setTagSearch('')
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="title">제목으로 검색</TabsTrigger>
              <TabsTrigger value="tag">태그로 검색</TabsTrigger>
            </TabsList>
            <TabsContent value="title" className="mt-4">
              <Label>제목으로 검색</Label>
              <Input
                type="text"
                value={titleSearch}
                onChange={(e) => setTitleSearch(e.target.value)}
                placeholder="노트 제목으로 검색"
                className="mt-2"
              />
            </TabsContent>
            <TabsContent value="tag" className="mt-4">
              <Label>태그로 검색</Label>
              <Input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="태그를 콤마(,)로 구분하여 입력 (예: 프로젝트, 개발)"
                className="mt-2"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* 연관 노트 검색과 동일: 테이블 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              로딩 중...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {(titleSearch.trim() || tagSearch.trim())
                ? '검색 결과가 없습니다.'
                : '노트가 없습니다.'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox disabled aria-label="Select all" />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => toggleSort('category')}
                        className="h-8 px-2"
                      >
                        카테고리
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => toggleSort('title')}
                        className="h-8 px-2"
                      >
                        제목
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>태그</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => toggleSort('created_at')}
                        className="h-8 px-2"
                      >
                        생성일
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => toggleSort('updated_at')}
                        className="h-8 px-2"
                      >
                        최종 수정일
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.map((note) => {
                    const category = [
                      note.category_large,
                      note.category_medium,
                      note.category_small,
                    ]
                      .filter(Boolean)
                      .join(' > ')
                    const isSelected = selectedId === note.id
                    return (
                      <TableRow
                        key={note.id}
                        data-state={isSelected ? 'selected' : undefined}
                        className={`cursor-pointer ${isSelected ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedId((prev) => (prev === note.id ? null : note.id))}
                      >
                        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={!!isSelected}
                            onCheckedChange={() => setSelectedId((prev) => (prev === note.id ? null : note.id))}
                            aria-label="선택"
                          />
                        </TableCell>
                        <TableCell>
                          {category ? (
                            <Badge variant="secondary">{category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-card-foreground">{note.title}</div>
                        </TableCell>
                        <TableCell>
                          {note.tags && note.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {new Date(note.created_at).toLocaleString('ko-KR')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {new Date(note.updated_at).toLocaleString('ko-KR')}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* 연관 노트 검색과 동일: 푸터 */}
        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedId
                ? '1개 노트 선택됨'
                : '노트를 선택해주세요'}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                취소
              </Button>
              <Button type="button" onClick={handleApply} disabled={!selectedId}>
                선택
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
