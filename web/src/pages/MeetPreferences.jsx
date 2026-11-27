import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRemembered, forget, store } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useT } from '../lib/language.jsx';
import { LOOKING_FOR, MARITAL, INCOMES, MANGLIK, HEIGHTS, blankPreferences, toList } from '../lib/meet.js';
import { removePhotos } from '../lib/photos.js';
import { useMeetProfile } from './Me.jsx';
import Toggle from '../components/Toggle.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

const AGES = Array.from({ length: 63 }, (_, i) => 18 + i);
const KEYS = Object.keys(blankPreferences());

function Many({ label, options, values, onChange, t }) {
  const flip = (key) => onChange(values.includes(key) ? values.filter((v) => v !== key) : [...values, key]);
  return (
    <fieldset className="plain-fieldset">
      <legend>{label}</legend>
      <div className="pills" role="group" aria-label={label}>
        <button type="button" aria-pressed={values.length === 0} className={values.length === 0 ? 'pill on' : 'pill'} onClick={() => onChange([])}>{t('Open to all')}</button>
        {options.map(([key, name]) => <button key={key} type="button" aria-pressed={values.includes(key)} className={values.includes(key) ? 'pill on' : 'pill'} onClick={() => flip(key)}>{t(name)}</button>)}
      </div>
    </fieldset>
  );
}

