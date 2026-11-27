-- Astro Book can now be read in ten languages (see config/languages.mjs), so the three columns that
-- record a language accept all of them. Widening only: every existing row stays valid.
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check
  check (language in ('en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));

alter table public.readings drop constraint if exists readings_language_check;
alter table public.readings add constraint readings_language_check
  check (language in ('en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));

alter table public.chat_messages drop constraint if exists chat_messages_language_check;
alter table public.chat_messages add constraint chat_messages_language_check
  check (language in ('en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));
