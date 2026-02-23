/**
 * 활동 그래프용 연도별 캐시. 레이아웃에서 프리페치한 결과를 ContributionGraph가 즉시 사용.
 */
export type ActivityCacheEntry = {
  byDate: Record<string, { notes: number; commits: number }>
  meta: { notesFetched: number; commitsFetched: number; availableYears?: number[] }
}

const cache = new Map<number, ActivityCacheEntry>()
const pending = new Map<number, Promise<ActivityCacheEntry | null>>()

export function getActivityCached(year: number): ActivityCacheEntry | null {
  return cache.get(year) ?? null
}

export function getActivityPending(year: number): Promise<ActivityCacheEntry | null> | null {
  return pending.get(year) ?? null
}

export function setActivityCached(year: number, entry: ActivityCacheEntry): void {
  cache.set(year, entry)
  pending.delete(year)
}

export function setActivityPending(year: number, promise: Promise<ActivityCacheEntry | null>): void {
  pending.set(year, promise)
  promise.then((entry) => {
    if (entry) cache.set(year, entry)
    pending.delete(year)
  })
}

export function clearActivityCache(): void {
  cache.clear()
  pending.clear()
}
