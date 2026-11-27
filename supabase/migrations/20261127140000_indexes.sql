-- Indexes for the remaining references to an account that had none, so removing an account stays quick.
create index if not exists meet_blocks_blocked_idx on public.meet_blocks(blocked);
create index if not exists meet_invite_accepts_invitee_idx on public.meet_invite_accepts(invitee);
create index if not exists meet_reports_reported_idx on public.meet_reports(reported);
create index if not exists meet_reports_reporter_idx on public.meet_reports(reporter);
