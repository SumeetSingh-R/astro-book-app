import { useState } from 'react';
import { api } from '../lib/api.js';
import { useRemembered } from '../lib/cache.js';
import { SIGNS, RASHIS, SIGN_GLYPHS, todayISO } from '../lib/format.js';
import { ReadingCardSkeleton } from './Skeleton.jsx';
import { useT, useLanguage, msg } from '../lib/language.jsx';
import { isEnglishBased } from '../../../config/languages.mjs';

const TONE_LABELS = { supportive: msg('A supportive day'), demanding: msg('A demanding day'), steady: msg('A steady day') };

function remembered(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function remember(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** The general reading for a sign: system switch, the twelve signs, and today's reading. */
export default function HoroscopeReader() {
  const t = useT();
  const [language] = useLanguage();
  const [system, setSystem] = useState(() => remembered('horoscope.system', 'vedic'));
  const [sign, setSign] = useState(() => remembered('horoscope.sign', 1));
  const date = todayISO();
  const { data: readings, error } = useRemembered(
    `horoscope:${system}:${date}:${language}`,
    () => api(`/api/horoscope?system=${system}&date=${date}${isEnglishBased(language) ? '' : `&lang=${language}`}`).then((d) => d.readings),
    { maxAge: 12 * 3600 * 1000 },
  );

  const names = system === 'vedic' ? RASHIS : SIGNS;
  const reading = readings ? readings.find((r) => r.sign === sign) : null;

  return (
    <>
      <div className="pills" role="group" aria-label={t('Astrology system')}>
        {[['vedic', t('Vedic, by Moon sign')], ['western', t('Western, by Sun sign')]].map(([key, name]) => (
          <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'pill on' : 'pill'}
            onClick={() => { setSystem(key); remember('horoscope.system', key); }}>{name}</button>
        ))}
      </div>

      <div className="sign-grid" role="group" aria-label={system === 'vedic' ? t('Choose your Moon sign') : t('Choose your Sun sign')}>
        {names.map((name, i) => (
          <button key={name} type="button" aria-pressed={sign === i + 1} className={sign === i + 1 ? 'on' : undefined}
            onClick={() => { setSign(i + 1); remember('horoscope.sign', i + 1); }}>
            <span className="glyph" aria-hidden="true">{SIGN_GLYPHS[i]}</span>
            <span>{t(name)}</span>
          </button>
        ))}
      </div>

      {error ? <p className="error" role="alert">{t(error)}</p> : null}
      {!error && !readings ? <ReadingCardSkeleton label={t('Loading today\'s readings…')} /> : null}

      {reading ? (
        <article className="card sign-reading msg" aria-live="polite" key={`${system}-${sign}`}>
          <span className="arch-badge glyph" aria-hidden="true">{SIGN_GLYPHS[sign - 1]}</span>
          <div>
            <span className="tag plain">{t(TONE_LABELS[reading.content.tone])}</span>
            <h3>{t(reading.signName)}: {reading.content.title}</h3>
            <p>{reading.content.text}</p>
            <p className="hint">{t('Moon today in {0}', [t(reading.content.moon.sign)])}{reading.content.moon.nakshatra ? `, ${t(reading.content.moon.nakshatra)}` : ''}.</p>
          </div>
        </article>
      ) : null}
    </>
  );
}
