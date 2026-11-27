import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../lib/account.jsx';
import { useRemembered } from '../lib/cache.js';
import { useT } from '../lib/language.jsx';
import { LOOKING_FOR, MARITAL, DIETS, DRINKING, SMOKING, FAMILY_TYPES, INCOMES, labelOf, feetInches, whyLines } from '../lib/meet.js';
import { useDiscover, decide, setSuggestion } from '../lib/meetData.js';
import { useActor } from '../lib/acting.jsx';
import { photoLinks } from '../lib/photos.js';
import { useMeetProfile } from './Me.jsx';
import { KOOTA_ABOUT, Ring } from './Match.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

/** A person's approved main photo, or their initial when there is none yet. */
export function Face({ person, className = 'face' }) {
  const path = person.photos?.[0] ?? null;
  const link = useRemembered(path ? `photoLink:${path}` : null, () => photoLinks([path]).then((l) => l[path] ?? false), { maxAge: 50 * 60 * 1000 });
  return link.data
    ? <img className={className} src={link.data} alt="" />
    : <span className={`${className} initial`} aria-hidden="true">{person.display_name.trim().charAt(0).toUpperCase()}</span>;
}

const line = (parts) => parts.filter(Boolean).join(' · ');
export function summaryLines(person, t) {
  return [line([person.city, person.work]), line([person.height_cm ? feetInches(person.height_cm) : null, line([person.religion, person.community]).replace(' · ', ', '), person.mother_tongue])].filter(Boolean);
}

/** The one thing most worth talking about, as a sentence. Null when there is nothing to flag. */
export function careSentence(care, t) {
  return !care ? null
    : care.kind === 'dosha' ? t('{0} is present, so this is an area to talk through. The eight tests show the detail.', [t(care.name)])
      : care.kind === 'cancelled' ? t('{0} is found, but tradition treats it as cancelled for the two of you.', [t(care.name)])
        : care.kind === 'manglik' ? t('One of you is Manglik and the other is not. Many families ask about this.')
          : t('{0} scores low: {1} of {2}.', [t(care.name), care.score, care.max]);
}

