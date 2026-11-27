-- Account deletion: by the person themselves, and by an owner from the admin portal.
-- Deleting the sign-in record removes everything that hangs from it (birth details, charts, readings,
-- questions, meet-and-match profile, likes, matches, messages, invites, notifications), because every
-- table refers to it with "on delete cascade".
-- Photo files are the one thing the database may not delete itself; they go through the storage
-- service. So the app removes the files first, and these functions refuse while any file is left.

-- The stored photo files of one person. A person may list their own; an owner may list anyone's.
create or replace function public.account_files(p_user uuid default null) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := coalesce(p_user, (select auth.uid()));
begin
  if v_user is null or (v_user <> (select auth.uid()) and public.meet_admin_role() is distinct from 'owner') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((select array_agg(name) from storage.objects where bucket_id = 'meet-photos' and name like v_user::text || '/%'), '{}');
end;
$$;

-- An owner may remove another person's photo files (needed before deleting their account).
create policy "meet photos: owner removes" on storage.objects for delete to authenticated
  using (bucket_id = 'meet-photos' and public.meet_admin_role() = 'owner');

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not allowed' using errcode = '42501'; end if;
  -- The portal must always have an owner.
  if exists (select 1 from public.meet_admins where user_id = v_user and role = 'owner')
     and (select count(*) from public.meet_admins where role = 'owner') = 1 then
    raise exception 'delete:last_owner' using errcode = 'P0001';
  end if;
  if cardinality(public.account_files(v_user)) > 0 then raise exception 'delete:photos' using errcode = 'P0001'; end if;
  delete from auth.users where id = v_user;
end;
$$;

create or replace function public.admin_delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meet_admin_role() is distinct from 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'delete:self' using errcode = 'P0001'; end if;
  -- Someone on the admin team is taken off the team first, as a separate, deliberate step.
  if exists (select 1 from public.meet_admins where user_id = p_user) then raise exception 'delete:admin' using errcode = 'P0001'; end if;
  if cardinality(public.account_files(p_user)) > 0 then raise exception 'delete:photos' using errcode = 'P0001'; end if;
  delete from auth.users where id = p_user;
end;
$$;
revoke all on function public.account_files(uuid), public.delete_my_account(), public.admin_delete_account(uuid) from public, anon;
grant execute on function public.account_files(uuid), public.delete_my_account(), public.admin_delete_account(uuid) to authenticated;
