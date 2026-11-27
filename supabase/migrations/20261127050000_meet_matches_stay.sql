-- A person who pauses their profile disappears from Discover, but stays in the chats of people
-- they have already matched with, and those matches can still see their approved photos.
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
    and (p.discoverable or (exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like')
                         and exists (select 1 from public.meet_likes l where l.liker = me.user_id and l.liked = p.user_id and l.kind = 'like')))
    and not exists (select 1 from public.meet_suspensions s where s.user_id = p.user_id)
    and not exists (select 1 from public.meet_blocks b where (b.blocker = me.user_id and b.blocked = p.user_id) or (b.blocker = p.user_id and b.blocked = me.user_id))
    and (me.interested_in = 'everyone' or (me.interested_in = 'men' and p.gender = 'man') or (me.interested_in = 'women' and p.gender = 'woman'))
    and (p.interested_in = 'everyone' or (p.interested_in = 'men' and me.gender = 'man') or (p.interested_in = 'women' and me.gender = 'woman'))
    and (not p.only_liked or exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'));
$$;

create or replace function public.meet_photo_visible(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_meet_admin() or exists (
    select 1 from public.meet_photos ph join public.meet_profiles pr on pr.user_id = ph.user_id
    where ph.path = p_path and ph.status = 'approved'
      and not exists (select 1 from public.meet_suspensions s where s.user_id = ph.user_id)
      and (pr.discoverable or public.meet_can_chat((select auth.uid()), ph.user_id)));
$$;
