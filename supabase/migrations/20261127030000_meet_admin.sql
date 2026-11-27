-- The admin portal: roles, an overview, managing people, and the admin team.
-- Admins sign in like anyone else; what makes them an admin is a row in meet_admins, checked by
-- the database on every admin action. Owners can manage the team; reviewers cannot.
-- Admins never see birth details, charts, readings or conversations.

alter table public.meet_admins add column role text not null default 'reviewer' check (role in ('owner', 'reviewer'));
alter table public.meet_admins add column created_at timestamptz not null default now();

create or replace function public.meet_admin_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.meet_admins where user_id = (select auth.uid());
$$;

-- A profile an admin has taken out of Discover. Its owner can see that it happened, and why.
create table public.meet_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
alter table public.meet_suspensions enable row level security;
create policy "own suspension: read" on public.meet_suspensions for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_meet_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'new_this_week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'profiles', (select count(*) from public.meet_profiles),
    'discoverable', (select count(*) from public.meet_profiles p where p.discoverable and not exists (select 1 from public.meet_suspensions s where s.user_id = p.user_id)),
    'suspended', (select count(*) from public.meet_suspensions),
    'photos_pending', (select count(*) from public.meet_photos where status = 'pending'),
    'photos_approved', (select count(*) from public.meet_photos where status = 'approved'),
    'photos_rejected', (select count(*) from public.meet_photos where status = 'rejected'),
    'likes', (select count(*) from public.meet_likes where kind = 'like'),
    'matches', (select count(*) from public.meet_likes a join public.meet_likes b on b.liker = a.liked and b.liked = a.liker where a.kind = 'like' and b.kind = 'like' and a.liker < a.liked),
    'charts_saved', (select count(*) from public.birth_profiles),
    'questions_asked', (select count(*) from public.chat_messages where role = 'user'));
end;
$$;

-- People with a meet-and-match profile, newest first. Email is shown to owners only.
create or replace function public.admin_people(p_search text default '') returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := public.meet_admin_role();
begin
  if v_role is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'age', extract(year from now())::integer - p.birth_year,
    'gender', p.gender, 'city', p.city, 'looking_for', p.looking_for, 'created_at', p.created_at, 'discoverable', p.discoverable,
    'email', case when v_role = 'owner' then u.email end,
    'suspended', s.user_id is not null, 'reason', coalesce(s.reason, ''),
    'photos', (select count(*) from public.meet_photos ph where ph.user_id = p.user_id),
    'photos_pending', (select count(*) from public.meet_photos ph where ph.user_id = p.user_id and ph.status = 'pending'))
  from public.meet_profiles p
  join auth.users u on u.id = p.user_id
  left join public.meet_suspensions s on s.user_id = p.user_id
  where coalesce(p_search, '') = '' or p.display_name ilike '%' || p_search || '%' or p.city ilike '%' || p_search || '%' or (v_role = 'owner' and u.email ilike '%' || p_search || '%')
  order by p.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_on boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_meet_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_on then
    insert into public.meet_suspensions (user_id, reason) values (p_user, left(coalesce(p_reason, ''), 300))
    on conflict (user_id) do update set reason = excluded.reason;
  else
    delete from public.meet_suspensions where user_id = p_user;
  end if;
end;
$$;

-- The admin team. Only owners can see and change it.
create or replace function public.admin_team() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.meet_admin_role() is distinct from 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select jsonb_build_object('user_id', a.user_id, 'email', u.email, 'role', a.role, 'created_at', a.created_at)
  from public.meet_admins a join auth.users u on u.id = a.user_id order by a.created_at;
end;
$$;

-- Give an existing account an admin role, by its email. Returns false when no account has that email.
create or replace function public.admin_grant(p_email text, p_role text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if public.meet_admin_role() is distinct from 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role not in ('owner', 'reviewer') then raise exception 'bad role' using errcode = '22023'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return false; end if;
  insert into public.meet_admins (user_id, role) values (v_user, p_role) on conflict (user_id) do update set role = excluded.role;
  return true;
end;
$$;

create or replace function public.admin_revoke(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meet_admin_role() is distinct from 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'You cannot remove yourself.' using errcode = '22023'; end if;
  delete from public.meet_admins where user_id = p_user;
end;
$$;

revoke all on function public.meet_admin_role(), public.admin_overview(), public.admin_people(text), public.admin_set_suspended(uuid, boolean, text),
  public.admin_team(), public.admin_grant(text, text), public.admin_revoke(uuid) from public, anon;
grant execute on function public.meet_admin_role(), public.admin_overview(), public.admin_people(text), public.admin_set_suspended(uuid, boolean, text),
  public.admin_team(), public.admin_grant(text, text), public.admin_revoke(uuid) to authenticated;

-- A suspended profile is out of Discover and its photos are hidden from others.
create or replace function public.meet_photo_visible(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_meet_admin() or exists (
    select 1 from public.meet_photos ph join public.meet_profiles pr on pr.user_id = ph.user_id
    where ph.path = p_path and ph.status = 'approved' and pr.discoverable
      and not exists (select 1 from public.meet_suspensions s where s.user_id = ph.user_id));
$$;

-- Discover leaves suspended profiles out.
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
    and (me.interested_in = 'everyone' or (me.interested_in = 'men' and p.gender = 'man') or (me.interested_in = 'women' and p.gender = 'woman'))
    and (p.interested_in = 'everyone' or (p.interested_in = 'men' and me.gender = 'man') or (p.interested_in = 'women' and me.gender = 'woman'))
    and (not p.only_liked or exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'));
$$;
