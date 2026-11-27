// The proper names the app shows (signs, grahas, nakshatras, matching terms), taken from the engine,
// so they are part of the translation catalogue even though no t('…') call spells them out.
import { SIGNS, RASHIS, NAKSHATRAS, DASHA_ORDER, ASPECTS } from '../engine/src/constants.mjs';
import { VARNA_NAMES, VASHYA, YONI_ANIMALS, GANA, NADI } from '../engine/src/matchTables.mjs';
import { TARAS, saturnNote } from '../engine/src/personal.mjs';

export default [
  ...SIGNS, ...RASHIS, ...NAKSHATRAS, ...DASHA_ORDER,
  'Uranus', 'Neptune', 'Pluto', 'North Node',
  ...ASPECTS.map((a) => a.name), 'Fire', 'Earth', 'Air', 'Water',
  ...Object.values(VARNA_NAMES), ...VASHYA, ...YONI_ANIMALS, ...GANA, ...NADI,
  ...TARAS.map((x) => x.name),
  ...TARAS.map((x) => x.meaning),
  // What the day's reading says about Saturn's passage over the Moon sign.
  ...[12, 1, 2, 4, 8].flatMap((h) => Object.values(saturnNote(h))),
  'Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi',
  'Nadi dosha', 'Bhakoot dosha', 'Gana dosha',
  // Messages the server can send back, shown as they are when no translation is known.
  "You have used today's 10 questions. They reset at midnight, India time.",
  'Answers from your chart are not switched on yet.',
  'The service is busy right now. Please try again in a minute.',
  'The answer took too long to arrive. Please try again.',
  'The answer could not be written just now. Please try again.',
  'Something went wrong. Please try again.',
  'Could not reach the database. Please try again.',
  'Your session has expired. Sign in again.',
  'Type a question about your chart.',
  'Keep the question under 500 characters.',
  'Neither is Manglik.', 'One partner is Manglik and the other is not.', 'Both are Manglik, which is traditionally considered balanced.',
  'Lahiri', 'Excellent', 'Very good', 'Acceptable', 'Below the traditional minimum of 18',
];
