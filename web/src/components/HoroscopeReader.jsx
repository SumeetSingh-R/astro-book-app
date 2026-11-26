import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { SIGNS, RASHIS, SIGN_GLYPHS, todayISO } from '../lib/format.js';
import { ReadingCardSkeleton } from './Skeleton.jsx';

const TONE_LABELS = { supportive: 'A supportive day', demanding: 'A demanding day', steady: 'A steady day' };

function remembered(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function remember(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** The general reading for a sign: system switch, the twelve signs, and today's reading. */
export default function HoroscopeReader() {
  const [system, setSystem] = useState(() => remembered('horoscope.system', 'vedic'));
  const [sign, setSign] = useState(() => remembered('horoscope.sign', 1));
  const [readings, setReadings] = useState(null);
  const [error, setError] = useState(null);
  const date = todayISO();

  useEffect(() => {
    let live = true;
    setReadings(null);
    setError(null);
    api(`/api/horoscope?system=${system}&date=${date}`)
      .then((d) => { if (live) setReadings(d.readings); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [system, date]);

  const names = system === 'vedic' ? RASHIS : SIGNS;
  const reading = readings ? readings.find((r) => r.sign === sign) : null;

  return (
    <>
      <div className="pills" role="group" aria-label="Astrology system">
        {[['vedic', 'Vedic, by Moon sign'], ['western', 'Western, by Sun sign']].map(([key, name]) => (
          <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'pill on' : 'pill'}
            onClick={() => { setSystem(key); remember('horoscope.system', key); }}>{name}</button>
        ))}
      </div>

      <div className="sign-grid" role="group" aria-label={system === 'vedic' ? 'Choose your Moon sign' : 'Choose your Sun sign'}>
        {names.map((name, i) => (
          <button key={name} type="button" aria-pressed={sign === i + 1} className={sign === i + 1 ? 'on' : undefined}
            onClick={() => { setSign(i + 1); remember('horoscope.sign', i + 1); }}>
            <span className="glyph" aria-hidden="true">{SIGN_GLYPHS[i]}</span>
            <span>{name}</span>
          </button>
        ))}
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {!error && !readings ? <ReadingCardSkeleton label="Loading today's readings…" /> : null}

      {reading ? (
        <article className="card sign-reading msg" aria-live="polite" key={`${system}-${sign}`}>
          <span className="arch-badge glyph" aria-hidden="true">{SIGN_GLYPHS[sign - 1]}</span>
          <div>
            <span className="tag plain">{TONE_LABELS[reading.content.tone]}</span>
            <h3>{reading.signName}: {reading.content.title}</h3>
            <p>{reading.content.text}</p>
            <p className="hint">Moon today in {reading.content.moon.sign}{reading.content.moon.nakshatra ? `, ${reading.content.moon.nakshatra}` : ''}.</p>
          </div>
        </article>
      ) : null}
    </>
  );
}
