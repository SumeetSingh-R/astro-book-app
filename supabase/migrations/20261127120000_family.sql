-- Family help: a person invites a parent (or another family member) who can then use meet and
-- match on their behalf. The person stays in control: they choose what the helper may do, can pause
-- or remove them at any moment, and can see everything the helper did.
--
--   always, while not paused : see the people the person can meet, and suggest them to the person
--   can_like                 : like or pass for the person
--   can_chat                 : read and reply to the person's chats (marked as sent by family)
--
-- A helper never sees the person's birth details, and cannot edit their profile, photos or filters,
-- block or report for them, or invite anyone else.

create table public.family_invites (
  code text primary key check (code ~ '^[a-z0-9]{10,16}$'),
  person uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  can_like boolean not null default false,
  can_chat boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
create index family_invites_person_idx on public.family_invites(person, created_at desc);

create table public.family_links (
  person uuid not null references auth.users(id) on delete cascade,
  helper uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  can_like boolean not null default false,
  can_chat boolean not null default false,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (person, helper),
  check (person <> helper)
);
create index family_links_helper_idx on public.family_links(helper);

create table public.family_suggestions (
  person uuid not null references auth.users(id) on delete cascade,
  suggested uuid not null references auth.users(id) on delete cascade,
  helper uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person, suggested),
  check (person <> suggested and person <> helper)
);
create index family_suggestions_helper_idx on public.family_suggestions(helper);
create index family_suggestions_suggested_idx on public.family_suggestions(suggested);

-- May the signed-in person act for p_user? Always for themselves; for someone else only through a
-- family link that is not paused and carries the permission asked for.
create or replace function public.meet_acts_for(p_user uuid, p_what text default 'view') returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = (select auth.uid()) or exists (
    select 1 from public.family_links g
    where g.person = p_user and g.helper = (select auth.uid()) and not g.paused
      and (p_what = 'view' or (p_what = 'like' and g.can_like) or (p_what = 'chat' and g.can_chat))
      and not exists (select 1 from public.meet_suspensions s where s.user_id = g.helper));
$$;
revoke all on function public.meet_acts_for(uuid, text) from public, anon;
grant execute on function public.meet_acts_for(uuid, text) to authenticated;

alter table public.family_invites enable row level security;
alter table public.family_links enable row level security;
alter table public.family_suggestions enable row level security;
revoke all on public.family_invites, public.family_links, public.family_suggestions from anon, authenticated;
grant select, insert, delete on public.family_invites to authenticated;
grant select, delete on public.family_links to authenticated;
grant update (label, can_like, can_chat, paused) on public.family_links to authenticated;
grant select, insert, delete on public.family_suggestions to authenticated;

create policy "own family invites: read" on public.family_invites for select to authenticated using (person = (select auth.uid()));
create policy "own family invites: make" on public.family_invites for insert to authenticated with check (person = (select auth.uid()) and used_at is null);
create policy "own family invites: remove" on public.family_invites for delete to authenticated using (person = (select auth.uid()));

create policy "family links: both sides read" on public.family_links for select to authenticated
  using (person = (select auth.uid()) or helper = (select auth.uid()));
create policy "family links: the person decides" on public.family_links for update to authenticated
  using (person = (select auth.uid())) with check (person = (select auth.uid()));
create policy "family links: either side ends it" on public.family_links for delete to authenticated
  using (person = (select auth.uid()) or helper = (select auth.uid()));

create policy "suggestions: both sides read" on public.family_suggestions for select to authenticated
  using (person = (select auth.uid()) or helper = (select auth.uid()));
create policy "suggestions: a helper suggests" on public.family_suggestions for insert to authenticated
  with check (helper = (select auth.uid()) and public.meet_acts_for(person));
create policy "suggestions: either side removes" on public.family_suggestions for delete to authenticated
  using (person = (select auth.uid()) or helper = (select auth.uid()));

-- ---------- what a helper may read and do ----------
create policy "family: read the person's profile" on public.meet_profiles for select to authenticated using (public.meet_acts_for(user_id));
create policy "family: read the person's filters" on public.meet_preferences for select to authenticated using (public.meet_acts_for(user_id));
create policy "family: read the person's match keys" on public.meet_keys for select to authenticated using (public.meet_acts_for(user_id));
create policy "family: read the person's photos" on public.meet_photos for select to authenticated using (public.meet_acts_for(user_id));

create policy "family: read the person's likes" on public.meet_likes for select to authenticated
  using (public.meet_acts_for(liker) or (kind = 'like' and public.meet_acts_for(liked)));
create policy "family: like for the person" on public.meet_likes for insert to authenticated
  with check (liker <> (select auth.uid()) and public.meet_acts_for(liker, 'like'));
