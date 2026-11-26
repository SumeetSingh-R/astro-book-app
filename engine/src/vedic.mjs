import {
  RASHIS, NAKSHATRAS, DASHA_ORDER, DASHA_YEARS, DASHA_TOTAL_YEARS,
  DAYS_PER_YEAR, NAKSHATRA_SPAN, PADA_SPAN,
} from './constants.mjs';

export const norm360 = (x) => ((x % 360) + 360) % 360;

/** Nakshatra, pada and dasha lord for a sidereal longitude. */
export function nakshatraOf(siderealLon) {
  const lon = norm360(siderealLon);
  const index = Math.min(26, Math.floor(lon / NAKSHATRA_SPAN));
  const within = lon - index * NAKSHATRA_SPAN;
  return {
    index: index + 1,
    name: NAKSHATRAS[index],
    pada: Math.min(4, Math.floor(within / PADA_SPAN) + 1),
    lord: DASHA_ORDER[index % 9],
    fractionElapsed: within / NAKSHATRA_SPAN,
  };
}

/** Navamsa (D9) sign index 0-11 for a sidereal longitude. */
export function navamsaSignIndex(siderealLon) {
  return Math.floor(norm360(siderealLon) / PADA_SPAN) % 12;
}

export function rashiOf(siderealLon) {
  const lon = norm360(siderealLon);
  const index = Math.min(11, Math.floor(lon / 30));
  return { index: index + 1, name: RASHIS[index], degree: lon - index * 30 };
}

/**
 * Vimshottari dasha timeline from the Moon's sidereal longitude at birth.
 * Returns the 9 mahadashas that span 120 years, each with its 9 antardashas.
 * The first mahadasha starts before birth (the elapsed part is already "used up").
 */
export function vimshottari(moonSiderealLon, birthMs) {
  const nak = nakshatraOf(moonSiderealLon);
  const startIdx = DASHA_ORDER.indexOf(nak.lord);
  const yearMs = DAYS_PER_YEAR * 86400000;
  const firstYears = DASHA_YEARS[nak.lord];
  let cursor = birthMs - nak.fractionElapsed * firstYears * yearMs;

  const mahadashas = [];
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const years = DASHA_YEARS[lord];
    const start = cursor;
    const end = start + years * yearMs;

    const antardashas = [];
    let sub = start;
    const lordIdx = DASHA_ORDER.indexOf(lord);
    for (let j = 0; j < 9; j++) {
      const subLord = DASHA_ORDER[(lordIdx + j) % 9];
      const subYears = (years * DASHA_YEARS[subLord]) / DASHA_TOTAL_YEARS;
      const subEnd = sub + subYears * yearMs;
      antardashas.push({ lord: subLord, start: new Date(sub).toISOString(), end: new Date(subEnd).toISOString() });
      sub = subEnd;
    }

    mahadashas.push({
      lord, years,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      antardashas,
    });
    cursor = end;
  }

  return {
    system: 'Vimshottari',
    moonNakshatra: nak.name,
    balanceAtBirthYears: firstYears * (1 - nak.fractionElapsed),
    mahadashas,
  };
}
