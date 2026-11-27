// Geometry and reference text for the interactive North Indian kundli.
import { GRAHA_ABBR, currentLocale } from './format.js';
import { msg } from './msg.js';

// The 12 houses of the diamond chart in a 400 x 400 box, anticlockwise from the top-centre diamond.
// `d` is the house outline; `p` is where grahas are written; `s` is where the sign symbol sits.
export const HOUSE_SHAPES = [
  { d: 'M200 0L300 100L200 200L100 100Z', p: [200, 96], s: [200, 172], perLine: 3 },
  { d: 'M0 0L200 0L100 100Z', p: [100, 40], s: [100, 84], perLine: 3 },
  { d: 'M0 0L100 100L0 200Z', p: [38, 100], s: [84, 100], perLine: 1 },
  { d: 'M0 200L100 100L200 200L100 300Z', p: [100, 200], s: [172, 200], perLine: 3 },
  { d: 'M0 200L100 300L0 400Z', p: [38, 300], s: [84, 300], perLine: 1 },
  { d: 'M0 400L100 300L200 400Z', p: [100, 362], s: [100, 318], perLine: 3 },
  { d: 'M200 400L100 300L200 200L300 300Z', p: [200, 306], s: [200, 230], perLine: 3 },
  { d: 'M200 400L300 300L400 400Z', p: [300, 362], s: [300, 318], perLine: 3 },
  { d: 'M400 400L300 300L400 200Z', p: [362, 300], s: [316, 300], perLine: 1 },
  { d: 'M400 200L300 300L200 200L300 100Z', p: [300, 200], s: [228, 200], perLine: 3 },
  { d: 'M400 200L300 100L400 0Z', p: [362, 100], s: [316, 100], perLine: 1 },
  { d: 'M400 0L300 100L200 0Z', p: [300, 40], s: [300, 84], perLine: 3 },
];

export const HOUSE_MEANINGS = [
  { name: 'Tanu', about: msg('You: body, temperament and how you meet the world.') },
  { name: 'Dhana', about: msg('Money, food, speech and the family you grew up in.') },
  { name: 'Sahaja', about: msg('Courage, effort, siblings, short journeys and skills of the hands.') },
  { name: 'Sukha', about: msg('Home, mother, comfort, property and peace of mind.') },
  { name: 'Putra', about: msg('Children, creativity, learning, romance and good judgement.') },
  { name: 'Ari', about: msg('Daily work, health, debts, rivals and the obstacles you overcome.') },
  { name: 'Kalatra', about: msg('Marriage, partnerships and the people you deal with one to one.') },
  { name: 'Ayu', about: msg('Longevity, sudden change, shared money and things kept hidden.') },
  { name: 'Dharma', about: msg('Fortune, faith, teachers, father and long journeys.') },
  { name: 'Karma', about: msg('Career, reputation, responsibility and your place in public life.') },
  { name: 'Labha', about: msg('Gains, income, friends, networks and hopes fulfilled.') },
  { name: 'Vyaya', about: msg('Expenses, rest, solitude, foreign places and letting go.') },
];

export const GRAHA_MEANINGS = {
  Sun: msg('self, vitality and authority'),
  Moon: msg('mind, feelings and care'),
  Mars: msg('energy, courage and drive'),
  Mercury: msg('intellect, speech and trade'),
  Jupiter: msg('wisdom, growth and guidance'),
  Venus: msg('love, comfort and the arts'),
  Saturn: msg('discipline, duty and patience'),
  Rahu: msg('ambition, appetite and the unfamiliar'),
  Ketu: msg('detachment, insight and what is left behind'),
};

export const RASHI_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

export const VIEW_LABELS = { lagna: msg('Birth chart'), moon: msg('Moon chart'), navamsa: msg('Navamsa (D9)') };

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
  msg('self, body and temperament'), msg('money, speech and family'), msg('courage, effort and siblings'), msg('home, mother, property and peace of mind'),
  msg('children, creativity and learning'), msg('daily work, health, debts and rivals'), msg('marriage and partnerships'), msg('longevity, sudden change and shared money'),
  msg('fortune, faith, father and long journeys'), msg('career and reputation'), msg('gains, income and friends'), msg('expenses, rest, solitude and foreign places'),
];
const EXALTED_IN = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };
const EXTRA_ASPECTS = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10] };
export const HOUSE_NAMES = [msg('1st house'), msg('2nd house'), msg('3rd house'), msg('4th house'), msg('5th house'), msg('6th house'), msg('7th house'), msg('8th house'), msg('9th house'), msg('10th house'), msg('11th house'), msg('12th house')];
export const HOUSE_STATUS = [msg('In focus now'), msg('Active'), msg('Quiet')];
// "A, B and C" the way the chosen language writes a list.
const list = (xs) => { try { return new Intl.ListFormat(currentLocale(), { style: 'long', type: 'conjunction' }).format(xs); } catch { return xs.join(', '); } };

