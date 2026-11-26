import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { formatBirth, formatDate, todayISO } from '../lib/format.js';
import { useProfiles } from './Profiles.jsx';
import { LanguageSwitch, useLanguage, wordsFor } from '../lib/language.jsx';
import AskChart from '../components/AskChart.jsx';
import { DaySkeleton } from '../components/Skeleton.jsx';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

function localZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
}

/** The engine's working for the day, so the reading can be checked against it. */
function DayFacts({ day }) {
  const tara = { good: 'favourable', difficult: 'unfavourable', mixed: 'mixed' }[day.tara.quality];
  return (
    <dl className="day-facts">
      <div>
        <dt>Moon today</dt>
        <dd>{day.moon.rashi}, in {day.moon.nakshatra}</dd>
      </div>
      <div>
        <dt>{day.theme.basis === 'lagna' ? 'In your chart' : 'From your Moon sign'}</dt>
        <dd>{ORDINALS[day.theme.house - 1]} house: {day.theme.topics}</dd>
      </div>
      {day.theme.basis === 'lagna' ? (
        <div>
          <dt>From your birth Moon</dt>
          <dd>{ORDINALS[day.moon.houseFromMoon - 1]} house, {day.moon.chandraBala === 'favourable' ? 'a comfortable place' : 'a less easy place'}</dd>
        </div>
      ) : null}
      <div>
        <dt>Star of the day for you</dt>
        <dd>{day.tara.name} ({day.tara.meaning}), {tara} for new starts</dd>
      </div>
      {day.dasha ? (
        <div>
          <dt>Your period</dt>
          <dd>{day.dasha.maha} mahadasha, {day.dasha.antar} sub-period until {formatDate(day.dasha.antarEnd, { month: 'short', year: 'numeric' })}</dd>
        </div>
      ) : null}
      {day.saturn.phase ? (
        <div>
          <dt>Saturn</dt>
          <dd>{day.saturn.phase}</dd>
        </div>
      ) : null}
      {day.sky.highlights.length ? (
        <div>
          <dt>In the sky</dt>
          <dd>{day.sky.highlights.join('; ')}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function PersonalDay({ profile }) {
  const [language] = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timezone = localZone();
  const date = todayISO(timezone);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api('/api/today', { method: 'POST', auth: true, body: { birthProfileId: profile.id, language, date, timezone } })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [profile.id, language, date, timezone]);

  const shown = data?.reading.language ?? language;
  const w = wordsFor(shown);
  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString(shown === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="title-row">
        <p className="lede" lang={shown}>{longDate}</p>
        <LanguageSwitch />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!data && !error ? <DaySkeleton label={`Reading today against ${profile.name}'s chart…`} /> : null}
      {data ? (
        <div className="day">
          <article className="day-reading" lang={shown}>
            <span className="tone">{w.tone[data.day.tone]}</span>
            <h1>{data.reading.title}</h1>
            {data.reading.source === 'rules' && language === 'hi' ? <p className="notice" lang="en">{wordsFor('en').hindiUnavailable}</p> : null}
            <p className="reading-text">{data.reading.text}</p>
            <dl className="day-notes">
              {data.reading.goodFor ? <div><dt>{w.goodFor}</dt><dd>{data.reading.goodFor}</dd></div> : null}
              {data.reading.takeCare ? <div><dt>{w.takeCare}</dt><dd>{data.reading.takeCare}</dd></div> : null}
            </dl>
          </article>
          <aside className="day-why" aria-labelledby="day-why-title">
            <h2 id="day-why-title">Why today reads this way</h2>
            <DayFacts day={data.day} />
            <p className="hint">Read for <Link to={`/charts/${profile.id}`}>{profile.name}'s chart</Link>{data.day.timeKnown ? '' : ', without a birth time'}.</p>
          </aside>
        </div>
      ) : null}
      <AskChart profileId={profile.id} title={wordsFor(language).askToday} />
    </>
  );
}

export default function Today() {
  const { profiles, error, reload } = useProfiles();
  const [saveError, setSaveError] = useState(null);

  async function chooseSelf(id) {
    setSaveError(null);
    const { error: err } = await supabase.from('birth_profiles').update({ is_self: true }).eq('id', id);
    if (err) setSaveError('That could not be saved. Try again.');
    reload();
  }

  if (error) return <><h1>Today</h1><p className="error" role="alert">{error}</p></>;
  if (!profiles) return <DaySkeleton label="Loading your day…" />;

  const self = profiles.find((p) => p.is_self);
  if (self) return <PersonalDay profile={self} />;

  if (profiles.length === 0) {
    return (
      <div className="narrow">
        <h1>A reading for your day, from your own chart</h1>
        <p className="lede">Add your birth details once. After that, this page reads each day against your chart: where today's Moon falls from your birth Moon and lagna, and the period you are in.</p>
        <Link className="button primary" to="/charts/new">Add my birth details</Link>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1>Which chart is yours?</h1>
      <p className="lede">Today's reading is made for one person. Choose your own chart and this page will follow it.</p>
      {saveError ? <p className="error" role="alert">{saveError}</p> : null}
      <ul className="profile-list">
        {profiles.map((p) => (
          <li key={p.id}>
            <div>
              <h2>{p.name}</h2>
              <p className="muted">{formatBirth(p)}, {p.place_name}</p>
            </div>
            <button type="button" className="button" onClick={() => chooseSelf(p.id)}>This is me</button>
          </li>
        ))}
      </ul>
      <p><Link to="/charts/new">None of these: add my birth details</Link></p>
    </div>
  );
}
