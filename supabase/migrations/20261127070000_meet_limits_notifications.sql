-- Meet and match: limits on messages, and notifications inside the app.

-- ---------- message limits ----------
-- Checked by the database on every message, so they hold whatever the app does:
--   * at most 20 messages a minute and 500 a day from one person;
--   * until the other person has replied once, at most 5 messages to them.
-- The time a message was sent is always set here, so it cannot be back-dated to get round a limit.
create index meet_messages_sender_idx on public.meet_messages (sender, created_at desc);
create index meet_messages_unread_idx on public.meet_messages (recipient) where read_at is null;

create or replace function public.meet_message_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_minute integer;
  v_day integer;
begin
  new.created_at := now();
  new.read_at := null;
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
revoke all on function public.meet_message_limits() from public, anon, authenticated;
create trigger meet_messages_limits before insert on public.meet_messages
  for each row execute function public.meet_message_limits();

-- ---------- notifications ----------
-- Written only by the database, when something happens that the person would want to know:
-- someone they liked likes them back, a photo is reviewed, or an invite link is accepted.
-- New messages are not stored here; they are counted from the messages themselves.
create table public.meet_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match', 'photo_approved', 'photo_rejected', 'invite_accepted')),
  actor uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index meet_notifications_once_idx on public.meet_notifications (user_id, kind, actor) where actor is not null;
create index meet_notifications_user_idx on public.meet_notifications (user_id, created_at desc);
create index meet_notifications_actor_idx on public.meet_notifications (actor);
alter table public.meet_notifications enable row level security;
revoke all on public.meet_notifications from anon, authenticated;
grant select on public.meet_notifications to authenticated;
create policy "own notifications" on public.meet_notifications for select to authenticated using (user_id = (select auth.uid()));

-- A like that completes a match tells the other person. A pass, an unmatch or a removed like takes that back.
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
create trigger meet_likes_notify after insert or update of kind or delete on public.meet_likes
  for each row execute function public.meet_notify_like();

-- Blocking someone removes anything in either person's list that names the other.
create or replace function public.meet_notify_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meet_notifications where (user_id = new.blocker and actor = new.blocked) or (user_id = new.blocked and actor = new.blocker);
  return null;
end;
$$;
create trigger meet_blocks_notify after insert on public.meet_blocks
  for each row execute function public.meet_notify_block();

-- A reviewed photo tells its owner. Several photos reviewed together make one line, not five.
create or replace function public.meet_notify_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text := 'photo_' || new.status;
begin
  if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    update public.meet_notifications set created_at = now() where user_id = new.user_id and kind = v_kind and read_at is null;
    if not found then insert into public.meet_notifications (user_id, kind) values (new.user_id, v_kind); end if;
  end if;
  return null;
end;
$$;
create trigger meet_photos_notify after update of status on public.meet_photos
  for each row execute function public.meet_notify_photo();

-- An accepted invite link tells the person who sent it.
create or replace function public.meet_notify_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_inviter uuid;
begin
  select inviter into v_inviter from public.meet_invites where code = new.code;
  if v_inviter is not null and v_inviter <> new.invitee then
    insert into public.meet_notifications (user_id, kind, actor) values (v_inviter, 'invite_accepted', new.invitee)
    on conflict (user_id, kind, actor) where actor is not null do update set created_at = now(), read_at = null;
  end if;
  return null;
end;
$$;
create trigger meet_invite_accepts_notify after insert on public.meet_invite_accepts
  for each row execute function public.meet_notify_invite();
revoke all on function public.meet_notify_like(), public.meet_notify_block(), public.meet_notify_photo(), public.meet_notify_invite() from public, anon, authenticated;

-- Everything the app needs for its badges and the notifications page, in one call:
-- unread messages from current matches, the latest notifications, and for admins what is waiting for review.
create or replace function public.meet_inbox() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'unread_messages', coalesce((select sum(s.n) from (
        select count(*) as n from public.meet_messages m
        where m.recipient = (select auth.uid()) and m.read_at is null
        group by m.sender having public.meet_can_chat(m.sender, (select auth.uid()))) s), 0),
    'notifications', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
        select n.created_at, jsonb_build_object('id', n.id, 'kind', n.kind, 'created_at', n.created_at, 'read', n.read_at is not null,
          'actor_id', n.actor, 'actor_name', case when n.actor is null then null else public.meet_invite_person(n.actor)->>'name' end) as item
        from public.meet_notifications n where n.user_id = (select auth.uid())
        order by n.created_at desc limit 30) x), '[]'::jsonb),
    'review', case when public.is_meet_admin() then jsonb_build_object(
        'photos', (select count(*) from public.meet_photos where status = 'pending'),
        'reports', (select count(*) from public.meet_reports where status = 'open')) end);
$$;

-- Mark the caller's notifications as read, and clear out read ones older than two months.
create or replace function public.meet_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.meet_notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null;
  delete from public.meet_notifications where user_id = (select auth.uid()) and read_at < now() - interval '60 days';
$$;
revoke all on function public.meet_inbox(), public.meet_notifications_read() from public, anon;
grant execute on function public.meet_inbox(), public.meet_notifications_read() to authenticated;
