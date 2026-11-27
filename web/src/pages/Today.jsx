import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useRemembered } from '../lib/cache.js';
import { formatDate, todayISO, currentLocale } from '../lib/format.js';
import { useAccount } from '../lib/account.jsx';
import { useLanguage, useT, msg } from '../lib/language.jsx';

const TONES = { supportive: msg('A supportive day'), steady: msg('A steady day'), demanding: msg('A demanding day') };
import { DaySkeleton } from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';

import { HOUSE_NAMES } from '../lib/kundli.js';

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
  const t = useT();
  const tara = { good: t('Good for new starts.'), difficult: t('Better for routine work than new starts.'), mixed: t('A reflective day more than a day for launches.') }[day.tara.quality];
  return (
    <>
      <Why icon="moon" title={t('Moon in {0}', [t(day.moon.rashi)])}>
        {day.theme.basis === 'lagna' ? t('It sits in your {0}: {1}.', [t(HOUSE_NAMES[day.theme.house - 1]), t(day.theme.topics)]) : t('Counted from your Moon sign, it lights up the {0}: {1}.', [t(HOUSE_NAMES[day.theme.house - 1]), t(day.theme.topics)])}
      </Why>
      <Why icon="star" title={t('Star of the day: {0}', [t(day.tara.name)])}>{t('The "{0}" star for your birth star.', [t(day.tara.meaning)])} {tara}</Why>
      {day.dasha ? (
        <Why icon="clock" title={t('Your period: {0}, with {1}', [t(day.dasha.maha), t(day.dasha.antar)])}>{t('This sub-period runs until {0}.', [formatDate(day.dasha.antarEnd, { month: 'long', year: 'numeric' })])}</Why>
      ) : null}
      {day.saturn.phase ? <Why icon="sun" title={t('Saturn: {0}', [t(day.saturn.phase)])}>{t(day.saturn.note)}</Why> : null}
    </>
  );
}

export default function Today() {
  const { self } = useAccount();
  const [language] = useLanguage();
  const timezone = localZone();
  const date = todayISO(timezone);
  // A day's reading does not change once written, so it is remembered until the date moves on.
  const { data, error } = useRemembered(
    `today:${self.id}:${date}:${language}`,
    () => api('/api/today', { method: 'POST', auth: true, body: { birthProfileId: self.id, language, date, timezone } }),
    { maxAge: (d) => (d.reading.source === 'ai' ? 24 * 3600 * 1000 : 2 * 60 * 1000) },
  );

  const shown = data?.reading.language ?? language;
  const t = useT();
  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <p className="muted">{longDate}</p>
      {error ? <p className="error" role="alert">{t(error)}</p> : null}
      {!data && !error ? <DaySkeleton label={t('Reading today against your chart…')} /> : null}
      {data ? (
        <div className="day">
          <article className="day-main" lang={shown}>
            <div className="day-hero">
              <div className="arch">
                <span className="float"><Icon name="moon" size={40} /></span>
                <span className="tag white">{t(TONES[data.day.tone])}</span>
                <span className="arch-note">{t('Moon in {0}', [t(data.day.moon.rashi)])}</span>
              </div>
              <div>
                <h1>{data.reading.title}</h1>
                <p className="muted">{t('Read from your own chart, {0}.', [self.name])}{' '}<Link to={`/charts/${self.id}`}>{t('Open my chart')}</Link></p>
              </div>
            </div>
            {data.reading.source === 'rules' && shown !== language ? <p className="notice">{t('This reading could not be written in your language just now, so it is shown in English.')}</p> : null}
            <p className="reading-text">{data.reading.text}</p>
            <div className="day-notes">
              {data.reading.goodFor ? <div className="card"><p className="note-label">{t('Good for')}</p><p><strong>{data.reading.goodFor}</strong></p></div> : null}
              {data.reading.takeCare ? <div className="card"><p className="note-label">{t('Go gently with')}</p><p><strong>{data.reading.takeCare}</strong></p></div> : null}
            </div>
          </article>
          <aside className="day-why" aria-labelledby="day-why-title">
            <h2 id="day-why-title">{t('Why today reads this way')}</h2>
            <DayFacts day={data.day} />
            <Link className="btn" to="/ask">{t('Ask about your day')}<Icon name="go" size={20} /></Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}
