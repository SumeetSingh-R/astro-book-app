import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRemembered } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount } from '../lib/account.jsx';
import { useT } from '../lib/language.jsx';
import { formatDate } from '../lib/format.js';
import { scoreBetween, whyLines } from '../lib/meet.js';
import { saveOwnKeys } from '../lib/meetData.js';
import { useMeetProfile } from './Me.jsx';
import { careSentence } from './Discover.jsx';
import { KOOTA_ABOUT, Ring } from './Match.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** How two charts fit: the score, what works, what to talk about, and the eight tests. */
function MatchResult({ match, name }) {
  const t = useT();
  const { good, care } = whyLines(match);
  const careText = careSentence(care, t);
  return (
    <div className="why-fit">
      <div className="banner deck-score"><Ring total={match.total} max={36} /><div><p><strong>{t('You and {0}: {1} of 36', [name, match.total])} · {t(match.band)}</strong></p><p className="hint">{t('18 is the traditional pass mark.')} {t(match.manglik.summary)}</p></div></div>
      {good.map((k) => <p key={k.name} className="why-line"><span className="why-mark good"><Icon name="check" size={18} /></span><span><strong>{t(k.name)} {k.score} / {k.max}.</strong> <span className="muted">{t(KOOTA_ABOUT[k.name])}</span></span></p>)}
      {careText ? <p className="why-line care"><span className="why-mark"><Icon name="chat" size={18} /></span><span><strong>{t('Worth a conversation.')}</strong> {careText}</span></p> : null}
      <dl className="facts-list tests">
        {match.kootas.map((k) => <div key={k.name}><dt><strong>{t(k.name)}</strong><span className="hint">{t(KOOTA_ABOUT[k.name])}</span></dt><dd>{k.score} / {k.max}</dd></div>)}
      </dl>
      <p className="private"><Icon name="lock" size={18} />{t('Neither of you can see the other\'s date, time or place of birth. Only the result is shared.')}</p>
    </div>
  );
}

/** The signed-in person as one side of a match: their id, gender if they gave one, and their match keys. */
function useMe() {
  const { session } = useAuth();
  const { self } = useAccount();
  const userId = session.user.id;
  const meet = useMeetProfile(userId);
  const keys = useRemembered(self ? `ownKeys:${userId}` : null, () => saveOwnKeys(userId, self.id), { maxAge: 12 * 3600 * 1000 });
  return { userId, self, me: keys.data ? { user_id: userId, gender: meet.data?.profile?.gender ?? null, keys: keys.data } : null, keysError: keys.error };
}

