# CommitPush 데이터베이스 스키마

## users 테이블

### 테이블 생성

```sql
-- 1. users 테이블 생성
create table public.users (
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

-- 2. Row Level Security 활성화
alter table public.users enable row level security;

-- 3. RLS 정책
create policy "Users can manage their own profile"
on public.users
for all
using (auth.uid() = id)
with check (auth.uid() = id);
```

### 컬럼 설명

**테이블 설명**
- `public.users`: CommitPush 서비스 사용자 프로필 테이블. auth.users와 1:1 연결됨.

**컬럼 상세**

- `id` (uuid, primary key)
  - auth.users.id와 동일한 UUID. 인증 계정과 1:1 매핑되는 기본키.

- `email` (text, not null)
  - 사용자 이메일. auth.users와 동일하나 조회 최적화를 위해 중복 저장.

- `full_name` (text)
  - 사용자 표시 이름 (Google OAuth에서 가져올 수 있음).

- `avatar_url` (text)
  - 프로필 이미지 URL (OAuth 제공 값 저장용).

- `role` (text, default 'user')
  - 사용자 역할. 기본값 user. (user / admin / owner 등 확장 가능).

- `status` (text, default 'active')
  - 계정 상태. active / suspended / deleted 등 관리 목적.

- `plan` (text, default 'free')
  - SaaS 요금제 구분. free / pro / team 등 확장 대비.

- `plan_expires_at` (timestamp with time zone)
  - 유료 플랜 만료 시점. 구독 관리용.

- `total_notes` (integer, default 0)
  - 사용자가 생성한 총 노트 수. 성능 최적화를 위한 캐시 필드.

- `total_commits` (integer, default 0)
  - 사용자가 생성한 총 커밋 수. 통계/대시보드 최적화용.

- `organization_id` (uuid)
  - 팀 기능 확장 대비 필드. 추후 organizations 테이블과 연결 가능.

- `created_at` (timestamp with time zone, default now())
  - 사용자 프로필 생성 시각.

- `updated_at` (timestamp with time zone, default now())
  - 사용자 프로필 마지막 수정 시각.

### 보안 정책

- **Row Level Security (RLS)**: 활성화됨
- **정책**: "Users can manage their own profile"
  - 사용자는 자신의 프로필만 조회/수정/삭제 가능
  - `auth.uid() = id` 조건으로 본인 데이터만 접근 가능

### 자동 프로필 생성 트리거 (권장)

`auth.users`에 사용자가 생성될 때 자동으로 `public.users` 테이블에 프로필을 생성하는 트리거를 설정할 수 있습니다.

```sql
-- 함수: 새 사용자 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 트리거: auth.users에 새 사용자 생성 시 실행
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**참고**: 트리거를 사용하면 OAuth 콜백 핸들러에서 별도로 프로필을 생성할 필요가 없습니다. 하지만 현재 구현은 트리거가 없어도 동작하도록 이중으로 처리되어 있습니다.
