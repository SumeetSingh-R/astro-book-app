import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRemembered, forget } from '../lib/cache.js';
import { useAccount } from '../lib/account.jsx';
import { useT, msg } from '../lib/language.jsx';
import { RASHIS, formatDate } from '../lib/format.js';
import { useDiscover, saveOwnKeys, forgetDiscover } from '../lib/meetData.js';
import { FIRST_MESSAGES, limitText, waitingForReply } from '../lib/meet.js';
import { useInbox } from '../lib/inbox.jsx';
import { useActor } from '../lib/acting.jsx';
import { sendPush } from '../lib/push.js';
import { useMeetProfile } from './Me.jsx';
import { Face, summaryLines } from './Discover.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

const REASONS = [['fake', msg('Fake profile')], ['photos', msg('Unsuitable photos')], ['abusive', msg('Rude or abusive messages')], ['money', msg('Asking for money')], ['other', msg('Something else')]];
const STARTERS = [msg('What is the best thing you have cooked this month?'), msg('Lazy Sunday at home, or out with friends?'), msg('What are you listening to on repeat?')];
const moonSign = (keys) => RASHIS[Math.floor(keys.moon_pada / 9)];

/** The people the signed-in person has matched with (both liked each other). Null while loading. */
function useMatches() {
  const { userId, acting, base } = useActor();
  const { self } = useAccount();
  const meet = useMeetProfile(userId);
  const { data: people } = useDiscover(userId, meet.data?.profile ?? null, self?.id ?? null, Boolean(acting));
  const ready = meet.data && (!meet.data.profile || people);
  return { userId, selfId: self?.id ?? null, acting, base, hasProfile: Boolean(meet.data?.profile), matches: ready ? (people ?? []).filter((p) => p.liked_me && p.my_kind === 'like') : null };
}

