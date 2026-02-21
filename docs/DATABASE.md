# CommitPush 데이터베이스 스키마

## SQL 재실행 시 동작

각 테이블의 SQL은 **이미 생성된 DB에서도 그대로 다시 실행해도 됩니다.** 재실행 시 에러가 나지 않도록 되어 있습니다.

| 항목 | 없을 때 | 이미 있을 때 |
|------|---------|----------------|
| **테이블** (`create table if not exists`) | 새로 생성 | **그대로 둠** (기존 테이블·데이터 유지, 덮어쓰기 아님) |
| **컬럼 추가** (`alter table ... add column if not exists`) | — | 컬럼 없으면 **추가**, 있으면 **그대로 둠** (기존 데이터·타입 유지) |
| **RLS 정책** (`drop policy if exists` 후 `create policy`) | 새로 생성 | 기존 정책 삭제 후 새 정책으로 **교체** |
| **함수** (`create or replace function`) | 새로 생성 | 내용만 **덮어씀** |
| **트리거** (`drop trigger if exists` 후 `create trigger`) | 새로 생성 | 기존 트리거 삭제 후 새 트리거로 **교체** |
| **코멘트** (`comment on ...`) | 새로 생성 | **덮어씀** |
| **인덱스** (`create index if not exists`) | 새로 생성 | 이미 있으면 **그대로 둠** (스킵) |

요약: **테이블**은 없으면 생성, 있으면 건드리지 않음(데이터 유지). **컬럼 추가**는 기존 테이블에 없는 컬럼만 추가. **정책·함수·트리거·코멘트**는 있으면 새 내용으로 갱신됨.

---

## users 테이블

### 테이블 생성

```sql
--------------------------------------------------
-- 1. users 테이블 생성
--------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,

  -- 기본 정보
  email text not null,
  full_name text,
  avatar_url text,

  -- 계정 상태
  role text default 'user',
  status text default 'active',

  -- 요금제 관련
  plan text default 'free',
  plan_expires_at timestamp with time zone,

  -- 사용 통계
  total_notes integer default 0,
  total_commits integer default 0,

  -- 팀 확장 대비
  organization_id uuid,

  -- 메타
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

--------------------------------------------------
-- 2. Row Level Security 활성화
--------------------------------------------------

alter table public.users enable row level security;

--------------------------------------------------
-- 3. RLS 정책
--------------------------------------------------

drop policy if exists "Users can manage their own profile" on public.users;

create policy "Users can manage their own profile"
on public.users
for all
using (auth.uid() = id)
with check (auth.uid() = id);

--------------------------------------------------
-- 4. 컬럼 설명(Comment)
--------------------------------------------------

comment on table public.users is
'CommitPush 서비스 사용자 프로필 테이블. auth.users와 1:1 연결';

comment on column public.users.id is
'auth.users.id와 동일한 UUID. 인증 계정과 1:1 매핑되는 기본키.';

comment on column public.users.email is
'사용자 이메일. auth.users와 동일하나 조회 최적화를 위해 중복 저장.';

comment on column public.users.full_name is
'사용자 표시 이름 (Google OAuth에서 가져올 수 있음).';

comment on column public.users.avatar_url is
'프로필 이미지 URL (OAuth 제공 값 저장용).';

comment on column public.users.role is
'사용자 역할. 기본값 user. (user / admin / owner 등 확장 가능).';

comment on column public.users.status is
'계정 상태. active / suspended / deleted 등 관리 목적.';

comment on column public.users.plan is
'SaaS 요금제 구분. free / pro / team 등 확장 대비.';

comment on column public.users.plan_expires_at is
'유료 플랜 만료 시점. 구독 관리용.';

comment on column public.users.total_notes is
'사용자가 생성한 총 노트 수. 성능 최적화를 위한 캐시 필드. notes INSERT/DELETE 시 트리거로 갱신됨.';

comment on column public.users.total_commits is
'사용자가 생성한 총 커밋 수. 통계/대시보드 최적화용. commits INSERT/DELETE 시 트리거로 갱신됨.';

comment on column public.users.organization_id is
'팀 기능 확장 대비 필드. 추후 organizations 테이블과 연결 가능.';

comment on column public.users.created_at is
'사용자 프로필 생성 시각.';

comment on column public.users.updated_at is
'사용자 프로필 마지막 수정 시각.';

--------------------------------------------------
-- 5. users.total_notes 갱신 함수
--------------------------------------------------

create or replace function public.update_users_note_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.users
    set total_notes = coalesce(total_notes, 0) + 1
    where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.users
    set total_notes = greatest(coalesce(total_notes, 0) - 1, 0)
    where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

--------------------------------------------------
-- 6. users.total_commits 갱신 함수
--------------------------------------------------

create or replace function public.update_users_commit_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.users
    set total_commits = coalesce(total_commits, 0) + 1
    where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.users
    set total_commits = greatest(coalesce(total_commits, 0) - 1, 0)
    where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

--------------------------------------------------
-- 7. users.total_notes 트리거 (notes 테이블 생성 후 실행)
--------------------------------------------------

drop trigger if exists trigger_update_users_note_count on public.notes;

create trigger trigger_update_users_note_count
after insert or delete on public.notes
for each row
execute function public.update_users_note_count();

--------------------------------------------------
-- 8. users.total_commits 트리거
--------------------------------------------------

drop trigger if exists trigger_update_users_commit_count on public.commits;

create trigger trigger_update_users_commit_count
after insert or delete on public.commits
for each row
execute function public.update_users_commit_count();

--------------------------------------------------
-- 9. 신규 유저 자동 생성 함수 (auth.users INSERT 시 프로필 생성)
--------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

--------------------------------------------------
-- 10. 트리거 설정 (auth.users INSERT 시 프로필 생성)
--------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
```

