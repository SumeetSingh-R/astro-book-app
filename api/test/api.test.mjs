import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChart, handleMatch, handleHoroscope, handlePlaces } from '../lib/handlers.mjs';
import { ApiError } from '../lib/http.mjs';
import { searchPlaces } from '../lib/places.mjs';
import dataset from '../data/places.generated.mjs';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_OTHER = '99999999-9999-4999-8999-999999999999';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROFILES = {
  [ID_A]: { id: ID_A, user_id: USER, name: 'Person A', birth_date: '1996-02-19', birth_time: '10:00:00', time_unknown: false, place_name: 'Gopalganj, Bihar, India', latitude: 26.47, longitude: 84.44, timezone: 'Asia/Kolkata' },
  [ID_B]: { id: ID_B, user_id: USER, name: 'Person B', birth_date: '1997-08-05', birth_time: null, time_unknown: true, place_name: 'Surat, Gujarat, India', latitude: 21.17, longitude: 72.83, timezone: 'Asia/Kolkata' },
};

/** In-memory stand-in for the database layer. */
function fakeDb({ validToken = 'good' } = {}) {
  const state = { charts: [], matches: [], computeSaves: 0 };
  const createDb = (token) => ({
    async getUserId() {
      if (token !== validToken) throw new ApiError(401, 'not_signed_in', 'Your session has expired. Sign in again.');
      return USER;
    },
    async getBirthProfile(id) { return PROFILES[id] ?? null; },
    async getCharts(pid, version) { return state.charts.filter((c) => c.birth_profile_id === pid && c.engine_version === version); },
    async saveCharts(rows) { state.computeSaves++; state.charts.push(...JSON.parse(JSON.stringify(rows))); },
    async saveMatch(row) { state.matches.push(row); return { id: 'match-1', created_at: '2026-11-26T00:00:00Z' }; },
  });
  return { state, createDb };
}

const post = (path, body, token = 'good') => new Request(`https://example.test${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (path) => new Request(`https://example.test${path}`);

// ---------- /api/chart ----------
test('chart: computes, stores two rows, then serves from cache', async () => {
  const { state, createDb } = fakeDb();
  const r1 = await handleChart(post('/api/chart', { birthProfileId: ID_A }), { createDb });
  assert.equal(r1.status, 200);
  const b1 = await r1.json();
  assert.equal(b1.cached, false);
  assert.equal(b1.chart.western.planets.length, 11);
  assert.equal(b1.chart.vedic.planets.length, 9);
  assert.ok(b1.chart.vedic.lagna);
  assert.deepEqual(state.charts.map((c) => c.system).sort(), ['vedic', 'western']);

  const r2 = await handleChart(post('/api/chart', { birthProfileId: ID_A }), { createDb });
  const b2 = await r2.json();
  assert.equal(b2.cached, true);
  assert.equal(state.computeSaves, 1);
  assert.deepEqual(b2.chart, b1.chart); // cached copy is identical to the computed one
});

test('chart: unknown birth time is handled', async () => {
  const { createDb } = fakeDb();
  const body = await (await handleChart(post('/api/chart', { birthProfileId: ID_B }), { createDb })).json();
  assert.equal(body.chart.timeKnown, false);
  assert.equal(body.chart.vedic.lagna, null);
});

test('chart: auth and input errors', async () => {
  const { createDb } = fakeDb();
  assert.equal((await handleChart(post('/api/chart', { birthProfileId: ID_A }, null), { createDb })).status, 401);
  assert.equal((await handleChart(post('/api/chart', { birthProfileId: ID_A }, 'bad'), { createDb })).status, 401);
  assert.equal((await handleChart(post('/api/chart', { birthProfileId: 'nope' }), { createDb })).status, 400);
  assert.equal((await handleChart(post('/api/chart', '{not json'), { createDb })).status, 400);
  assert.equal((await handleChart(post('/api/chart', { birthProfileId: ID_OTHER }), { createDb })).status, 404);
  assert.equal((await handleChart(get('/api/chart'), { createDb })).status, 405);
  const err = await (await handleChart(post('/api/chart', { birthProfileId: ID_OTHER }), { createDb })).json();
  assert.equal(err.error.code, 'profile_not_found');
});

// ---------- /api/match ----------
test('match (vedic): returns a 36-point result and saves it', async () => {
  const { state, createDb } = fakeDb();
  const res = await handleMatch(post('/api/match', { system: 'vedic', groomProfileId: ID_A, brideProfileId: ID_B }), { createDb });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.max, 36);
  assert.equal(body.result.kootas.length, 8);
  assert.equal(body.a.name, 'Person A');
  assert.equal(state.matches.length, 1);
  assert.equal(state.matches[0].user_id, USER);
  assert.equal(state.matches[0].profile_a, ID_A);
  assert.equal(state.charts.length, 4); // both charts were cached along the way
  assert.equal(body.result.notes.length, 1); // one birth time is unknown
});

test('match (western): synastry', async () => {
  const { createDb } = fakeDb();
  const res = await handleMatch(post('/api/match', { system: 'western', profileAId: ID_A, profileBId: ID_B }), { createDb });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.result.aspects.length > 0);
});

