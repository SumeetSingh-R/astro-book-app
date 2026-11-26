-- The API runs as the signed-in user (no admin key), so users need permission to store
-- calculated charts and matches for their own birth profiles only.

create policy "own charts: insert" on public.charts
  for insert to authenticated with check (
    exists (select 1 from public.birth_profiles bp
            where bp.id = charts.birth_profile_id and bp.user_id = (select auth.uid()))
  );

create policy "own matches: insert" on public.matches
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.birth_profiles bp where bp.id = matches.profile_a and bp.user_id = (select auth.uid()))
    and exists (select 1 from public.birth_profiles bp where bp.id = matches.profile_b and bp.user_id = (select auth.uid()))
  );

-- When birth details change, stored charts and matches for that profile are out of date: remove them.
create function public.clear_stale_charts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.birth_date, new.birth_time, new.time_unknown, new.latitude, new.longitude, new.timezone)
     is distinct from
     (old.birth_date, old.birth_time, old.time_unknown, old.latitude, old.longitude, old.timezone) then
    delete from public.charts where birth_profile_id = new.id;
    delete from public.matches where profile_a = new.id or profile_b = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.clear_stale_charts() from public, anon, authenticated;

create trigger birth_profiles_clear_stale
  after update on public.birth_profiles
  for each row execute function public.clear_stale_charts();
