import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useLanguage, wordsFor } from '../lib/language.jsx';

/** The chart explained for someone who doesn't read charts: a summary, then one note per area of life. */
export default function ChartReading({ profileId }) {
  const [language] = useLanguage();
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);

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
  const w = wordsFor(reading?.language ?? language);
  return (
    <section className="plain" aria-labelledby="plain-title" lang={reading?.language ?? language}>
      <h2 id="plain-title">{w.plainWords}</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!reading && !error ? <p className="muted" aria-live="polite">{w.writing}</p> : null}
      {reading ? (
        <>
          {reading.source === 'rules' ? (
            <p className="notice">{language === 'hi' ? wordsFor('en').hindiUnavailable : w.shortReading}</p>
          ) : null}
          <p className="reading-text">{reading.summary}</p>
          <div className="areas">
            {reading.areas.map((a) => (
              <article key={a.key}>
                <h3>{w[a.key] ?? a.key}</h3>
                <p>{a.text}</p>
                {a.why ? (
                  <details>
                    <summary>{w.why}</summary>
                    <p>{a.why}</p>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
