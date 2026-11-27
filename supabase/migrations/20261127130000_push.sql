-- Alerts when the app is closed (web push).
-- A browser that has alerts turned on gives the app an address to send to. Those addresses are
-- stored here. The sending itself happens in a server function that holds the push key; the
-- database decides who may be alerted about what, so nobody can make another person's phone buzz
-- without a real, fresh reason (a message they just sent, a match that just happened).

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) < 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
create policy "own push subscriptions" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- When one person last caused an alert to another, to keep alerts from being repeated.
create table public.push_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  by_user uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  at timestamptz not null default now(),
  primary key (user_id, by_user, kind)
);
create index push_sent_by_idx on public.push_sent(by_user);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- This device now belongs to whoever is signed in on it. At most ten devices per person.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, v_user, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = v_user, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  delete from public.push_subscriptions s where s.user_id = v_user
    and s.endpoint not in (select endpoint from public.push_subscriptions where user_id = v_user order by created_at desc limit 10);
end;
$$;
create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- Whether the app is open is now noted for everyone, privately, so an alert is not sent to someone
-- who is looking at the app already. Who is shown as "online" still follows each person's setting.
create or replace function public.meet_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_shows boolean;
begin
  if v_user is null then return null; end if;
  select show_online into v_shows from public.meet_profiles where user_id = v_user;
  insert into public.meet_presence (user_id, seen_at) values (v_user, now())
  on conflict (user_id) do update set seen_at = now();
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

-- Who to alert, and what to call the person who caused it. Returns null unless:
--   * the caller really did just cause this (their message, or a notification they triggered, in the last two minutes);
--   * the same alert was not sent moments ago;
--   * the person is not looking at the app right now.
create or replace function public.push_targets(p_to uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v_actor uuid;
  v_name text;
  v_subs jsonb;
  v_gap interval := case when p_kind = 'message' then interval '10 seconds' else interval '1 minute' end;
begin
  if v_me is null or p_to is null or p_to = v_me then return null; end if;
  if p_kind = 'message' then
    select m.sender into v_actor from public.meet_messages m
    where m.recipient = p_to and m.created_at > now() - interval '2 minutes' and (m.sender = v_me or m.sent_by = v_me)
    order by m.created_at desc limit 1;
    if v_actor is null then return null; end if;
    v_name := public.meet_invite_person(v_actor)->>'name';
  elsif p_kind in ('match', 'invite_accepted', 'family_joined', 'family_suggested', 'photo_approved', 'photo_rejected') then
    select n.actor, case
        when n.actor is null then ''
        when n.kind in ('family_joined', 'family_suggested') then coalesce((select g.label from public.family_links g where g.person = p_to and g.helper = n.actor), '')
        else public.meet_invite_person(n.actor)->>'name' end
      into v_actor, v_name
    from public.meet_notifications n
    where n.user_id = p_to and n.kind = p_kind and n.created_at > now() - interval '2 minutes'
      and (n.actor = v_me
        or (n.actor is null and public.is_meet_admin())
        or exists (select 1 from public.family_links g where g.helper = v_me and not g.paused and g.person in (n.actor, n.user_id)))
    order by n.created_at desc limit 1;
    if not found then return null; end if;
  else
    return null;
  end if;

  if exists (select 1 from public.push_sent s where s.user_id = p_to and s.by_user = v_me and s.kind = p_kind and s.at > now() - v_gap) then return null; end if;
  insert into public.push_sent (user_id, by_user, kind) values (p_to, v_me, p_kind)
  on conflict (user_id, by_user, kind) do update set at = now();
  if exists (select 1 from public.meet_presence p where p.user_id = p_to and p.seen_at > now() - interval '75 seconds') then return null; end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) into v_subs
  from public.push_subscriptions s where s.user_id = p_to;
  if v_subs is null then return null; end if;
  return jsonb_build_object('name', coalesce(v_name, ''), 'actor', v_actor,
    'language', coalesce((select language from public.profiles where id = p_to), 'en'), 'subs', v_subs);
end;
$$;

-- Addresses the push service says no longer exist are removed. Only for someone the caller just alerted.
create or replace function public.push_gone(p_endpoints text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions s where s.endpoint = any(p_endpoints)
    and exists (select 1 from public.push_sent x where x.user_id = s.user_id and x.by_user = (select auth.uid()) and x.at > now() - interval '5 minutes');
$$;
revoke all on function public.push_subscribe(text, text, text), public.push_unsubscribe(text), public.push_targets(uuid, text), public.push_gone(text[]) from public, anon;
grant execute on function public.push_subscribe(text, text, text), public.push_unsubscribe(text), public.push_targets(uuid, text), public.push_gone(text[]) to authenticated;

-- The accept page needs to know whom to alert.
create or replace function public.open_family_invite(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', i.code, 'mine', i.person = (select auth.uid()), 'can_like', i.can_like, 'can_chat', i.can_chat,
    'person', i.person, 'name', public.meet_invite_person(i.person)->>'name',
    'already', exists (select 1 from public.family_links g where g.person = i.person and g.helper = (select auth.uid())))
  from public.family_invites i
  where i.code = p_code and i.expires_at > now()
    and (i.used_at is null or exists (select 1 from public.family_links g where g.person = i.person and g.helper = (select auth.uid())));
$$;
