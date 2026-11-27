import { useState } from 'react';
import { api } from '../lib/api.js';
import { useRemembered } from '../lib/cache.js';
import { useLanguage, useT, msg } from '../lib/language.jsx';
import { ReadingSkeleton } from './Skeleton.jsx';

const AREA_LABELS = { nature: msg('Nature'), career: msg('Work'), money: msg('Money'), relationships: msg('Marriage'), family: msg('Family'), wellbeing: msg('Wellbeing'), now: msg('Right now') };

/** The chart explained for someone who doesn't read charts: a summary, then one area of life at a time. */
export default function ChartReading({ profileId }) {
  const [language] = useLanguage();
  const [picked, setPicked] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // Written once per chart and language, so it is remembered; a stand-in reading is retried soon.
  const { data: reading, error } = useRemembered(
    `reading:${profileId}:${language}`,
    () => api('/api/reading', { method: 'POST', auth: true, body: { birthProfileId: profileId, language } }).then((d) => d.reading),
    { maxAge: (r) => (r.source === 'ai' ? 30 * 24 * 3600 * 1000 : 2 * 60 * 1000) },
  );

  // Labels follow the language the reading actually came back in.
  const shown = reading?.language ?? language;
  const t = useT();
  const area = reading ? (reading.areas.find((a) => a.key === picked) ?? reading.areas[0]) : null;
  return (
    <section className="plain" aria-labelledby="plain-title" lang={shown}>
      <h2 id="plain-title">{t('In plain words')}</h2>
      {error ? <p className="error" role="alert">{t(error)}</p> : null}
      {!reading && !error ? <><p className="muted" aria-hidden="true">{t('Writing the reading for this chart…')}</p><ReadingSkeleton label={t('Writing the reading for this chart…')} /></> : null}
      {reading ? (
        <>
          {reading.source === 'rules' ? (
            <p className="notice">{shown !== language ? t('This reading could not be written in your language just now, so it is shown in English.') : t('A shorter reading is shown because the full one could not be written just now.')}</p>
          ) : null}
          <p className="reading-text">{reading.summary}</p>
          <div className="pills" role="group" aria-label={t('Area of life')}>
            {reading.areas.map((a) => (
              <button key={a.key} type="button" aria-pressed={a === area} className={a === area ? 'pill on' : 'pill'} onClick={() => { setPicked(a.key); setWhyOpen(false); }}>{t(AREA_LABELS[a.key] ?? a.key)}</button>
            ))}
          </div>
          {area ? (
            <div className="card area" aria-live="polite" key={area.key}>
              <p>{area.text}</p>
              {area.why ? (
                <>
                  <button type="button" className="link" aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}>{whyOpen ? t('Hide the reason') : t('Why we say this')}</button>
                  {whyOpen ? <p className="why msg">{area.why}</p> : null}
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
