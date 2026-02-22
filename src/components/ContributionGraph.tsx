'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

function formatDateKeyWithWeekday(key: string, cellMs: number): string {
  const dow = new Date(cellMs + KST_OFFSET_MS).getUTCDay()
  return `${formatDateKey(key)} ${WEEKDAYS[dow]}`
}

type DayMap = Record<string, { notes: number; commits: number }>

/** 시각(ms)을 KST 기준 날짜 문자열 YYYY-MM-DD로 (API와 동일) */
function dateKeyKST(timestampMs: number): string {
  const d = new Date(timestampMs + KST_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 시그니처 컬러 #1F2A44 계열: Less → More (투명도 15%, 35%, 55%, 100%)
const LEVEL_COLORS = [
  'bg-[#ebedf0] dark:bg-[#21262d]',           // 0
  'bg-[#1F2A44]/15 dark:bg-[#1F2A44]/20',     // 1
  'bg-[#1F2A44]/35 dark:bg-[#1F2A44]/45',     // 2
  'bg-[#1F2A44]/55 dark:bg-[#1F2A44]/65',     // 3
  'bg-[#1F2A44] dark:bg-[#1F2A44]',           // 4
] as const

function getLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0
  if (max <= 0) return 0
  const ratio = value / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const CELL_SIZE = 16
const CELL_GAP = 3
const WEEKDAY_WIDTH = 28
const MONTH_ROW_HEIGHT = 16
const GRID_LEFT_OFFSET = WEEKDAY_WIDTH - 8 + CELL_GAP

export function ContributionGraph() {
  const currentYear = new Date(Date.now() + KST_OFFSET_MS).getUTCFullYear()
  const [year, setYear] = useState(currentYear)
  const [byDate, setByDate] = useState<DayMap | null>(null)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeCommits, setIncludeCommits] = useState(true)

  const [meta, setMeta] = useState<{ notesFetched: number; commitsFetched: number; availableYears?: number[] } | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ wi: number; di: number } | null>(null)
  const gridWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setByDate({})
        return
      }
      const res = await fetch(`/api/activity?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setByDate({})
        return
      }
      const data: { byDate: DayMap; meta?: { notesFetched: number; commitsFetched: number; availableYears?: number[] } } = await res.json()
      setByDate(data.byDate ?? {})
      const nextMeta = data.meta ?? null
      setMeta(nextMeta)
      if (nextMeta?.availableYears?.length && !nextMeta.availableYears.includes(year)) {
        setYear(nextMeta.availableYears[nextMeta.availableYears.length - 1])
      }
    }
    run().catch(() => setByDate({}))
  }, [year])

  const { grid, total, maxPerDay, monthLabels, startSundayMs, startMs, endMs } = useMemo(() => {
    if (!byDate) return { grid: null, total: 0, maxPerDay: 0, monthLabels: [] as { label: string; colIndex: number; left: number }[], startSundayMs: 0, startMs: 0, endMs: 0 }

    const startMs = Date.UTC(year, 0, 1) - KST_OFFSET_MS
    const startNextYearMs = Date.UTC(year + 1, 0, 1) - KST_OFFSET_MS
    const dayMs = 24 * 60 * 60 * 1000

    const dayValues: number[] = []
    let total = 0
    let maxPerDay = 0
    for (let t = startMs; t < startNextYearMs; t += dayMs) {
      const key = dateKeyKST(t)
      const cell = byDate[key] ?? { notes: 0, commits: 0 }
      const value = (includeNotes ? cell.notes : 0) + (includeCommits ? cell.commits : 0)
      dayValues.push(value)
      total += value
      if (value > maxPerDay) maxPerDay = value
    }

    const firstDayKstDow = new Date(startMs + KST_OFFSET_MS).getUTCDay()
    const startSundayMs = startMs - firstDayKstDow * dayMs
    const numDays = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365
    const numWeeks = 53

    const weeks: number[][] = []
    const monthLabels: { label: string; colIndex: number }[] = []
    let lastMonth = -1

    for (let w = 0; w < numWeeks; w++) {
      const weekStartMs = startSundayMs + w * 7 * dayMs
      const weekStartKst = new Date(weekStartMs + KST_OFFSET_MS)
      const weekYear = weekStartKst.getUTCFullYear()
      const month = weekStartKst.getUTCMonth()
      if (weekYear !== year) {
        lastMonth = -1
      } else if (month !== lastMonth) {
        lastMonth = month
        monthLabels.push({ label: MONTHS[month], colIndex: w })
      }
      const row: number[] = []
      for (let dow = 0; dow < 7; dow++) {
        const cellMs = startSundayMs + (w * 7 + dow) * dayMs
        if (cellMs < startMs || cellMs >= startNextYearMs) {
          row.push(-1)
        } else {
          const idx = Math.floor((cellMs - startMs) / dayMs)
          row.push(idx >= 0 && idx < dayValues.length ? dayValues[idx] : 0)
        }
      }
      weeks.push(row)
    }

    const MIN_MONTH_GAP = 34
    let prevLeft = -MIN_MONTH_GAP
    const monthLabelsWithLeft = monthLabels.map((m) => {
      let left = WEEKDAY_WIDTH + m.colIndex * (CELL_SIZE + CELL_GAP)
      if (left < prevLeft + MIN_MONTH_GAP) left = prevLeft + MIN_MONTH_GAP
      prevLeft = left
      return { ...m, left }
    })

    return { grid: weeks, total, maxPerDay, monthLabels: monthLabelsWithLeft, startSundayMs, startMs, endMs: startNextYearMs - 1 }
  }, [byDate, includeNotes, includeCommits, year])

  if (byDate === null) {
    return (
      <div className="mx-auto w-fit max-w-full px-4 py-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-[3px]">
              <div className="mb-1 flex gap-[3px] pl-0">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 shrink-0" style={{ width: 28, minWidth: 28 }} />
                ))}
              </div>
              <div className="inline-flex gap-[3px]">
                <div className="flex flex-col justify-around gap-[3px] pr-2" style={{ width: WEEKDAY_WIDTH - 8 }}>
                  {WEEKDAYS.map((d) => (
                    <Skeleton key={d} className="h-3 w-4" />
                  ))}
                </div>
                <div className="flex gap-[3px]">
                  {Array.from({ length: 53 }).map((_, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {Array.from({ length: 7 }).map((_, di) => (
                        <Skeleton
                          key={di}
                          className="rounded-sm"
                          style={{ width: CELL_SIZE, height: CELL_SIZE, minWidth: CELL_SIZE, minHeight: CELL_SIZE }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-1">
            <Skeleton className="h-3 w-8" />
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-3 w-3 rounded-sm" />
              ))}
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-fit max-w-full px-4 py-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[#1F2A44] dark:text-foreground">
              <strong>{total.toLocaleString()}</strong>회 활동
            </p>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-[#1F2A44] dark:text-foreground"
            >
              {[...(meta?.availableYears ?? [currentYear])].reverse().map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#1F2A44] dark:text-foreground"
              >
                활동 설정
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white shadow-lg dark:bg-black dark:shadow-lg">
              <DropdownMenuCheckboxItem
                checked={includeNotes}
                onCheckedChange={setIncludeNotes}
              >
                <span className="font-medium">노트 활동</span>
              </DropdownMenuCheckboxItem>
              <p className="px-2 py-0.5 text-xs text-muted-foreground">
                해당 날짜에 생성·수정된 노트 수
                <br />
                (같은 날 둘 다면 2회)
              </p>
              <DropdownMenuCheckboxItem
                checked={includeCommits}
                onCheckedChange={setIncludeCommits}
              >
                <span className="font-medium">커밋 활동</span>
              </DropdownMenuCheckboxItem>
              <p className="px-2 py-0.5 text-xs text-muted-foreground">
                해당 날짜에 생성·수정된 커밋 수
                <br />
                (같은 날 둘 다면 2회)
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {grid && (
          <div className="overflow-x-auto overflow-y-hidden">
            <div
              ref={gridWrapperRef}
              className="inline-flex flex-col gap-[3px] min-h-0"
              onMouseMove={(e) => {
                const el = gridWrapperRef.current
                if (!el || !grid) return
                const rect = el.getBoundingClientRect()
                const scrollLeft = el.parentElement?.scrollLeft ?? 0
                const scrollTop = el.parentElement?.scrollTop ?? 0
                const contentX = e.clientX - rect.left + scrollLeft
                const contentY = e.clientY - rect.top + scrollTop
                if (contentY < MONTH_ROW_HEIGHT) {
                  setHoveredCell(null)
                  return
                }
                const gridX = contentX - GRID_LEFT_OFFSET
                if (gridX < 0) {
                  setHoveredCell(null)
                  return
                }
                const wi = Math.floor(gridX / (CELL_SIZE + CELL_GAP))
                const di = Math.floor((contentY - MONTH_ROW_HEIGHT) / (CELL_SIZE + CELL_GAP))
                if (wi < 0 || wi >= grid.length || di < 0 || di >= 7) {
                  setHoveredCell(null)
                  return
                }
                const value = grid[wi][di]
                const dayMs = 24 * 60 * 60 * 1000
                const cellMs = startSundayMs + (wi * 7 + di) * dayMs
                const inRange = cellMs >= startMs && cellMs <= endMs
                if (value < 0 || !inRange) {
                  setHoveredCell(null)
                  return
                }
                setHoveredCell({ wi, di })
              }}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <div
                className="relative h-4"
                style={{
                  width: WEEKDAY_WIDTH + 53 * (CELL_SIZE + CELL_GAP) - CELL_GAP,
                  minWidth: WEEKDAY_WIDTH + 53 * (CELL_SIZE + CELL_GAP) - CELL_GAP,
                }}
              >
                {monthLabels.map(({ label, colIndex, left }) => (
                  <span
                    key={`${label}-${colIndex}`}
                    className="absolute top-0 whitespace-nowrap text-xs text-muted-foreground"
                    style={{ left }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="inline-flex gap-[3px]">
                <div
                  className="flex flex-col justify-around gap-[3px] pr-2 text-xs text-muted-foreground shrink-0"
                  style={{ width: WEEKDAY_WIDTH - 8 }}
                >
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="h-3 leading-none">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex gap-[3px]">
                  {grid.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((value, di) => {
                        const dayMs = 24 * 60 * 60 * 1000
                        const cellMs = startSundayMs + (wi * 7 + di) * dayMs
                        const inRange = cellMs >= startMs && cellMs <= endMs
                        const dateKey = inRange ? dateKeyKST(cellMs) : ''
                        return (
                          <div
                            key={di}
                            className={cn(
                              'rounded-sm',
                              value < 0
                                ? 'bg-transparent'
                                : LEVEL_COLORS[getLevel(value, maxPerDay)]
                            )}
                            style={{ width: CELL_SIZE, height: CELL_SIZE, minWidth: CELL_SIZE, minHeight: CELL_SIZE }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {hoveredCell &&
              grid &&
              gridWrapperRef.current &&
              (() => {
                const { wi, di } = hoveredCell
                const value = grid[wi]?.[di] ?? -1
                const dayMs = 24 * 60 * 60 * 1000
                const cellMs = startSundayMs + (wi * 7 + di) * dayMs
                const dateKey = dateKeyKST(cellMs)
                const tooltipText = `${value}회 활동 · ${formatDateKeyWithWeekday(dateKey, cellMs)}`
                const rect = gridWrapperRef.current.getBoundingClientRect()
                const scrollLeft = gridWrapperRef.current.parentElement?.scrollLeft ?? 0
                const scrollTop = gridWrapperRef.current.parentElement?.scrollTop ?? 0
                const cellLeft = GRID_LEFT_OFFSET + wi * (CELL_SIZE + CELL_GAP)
                const cellTop = MONTH_ROW_HEIGHT + di * (CELL_SIZE + CELL_GAP)
                const left = rect.left - scrollLeft + cellLeft + CELL_SIZE / 2
                const top = rect.top - scrollTop + cellTop + CELL_SIZE + 4
                return createPortal(
                  <div
                    className="z-50 overflow-hidden rounded-md border border-border px-3 py-1.5 text-sm shadow-md bg-white text-[#1F2A44] dark:bg-[#0f0f0f] dark:text-white dark:border-[#2a2a2a] pointer-events-none"
                    style={{
                      position: 'fixed',
                      left,
                      top,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {tooltipText}
                  </div>,
                  document.body
                )
              })()}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            {LEVEL_COLORS.map((bg, i) => (
              <div
                key={i}
                className={cn('h-3 w-3 rounded-sm', bg)}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