**실행 순서**: 7·8번 트리거는 notes/commits 테이블 생성 후 실행한다. 9·10번은 `auth.users`에 가입 시 `public.users` 프로필을 자동 생성하며, `security definer`로 RLS를 우회한다.

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage their own profile"
  - 사용자는 자신의 프로필만 조회/수정/삭제 가능 (`auth.uid() = id`)

## payments 테이블 (PG 결제 이력)

### 테이블 생성 및 업데이트

```sql
--------------------------------------------------
-- 1. 테이블 없으면 생성
--------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount integer not null,
  status text not null default 'pending',
  tid text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  billing_cycle text default 'monthly'
);

--------------------------------------------------
-- 2. 기존 테이블에 없는 컬럼만 추가 (있는 건 그대로)
--------------------------------------------------

alter table public.payments
  add column if not exists billing_cycle text default 'monthly';

--------------------------------------------------
-- 3. RLS 활성화 및 정책
--------------------------------------------------

alter table public.payments enable row level security;

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own payments" on public.payments;
create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

--------------------------------------------------
-- 4. COMMENT
--------------------------------------------------

comment on table public.payments is
'PG 결제 이력. 주문 생성 후 return URL에서 승인 API 호출 및 users.plan 갱신 시 사용';
comment on column public.payments.id is
'결제 이력 PK.';
comment on column public.payments.order_id is
'PG사에 전달하는 주문번호. return 콜백에서 조회용.';
comment on column public.payments.user_id is
'결제한 사용자. auth.users(id) 참조.';
comment on column public.payments.plan is
'결제 대상 플랜. pro | team';
comment on column public.payments.amount is
'결제 금액(원). 월 구독은 월액, 연 구독은 연간 할인가.';
comment on column public.payments.status is
'pending: 결제창 요청 후 대기, paid: 승인 완료, failed: 인증/승인 실패';
comment on column public.payments.tid is
'PG사 거래키. 승인 API 호출 후 저장.';
comment on column public.payments.paid_at is
'승인 완료 시각.';
comment on column public.payments.created_at is
'주문 생성 시각.';
comment on column public.payments.billing_cycle is
'결제 주기. monthly: 1개월 만료, annual: 12개월 만료';
```

