export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
// ︎ asks for the text (not emoji) form of each symbol.
export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((g) => g + '︎');
export const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
  Uranus: '♅', Neptune: '♆', Pluto: '♇', 'North Node': '☊',
};
export const GRAHA_ABBR = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };

/** 12.5 -> 12°30′ */
export function dms(deg) {
  let d = Math.floor(deg);
  let m = Math.round((deg - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${d}°${String(m).padStart(2, '0')}′`;
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-IN', opts);
}

export function formatBirth(profile) {
  const date = new Date(`${profile.birth_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  let time = 'time not known';
  if (!profile.time_unknown && profile.birth_time) {
    const [h, m] = String(profile.birth_time).split(':');
    time = `${Number(h) % 12 === 0 ? 12 : Number(h) % 12}:${m} ${Number(h) >= 12 ? 'PM' : 'AM'}`;
  }
  return `${date}, ${time}`;
}

export function todayISO(timeZone = 'Asia/Kolkata') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
