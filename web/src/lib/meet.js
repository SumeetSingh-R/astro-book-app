// Meet and match: the choices a profile offers, and small helpers shared by its pages.
import { msg } from './msg.js';

// [stored value, label]. Labels are English keys for t().
export const GENDERS = [['woman', msg('Woman')], ['man', msg('Man')], ['other', msg('Another gender')]];
export const INTERESTED_IN = [['men', msg('Men')], ['women', msg('Women')], ['everyone', msg('Everyone')]];
export const LOOKING_FOR = [['marriage', msg('Marriage')], ['long_term', msg('Something long-term')], ['figuring_out', msg('Still figuring it out')]];
export const MARITAL = [['never_married', msg('Never married')], ['divorced', msg('Divorced')], ['widowed', msg('Widowed')], ['separated', msg('Separated')]];
export const DIETS = [['vegetarian', msg('Vegetarian')], ['eggetarian', msg('Eggetarian')], ['non_vegetarian', msg('Non-vegetarian')], ['vegan', msg('Vegan')], ['jain', msg('Jain food')]];
export const DRINKING = [['never', msg('Does not drink')], ['socially', msg('Drinks socially')], ['regularly', msg('Drinks regularly')]];
export const SMOKING = [['never', msg('Non-smoker')], ['sometimes', msg('Smokes sometimes')], ['regularly', msg('Smokes regularly')]];
export const FAMILY_TYPES = [['joint', msg('Joint family')], ['nuclear', msg('Nuclear family')]];
export const INCOMES = [['under_5', msg('Under 5 lakh a year')], ['5_10', msg('5 to 10 lakh a year')], ['10_15', msg('10 to 15 lakh a year')], ['15_20', msg('15 to 20 lakh a year')],
  ['20_30', msg('20 to 30 lakh a year')], ['30_50', msg('30 to 50 lakh a year')], ['over_50', msg('Over 50 lakh a year')]];
export const MANGLIK = [['any', msg('No preference')], ['no', msg('Not Manglik')], ['yes', msg('Manglik')]];
// Suggestions only: people can type anything.
export const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain', 'Buddhist', 'Parsi', 'Jewish', 'No religion'];
export const TONGUES = ['Hindi', 'Gujarati', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Bhojpuri', 'Marwari', 'Urdu', 'English'];

export const MAX_PHOTOS = 6;
export const labelOf = (options, value) => options.find(([v]) => v === value)?.[1] ?? null;

/** 170 -> "5 ft 7 in" */
export function feetInches(cm) {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}
/** Heights offered in the picker: 4 ft 6 in to 6 ft 8 in, one inch apart, as [cm, label]. */
export const HEIGHTS = Array.from({ length: 27 }, (_, i) => { const cm = Math.round((54 + i) * 2.54); return [cm, feetInches(cm)]; });

/** Age from a birth date, on a given day. */
export function ageOn(birthDate, today = new Date()) {
  const [y, m, d] = String(birthDate).split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

/** "trekking, Indie music ,," -> ['trekking', 'Indie music'] (at most `max`, no repeats). */
export function toList(text, max = 10) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text ?? '').split(',')) {
    const item = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
    if (out.length === max) break;
  }
  return out;
}

/** A new profile's starting values, from the person's saved birth details. */
export function blankProfile(self) {
  return {
    display_name: String(self?.name ?? '').trim().split(/\s+/)[0] ?? '', birth_year: Number(String(self?.birth_date ?? '').slice(0, 4)) || null,
    gender: '', interested_in: '', looking_for: 'marriage', about: '', height_cm: null, education: '', work: '', city: '',
    marital_status: null, diet: null, drinking: null, smoking: null, interests: [],
    religion: '', community: '', mother_tongue: '', gotra: '', income_range: null, family_type: null, parents: '', siblings: '',
    show_religion: true, show_community: true, show_income: true, discoverable: true, only_liked: false,
  };
}
export const blankPreferences = () => ({ age_min: 21, age_max: 40, height_min_cm: null, looking_for: [], marital_statuses: [], religions: [], communities: [], mother_tongues: [], income_min: null, min_score: 18, manglik: 'any' });

/**
 * How complete a profile is, 0 to 100, and the most useful thing to add next.
 * Photos and the things people filter on count the most.
 */
export function completeness(profile, photoCount) {
  const parts = [
    [photoCount >= 1, 20, msg('Add a clear photo of your face')],
    [photoCount >= 3, 10, msg('Add at least 3 photos')],
    [Boolean(profile.gender && profile.interested_in), 10, msg('Say who you are and who you want to meet')],
    [profile.about.trim().length >= 20, 10, msg('Write a line or two about yourself')],
    [Boolean(profile.height_cm), 5, msg('Add your height')],
    [Boolean(profile.education.trim() && profile.work.trim()), 10, msg('Add your education and work')],
    [Boolean(profile.city.trim()), 5, msg('Add where you live')],
    [Boolean(profile.marital_status), 5, msg('Add your marital status')],
    [Boolean(profile.religion.trim() && profile.mother_tongue.trim()), 10, msg('Add your religion and mother tongue')],
    [Boolean(profile.family_type), 5, msg('Add a little about your family')],
    [Boolean(profile.diet && profile.drinking && profile.smoking), 5, msg('Add your food, drinking and smoking habits')],
    [profile.interests.length >= 3, 5, msg('Add at least 3 interests')],
  ];
  const percent = parts.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0);
  return { percent, next: parts.find(([done]) => !done)?.[2] ?? null };
}
