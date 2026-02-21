# CommitPush 아키텍처

## 기술 스택

### Frontend

Next.js (App Router)

TypeScript

TailwindCSS

shadcn/ui

### Authentication

Supabase Auth (Google OAuth)

### Operational Database

Supabase (PostgreSQL)

- [데이터베이스 스키마](./DATABASE.md) - 테이블 구조 및 스키마 상세

### File Handling

사용자 Google Drive 연동

DB에는 파일 메타데이터만 저장

### Analytics (향후)

BigQuery 기반 실행 분석 시스템

### API (Next.js Route Handlers)

- **`/api/plan/check-expiry`**: 대시보드 진입·로그인 시 호출. `plan_expires_at`이 지난 유료 플랜 사용자를 `plan = 'free'`로 갱신.
- **`/api/payment/create`**: 나이스페이 주문 생성 후 결제창 호출용 `orderId`, `amount`, `goodsName` 반환.
- **`/api/payment/return`**: 결제 완료 후 콜백. 승인 API 호출 후 `payments` 갱신, `users.plan` / `users.plan_expires_at` 반영, `notifications`에 결제 완료 알림 삽입.
- **`/api/payment/webhook`**: 나이스페이 웹훅(결제 승인 시). 서명 검증 후 미처리 건만 승인 API 호출·DB 갱신, `notifications` 삽입. 응답 `Content-Type: text/html`, body `OK`.
- **`/api/notifications`**: GET — 로그인 사용자 알림 목록. PATCH `/api/notifications/[id]/read` — 읽음 처리.

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

- Supabase 키는 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → Settings → API에서 확인.
- 나이스페이 키는 [나이스페이 개발정보](https://start.nicepay.co.kr/manual/admin/developers/key/info.do)에서 발급. 운영 배포 시 `NICE_PAY_API_BASE`·`NEXT_PUBLIC_NICE_PAY_SDK_URL`을 운영 도메인/URL로 설정하고 운영 키로 교체.