/** Why two people fit: the tests that went best, the thing to talk about, and the preference checks. */
export function Why({ person, link = false, base = '', forName = null }) {
  const t = useT();
  const { match, fit } = person;
  const { good, care } = whyLines(match);
  const careText = careSentence(care, t);
  const facts = [
    [t('Looking for'), t(labelOf(LOOKING_FOR, person.looking_for) ?? '')], [t('Education'), person.education], [t('Marital status'), t(labelOf(MARITAL, person.marital_status) ?? '')],
    [t('Income'), t(labelOf(INCOMES, person.income_range) ?? '')], [t('Family'), t(labelOf(FAMILY_TYPES, person.family_type) ?? '')], [t('Parents'), person.parents], [t('Siblings'), person.siblings],
  ].filter(([, v]) => v);
  const habits = [labelOf(DIETS, person.diet), labelOf(DRINKING, person.drinking), labelOf(SMOKING, person.smoking)].filter(Boolean).map((x) => t(x));
  return (
    <section className="why-fit" aria-labelledby="why-fit-title" aria-live="polite">
      <h2 id="why-fit-title">{forName ? t('Green flags for {0} and {1}', [forName, person.display_name]) : t('Green flags with {0}', [person.display_name])}</h2>
      <div className="banner"><div><p><strong>{t('Vibe score {0}/36', [match.total])} · {t(match.band)}</strong></p><p className="hint">{t('Out of 36 kundli points, worked out from both birth charts.')} {t('18 is the traditional pass mark.')}</p></div></div>
      {person.family_helps ? <p className="hint family-note"><Icon name="match" size={16} />{t('A family member helps {0} with this profile.', [person.display_name])}</p> : null}
      {good.map((k) => (
        <p key={k.name} className="why-line"><span className="why-mark good"><Icon name="check" size={18} /></span><span><strong>{t(k.name)} {k.score} / {k.max}.</strong> <span className="muted">{t(KOOTA_ABOUT[k.name])}</span></span></p>
      ))}
      {careText ? <p className="why-line care"><span className="why-mark"><Icon name="chat" size={18} /></span><span><strong>{t('Talk about this.')}</strong> {careText}</span></p> : null}
      <div className="card">
        <p><strong>{forName ? t('Fits {0} of {1} preferences', [fit.passed, fit.checks.length]) : t('Fits {0} of your {1} preferences', [fit.passed, fit.checks.length])}</strong></p>
        <ul className="checks">{fit.checks.map(([label, ok]) => <li key={label} className={ok ? 'ok' : 'miss'}><Icon name={ok ? 'check' : 'x'} size={14} />{t(label)}</li>)}</ul>
      </div>
      {person.about ? <div className="card"><p className="note-label">{t('Perks of dating me')}</p><p className="quote">{person.about}</p></div> : null}
      {facts.length ? <dl className="facts-list">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
      {habits.length || person.interests.length ? <ul className="chip-list">{[...habits, ...person.interests].map((x) => <li key={x}>{x}</li>)}</ul> : null}
      <p className="private"><Icon name="lock" size={18} />{t('Neither of you can see the other\'s date, time or place of birth. Only the result is shared.')}</p>
      {link ? <Link className="btn outline" to={`${base}/people/${person.user_id}`}>{t('Open full profile')}<Icon name="go" size={20} /></Link> : null}
    </section>
  );
}

function Deck({ userId, me, selfId }) {
  const t = useT();
  const { own, acting, base } = useActor();
  const { data: people, error, set } = useDiscover(userId, me, selfId, Boolean(acting));
  const canLike = !acting || acting.can_like; // a helper without this can only suggest
  const [skipped, setSkipped] = useState(() => new Set());
  const [view, setView] = useState('swipe');
  const [everyone, setEveryone] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [matched, setMatched] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (error) return <p className="error" role="alert">{t(error)}</p>;
  if (!people) return <ListSkeleton label={t('Finding people…')} />;

  const shown = people.filter((p) => everyone || p.fit.fits);
  const isSuggested = (p) => p.suggested_by !== null && p.suggested_by !== undefined;
  const queue = shown.filter((p) => !p.my_kind && (canLike || (!skipped.has(p.user_id) && !isSuggested(p))));
  const current = queue[0] ?? null;
  const open = view === 'swipe' ? current : shown.find((p) => p.user_id === openId) ?? shown[0] ?? null;

  async function act(person, kind) {
    setActionError(null);
    const before = person.my_kind;
    set((list) => list.map((p) => (p.user_id === person.user_id ? { ...p, my_kind: kind } : p)));
    try {
      if (await decide(userId, person, kind)) setMatched(person);
    } catch {
      set((list) => list.map((p) => (p.user_id === person.user_id ? { ...p, my_kind: before } : p)));
      setActionError(t('That could not be saved. Try again.'));
    }
  }

  async function suggest(person) {
    setActionError(null);
    const before = person.suggested_by ?? null;
    const on = !isSuggested(person);
    set((list) => list.map((p) => (p.user_id === person.user_id ? { ...p, suggested_by: on ? '' : null } : p)));
    try { await setSuggestion(own, userId, person.user_id, on); } catch {
      set((list) => list.map((p) => (p.user_id === person.user_id ? { ...p, suggested_by: before } : p)));
      setActionError(t('That could not be saved. Try again.'));
    }
  }
  const suggestedTag = (p) => (!acting && isSuggested(p) ? <span className="tag focus">{t('{0} suggests', [p.suggested_by || t('Family')])}</span> : null);

  const hidden = people.length - people.filter((p) => p.fit.fits).length;
  return (
    <>
      <h1 className="visually-hidden">{t('Vibe match')}</h1>
      <div className="title-row">
        <div className="switch" role="group" aria-label={t('View')}>
          <button type="button" aria-pressed={view === 'swipe'} className={view === 'swipe' ? 'on' : undefined} onClick={() => setView('swipe')}>{t('Swipe')}</button>
          <button type="button" aria-pressed={view === 'browse'} className={view === 'browse' ? 'on' : undefined} onClick={() => setView('browse')}>{t('Browse all')}</button>
        </div>
        <p className="hint">
          {everyone ? t('{0} people', [people.length]) : t('{0} people fit your filters', [shown.length])}
          {hidden > 0 || everyone ? <>{' · '}<button type="button" className="link" onClick={() => setEveryone(!everyone)}>{everyone ? t('Only my filters') : t('Show everyone')}</button></> : null}
          {acting ? null : <>{' · '}<Link to="/me/preferences">{t('Change my filters')}</Link></>}
        </p>
      </div>
      {actionError ? <p className="error" role="alert">{actionError}</p> : null}

      {people.length === 0 ? (
        <div className="empty card"><h1>{t('Nobody here yet')}</h1><p className="muted">{t('You are among the first. People appear here as they set up their profiles.')}</p></div>
      ) : (
        <div className="discover">
          <div className="discover-main">
            {view === 'swipe' ? (current ? (
              <>
                <article className="deck-card msg" key={current.user_id} aria-label={`${current.display_name}, ${current.age}`}>
                  <Face person={current} className="deck-photo" />
                  <div className="deck-text">
                    <p className="deck-name">{current.display_name}, {current.age}</p>
                    {summaryLines(current, t).map((x) => <p key={x}>{x}</p>)}
                    {suggestedTag(current)}
                  </div>
                </article>
                <div className="card deck-score"><Ring total={current.match.total} max={36} /><div><p><strong>{t(current.match.band)}</strong></p><p className="hint">{t('Fits {0} of your {1} preferences', [current.fit.passed, current.fit.checks.length])}</p></div></div>
                {canLike ? (
                  <div className="deck-actions">
                    <button type="button" className="round" aria-label={t('Pass on {0}', [current.display_name])} onClick={() => act(current, 'pass')}><Icon name="x" size={28} /></button>
                    <button type="button" className="round like" aria-label={t('Like {0}', [current.display_name])} onClick={() => act(current, 'like')}><Icon name="heart" size={28} /></button>
                  </div>
                ) : (
                  <div className="deck-actions">
                    <button type="button" className="round" aria-label={t('Skip {0}', [current.display_name])} onClick={() => setSkipped((old) => new Set(old).add(current.user_id))}><Icon name="x" size={28} /></button>
                    <button type="button" className="btn" onClick={() => suggest(current)}><Icon name="star" size={20} />{t('Suggest to {0}', [acting.name])}</button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty card">
                <h1>{t('You\'ve seen everyone who fits')}</h1>
                <p className="muted">{t('Widen your filters to meet more people, or browse the full list.')}</p>
                <button type="button" className="btn" onClick={() => setView('browse')}>{t('Browse everyone')}<Icon name="go" size={20} /></button>
                {acting ? null : <Link className="btn outline" to="/me/preferences"><Icon name="sliders" size={20} />{t('Change my filters')}</Link>}
              </div>
            )) : (
              <ul className="meet-list">
                {shown.map((p) => (
                  <li key={p.user_id} className={open?.user_id === p.user_id ? 'card meet-person on' : 'card meet-person'}>
                    <button type="button" className="person-open" aria-pressed={open?.user_id === p.user_id} onClick={() => setOpenId(p.user_id)}>
                      <Face person={p} />
                      <span><strong>{p.display_name}, {p.age}</strong>{summaryLines(p, t).map((x) => <span key={x} className="hint">{x}</span>)}<span className="tag">{t('Vibe score {0}/36', [p.match.total])} · {t(p.match.band)}</span>{suggestedTag(p)}</span>
                    </button>
                    {canLike
                      ? <button type="button" className={p.my_kind === 'like' ? 'round small like' : 'round small'} aria-pressed={p.my_kind === 'like'} aria-label={t('Like {0}', [p.display_name])} onClick={() => act(p, p.my_kind === 'like' ? 'pass' : 'like')}><Icon name="heart" size={22} /></button>
                      : <button type="button" className={isSuggested(p) ? 'round small like' : 'round small'} aria-pressed={isSuggested(p)} aria-label={t('Suggest {0} to {1}', [p.display_name, acting.name])} onClick={() => suggest(p)}><Icon name="star" size={22} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {open ? <Why person={open} link base={base} forName={acting?.name ?? null} /> : null}
        </div>
      )}

      {matched ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="matched-title">
          <div className="modal-card msg">
            <Face person={matched} className="face large" />
            <h2 id="matched-title">{t('It\'s a match!')}</h2>
            <p>{acting ? t('{0} and {1} liked each other. Their vibe score is {2}/36.', [acting.name, matched.display_name, matched.match.total]) : t('You and {0} liked each other. Your vibe score is {1}/36.', [matched.display_name, matched.match.total])}</p>
            {!acting || acting.can_chat ? <Link className="btn" to={`${base}/chats/${matched.user_id}`}>{t('Say hello')}<Icon name="go" size={20} /></Link> : null}
            <button type="button" className="link" onClick={() => setMatched(null)}>{t('Keep looking')}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Meet people: one card at a time, or the whole list, best kundli match first. */
export default function Discover() {
  const t = useT();
  const { userId, acting } = useActor();
  const { self } = useAccount();
  const meet = useMeetProfile(userId);
  if (meet.error) return <p className="error" role="alert">{t(meet.error)}</p>;
  if (!meet.data) return <ListSkeleton label={t('Loading…')} />;
  if (!meet.data.profile && acting) {
    return (
      <div className="sheet">
        <h1>{t('{0} has not set up a profile yet', [acting.name])}</h1>
        <p className="muted">{t('They need to add their own details and photos first. Then you can look for matches together.')}</p>
        <Link className="btn" to="/family">{t('Back to family')}</Link>
      </div>
    );
  }
  if (!meet.data.profile) {
    return (
      <div className="sheet">
        <h1>{t('Meet people who fit your kundli')}</h1>
        <p className="muted">{t('Set up the profile other people will see, then come back here to find your matches.')}</p>
        <Link className="btn" to="/me">{t('Set up my profile')}<Icon name="go" size={20} /></Link>
      </div>
    );
  }
  return <Deck userId={userId} me={meet.data.profile} selfId={self?.id ?? null} />;
}
