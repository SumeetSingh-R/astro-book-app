-- The "may these two chat" check answers only for the person asking. Before this, any signed-in
-- person could ask it about two other people and so learn whether they had matched.
create or replace function public.meet_can_chat(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (p_a, p_b)
     and exists (select 1 from public.meet_likes where liker = p_a and liked = p_b and kind = 'like')
     and exists (select 1 from public.meet_likes where liker = p_b and liked = p_a and kind = 'like')
     and not exists (select 1 from public.meet_blocks where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a))
     and not exists (select 1 from public.meet_suspensions where user_id in (p_a, p_b));
$$;
