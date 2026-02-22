/** 사이드바 "최근 항목"에 열어본 노트도 반영하기 위한 localStorage 키 */
const STORAGE_KEY = 'sidebarRecentOpened'
const MAX_ENTRIES = 100

export type RecentOpenedMap = Record<string, number>

export function getRecentOpenedMap(): RecentOpenedMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const arr = JSON.parse(raw) as { id: string; at: number }[]
    if (!Array.isArray(arr)) return {}
    const map: RecentOpenedMap = {}
    for (const { id, at } of arr.slice(0, MAX_ENTRIES)) {
      if (id && typeof at === 'number') map[id] = at
    }
    return map
  } catch {
    return {}
  }
}

/** 노트 목록이 바뀌었을 때 호출 (노트 저장/수정 후). 사이드바 노트 목록·최근 항목 재조회. */
export function notifySidebarNotesRefresh(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sidebarNotesRefresh'))
}

/** 노트를 열었을 때 호출 (노트 페이지에서 사용). 사이드바가 리렌더되면 최근 항목이 갱신됨. */
export function recordNoteOpened(noteId: string): void {
  if (typeof window === 'undefined' || !noteId?.trim()) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr: { id: string; at: number }[] = raw ? JSON.parse(raw) : []
    const at = Date.now()
    const next = [{ id: noteId.trim(), at }, ...arr.filter((e) => e.id !== noteId.trim())].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('sidebarRecentOpenedUpdated'))
  } catch {
    /* ignore */
  }
}
