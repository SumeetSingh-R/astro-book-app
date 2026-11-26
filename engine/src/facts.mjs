// Chart facts: the birth chart restated as the plain statements an astrologer reads from it
// (house lords, occupants, aspects, dignity, current period). Everything the reading and the
// "Ask your chart" answers say is drawn from this, so nothing has to be worked out by the AI model.
import { RASHIS, SIGNS } from './constants.mjs';
import { RASHI_LORD } from './matchTables.mjs';
import { manglik } from './match.mjs';

export const GRAHAS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

// Rashi numbers (1 = Mesha) where each graha is exalted; debilitation is the opposite rashi.
const EXALTED_IN = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };

// Graha drishti: every graha looks at the 7th house from itself; three have extra aspects.
const EXTRA_ASPECTS = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10] };

export const HOUSE_TOPICS = [
  'self, body and temperament',
  'money, speech and family',
  'courage, effort and siblings',
  'home, mother, property and peace of mind',
  'children, creativity and learning',
  'daily work, health, debts and rivals',
  'marriage and partnerships',
  'longevity, sudden change and shared money',
  'fortune, faith, father and long journeys',
  'career and reputation',
  'gains, income and friends',
  'expenses, rest, solitude and foreign places',
];

export const lordOfRashi = (rashiIndex) => RASHI_LORD[rashiIndex - 1];

/** The rashi number (1-12) that is `house` houses away from `fromRashi`, counting inclusively. */
export const rashiAtHouse = (fromRashi, house) => ((fromRashi - 1 + house - 1) % 12) + 1;
/** The house (1-12) a rashi falls in when counted from `fromRashi`. */
export const houseOfRashi = (fromRashi, rashi) => ((rashi - fromRashi + 12) % 12) + 1;

/** Houses (counted from the graha's own house, inclusive) that a graha aspects. */
export function aspectOffsets(name) {
  return [7, ...(EXTRA_ASPECTS[name] ?? [])];
}

/** Does a graha sitting in `fromRashi` occupy or aspect `targetRashi`? */
export function influences(name, fromRashi, targetRashi) {
  if (fromRashi === targetRashi) return 'occupies';
  const distance = houseOfRashi(fromRashi, targetRashi);
  return aspectOffsets(name).includes(distance) ? 'aspects' : null;
}

export function dignityOf(name, rashiIndex) {
  const exalted = EXALTED_IN[name];
  if (!exalted) return null;
  if (rashiIndex === exalted) return 'exalted';
  if (rashiIndex === rashiAtHouse(exalted, 7)) return 'debilitated';
  if (lordOfRashi(rashiIndex) === name) return 'own sign';
  return null;
}

/** The mahadasha and antardasha running at a moment, with the periods either side. */
export function dashaAt(dasha, atMs) {
  for (const m of dasha.mahadashas) {
    if (Date.parse(m.start) <= atMs && atMs < Date.parse(m.end)) {
      const a = m.antardashas.find((x) => Date.parse(x.start) <= atMs && atMs < Date.parse(x.end)) ?? m.antardashas[0];
      return { maha: m.lord, mahaStart: m.start, mahaEnd: m.end, antar: a.lord, antarStart: a.start, antarEnd: a.end };
    }
  }
  return null;
}

/** Antardasha periods that overlap [fromMs, toMs], oldest first. */
export function dashaPeriods(dasha, fromMs, toMs) {
  const out = [];
  for (const m of dasha.mahadashas) {
    for (const a of m.antardashas) {
      const s = Date.parse(a.start);
      const e = Date.parse(a.end);
      if (e > fromMs && s < toMs) out.push({ maha: m.lord, antar: a.lord, start: a.start, end: a.end });
    }
  }
  return out;
}

/**
 * Restate a chart from computeChart() as facts.
 * When the birth time is unknown there is no lagna, so houses are counted from the Moon
 * (the Moon chart) and `houseBasis` says so.
 */
