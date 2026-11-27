-- Invite to match: a link someone sends to a person they already know. When that person accepts,
-- both can see how their charts fit. Neither needs a meet-and-match profile, and only the match
-- keys and a first name are shared, never birth details.

create table public.meet_invites (
  code text primary key check (code ~ '^[a-z0-9]{10,16}$'),
  inviter uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index meet_invites_inviter_idx on public.meet_invites(inviter, created_at desc);
create table public.meet_invite_accepts (
  code text not null references public.meet_invites(code) on delete cascade,
  invitee uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (code, invitee)
);
alter table public.meet_invites enable row level security;
alter table public.meet_invite_accepts enable row level security;
revoke update on public.meet_invites from authenticated;
revoke insert, update, delete on public.meet_invite_accepts from authenticated;
create policy "own invites" on public.meet_invites for all to authenticated
  using (inviter = (select auth.uid())) with check (inviter = (select auth.uid()));
create policy "invites I accepted" on public.meet_invite_accepts for select to authenticated using (invitee = (select auth.uid()));

-- What one person may know about another through an invite: a first name, and the match keys.
create or replace function public.meet_invite_person(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', p_user,
    'name', coalesce((select display_name from public.meet_profiles where user_id = p_user),
                     (select split_part(trim(name), ' ', 1) from public.birth_profiles where user_id = p_user and is_self limit 1), 'Someone'),
    'gender', (select gender from public.meet_profiles where user_id = p_user),
    'keys', (select jsonb_build_object('moon_pada', moon_pada, 'mars_rashi', mars_rashi, 'mars_house', mars_house, 'lagna_rashi', lagna_rashi, 'time_known', time_known)
             from public.meet_keys where user_id = p_user));
$$;
revoke all on function public.meet_invite_person(uuid) from public, anon, authenticated;

-- Open a link: who sent it, and whether the caller has accepted. Null when the link is unknown or has expired.
create or replace function public.open_invite(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', i.code, 'mine', i.inviter = (select auth.uid()), 'expires_at', i.expires_at,
    'accepted', exists (select 1 from public.meet_invite_accepts a where a.code = i.code and a.invitee = (select auth.uid())),
    'inviter', public.meet_invite_person(i.inviter))
  from public.meet_invites i where i.code = p_code and i.expires_at > now();
$$;

-- Accept a link. The caller's own match keys must be saved first. Returns false when it cannot be accepted.
create or replace function public.accept_invite(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_inviter uuid;
begin
  select inviter into v_inviter from public.meet_invites where code = p_code and expires_at > now();
  if v_inviter is null or v_inviter = (select auth.uid()) then return false; end if;
  if not exists (select 1 from public.meet_keys where user_id = (select auth.uid())) then return false; end if;
  if exists (select 1 from public.meet_blocks where (blocker = v_inviter and blocked = (select auth.uid())) or (blocker = (select auth.uid()) and blocked = v_inviter)) then return false; end if;
  insert into public.meet_invite_accepts (code, invitee) values (p_code, (select auth.uid())) on conflict do nothing;
  return true;
end;
$$;

-- The caller's own links, newest first, with everyone who accepted each.
create or replace function public.my_invites() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', i.code, 'created_at', i.created_at, 'expires_at', i.expires_at, 'active', i.expires_at > now(),
    'accepts', coalesce((select jsonb_agg(public.meet_invite_person(a.invitee) || jsonb_build_object('accepted_at', a.created_at) order by a.created_at)
                         from public.meet_invite_accepts a where a.code = i.code), '[]'::jsonb))
  from public.meet_invites i where i.inviter = (select auth.uid()) order by i.created_at desc limit 20;
$$;
revoke all on function public.open_invite(text), public.accept_invite(text), public.my_invites() from public, anon;
grant execute on function public.open_invite(text), public.accept_invite(text), public.my_invites() to authenticated;
