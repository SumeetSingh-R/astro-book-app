-- Meet and match, stage 1: a person's own profile, photos and preferences.
-- Nothing here is visible to other people yet. Discover (stage 2) will add a read-only, filtered
-- way for others to see a profile; the tables themselves stay readable by their owner only,
-- so a detail someone has switched off can never be fetched directly.

-- What a person says about themselves.
create table public.meet_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  birth_year integer not null check (birth_year between 1900 and 2100),
  gender text not null check (gender in ('man', 'woman', 'other')),
  interested_in text not null check (interested_in in ('men', 'women', 'everyone')),
  looking_for text not null default 'marriage' check (looking_for in ('marriage', 'long_term', 'figuring_out')),
  about text not null default '' check (char_length(about) <= 300),
  height_cm integer check (height_cm between 120 and 230),
  education text not null default '' check (char_length(education) <= 80),
  work text not null default '' check (char_length(work) <= 80),
  city text not null default '' check (char_length(city) <= 80),
  marital_status text check (marital_status in ('never_married', 'divorced', 'widowed', 'separated')),
  diet text check (diet in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain')),
  drinking text check (drinking in ('never', 'socially', 'regularly')),
  smoking text check (smoking in ('never', 'sometimes', 'regularly')),
  interests text[] not null default '{}' check (cardinality(interests) <= 10),
  -- Background and family. Each of the first three has its own "show on my profile" switch.
  religion text not null default '' check (char_length(religion) <= 40),
  community text not null default '' check (char_length(community) <= 60),
  mother_tongue text not null default '' check (char_length(mother_tongue) <= 40),
  gotra text not null default '' check (char_length(gotra) <= 40),
  income_range text check (income_range in ('under_5', '5_10', '10_15', '15_20', '20_30', '30_50', 'over_50')),
  family_type text check (family_type in ('joint', 'nuclear')),
  parents text not null default '' check (char_length(parents) <= 120),
  siblings text not null default '' check (char_length(siblings) <= 120),
  show_religion boolean not null default true,
  show_community boolean not null default true,
  show_income boolean not null default true,
  -- Everyone can be found by default; these two let a person step back.
  discoverable boolean not null default true,
  only_liked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who a person wants to meet. An empty list means "open to all".
create table public.meet_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_min integer not null default 21 check (age_min between 18 and 80),
  age_max integer not null default 40 check (age_max between 18 and 80),
  height_min_cm integer check (height_min_cm between 120 and 230),
  looking_for text[] not null default '{}',
  marital_statuses text[] not null default '{}',
  religions text[] not null default '{}',
  communities text[] not null default '{}',
  mother_tongues text[] not null default '{}',
  income_min text check (income_min in ('under_5', '5_10', '10_15', '15_20', '20_30', '30_50', 'over_50')),
  min_score numeric(3, 1) not null default 18 check (min_score between 0 and 36),
  manglik text not null default 'any' check (manglik in ('any', 'no', 'yes')),
  updated_at timestamptz not null default now(),
  check (age_min <= age_max)
);

-- Up to six photos, in the order the person chose. Position 0 is the main photo.
create table public.meet_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  position integer not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, position) deferrable initially deferred
);
create index meet_photos_user_idx on public.meet_photos(user_id, position);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger meet_profiles_touch before update on public.meet_profiles for each row execute function public.touch_updated_at();
create trigger meet_preferences_touch before update on public.meet_preferences for each row execute function public.touch_updated_at();

alter table public.meet_profiles enable row level security;
alter table public.meet_preferences enable row level security;
alter table public.meet_photos enable row level security;

-- Each person reads and writes only their own rows. A profile can only be made by an adult.
create policy "own meet profile: read" on public.meet_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own meet profile: create as an adult" on public.meet_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and birth_year <= extract(year from now())::integer - 18);
create policy "own meet profile: change" on public.meet_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and birth_year <= extract(year from now())::integer - 18);
create policy "own meet profile: delete" on public.meet_profiles for delete to authenticated using (user_id = (select auth.uid()));

create policy "own meet preferences" on public.meet_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own meet photos" on public.meet_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The photo files. A private store: each person can add, see and remove files in their own folder only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meet-photos', 'meet-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "meet photos: see own" on storage.objects for select to authenticated
  using (bucket_id = 'meet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meet photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'meet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meet photos: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'meet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Save a new photo order in one step: the first id becomes the main photo. Runs as the caller,
-- so row-level security still limits it to their own photos.
create or replace function public.reorder_meet_photos(p_ids uuid[]) returns void
language sql security invoker set search_path = '' as $$
  update public.meet_photos p
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.user_id = (select auth.uid()) and o.ord <= 6;
$$;
revoke all on function public.reorder_meet_photos(uuid[]) from public, anon;
grant execute on function public.reorder_meet_photos(uuid[]) to authenticated;
