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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
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
  /** true면 한 개만 선택 가능. 노트 선택(커밋푸시 등)용 */
  singleSelect?: boolean
  /** 다이얼로그 제목. singleSelect 시 "노트 선택" 등 */
  dialogTitle?: string
}

export default function RelatedNoteSearchDialog({
  user,
  isOpen,
  onClose,
  onSelect,
  excludeNoteIds = [],
  singleSelect = false,
  dialogTitle,
}: RelatedNoteSearchDialogProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectedId, setSelectedId] = useState<string | null>(null) // singleSelect일 때만 사용 (테이블 rowSelection과 분리해 멈춤 방지)
  const [titleSearch, setTitleSearch] = useState('')
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

    // 제목 검색 필터링
    if (titleSearch.trim()) {
      const q = titleSearch.trim().toLowerCase()
      filtered = filtered.filter((note) => note.title.toLowerCase().includes(q))
    }

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
  }, [notes, titleSearch, tagSearch, excludeNoteIds])

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
        header: ({ table }) =>
          singleSelect ? (
            <span className="text-muted-foreground text-xs">선택</span>
          ) : (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          ),
        cell: ({ row, table }) => {
          const isSelected = singleSelect
            ? selectedId === row.original.id
            : !!table.getState().rowSelection[row.original.id]
          return (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(value) => {
                if (singleSelect) {
                  setSelectedId(!!value ? row.original.id : null)
                } else {
                  setRowSelection((old) => ({
                    ...old,
                    [row.original.id]: !!value,
                  }))
                }
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select row"
            />
          )
        },
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
    [singleSelect, selectedId]
  )

  const rowSelectionForTable = singleSelect
    ? (selectedId ? { [selectedId]: true } : {})
    : rowSelection

  const table = useReactTable({
    data: filteredNotes,
    columns,
    getRowId: (row) => (row as Note).id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: singleSelect
      ? () => {} // 단일 선택은 selectedId로만 처리
      : setRowSelection,
    enableRowSelection: true,
    state: {
      sorting,
      rowSelection: rowSelectionForTable,
    },
  })

  const selectedNoteIds = useMemo(() => {
    if (singleSelect) return selectedId ? [selectedId] : []
    return Object.keys(rowSelection).filter((id) => rowSelection[id])
  }, [singleSelect, selectedId, rowSelection])

  const handleApply = () => {
    onSelect(selectedNoteIds)
    setRowSelection({})
    setSelectedId(null)
    setTitleSearch('')
    setTagSearch('')
    setSorting([])
    onClose()
  }

  const handleCancel = () => {
    setRowSelection({})
    setSelectedId(null)
    setTitleSearch('')
    setTagSearch('')
    setSorting([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? '연관 노트 검색'}</DialogTitle>
        </DialogHeader>

        {/* Search Controls (탭) */}
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

        {/* Notes Table */}
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
                        className={`${row.getIsSelected() ? 'bg-muted' : ''} cursor-pointer`}
                        onClick={() => {
                          if (singleSelect) {
                            setSelectedId((prev) => (prev === row.original.id ? null : row.original.id))
                          } else {
                            setRowSelection((prev) => ({
                              ...prev,
                              [row.original.id]: !prev[row.original.id],
                            }))
                          }
                        }}
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
                {singleSelect ? '선택' : `적용 (${selectedNoteIds.length})`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
