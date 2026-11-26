import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import { computeChart } from '../src/chart.mjs';
import { localToUtc, julianDay } from '../src/time.mjs';
import { nakshatraOf, navamsaSignIndex, vimshottari } from '../src/vedic.mjs';
import { DAYS_PER_YEAR } from '../src/constants.mjs';

const diff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// ---------- Time conversion ----------
test('local time to UTC: India, fixed +5:30', () => {
  const r = localToUtc('1996-02-19', '10:00', 'Asia/Kolkata');
  assert.equal(new Date(r.utcMs).toISOString(), '1996-02-19T04:30:00.000Z');
  assert.equal(r.offsetMinutes, 330);
});

test('local time to UTC: daylight saving (New York summer and winter)', () => {
  assert.equal(new Date(localToUtc('1990-07-04', '12:00', 'America/New_York').utcMs).toISOString(), '1990-07-04T16:00:00.000Z');
  assert.equal(new Date(localToUtc('1990-01-15', '12:00', 'America/New_York').utcMs).toISOString(), '1990-01-15T17:00:00.000Z');
});

test('local time to UTC: London summer time, and wartime India (+6:30)', () => {
  assert.equal(new Date(localToUtc('1985-06-01', '09:00', 'Europe/London').utcMs).toISOString(), '1985-06-01T08:00:00.000Z');
  assert.equal(localToUtc('1943-06-01', '12:00', 'Asia/Kolkata').offsetMinutes, 390);
});

test('Julian Day of J2000 epoch', () => {
  assert.equal(julianDay(Date.UTC(2000, 0, 1, 12)), 2451545.0);
});

test('invalid inputs are rejected', async () => {
  assert.throws(() => localToUtc('1996-2-19', '10:00', 'Asia/Kolkata'));
  assert.throws(() => localToUtc('1996-02-19', '10:00', 'Mars/Olympus'));
  await assert.rejects(computeChart({ date: '1996-02-19', time: '10:00', timezone: 'Asia/Kolkata', latitude: 95, longitude: 0 }));
});

// ---------- Planet positions vs an independent library ----------
const CASES = [
  { date: '1996-02-19', time: '10:00', timezone: 'Asia/Kolkata', latitude: 26.47, longitude: 84.44 },
  { date: '1969-07-20', time: '20:17', timezone: 'UTC', latitude: 0, longitude: 0 },
  { date: '2000-01-01', time: '12:00', timezone: 'UTC', latitude: 51.48, longitude: 0 },
  { date: '1947-08-15', time: '00:00', timezone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 },
  { date: '2026-11-26', time: '10:27', timezone: 'Asia/Kolkata', latitude: 21.17, longitude: 72.83 },
  { date: '1985-06-01', time: '09:00', timezone: 'Europe/London', latitude: 51.5, longitude: -0.12 },
  { date: '1910-03-03', time: '03:15', timezone: 'America/New_York', latitude: 40.71, longitude: -74.0 },
];

const BODY = {
  Mercury: Astronomy.Body.Mercury, Venus: Astronomy.Body.Venus, Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter, Saturn: Astronomy.Body.Saturn, Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune, Pluto: Astronomy.Body.Pluto,
};

for (const c of CASES) {
  test(`tropical longitudes match independent ephemeris: ${c.date} ${c.time} ${c.timezone}`, async () => {
    const chart = await computeChart(c);
    const when = new Date(chart.utc);
    const got = Object.fromEntries(chart.western.planets.map((p) => [p.name, p.longitude]));

    const sun = Astronomy.SunPosition(when).elon;
    assert.ok(diff(got.Sun, sun) < 0.02, `Sun ${got.Sun} vs ${sun}`);

    const moon = Astronomy.EclipticGeoMoon(when).lon;
    assert.ok(diff(got.Moon, moon) < 0.02, `Moon ${got.Moon} vs ${moon}`);

    for (const [name, body] of Object.entries(BODY)) {
      const vec = Astronomy.GeoVector(body, when, true);
      const ref = Astronomy.Ecliptic(vec).elon;
      assert.ok(diff(got[name], ref) < 0.02, `${name} ${got[name]} vs ${ref}`);
    }
  });

  test(`ascendant matches independent formula: ${c.date} ${c.time} ${c.timezone}`, async () => {
    const chart = await computeChart(c);
    const jd = chart.julianDay;
    const T = (jd - 2451545.0) / 36525;
    const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
    const rad = Math.PI / 180;
    const ramc = (((gmst + c.longitude) % 360) + 360) % 360 * rad;
    const eps = (23.4392911 - 0.0130042 * T) * rad;
    const lat = c.latitude * rad;
    let asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))) / rad;
    asc = ((asc % 360) + 360) % 360;
    assert.ok(diff(chart.western.ascendant.longitude, asc) < 0.05, `Asc ${chart.western.ascendant.longitude} vs ${asc}`);
  });

  test(`vedic chart is internally consistent: ${c.date} ${c.time} ${c.timezone}`, async () => {
    const chart = await computeChart(c);
    const w = Object.fromEntries(chart.western.planets.map((p) => [p.name, p.longitude]));
    const v = Object.fromEntries(chart.vedic.planets.map((p) => [p.name, p]));
    const ay = chart.vedic.ayanamsa.value;
    // sidereal = tropical - ayanamsa
    for (const name of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
      assert.ok(diff(v[name].longitude, w[name] - ay) < 0.01, `${name} sidereal offset`);
    }
    assert.ok(diff(chart.vedic.lagna.longitude, chart.western.ascendant.longitude - ay) < 0.01, 'lagna offset');
    // Ketu opposite Rahu; lagna is in house 1 sign; houses are 1..12
    assert.ok(diff(v.Ketu.longitude, v.Rahu.longitude + 180) < 1e-9);
    for (const p of chart.vedic.planets) assert.ok(p.house >= 1 && p.house <= 12);
    // Sun and Moon never retrograde
    assert.equal(v.Sun.retrograde, false);
    assert.equal(v.Moon.retrograde, false);
  });
}

