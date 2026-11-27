import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRemembered, store } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount } from '../lib/account.jsx';
import { useT } from '../lib/language.jsx';
import { GENDERS, INTERESTED_IN, LOOKING_FOR, MARITAL, DIETS, DRINKING, SMOKING, FAMILY_TYPES, INCOMES, RELIGIONS, TONGUES, HEIGHTS, ageOn, blankProfile, completeness, toList } from '../lib/meet.js';
import { photoLinks } from '../lib/photos.js';
import { saveOwnKeys, forgetDiscover } from '../lib/meetData.js';
import PhotoGrid from '../components/PhotoGrid.jsx';
import Toggle from '../components/Toggle.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

const FIELDS = Object.keys(blankProfile(null));

/** Load the signed-in person's meet-and-match profile and photos. `profile` is null until they save one. */
export function useMeetProfile(userId) {
  return useRemembered(`meet:${userId}`, async () => {
    const [profile, photos] = await Promise.all([
      supabase.from('meet_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('meet_photos').select('id, path, position, status').eq('user_id', userId).order('position'),
    ]);
    if (profile.error || photos.error) throw new Error('Your profile could not be loaded. Refresh the page to try again.');
    return { profile: profile.data, photos: photos.data ?? [] };
  }, { maxAge: 60 * 1000 });
}

function Choice({ label, options, value, onChange, t }) {
  return (
    <fieldset className="plain-fieldset">
      <legend>{label}</legend>
      <div className="pills" role="group" aria-label={label}>
        {options.map(([key, name]) => <button key={key} type="button" aria-pressed={value === key} className={value === key ? 'pill on' : 'pill'} onClick={() => onChange(key)}>{t(name)}</button>)}
      </div>
    </fieldset>
  );
}
function Pick({ label, options, value, onChange, t, empty }) {
  return (
    <label>{label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{empty ?? t('Choose…')}</option>
        {options.map(([key, name]) => <option key={key} value={key}>{typeof name === 'string' && typeof key === 'string' ? t(name) : name}</option>)}
      </select>
    </label>
  );
}

function MeForm({ userId, self, saved, photos: firstPhotos, cacheKey }) {
  const t = useT();
  const [p, setP] = useState(() => ({ ...blankProfile(self), ...(saved ? Object.fromEntries(FIELDS.map((k) => [k, saved[k]])) : {}) }));
  const [interestText, setInterestText] = useState(() => (saved?.interests ?? []).join(', '));
  const [photos, setPhotos] = useState(firstPhotos);
  const [exists, setExists] = useState(Boolean(saved));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (patch) => { setP((old) => ({ ...old, ...patch })); setDone(false); };
  const text = (key, max) => ({ value: p[key], maxLength: max, onChange: (e) => set({ [key]: e.target.value }) });

  const main = useRemembered(photos[0] ? `photoLink:${photos[0].path}` : null, () => photoLinks([photos[0].path]).then((l) => l[photos[0].path] ?? null), { maxAge: 50 * 60 * 1000 });
  const facts = useRemembered(self ? `meetFacts:${self.id}` : null, async () => {
    const { data } = await supabase.from('charts').select('lagna:data->vedic->lagna->>rashi, moon:data->vedic->>moonSign, star:data->vedic->dasha->>moonNakshatra').eq('birth_profile_id', self.id).eq('system', 'vedic').maybeSingle();
    return data ?? {};
  }, { maxAge: 10 * 60 * 1000 });

  const interests = toList(interestText);
  const state = completeness({ ...p, interests }, photos.length);
  const age = ageOn(self.birth_date);

  function changePhotos(next) {
    setPhotos(next);
    store(cacheKey, { profile: exists ? { ...p, interests, user_id: userId } : null, photos: next });
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!p.display_name.trim()) { setError(t('Add the name you want shown on your profile.')); return; }
    if (!p.gender || !p.interested_in) { setError(t('Choose who you are and who you want to meet.')); return; }
    setBusy(true);
    const row = { ...p, display_name: p.display_name.trim(), interests, user_id: userId };
    const { error: err } = await supabase.from('meet_profiles').upsert(row, { onConflict: 'user_id' });
    setBusy(false);
    if (err) { setError(t('Your profile could not be saved. Check the details and try again.')); return; }
    setExists(true);
    setDone(true);
    // Matching reads a few facts from the chart; save them so other people can be matched with this profile.
    saveOwnKeys(userId, self.id).catch(() => {});
    forgetDiscover(userId);
    store(cacheKey, { profile: row, photos });
  }

  return (
    <form className="sheet meet" onSubmit={save} noValidate>
      <div className="profile-head">
        {main.data ? <img className="avatar large photo-avatar" src={main.data} alt="" /> : <span className="avatar large" aria-hidden="true">{(p.display_name || self.name).trim().charAt(0).toUpperCase()}</span>}
        <div>
          <h1>{p.display_name.trim() || self.name}, {age}</h1>
          <p className="muted">{exists ? t('This is how others will see you.') : t('Set up the profile other people will see.')}</p>
        </div>
      </div>
      <div className="card complete">
        <div className="title-row"><strong>{t('Profile {0}% complete', [state.percent])}</strong><span className="hint">{state.next ? t(state.next) : t('Nothing missing.')}</span></div>
        <span className="bar" aria-hidden="true"><span style={{ width: `${state.percent}%` }} /></span>
      </div>

      <section aria-labelledby="me-photos">
        <h2 id="me-photos">{t('Photos')}</h2>
        <PhotoGrid userId={userId} photos={photos} onChange={changePhotos} />
      </section>

      <section aria-labelledby="me-about">
        <h2 id="me-about">{t('About you')}</h2>
        <label>{t('Name shown on your profile')}<input {...text('display_name', 40)} autoComplete="given-name" required /></label>
        <Choice t={t} label={t('I am')} options={GENDERS} value={p.gender} onChange={(v) => set({ gender: v })} />
        <Choice t={t} label={t('Show me')} options={INTERESTED_IN} value={p.interested_in} onChange={(v) => set({ interested_in: v })} />
        <Choice t={t} label={t('I\'m looking for')} options={LOOKING_FOR} value={p.looking_for} onChange={(v) => set({ looking_for: v })} />
        <label>{t('Perks of dating me')}
          <textarea rows={3} {...text('about', 300)} placeholder={t('One or two lines that sound like you.')} />
          <span className="hint">{t('{0} of 300 characters', [p.about.length])}</span>
        </label>
      </section>

      <section aria-labelledby="me-basics">
        <h2 id="me-basics">{t('The basics')}</h2>
        <div className="fields">
          <Pick t={t} label={t('Height')} options={HEIGHTS} value={p.height_cm} onChange={(v) => set({ height_cm: v ? Number(v) : null })} />
          <label>{t('Lives in')}<input {...text('city', 80)} placeholder={t('City')} /></label>
          <label>{t('Education')}<input {...text('education', 80)} placeholder={t('Highest degree')} /></label>
          <label>{t('Work')}<input {...text('work', 80)} placeholder={t('What you do')} /></label>
          <Pick t={t} label={t('Marital status')} options={MARITAL} value={p.marital_status} onChange={(v) => set({ marital_status: v })} />
          <Pick t={t} label={t('Food')} options={DIETS} value={p.diet} onChange={(v) => set({ diet: v })} />
          <Pick t={t} label={t('Drinking')} options={DRINKING} value={p.drinking} onChange={(v) => set({ drinking: v })} />
          <Pick t={t} label={t('Smoking')} options={SMOKING} value={p.smoking} onChange={(v) => set({ smoking: v })} />
        </div>
        <label>{t('Interests')}<input value={interestText} onChange={(e) => { setInterestText(e.target.value); setDone(false); }} placeholder={t('Trekking, indie music, cricket')} />
          <span className="hint">{t('Separate them with commas. Up to 10.')}</span></label>
        {interests.length ? <ul className="chip-list" aria-label={t('Interests')}>{interests.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      </section>

      <section aria-labelledby="me-family">
        <h2 id="me-family">{t('Background and family')}</h2>
        <p className="hint">{t('People filter on these, so filling them in gets you seen by the right matches. Switch off any you would rather keep to yourself.')}</p>
        <div className="fields">
          <label>{t('Religion')}<input {...text('religion', 40)} list="meet-religions" /></label>
          <label>{t('Community')}<input {...text('community', 60)} placeholder={t('For example Rajput, Patel, Iyer')} /></label>
          <label>{t('Mother tongue')}<input {...text('mother_tongue', 40)} list="meet-tongues" /></label>
          <label>{t('Gotra (optional)')}<input {...text('gotra', 40)} /></label>
          <Pick t={t} label={t('Income')} options={INCOMES} value={p.income_range} onChange={(v) => set({ income_range: v })} />
          <Pick t={t} label={t('Family')} options={FAMILY_TYPES} value={p.family_type} onChange={(v) => set({ family_type: v })} />
          <label>{t('Parents')}<input {...text('parents', 120)} placeholder={t('For example: father runs a shop, mother teaches')} /></label>
          <label>{t('Siblings')}<input {...text('siblings', 120)} placeholder={t('For example: one elder sister')} /></label>
        </div>
        <datalist id="meet-religions">{RELIGIONS.map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="meet-tongues">{TONGUES.map((x) => <option key={x} value={x} />)}</datalist>
        <div className="toggles">
          <Toggle label={t('Show my religion')} checked={p.show_religion} onChange={(v) => set({ show_religion: v })} />
          <Toggle label={t('Show my community')} checked={p.show_community} onChange={(v) => set({ show_community: v })} />
          <Toggle label={t('Show my income')} hint={t('Only ever shown as a range')} checked={p.show_income} onChange={(v) => set({ show_income: v })} />
        </div>
        <p className="hint">{t('None of these change your kundli score.')}</p>
      </section>

      <section aria-labelledby="me-kundli">
        <h2 id="me-kundli">{t('From your kundli')}</h2>
        {facts.data?.moon ? (
          <ul className="chip-list">
            {facts.data.lagna ? <li>{t('{0} rising', [t(facts.data.lagna)])}</li> : null}
            <li>{t('Moon in {0}', [t(facts.data.moon)])}</li>
            <li>{t('{0} star', [t(facts.data.star)])}</li>
          </ul>
        ) : <p className="hint">{t('Your signs appear here once your chart has been drawn.')} <Link to={`/charts/${self.id}`}>{t('Open my chart')}</Link></p>}
        <p className="private"><Icon name="lock" size={18} />{t('Others see these signs and your age. Your date, time and place of birth are never shown.')}</p>
      </section>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {done ? <p className="notice" role="status">{t('Saved.')}</p> : null}
      <button type="submit" className="btn" disabled={busy}>{busy ? t('Saving…') : t('Save my profile')}</button>
      {exists ? <Link className="btn outline" to="/me/preferences"><Icon name="sliders" size={20} />{t('Who I want to meet')}</Link> : null}
    </form>
  );
}

/** The profile other people will see: photos, details, background and family. */
export default function Me() {
  const t = useT();
  const { session } = useAuth();
  const { self } = useAccount();
  const userId = session.user.id;
  const { data, error } = useMeetProfile(userId);

  if (ageOn(self.birth_date) < 18) {
    return <div className="sheet"><h1>{t('Meet and match is for adults')}</h1><p className="muted">{t('You need to be 18 or older to make a profile here. Your chart and readings are still yours to use.')}</p></div>;
  }
  if (error) return <p className="error" role="alert">{t(error)}</p>;
  if (!data) return <ListSkeleton label={t('Loading your profile…')} />;
  return <MeForm key={userId} userId={userId} self={self} saved={data.profile} photos={data.photos} cacheKey={`meet:${userId}`} />;
}
