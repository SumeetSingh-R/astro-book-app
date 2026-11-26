// A day read against one person's birth chart (not just their sign).
// Classical day-quality tests from the birth Moon, plus where the slow planets are for them:
//   - Chandra bala: the house today's Moon occupies counted from the birth Moon sign.
//   - Tara bala: today's nakshatra counted from the birth nakshatra, in the nine-star cycle.
//   - The house today's Moon lights up from the lagna, which sets the day's theme.
//   - Saturn's and Jupiter's current houses from the birth Moon (Sade Sati and the like).
//   - The dasha period the person is in.
import { getSwe } from './chart.mjs';
import { julianDay } from './time.mjs';
import { dailyTransits } from './horoscope.mjs';
import { RASHIS, NAKSHATRAS, ENGINE_VERSION } from './constants.mjs';
import { norm360, nakshatraOf } from './vedic.mjs';
import { dashaAt, houseOfRashi, HOUSE_TOPICS } from './facts.mjs';
import { HOUSE_THEMES, TONE_LINES, MERCURY_RETROGRADE_LINE } from './horoscopeText.mjs';

export const TARAS = [
  { name: 'Janma', meaning: 'birth star', quality: 'mixed' },
  { name: 'Sampat', meaning: 'wealth', quality: 'good' },
  { name: 'Vipat', meaning: 'obstacles', quality: 'difficult' },
  { name: 'Kshema', meaning: 'wellbeing', quality: 'good' },
  { name: 'Pratyari', meaning: 'opposition', quality: 'difficult' },
  { name: 'Sadhaka', meaning: 'achievement', quality: 'good' },
  { name: 'Vadha', meaning: 'strain', quality: 'difficult' },
  { name: 'Mitra', meaning: 'friend', quality: 'good' },
  { name: 'Parama Mitra', meaning: 'best friend', quality: 'good' },
];

const CHANDRA_GOOD = [1, 3, 6, 7, 10, 11];
const JUPITER_GOOD = [2, 5, 7, 9, 11];
const WEEKDAY_LORDS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

const TARA_LINES = {
  good: 'Today\'s star is a friendly one for your birth star, so plans you start now tend to go with the grain.',
  difficult: 'Today\'s star sits awkwardly with your birth star, so keep important starts for another day and stick to routine work.',
  mixed: 'The Moon is back in your own birth star, which makes the day feel personal: good for reflection, less so for big launches.',
};

/** Tara bala: position of the day's nakshatra in the nine-star cycle counted from the birth nakshatra. */
export function taraBala(birthNakshatraIndex, dayNakshatraIndex) {
  const count = ((dayNakshatraIndex - birthNakshatraIndex + 27) % 27) + 1;
  const tara = TARAS[(count - 1) % 9];
  return { count, ...tara };
}

function saturnNote(houseFromMoon) {
  if (houseFromMoon === 12) return { phase: 'Sade Sati, first phase', note: 'Saturn is in the sign before your Moon sign: the first third of Sade Sati, the seven-and-a-half-year Saturn passage.' };
  if (houseFromMoon === 1) return { phase: 'Sade Sati, middle phase', note: 'Saturn is crossing your Moon sign: the middle of Sade Sati, a period that asks for patience and steady effort.' };
  if (houseFromMoon === 2) return { phase: 'Sade Sati, last phase', note: 'Saturn is in the sign after your Moon sign: the closing third of Sade Sati.' };
  if (houseFromMoon === 4) return { phase: 'Saturn in the 4th from the Moon', note: 'Saturn is in the 4th from your Moon (a "dhaiya"), which puts weight on home and peace of mind.' };
  if (houseFromMoon === 8) return { phase: 'Saturn in the 8th from the Moon', note: 'Saturn is in the 8th from your Moon (a "dhaiya"), a slower stretch that rewards caution.' };
  return null;
}

/**
 * @param {object} chart  a chart from computeChart()
 * @param {string} date   'YYYY-MM-DD'
 * @param {object} [opts] { timezone = 'Asia/Kolkata' }
 */