create policy "family: change a like for the person" on public.meet_likes for update to authenticated
  using (liker <> (select auth.uid()) and public.meet_acts_for(liker, 'like'))
  with check (liker <> (select auth.uid()) and public.meet_acts_for(liker, 'like'));

create policy "family: read the person's chats" on public.meet_messages for select to authenticated
  using (public.meet_acts_for(sender, 'chat') or public.meet_acts_for(recipient, 'chat'));
create policy "family: reply for the person" on public.meet_messages for insert to authenticated
  with check (sender <> (select auth.uid()) and public.meet_acts_for(sender, 'chat') and public.meet_can_chat(sender, recipient));

-- "May these two chat" now also answers for a helper of either person.
create or replace function public.meet_can_chat(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (public.meet_acts_for(p_a) or public.meet_acts_for(p_b))
     and exists (select 1 from public.meet_likes where liker = p_a and liked = p_b and kind = 'like')
     and exists (select 1 from public.meet_likes where liker = p_b and liked = p_a and kind = 'like')
     and not exists (select 1 from public.meet_blocks where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a))
     and not exists (select 1 from public.meet_suspensions where user_id in (p_a, p_b));
$$;

-- ---------- who did it ----------
-- Every like and message records who really made it when that was not the person themselves.
-- The database fills these in, so they cannot be left out or faked.
alter table public.meet_likes add column acted_by uuid references auth.users(id) on delete set null;
alter table public.meet_messages add column sent_by uuid references auth.users(id) on delete set null;
create index meet_likes_acted_by_idx on public.meet_likes(acted_by) where acted_by is not null;
create index meet_messages_sent_by_idx on public.meet_messages(sent_by) where sent_by is not null;

create or replace function public.meet_likes_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.acted_by := case when (select auth.uid()) is distinct from new.liker then (select auth.uid()) end;
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then new.created_at := now(); end if;
  return new;
end;
$$;
create trigger meet_likes_stamp before insert or update on public.meet_likes
  for each row execute function public.meet_likes_stamp();

create or replace function public.meet_message_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_minute integer;
  v_day integer;
begin
  new.created_at := now();
  new.read_at := null;
  new.sent_by := case when (select auth.uid()) is distinct from new.sender then (select auth.uid()) end;
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into v_minute, v_day
  from public.meet_messages where sender = new.sender and created_at > now() - interval '1 day';
  if v_minute >= 20 then raise exception 'limit:minute' using errcode = 'P0001'; end if;
  if v_day >= 500 then raise exception 'limit:day' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.meet_messages where sender = new.recipient and recipient = new.sender)
     and (select count(*) from public.meet_messages where sender = new.sender and recipient = new.recipient) >= 5 then
    raise exception 'limit:first' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.meet_likes_stamp() from public, anon, authenticated;

-- ---------- invites ----------
create or replace function public.open_family_invite(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', i.code, 'mine', i.person = (select auth.uid()), 'can_like', i.can_like, 'can_chat', i.can_chat,
    'name', public.meet_invite_person(i.person)->>'name',
    'already', exists (select 1 from public.family_links g where g.person = i.person and g.helper = (select auth.uid())))
  from public.family_invites i
  where i.code = p_code and i.expires_at > now()
    and (i.used_at is null or exists (select 1 from public.family_links g where g.person = i.person and g.helper = (select auth.uid())));
$$;

-- Accept an invite. One link is for one helper. A person can have at most four helpers.
create or replace function public.accept_family_invite(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v public.family_invites;
begin
  select * into v from public.family_invites where code = p_code and expires_at > now() and used_at is null for update;
  if v.code is null or v_me is null or v.person = v_me then return false; end if;
  if exists (select 1 from public.family_links where person = v.person and helper = v_me) then return true; end if;
  if (select count(*) from public.family_links where person = v.person) >= 4 then return false; end if;
  if exists (select 1 from public.meet_blocks where (blocker = v.person and blocked = v_me) or (blocker = v_me and blocked = v.person)) then return false; end if;
  insert into public.family_links (person, helper, label, can_like, can_chat) values (v.person, v_me, btrim(v.label), v.can_like, v.can_chat);
  update public.family_invites set used_at = now() where code = p_code;
  return true;
end;
$$;

-- Both sides of the signed-in person's family help, in one call.
create or replace function public.my_family() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'helpers', coalesce((select jsonb_agg(jsonb_build_object('helper', g.helper, 'label', g.label, 'can_like', g.can_like, 'can_chat', g.can_chat,
        'paused', g.paused, 'created_at', g.created_at) order by g.created_at)
      from public.family_links g where g.person = (select auth.uid())), '[]'::jsonb),
    'helping', coalesce((select jsonb_agg(jsonb_build_object('person', g.person, 'name', public.meet_invite_person(g.person)->>'name',
        'can_like', g.can_like, 'can_chat', g.can_chat, 'paused', g.paused, 'created_at', g.created_at,
        'ready', exists (select 1 from public.meet_profiles p where p.user_id = g.person) and exists (select 1 from public.meet_keys k where k.user_id = g.person)) order by g.created_at)
      from public.family_links g where g.helper = (select auth.uid())), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('code', i.code, 'label', i.label, 'can_like', i.can_like, 'can_chat', i.can_chat,
        'expires_at', i.expires_at) order by i.created_at desc)
      from public.family_invites i where i.person = (select auth.uid()) and i.used_at is null and i.expires_at > now()), '[]'::jsonb));