**실행 순서**: users 테이블 생성 후 실행하면 됩니다.

**Plan 페이지 청구 내역**: `app/(dashboard)/plan/page.tsx`에서는 `status = 'paid'`인 행만 조회하여 승인일(`paid_at`), 금액(`amount`), 플랜(`plan`), 상태를 표시합니다.

## notifications 테이블 (앱 내 알림)

헤더 벨 아이콘에 표시하는 **앱 내 알림 전반**을 저장하는 테이블입니다. 현재는 결제 완료 알림(`payment_approved`)만 사용하며, 추후 팀 협업(초대·멘션 등)·기타 이벤트 알림으로 확장할 예정입니다. `type`으로 구분하고, 결제 알림만 `payment_id`를 사용합니다.

### 테이블 생성

```sql
--------------------------------------------------
-- 1. 테이블 없으면 생성
--------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payment_id uuid references public.payments(id) on delete set null,
  title text not null,
  body text,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  constraint notifications_payment_approved_unique
    unique (payment_id)
);

--------------------------------------------------
-- 2. RLS 활성화 및 정책
--------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

--------------------------------------------------
-- 3. COMMENT
--------------------------------------------------

comment on table public.notifications is
'앱 내 알림 전반. 결제 완료·팀 협업·기타 이벤트 확장 예정. 헤더 벨 아이콘에 표시';
comment on column public.notifications.id is
'알림 PK.';
comment on column public.notifications.user_id is
'알림 수신 사용자. auth.users(id) 참조.';
comment on column public.notifications.type is
'알림 유형. payment_approved(결제 완료) / 팀 초대·멘션 등 추후 확장.';
comment on column public.notifications.payment_id is
'결제 알림일 때만 사용. payments(id) 참조. 결제당 1건 제한(unique). 다른 type은 null.';
comment on column public.notifications.title is
'알림 제목.';
comment on column public.notifications.body is
'알림 본문.';
comment on column public.notifications.read_at is
'읽은 시각. null이면 미읽음.';
comment on column public.notifications.created_at is
'알림 생성 시각.';
```

**실행 순서**: payments 테이블 생성 후 실행하면 됩니다.

**알림 사용처**: 현재는 return URL·웹훅에서 결제 완료 시 1건 삽입. 대시보드 헤더 벨 아이콘(`SharedAppLayout`)에서 조회·표시하며, 클릭 시 읽음 처리(`PATCH /api/notifications/[id]/read`). 팀 협업 등 추가 알림은 동일 테이블에 `type`만 다르게 넣어 확장.

## notes 테이블

### 테이블 생성

