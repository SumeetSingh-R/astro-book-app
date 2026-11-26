// Compatibility: Vedic Ashtakoot (Guna Milan, 36 points) with Manglik check, and Western synastry.
import { RASHIS, NAKSHATRAS, NAKSHATRA_SPAN, ENGINE_VERSION } from './constants.mjs';
import { norm360 } from './vedic.mjs';
import {
  VARNA_RANK, VARNA_NAMES, VASHYA, VASHYA_SCORE, vashyaIndex,
  YONI_ANIMALS, YONI_OF_NAKSHATRA, YONI_SCORE,
  RASHI_LORD, FRIENDS, ENEMIES,
  GANA, GANA_OF_NAKSHATRA, GANA_SCORE,
  NADI, NADI_OF_NAKSHATRA,
} from './matchTables.mjs';

const rashiIdx = (lon) => Math.min(11, Math.floor(norm360(lon) / 30));
const nakIdx = (lon) => Math.min(26, Math.floor(norm360(lon) / NAKSHATRA_SPAN));

function relation(from, to) {
  if (from === to) return 'F';
  if (FRIENDS[from].includes(to)) return 'F';
  if (ENEMIES[from].includes(to)) return 'E';
  return 'N';
}

function grahaMaitriScore(lordA, lordB) {
  if (lordA === lordB) return 5;
  const pair = [relation(lordA, lordB), relation(lordB, lordA)].sort().join('');
  return { FF: 5, FN: 4, NN: 3, EF: 1, EN: 0.5, EE: 0 }[pair];
}

/** Tara: count from one nakshatra to the other; remainders 3, 5, 7 (of 9) are unfavourable. */
function taraGood(fromNak, toNak) {
  const count = ((toNak - fromNak + 27) % 27) + 1;
  return ![3, 5, 7].includes(count % 9);
}

/**
 * Ashtakoot matching from the two natal Moon positions (sidereal longitudes).
 * The traditional method is defined for a groom and a bride; several kootas depend on which is which.
 */
export function ashtakoot(groomMoonLon, brideMoonLon) {
  const g = { lon: norm360(groomMoonLon) };
  const b = { lon: norm360(brideMoonLon) };
  for (const p of [g, b]) {
    p.rashi = rashiIdx(p.lon);
    p.nak = nakIdx(p.lon);
  }

  const varna = VARNA_RANK[g.rashi] >= VARNA_RANK[b.rashi] ? 1 : 0;
  const vashya = VASHYA_SCORE[vashyaIndex(b.lon)][vashyaIndex(g.lon)];
  const tara = (taraGood(b.nak, g.nak) ? 1.5 : 0) + (taraGood(g.nak, b.nak) ? 1.5 : 0);
  const yoni = YONI_SCORE[YONI_OF_NAKSHATRA[b.nak]][YONI_OF_NAKSHATRA[g.nak]];
  const maitri = grahaMaitriScore(RASHI_LORD[g.rashi], RASHI_LORD[b.rashi]);
  const gana = GANA_SCORE[GANA_OF_NAKSHATRA[b.nak]][GANA_OF_NAKSHATRA[g.nak]];
  const distance = ((b.rashi - g.rashi + 12) % 12) + 1;
  const bhakoot = [2, 12, 5, 9, 6, 8].includes(distance) ? 0 : 7;
  const nadi = NADI_OF_NAKSHATRA[g.nak] === NADI_OF_NAKSHATRA[b.nak] ? 0 : 8;

  const kootas = [
    { name: 'Varna', max: 1, score: varna, groom: VARNA_NAMES[VARNA_RANK[g.rashi]], bride: VARNA_NAMES[VARNA_RANK[b.rashi]] },
    { name: 'Vashya', max: 2, score: vashya, groom: VASHYA[vashyaIndex(g.lon)], bride: VASHYA[vashyaIndex(b.lon)] },
    { name: 'Tara', max: 3, score: tara, groom: NAKSHATRAS[g.nak], bride: NAKSHATRAS[b.nak] },
    { name: 'Yoni', max: 4, score: yoni, groom: YONI_ANIMALS[YONI_OF_NAKSHATRA[g.nak]], bride: YONI_ANIMALS[YONI_OF_NAKSHATRA[b.nak]] },
    { name: 'Graha Maitri', max: 5, score: maitri, groom: RASHI_LORD[g.rashi], bride: RASHI_LORD[b.rashi] },
    { name: 'Gana', max: 6, score: gana, groom: GANA[GANA_OF_NAKSHATRA[g.nak]], bride: GANA[GANA_OF_NAKSHATRA[b.nak]] },
    { name: 'Bhakoot', max: 7, score: bhakoot, groom: RASHIS[g.rashi], bride: RASHIS[b.rashi] },
    { name: 'Nadi', max: 8, score: nadi, groom: NADI[NADI_OF_NAKSHATRA[g.nak]], bride: NADI[NADI_OF_NAKSHATRA[b.nak]] },
  ];
  const total = kootas.reduce((s, k) => s + k.score, 0);

  const doshas = [];
  if (nadi === 0) doshas.push('Nadi dosha (same nadi)');
  if (bhakoot === 0) doshas.push(`Bhakoot dosha (Moon signs ${distance}/${14 - distance} apart)`);
  if (gana <= 1) doshas.push('Gana dosha');

  let band;
  if (total < 18) band = 'Below the traditional minimum of 18';
  else if (total < 25) band = 'Acceptable';
  else if (total < 33) band = 'Very good';
  else band = 'Excellent';

  return { total, max: 36, band, kootas, doshas };
}