function PreferencesForm({ userId, profile, photos, saved }) {
  const t = useT();
  const navigate = useNavigate();
  const [f, setF] = useState(() => ({ ...blankPreferences(), ...(saved ? Object.fromEntries(KEYS.map((k) => [k, saved[k]])) : {}) }));
  const [lists, setLists] = useState(() => ({ religions: (saved?.religions ?? []).join(', '), communities: (saved?.communities ?? []).join(', '), mother_tongues: (saved?.mother_tongues ?? []).join(', ') }));
  const [vis, setVis] = useState({ discoverable: profile.discoverable, only_liked: profile.only_liked });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (patch) => { setF((old) => ({ ...old, ...patch })); setDone(false); };
  const score = Number(f.min_score);

  async function flip(key, value) {
    const before = vis;
    setVis({ ...vis, [key]: value });
    const { error: err } = await supabase.from('meet_profiles').update({ [key]: value }).eq('user_id', userId);
    if (err) { setVis(before); setError(t('That could not be saved. Try again.')); return; }
    store(`meet:${userId}`, { profile: { ...profile, ...vis, [key]: value }, photos });
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (f.age_min > f.age_max) { setError(t('The youngest age cannot be above the oldest.')); return; }
    setBusy(true);
    const row = { ...f, religions: toList(lists.religions), communities: toList(lists.communities), mother_tongues: toList(lists.mother_tongues), user_id: userId };
    const { error: err } = await supabase.from('meet_preferences').upsert(row, { onConflict: 'user_id' });
    setBusy(false);
    if (err) { setError(t('Your preferences could not be saved. Try again.')); return; }
    setDone(true);
    store(`meetPrefs:${userId}`, row);
  }

  async function removeAll() {
    setError(null);
    try {
      await removePhotos(photos);
      const a = await supabase.from('meet_preferences').delete().eq('user_id', userId);
      const b = await supabase.from('meet_profiles').delete().eq('user_id', userId);
      if (a.error || b.error) throw new Error('delete');
      forget(`meet:${userId}`, `meetPrefs:${userId}`, 'photoLink:');
      navigate('/profile', { replace: true });
    } catch { setConfirming(false); setError(t('Your profile could not be deleted. Try again.')); }
  }

  return (
    <form className="sheet meet" onSubmit={save} noValidate>
      <div>
        <p><Link className="back" to="/me"><Icon name="back" size={18} />{t('My profile')}</Link></p>
        <h1>{t('Who I want to meet')}</h1>
        <p className="muted">{t('Anything you leave as "open to all" does not filter anyone out.')}</p>
      </div>

      <div className="card toggles">
        <Toggle label={t('Show me in Vibe match')} hint={vis.discoverable ? t('Everyone on Astro Book can find you.') : t('Paused. Nobody new can find you.')} checked={vis.discoverable} onChange={(v) => flip('discoverable', v)} />
        <Toggle label={t('Only people I like can see me')} hint={t('Off by default: everyone can find you')} checked={vis.only_liked} onChange={(v) => flip('only_liked', v)} />
      </div>

      <section aria-labelledby="pref-who">
        <h2 id="pref-who">{t('The basics')}</h2>
        <div className="fields">
          <label>{t('Youngest age')}<select value={f.age_min} onChange={(e) => set({ age_min: Number(e.target.value) })}>{AGES.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label>{t('Oldest age')}<select value={f.age_max} onChange={(e) => set({ age_max: Number(e.target.value) })}>{AGES.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label>{t('Height, at least')}<select value={f.height_min_cm ?? ''} onChange={(e) => set({ height_min_cm: e.target.value ? Number(e.target.value) : null })}><option value="">{t('Open to all')}</option>{HEIGHTS.map(([cm, name]) => <option key={cm} value={cm}>{name}</option>)}</select></label>
          <label>{t('Income, at least')}<select value={f.income_min ?? ''} onChange={(e) => set({ income_min: e.target.value || null })}><option value="">{t('Open to all')}</option>{INCOMES.map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}</select></label>
        </div>
        <Many t={t} label={t('Looking for')} options={LOOKING_FOR} values={f.looking_for} onChange={(v) => set({ looking_for: v })} />
        <Many t={t} label={t('Marital status')} options={MARITAL} values={f.marital_statuses} onChange={(v) => set({ marital_statuses: v })} />
      </section>

      <section aria-labelledby="pref-bg">
        <h2 id="pref-bg">{t('Background')}</h2>
        <p className="hint">{t('Leave a box empty to stay open to all. Separate more than one with commas.')}</p>
        <div className="fields">
          <label>{t('Religion')}<input value={lists.religions} onChange={(e) => { setLists({ ...lists, religions: e.target.value }); setDone(false); }} placeholder={t('Open to all')} /></label>
          <label>{t('Community')}<input value={lists.communities} onChange={(e) => { setLists({ ...lists, communities: e.target.value }); setDone(false); }} placeholder={t('Open to all')} /></label>
          <label>{t('Mother tongue')}<input value={lists.mother_tongues} onChange={(e) => { setLists({ ...lists, mother_tongues: e.target.value }); setDone(false); }} placeholder={t('Open to all')} /></label>
        </div>
      </section>

      <section aria-labelledby="pref-kundli">
        <h2 id="pref-kundli">{t('Kundli')}</h2>
        <div className="card">
          <div className="title-row"><label htmlFor="pref-score"><strong>{t('Lowest vibe score to show me')}</strong></label><span className="tag">{t('Vibe score {0}/36', [score])}</span></div>
          <input id="pref-score" className="range" type="range" min="0" max="30" step="1" value={score} onChange={(e) => set({ min_score: Number(e.target.value) })} />
          <p className="hint">{score === 0 ? t('Showing everyone, whatever the score.') : score < 18 ? t('Includes matches below the traditional pass mark of 18.') : score === 18 ? t('18 is the traditional pass mark.') : t('Stricter than the traditional pass mark, so you will see fewer people.')}</p>
        </div>
        <fieldset className="plain-fieldset">
          <legend>{t('Manglik')}</legend>
          <div className="switch three" role="group" aria-label={t('Manglik')}>
            {MANGLIK.map(([key, name]) => <button key={key} type="button" aria-pressed={f.manglik === key} className={f.manglik === key ? 'on' : undefined} onClick={() => set({ manglik: key })}>{t(name)}</button>)}
          </div>
        </fieldset>
      </section>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {done ? <p className="notice" role="status">{t('Saved.')}</p> : null}
      <button type="submit" className="btn" disabled={busy}>{busy ? t('Saving…') : t('Save my preferences')}</button>

      <section aria-labelledby="pref-delete" className="danger-zone">
        <h2 id="pref-delete">{t('Delete my Vibe match profile')}</h2>
        <p className="hint">{t('This removes your photos, details and preferences. Your charts and readings stay.')}</p>
        {confirming ? (
          <p className="title-row"><strong>{t('Delete it for good?')}</strong><span className="pills"><button type="button" className="btn small danger" onClick={removeAll}>{t('Delete it')}</button><button type="button" className="link" onClick={() => setConfirming(false)}>{t('Keep it')}</button></span></p>
        ) : <button type="button" className="btn outline danger" onClick={() => setConfirming(true)}>{t('Delete my profile')}</button>}
      </section>
    </form>
  );
}

/** Preferences, discovery and safety for meet and match. */
export default function MeetPreferences() {
  const t = useT();
  const { session } = useAuth();
  const userId = session.user.id;
  const meet = useMeetProfile(userId);
  const prefs = useRemembered(`meetPrefs:${userId}`, async () => {
    const { data, error } = await supabase.from('meet_preferences').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error('Your preferences could not be loaded. Refresh the page to try again.');
    return data ?? false;
  }, { maxAge: 60 * 1000 });

  if (meet.error || prefs.error) return <p className="error" role="alert">{t(meet.error ?? prefs.error)}</p>;
  if (!meet.data || prefs.data === null) return <ListSkeleton label={t('Loading your preferences…')} />;
  if (!meet.data.profile) return <Navigate to="/me" replace />;
  return <PreferencesForm key={userId} userId={userId} profile={meet.data.profile} photos={meet.data.photos} saved={prefs.data || null} />;
}
