/** PushMind 일일 LLM 요청 한도 (user_llm_usage.request_count와 연동) */
export const PUSHMIND_DAILY_LIMIT = 50

/** 플랜별 노트/커밋 한도 (DB total_notes, total_commits와 연동). Plan 페이지·헤더 게이지 등에서 공용 */
export const PLAN_LIMITS = {
  free: { maxNotes: 50, maxCommits: 200 },
  pro: { maxNotes: 500, maxCommits: 2000 },
  team: { maxNotes: 2000, maxCommits: 10000 },
} as const

export type PlanId = keyof typeof PLAN_LIMITS

export function getLimitsForPlan(plan: string | null): { maxNotes: number; maxCommits: number } {
  const key = plan as PlanId
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.free
}
