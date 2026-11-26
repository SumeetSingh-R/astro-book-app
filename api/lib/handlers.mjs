// API handlers. Each takes a web-standard Request and returns a Response.
// `deps` lets tests swap the database and the place dataset.
import { computeChart, matchVedic, matchWestern, dailyHoroscope, dailyHoroscopesAll, ENGINE_VERSION } from '../../engine/src/index.mjs';
import { ApiError, json, errorResponse, requireMethod, bearerToken, readJson, requireUuid } from './http.mjs';
import { searchPlaces } from './places.mjs';

function chartInput(profile) {
  return {
    date: profile.birth_date,
    time: profile.time_unknown || !profile.birth_time ? null : String(profile.birth_time).slice(0, 5),
    timezone: profile.timezone,
    latitude: profile.latitude,
    longitude: profile.longitude,
  };
}

/** Split an engine chart into the two rows stored in `charts` (one per system). */
function toRows(profileId, chart) {
  const { western, vedic, ...meta } = chart;
  return [
    { birth_profile_id: profileId, system: 'western', engine_version: ENGINE_VERSION, data: { meta, western } },
    { birth_profile_id: profileId, system: 'vedic', engine_version: ENGINE_VERSION, data: { meta, vedic } },
  ];
}

function fromRows(rows) {
  const w = rows.find((r) => r.system === 'western');
  const v = rows.find((r) => r.system === 'vedic');
  if (!w || !v) return null;
  return { ...w.data.meta, western: w.data.western, vedic: v.data.vedic };
}

/** Load a profile's chart from cache, or compute and store it. */
async function chartFor(db, profileId, label) {
  const profile = await db.getBirthProfile(profileId);
  if (!profile) throw new ApiError(404, 'profile_not_found', `${label} was not found.`);
  const cached = fromRows(await db.getCharts(profileId, ENGINE_VERSION));
  if (cached) return { profile, chart: cached, cached: true };
  let chart;
  try {
    chart = await computeChart(chartInput(profile));
  } catch (e) {
    throw new ApiError(422, 'invalid_birth_details', `Could not calculate a chart from these birth details: ${e.message}`);
  }
  await db.saveCharts(toRows(profileId, chart));
  return { profile, chart, cached: false };
}

// POST /api/chart  { birthProfileId }
export async function handleChart(req, deps) {
  try {
    requireMethod(req, 'POST');
    const db = deps.createDb(bearerToken(req));
    await db.getUserId();
    const body = await readJson(req);
    const id = requireUuid(body.birthProfileId, 'birthProfileId');
    const { profile, chart, cached } = await chartFor(db, id, 'Birth profile');
    return json({ profile: { id: profile.id, name: profile.name, placeName: profile.place_name }, chart, cached });
  } catch (e) { return errorResponse(e); }
}

// POST /api/chart/preview  { date, time, timezone, latitude, longitude }   (public, nothing is saved)
export async function handlePreview(req) {
  try {
    requireMethod(req, 'POST');
    const body = await readJson(req);
    const input = {
      date: body.date,
      time: body.time == null || body.time === '' ? null : body.time,
      timezone: body.timezone,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
    };
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || +input.date.slice(0, 4) < 1800 || +input.date.slice(0, 4) > 2200) {
      throw new ApiError(400, 'invalid_input', 'date must be YYYY-MM-DD between 1800 and 2200.');
    }
    if (input.time !== null && (typeof input.time !== 'string' || !/^\d{2}:\d{2}$/.test(input.time))) {
      throw new ApiError(400, 'invalid_input', 'time must be HH:MM, or left empty if unknown.');
    }
    let chart;
    try {
      chart = await computeChart(input);
    } catch (e) {
      throw new ApiError(400, 'invalid_input', e.message);
    }
    return json({ chart });
  } catch (e) { return errorResponse(e); }
}

// POST /api/match  { system: 'vedic'|'western', groomProfileId, brideProfileId }   (vedic)
//                  { system: 'western', profileAId, profileBId }                    (western)
export async function handleMatch(req, deps) {
  try {
    requireMethod(req, 'POST');
    const db = deps.createDb(bearerToken(req));
    const userId = await db.getUserId();
    const body = await readJson(req);
    const system = body.system;
    if (system !== 'vedic' && system !== 'western') {
      throw new ApiError(400, 'invalid_input', "system must be 'vedic' or 'western'.");
    }
    const idA = requireUuid(system === 'vedic' ? body.groomProfileId : body.profileAId, system === 'vedic' ? 'groomProfileId' : 'profileAId');
    const idB = requireUuid(system === 'vedic' ? body.brideProfileId : body.profileBId, system === 'vedic' ? 'brideProfileId' : 'profileBId');
    if (idA === idB) throw new ApiError(400, 'invalid_input', 'Choose two different people to match.');

    const a = await chartFor(db, idA, system === 'vedic' ? 'Groom profile' : 'First profile');
    const b = await chartFor(db, idB, system === 'vedic' ? 'Bride profile' : 'Second profile');
    const result = system === 'vedic' ? matchVedic(a.chart, b.chart) : matchWestern(a.chart, b.chart);

    const saved = await db.saveMatch({
      user_id: userId, profile_a: idA, profile_b: idB, system, engine_version: ENGINE_VERSION, data: result,
    });
    return json({
      id: saved.id, createdAt: saved.created_at,
      a: { id: a.profile.id, name: a.profile.name }, b: { id: b.profile.id, name: b.profile.name },
      result,
    });
  } catch (e) { return errorResponse(e); }
}

function todayIn(timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// GET /api/horoscope?system=vedic|western&sign=1..12&date=YYYY-MM-DD   (sign optional: all 12)
export async function handleHoroscope(req) {
  try {
    requireMethod(req, 'GET');
    const url = new URL(req.url);
    const system = url.searchParams.get('system') ?? 'vedic';
    if (system !== 'vedic' && system !== 'western') {
      throw new ApiError(400, 'invalid_input', "system must be 'vedic' or 'western'.");
    }
    const date = url.searchParams.get('date') ?? todayIn('Asia/Kolkata');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m || +m[1] < 1900 || +m[1] > 2100 || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new ApiError(400, 'invalid_input', 'date must be YYYY-MM-DD between 1900 and 2100.');
    }
    const signParam = url.searchParams.get('sign');
    // A given date never changes, so it can be cached by the CDN. "Today" must stay fresh.
    const cache = url.searchParams.has('date')
      ? { 'cache-control': 'public, max-age=3600, s-maxage=86400' }
      : { 'cache-control': 'public, max-age=300' };

    if (signParam == null) {
      const all = await dailyHoroscopesAll(date);
      return json({ date, system, readings: all.filter((r) => r.system === system) }, 200, cache);
    }
    const sign = Number(signParam);
    if (!Number.isInteger(sign) || sign < 1 || sign > 12) {
      throw new ApiError(400, 'invalid_input', 'sign must be a whole number from 1 to 12.');
    }
    return json({ date, system, readings: [await dailyHoroscope(date, system, sign)] }, 200, cache);
  } catch (e) { return errorResponse(e); }
}

// GET /api/places?q=sur&country=IN
export async function handlePlaces(req, deps) {
  try {
    requireMethod(req, 'GET');
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').slice(0, 60);
    const country = url.searchParams.get('country');
    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      throw new ApiError(400, 'invalid_input', 'country must be a two-letter code.');
    }
    const places = searchPlaces(await deps.loadPlaces(), q, { country });
    return json({ places }, 200, { 'cache-control': 'public, max-age=86400' });
  } catch (e) { return errorResponse(e); }
}