$$;

-- What the signed-in person's helpers did for them, newest first.
create or replace function public.family_activity() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'at', x.at, 'by', x.label, 'name', x.name) order by x.at desc), '[]'::jsonb)
  from (
    select * from (
      select l.kind, l.created_at as at,
        (select g.label from public.family_links g where g.person = l.liker and g.helper = l.acted_by) as label,
        (select p.display_name from public.meet_profiles p where p.user_id = l.liked) as name
      from public.meet_likes l where l.liker = (select auth.uid()) and l.acted_by is not null
      union all
      select 'message', m.created_at,
        (select g.label from public.family_links g where g.person = m.sender and g.helper = m.sent_by),
        (select p.display_name from public.meet_profiles p where p.user_id = m.recipient)
      from public.meet_messages m where m.sender = (select auth.uid()) and m.sent_by is not null
      union all
      select 'suggest', s.created_at,
        (select g.label from public.family_links g where g.person = s.person and g.helper = s.helper),
        (select p.display_name from public.meet_profiles p where p.user_id = s.suggested)
      from public.family_suggestions s where s.person = (select auth.uid())
    ) u order by u.at desc limit 40
  ) x;
$$;
revoke all on function public.open_family_invite(text), public.accept_family_invite(text), public.my_family(), public.family_activity() from public, anon;
grant execute on function public.open_family_invite(text), public.accept_family_invite(text), public.my_family(), public.family_activity() to authenticated;

-- ---------- notifications ----------
alter table public.meet_notifications drop constraint meet_notifications_kind_check;
alter table public.meet_notifications add constraint meet_notifications_kind_check
  check (kind in ('match', 'photo_approved', 'photo_rejected', 'invite_accepted', 'family_joined', 'family_suggested'));

create or replace function public.family_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'family_links' and tg_op = 'INSERT' then
    insert into public.meet_notifications (user_id, kind, actor) values (new.person, 'family_joined', new.helper)
    on conflict (user_id, kind, actor) where actor is not null do update set created_at = now(), read_at = null;
  elsif tg_table_name = 'family_links' and tg_op = 'DELETE' then
    -- Ending the help removes the helper's suggestions and anything in the person's list that names them.
    delete from public.family_suggestions where person = old.person and helper = old.helper;
    delete from public.meet_notifications where user_id = old.person and actor = old.helper and kind in ('family_joined', 'family_suggested');
  elsif tg_table_name = 'family_suggestions' then
    insert into public.meet_notifications (user_id, kind, actor) values (new.person, 'family_suggested', new.helper)
    on conflict (user_id, kind, actor) where actor is not null do update set created_at = now(), read_at = null;
  end if;
  return null;
end;
$$;
revoke all on function public.family_notify() from public, anon, authenticated;
create trigger family_links_notify after insert or delete on public.family_links for each row execute function public.family_notify();
create trigger family_suggestions_notify after insert on public.family_suggestions for each row execute function public.family_notify();

