// The languages Astro Book can be read in. Shared by the web app and the API.
// `font` is a Google Fonts family that carries the script; `locale` is used for dates and numbers.
// Hinglish (English with everyday Hindi mixed in, in Roman letters) is the voice the app opens in. It is
// English underneath: only the lines written for it differ (i18n/seed/hg.mjs), nothing is machine-translated,
// and the text the engine writes stays in English. `base: 'en'` marks that.
export const LANGUAGES = [
  { code: 'hg', name: 'Hinglish', native: 'Hinglish', script: 'Latin', locale: 'en-IN', font: null, base: 'en' },
  { code: 'en', name: 'English', native: 'English', script: 'Latin', locale: 'en-IN', font: null },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', script: 'Devanagari', locale: 'hi-IN', font: null }, // Mukta carries Devanagari
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', script: 'Gujarati', locale: 'gu-IN', font: 'Mukta Vaani' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', script: 'Devanagari', locale: 'mr-IN', font: null },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', script: 'Bengali', locale: 'bn-IN', font: 'Hind Siliguri' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', script: 'Tamil', locale: 'ta-IN', font: 'Mukta Malar' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', script: 'Telugu', locale: 'te-IN', font: 'Noto Sans Telugu' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', script: 'Kannada', locale: 'kn-IN', font: 'Noto Sans Kannada' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', script: 'Malayalam', locale: 'ml-IN', font: 'Noto Sans Malayalam' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', locale: 'pa-IN', font: 'Mukta Mahee' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const languageInfo = (code) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === 'en');
/** The voice a new visitor gets before they choose one. */
export const DEFAULT_LANGUAGE = 'hg';
/** True for English and for a voice that is English underneath (Hinglish): nothing needs translating. */
export const isEnglishBased = (code) => code === 'en' || languageInfo(code).base === 'en';
/** A supported language code, or English for anything else. */
export const languageOf = (value) => (LANGUAGE_CODES.includes(value) ? value : 'en');
