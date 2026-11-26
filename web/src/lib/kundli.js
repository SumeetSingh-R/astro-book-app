// Geometry and reference text for the interactive North Indian kundli.
import { GRAHA_ABBR } from './format.js';

// The 12 houses of the diamond chart in a 400 x 400 box, anticlockwise from the top-centre diamond.
// `d` is the house outline; `p` is where grahas are written; `s` is where the rashi number sits.
export const HOUSE_SHAPES = [
  { d: 'M200 0L300 100L200 200L100 100Z', p: [200, 96], s: [200, 172], perLine: 3 },
  { d: 'M0 0L200 0L100 100Z', p: [100, 40], s: [100, 84], perLine: 3 },
  { d: 'M0 0L100 100L0 200Z', p: [40, 100], s: [84, 100], perLine: 1 },
  { d: 'M0 200L100 100L200 200L100 300Z', p: [100, 200], s: [172, 200], perLine: 3 },
  { d: 'M0 200L100 300L0 400Z', p: [40, 300], s: [84, 300], perLine: 1 },
  { d: 'M0 400L100 300L200 400Z', p: [100, 362], s: [100, 318], perLine: 3 },
  { d: 'M200 400L100 300L200 200L300 300Z', p: [200, 306], s: [200, 230], perLine: 3 },
  { d: 'M200 400L300 300L400 400Z', p: [300, 362], s: [300, 318], perLine: 3 },
  { d: 'M400 400L300 300L400 200Z', p: [360, 300], s: [316, 300], perLine: 1 },
  { d: 'M400 200L300 300L200 200L300 100Z', p: [300, 200], s: [228, 200], perLine: 3 },
  { d: 'M400 200L300 100L400 0Z', p: [360, 100], s: [316, 100], perLine: 1 },
  { d: 'M400 0L300 100L200 0Z', p: [300, 40], s: [300, 84], perLine: 3 },
];

export const HOUSE_MEANINGS = [
  { name: 'Tanu', about: 'You: body, temperament and how you meet the world.' },
  { name: 'Dhana', about: 'Money, food, speech and the family you grew up in.' },
  { name: 'Sahaja', about: 'Courage, effort, siblings, short journeys and skills of the hands.' },
  { name: 'Sukha', about: 'Home, mother, comfort, property and peace of mind.' },
  { name: 'Putra', about: 'Children, creativity, learning, romance and good judgement.' },
  { name: 'Ari', about: 'Daily work, health, debts, rivals and the obstacles you overcome.' },
  { name: 'Kalatra', about: 'Marriage, partnerships and the people you deal with one to one.' },
  { name: 'Ayu', about: 'Longevity, sudden change, shared money and things kept hidden.' },
  { name: 'Dharma', about: 'Fortune, faith, teachers, father and long journeys.' },
  { name: 'Karma', about: 'Career, reputation, responsibility and your place in public life.' },
  { name: 'Labha', about: 'Gains, income, friends, networks and hopes fulfilled.' },
  { name: 'Vyaya', about: 'Expenses, rest, solitude, foreign places and letting go.' },
];

export const GRAHA_MEANINGS = {
  Sun: 'self, vitality and authority',
  Moon: 'mind, feelings and care',
  Mars: 'energy, courage and drive',
  Mercury: 'intellect, speech and trade',
  Jupiter: 'wisdom, growth and guidance',
  Venus: 'love, comfort and the arts',
  Saturn: 'discipline, duty and patience',
  Rahu: 'ambition, appetite and the unfamiliar',
  Ketu: 'detachment, insight and what is left behind',
};

export const RASHI_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

export const VIEW_LABELS = { lagna: 'Birth chart', moon: 'Moon chart', navamsa: 'Navamsa (D9)' };

const navamsaSign = (longitude) => (Math.floor(longitude / (10 / 3)) % 12) + 1;

/** Which chart views can be drawn: a birth chart from the lagna needs a known birth time. */
export function availableViews(vedic) {
  return vedic.lagna ? ['lagna', 'moon', 'navamsa'] : ['moon', 'navamsa'];
}

/**
 * Lay the grahas out in 12 houses for one view of the chart.
 * @returns {{house:number, sign:number, planets:object[]}[]}
 */
export function buildKundli(vedic, view) {
  const moon = vedic.planets.find((p) => p.name === 'Moon');
  const signOf = (p) => (view === 'navamsa' ? navamsaSign(p.longitude) : p.rashiIndex);
  let first;
  if (view === 'navamsa') first = navamsaSign((vedic.lagna ?? moon).longitude);
  else if (view === 'moon' || !vedic.lagna) first = moon.rashiIndex;
  else first = vedic.lagna.rashiIndex;

  const houses = Array.from({ length: 12 }, (_, i) => ({ house: i + 1, sign: ((first - 1 + i) % 12) + 1, planets: [] }));
  for (const p of vedic.planets) {
    const h = (signOf(p) - first + 12) % 12;
    houses[h].planets.push({
      ...p,
      abbr: GRAHA_ABBR[p.name],
      retro: p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu',
    });
  }
  return houses;
}

