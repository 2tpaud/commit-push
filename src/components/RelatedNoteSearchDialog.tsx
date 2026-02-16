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
  type RowSelectionState,
} from '@tanstack/react-table'
import { supabase } from '../lib/supabaseClient'
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
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { ArrowUpDown } from 'lucide-react'

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

interface RelatedNoteSearchDialogProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSelect: (noteIds: string[]) => void
  excludeNoteIds?: string[] // 이미 선택된 노트 ID들 제외
}

export default function RelatedNoteSearchDialog({
  user,
  isOpen,
  onClose,
  onSelect,
  excludeNoteIds = [],
}: RelatedNoteSearchDialogProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [tagSearch, setTagSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  // 노트 로드
  useEffect(() => {
    if (isOpen && user) {
      loadNotes()
    }
  }, [isOpen, user])

  // 필터링된 노트
  const filteredNotes = useMemo(() => {
    let filtered = [...notes]

    // 태그 검색 필터링
    if (tagSearch.trim()) {
      const searchTags = tagSearch
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)

      if (searchTags.length > 0) {
        filtered = filtered.filter((note) => {
          if (!note.tags || note.tags.length === 0) return false
          return searchTags.some((searchTag) =>
            note.tags!.some((noteTag) =>
              noteTag.toLowerCase().includes(searchTag)
            )
          )
        })
      }
    }

    // 이미 선택된 노트 제외
    if (excludeNoteIds.length > 0) {
      filtered = filtered.filter((note) => !excludeNoteIds.includes(note.id))
    }

    return filtered
  }, [notes, tagSearch, excludeNoteIds])

  const loadNotes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select(
        'id, title, description, category_large, category_medium, category_small, tags, created_at, updated_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      setLoading(false)
      return
    }

    if (data) {
      setNotes(data)
    }
    setLoading(false)
  }

  const columns = useMemo<ColumnDef<Note>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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
    ],
    []
  )

  const table = useReactTable({
    data: filteredNotes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    state: {
      sorting,
      rowSelection,
    },
  })

  const selectedNoteIds = useMemo(() => {
    return table.getSelectedRowModel().rows.map((row) => row.original.id)
  }, [rowSelection, table])

  const handleApply = () => {
    onSelect(selectedNoteIds)
    setRowSelection({})
    setTagSearch('')
    setSorting([])
    onClose()
  }

  const handleCancel = () => {
    setRowSelection({})
    setTagSearch('')
    setSorting([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>연관 노트 검색</DialogTitle>
        </DialogHeader>

        {/* Search Controls */}
        <div className="border-b bg-muted p-6">
          <div>
            <Label>태그로 검색</Label>
            <Input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="태그를 콤마(,)로 구분하여 입력 (예: 프로젝트, 개발)"
              className="mt-2"
            />
          </div>
        </div>

        {/* Notes Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              로딩 중...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {tagSearch.trim()
                ? '검색 결과가 없습니다.'
                : '노트가 없습니다.'}
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
                        className={row.getIsSelected() ? 'bg-muted' : ''}
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
        </div>

        {/* Footer */}
        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedNoteIds.length > 0
                ? `${selectedNoteIds.length}개 노트 선택됨`
                : '노트를 선택해주세요'}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={selectedNoteIds.length === 0}
              >
                적용 ({selectedNoteIds.length})
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