const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12];

/** Manglik (Kuja dosha) check from a computed chart: Mars in houses 1, 2, 4, 7, 8 or 12. */
export function manglik(chart) {
  const mars = chart.vedic.planets.find((p) => p.name === 'Mars');
  const moon = chart.vedic.planets.find((p) => p.name === 'Moon');
  const fromMoonHouse = ((mars.rashiIndex - moon.rashiIndex + 12) % 12) + 1;
  const fromLagnaHouse = mars.house; // null when birth time is unknown
  const fromLagna = fromLagnaHouse == null ? null : MANGLIK_HOUSES.includes(fromLagnaHouse);
  const fromMoon = MANGLIK_HOUSES.includes(fromMoonHouse);
  return {
    isManglik: fromLagna ?? fromMoon,
    basis: fromLagna == null ? 'Moon (birth time unknown)' : 'Lagna',
    marsHouseFromLagna: fromLagnaHouse,
    marsHouseFromMoon: fromMoonHouse,
    fromLagna, fromMoon,
  };
}

/** Full Vedic match from two charts produced by computeChart(). */
export function matchVedic(groomChart, brideChart) {
  const moonOf = (c) => c.vedic.planets.find((p) => p.name === 'Moon').longitude;
  const result = ashtakoot(moonOf(groomChart), moonOf(brideChart));
  const mg = manglik(groomChart);
  const mb = manglik(brideChart);
  const notes = [];
  if (!groomChart.timeKnown || !brideChart.timeKnown) {
    notes.push('A birth time is unknown, so the Moon position is approximate. If the Moon was near the edge of a nakshatra or sign that day, the score may differ.');
  }
  return {
    system: 'vedic', method: 'Ashtakoot (Guna Milan)', engineVersion: ENGINE_VERSION,
    ...result,
    manglik: {
      groom: mg, bride: mb,
      compatible: mg.isManglik === mb.isManglik,
      summary: mg.isManglik === mb.isManglik
        ? (mg.isManglik ? 'Both are Manglik, which is traditionally considered balanced.' : 'Neither is Manglik.')
        : 'One partner is Manglik and the other is not.',
    },
    notes,
  };
}

// ---------- Western synastry ----------
const SYNASTRY_ASPECTS = [
  { name: 'Conjunction', angle: 0, orb: 8, nature: 'blending' },
  { name: 'Sextile', angle: 60, orb: 4, nature: 'harmonious' },
  { name: 'Square', angle: 90, orb: 6, nature: 'challenging' },
  { name: 'Trine', angle: 120, orb: 6, nature: 'harmonious' },
  { name: 'Opposition', angle: 180, orb: 6, nature: 'challenging' },
];
const PERSONAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
const ELEMENTS = ['Fire', 'Earth', 'Air', 'Water'];
const elementOf = (signIndex) => ELEMENTS[(signIndex - 1) % 4];

/** Western synastry: aspects between person A's planets and person B's planets. */
export function matchWestern(chartA, chartB) {
  const skip = new Set(['North Node']);
  const aspects = [];
  for (const pa of chartA.western.planets) {
    if (skip.has(pa.name)) continue;
    for (const pb of chartB.western.planets) {
      if (skip.has(pb.name)) continue;
      // Generational planet pairs say little about two individuals.
      if (!PERSONAL.includes(pa.name) && !PERSONAL.includes(pb.name)) continue;
      const d = Math.abs(pa.longitude - pb.longitude);
      const sep = d > 180 ? 360 - d : d;
      for (const asp of SYNASTRY_ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({ a: pa.name, b: pb.name, type: asp.name, nature: asp.nature, orb });
          break;
        }
      }
    }
  }
  aspects.sort((x, y) => x.orb - y.orb);

  const count = (n) => aspects.filter((x) => x.nature === n).length;
  const signs = (chart) => Object.fromEntries(
    ['Sun', 'Moon', 'Venus', 'Mars'].map((n) => {
      const p = chart.western.planets.find((x) => x.name === n);
      return [n, { sign: p.sign, element: elementOf(p.signIndex) }];
    }),
  );
  const notes = [];
  if (!chartA.timeKnown || !chartB.timeKnown) {
    notes.push('A birth time is unknown, so aspects involving the Moon are approximate.');
  }
  return {
    system: 'western', method: 'Synastry (cross-chart aspects)', engineVersion: ENGINE_VERSION,
    summary: { harmonious: count('harmonious'), challenging: count('challenging'), blending: count('blending') },
    a: signs(chartA), b: signs(chartB),
    aspects, notes,
  };
}
