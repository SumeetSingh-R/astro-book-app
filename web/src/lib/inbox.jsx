import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from './supabase.js';

const EMPTY = { unread_messages: 0, notifications: [], review: null };
const InboxContext = createContext({ unread: 0, fresh: 0, notifications: [], review: null, live: false, refresh() {}, markRead() {}, listen() { return () => {}; } });
const EVERY = 60 * 1000; // how often to ask while the page is open
const AT_MOST = 10 * 1000; // moving between pages asks again, but not more often than this
const SETTLE = 800; // several live events close together make one check, not one each

/** What is waiting for the signed-in person: unread messages, notifications, and for admins the review queue. */
export function InboxProvider({ userId, children }) {
  const [data, setData] = useState(EMPTY);
  const [cleared, setCleared] = useState(false);
  const [live, setLive] = useState(false);
  const last = useRef(0);
  const listeners = useRef(new Set());
  const soon = useRef(null);
  const location = useLocation();

  const refresh = useCallback(async (force = false) => {
    if (!userId || document.hidden) return;
    if (!force && Date.now() - last.current < AT_MOST) return;
    last.current = Date.now();
    const { data: next, error } = await supabase.rpc('meet_inbox');
    if (error || !next) return; // badges are a convenience: a failed check just leaves them as they were
    setData(next);
    setCleared(false);
  }, [userId]);

  useEffect(() => {
    setData(EMPTY);
    last.current = 0;
    if (!userId) return undefined;
    refresh(true);
    const timer = setInterval(() => refresh(true), EVERY);
    const wake = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', wake); };
  }, [userId, refresh]);
  useEffect(() => { refresh(); }, [location.pathname, refresh]);

  // One socket for the signed-in person. The database pushes their new messages, read receipts on
  // what they sent, and their notifications; row level security decides what they may be sent.
  // If the socket cannot connect, nothing breaks: the timed checks above and in the chat carry on.
  useEffect(() => {
    if (!userId) return undefined;
    const tell = (event) => listeners.current.forEach((fn) => fn(event));
    const check = () => { clearTimeout(soon.current); soon.current = setTimeout(() => refresh(true), SETTLE); };
    const messages = { schema: 'public', table: 'meet_messages' };
    const notes = { schema: 'public', table: 'meet_notifications', filter: `user_id=eq.${userId}` };
    const channel = supabase.channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', ...messages, filter: `recipient=eq.${userId}` }, (p) => { tell({ type: 'message', row: p.new }); check(); })
      .on('postgres_changes', { event: 'UPDATE', ...messages, filter: `sender=eq.${userId}` }, (p) => tell({ type: 'read', row: p.new }))
      .on('postgres_changes', { event: 'INSERT', ...notes }, check)
      .on('postgres_changes', { event: 'UPDATE', ...notes }, check)
      .subscribe((status) => {
        const on = status === 'SUBSCRIBED';
        setLive(on);
        if (on) { tell({ type: 'connected' }); check(); } // anything missed while offline is picked up now
      });
    return () => { clearTimeout(soon.current); setLive(false); supabase.removeChannel(channel); };
  }, [userId, refresh]);

  /** Hear live events: { type: 'message' | 'read', row } and { type: 'connected' }. Returns a function that stops listening. */
  const listen = useCallback((fn) => { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; }, []);

  const markRead = useCallback(async () => {
    setCleared(true); // the badge clears at once; the list keeps its "New" marks until the next check
    await supabase.rpc('meet_notifications_read');
  }, []);

  const value = useMemo(() => {
    const waiting = (data.review?.photos ?? 0) + (data.review?.reports ?? 0);
    const unseen = cleared ? 0 : data.notifications.filter((n) => !n.read).length;
    return { unread: Number(data.unread_messages) || 0, fresh: unseen + waiting, unseen, notifications: data.notifications, review: data.review, live, refresh, markRead, listen };
  }, [data, cleared, live, refresh, markRead, listen]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export const useInbox = () => useContext(InboxContext);

/** A small count on a link or icon. Shows nothing for zero. */
export function Badge({ count }) {
  return count > 0 ? <span className="badge" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null;
}