```sql
--------------------------------------------------
-- 1. NOTES TABLE 생성
--------------------------------------------------

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  title text not null,
  description text,

  status text default 'active',

  category_large text,
  category_medium text,
  category_small text,

  tags text[],
  reference_urls text[],

  related_note_ids uuid[],

  share_token text unique,
  is_public boolean default false,

  commit_count integer default 0,

  last_commit_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

--------------------------------------------------
-- 2. 컬럼 설명 (COMMENT)
--------------------------------------------------

comment on table public.notes is
'CommitPush의 노트 테이블. 하나의 노트는 여러 커밋을 가지는 작업 단위 컨테이너 역할';

comment on column public.notes.id is
'노트의 고유 식별자(UUID). 기본키.';

comment on column public.notes.user_id is
'노트 소유자. auth.users.id와 연결됨.';

comment on column public.notes.title is
'노트 제목. 필수 입력값.';

comment on column public.notes.description is
'노트에 대한 간단한 설명 또는 요약.';

comment on column public.notes.status is
'노트 상태값. active / archived / completed 등으로 확장 가능.';

comment on column public.notes.category_large is
'대분류 카테고리. 상위 구분값.';

comment on column public.notes.category_medium is
'중분류 카테고리.';

comment on column public.notes.category_small is
'소분류 카테고리.';

comment on column public.notes.tags is
'노트에 부여된 태그 배열. 필터링 및 검색 용도.';

comment on column public.notes.reference_urls is
'노트와 관련된 외부 참고 URL 목록.';

comment on column public.notes.related_note_ids is
'연관된 다른 노트들의 UUID 배열. (향후 relation 테이블로 분리 가능)';

comment on column public.notes.share_token is
'외부 공유 링크용 고유 토큰. is_public이 true로 설정될 때 애플리케이션 레벨에서 자동 생성됨. 32자리 랜덤 문자열(영문 대소문자 + 숫자). 공유 URL 형식: {NEXT_PUBLIC_SHARE_DOMAIN}/notes/shared/{share_token}';

comment on column public.notes.is_public is
'노트 공개 여부. true이면 외부 접근 허용 가능. true로 설정될 때 share_token이 없으면 자동 생성됨. false로 변경되면 share_token이 null로 설정됨.';

comment on column public.notes.commit_count is
'해당 노트에 누적된 커밋 수. 성능 최적화용 캐시 필드.';

comment on column public.notes.last_commit_at is
'가장 최근 커밋이 생성된 시각. 정렬 최적화용.';

comment on column public.notes.created_at is
'노트 생성 시각.';

comment on column public.notes.updated_at is
'노트 최종 수정 시각.';

--------------------------------------------------
-- 3. updated_at 자동 갱신 트리거
--------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_set_updated_at on public.notes;

create trigger trigger_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

--------------------------------------------------
-- 4. RLS 활성화
--------------------------------------------------

alter table public.notes enable row level security;

--------------------------------------------------
-- 5. 기존 정책 삭제 (재실행 대비)
--------------------------------------------------

drop policy if exists "Users can manage own notes" on public.notes;

--------------------------------------------------
-- 6. RLS 정책
--------------------------------------------------

-- 기본 정책: 본인 노트만 접근 가능
create policy "Users can manage own notes"
on public.notes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- users.total_notes 트리거는 users 테이블 섹션에서 이미 생성됨 (7번)
```

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage own notes"
  - 사용자는 자신의 노트만 조회/수정/삭제 가능 (`auth.uid() = user_id`)

## developer_notes 테이블

### 테이블 생성

```sql
--------------------------------------------------
-- 1. DEVELOPER_NOTES TABLE 생성
--------------------------------------------------

create table if not exists public.developer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  title text not null,
  content text not null,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

--------------------------------------------------
-- 2. 컬럼 설명 (COMMENT)
--------------------------------------------------

comment on table public.developer_notes is
'개발자 노트 테이블. 커밋 메시지 형식의 개발 작업 기록을 저장';

comment on column public.developer_notes.id is
'개발자 노트의 고유 식별자(UUID). 기본키.';

comment on column public.developer_notes.user_id is
'노트 작성자. auth.users.id와 연결됨.';

comment on column public.developer_notes.title is
'노트 제목 (커밋 메시지 제목). 필수 입력값.';

comment on column public.developer_notes.content is
'노트 상세 내용 (커밋 메시지 본문). 마크다운 형식 지원.';

comment on column public.developer_notes.created_at is
'노트 생성 시각. 자동으로 현재 시간이 입력됨.';

comment on column public.developer_notes.updated_at is
'노트 최종 수정 시각.';

--------------------------------------------------
-- 3. updated_at 자동 갱신 트리거
--------------------------------------------------

drop trigger if exists trigger_set_updated_at_dev_notes on public.developer_notes;

create trigger trigger_set_updated_at_dev_notes
before update on public.developer_notes
for each row
execute function public.set_updated_at();

--------------------------------------------------
-- 4. RLS 활성화
--------------------------------------------------

alter table public.developer_notes enable row level security;

--------------------------------------------------
-- 5. RLS 정책
--------------------------------------------------

drop policy if exists "Users can manage own developer notes" on public.developer_notes;

create policy "Users can manage own developer notes"
on public.developer_notes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage own developer notes"
  - 사용자는 자신의 개발자 노트만 조회/수정/삭제 가능 (`auth.uid() = user_id`)

## commits 테이블

### 테이블 생성

```sql
--------------------------------------------------
-- 1. COMMITS TABLE 생성
--------------------------------------------------