// Every sentence the house reader can say, whole, so each can be translated as one thought.
const LORD_LINES = {
  here: msg('Its lord, {0}, sits right here in its own sign, a strong support for this house.'),
  plain: msg('Its lord, {0}, sits in the {1} ({2}).'),
  exalted: msg('Its lord, {0}, sits in the {1} ({2}), where it is exalted: a strong support for this house.'),
  own: msg('Its lord, {0}, sits in the {1} ({2}), in its own sign: a strong support for this house.'),
  debilitated: msg('Its lord, {0}, sits in the {1} ({2}), where it is weak, so this area asks for more patience.'),
};
const FOCUS_LINES = {
  your: {
    main: { rules: msg('{0}, the lord of your main period, rules this house'), sits: msg('{0}, the lord of your main period, sits here') },
    sub: { rules: msg('{0}, the lord of your sub-period, rules this house'), sits: msg('{0}, the lord of your sub-period, sits here') },
    none: msg('Neither of your current period lords is tied to this house, so it stays in the background for now.'),
  },
  their: {
    main: { rules: msg('{0}, the lord of their main period, rules this house'), sits: msg('{0}, the lord of their main period, sits here') },
    sub: { rules: msg('{0}, the lord of their sub-period, rules this house'), sits: msg('{0}, the lord of their sub-period, sits here') },
    none: msg('Neither of their current period lords is tied to this house, so it stays in the background for now.'),
  },
};

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
 * @param t       the translate function, so every line comes out in the chosen language
 * @returns status is one of HOUSE_STATUS, in English: translate it when showing it
 */
export function readHouse(houses, number, period, whose = 'your', t = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : text)) {
  const house = houses[number - 1];
  const names = house.planets.map((p) => p.name);
  const lord = RASHI_LORDS[house.sign - 1];
  const lordHouse = houses.find((h) => h.planets.some((p) => p.name === lord));

  let lordLine = null;
  if (lordHouse) {
    const strength = dignity(lord, lordHouse.sign);
    const key = lordHouse.house === house.house ? 'here' : strength ?? 'plain';
    lordLine = t(LORD_LINES[key], [t(lord), t(HOUSE_NAMES[lordHouse.house - 1]), t(HOUSE_TOPICS[lordHouse.house - 1])]);
  }

  const lookers = [];
  for (const h of houses) {
    const distance = ((house.house - h.house + 12) % 12) + 1;
    for (const p of h.planets) {
      if (p.name === 'Rahu' || p.name === 'Ketu') continue;
      if (distance === 7 || (EXTRA_ASPECTS[p.name] ?? []).includes(distance)) lookers.push(p.name);
    }
  }
  const aspectLine = !lookers.length ? null
    : lookers.length > 1 ? t('{0} look at this house from across the chart.', [list(lookers.map((n) => t(n)))])
      : t('{0} looks at this house from across the chart.', [t(lookers[0])]);

  let status = names.length ? 'Active' : 'Quiet';
  let nowLine = null;
  if (period) {
    const lines = FOCUS_LINES[whose === 'their' ? 'their' : 'your'];
    const focus = [];
    let until = period.mahaEnd;
    for (const [graha, which] of [[period.maha, 'main'], [period.antar, 'sub']]) {
      let hit = false;
      if (lord === graha) { focus.push(t(lines[which].rules, [t(graha)])); hit = true; }
      if (names.includes(graha)) { focus.push(t(lines[which].sits, [t(graha)])); hit = true; }
      if (hit && which === 'sub') until = period.antarEnd;
    }
    if (focus.length) {
      status = 'In focus now';
      const when = new Date(until).toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' });
      const text = list(focus);
      nowLine = t('{0}, so these themes are in focus until {1}.', [`${text[0].toUpperCase()}${text.slice(1)}`, when]);
    } else {
      nowLine = t(lines.none);
    }
  }
  return { status, lord, lordLine, aspectLine, nowLine };
}
