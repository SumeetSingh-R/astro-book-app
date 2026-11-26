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

/** System switch, sign picker and today's reading. Used on the home page and the horoscope page. */
export default function HoroscopeReader() {
  const [system, setSystem] = useState(() => remembered('horoscope.system', 'vedic'));
  const [sign, setSign] = useState(() => remembered('horoscope.sign', null));
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
  const reading = readings && sign ? readings.find((r) => r.sign === sign) : null;
  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <p className="lede">{longDate}</p>

      <div className="segmented" role="tablist" aria-label="Astrology system">
        {[['vedic', 'Vedic, by Moon sign'], ['western', 'Western, by Sun sign']].map(([key, name]) => (
          <button key={key} type="button" role="tab" aria-selected={system === key} className={system === key ? 'on' : undefined}
            onClick={() => { setSystem(key); remember('horoscope.system', key); }}>{name}</button>
        ))}
      </div>

      <div className="sign-grid" role="group" aria-label={system === 'vedic' ? 'Choose your Moon sign' : 'Choose your Sun sign'}>
        {names.map((name, i) => (
          <button key={name} type="button" aria-pressed={sign === i + 1} className={sign === i + 1 ? 'on' : undefined}
            onClick={() => { setSign(i + 1); remember('horoscope.sign', i + 1); }}>
            <span className="glyph" aria-hidden="true">{SIGN_GLYPHS[i]}</span>
            <span>{name}</span>
            {system === 'vedic' ? <span className="sub">{SIGNS[i]}</span> : null}
          </button>
        ))}
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {!error && !readings ? <ReadingCardSkeleton label="Loading today's readings…" /> : null}
      {readings && !sign ? <p className="muted">Choose a sign to read today's horoscope. {system === 'vedic' ? 'Not sure of your Moon sign? Draw your chart and it is shown beside the kundli.' : ''}</p> : null}

      {reading ? (
        <article className="reading" aria-live="polite">
          <span className="tone">{TONE_LABELS[reading.content.tone]}</span>
          <h2>{reading.signName}: {reading.content.title}</h2>
          <p className="reading-text">{reading.content.text}</p>
          <dl className="facts">
            <div><dt>In focus</dt><dd>{reading.content.focus.join(', ')}</dd></div>
            <div><dt>Moon today</dt><dd>{reading.content.moon.sign}{reading.content.moon.nakshatra ? `, ${reading.content.moon.nakshatra}` : ''} (house {reading.content.moon.houseFromSign} from your sign)</dd></div>
            {reading.content.highlights.length ? <div><dt>In the sky</dt><dd>{reading.content.highlights.join('; ')}</dd></div> : null}
          </dl>
        </article>
      ) : null}
    </>
  );
}