/** Matches and conversations, newest first. */
export default function Chats() {
  const t = useT();
  const { userId, acting, base, hasProfile, matches } = useMatches();
  const inbox = useRemembered(`inbox:${userId}`, async () => {
    const { data, error } = await supabase.from('meet_messages').select('id, sender, recipient, body, created_at, read_at')
      .or(`sender.eq.${userId},recipient.eq.${userId}`).order('created_at', { ascending: false }).limit(300); // always say whose: a family helper's sign-in can read two people's chats
    if (error) throw new Error('Your chats could not be loaded. Refresh the page to try again.');
    return data;
  }, { maxAge: 0 });
  const { listen, online } = useInbox();
  const reload = inbox.refresh;
  useEffect(() => listen((event) => { if (event.type !== 'read') reload(); }), [listen, reload]);

  if (acting && !acting.can_chat) return <div className="sheet"><h1>{t('Chats')}</h1><p className="muted">{t('{0} has not let family read or reply to chats. Only they can change that.', [acting.name])}</p><Link className="btn" to={`${base}/discover`}>{t('Go to Vibe match')}</Link></div>;
  if (!matches) return <ListSkeleton label={t('Loading…')} />;
  if (!hasProfile && acting) return <div className="sheet"><h1>{t('{0} has not set up a profile yet', [acting.name])}</h1><Link className="btn" to="/family">{t('Back to family')}</Link></div>;
  if (!hasProfile) return <div className="sheet"><h1>{t('Chats')}</h1><p className="muted">{t('Set up the profile other people will see, then come back here to find your matches.')}</p><Link className="btn" to="/me">{t('Set up my profile')}</Link></div>;
  const rows = matches.map((p) => {
    const mine = (inbox.data ?? []).filter((m) => m.sender === p.user_id || m.recipient === p.user_id);
    return { p, last: mine[0] ?? null, unread: mine.filter((m) => m.sender === p.user_id && !m.read_at).length };
  }).sort((a, b) => String(b.last?.created_at ?? '').localeCompare(String(a.last?.created_at ?? '')));
  return (
    <>
      <div><h1>{t('Chats')}</h1><p className="muted">{acting ? t('People {0} matched with.', [acting.name]) : t('People you liked who liked you back.')}</p></div>
      {inbox.error ? <p className="error" role="alert">{t(inbox.error)}</p> : null}
      {rows.length === 0 ? (
        <div className="empty card"><p>{acting ? t('No matches yet.') : t('No matches yet. Like someone in Vibe match; when they like you back, they appear here.')}</p><Link className="btn" to={`${base}/discover`}>{t('Go to Vibe match')}</Link></div>
      ) : (
        <ul className="meet-list">
          {rows.map(({ p, last, unread }) => (
            <li key={p.user_id}>
              <Link className="card meet-person chat-row" to={`${base}/chats/${p.user_id}`}>
                <span className="face-wrap"><Face person={p} />{!acting && online.has(p.user_id) ? <span className="online-dot" role="img" aria-label={t('Online')} /> : null}</span>
                <span className="chat-row-text"><strong>{p.display_name}, {p.age}</strong>
                  <span className="hint">{last ? `${last.sender === p.user_id ? '' : `${t('You')}: `}${last.body}` : t('You matched. Say hello.')}</span></span>
                {unread ? <span className="tag focus" aria-label={t('{0} new messages', [unread])}>{unread}</span> : <span className="tag">{t('Vibe score {0}/36', [p.match.total])}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {acting ? null : <Link className="card cta" to="/invite"><span className="cta-text"><Icon name="match" size={26} /><span><strong>{t('Vibe check with someone you know')}</strong><span>{t('Send a link and compare your charts')}</span></span></span><Icon name="go" size={20} /></Link>}
      <p className="private"><Icon name="lock" size={18} />{t('You can only chat after you have both liked each other. You can block or report from any chat.')}</p>
    </>
  );
}

export function Report({ person, userId, onDone, onCancel }) {
  const t = useT();
  const [reason, setReason] = useState('abusive');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [error, setError] = useState(null);
  async function send(e) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('meet_reports').insert({ reporter: userId, reported: person.user_id, reason, details: details.trim() });
    if (err) { setError(t('Your report could not be sent. Try again.')); return; }
    if (block) await supabase.from('meet_blocks').upsert({ blocker: userId, blocked: person.user_id }, { onConflict: 'blocker,blocked' });
    onDone(block);
  }
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <form className="modal-card report msg" onSubmit={send}>
        <h2 id="report-title">{t('Report {0}', [person.display_name])}</h2>
        <p className="hint">{t('Our team reads every report. They see what you write here, not your conversation.')}</p>
        <div className="pills" role="group" aria-label={t('Reason')}>
          {REASONS.map(([key, name]) => <button key={key} type="button" aria-pressed={reason === key} className={reason === key ? 'pill on' : 'pill'} onClick={() => setReason(key)}>{t(name)}</button>)}
        </div>
        <label>{t('What happened? (optional)')}<textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />{t('Also block {0}', [person.display_name])}</label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" className="btn">{t('Send report')}</button>
        <button type="button" className="link" onClick={onCancel}>{t('Cancel')}</button>
      </form>
    </div>
  );
}

/** One conversation with a match. */
export function Chat() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId, selfId, matches, acting, base } = useMatches();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [typing, setTyping] = useState(false);
  const typingChannel = useRef(null);
  const typedAt = useRef(0);
  const endRef = useRef(null);
  const inbox = useInbox();
  const person = matches?.find((p) => p.user_id === id) ?? null;

  const thread = useRemembered(person ? `thread:${userId}:${id}` : null, async () => {
    const { data, error: err } = await supabase.from('meet_messages').select('id, sender, body, created_at, read_at, sent_by')
      .or(`and(sender.eq.${userId},recipient.eq.${id}),and(sender.eq.${id},recipient.eq.${userId})`).order('created_at').limit(300);
    if (err) throw new Error('This chat could not be loaded. Refresh the page to try again.');
    return data;
  }, { maxAge: 0 });
  const mine = useRemembered(person && !acting ? `ownKeys:${userId}` : null, () => saveOwnKeys(userId, selfId), { maxAge: 12 * 3600 * 1000 });
  const { refresh, set } = thread;
  const loaded = useRef(false);
  loaded.current = Boolean(thread.data);
  const { live, listen } = inbox;
  const count = thread.data?.length ?? 0;
  const unread = (thread.data ?? []).some((m) => m.sender === id && !m.read_at);

  // New messages and read receipts arrive over the socket the moment they happen.
  useEffect(() => {
    if (!person || acting) return undefined; // a helper's socket carries their own messages, not the person's
    return listen((event) => {
      if (event.type === 'connected') { refresh(); return; }
      if (!loaded.current) return; // the first load will include it
      const { row } = event;
      if (event.type === 'message' && row.sender === id) {
        setTyping(false);
        set((list) => (list.some((m) => m.id === row.id) ? list : [...list, { id: row.id, sender: row.sender, body: row.body, created_at: row.created_at, read_at: row.read_at, sent_by: row.sent_by ?? null }]));
      } else if (event.type === 'read' && row.recipient === id) {
        set((list) => list.map((m) => (m.id === row.id ? { ...m, read_at: row.read_at } : m)));
      }
    });
  }, [person, acting, id, listen, refresh, set]);
  // "Typing…" travels on a private channel that only the two matched people may join.
  const matched = Boolean(person) && !acting; // only the two people themselves share the typing channel
  useEffect(() => {
    if (!matched) return undefined;
    let clear = null;
    let gone = false;
    const channel = supabase.channel(`chat:${[userId, id].sort().join(':')}`, { config: { private: true, broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== id) return;
        setTyping(true);
        clearTimeout(clear);
        clear = setTimeout(() => setTyping(false), 4000);
      });
    supabase.realtime.setAuth().catch(() => {}).then(() => { if (!gone) { channel.subscribe(); typingChannel.current = channel; } });
    return () => { gone = true; clearTimeout(clear); typingChannel.current = null; setTyping(false); supabase.removeChannel(channel); };
  }, [matched, userId, id]);
  /** Tell the other person, at most every two seconds, that a message is being written. */
  function type(value) {
    setDraft(value);
    const channel = typingChannel.current;
    if (!value.trim() || !channel || channel.state !== 'joined' || Date.now() - typedAt.current < 2000) return;
    typedAt.current = Date.now();
    channel.send({ type: 'broadcast', event: 'typing', payload: { from: userId } });
  }
  // Asking again on a timer stays as a safety net: every few seconds without the socket, rarely with it.
  useEffect(() => {
    if (!person) return undefined;
    const timer = setInterval(refresh, live && !acting ? 30000 : 6000);
    return () => clearInterval(timer);
  }, [person, refresh, live, acting]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [count]);
  const refreshInbox = inbox.refresh;
  useEffect(() => { if (unread && !acting) supabase.rpc('meet_mark_read', { p_other: id }).then(() => { forget(`inbox:${userId}`); refreshInbox(true); }); }, [unread, acting, id, userId, refreshInbox]);

  if (acting && !acting.can_chat) return <div className="sheet"><h1>{t('Chats')}</h1><p className="muted">{t('{0} has not let family read or reply to chats. Only they can change that.', [acting.name])}</p><Link className="btn" to={`${base}/discover`}>{t('Go to Vibe match')}</Link></div>;
  if (!matches) return <ListSkeleton label={t('Loading…')} />;
  if (!person) return <div className="sheet"><h1>{t('This chat is not available')}</h1><p className="muted">{t('You can chat with someone only while you are both matched.')}</p><Link className="btn" to={`${base}/chats`}>{t('Back to chats')}</Link></div>;

  async function send(text) {
    const body = text.trim().slice(0, 1000);
    if (!body) return;
    setError(null);
    const pending = { id: `pending-${Date.now()}`, sender: userId, body, created_at: new Date().toISOString(), read_at: null };
    thread.set((list) => [...(list ?? []), pending]);
    setDraft('');
    const { data, error: err } = await supabase.from('meet_messages').insert({ sender: userId, recipient: id, body }).select('id, sender, body, created_at, read_at, sent_by').single();
    if (err) {
      thread.set((list) => list.filter((m) => m.id !== pending.id));
      setDraft(body);
      const limit = limitText(err);
      setError(limit ? t(limit, [person.display_name]) : t('That message could not be sent. You can only chat while you are both matched.'));
      return;
    }
    thread.set((list) => list.map((m) => (m.id === pending.id ? data : m)));
    forget(`inbox:${userId}`);
    sendPush('message', id);
  }
  const waiting = waitingForReply(thread.data, userId);
  const lastMine = (thread.data ?? []).findLast((m) => m.sender === userId) ?? null;
  async function leave(action) {
    setMenu(false);
    const res = action === 'block'
      ? await supabase.from('meet_blocks').upsert({ blocker: userId, blocked: id }, { onConflict: 'blocker,blocked' })
      : await supabase.from('meet_likes').upsert({ liker: userId, liked: id, kind: 'pass' }, { onConflict: 'liker,liked' });
    if (res.error) { setError(t('That could not be saved. Try again.')); return; }
    forgetDiscover(userId);
    navigate('/chats', { replace: true });
  }

  return (
    <div className="chat sheet">
      <header className="chat-head">
        <Link className="back" to={`${base}/chats`} aria-label={t('Back to chats')}><Icon name="back" size={20} /></Link>
        <Face person={person} />
        <div className="chat-who"><h1><Link to={`${base}/people/${person.user_id}`}>{person.display_name}, {person.age}</Link></h1><p className="hint">{!acting && inbox.online.has(person.user_id) ? <span className="online-text"><span className="online-dot inline" aria-hidden="true" />{t('Online')} · </span> : null}{summaryLines(person, t)[0] ?? ''} · {t('Vibe score {0}/36', [person.match.total])}</p></div>
        {acting ? null : <div className="chat-menu">
          <button type="button" className="round small" aria-expanded={menu} aria-label={t('Safety options')} onClick={() => setMenu(!menu)}><Icon name="lock" size={20} /></button>
          {menu ? (
            <div className="card menu msg">
              <button type="button" onClick={() => leave('unmatch')}>{t('Unmatch')}</button>
              <button type="button" onClick={() => leave('block')}>{t('Block {0}', [person.display_name])}</button>
              <button type="button" className="warn" onClick={() => { setMenu(false); setReporting(true); }}>{t('Report {0}', [person.display_name])}</button>
            </div>
          ) : null}
        </div>}
      </header>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {thread.error ? <p className="error" role="alert">{t(thread.error)}</p> : null}
      <ol className="dms" aria-live="polite">
        {(thread.data ?? []).map((m) => (
          <li key={m.id} className={m.sender === userId ? 'dm mine msg' : 'dm msg'}><p>{m.body}</p><span className="hint">{formatDate(m.created_at, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}{m.sent_by ? ` · ${t('Sent by family')}` : ''}{m === lastMine && m.read_at ? ` · ${t('Seen')}` : ''}</span></li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      {thread.data && thread.data.length === 0 ? (
        <section className="card starters" aria-labelledby="starters-title">
          <p id="starters-title"><strong>{t('Icebreakers')}</strong></p>
          {mine.data ? <p className="hint">{t('Your Moon is in {0}; {1}\'s is in {2}.', [t(moonSign(mine.data)), person.display_name, t(moonSign(person.keys))])}</p> : null}
          {STARTERS.map((s) => <button key={s} type="button" className="starter" onClick={() => send(t(s))}>{t(s)}</button>)}
        </section>
      ) : null}

      <p className="typing" aria-live="polite">{typing ? <><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{t('{0} is typing…', [person.display_name])}</> : null}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {acting ? <p className="hint">{t('What you send is marked "Sent by family" for both {0} and {1}.', [acting.name, person.display_name])}</p> : null}
      {waiting ? <p className="notice" role="status">{t('You have sent {0} messages. You can send more when {1} replies.', [FIRST_MESSAGES, person.display_name])}</p> : null}
      <form className="compose" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <label className="visually-hidden" htmlFor="dm-input">{t('Message {0}', [person.display_name])}</label>
        <input id="dm-input" value={draft} onChange={(e) => type(e.target.value)} maxLength={1000} autoComplete="off" disabled={waiting} placeholder={t('Say hello to {0}', [person.display_name])} />
        <button type="submit" className="send" aria-label={t('Send')} disabled={waiting || !draft.trim()}><Icon name="go" /></button>
      </form>

      {reporting ? <Report person={person} userId={userId} onCancel={() => setReporting(false)} onDone={(blocked) => {
        setReporting(false);
        if (blocked) { forgetDiscover(userId); navigate('/chats', { replace: true }); } else setNotice(t('Thank you. Your report has been sent to our team.'));
      }} /> : null}
    </div>
  );
}
