// Lookup tables for Ashtakoot (36-point) matching.
// Nakshatra arrays are indexed 0-26 (Ashwini .. Revati); rashi arrays 0-11 (Mesha .. Meena).
// NOTE: published Vashya and Gana tables differ slightly between sources. The versions used
// here are the ones most widely used in matching software; all tables are "bride row, groom column".

// Varna rank per rashi: 4 Brahmin (water), 3 Kshatriya (fire), 2 Vaishya (earth), 1 Shudra (air).
export const VARNA_NAMES = { 4: 'Brahmin', 3: 'Kshatriya', 2: 'Vaishya', 1: 'Shudra' };
export const VARNA_RANK = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4];

// Vashya groups
export const VASHYA = ['Chatushpada', 'Manava', 'Jalachara', 'Vanachara', 'Keeta'];
/** Vashya group index for a sidereal longitude (Sagittarius and Capricorn split at 15°). */
export function vashyaIndex(siderealLon) {
  const sign = Math.floor(siderealLon / 30) % 12;
  const deg = siderealLon - sign * 30;
  switch (sign) {
    case 0: case 1: return 0;              // Aries, Taurus
    case 2: case 5: case 6: case 10: return 1; // Gemini, Virgo, Libra, Aquarius
    case 3: case 11: return 2;             // Cancer, Pisces
    case 4: return 3;                      // Leo
    case 7: return 4;                      // Scorpio
    case 8: return deg < 15 ? 1 : 0;       // Sagittarius: first half human, second half quadruped
    case 9: return deg < 15 ? 0 : 2;       // Capricorn: first half quadruped, second half water
    default: return 1;
  }
}
// VASHYA_SCORE[bride][groom]
export const VASHYA_SCORE = [
  [2, 1, 1, 0.5, 1],
  [1, 2, 0.5, 0, 1],
  [1, 0.5, 2, 1, 1],
  [0, 0, 0, 2, 0],
  [1, 1, 1, 0, 2],
];

// Yoni animal per nakshatra
export const YONI_ANIMALS = [
  'Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat',
  'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion',
];
export const YONI_OF_NAKSHATRA = [
  0, 1, 2, 3, 3, 4, 5, 2, 5,      // Ashwini .. Ashlesha
  6, 6, 7, 8, 9, 8, 9, 10, 10,    // Magha .. Jyeshtha
  4, 11, 12, 11, 13, 0, 13, 7, 1, // Mula .. Revati
];
// Symmetric 14x14 table; sworn enemies score 0.
export const YONI_SCORE = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];

// Rashi lords and natural (Parashari) planetary relationships for Graha Maitri.
export const RASHI_LORD = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];
export const FRIENDS = {
  Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus'],
};
export const ENEMIES = {
  Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'],
};

// Gana per nakshatra: 0 Deva, 1 Manushya, 2 Rakshasa
export const GANA = ['Deva', 'Manushya', 'Rakshasa'];
export const GANA_OF_NAKSHATRA = [
  0, 1, 2, 1, 0, 1, 0, 0, 2,
  2, 1, 1, 0, 2, 0, 2, 0, 2,
  2, 1, 1, 0, 2, 2, 1, 1, 0,
];
// GANA_SCORE[bride][groom]
export const GANA_SCORE = [
  [6, 6, 0],
  [5, 6, 0],
  [1, 0, 6],
];

// Nadi per nakshatra: 0 Aadi, 1 Madhya, 2 Antya
export const NADI = ['Aadi', 'Madhya', 'Antya'];
export const NADI_OF_NAKSHATRA = [
  0, 1, 2, 2, 1, 0, 0, 1, 2,
  2, 1, 0, 0, 1, 2, 2, 1, 0,
  0, 1, 2, 2, 1, 0, 0, 1, 2,
];