// ---------- Reading one house in plain words ----------
export const HOUSE_TOPICS = [
  'self, body and temperament', 'money, speech and family', 'courage, effort and siblings', 'home, mother, property and peace of mind',
  'children, creativity and learning', 'daily work, health, debts and rivals', 'marriage and partnerships', 'longevity, sudden change and shared money',
  'fortune, faith, father and long journeys', 'career and reputation', 'gains, income and friends', 'expenses, rest, solitude and foreign places',
];
const EXALTED_IN = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };
const EXTRA_ASPECTS = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10] };
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function dignity(name, sign) {
  const ex = EXALTED_IN[name];
  if (!ex) return null;
  if (sign === ex) return 'exalted';
  if (sign === ((ex + 5) % 12) + 1) return 'debilitated';
  return RASHI_LORDS[sign - 1] === name ? 'own' : null;
}

/** The mahadasha and antardasha lords at a moment, or null outside the timeline. */
export function periodAt(dasha, at = Date.now()) {
  const maha = dasha?.mahadashas.find((m) => Date.parse(m.start) <= at && at < Date.parse(m.end));
  if (!maha) return null;
  const antar = maha.antardashas.find((a) => Date.parse(a.start) <= at && at < Date.parse(a.end)) ?? maha.antardashas[0];
  return { maha: maha.lord, mahaEnd: maha.end, antar: antar.lord, antarEnd: antar.end };
}

/**
 * What one house says: how its lord is placed, who looks at it, and, for a person's own chart,
 * whether the period they are in now brings it into focus.
 * @param houses  the output of buildKundli()
 * @param period  periodAt(...) for a personal chart, or null (the sky right now, a navamsa)
 */
export function readHouse(houses, number, period, whose = 'your') {
  const house = houses[number - 1];
  const names = house.planets.map((p) => p.name);
  const lord = RASHI_LORDS[house.sign - 1];
  const lordHouse = houses.find((h) => h.planets.some((p) => p.name === lord));

  let lordLine = null;
  if (lordHouse) {
    const strength = dignity(lord, lordHouse.sign);
    if (lordHouse.house === house.house) {
      lordLine = `Its lord, ${lord}, sits right here in its own sign, a strong support for this house.`;
    } else {
      lordLine = `Its lord, ${lord}, sits in the ${ORDINALS[lordHouse.house - 1]} house (${HOUSE_TOPICS[lordHouse.house - 1]})`
        + (strength === 'exalted' ? ', where it is exalted: a strong support for this house.'
          : strength === 'own' ? ', in its own sign: a strong support for this house.'
            : strength === 'debilitated' ? ', where it is weak, so this area asks for more patience.' : '.');
    }
  }

  const lookers = [];
  for (const h of houses) {
    const distance = ((house.house - h.house + 12) % 12) + 1;
    for (const p of h.planets) {
      if (p.name === 'Rahu' || p.name === 'Ketu') continue;
      if (distance === 7 || (EXTRA_ASPECTS[p.name] ?? []).includes(distance)) lookers.push(p.name);
    }
  }
  const aspectLine = lookers.length ? `${list(lookers)} ${lookers.length > 1 ? 'look' : 'looks'} at this house from across the chart.` : null;

  let status = names.length ? 'Active' : 'Quiet';
  let nowLine = null;
  if (period) {
    const focus = [];
    let until = period.mahaEnd;
    for (const [graha, label] of [[period.maha, 'main period'], [period.antar, 'sub-period']]) {
      let hit = false;
      if (lord === graha) { focus.push(`${graha}, the lord of ${whose} ${label}, rules this house`); hit = true; }
      if (names.includes(graha)) { focus.push(`${graha}, the lord of ${whose} ${label}, sits here`); hit = true; }
      if (hit && label === 'sub-period') until = period.antarEnd;
    }
    if (focus.length) {
      status = 'In focus now';
      const when = new Date(until).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const text = list(focus);
      nowLine = `${text[0].toUpperCase()}${text.slice(1)}, so these themes are in focus until ${when}.`;
    } else {
      nowLine = `Neither of ${whose} current period lords is tied to this house, so it stays in the background for now.`;
    }
  }
  return { status, lord, lordLine, aspectLine, nowLine };
}
