-- Hinglish ('hg') is the voice the app opens in: English with everyday Hindi mixed in, in Roman letters.
-- The three columns that record a language accept it, new accounts start in it, and accounts that were
-- on English (the old default, which nobody had to choose) move to it. English stays in the menu.
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check
  check (language in ('hg', 'en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));
alter table public.readings drop constraint if exists readings_language_check;
alter table public.readings add constraint readings_language_check
  check (language in ('hg', 'en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));
alter table public.chat_messages drop constraint if exists chat_messages_language_check;
alter table public.chat_messages add constraint chat_messages_language_check
  check (language in ('hg', 'en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'));
alter table public.profiles alter column language set default 'hg';
update public.profiles set language = 'hg' where language = 'en';
