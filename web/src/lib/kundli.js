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
