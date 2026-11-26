-- Personal readings and "Ask your chart".

-- One saved person can be marked as the account holder's own chart.
alter table public.birth_profiles add column is_self boolean not null default false;
create unique index birth_profiles_one_self_idx on public.birth_profiles(user_id) where is_self;

-- Readings written by the AI model from engine-calculated facts. They are kept so a chart
-- (or a day) is only ever written up once per language.
create table public.readings (
  id uuid primary key default gen_random_uuid(),
  birth_profile_id uuid not null references public.birth_profiles(id) on delete cascade,
  kind text not null check (kind in ('chart', 'daily')),
  language text not null check (language in ('en', 'hi')),
  for_date date,
  engine_version text not null,
  model text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  check ((kind = 'daily') = (for_date is not null))
);
create index readings_lookup_idx on public.readings(birth_profile_id, kind, language, for_date);

-- The conversation on a chart: the person's questions and the answers.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  birth_profile_id uuid not null references public.birth_profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  language text not null default 'en' check (language in ('en', 'hi')),
  created_at timestamptz not null default now()
);
create index chat_messages_profile_idx on public.chat_messages(birth_profile_id, created_at);
create index chat_messages_user_idx on public.chat_messages(user_id);

-- How many AI requests each person has made today. Only the function below can write to it,
-- so the daily limit cannot be reset from the browser.
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('ask', 'reading')),
  count integer not null default 0,
  primary key (user_id, day, kind)
);

alter table public.readings enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_usage enable row level security;

create policy "own readings: read" on public.readings
  for select to authenticated using (
    exists (select 1 from public.birth_profiles bp
            where bp.id = readings.birth_profile_id and bp.user_id = (select auth.uid()))
  );
create policy "own readings: insert" on public.readings
  for insert to authenticated with check (
    exists (select 1 from public.birth_profiles bp
            where bp.id = readings.birth_profile_id and bp.user_id = (select auth.uid()))
  );

create policy "own chat: read" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own chat: insert" on public.chat_messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.birth_profiles bp
                where bp.id = chat_messages.birth_profile_id and bp.user_id = (select auth.uid()))
  );
create policy "own chat: delete" on public.chat_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own usage: read" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Count one AI request against today's allowance (days turn over at midnight India time).
-- Returns how many are left after this one, or -1 when the allowance is already used up.
create function public.consume_ai_quota(p_kind text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_kind not in ('ask', 'reading') or p_limit is null or p_limit < 1 then
    raise exception 'invalid quota request';
  end if;
  insert into public.ai_usage as u (user_id, day, kind, count)
  values (v_user, v_day, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_count;
  if v_count is null then
    return -1;
  end if;
  return p_limit - v_count;
end;
$$;
revoke execute on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;

-- Readings describe one set of birth details: when those change, the old readings go too.
create or replace function public.clear_stale_charts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.birth_date, new.birth_time, new.time_unknown, new.latitude, new.longitude, new.timezone)
     is distinct from
     (old.birth_date, old.birth_time, old.time_unknown, old.latitude, old.longitude, old.timezone) then
    delete from public.charts where birth_profile_id = new.id;
    delete from public.matches where profile_a = new.id or profile_b = new.id;
    delete from public.readings where birth_profile_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.clear_stale_charts() from public, anon, authenticated;
