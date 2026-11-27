import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRemembered, forget } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount } from '../lib/account.jsx';
import { useFamily } from '../lib/acting.jsx';
import { useT, msg } from '../lib/language.jsx';
import { formatDate } from '../lib/format.js';
import { sendPush } from '../lib/push.js';
import Icon from '../components/Icon.jsx';
import Toggle from '../components/Toggle.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

const MOST_HELPERS = 4;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]).join('');
const DID = { like: msg('{0} liked {1}'), pass: msg('{0} passed on {1}'), message: msg('{0} sent a message to {1}'), suggest: msg('{0} suggested {1}') };

/** What a helper may do, as short lines. Seeing and suggesting is always included. */
function Allowed({ link, t }) {
  return (
    <ul className="checks">
      <li className="ok"><Icon name="check" size={14} />{t('See people and suggest them')}</li>
      <li className={link.can_like ? 'ok' : 'miss'}><Icon name={link.can_like ? 'check' : 'x'} size={14} />{t('Like or pass')}</li>
      <li className={link.can_chat ? 'ok' : 'miss'}><Icon name={link.can_chat ? 'check' : 'x'} size={14} />{t('Read and reply to chats')}</li>
    </ul>
  );
}

/** Family help: the people who help me, the people I help, and everything my helpers did. */
export default function Family() {
  const t = useT();
  const { session } = useAuth();
  const { self } = useAccount();
  const userId = session.user.id;
  const family = useFamily(userId);
  const activity = useRemembered(`familyActivity:${userId}`, async () => (await supabase.rpc('family_activity')).data ?? [], { maxAge: 0 });
  const [label, setLabel] = useState('');
  const [canLike, setCanLike] = useState(false);
  const [canChat, setCanChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  if (family.error) return <p className="error" role="alert">{t(family.error)}</p>;
  if (!family.data) return <ListSkeleton label={t('Loading…')} />;
  const { helpers, helping, invites } = family.data;
  const failed = () => setError(t('That could not be saved. Try again.'));

  async function invite(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('family_invites').insert({ code: newCode(), person: userId, label: label.trim().slice(0, 30), can_like: canLike, can_chat: canChat });
    setBusy(false);
    if (err) { failed(); return; }
    setLabel('');
    family.refresh();
  }
  async function change(helper, patch) {
    setError(null);
    family.set((old) => ({ ...old, helpers: old.helpers.map((h) => (h.helper === helper.helper ? { ...h, ...patch } : h)) }));
    const { error: err } = await supabase.from('family_links').update(patch).eq('person', userId).eq('helper', helper.helper);
    if (err) { failed(); family.refresh(); }
  }
  async function end(person, helper) {
    setError(null);
    const { error: err } = await supabase.from('family_links').delete().eq('person', person).eq('helper', helper);
    if (err) { failed(); return; }
    forget('discover:', 'meet:');
    family.refresh();
    activity.refresh();
  }
  async function removeInvite(code) {
    const { error: err } = await supabase.from('family_invites').delete().eq('code', code);
    if (err) { failed(); return; }
    family.refresh();
  }
  async function copy(code) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/f/${code}`); setCopied(code); } catch { setError(t('Copying did not work. Select the link and copy it yourself.')); }
  }

  return (
    <div className="sheet meet family">
      <div>
        <p><Link className="back" to={self ? '/profile' : '/'}><Icon name="back" size={18} />{self ? t('Profile') : t('Home')}</Link></p>
        <h1>{t('Family mode')}</h1>
        <p className="muted">{t('Invite a parent to look for matches with you. You decide what they can do, you see what they did, and you can stop it at any time.')}</p>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}

      {helping.length ? (
        <section aria-labelledby="helping-title">
          <h2 id="helping-title">{t('People I help')}</h2>
          <ul className="meet-list">
            {helping.map((h) => (
              <li key={h.person} className="card family-card">
                <p><strong>{h.name}</strong></p>
                {h.paused ? <p className="notice">{t('{0} has paused your help. They can turn it back on at any time.', [h.name])}</p>
                  : !h.ready ? <p className="notice">{t('{0} has not set up a profile yet', [h.name])}</p> : (
                    <>
                      <Allowed link={h} t={t} />
                      <Link className="btn" to={`/family/${h.person}/discover`}><Icon name="heart" size={20} />{t('Find matches for {0}', [h.name])}</Link>
                      {h.can_chat ? <Link className="btn outline" to={`/family/${h.person}/chats`}><Icon name="chat" size={20} />{t('Open {0}\'s chats', [h.name])}</Link> : null}
                    </>
                  )}
                <button type="button" className="link quiet" onClick={() => end(h.person, userId)}>{t('Stop helping {0}', [h.name])}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="helpers-title">
        <h2 id="helpers-title">{t('Family who help me')}</h2>
        {helpers.length === 0 && invites.length === 0 ? <p className="muted">{t('Nobody yet. Make a link below and send it to a parent.')}</p> : null}
        <ul className="meet-list">
          {helpers.map((h) => (
            <li key={h.helper} className="card family-card">
              <p><strong>{h.label}</strong> <span className="hint">{t('Joined on {0}', [formatDate(h.created_at)])}</span></p>
              <p className="hint">{t('{0} can always see the people you can meet and suggest them to you.', [h.label])}</p>
              <div className="toggles">
                <Toggle label={t('Can like or pass for me')} checked={h.can_like} disabled={h.paused} onChange={(v) => change(h, { can_like: v })} />
                <Toggle label={t('Can read and reply to my chats')} hint={t('Their messages are marked "Sent by family"')} checked={h.can_chat} disabled={h.paused} onChange={(v) => change(h, { can_chat: v })} />
                <Toggle label={t('Pause {0}\'s help', [h.label])} hint={t('They see nothing and can do nothing until you turn this off')} checked={h.paused} onChange={(v) => change(h, { paused: v })} />
              </div>
              <button type="button" className="btn small danger" onClick={() => end(userId, h.helper)}>{t('Remove {0}', [h.label])}</button>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.code} className="card family-card">
              <p><strong>{t('Invite for {0}', [i.label])}</strong> <span className="hint">{t('Not accepted yet')}</span></p>
              <p className="link-text">{`${window.location.origin}/f/${i.code}`}</p>
              <Allowed link={i} t={t} />
              <button type="button" className="btn" onClick={() => copy(i.code)}>{copied === i.code ? t('Link copied') : t('Copy the link')}</button>
              <p className="hint" aria-live="polite">{t('The link works until {0}.', [formatDate(i.expires_at, { day: 'numeric', month: 'long' })])} {t('It works for one person.')}</p>
              <button type="button" className="link quiet" onClick={() => removeInvite(i.code)}>{t('Cancel this invite')}</button>
            </li>
          ))}
        </ul>
        {helpers.length + invites.length < MOST_HELPERS ? (
          <form className="card family-card" onSubmit={invite}>
            <p><strong>{t('Invite someone')}</strong></p>
            <label>{t('What do you call them?')}<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} placeholder={t('For example Mum, Papa, Didi')} required /></label>
            <p className="hint">{t('They can always see the people you can meet and suggest them to you. Choose what else they can do:')}</p>
            <label className="check"><input type="checkbox" checked={canLike} onChange={(e) => setCanLike(e.target.checked)} />{t('Like or pass for me')}</label>
            <label className="check"><input type="checkbox" checked={canChat} onChange={(e) => setCanChat(e.target.checked)} />{t('Read and reply to my chats')}</label>
            <button type="submit" className="btn" disabled={busy || !label.trim()}>{busy ? t('Please wait…') : t('Make invite link')}</button>
          </form>
        ) : <p className="hint">{t('You can have up to {0} family helpers.', [MOST_HELPERS])}</p>}
      </section>

      {activity.data?.length ? (
        <section aria-labelledby="did-title">
          <h2 id="did-title">{t('What they did for you')}</h2>
          <ul className="activity">
            {activity.data.map((a, n) => (
              <li key={`${a.kind}-${a.at}-${n}`}><span>{t(DID[a.kind] ?? DID.like, [a.by ?? t('A family member'), a.name ?? t('Someone')])}</span><span className="hint">{formatDate(a.at, { day: 'numeric', month: 'short' })}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="private"><Icon name="lock" size={18} />{t('A helper never sees your date, time or place of birth, and cannot change your profile, photos or filters, or block or report anyone for you.')}</p>
      {self ? null : <Link className="btn outline" to="/welcome">{t('Add my own birth details')}</Link>}
    </div>
  );
}

/** Someone opened a family invite link. */
export function FamilyLink() {
  const t = useT();
  const { code } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const invite = useRemembered(`familyInvite:${code}`, async () => {
    const { data, error } = await supabase.rpc('open_family_invite', { p_code: String(code).toLowerCase() });
    if (error) throw new Error('This link could not be opened. Try again.');
    return data ?? false;
  }, { maxAge: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (invite.error) return <p className="error" role="alert">{t(invite.error)}</p>;
  if (invite.data === null) return <ListSkeleton label={t('Loading…')} />;
  if (!invite.data) return <div className="sheet"><h1>{t('This link has expired')}</h1><p className="muted">{t('A family invite works for 7 days and for one person. Ask for a new one.')}</p><Link className="btn" to="/">{t('Go to the home page')}</Link></div>;
  const { name, mine, already } = invite.data;
  if (mine) return <div className="sheet"><h1>{t('This is your own link')}</h1><p className="muted">{t('Send it to the family member you want to invite.')}</p><Link className="btn" to="/family">{t('Back to family')}</Link></div>;
  if (already) return <div className="sheet"><h1>{t('You are already helping {0}', [name])}</h1><Link className="btn" to="/family">{t('Back to family')}</Link></div>;

  async function accept() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('accept_family_invite', { p_code: invite.data.code });
    if (err || data !== true) { setError(t('That did not work. Try again in a moment.')); setBusy(false); return; }
    forget(`family:${session.user.id}`);
    sendPush('family_joined', invite.data.person);
    navigate('/family', { replace: true });
  }

  return (
    <div className="sheet meet family">
      <h1>{t('{0} invited you to help find their match', [name])}</h1>
      <p className="muted">{t('You will use Astro Book on their behalf. This is what {0} has allowed:', [name])}</p>
      <Allowed link={invite.data} t={t} />
      <p className="private"><Icon name="lock" size={18} />{t('{0} sees everything you do for them, and can change or stop this at any time.', [name])}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="button" className="btn" disabled={busy} onClick={accept}>{busy ? t('Please wait…') : t('Accept and start helping')}<Icon name="go" size={20} /></button>
      <Link className="link" to="/">{t('Not now')}</Link>
    </div>
  );
}
