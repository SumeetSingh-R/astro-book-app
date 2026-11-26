import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useLanguage, wordsFor } from '../lib/language.jsx';
import { ReadingSkeleton } from './Skeleton.jsx';

/** The chart explained for someone who doesn't read charts: a summary, then one area of life at a time. */
export default function ChartReading({ profileId }) {
  const [language] = useLanguage();
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setReading(null);
    setError(null);
    api('/api/reading', { method: 'POST', auth: true, body: { birthProfileId: profileId, language } })
      .then((d) => { if (live) setReading(d.reading); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [profileId, language]);

  // Labels follow the language the reading actually came back in.
  const shown = reading?.language ?? language;
  const w = wordsFor(shown);
  const area = reading ? (reading.areas.find((a) => a.key === picked) ?? reading.areas[0]) : null;
  return (
    <section className="plain" aria-labelledby="plain-title" lang={shown}>
      <h2 id="plain-title">{w.plainWords}</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!reading && !error ? <><p className="muted" aria-hidden="true">{w.writing}</p><ReadingSkeleton label={w.writing} /></> : null}
      {reading ? (
        <>
          {reading.source === 'rules' ? (
            <p className="notice">{language === 'hi' ? wordsFor('en').hindiUnavailable : w.shortReading}</p>
          ) : null}
          <p className="reading-text">{reading.summary}</p>
          <div className="pills" role="group" aria-label={w.areas}>
            {reading.areas.map((a) => (
              <button key={a.key} type="button" aria-pressed={a === area} className={a === area ? 'pill on' : 'pill'} onClick={() => { setPicked(a.key); setWhyOpen(false); }}>{w[a.key] ?? a.key}</button>
            ))}
          </div>
          {area ? (
            <div className="card area" aria-live="polite" key={area.key}>
              <p>{area.text}</p>
              {area.why ? (
                <>
                  <button type="button" className="link" aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}>{whyOpen ? w.hideWhy : w.why}</button>
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
