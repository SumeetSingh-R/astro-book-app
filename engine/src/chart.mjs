// Astro Booklet calculation engine: birth details in, Western and Vedic chart data out.
import SwissEph from 'swisseph-wasm';
import { localToUtc, julianDay } from './time.mjs';
import { ENGINE_VERSION, SIGNS, ASPECTS } from './constants.mjs';
import { norm360, nakshatraOf, navamsaSignIndex, rashiOf, vimshottari } from './vedic.mjs';
import { RASHIS } from './constants.mjs';

let swePromise = null;
/** One shared Swiss Ephemeris instance per process. */
export function getSwe() {
  if (!swePromise) {
    swePromise = (async () => {
      const swe = new SwissEph();
      await swe.initSwissEph();
      return swe;
    })();
  }
  return swePromise;
}

function validate(input) {
  const { date, latitude, longitude, timezone } = input;
  if (typeof date !== 'string') throw new Error('date is required (YYYY-MM-DD)');
  if (typeof timezone !== 'string' || !timezone) throw new Error('timezone is required (IANA name)');
  if (!(latitude >= -90 && latitude <= 90)) throw new Error('latitude must be between -90 and 90');
  if (!(longitude >= -180 && longitude <= 180)) throw new Error('longitude must be between -180 and 180');
}

function signOf(lon) {
  const l = norm360(lon);
  const index = Math.min(11, Math.floor(l / 30));
  return { index: index + 1, name: SIGNS[index], degree: l - index * 30 };
}

/** House number (1-12) for a longitude given 12 cusp longitudes (cusps[1..12]). */
function houseFromCusps(lon, cusps) {
  for (let h = 1; h <= 12; h++) {
    const start = cusps[h];
    const end = cusps[h === 12 ? 1 : h + 1];
    const span = norm360(end - start);
    if (norm360(lon - start) < span) return h;
  }
  return 12;
}

