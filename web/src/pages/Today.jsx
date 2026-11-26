import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatDate, todayISO } from '../lib/format.js';
import { useAccount } from '../lib/account.jsx';
import { LanguageSwitch, useLanguage, wordsFor } from '../lib/language.jsx';
import { DaySkeleton } from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

function localZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
}

function Why({ icon, title, children }) {
  return (
    <div className="card why-card">
      <span className="why-icon"><Icon name={icon} /></span>
      <div><p className="why-title">{title}</p><p className="why-text">{children}</p></div>
    </div>
  );
}

/** The engine's working for the day, so the reading can be checked against it. */
function DayFacts({ day }) {
  const tara = { good: 'Good for new starts.', difficult: 'Better for routine work than new starts.', mixed: 'A reflective day more than a day for launches.' }[day.tara.quality];
  return (
    <>
      <Why icon="moon" title={`Moon in ${day.moon.rashi}`}>
        {day.theme.basis === 'lagna'
          ? `It sits in your ${ORDINALS[day.theme.house - 1]} house: ${day.theme.topics}.`
          : `Counted from your Moon sign, it lights up the ${ORDINALS[day.theme.house - 1]} house: ${day.theme.topics}.`}
      </Why>
      <Why icon="star" title={`Star of the day: ${day.tara.name}`}>"{day.tara.meaning[0].toUpperCase()}{day.tara.meaning.slice(1)}" star for your birth star. {tara}</Why>
      {day.dasha ? (
        <Why icon="clock" title={`Your period: ${day.dasha.maha}, with ${day.dasha.antar}`}>This sub-period runs until {formatDate(day.dasha.antarEnd, { month: 'long', year: 'numeric' })}.</Why>
      ) : null}
      {day.saturn.phase ? <Why icon="sun" title={`Saturn: ${day.saturn.phase}`}>{day.saturn.note}</Why> : null}
    </>
  );
}

export default function Today() {
  const { self } = useAccount();
  const [language] = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timezone = localZone();
  const date = todayISO(timezone);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api('/api/today', { method: 'POST', auth: true, body: { birthProfileId: self.id, language, date, timezone } })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [self.id, language, date, timezone]);

  const shown = data?.reading.language ?? language;
  const w = wordsFor(shown);
  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString(shown === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="title-row">
        <p className="muted" lang={shown}>{longDate}</p>
        <LanguageSwitch />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!data && !error ? <DaySkeleton label={`Reading today against your chart…`} /> : null}
      {data ? (
        <div className="day">
          <article className="day-main" lang={shown}>
            <div className="day-hero">
              <div className="arch">
                <span className="float"><Icon name="moon" size={40} /></span>
                <span className="tag white">{w.tone[data.day.tone]}</span>
                <span className="arch-note">Moon in {data.day.moon.rashi}</span>
              </div>
              <div>
                <h1>{data.reading.title}</h1>
                <p className="muted" lang="en">Read from your own chart, {self.name}. <Link to={`/charts/${self.id}`}>Open my chart</Link></p>
              </div>
            </div>
            {data.reading.source === 'rules' && language === 'hi' ? <p className="notice" lang="en">{wordsFor('en').hindiUnavailable}</p> : null}
            <p className="reading-text">{data.reading.text}</p>
            <div className="day-notes">
              {data.reading.goodFor ? <div className="card"><p className="note-label">{w.goodFor}</p><p><strong>{data.reading.goodFor}</strong></p></div> : null}
              {data.reading.takeCare ? <div className="card"><p className="note-label">{w.takeCare}</p><p><strong>{data.reading.takeCare}</strong></p></div> : null}
            </div>
          </article>
          <aside className="day-why" aria-labelledby="day-why-title">
            <h2 id="day-why-title">Why today reads this way</h2>
            <DayFacts day={data.day} />
            <Link className="btn" to="/ask">Ask about your day<Icon name="go" size={20} /></Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}
