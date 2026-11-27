-- Meet and match, stage 3: chat between matches, with block, report and unmatch.
-- Two people can message each other only while both like each other, neither has blocked the
-- other, and neither is suspended. The database checks this on every message.

create table public.meet_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.meet_blocks enable row level security;
create policy "own blocks" on public.meet_blocks for all to authenticated
  using (blocker = (select auth.uid())) with check (blocker = (select auth.uid()));

create or replace function public.meet_can_chat(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.meet_likes where liker = p_a and liked = p_b and kind = 'like')
     and exists (select 1 from public.meet_likes where liker = p_b and liked = p_a and kind = 'like')
     and not exists (select 1 from public.meet_blocks where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a))
     and not exists (select 1 from public.meet_suspensions where user_id in (p_a, p_b));
$$;
revoke all on function public.meet_can_chat(uuid, uuid) from public, anon;
grant execute on function public.meet_can_chat(uuid, uuid) to authenticated;

create table public.meet_messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);
create index meet_messages_pair_idx on public.meet_messages (least(sender, recipient), greatest(sender, recipient), created_at);
create index meet_messages_inbox_idx on public.meet_messages (recipient, created_at desc);
alter table public.meet_messages enable row level security;
revoke update, delete on public.meet_messages from authenticated;
create policy "my conversations: read" on public.meet_messages for select to authenticated
  using (sender = (select auth.uid()) or recipient = (select auth.uid()));
create policy "my conversations: send to a match" on public.meet_messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.meet_can_chat(sender, recipient));

-- Mark everything one person sent me as read.
create or replace function public.meet_mark_read(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  update public.meet_messages set read_at = now() where recipient = (select auth.uid()) and sender = p_other and read_at is null;
$$;
revoke all on function public.meet_mark_read(uuid) from public, anon;
grant execute on function public.meet_mark_read(uuid) to authenticated;

-- A report about another person, for the admin team.
create table public.meet_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('fake', 'photos', 'abusive', 'money', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (reporter <> reported)
);
alter table public.meet_reports enable row level security;
revoke update, delete on public.meet_reports from authenticated;
create policy "my reports: send" on public.meet_reports for insert to authenticated with check (reporter = (select auth.uid()) and status = 'open');
create policy "my reports: read" on public.meet_reports for select to authenticated using (reporter = (select auth.uid()));

-- Open reports for admins. Admins see what the reporter wrote, never the conversation itself.
create or replace function public.admin_reports() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_meet_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select jsonb_build_object('id', r.id, 'reason', r.reason, 'details', r.details, 'created_at', r.created_at,
    'reporter', coalesce(a.display_name, 'Someone'), 'reported_id', r.reported, 'reported', coalesce(b.display_name, 'Someone'),
    'reported_city', coalesce(b.city, ''), 'suspended', exists (select 1 from public.meet_suspensions s where s.user_id = r.reported),
    'reports_against', (select count(*) from public.meet_reports x where x.reported = r.reported))
  from public.meet_reports r
  left join public.meet_profiles a on a.user_id = r.reporter
  left join public.meet_profiles b on b.user_id = r.reported
  where r.status = 'open'
  order by r.created_at;
end;
$$;
create or replace function public.admin_close_report(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_meet_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.meet_reports set status = 'closed' where id = p_id;
end;
$$;
revoke all on function public.admin_reports(), public.admin_close_report(uuid) from public, anon;
grant execute on function public.admin_reports(), public.admin_close_report(uuid) to authenticated;

-- Discover, and so the list of matches, leaves out anyone blocked in either direction.
create or replace function public.discover_people() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select * from public.meet_profiles where user_id = (select auth.uid()))
  select jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'age', extract(year from now())::integer - p.birth_year,
    'gender', p.gender, 'looking_for', p.looking_for, 'about', p.about, 'height_cm', p.height_cm,
    'education', p.education, 'work', p.work, 'city', p.city, 'marital_status', p.marital_status,
    'diet', p.diet, 'drinking', p.drinking, 'smoking', p.smoking, 'interests', p.interests,
    'religion', case when p.show_religion then p.religion else '' end,
    'community', case when p.show_community then p.community else '' end,
    'mother_tongue', p.mother_tongue,
    'income_range', case when p.show_income then p.income_range end,
    'family_type', p.family_type, 'parents', p.parents, 'siblings', p.siblings,
    'keys', jsonb_build_object('moon_pada', k.moon_pada, 'mars_rashi', k.mars_rashi, 'mars_house', k.mars_house, 'lagna_rashi', k.lagna_rashi, 'time_known', k.time_known),
    'photos', coalesce((select jsonb_agg(ph.path order by ph.position) from public.meet_photos ph where ph.user_id = p.user_id and ph.status = 'approved'), '[]'::jsonb),
    'liked_me', exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'),
    'my_kind', (select l.kind from public.meet_likes l where l.liker = me.user_id and l.liked = p.user_id))
  from public.meet_profiles p
  join me on true
  join public.meet_keys k on k.user_id = p.user_id
  where p.user_id <> me.user_id
    and p.discoverable
    and not exists (select 1 from public.meet_suspensions s where s.user_id = p.user_id)
    and not exists (select 1 from public.meet_blocks b where (b.blocker = me.user_id and b.blocked = p.user_id) or (b.blocker = p.user_id and b.blocked = me.user_id))
    and (me.interested_in = 'everyone' or (me.interested_in = 'men' and p.gender = 'man') or (me.interested_in = 'women' and p.gender = 'woman'))
    and (p.interested_in = 'everyone' or (p.interested_in = 'men' and me.gender = 'man') or (p.interested_in = 'women' and me.gender = 'woman'))
    and (not p.only_liked or exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'));
$$;
