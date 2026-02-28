# CommitPush 아키텍처

## 기술 스택

### Frontend

Next.js (App Router)

TypeScript

TailwindCSS

shadcn/ui

### Authentication

Supabase Auth (Google OAuth). **주요 라우트**: 공개 — `/`(랜딩), `/pricing`(이용요금). 로그인 필요 — `/plan`(요금제·결제), `/activity`, `/developer-notes`, `/notes/*` 등. `/login`은 `/`로 리다이렉트. 랜딩·이용요금에서 로그인/지금 시작하기 클릭 시 Google OAuth 직접 호출. (라우트·UI 상세는 [DESIGN.md](./DESIGN.md), 요금제는 [PLAN.md](./PLAN.md) 참고.)

### Operational Database

Supabase (PostgreSQL)

- [데이터베이스 스키마](./DATABASE.md) — 테이블 구조 및 스키마 상세. 요금제·한도는 `users.plan`, `users.plan_expires_at`, `users.total_notes`, `users.total_commits` 사용. 결제 이력은 `payments` 테이블. (요금제 정책·결제 흐름은 [PLAN.md](./PLAN.md) 참고.)

### File Handling (Google Drive 첨부)

- **커밋푸시 첨부파일**: **사용자 본인** 구글 드라이브에서 파일 선택 후, **파일 자체는 업로드하지 않고** `commits.attachments`(jsonb)에 **파일명·열기 링크**(`name`, `web_view_link`)만 저장. 커밋 내역에서 파일명 클릭 시 해당 링크(Drive 뷰어 등)로 열림. 여러 사용자가 각자 자기 Drive에서 선택해 자기 링크만 저장하는 구조(확장성 있음).
- **구현**: `src/lib/googleDrivePicker.ts` — Google Identity Services(GIS)로 **Drive scope**(`drive.readonly`) 토큰 발급·캐시. `src/components/DrivePickerDialog.tsx` — **앱 자체 다이얼로그**로 Drive API v3 `files.list`로 폴더/파일 목록 조회, 경로 표시·위로 이동·다중 선택 후 `onSelect(files)`. (Google Picker iframe 대신 사용.)
- **환경 변수**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — 앱 배포용 Google OAuth 웹 클라이언트 ID(앱 1개당 1개). `NEXT_PUBLIC_GOOGLE_APP_ID`(선택) — 없어도 동작할 수 있음.

### Analytics (향후)

BigQuery 기반 실행 분석 시스템

### API (Next.js Route Handlers)

- **`/api/plan/check-expiry`**: 대시보드 진입·로그인 시 **비동기** 호출(화면 진입 블로킹 없음). `plan_expires_at`이 지난 유료 플랜 사용자를 `plan = 'free'`, `plan_expires_at = null`로 갱신. 또한 만료 임박 시점(`D-3`, `D-1`)에는 `notifications`에 `plan_expiry_3days`/`plan_expiry_1day` 알림을 생성(동일 타입·동일 일자 중복 방지). (요금제·한도·결제 상세는 [PLAN.md](./PLAN.md) 참고.)
- **`/api/payment/config`**: GET — 결제창용 `clientId` 반환 (클라이언트에서 나이스페이 SDK 전 환경 변수 노출 없이 조회).
- **`/api/payment/create`**: 나이스페이 주문 생성 후 결제창 호출용 `orderId`, `amount`, `goodsName` 반환.
- **`/api/payment/return`**: 결제 완료/취소 후 콜백. GET은 취소로 간주. POST는 `authResultCode='0000'`일 때만 승인 API 호출 후 `payments`·`users.plan`·`plan_expires_at`·`notifications` 반영. PG 리다이렉트 시 세션 쿠키가 없으므로 **세션 없이** `SUPABASE_SERVICE_ROLE_KEY`로 `order_id` 기준 결제 조회·갱신. 응답은 PC/모바일 동일하게 **200 + HTML**(클라이언트 리다이렉트로 `/plan` 이동).
- **`/api/payment/cancel`**: 결제 승인 후 취소(환불) 처리. 요청 사용자 본인 결제 건(`payments.id`)만 처리하며, `status='paid'`이고 `paid_at` 기준 24시간 이내일 때만 나이스페이 취소 API 호출 후 `payments.status='cancelled'`로 갱신. 현재 플랜이 해당 결제로 반영된 상태면 `users.plan='free'`, `plan_expires_at=null`로 복구.
- **`/api/payment/webhook`**: 나이스페이 웹훅(결제 승인/취소 이벤트). GET/HEAD/OPTIONS는 URL 등록 검증용 200 반환. POST: 서명 검증 후 승인 이벤트는 승인 API 호출·DB 갱신 및 `payment_approved` 알림 삽입, 취소 이벤트(API/관리자 취소)는 `payments.status='cancelled'`·`users.plan='free'` 반영 및 `payment_cancelled` 알림 삽입. 응답 `Content-Type: text/html`, body `OK`.
- **`/api/notifications`**: GET — 로그인 사용자 알림 목록(`payment_approved`, `payment_cancelled`, `plan_expiry_3days`, `plan_expiry_1day` 등). PATCH `/api/notifications/[id]/read` — 읽음 처리.
- **`/api/activity`**: GET — 연도별 활동 집계(`year` 쿼리). 홈 활동 그래프(ContributionGraph)에서 노트·커밋의 **생성·수정** 일별 횟수 조회(노트/커밋 모두 `created_at`, `updated_at` 반영). 클라이언트: 레이아웃에서 세션 확보 시 현재 연도 **프리페치**, `src/lib/activityCache.ts`로 연도별 캐시·진행 중 요청 공유 → 재진입 시 로딩 최소화.
- **`/api/docs/[slug]`**: GET — 문서 원문 조회. `slug`는 `architecture` | `database` | `design` | `plan` | `product` | `payment-test-checklist` 중 하나. 개발자 노트 등에서 docs 마크다운 로드 시 사용.

