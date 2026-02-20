# CommitPush 요금제(Plan) 안내

SaaS 확장을 위한 요금제 구조와 `users` 테이블 연동, 한도 정책을 정리한 문서입니다.

---

## 1. 개요

- **플랜 구분**: `free` / `pro` / `team` (DB `users.plan` 값과 1:1 대응)
- **한도 기준**: `users.total_notes`, `users.total_commits` 캐시 필드를 사용해 노트·커밋 사용량 제한
- **만료 관리**: 유료 플랜은 `users.plan_expires_at`으로 구독 만료 시점 관리

---

## 2. DB 스키마 (users 테이블)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `plan` | text | 요금제 구분. `free` / `pro` / `team` 등. 기본값 `free`. |
| `plan_expires_at` | timestamptz | 유료 플랜 만료 시점. 구독 갱신/취소 시 업데이트. |
| `total_notes` | integer | 사용자가 생성한 총 노트 수. 성능/한도 체크용 캐시. |
| `total_commits` | integer | 사용자가 생성한 총 커밋 수. 통계/한도 체크용 캐시. |

- 트리거 또는 앱 로직으로 노트/커밋 생성·삭제 시 `total_notes`, `total_commits`를 갱신해야 한도가 정확히 동작합니다.

---

## 3. 플랜별 한도·가격·기능

코드 상 정의: `src/lib/planLimits.ts`의 `PLAN_LIMITS` (Plan 페이지·헤더 게이지 공용).

| 플랜 | 가격 | 노트 한도 | 커밋 한도 | 비고 |
|------|------|-----------|-----------|------|
| **Free** | 0원/월 | 50개 | 200개 | 기본 플랜, 기본 노트/커밋 관리 |
| **Pro** | 5,000원/월 | 500개 | 2,000개 | 노트 외부공유 가능 (결제 연동 예정) |
| **Team** | 7,000원/월 | 2,000개+ | 10,000개+ | 팀 공동작업 가능 (결제 연동 예정) |

- 실제 제한 적용은 서버/Edge에서 `users.total_notes`, `users.total_commits`와 위 한도를 비교해 수행하는 것을 권장합니다.
- **노트 외부 공유**(공유여부 ON)는 Pro/Team 플랜에서만 가능하며, Free 플랜에서 ON 시도 시 AlertDialog로 업그레이드 유도합니다.

---

## 4. UI/진입 경로

- **Plan 페이지**: `/plan` (로그인 필요, `app/(dashboard)/plan/page.tsx`)
- **헤더 (상단 우측)**: 사용량 게이지(노트/커밋), Plan 링크, 프로필 아바타(`avatar_url`, 마우스 오버 시 `full_name`), 로그아웃. 드롭다운 열 때마다 프로필(사용량) 재조회하여 게이지 최신화.
- Plan 페이지에서 표시하는 내용:
  - 현재 플랜(`plan`), 만료일(`plan_expires_at` 유무 시)
  - **현재 사용량**: 노트·커밋 각각 **게이지(진행률 바)** + `total_notes`/한도, `total_commits`/한도
  - Free / Pro / Team 3가지 플랜 카드 (가격 0원·5,000원·7,000원/월, 특징, “현재 플랜” 뱃지)

---

## 5. 결제 연동 (예정)

- PG사 가입 후 결제창 연동 시:
  - 결제 성공/갱신 시 `users.plan`, `users.plan_expires_at` 업데이트
  - 필요 시 `subscriptions` 또는 `payments` 테이블 추가하여 이력 관리
- Plan 페이지의 “준비 중” 버튼을 결제/업그레이드 플로우로 교체하면 됩니다.

---

## 6. 한도 체크 권장 위치

- **노트 생성**: `INSERT` 전 또는 API에서 `total_notes < PLAN_LIMITS[plan].maxNotes` 여부 확인
- **커밋 생성**: 동일하게 `total_commits`와 `maxCommits` 비교
- 만료: `plan !== 'free'`이고 `plan_expires_at < now()`이면 플랜을 `free`로 다운그레이드하거나 접근 제한 처리

---

## 7. 관련 파일

- **한도 상수**: `src/lib/planLimits.ts` — `PLAN_LIMITS`, `getLimitsForPlan()` (Plan 페이지·헤더 게이지 공용)
- **헤더**: `src/components/SharedAppLayout.tsx` — 사용량 게이지, Plan 링크, 프로필 아바타(`avatar_url`, `full_name`), 로그아웃 (드롭다운 오픈 시 프로필 재조회)
- **아바타 UI**: `src/components/ui/avatar.tsx` — shadcn 스타일 Avatar (AvatarImage, AvatarFallback)
- **페이지**: `app/(dashboard)/plan/page.tsx` — 요금제 소개, 현재 사용량 게이지, 플랜 카드 (`@/lib/planLimits` 사용)
- **레이아웃**: Plan은 `app/(dashboard)/layout.tsx` 하위에서 인증·SharedAppLayout 공유 (별도 plan 전용 layout 없음)
- **노트 공유 제한**: `app/(dashboard)/notes/[id]/page.tsx` — 공유여부 Switch는 Pro/Team일 때만 ON 가능, Free 시 AlertDialog로 업그레이드 유도

이 문서는 요금제 구조와 DB 연동을 정리한 안내서이며, 실제 결제·약관은 PG 및 법적 요구사항에 맞춰 별도 보완해야 합니다.