create table if not exists public.commits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,

  title text not null,
  message text,

  attachments jsonb default '[]',
  reference_urls text[] default '{}',

  sequence integer default 0,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- 생성일 지정으로 사용자가 입력한 경우만 true. 수정 시 생성일 필드 노출 여부 판단용
  created_at_is_custom boolean default false
);

--------------------------------------------------
-- 2. 컬럼 설명 (COMMENT)
--------------------------------------------------

comment on table public.commits is
'CommitPush의 커밋 테이블. 노트에 대한 시간축 기록(커밋)을 저장';

comment on column public.commits.id is
'커밋의 고유 식별자(UUID). 기본키.';

comment on column public.commits.user_id is
'커밋 작성자. auth.users.id와 연결됨.';

comment on column public.commits.note_id is
'이 커밋이 속한 노트. notes.id와 연결됨.';

comment on column public.commits.title is
'커밋 제목. 필수 입력값.';

comment on column public.commits.message is
'커밋 본문(메모). 선택 입력.';

comment on column public.commits.attachments is
'첨부파일 목록. jsonb 배열. 예: [{"file_id","name","web_view_link","mime_type"}]';

comment on column public.commits.reference_urls is
'참고 URL 목록. 다중 입력.';

comment on column public.commits.sequence is
'같은 노트 내 커밋 순서. 노트별 타임라인 정렬용.';

comment on column public.commits.created_at is
'커밋푸시 버튼 클릭 시점(저장 시각).';

comment on column public.commits.updated_at is
'커밋 최종 수정 시각.';

comment on column public.commits.created_at_is_custom is
'생성일을 사용자가 생성일 지정으로 입력했으면 true. 수정 다이얼로그에서 생성일 지정 필드에 기존 값을 채울지 여부 판단용.';

--------------------------------------------------
-- 3. updated_at 자동 갱신 트리거
--------------------------------------------------

drop trigger if exists trigger_set_updated_at_commits on public.commits;

create trigger trigger_set_updated_at_commits
before update on public.commits
for each row
execute function public.set_updated_at();

--------------------------------------------------
-- 4. RLS 활성화
--------------------------------------------------

alter table public.commits enable row level security;

--------------------------------------------------
-- 5. RLS 정책
--------------------------------------------------

drop policy if exists "Users can manage own commits" on public.commits;

create policy "Users can manage own commits"
on public.commits
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

--------------------------------------------------
-- 6. 인덱스 (노트별 커밋 조회)
--------------------------------------------------

create index if not exists idx_commits_note_id on public.commits(note_id);
create index if not exists idx_commits_created_at on public.commits(created_at desc);

--------------------------------------------------
-- 7. notes.commit_count, last_commit_at 갱신 트리거
--------------------------------------------------

create or replace function public.update_note_commit_stats()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.notes
    set
      commit_count = coalesce(commit_count, 0) + 1,
      last_commit_at = new.created_at
    where id = new.note_id;
  elsif tg_op = 'DELETE' then
    update public.notes
    set commit_count = greatest(coalesce(commit_count, 0) - 1, 0)
    where id = old.note_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_update_note_commit_stats on public.commits;

create trigger trigger_update_note_commit_stats
after insert or delete on public.commits
for each row
execute function public.update_note_commit_stats();

-- users.total_commits 트리거는 users 테이블 섹션에서 이미 생성됨 (8번)
```

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage own commits"
  - 사용자는 자신의 커밋만 조회/수정/삭제 가능 (`auth.uid() = user_id`)

## users.total_notes / total_commits 기존 데이터 동기화

트리거 적용 전에 이미 존재하는 notes/commits 건수로 `users` 캐시를 맞출 때 아래를 한 번만 실행한다.

```sql
update public.users u
set
  total_notes = (select count(*) from public.notes n where n.user_id = u.id),
  total_commits = (select count(*) from public.commits c where c.user_id = u.id);
```
