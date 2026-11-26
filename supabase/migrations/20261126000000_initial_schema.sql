-- Astro Book: initial schema

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.birth_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation text,
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  place_name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time_unknown or birth_time is not null)
);
create index birth_profiles_user_id_idx on public.birth_profiles(user_id);

create table public.charts (
  id uuid primary key default gen_random_uuid(),
  birth_profile_id uuid not null references public.birth_profiles(id) on delete cascade,
  system text not null check (system in ('vedic','western')),
  engine_version text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (birth_profile_id, system, engine_version)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_a uuid not null references public.birth_profiles(id) on delete cascade,
  profile_b uuid not null references public.birth_profiles(id) on delete cascade,
  system text not null check (system in ('vedic','western')),
  engine_version text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  check (profile_a <> profile_b)
);
create index matches_user_id_idx on public.matches(user_id);
create index matches_profile_a_idx on public.matches(profile_a);
create index matches_profile_b_idx on public.matches(profile_b);

create table public.daily_horoscopes (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('vedic','western')),
  sign smallint not null check (sign between 1 and 12),
  horoscope_date date not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (system, sign, horoscope_date)
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.birth_profiles enable row level security;
alter table public.charts enable row level security;
alter table public.matches enable row level security;
alter table public.daily_horoscopes enable row level security;

create policy "own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own birth profiles: read" on public.birth_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own birth profiles: insert" on public.birth_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own birth profiles: update" on public.birth_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own birth profiles: delete" on public.birth_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Charts and matches are written only by the server (service role); users read their own.
create policy "own charts: read" on public.charts
  for select to authenticated using (
    exists (select 1 from public.birth_profiles bp
            where bp.id = charts.birth_profile_id and bp.user_id = (select auth.uid()))
  );

create policy "own matches: read" on public.matches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own matches: delete" on public.matches
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Daily horoscopes are the same for everyone; signed-in users can read, only the server writes.
create policy "horoscopes: read" on public.daily_horoscopes
  for select to authenticated using (true);

-- Create a profile row automatically on sign-up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create trigger birth_profiles_touch
  before update on public.birth_profiles
  for each row execute function public.touch_updated_at();