function angularSeparation(a, b) {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Compute a birth chart.
 * @param {object} input
 * @param {string} input.date       'YYYY-MM-DD' (local date of birth)
 * @param {string|null} input.time  'HH:MM' local time, or null/undefined if unknown
 * @param {string} input.timezone   IANA timezone of the birth place
 * @param {number} input.latitude   degrees, north positive
 * @param {number} input.longitude  degrees, east positive
 * @param {object} [options]
 * @param {'P'|'W'|'K'|'E'} [options.houseSystem='P'] Western house system (Placidus default)
 * @param {'mean'|'true'} [options.node='mean'] lunar node used for Rahu/Ketu (Vedic)
 */
export async function computeChart(input, options = {}) {
  validate(input);
  const swe = await getSwe();
  const timeKnown = typeof input.time === 'string' && input.time.length > 0;
  const { utcMs, offsetMinutes } = localToUtc(input.date, timeKnown ? input.time : '12:00', input.timezone);
  const jd = julianDay(utcMs);
  const houseSystem = options.houseSystem ?? 'P';
  const nodeChoice = options.node ?? 'mean';

  const base = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

  // ---------- Western (tropical) ----------
  const westernBodies = [
    ['Sun', swe.SE_SUN], ['Moon', swe.SE_MOON], ['Mercury', swe.SE_MERCURY], ['Venus', swe.SE_VENUS],
    ['Mars', swe.SE_MARS], ['Jupiter', swe.SE_JUPITER], ['Saturn', swe.SE_SATURN],
    ['Uranus', swe.SE_URANUS], ['Neptune', swe.SE_NEPTUNE], ['Pluto', swe.SE_PLUTO],
    ['North Node', swe.SE_TRUE_NODE],
  ];

  let wHouses = null;
  if (timeKnown) {
    const h = swe.houses(jd, input.latitude, input.longitude, houseSystem);
    const cusps = [];
    for (let i = 1; i <= 12; i++) cusps[i] = h.cusps[i];
    wHouses = { cusps, ascendant: h.ascmc[0], midheaven: h.ascmc[1] };
  }

  const wPlanets = westernBodies.map(([name, id]) => {
    const r = swe.calc_ut(jd, id, base);
    const lon = norm360(r[0]);
    const s = signOf(lon);
    return {
      name, longitude: lon, sign: s.name, signIndex: s.index, degreeInSign: s.degree,
      retrograde: name === 'North Node' ? false : r[3] < 0,
      speed: r[3],
      house: wHouses ? houseFromCusps(lon, wHouses.cusps) : null,
    };
  });

  const aspects = [];
  for (let i = 0; i < wPlanets.length; i++) {
    for (let j = i + 1; j < wPlanets.length; j++) {
      const sep = angularSeparation(wPlanets[i].longitude, wPlanets[j].longitude);
      for (const a of ASPECTS) {
        const orb = Math.abs(sep - a.angle);
        if (orb <= a.orb) {
          aspects.push({ a: wPlanets[i].name, b: wPlanets[j].name, type: a.name, angle: a.angle, orb });
          break;
        }
      }
    }
  }

  const western = {
    zodiac: 'tropical',
    houseSystem: timeKnown ? houseSystem : null,
    ascendant: wHouses ? { longitude: wHouses.ascendant, ...pick(signOf(wHouses.ascendant)) } : null,
    midheaven: wHouses ? { longitude: wHouses.midheaven, ...pick(signOf(wHouses.midheaven)) } : null,
    houses: wHouses ? wHouses.cusps.slice(1).map((c, i) => ({ house: i + 1, cusp: c, sign: signOf(c).name })) : null,
    planets: wPlanets,
    aspects,
  };

  // ---------- Vedic (sidereal, Lahiri, whole-sign houses) ----------
  swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
  const sid = base | swe.SEFLG_SIDEREAL;
  const ayanamsa = swe.get_ayanamsa_ut(jd);

  let lagna = null;
  if (timeKnown) {
    const h = swe.houses_ex(jd, swe.SEFLG_SIDEREAL, input.latitude, input.longitude, 'W');
    const lon = norm360(h.ascmc[0]);
    const r = rashiOf(lon);
    const n = nakshatraOf(lon);
    lagna = { longitude: lon, rashi: r.name, rashiIndex: r.index, degreeInRashi: r.degree, nakshatra: n.name, pada: n.pada };
  }

  const vedicBodies = [
    ['Sun', swe.SE_SUN], ['Moon', swe.SE_MOON], ['Mars', swe.SE_MARS], ['Mercury', swe.SE_MERCURY],
    ['Jupiter', swe.SE_JUPITER], ['Venus', swe.SE_VENUS], ['Saturn', swe.SE_SATURN],
    ['Rahu', nodeChoice === 'true' ? swe.SE_TRUE_NODE : swe.SE_MEAN_NODE],
  ];

  const vRaw = vedicBodies.map(([name, id]) => {
    const r = swe.calc_ut(jd, id, sid);
    return { name, longitude: norm360(r[0]), speed: r[3] };
  });
  const rahu = vRaw.find((p) => p.name === 'Rahu');
  vRaw.push({ name: 'Ketu', longitude: norm360(rahu.longitude + 180), speed: rahu.speed });

  const vPlanets = vRaw.map((p) => {
    const r = rashiOf(p.longitude);
    const n = nakshatraOf(p.longitude);
    const isNode = p.name === 'Rahu' || p.name === 'Ketu';
    return {
      name: p.name, longitude: p.longitude,
      rashi: r.name, rashiIndex: r.index, degreeInRashi: r.degree,
      nakshatra: n.name, nakshatraIndex: n.index, pada: n.pada, nakshatraLord: n.lord,
      navamsaRashi: RASHIS[navamsaSignIndex(p.longitude)],
      retrograde: isNode ? true : (p.name === 'Sun' || p.name === 'Moon' ? false : p.speed < 0),
      house: lagna ? ((r.index - lagna.rashiIndex + 12) % 12) + 1 : null,
    };
  });

  const moon = vPlanets.find((p) => p.name === 'Moon');
  const vedic = {
    zodiac: 'sidereal',
    ayanamsa: { name: 'Lahiri', value: ayanamsa },
    houseSystem: 'whole-sign',
    node: nodeChoice,
    lagna,
    moonSign: moon.rashi,
    planets: vPlanets,
    dasha: vimshottari(moon.longitude, utcMs),
  };

  return {
    engineVersion: ENGINE_VERSION,
    input: {
      date: input.date, time: timeKnown ? input.time : null, timezone: input.timezone,
      latitude: input.latitude, longitude: input.longitude,
    },
    timeKnown,
    notes: timeKnown ? [] : [
      'Birth time unknown: calculated for 12:00 local time. Ascendant, houses and lagna are omitted; the Moon position and dasha dates are approximate.',
    ],
    utc: new Date(utcMs).toISOString(),
    utcOffsetMinutes: offsetMinutes,
    julianDay: jd,
    western,
    vedic,
  };
}

function pick(s) {
  return { sign: s.name, signIndex: s.index, degreeInSign: s.degree };
}
