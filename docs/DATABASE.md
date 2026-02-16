# CommitPush 데이터베이스 스키마

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
-- 🔎 컬럼 설명(Comment)
--------------------------------------------------

comment on table public.users is
'CommitPush 서비스 사용자 프로필 테이블. auth.users와 1:1 연결됨.';

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
'사용자가 생성한 총 노트 수. 성능 최적화를 위한 캐시 필드.';

comment on column public.users.total_commits is
'사용자가 생성한 총 커밋 수. 통계/대시보드 최적화용.';

comment on column public.users.organization_id is
'팀 기능 확장 대비 필드. 추후 organizations 테이블과 연결 가능.';

comment on column public.users.created_at is
'사용자 프로필 생성 시각.';

comment on column public.users.updated_at is
'사용자 프로필 마지막 수정 시각.';
```

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage their own profile"
  - 사용자는 자신의 프로필만 조회/수정/삭제 가능 (`auth.uid() = id`)

### 자동 프로필 생성 트리거

`auth.users`에 사용자가 생성될 때 자동으로 `public.users` 테이블에 프로필을 생성하는 트리거입니다.

```sql
--------------------------------------------------
-- 4. 신규 유저 자동 생성 함수
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
-- 5. 트리거 설정
--------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
```

트리거는 `security definer`로 실행되므로 RLS 정책을 우회합니다.

## notes 테이블

### 테이블 생성

```sql
--------------------------------------------------
-- 1. NOTES TABLE 생성
--------------------------------------------------

create table public.notes (
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
'CommitPush의 노트 테이블. 하나의 노트는 여러 커밋을 가지는 작업 단위 컨테이너 역할을 한다.';

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
'외부 공유 링크용 고유 토큰.';

comment on column public.notes.is_public is
'노트 공개 여부. true이면 외부 접근 허용 가능.';

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

create table public.developer_notes (
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
'개발자 노트 테이블. 커밋 메시지 형식의 개발 작업 기록을 저장한다.';

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