**결제(Plan) 요약**: 주문 생성 → 결제창(나이스페이 JS SDK) → returnUrl POST 시 승인 API 호출 → `users`·`payments`·`notifications` 갱신. 이후 Plan 청구 내역에서 승인 24시간 이내 건은 `/api/payment/cancel`로 취소 가능하며, 성공 시 `payments.status='cancelled'` 반영 + `payment_cancelled` 알림이 생성됩니다. 또한 나이스페이 웹훅의 취소 이벤트(API/관리자 취소)에서도 동일한 취소 반영/알림이 수행됩니다. 만료일 지나면 check-expiry로 `plan = 'free'` 전환. 흐름·DB 변화·한도·환경 변수 상세는 [PLAN.md](./PLAN.md) 참고.

### Deployment

Vercel

**Vercel 배포 시 환경 변수** (프로젝트 설정 → Environment Variables에서 추가):

| 변수명 | 필수 | 용도 | 비고 |
|--------|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL | 클라이언트·API 공용 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon(공개) 키 | 클라이언트·API 공용 |
| `NEXT_PUBLIC_SHARE_DOMAIN` | 선택 | 노트 공유 링크 도메인 | 미설정 시 `window.location.origin` 사용. Vercel 도메인 연결 시 별도 설정 불필요. |
| `NEXT_PUBLIC_NICE_PAY_CLIENT_ID` | ✅ | 나이스페이 결제창 클라이언트 키 | 결제 사용 시 |
| `NICE_PAY_SECRET_KEY` | ✅ | 나이스페이 승인 API 시크릿 키 | 서버 전용(Vercel 환경변수에 넣으면 브라우저에 노출되지 않음) |
| `NICE_PAY_API_BASE` | ✅ (실결제 시) | 나이스페이 승인 API 도메인 | 미설정 시 sandbox 사용. **실결제(운영) 시 `https://api.nicepay.co.kr` 반드시 등록** (미등록 시 401/U116) |
| `NICE_PAY_MID` | ✅ | 나이스페이 취소 API용 MID | 서버 전용 |
| `NICE_PAY_CANCEL_API_URL` | 선택 | 나이스페이 취소 API URL | 미설정 시 `{NICE_PAY_API_BASE}/webapi/cancel_process.jsp` |
| `NEXT_PUBLIC_NICE_PAY_SDK_URL` | 선택 | 결제창 JS 스크립트 URL | 미설정 시 테스트(sandbox) 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (결제 사용 시) | Supabase 서비스 롤 키 | return URL·웹훅에서 결제·알림 DB 갱신 시 필요. **서버 전용, 노출 금지** |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 선택 | Google OAuth 웹 클라이언트 ID(앱 1개당 1개) | 커밋푸시 "구글 드라이브에서 선택" 시 Drive API(앱 내 피커)용. 사용자별 값이 아님. 각 사용자는 자기 Google 계정으로 로그인해 자기 Drive에서만 선택·링크 저장(파일 업로드 없음). **배포 환경 사용 시** 아래 "Google Drive 연동(배포)" 참고. |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | 선택 | Google Cloud 프로젝트 번호 | 없어도 동작할 수 있음. |

- **Google Drive 연동(배포)**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`에 쓰는 OAuth 2.0 클라이언트(웹 앱)에 **배포 도메인**을 반드시 등록해야 함. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → 해당 OAuth 2.0 Client ID 편집 → **Authorized JavaScript origins**에 `https://www.commitpush.cloud`(또는 실제 배포 도메인) 추가 → **Authorized redirect URIs**에 `https://www.commitpush.cloud` 와 `https://www.commitpush.cloud/` 추가(슬래시 유무 모두). 저장 후 수 분 내 반영. 미등록 시 "400 redirect_uri_mismatch" 발생.
- Supabase 키는 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → Settings → API에서 확인.
- 나이스페이 키는 [나이스페이 개발정보](https://start.nicepay.co.kr/manual/admin/developers/key/info.do)에서 발급. 운영 배포 시 `NICE_PAY_API_BASE`·`NEXT_PUBLIC_NICE_PAY_SDK_URL`을 운영 도메인/URL로 설정하고 운영 키로 교체. **결제 연동 환경 변수 기본값·운영 전환 상세**는 [PLAN.md](./PLAN.md) 5.1 참고.
