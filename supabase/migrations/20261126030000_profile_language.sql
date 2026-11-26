-- The language a person reads in is kept with their profile, so it follows them across devices.
alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'hi'));
