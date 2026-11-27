import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '../lib/account.jsx';
import { useRemembered } from '../lib/cache.js';
import { useT } from '../lib/language.jsx';
import { RASHIS } from '../lib/format.js';
import { chartFromKeys } from '../lib/meet.js';
import { useDiscover, decide, forgetDiscover, setSuggestion } from '../lib/meetData.js';
import { useActor } from '../lib/acting.jsx';
import { photoLinks } from '../lib/photos.js';
import { NAKSHATRAS } from '../../../engine/src/constants.mjs';
import { manglik } from '../../../engine/src/match.mjs';
import { useMeetProfile } from './Me.jsx';
import { Why, summaryLines } from './Discover.jsx';
import { Report } from './Chats.jsx';
import { KOOTA_ABOUT, Ring } from './Match.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

/** Another person's full profile: photos, details, and how the two charts fit, test by test. */
export default function Person() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { own, userId, acting, base } = useActor();
  const { self } = useAccount();
  const meet = useMeetProfile(userId);
  const { data: people, set } = useDiscover(userId, meet.data?.profile ?? null, self?.id ?? null, Boolean(acting));
  const [shown, setShown] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState(null);
  const person = people?.find((p) => p.user_id === id) ?? null;
  const paths = person?.photos ?? [];
  const links = useRemembered(paths.length ? `photoLinks:${paths.join('|')}` : null, () => photoLinks(paths), { maxAge: 50 * 60 * 1000 });

  if (meet.data && !meet.data.profile) return acting
    ? <div className="sheet"><h1>{t('{0} has not set up a profile yet', [acting.name])}</h1><Link className="btn" to="/family">{t('Back to family')}</Link></div>
    : <div className="sheet"><h1>{t('Meet people who fit your kundli')}</h1><Link className="btn" to="/me">{t('Set up my profile')}</Link></div>;
  if (!people) return <ListSkeleton label={t('Loading…')} />;
  if (!person) return <div className="sheet"><h1>{t('This profile is not available')}</h1><p className="muted">{t('They may have paused or removed their profile.')}</p><Link className="btn" to={`${base}/discover`}>{t('Go to Discover')}</Link></div>;

  const canLike = !acting || acting.can_like;
  const canChat = !acting || acting.can_chat;
  const suggested = person.suggested_by !== null && person.suggested_by !== undefined;
  const matched = person.liked_me && person.my_kind === 'like';
  const url = links.data?.[paths[shown]] ?? null;
  const keys = person.keys;
  const signs = [
    keys.lagna_rashi ? t('{0} rising', [t(RASHIS[keys.lagna_rashi - 1])]) : null,
    t('Moon in {0}', [t(RASHIS[Math.floor(keys.moon_pada / 9)])]),
    t('{0} star', [t(NAKSHATRAS[Math.floor(keys.moon_pada / 4)])]),
    manglik(chartFromKeys(keys)).isManglik ? t('Manglik') : t('Not Manglik'),
  ].filter(Boolean);

  async function act(kind) {
    setNote(null);
    const before = person.my_kind;
    set((list) => list.map((p) => (p.user_id === id ? { ...p, my_kind: kind } : p)));
    try {
      if (await decide(userId, person, kind)) { if (canChat) navigate(`${base}/chats/${id}`); } else if (kind === 'pass') navigate(`${base}/discover`);
    } catch {
      set((list) => list.map((p) => (p.user_id === id ? { ...p, my_kind: before } : p)));
      setNote(t('That could not be saved. Try again.'));
    }
  }

  async function suggest() {
    setNote(null);
    const on = !suggested;
    set((list) => list.map((p) => (p.user_id === id ? { ...p, suggested_by: on ? '' : null } : p)));
    try { await setSuggestion(own, userId, id, on); } catch {
      set((list) => list.map((p) => (p.user_id === id ? { ...p, suggested_by: on ? null : '' } : p)));
      setNote(t('That could not be saved. Try again.'));
    }
  }

  return (
    <>
      <p><Link className="back" to={`${base}/discover`}><Icon name="back" size={18} />{t('Discover')}</Link></p>
      <div className="discover">
        <div className="discover-main">
          <div className="deck-card">
            {url ? <img className="deck-photo" src={url} alt={t('Photo {0} of {1}', [shown + 1, paths.length])} /> : <span className="deck-photo initial" aria-hidden="true">{person.display_name.trim().charAt(0).toUpperCase()}</span>}
            <div className="deck-text">
              <h1 className="deck-name">{person.display_name}, {person.age}</h1>
              {summaryLines(person, t).map((x) => <p key={x}>{x}</p>)}
            </div>
          </div>
          {paths.length > 1 ? (
            <div className="pills" role="group" aria-label={t('Photos')}>
              {paths.map((p, i) => <button key={p} type="button" aria-pressed={shown === i} className={shown === i ? 'pill on' : 'pill'} onClick={() => setShown(i)}>{i + 1}</button>)}
            </div>
          ) : null}
          {paths.length === 0 ? <p className="hint">{t('No photos yet. Photos appear once they have been checked.')}</p> : null}
          {note ? <p className="error" role="alert">{note}</p> : null}
          {!acting && suggested ? <p className="banner"><Icon name="star" size={20} />{t('{0} suggested {1} for you.', [person.suggested_by || t('Family'), person.display_name])}</p> : null}
          {matched ? (
            canChat ? <Link className="btn" to={`${base}/chats/${id}`}><Icon name="chat" size={20} />{acting ? t('Open the chat') : t('Open your chat')}</Link> : <p className="hint">{t('{0} and {1} have matched.', [acting.name, person.display_name])}</p>
          ) : !canLike ? (
            <button type="button" className={suggested ? 'btn outline' : 'btn'} aria-pressed={suggested} onClick={suggest}><Icon name="star" size={20} />{suggested ? t('Suggested to {0}', [acting.name]) : t('Suggest to {0}', [acting.name])}</button>
          ) : (
            <div className="deck-actions">
              <button type="button" className="round" aria-label={t('Pass on {0}', [person.display_name])} onClick={() => act('pass')}><Icon name="x" size={28} /></button>
              <button type="button" className={person.my_kind === 'like' ? 'round like' : 'round'} aria-pressed={person.my_kind === 'like'} aria-label={t('Like {0}', [person.display_name])} onClick={() => act('like')}><Icon name="heart" size={28} /></button>
            </div>
          )}
          {person.my_kind === 'like' && !matched && !acting ? <p className="hint">{t('You liked {0}. If they like you back, you can chat.', [person.display_name])}</p> : null}
          <section aria-labelledby="signs-title" className="why-fit">
            <h2 id="signs-title">{t('From their kundli')}</h2>
            <ul className="chip-list">{signs.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
          {acting ? null : <p><button type="button" className="link quiet" onClick={() => setReporting(true)}>{t('Report or block {0}', [person.display_name])}</button></p>}
        </div>
        <div className="why-fit">
          <Why person={person} forName={acting?.name ?? null} />
          <section aria-labelledby="tests-title" className="why-fit">
            <div className="deck-score"><Ring total={person.match.total} max={36} /><div><h2 id="tests-title">{t('The eight tests')}</h2><p className="hint">{t(person.match.manglik.summary)}</p></div></div>
            <dl className="facts-list tests">
              {person.match.kootas.map((k) => <div key={k.name}><dt><strong>{t(k.name)}</strong><span className="hint">{t(KOOTA_ABOUT[k.name])}</span></dt><dd>{k.score} / {k.max}</dd></div>)}
            </dl>
          </section>
        </div>
      </div>
      {reporting ? <Report person={person} userId={userId} onCancel={() => setReporting(false)} onDone={(blocked) => {
        setReporting(false);
        if (blocked) { forgetDiscover(userId); navigate('/discover', { replace: true }); } else setNote(t('Thank you. Your report has been sent to our team.'));
      }} /> : null}
    </>
  );
}