test('Lahiri ayanamsa at J2000 is 23°51\'', async () => {
  const chart = await computeChart({ date: '2000-01-01', time: '12:00', timezone: 'UTC', latitude: 0, longitude: 0 });
  assert.ok(Math.abs(chart.vedic.ayanamsa.value - 23.857) < 0.005, String(chart.vedic.ayanamsa.value));
});

// ---------- Nakshatra, navamsa, dasha rules ----------
test('nakshatra boundaries, padas and lords', () => {
  assert.deepEqual([nakshatraOf(0).name, nakshatraOf(0).pada, nakshatraOf(0).lord], ['Ashwini', 1, 'Ketu']);
  assert.equal(nakshatraOf(13.3334).name, 'Bharani');
  assert.equal(nakshatraOf(13.3334).lord, 'Venus');
  assert.equal(nakshatraOf(40.0).name, 'Rohini');
  assert.equal(nakshatraOf(40.0).lord, 'Moon');
  assert.equal(nakshatraOf(359.99).name, 'Revati');
  assert.equal(nakshatraOf(359.99).pada, 4);
  assert.equal(nakshatraOf(120.0).name, 'Magha');
  assert.equal(nakshatraOf(3.34).pada, 2);
});

test('navamsa starts: Aries->Aries, Taurus->Capricorn, Gemini->Libra, Cancer->Cancer', () => {
  assert.equal(navamsaSignIndex(0.1), 0);
  assert.equal(navamsaSignIndex(30.1), 9);
  assert.equal(navamsaSignIndex(60.1), 6);
  assert.equal(navamsaSignIndex(90.1), 3);
  assert.equal(navamsaSignIndex(3.4), 1);
});

test('vimshottari: Moon at 0° Aries gives a full 7-year Ketu period from birth', () => {
  const birth = Date.UTC(2000, 0, 1);
  const d = vimshottari(0, birth);
  assert.equal(d.mahadashas[0].lord, 'Ketu');
  assert.equal(d.mahadashas[0].start, new Date(birth).toISOString());
  assert.ok(Math.abs(d.balanceAtBirthYears - 7) < 1e-9);
  assert.deepEqual(d.mahadashas.map((m) => m.lord), ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']);
  const total = (Date.parse(d.mahadashas[8].end) - Date.parse(d.mahadashas[0].start)) / (DAYS_PER_YEAR * 86400000);
  assert.ok(Math.abs(total - 120) < 1e-6);
});

test('vimshottari: halfway through Rohini leaves 5 of 10 Moon years; antardashas fill each period', () => {
  const birth = Date.UTC(1990, 5, 15);
  const d = vimshottari(40 + 360 / 27 / 2, birth);
  assert.equal(d.mahadashas[0].lord, 'Moon');
  assert.ok(Math.abs(d.balanceAtBirthYears - 5) < 1e-9);
  for (const m of d.mahadashas) {
    assert.equal(m.antardashas.length, 9);
    assert.equal(m.antardashas[0].lord, m.lord);
    assert.equal(m.antardashas[0].start, m.start);
    assert.ok(Math.abs(Date.parse(m.antardashas[8].end) - Date.parse(m.end)) < 1000);
  }
});

test('unknown birth time: no ascendant, houses or lagna, and a note is returned', async () => {
  const chart = await computeChart({ date: '1996-02-19', time: null, timezone: 'Asia/Kolkata', latitude: 26.47, longitude: 84.44 });
  assert.equal(chart.timeKnown, false);
  assert.equal(chart.western.ascendant, null);
  assert.equal(chart.western.houses, null);
  assert.equal(chart.vedic.lagna, null);
  assert.equal(chart.notes.length, 1);
  assert.ok(chart.vedic.planets.every((p) => p.house === null));
});