/** Your own invite link, and everyone who has accepted it. */
export default function Invite() {
  const t = useT();
  const { userId, self, me, keysError } = useMe();
  const invites = useRemembered(`invites:${userId}`, async () => {
    const { data, error } = await supabase.rpc('my_invites');
    if (error) throw new Error('Your links could not be loaded. Refresh the page to try again.');
    return data ?? [];
  }, { maxAge: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(null);

  const active = invites.data?.find((i) => i.active) ?? null;
  const link = active ? `${window.location.origin}/m/${active.code}` : null;
  const accepted = (invites.data ?? []).flatMap((i) => i.accepts).filter((p, n, all) => p.keys && all.findIndex((x) => x.user_id === p.user_id) === n);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await saveOwnKeys(userId, self.id); // the other person's result is worked out from these
      const { error: err } = await supabase.from('meet_invites').insert({ code: newCode(), inviter: userId });
      if (err) throw new Error('create');
      invites.refresh();
    } catch { setError(t('Your link could not be made. Try again.')); } finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError(t('Copying did not work. Select the link and copy it yourself.')); }
  }

  return (
    <div className="sheet meet">
      <div>
        <p><Link className="back" to="/chats"><Icon name="back" size={18} />{t('Chats')}</Link></p>
        <h1>{t('Match with someone you know')}</h1>
        <p className="muted">{t('Send them a link. When they add their birth details, you both see how your charts fit.')}</p>
      </div>
      {invites.error || keysError ? <p className="error" role="alert">{t(invites.error ?? 'Your chart could not be read. Open your chart once, then try again.')}</p> : null}
      {!invites.data && !invites.error ? <ListSkeleton label={t('Loading…')} /> : null}
      {invites.data ? (
        <div className="card invite-link">
          {link ? (
            <>
              <p className="note-label">{t('Your link')}</p>
              <p className="link-text">{link}</p>
              <button type="button" className="btn" onClick={copy}><Icon name="match" size={20} />{copied ? t('Link copied') : t('Copy my link')}</button>
              <p className="hint" aria-live="polite">{t('The link works until {0}.', [formatDate(active.expires_at, { day: 'numeric', month: 'long' })])}</p>
            </>
          ) : (
            <>
              <p>{t('Make a link to share on any chat app. It works for 7 days, for one person or a few.')}</p>
              <button type="button" className="btn" disabled={busy} onClick={create}>{busy ? t('Please wait…') : t('Make my link')}</button>
            </>
          )}
          {error ? <p className="error" role="alert">{error}</p> : null}
        </div>
      ) : null}
      <ol className="steps">
        <li><strong>{t('Share your link')}</strong><span className="hint">{t('On any chat app, with one person or a few.')}</span></li>
        <li><strong>{t('They add their birth details')}</strong><span className="hint">{t('It takes a minute, and they get their own chart too.')}</span></li>
        <li><strong>{t('You both see the match')}</strong><span className="hint">{t('The score, the reasons in plain words, and what to talk about.')}</span></li>
      </ol>
      {accepted.length ? (
        <section aria-labelledby="accepted-title">
          <h2 id="accepted-title">{t('Accepted')}</h2>
          <ul className="meet-list">
            {accepted.map((p) => {
              const match = me ? scoreBetween(me, p) : null;
              return (
                <li key={p.user_id} className="card">
                  <button type="button" className="person-open" aria-expanded={open === p.user_id} onClick={() => setOpen(open === p.user_id ? null : p.user_id)}>
                    <span className="face initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
                    <span><strong>{p.name}</strong><span className="hint">{t('Accepted on {0}', [formatDate(p.accepted_at)])}</span>{match ? <span className="tag">{t('{0} of 36', [match.total])} · {t(match.band)}</span> : null}</span>
                  </button>
                  {open === p.user_id && match ? <MatchResult match={match} name={p.name} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <p className="private"><Icon name="lock" size={18} />{t('They see the result and your first name. Your birth details and photos stay private.')}</p>
    </div>
  );
}

/** Someone opened an invite link. */
export function InviteLink() {
  const t = useT();
  const { code } = useParams();
  const location = useLocation();
  const { userId, self, me } = useMe();
  const invite = useRemembered(`invite:${code}`, async () => {
    const { data, error } = await supabase.rpc('open_invite', { p_code: String(code).toLowerCase() });
    if (error) throw new Error('This link could not be opened. Try again.');
    return data ?? false;
  }, { maxAge: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!self) {
    try { sessionStorage.setItem('postProfilePath', location.pathname); } catch { /* storage unavailable */ }
    return (
      <div className="sheet">
        <h1>{t('Someone wants to see how your charts fit')}</h1>
        <p className="muted">{t('Add your birth details first. It takes a minute, and you get your own chart too.')}</p>
        <Link className="btn" to="/welcome">{t('Add my birth details')}<Icon name="go" size={20} /></Link>
      </div>
    );
  }
  if (invite.error) return <p className="error" role="alert">{t(invite.error)}</p>;
  if (invite.data === null) return <ListSkeleton label={t('Loading…')} />;
  if (!invite.data) return <div className="sheet"><h1>{t('This link has expired')}</h1><p className="muted">{t('Invite links work for 7 days. Ask for a new one.')}</p><Link className="btn" to="/today">{t('Go to Today')}</Link></div>;
  const { inviter, mine, accepted } = invite.data;
  if (mine) return <div className="sheet"><h1>{t('This is your own link')}</h1><p className="muted">{t('Send it to someone you know. You will see the match when they accept.')}</p><Link className="btn" to="/invite">{t('Open my link')}</Link></div>;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await saveOwnKeys(userId, self.id);
      const { data, error: err } = await supabase.rpc('accept_invite', { p_code: invite.data.code });
      if (err || data !== true) throw new Error('accept');
      invite.set((old) => ({ ...old, accepted: true }));
    } catch { setError(t('That did not work. Try again in a moment.')); } finally { setBusy(false); }
  }

  const match = accepted && me && inviter.keys ? scoreBetween(me, inviter) : null;
  return (
    <div className="sheet meet">
      {match ? (
        <>
          <h1>{t('You and {0}', [inviter.name])}</h1>
          <MatchResult match={match} name={inviter.name} />
          <Link className="btn outline" to="/invite">{t('Make my own link')}</Link>
        </>
      ) : (
        <>
          <h1>{t('{0} wants to see how your charts fit', [inviter.name])}</h1>
          <p className="muted">{t('If you accept, you both see the 36-point match between your charts. They see the result and your first name, nothing else.')}</p>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="button" className="btn" disabled={busy} onClick={accept}>{busy ? t('Please wait…') : t('See how we match')}<Icon name="go" size={20} /></button>
          <Link className="link" to="/today">{t('Not now')}</Link>
        </>
      )}
    </div>
  );
}
