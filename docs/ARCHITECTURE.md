# CommitPush 아키텍처

## 기술 스택

### Frontend

Next.js (App Router)

TypeScript

TailwindCSS

shadcn/ui

### Authentication

Supabase Auth (Google OAuth). 공개 라우트: `/`(랜딩), `/pricing`(이용요금). `/login`은 `/`로 리다이렉트. 랜딩·이용요금에서 로그인/지금 시작하기 클릭 시 Google OAuth 직접 호출.

### Operational Database

Supabase (PostgreSQL)

- [데이터베이스 스키마](./DATABASE.md) - 테이블 구조 및 스키마 상세

### File Handling (Google Drive 첨부)

- **커밋푸시 첨부파일**: **사용자 본인** 구글 드라이브에서 파일 선택 후, **파일 자체는 업로드하지 않고** `commits.attachments`(jsonb)에 **파일명·열기 링크**(`name`, `web_view_link`)만 저장. 커밋 내역에서 파일명 클릭 시 해당 링크(Drive 뷰어 등)로 열림. 여러 사용자가 각자 자기 Drive에서 선택해 자기 링크만 저장하는 구조(확장성 있음).
- **구현**: `src/lib/googleDrivePicker.ts` — Google Identity Services(GIS)로 **Drive scope**(`drive.readonly`) 토큰 발급·캐시. `src/components/DrivePickerDialog.tsx` — **앱 자체 다이얼로그**로 Drive API v3 `files.list`로 폴더/파일 목록 조회, 경로 표시·위로 이동·다중 선택 후 `onSelect(files)`. (Google Picker iframe 대신 사용.)
- **환경 변수**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — 앱 배포용 Google OAuth 웹 클라이언트 ID(앱 1개당 1개). `NEXT_PUBLIC_GOOGLE_APP_ID`(선택) — 없어도 동작할 수 있음.

### Analytics (향후)

BigQuery 기반 실행 분석 시스템

### API (Next.js Route Handlers)

- **`/api/plan/check-expiry`**: 대시보드 진입·로그인 시 호출. `plan_expires_at`이 지난 유료 플랜 사용자를 `plan = 'free'`로 갱신.
- **`/api/payment/config`**: GET — 결제창용 `clientId` 반환 (클라이언트에서 나이스페이 SDK 전 환경 변수 노출 없이 조회).
- **`/api/payment/create`**: 나이스페이 주문 생성 후 결제창 호출용 `orderId`, `amount`, `goodsName` 반환.
- **`/api/payment/return`**: 결제 완료 후 콜백. 승인 API 호출 후 `payments` 갱신, `users.plan` / `users.plan_expires_at` 반영, `notifications`에 결제 완료 알림 삽입.
- **`/api/payment/webhook`**: 나이스페이 웹훅(결제 승인 시). GET/HEAD/OPTIONS는 URL 등록 검증용 200 반환. POST: 서명 검증 후 미처리 건만 승인 API 호출·DB 갱신, `notifications` 삽입. 응답 `Content-Type: text/html`, body `OK`.
- **`/api/notifications`**: GET — 로그인 사용자 알림 목록. PATCH `/api/notifications/[id]/read` — 읽음 처리.
- **`/api/activity`**: GET — 연도별 활동 집계(`year` 쿼리). 홈 활동 그래프(ContributionGraph)에서 노트·커밋의 **생성·수정** 일별 횟수 조회(노트/커밋 모두 `created_at`, `updated_at` 반영).
- **`/api/docs/[slug]`**: GET — 문서 원문 조회. `slug`는 `architecture` | `database` | `design` | `plan` | `product` 중 하나. 개발자 노트 등에서 docs 마크다운 로드 시 사용.

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
| `NICE_PAY_API_BASE` | 선택 | 나이스페이 승인 API 도메인 | 미설정 시 테스트(sandbox) 사용 |
| `NEXT_PUBLIC_NICE_PAY_SDK_URL` | 선택 | 결제창 JS 스크립트 URL | 미설정 시 테스트(sandbox) 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 선택 | Supabase 서비스 롤 키 | 웹훅에서 결제·알림 DB 갱신 시 필요. **서버 전용, 노출 금지** |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 선택 | Google OAuth 웹 클라이언트 ID(앱 1개당 1개) | 커밋푸시 "구글 드라이브에서 선택" 시 Picker API용. 사용자별 값이 아님. 각 사용자는 자기 Google 계정으로 로그인해 자기 Drive에서만 선택·링크 저장(파일 업로드 없음). |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | 선택 | Google Cloud 프로젝트 번호 | Picker API setAppId용. 없어도 동작할 수 있음. |

- Supabase 키는 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → Settings → API에서 확인.
- 나이스페이 키는 [나이스페이 개발정보](https://start.nicepay.co.kr/manual/admin/developers/key/info.do)에서 발급. 운영 배포 시 `NICE_PAY_API_BASE`·`NEXT_PUBLIC_NICE_PAY_SDK_URL`을 운영 도메인/URL로 설정하고 운영 키로 교체.
