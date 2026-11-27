// API handlers. Each takes a web-standard Request and returns a Response.
// `deps` lets tests swap the database and the place dataset.
import {
  computeChart, matchVedic, matchWestern, dailyHoroscope, dailyHoroscopesAll, ENGINE_VERSION,
  chartFacts, factsToText, detectTopic, topicWindows, windowsToText, personalDay, dayToText,
} from '../../engine/src/index.mjs';
import { ruleChartReading } from '../../engine/src/readingText.mjs';
import { ApiError, json, errorResponse, requireMethod, bearerToken, readJson, requireUuid } from './http.mjs';
import { searchPlaces } from './places.mjs';
import { languageOf, LANGUAGE_CODES } from '../../config/languages.mjs';
import { chartReadingPrompt, dailyReadingPrompt, askPrompt, parseChartReading, parseDailyReading, tidy } from './prompts.mjs';

// Daily allowances per signed-in person. Readings are stored, so they are only counted when first written.
export const ASK_LIMIT = 10;
export const READING_LIMIT = 30;

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
  // Independent lookups run together: each one is a round trip to the database.
  const [profile, rows] = await Promise.all([db.getBirthProfile(profileId), db.getCharts(profileId, ENGINE_VERSION)]);
  if (!profile) throw new ApiError(404, 'profile_not_found', `${label} was not found.`);
  const cached = fromRows(rows);
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
    const language = languageOf(body.language);
    let shown = result;
    if (language !== 'en') {
      const translator = await translatorOf(deps);
      if (translator) { shown = structuredClone(result); await translator.localize(language, shown, ['reason', 'cancellations', 'notes', 'summary']); }
    }
    return json({
      id: saved.id, createdAt: saved.created_at,
      a: { id: a.profile.id, name: a.profile.name }, b: { id: b.profile.id, name: b.profile.name },
      result: shown,
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
export async function handleHoroscope(req, deps = {}) {
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
    const lang = languageOf(url.searchParams.get('lang'));
    let readings;
    if (signParam == null) {
      readings = (await dailyHoroscopesAll(date)).filter((r) => r.system === system);
    } else {
      const sign = Number(signParam);
      if (!Number.isInteger(sign) || sign < 1 || sign > 12) {
        throw new ApiError(400, 'invalid_input', 'sign must be a whole number from 1 to 12.');
      }
      readings = [await dailyHoroscope(date, system, sign)];
    }
    let translated = true;
    if (lang !== 'en') {
      const translator = await translatorOf(deps);
      translated = translator ? await translator.localize(lang, readings, ['title', 'text', 'focus', 'highlights']) : false;
    }
    // A given date never changes, so it can be cached by the CDN. "Today" must stay fresh,
    // and a reading still waiting for its translation must be asked for again.
    const cache = !translated ? { 'cache-control': 'no-store' }
      : url.searchParams.has('date') ? { 'cache-control': 'public, max-age=3600, s-maxage=86400' }
        : { 'cache-control': 'public, max-age=300' };
    return json({ date, system, language: translated ? lang : 'en', readings }, 200, cache);
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

/** The translator, when the function was given one. Without it everything simply stays in English. */
async function translatorOf(deps) {
  try { return (await deps.translator?.()) ?? null; } catch (e) { console.error('Translator unavailable:', e?.message ?? e); return null; }
}

// GET /api/i18n?lang=gu   (public)
// Every piece of interface text in one language. Bundled translations come first; anything missing is
// translated once by the AI model and kept, so the next visitor gets it from storage.
export async function handleI18n(req, deps) {
  try {
    requireMethod(req, 'GET');
    const lang = new URL(req.url).searchParams.get('lang');
    if (!LANGUAGE_CODES.includes(lang) || lang === 'en') throw new ApiError(400, 'invalid_input', 'lang must be one of the supported languages.');
    const { catalog, seed } = await deps.loadCatalog(lang);
    const translator = await translatorOf(deps);
    let strings = {};
    let complete = false;
    if (translator) {
      ({ strings, complete } = await translator.translate(lang, catalog, { space: 'ui', known: seed, budgetMs: deps.budgetMs ?? 20000 }));
    } else {
      for (const s of catalog) if (seed[s]) strings[s] = seed[s];
      complete = catalog.every((s) => seed[s] || !/\p{L}/u.test(s));
    }
    // A finished language can sit in the CDN and the browser; an unfinished one is asked for again.
    const cache = complete ? { 'cache-control': 'public, max-age=3600, s-maxage=86400' } : { 'cache-control': 'no-store' };
    return json({ lang, complete, strings }, 200, cache);
  } catch (e) { return errorResponse(e); }
}

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Ask the AI model for a stored kind of reading, or return null so the caller can fall back to fixed text.
 * A failure here is never shown to the person: the page still gets a reading.
 */
async function writeReading(db, ai, prompt, parse) {
  if (!ai.configured()) return null;
  try {
    if ((await db.consumeQuota('reading', READING_LIMIT)) < 0) return null;
    const out = await ai.complete(prompt);
    const parsed = parse(out.text);
    if (!parsed) console.error('AI reading could not be parsed.');
    return parsed ? { parsed, model: out.model } : null;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    console.error('AI reading failed:', e.code);
    return null;
  }
}

// POST /api/reading  { birthProfileId, language }
// The chart in plain words. Written once per chart and language by the AI model, then served from storage.
export async function handleReading(req, deps) {
  try {
    requireMethod(req, 'POST');
    const db = deps.createDb(bearerToken(req));
    const body = await readJson(req);
    const id = requireUuid(body.birthProfileId, 'birthProfileId');
    const language = languageOf(body.language);
    const key = { birthProfileId: id, kind: 'chart', language, forDate: null, engineVersion: ENGINE_VERSION };
    const [, { chart }, stored] = await Promise.all([db.getUserId(), chartFor(db, id, 'Birth profile'), db.getReading(key)]);
    if (stored) return json({ reading: { ...stored.content, source: 'ai', language } });

    const nowMs = deps.now?.() ?? Date.now();
    const facts = chartFacts(chart, nowMs);
    const written = await writeReading(db, deps.ai, chartReadingPrompt({ language, factsText: factsToText(facts) }), parseChartReading);
    if (written) {
      await db.saveReading({ birth_profile_id: id, kind: 'chart', language, for_date: null, engine_version: ENGINE_VERSION, model: written.model, content: written.parsed });
      return json({ reading: { ...written.parsed, source: 'ai', language } });
    }
    const fallback = ruleChartReading(facts);
    const translator = language === 'en' ? null : await translatorOf(deps);
    const done = translator ? await translator.localize(language, fallback, ['summary', 'text', 'why'], { budgetMs: 12000 }) : false;
    return json({ reading: { ...fallback, source: 'rules', language: done ? language : 'en' } });
  } catch (e) { return errorResponse(e); }
}

// POST /api/today  { birthProfileId, language, date?, timezone? }
// Today read against one person's own chart.
export async function handleToday(req, deps) {
  try {
    requireMethod(req, 'POST');
    const db = deps.createDb(bearerToken(req));
    const body = await readJson(req);
    const id = requireUuid(body.birthProfileId, 'birthProfileId');
    const language = languageOf(body.language);

    const nowMs = deps.now?.() ?? Date.now();
    const today = new Date(nowMs + 5.5 * 3600000).toISOString().slice(0, 10); // India date
    const date = body.date ?? today;
    // "Today" differs by a day around the world, so allow one day either side and nothing more.
    if (typeof date !== 'string' || ![shiftDate(today, -1), today, shiftDate(today, 1)].includes(date)) {
      throw new ApiError(400, 'invalid_input', 'date must be today\'s date.');
    }
    let timezone = 'Asia/Kolkata';
    if (typeof body.timezone === 'string' && body.timezone.length < 64) {
      try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); timezone = body.timezone; } catch { /* keep the default */ }
    }

    const key = { birthProfileId: id, kind: 'daily', language, forDate: date, engineVersion: ENGINE_VERSION };
    const [, { profile, chart }, stored] = await Promise.all([db.getUserId(), chartFor(db, id, 'Birth profile'), db.getReading(key)]);
    const { ruleReading, ...day } = await personalDay(chart, date, { timezone });
    // The model is always given the day in English; the person sees it in their own language.
    const dayText = dayToText(day);
    const translator = language === 'en' ? null : await translatorOf(deps);
    const shownDay = translator ? structuredClone(day) : day;
    if (translator) await translator.localize(language, shownDay, ['topics', 'title', 'focus', 'meaning', 'note', 'phase'], { budgetMs: 6000 });
    const head = { date, profile: { id: profile.id, name: profile.name }, day: shownDay };

    if (stored) return json({ ...head, reading: { ...stored.content, source: 'ai', language } });

    const prompt = dailyReadingPrompt({ language, factsText: factsToText(chartFacts(chart, nowMs)), dayText });
    const written = await writeReading(db, deps.ai, prompt, parseDailyReading);
    if (written) {
      const content = { ...written.parsed, title: written.parsed.title ?? ruleReading.title };
      await db.saveReading({ birth_profile_id: id, kind: 'daily', language, for_date: date, engine_version: ENGINE_VERSION, model: written.model, content });
      return json({ ...head, reading: { ...content, source: 'ai', language } });
    }
    const done = translator ? await translator.localize(language, ruleReading, ['title', 'text', 'goodFor', 'takeCare'], { budgetMs: 8000 }) : false;
    return json({ ...head, reading: { ...ruleReading, source: 'rules', language: done ? language : 'en' } });
  } catch (e) { return errorResponse(e); }
}

// POST /api/ask  { birthProfileId, question, language }
// A question about one's own chart, answered by the AI model from engine-calculated facts only.
export async function handleAsk(req, deps) {
  try {
    requireMethod(req, 'POST');
    const db = deps.createDb(bearerToken(req));
    const userId = await db.getUserId();
    const body = await readJson(req);
    const id = requireUuid(body.birthProfileId, 'birthProfileId');
    const language = languageOf(body.language);
    const question = (typeof body.question === 'string' ? body.question : '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (question.length < 3) throw new ApiError(400, 'invalid_input', 'Type a question about your chart.');
    if (question.length > 500) throw new ApiError(400, 'invalid_input', 'Keep the question under 500 characters.');
    if (!deps.ai.configured()) {
      throw new ApiError(503, 'ai_not_configured', 'Answers from your chart are not switched on yet.');
    }

    const { chart } = await chartFor(db, id, 'Birth profile');
    const remaining = await db.consumeQuota('ask', ASK_LIMIT);
    if (remaining < 0) {
      throw new ApiError(429, 'daily_limit', `You have used today's ${ASK_LIMIT} questions. They reset at midnight, India time.`);
    }

    const nowMs = deps.now?.() ?? Date.now();
    const history = await db.getRecentMessages(id, 6);
    // A follow-up such as "and after that?" carries on the topic of the question before it.
    const topic = detectTopic(question)
      ?? history.filter((m) => m.role === 'user').map((m) => detectTopic(m.content)).filter(Boolean).pop()
      ?? null;
    const timingText = topic
      ? windowsToText(await topicWindows(chart, topic, { nowMs }))
      : 'No topic-specific timing was calculated for this question.';

    const out = await deps.ai.complete(askPrompt({
      language,
      factsText: factsToText(chartFacts(chart, nowMs)),
      timingText,
      question,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      today: new Date(nowMs + 5.5 * 3600000).toISOString().slice(0, 10),
    }));
    const answer = tidy(out.text);

    await db.saveMessages([
      { user_id: userId, birth_profile_id: id, role: 'user', content: question, language, created_at: new Date(nowMs).toISOString() },
      { user_id: userId, birth_profile_id: id, role: 'assistant', content: answer.slice(0, 12000), language, created_at: new Date(nowMs + 1).toISOString() },
    ]);
    return json({ answer, remaining, limit: ASK_LIMIT, topic });
  } catch (e) { return errorResponse(e); }
}