-- The inbox names a helper by the label the person gave them.
create or replace function public.meet_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_shows boolean;
begin
  if v_user is null then return null; end if;
  select show_online into v_shows from public.meet_profiles where user_id = v_user;
  if coalesce(v_shows, false) then
    insert into public.meet_presence (user_id, seen_at) values (v_user, now())
    on conflict (user_id) do update set seen_at = now();
  else
    delete from public.meet_presence where user_id = v_user;
  end if;
  return jsonb_build_object(
    'unread_messages', coalesce((select sum(s.n) from (
        select count(*) as n from public.meet_messages m
        where m.recipient = v_user and m.read_at is null
        group by m.sender having public.meet_can_chat(m.sender, v_user)) s), 0),
    'notifications', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
        select n.created_at, jsonb_build_object('id', n.id, 'kind', n.kind, 'created_at', n.created_at, 'read', n.read_at is not null,
          'actor_id', n.actor, 'actor_name', case
            when n.actor is null then null
            when n.kind in ('family_joined', 'family_suggested') then (select g.label from public.family_links g where g.person = v_user and g.helper = n.actor)
            else public.meet_invite_person(n.actor)->>'name' end) as item
        from public.meet_notifications n where n.user_id = v_user
        order by n.created_at desc limit 30) x), '[]'::jsonb),
    'review', case when public.is_meet_admin() then jsonb_build_object(
        'photos', (select count(*) from public.meet_photos where status = 'pending'),
        'reports', (select count(*) from public.meet_reports where status = 'open')) end,
    'online', case when coalesce(v_shows, false) then coalesce((
        select jsonb_agg(p.user_id) from public.meet_presence p
        join public.meet_profiles pr on pr.user_id = p.user_id and pr.show_online
        where p.user_id <> v_user and p.seen_at > now() - interval '2 minutes' and public.meet_can_chat(v_user, p.user_id)), '[]'::jsonb)
      else '[]'::jsonb end);
end;
$$;

-- ---------- Discover, for oneself or for the person one helps ----------
drop function public.discover_people();
create or replace function public.discover_people(p_as uuid default null) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select * from public.meet_profiles where user_id = coalesce(p_as, (select auth.uid())) and public.meet_acts_for(user_id))
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
    'my_kind', (select l.kind from public.meet_likes l where l.liker = me.user_id and l.liked = p.user_id),
    -- Shown on a profile so the other side knows a family member may be acting for this person.
    'family_helps', exists (select 1 from public.family_links g where g.person = p.user_id and not g.paused and (g.can_like or g.can_chat)),
    -- For the person: which helper suggested this profile, by the label they gave them.
    'suggested_by', (select coalesce(g.label, '') from public.family_suggestions s left join public.family_links g on g.person = s.person and g.helper = s.helper
                     where s.person = me.user_id and s.suggested = p.user_id))
  from public.meet_profiles p
  join me on true
  join public.meet_keys k on k.user_id = p.user_id
  where p.user_id <> me.user_id
    and p.user_id <> (select auth.uid())
    and (p.discoverable or (exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like')
                         and exists (select 1 from public.meet_likes l where l.liker = me.user_id and l.liked = p.user_id and l.kind = 'like')))
    and not exists (select 1 from public.meet_suspensions s where s.user_id = p.user_id)
    and not exists (select 1 from public.meet_blocks b where (b.blocker = me.user_id and b.blocked = p.user_id) or (b.blocker = p.user_id and b.blocked = me.user_id))
    and (me.interested_in = 'everyone' or (me.interested_in = 'men' and p.gender = 'man') or (me.interested_in = 'women' and p.gender = 'woman'))
    and (p.interested_in = 'everyone' or (p.interested_in = 'men' and me.gender = 'man') or (p.interested_in = 'women' and me.gender = 'woman'))
    and (not p.only_liked or exists (select 1 from public.meet_likes l where l.liker = p.user_id and l.liked = me.user_id and l.kind = 'like'));
$$;
revoke all on function public.discover_people(uuid) from public, anon;
grant execute on function public.discover_people(uuid) to authenticated;

-- A like made by a helper that completes a match tells the person too: they were not there to see it.
create or replace function public.meet_notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_fresh boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then v_fresh := old.kind <> 'like'; end if;
  if tg_op <> 'DELETE' and new.kind = 'like' then
    if v_fresh
       and exists (select 1 from public.meet_likes where liker = new.liked and liked = new.liker and kind = 'like')
       and not exists (select 1 from public.meet_blocks where (blocker = new.liker and blocked = new.liked) or (blocker = new.liked and blocked = new.liker)) then
      insert into public.meet_notifications (user_id, kind, actor) values (new.liked, 'match', new.liker)
      on conflict (user_id, kind, actor) where actor is not null do update set created_at = now(), read_at = null;
      if new.acted_by is not null then
        insert into public.meet_notifications (user_id, kind, actor) values (new.liker, 'match', new.liked)
        on conflict (user_id, kind, actor) where actor is not null do update set created_at = now(), read_at = null;
      end if;
    end if;
    return null;
  end if;
  if tg_op = 'DELETE' then
    delete from public.meet_notifications where kind = 'match' and ((user_id = old.liker and actor = old.liked) or (user_id = old.liked and actor = old.liker));
  else
    delete from public.meet_notifications where kind = 'match' and ((user_id = new.liker and actor = new.liked) or (user_id = new.liked and actor = new.liker));
  end if;
  return null;
end;
$$;
