'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * 인증된 페이지 공통 로딩 스켈레톤 (헤더 + 메인 영역)
 */
export default function PageLoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Skeleton className="h-7 w-28" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="mb-4 h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * 테이블이 메인인 페이지(작업 로그, 개발자 노트)용 로딩 스켈레톤
 */
export function TablePageLoadingSkeleton({ tabCount = 2 }: { tabCount?: number }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Skeleton className="h-7 w-28" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <div className="flex gap-2">
              {Array.from({ length: tabCount }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24" />
              ))}
            </div>
          </div>
          <div className="rounded-md border">
            <div className="border-b p-4">
              <div className="flex gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 flex-1" />
                ))}
              </div>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b p-4 last:border-b-0">
                <Skeleton className="h-4 w-8" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * 다이얼로그 내부 테이블 로딩 스켈레톤 (연관 노트 검색, 노트 선택)
 */
export function DialogTableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <div className="flex gap-4 rounded-md border p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-md border p-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

/**
 * 다이얼로그 내부 폼 로딩 스켈레톤 (커밋푸시 수정 시 데이터 로드)
 */
export function DialogFormSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  )
}
