// Place search over the generated dataset. Pure functions; the dataset is passed in.

// GeoNames admin1 codes for India -> state / union territory names.
const IN_STATES = {
  '01': 'Andaman and Nicobar Islands', '02': 'Andhra Pradesh', '03': 'Assam', '05': 'Chandigarh',
  '06': 'Dadra and Nagar Haveli', '07': 'Delhi', '09': 'Gujarat', '10': 'Haryana',
  '11': 'Himachal Pradesh', '12': 'Jammu and Kashmir', '13': 'Kerala', '14': 'Lakshadweep',
  '16': 'Maharashtra', '17': 'Manipur', '18': 'Meghalaya', '19': 'Karnataka', '20': 'Nagaland',
  '21': 'Odisha', '22': 'Puducherry', '23': 'Punjab', '24': 'Rajasthan', '25': 'Tamil Nadu',
  '26': 'Tripura', '28': 'West Bengal', '29': 'Sikkim', '30': 'Arunachal Pradesh', '31': 'Mizoram',
  '32': 'Daman and Diu', '33': 'Goa', '34': 'Bihar', '35': 'Madhya Pradesh', '36': 'Uttar Pradesh',
  '37': 'Chhattisgarh', '38': 'Jharkhand', '39': 'Uttarakhand', '40': 'Telangana', '41': 'Ladakh',
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-'.]/g, '');

let indexCache = null;
function indexOf(dataset) {
  if (!indexCache || indexCache.dataset !== dataset) {
    indexCache = { dataset, keys: dataset.rows.map((r) => key(r[0])) };
  }
  return indexCache.keys;
}

function toPlace(row, tz) {
  const [name, country, admin, latitude, longitude, population, tzIdx] = row;
  let countryName = country;
  try { countryName = countryNames.of(country) ?? country; } catch { /* keep code */ }
  const state = country === 'IN' ? IN_STATES[admin] ?? null : null;
  return {
    name, state, country, countryName,
    label: [name, state, countryName].filter(Boolean).join(', '),
    latitude, longitude, timezone: tz[tzIdx], population,
  };
}

/**
 * Search places by name. Prefix matches come first, then "contains" matches; within each,
 * the most populous first (the dataset is pre-sorted by population).
 * @param {{tz:string[], rows:any[][]}} dataset
 * @param {string} query
 * @param {{country?:string, limit?:number}} [opts]
 */
export function searchPlaces(dataset, query, opts = {}) {
  const q = key(String(query ?? ''));
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const country = opts.country ? String(opts.country).toUpperCase() : null;
  const keys = indexOf(dataset);
  const prefix = [];
  const contains = [];
  for (let i = 0; i < keys.length; i++) {
    if (country && dataset.rows[i][1] !== country) continue;
    const k = keys[i];
    if (k.startsWith(q)) {
      prefix.push(i);
      if (prefix.length >= limit) break;
    } else if (contains.length < limit && q.length >= 3 && k.includes(q)) {
      contains.push(i);
    }
  }
  return [...prefix, ...contains].slice(0, limit).map((i) => toPlace(dataset.rows[i], dataset.tz));
}