export async function personalDay(chart, date, opts = {}) {
  const transits = await dailyTransits(date, { timezone: opts.timezone ?? 'Asia/Kolkata' });
  const atMs = Date.parse(transits.utc);
  const v = chart.vedic;
  const natalMoon = v.planets.find((p) => p.name === 'Moon');

  const rashiOfLon = (lon) => Math.min(11, Math.floor(norm360(lon) / 30)) + 1;
  const moonLon = transits.planets.Moon.sidereal;
  const moonRashi = rashiOfLon(moonLon);
  const moonNak = nakshatraOf(moonLon);

  const houseFromMoon = houseOfRashi(natalMoon.rashiIndex, moonRashi);
  const houseFromLagna = v.lagna ? houseOfRashi(v.lagna.rashiIndex, moonRashi) : null;
  const themeHouse = houseFromLagna ?? houseFromMoon;
  const tara = taraBala(natalMoon.nakshatraIndex, moonNak.index);
  const chandraGood = CHANDRA_GOOD.includes(houseFromMoon);

  const saturnHouse = houseOfRashi(natalMoon.rashiIndex, rashiOfLon(transits.planets.Saturn.sidereal));
  const jupiterHouse = houseOfRashi(natalMoon.rashiIndex, rashiOfLon(transits.planets.Jupiter.sidereal));

  // Rahu is not part of dailyTransits; it is only needed here.
  const swe = await getSwe();
  swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
  const rahuLon = norm360(swe.calc_ut(julianDay(atMs), swe.SE_MEAN_NODE, swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL)[0]);

  const dasha = dashaAt(v.dasha, atMs);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayLord = WEEKDAY_LORDS[weekday];

  let score = 0;
  score += tara.quality === 'good' ? 1 : tara.quality === 'difficult' ? -1 : 0;
  score += chandraGood ? 1 : -1;
  score += transits.tone === 'supportive' ? 1 : transits.tone === 'demanding' ? -1 : 0;
  const tone = score >= 2 ? 'supportive' : score <= -2 ? 'demanding' : 'steady';

  const theme = HOUSE_THEMES[themeHouse];
  const n = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const pick = (list) => list[(n + natalMoon.nakshatraIndex) % list.length];
  // The stock house lines open with "the Moon is in your sign"; for a personal reading the theme is
  // usually set from the lagna, so use the lines that don't make that claim when the two differ.
  const bodies = themeHouse === 1 && houseFromMoon !== 1 ? theme.body.slice(2) : theme.body;
  const parts = [pick(bodies), TARA_LINES[tara.quality], pick(TONE_LINES[tone])];
  if (transits.planets.Mercury.retrograde) parts.push(MERCURY_RETROGRADE_LINE);

  const saturn = saturnNote(saturnHouse);
  return {
    date,
    engineVersion: ENGINE_VERSION,
    timeKnown: chart.timeKnown,
    tone,
    moon: {
      rashi: RASHIS[moonRashi - 1],
      nakshatra: NAKSHATRAS[moonNak.index - 1],
      houseFromMoon,
      houseFromLagna,
      chandraBala: chandraGood ? 'favourable' : 'weak',
    },
    tara,
    theme: { house: themeHouse, basis: houseFromLagna ? 'lagna' : 'moon', topics: HOUSE_TOPICS[themeHouse - 1], title: theme.title, focus: theme.focus },
    dayLord,
    dayLordIsDashaLord: dasha ? dayLord === dasha.maha || dayLord === dasha.antar : false,
    dasha,
    saturn: { houseFromMoon: saturnHouse, ...(saturn ?? { phase: null, note: null }) },
    jupiter: { houseFromMoon: jupiterHouse, favourable: JUPITER_GOOD.includes(jupiterHouse) },
    rahu: { houseFromMoon: houseOfRashi(natalMoon.rashiIndex, rashiOfLon(rahuLon)) },
    sky: { tone: transits.tone, highlights: transits.highlights, mercuryRetrograde: transits.planets.Mercury.retrograde },
    // A plain reading built from fixed lines. Used when the AI model is not available.
    ruleReading: { title: theme.title, text: parts.join(' '), goodFor: theme.focus.join(', '), takeCare: null },
  };
}

/** The day's facts as compact text for an AI prompt. */
export function dayToText(d) {
  const lines = [];
  const month = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  lines.push(`Date: ${d.date} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${d.date}T12:00:00Z`).getUTCDay()]}, ruled by ${d.dayLord}).`);
  lines.push(`Today's Moon: ${d.moon.rashi}, nakshatra ${d.moon.nakshatra}.`);
  lines.push(`Moon's house from the birth Moon: ${d.moon.houseFromMoon} (chandra bala ${d.moon.chandraBala}).`);
  if (d.moon.houseFromLagna) lines.push(`Moon's house from the lagna: ${d.moon.houseFromLagna}, the house of ${d.theme.topics}. This sets the theme of the day.`);
  else lines.push(`Birth time unknown: the day's theme is taken from the Moon's house from the birth Moon, the house of ${d.theme.topics}.`);
  lines.push(`Tara bala: ${d.tara.name} tara ("${d.tara.meaning}"), ${d.tara.quality === 'good' ? 'favourable' : d.tara.quality === 'difficult' ? 'unfavourable' : 'mixed'} for new starts.`);
  lines.push(`Overall tone of the day by these tests: ${d.tone}.`);
  if (d.dasha) lines.push(`Current period: ${d.dasha.maha} mahadasha, ${d.dasha.antar} antardasha (until ${month(d.dasha.antarEnd)}).${d.dayLordIsDashaLord ? ` Today's weekday lord, ${d.dayLord}, is one of these period lords.` : ''}`);
  if (d.saturn.note) lines.push(d.saturn.note);
  lines.push(`Jupiter is in house ${d.jupiter.houseFromMoon} from the birth Moon (${d.jupiter.favourable ? 'a helpful placement' : 'a neutral to testing placement'}).`);
  if (d.sky.highlights.length) lines.push(`In the sky today: ${d.sky.highlights.join('; ')}.`);
  return lines.join('\n');
}
