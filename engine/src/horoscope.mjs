// Daily horoscopes for both systems.
//  - Western: read by Sun sign, tropical zodiac.
//  - Vedic:   read by Moon sign (rashi), sidereal Lahiri zodiac.
// The reading is driven by the house the transiting Moon occupies from the sign, with a tone
// adjustment from the Moon's aspects to Jupiter, Venus, Saturn and Mars, and a Mercury retrograde note.
import { getSwe } from './chart.mjs';
import { localToUtc, julianDay } from './time.mjs';
import { ENGINE_VERSION, SIGNS, RASHIS } from './constants.mjs';
import { norm360, nakshatraOf } from './vedic.mjs';
import { HOUSE_THEMES, TONE_LINES, MERCURY_RETROGRADE_LINE } from './horoscopeText.mjs';

const sep = (a, b) => { const d = Math.abs(norm360(a) - norm360(b)); return d > 180 ? 360 - d : d; };
const near = (angle, target, orb = 6) => Math.abs(angle - target) <= orb;

/**
 * Planet positions for a calendar day.
 * @param {string} date 'YYYY-MM-DD'
 * @param {object} [opts]
 * @param {string} [opts.timezone='Asia/Kolkata'] the day is evaluated at opts.time in this zone
 * @param {string} [opts.time='06:00'] roughly sunrise, when the traditional day begins
 */
export async function dailyTransits(date, opts = {}) {
  const timezone = opts.timezone ?? 'Asia/Kolkata';
  const time = opts.time ?? '06:00';
  const swe = await getSwe();
  const { utcMs } = localToUtc(date, time, timezone);
  const jd = julianDay(utcMs);
  swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
  const ayanamsa = swe.get_ayanamsa_ut(jd);
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

  const bodies = [
    ['Sun', swe.SE_SUN], ['Moon', swe.SE_MOON], ['Mercury', swe.SE_MERCURY], ['Venus', swe.SE_VENUS],
    ['Mars', swe.SE_MARS], ['Jupiter', swe.SE_JUPITER], ['Saturn', swe.SE_SATURN],
  ];
  const planets = {};
  for (const [name, id] of bodies) {
    const r = swe.calc_ut(jd, id, flags);
    const tropical = norm360(r[0]);
    planets[name] = {
      tropical,
      sidereal: norm360(tropical - ayanamsa),
      retrograde: name !== 'Sun' && name !== 'Moon' && r[3] < 0,
    };
  }

  // Tone from the Moon's aspects (the angle is the same in either zodiac).
  const moon = planets.Moon.tropical;
  const highlights = [];
  let score = 0;
  for (const benefic of ['Jupiter', 'Venus']) {
    const a = sep(moon, planets[benefic].tropical);
    if (near(a, 0) || near(a, 60, 4) || near(a, 120)) { score += 1; highlights.push(`Moon in a supportive aspect to ${benefic}`); }
  }
  for (const malefic of ['Saturn', 'Mars']) {
    const a = sep(moon, planets[malefic].tropical);
    if (near(a, 0) || near(a, 90) || near(a, 180)) { score -= 1; highlights.push(`Moon in a tense aspect to ${malefic}`); }
  }
  if (planets.Mercury.retrograde) highlights.push('Mercury retrograde');
  const tone = score > 0 ? 'supportive' : score < 0 ? 'demanding' : 'steady';

  return { date, timezone, time, utc: new Date(utcMs).toISOString(), ayanamsa, planets, tone, highlights };
}

function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function buildReading(system, sign, transits) {
  const zodiac = system === 'vedic' ? 'sidereal' : 'tropical';
  const moonLon = transits.planets.Moon[zodiac];
  const moonSign = Math.min(11, Math.floor(moonLon / 30)) + 1;
  const house = ((moonSign - sign + 12) % 12) + 1;
  const theme = HOUSE_THEMES[house];
  const n = dayNumber(transits.date);
  const names = system === 'vedic' ? RASHIS : SIGNS;

  const parts = [
    theme.body[(n + sign) % theme.body.length],
    TONE_LINES[transits.tone][(n + sign) % TONE_LINES[transits.tone].length],
  ];
  if (transits.planets.Mercury.retrograde) parts.push(MERCURY_RETROGRADE_LINE);

  return {
    system,
    sign,
    signName: names[sign - 1],
    date: transits.date,
    engineVersion: ENGINE_VERSION,
    content: {
      title: theme.title,
      text: parts.join(' '),
      focus: theme.focus,
      tone: transits.tone,
      moon: {
        sign: names[moonSign - 1],
        houseFromSign: house,
        ...(system === 'vedic' ? { nakshatra: nakshatraOf(moonLon).name } : {}),
      },
      highlights: transits.highlights,
    },
  };
}

/** One sign's reading. `system` is 'vedic' or 'western'; `sign` is 1-12 (Aries/Mesha = 1). */
export async function dailyHoroscope(date, system, sign, opts = {}) {
  if (system !== 'vedic' && system !== 'western') throw new Error("system must be 'vedic' or 'western'");
  if (!Number.isInteger(sign) || sign < 1 || sign > 12) throw new Error('sign must be an integer 1-12');
  return buildReading(system, sign, await dailyTransits(date, opts));
}

/** All 24 readings for a day (12 signs x 2 systems), ready to store in daily_horoscopes. */
export async function dailyHoroscopesAll(date, opts = {}) {
  const transits = await dailyTransits(date, opts);
  const out = [];
  for (const system of ['vedic', 'western']) {
    for (let sign = 1; sign <= 12; sign++) out.push(buildReading(system, sign, transits));
  }
  return out;
}
