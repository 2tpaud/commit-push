'use client'

import { useState, useEffect, useRef } from 'react'

export interface UseSkeletonTimingOptions {
  /** 스켈레톤을 보여주기 전 대기 시간(ms). 이 시간 안에 로딩이 끝나면 스켈레톤을 아예 안 보임. 기본 120 */
  delayBeforeShow?: number
  /** 스켈레톤을 한 번 보여준 뒤 최소로 유지할 시간(ms). 깜빡임 방지. 기본 350 */
  minShowMs?: number
}

/**
 * 로딩이 너무 짧을 때 스켈레톤이 깜빡이지 않도록 타이밍을 조절하는 훅.
 * - 로딩이 delayBeforeShow 안에 끝나면 스켈레톤 미표시(빠른 응답은 그대로 노출)
 * - 스켈레톤을 보여준 경우 최소 minShowMs 동안 유지 후 콘텐츠로 전환
 */
export function useSkeletonTiming(
  loading: boolean,
  options: UseSkeletonTimingOptions = {}
) {
  const { delayBeforeShow = 120, minShowMs = 350 } = options
  const [showSkeleton, setShowSkeleton] = useState(false)
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skeletonShownAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading && !showSkeleton) {
      delayTimerRef.current = setTimeout(() => {
        delayTimerRef.current = null
        skeletonShownAtRef.current = Date.now()
        setShowSkeleton(true)
      }, delayBeforeShow)
      return () => {
        if (delayTimerRef.current) {
          clearTimeout(delayTimerRef.current)
          delayTimerRef.current = null
        }
      }
    }

    if (!loading && showSkeleton) {
      const shownAt = skeletonShownAtRef.current ?? Date.now()
      const elapsed = Date.now() - shownAt
      const remaining = Math.max(0, minShowMs - elapsed)

      if (remaining > 0) {
        minShowTimerRef.current = setTimeout(() => {
          minShowTimerRef.current = null
          skeletonShownAtRef.current = null
          setShowSkeleton(false)
        }, remaining)
      } else {
        skeletonShownAtRef.current = null
        setShowSkeleton(false)
      }
      return () => {
        if (minShowTimerRef.current) {
          clearTimeout(minShowTimerRef.current)
          minShowTimerRef.current = null
        }
      }
    }

    if (!loading && !showSkeleton) {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current)
        delayTimerRef.current = null
      }
      skeletonShownAtRef.current = null
    }
  }, [loading, showSkeleton, delayBeforeShow, minShowMs])

  return showSkeleton
}
