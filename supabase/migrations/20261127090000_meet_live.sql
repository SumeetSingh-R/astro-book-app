-- Live delivery: new messages, read receipts and notifications are pushed to the app over a socket
-- (Supabase Realtime) instead of waiting for the app to ask. Row level security still applies:
-- a person is only sent rows they are allowed to read.
alter publication supabase_realtime add table public.meet_messages, public.meet_notifications;