export function chartFacts(chart, nowMs = Date.now()) {
  const v = chart.vedic;
  const moon = v.planets.find((p) => p.name === 'Moon');
  const baseRashi = v.lagna ? v.lagna.rashiIndex : moon.rashiIndex;
  const houseBasis = v.lagna ? 'lagna' : 'moon';

  const planets = v.planets.map((p) => {
    const house = houseOfRashi(baseRashi, p.rashiIndex);
    const rules = [];
    for (let h = 1; h <= 12; h++) if (lordOfRashi(rashiAtHouse(baseRashi, h)) === p.name) rules.push(h);
    const navamsaRashiIndex = RASHIS.indexOf(p.navamsaRashi) + 1;
    return {
      name: p.name,
      rashi: p.rashi,
      sign: SIGNS[p.rashiIndex - 1],
      rashiIndex: p.rashiIndex,
      house,
      houseFromMoon: houseOfRashi(moon.rashiIndex, p.rashiIndex),
      nakshatra: p.nakshatra,
      pada: p.pada,
      dignity: dignityOf(p.name, p.rashiIndex),
      retrograde: p.name !== 'Rahu' && p.name !== 'Ketu' && p.retrograde,
      rulesHouses: rules,
      navamsaRashi: p.navamsaRashi,
      navamsaDignity: dignityOf(p.name, navamsaRashiIndex),
      vargottama: navamsaRashiIndex === p.rashiIndex,
    };
  });

  const houses = [];
  for (let h = 1; h <= 12; h++) {
    const rashi = rashiAtHouse(baseRashi, h);
    const lord = lordOfRashi(rashi);
    const lordPlanet = planets.find((p) => p.name === lord);
    houses.push({
      house: h,
      topics: HOUSE_TOPICS[h - 1],
      rashi: RASHIS[rashi - 1],
      sign: SIGNS[rashi - 1],
      rashiIndex: rashi,
      lord,
      lordInHouse: lordPlanet.house,
      lordInRashi: lordPlanet.rashi,
      lordDignity: lordPlanet.dignity,
      occupants: planets.filter((p) => p.house === h).map((p) => p.name),
      aspectedBy: planets
        .filter((p) => p.name !== 'Rahu' && p.name !== 'Ketu' && influences(p.name, p.rashiIndex, rashi) === 'aspects')
        .map((p) => p.name),
    });
  }

  const now = dashaAt(v.dasha, nowMs);
  const upcoming = dashaPeriods(v.dasha, nowMs, nowMs + 6 * 365.25 * 86400000).slice(1, 9);
  const birthYear = Number(chart.input.date.slice(0, 4));
  const age = Math.floor((nowMs - Date.parse(chart.utc)) / (365.25 * 86400000));

  return {
    timeKnown: chart.timeKnown,
    houseBasis,
    age,
    birthYear,
    lagna: v.lagna
      ? { rashi: v.lagna.rashi, sign: SIGNS[v.lagna.rashiIndex - 1], lord: lordOfRashi(v.lagna.rashiIndex), nakshatra: v.lagna.nakshatra }
      : null,
    moon: { rashi: moon.rashi, sign: SIGNS[moon.rashiIndex - 1], nakshatra: moon.nakshatra, pada: moon.pada, nakshatraLord: moon.nakshatraLord },
    sun: (() => { const s = v.planets.find((p) => p.name === 'Sun'); return { rashi: s.rashi, sign: SIGNS[s.rashiIndex - 1] }; })(),
    planets,
    houses,
    manglik: manglik(chart),
    dasha: { now, upcoming },
  };
}

const monthYear = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The facts as compact text for an AI prompt. One line per fact; no personal identifiers. */
export function factsToText(f) {
  const lines = [];
  lines.push(`Age: ${f.age} (born ${f.birthYear}).`);
  if (f.lagna) {
    lines.push(`Lagna (rising sign): ${f.lagna.rashi} (${f.lagna.sign}); lagna lord ${f.lagna.lord}.`);
    lines.push('Houses are counted from the lagna.');
  } else {
    lines.push('Birth time is unknown, so there is no lagna. Houses below are counted from the Moon sign (Moon chart) and are less precise.');
  }
  lines.push(`Moon sign: ${f.moon.rashi} (${f.moon.sign}); birth nakshatra ${f.moon.nakshatra}, pada ${f.moon.pada}.`);
  lines.push(`Sun sign (sidereal): ${f.sun.rashi} (${f.sun.sign}).`);
  lines.push('');
  lines.push('Grahas:');
  for (const p of f.planets) {
    const bits = [`${p.name}: ${p.rashi} (${p.sign}), house ${p.house}`, `nakshatra ${p.nakshatra}`];
    if (p.dignity) bits.push(p.dignity);
    if (p.retrograde) bits.push('retrograde');
    if (p.rulesHouses.length) bits.push(`rules house ${p.rulesHouses.join(' and ')}`);
    bits.push(`navamsa ${p.navamsaRashi}${p.navamsaDignity ? ` (${p.navamsaDignity})` : ''}${p.vargottama ? ', vargottama' : ''}`);
    lines.push(`- ${bits.join('; ')}.`);
  }
  lines.push('');
  lines.push('Houses:');
  for (const h of f.houses) {
    const bits = [`House ${h.house} (${h.topics}): ${h.rashi}`, `lord ${h.lord} in house ${h.lordInHouse}${h.lordDignity ? ` (${h.lordDignity})` : ''}`];
    bits.push(h.occupants.length ? `occupied by ${h.occupants.join(', ')}` : 'empty');
    if (h.aspectedBy.length) bits.push(`aspected by ${h.aspectedBy.join(', ')}`);
    lines.push(`- ${bits.join('; ')}.`);
  }
  lines.push('');
  lines.push(`Manglik (Mars in house 1, 2, 4, 7, 8 or 12 from the ${f.manglik.basis}): ${f.manglik.isManglik ? 'yes' : 'no'}.`);
  if (f.dasha.now) {
    const d = f.dasha.now;
    lines.push(`Current period: ${d.maha} mahadasha (until ${monthYear(d.mahaEnd)}), ${d.antar} antardasha (until ${monthYear(d.antarEnd)}).`);
    if (f.dasha.upcoming.length) {
      lines.push(`Next periods: ${f.dasha.upcoming.map((p) => `${p.maha}/${p.antar} ${monthYear(p.start)} to ${monthYear(p.end)}`).join('; ')}.`);
    }
  }
  return lines.join('\n');
}