test('match: validation', async () => {
  const { createDb } = fakeDb();
  const bad = async (b, token) => (await handleMatch(post('/api/match', b, token), { createDb })).status;
  assert.equal(await bad({ system: 'chinese', groomProfileId: ID_A, brideProfileId: ID_B }), 400);
  assert.equal(await bad({ system: 'vedic', groomProfileId: ID_A, brideProfileId: ID_A }), 400);
  assert.equal(await bad({ system: 'vedic', groomProfileId: ID_A }), 400);
  assert.equal(await bad({ system: 'vedic', groomProfileId: ID_A, brideProfileId: ID_OTHER }), 404);
  assert.equal(await bad({ system: 'vedic', groomProfileId: ID_A, brideProfileId: ID_B }, null), 401);
});

// ---------- /api/horoscope ----------
test('horoscope: all signs, one sign, defaults and validation', async () => {
  const all = await handleHoroscope(get('/api/horoscope?system=western&date=2026-11-26'));
  assert.equal(all.status, 200);
  assert.match(all.headers.get('cache-control'), /s-maxage=86400/);
  assert.equal((await all.json()).readings.length, 12);

  const one = await (await handleHoroscope(get('/api/horoscope?system=vedic&sign=3&date=2026-11-26'))).json();
  assert.equal(one.readings.length, 1);
  assert.equal(one.readings[0].signName, 'Mithuna');

  const today = await handleHoroscope(get('/api/horoscope'));
  assert.equal(today.status, 200);
  assert.match(today.headers.get('cache-control'), /max-age=300/);
  assert.match((await today.json()).date, /^\d{4}-\d{2}-\d{2}$/);

  for (const q of ['?system=x', '?sign=13', '?sign=abc', '?date=26-11-2026', '?date=2026-13-45', '?date=1800-01-01']) {
    assert.equal((await handleHoroscope(get(`/api/horoscope${q}`))).status, 400, q);
  }
  assert.equal((await handleHoroscope(post('/api/horoscope', {}))).status, 405);
});

// ---------- /api/places ----------
const loadPlaces = async () => dataset;

test('places: finds Indian cities regardless of accents, spacing and case', () => {
  const surat = searchPlaces(dataset, 'surat', { country: 'IN' })[0];
  assert.equal(surat.label, 'Surat, Gujarat, India');
  assert.equal(surat.timezone, 'Asia/Kolkata');
  assert.ok(Math.abs(surat.latitude - 21.2) < 0.2 && Math.abs(surat.longitude - 72.83) < 0.2);
  assert.equal(searchPlaces(dataset, 'DEHRADUN')[0].label, 'Dehra Dun, Uttarakhand, India');
  assert.equal(searchPlaces(dataset, 'gopalganj', { country: 'IN' })[0].state, 'Bihar');
  assert.equal(searchPlaces(dataset, 'Mumbai')[0].state, 'Maharashtra');
});

test('places: state names line up with well-known cities', () => {
  const expected = {
    Patna: 'Bihar', Bengaluru: 'Karnataka', Chennai: 'Tamil Nadu', Kolkata: 'West Bengal', Hyderabad: 'Telangana',
    Lucknow: 'Uttar Pradesh', Jaipur: 'Rajasthan', Bhopal: 'Madhya Pradesh', Ranchi: 'Jharkhand', Panaji: 'Goa',
    Thiruvananthapuram: 'Kerala', Shimla: 'Himachal Pradesh', Guwahati: 'Assam', Bhubaneshwar: 'Odisha',
    Amritsar: 'Punjab', Gangtok: 'Sikkim', Imphal: 'Manipur', Shillong: 'Meghalaya', Aizawl: 'Mizoram',
    Kohima: 'Nagaland', Agartala: 'Tripura', Leh: 'Ladakh', Visakhapatnam: 'Andhra Pradesh', Gurgaon: 'Haryana',
  };
  for (const [city, state] of Object.entries(expected)) {
    const hit = searchPlaces(dataset, city, { country: 'IN' })[0];
    assert.ok(hit, `no result for ${city}`);
    assert.equal(hit.state, state, city);
  }
});

test('places: world cities carry the right timezone; short queries return nothing', () => {
  assert.equal(searchPlaces(dataset, 'london', { country: 'GB' })[0].timezone, 'Europe/London');
  assert.equal(searchPlaces(dataset, 'new york')[0].timezone, 'America/New_York');
  assert.equal(searchPlaces(dataset, 'dubai')[0].countryName, 'United Arab Emirates');
  assert.deepEqual(searchPlaces(dataset, 's'), []);
  assert.ok(searchPlaces(dataset, 'san', { limit: 100 }).length <= 25);
});

test('places endpoint', async () => {
  const res = await handlePlaces(get('/api/places?q=rajkot&country=in'), { loadPlaces });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.places[0].label, 'Rajkot, Gujarat, India');
  assert.equal((await handlePlaces(get('/api/places?q=x&country=india'), { loadPlaces })).status, 400);
  assert.deepEqual((await (await handlePlaces(get('/api/places'), { loadPlaces })).json()).places, []);
});
