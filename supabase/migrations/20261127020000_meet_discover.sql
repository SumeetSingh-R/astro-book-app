-- Meet and match, stage 2: Discover, likes and photo review.
-- Other people never read the profile tables directly. They get a filtered copy through
-- discover_people(), which leaves out anything a person has switched off, and they only ever see
-- photos that a reviewer has approved.

-- A photo is shown to others only after review. People cannot set the status themselves.
alter table public.meet_photos add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));
revoke insert, update on public.meet_photos from authenticated;
grant insert (user_id, path, position), update (position) on public.meet_photos to authenticated;

-- The few facts kundli matching needs, and nothing that gives away a birth date, time or place:
-- which quarter of which nakshatra the Moon is in, and where Mars sits.
create table public.meet_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  moon_pada integer not null check (moon_pada between 0 and 107),
  mars_rashi integer not null check (mars_rashi between 1 and 12),
  mars_house integer check (mars_house between 1 and 12),
  lagna_rashi integer check (lagna_rashi between 1 and 12),
  time_known boolean not null default true,
  updated_at timestamptz not null default now()
);

-- A like or a pass on someone. Two likes facing each other are a match.
create table public.meet_likes (
  liker uuid not null references auth.users(id) on delete cascade,
  liked uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (liker, liked),
  check (liker <> liked)
);
create index meet_likes_liked_idx on public.meet_likes(liked) where kind = 'like';

-- The people who review photos.
create table public.meet_admins (user_id uuid primary key references auth.users(id) on delete cascade);

alter table public.meet_keys enable row level security;
alter table public.meet_likes enable row level security;
alter table public.meet_admins enable row level security;

create policy "own meet keys" on public.meet_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own likes" on public.meet_likes for all to authenticated
  using (liker = (select auth.uid())) with check (liker = (select auth.uid()));
create policy "likes of me" on public.meet_likes for select to authenticated
  using (liked = (select auth.uid()) and kind = 'like');
create policy "am I a reviewer" on public.meet_admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_meet_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.meet_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_meet_admin() from public, anon;
grant execute on function public.is_meet_admin() to authenticated;

create policy "photo review: read" on public.meet_photos for select to authenticated using (public.is_meet_admin());

-- A reviewer approves or rejects a photo.
create or replace function public.review_meet_photo(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_meet_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.meet_photos set status = p_status where id = p_id;
end;
$$;
revoke all on function public.review_meet_photo(uuid, text) from public, anon;
grant execute on function public.review_meet_photo(uuid, text) to authenticated;

-- Whether a stored photo may be shown to the person asking: it is approved and its owner is
-- discoverable, or the person asking is a reviewer.
create or replace function public.meet_photo_visible(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_meet_admin() or exists (
    select 1 from public.meet_photos ph join public.meet_profiles pr on pr.user_id = ph.user_id
    where ph.path = p_path and ph.status = 'approved' and pr.discoverable);
$$;
revoke all on function public.meet_photo_visible(text) from public, anon;
grant execute on function public.meet_photo_visible(text) to authenticated;
create policy "meet photos: see approved" on storage.objects for select to authenticated
  using (bucket_id = 'meet-photos' and public.meet_photo_visible(name));

-- Everyone the caller can meet: discoverable people whose "show me" fits the caller and the other
-- way round. Religion, community and income are left out where their owner switched them off.
-- Birth details are not in any of these tables, so they cannot leak from here.
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
    and (me.interested_in = 'everyone' or (me.interested_in = 'men' and p.gender = 'man') or (me.interested_in = 'women' and p.gender = 'woman'))
    and (p.interested_in = 'everyone' or (p.interested_in = 'men' and me.gender = 'man') or (p.interested_in = 'women' and me.gender = 'woman'))
    and (not p.only_liked or exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'));
$$;
revoke all on function public.discover_people() from public, anon;
grant execute on function public.discover_people() to authenticated;
