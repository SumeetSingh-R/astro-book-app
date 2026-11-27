-- Typing indicator and online status.

-- ---------- typing ----------
-- "Dev is typing…" is sent over a private socket channel named chat:<id>:<id>. Only the two people
-- named in the channel, while they are matched, may join it, listen on it or send on it.
create or replace function public.meet_chat_topic_ok(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  a uuid;
  b uuid;
begin
  if p_topic is null or p_topic !~ '^chat:[0-9a-f-]{36}:[0-9a-f-]{36}$' then return false; end if;
  a := split_part(p_topic, ':', 2)::uuid;
  b := split_part(p_topic, ':', 3)::uuid;
  return (select auth.uid()) in (a, b) and public.meet_can_chat(a, b);
exception when others then
  return false;
end;
$$;
revoke all on function public.meet_chat_topic_ok(text) from public, anon;
grant execute on function public.meet_chat_topic_ok(text) to authenticated;

create policy "chat channel: the matched pair listens" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.meet_chat_topic_ok((select realtime.topic())));
create policy "chat channel: the matched pair sends" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.meet_chat_topic_ok((select realtime.topic())));

-- ---------- online ----------
-- When the app checks its inbox (about once a minute while it is open) the time is noted. Someone
-- seen in the last two minutes counts as online, and only their matches are told. A person can
-- turn this off; then they are not shown as online, and they do not see who else is.
alter table public.meet_profiles add column show_online boolean not null default true;

create table public.meet_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.meet_presence enable row level security;
revoke all on public.meet_presence from anon, authenticated;

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
          'actor_id', n.actor, 'actor_name', case when n.actor is null then null else public.meet_invite_person(n.actor)->>'name' end) as item
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
revoke all on function public.meet_inbox() from public, anon;
grant execute on function public.meet_inbox() to authenticated;
