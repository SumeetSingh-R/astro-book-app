import test from 'node:test';
import assert from 'node:assert/strict';
import { handleI18n, handleHoroscope } from '../lib/handlers.mjs';
import { createTranslator } from '../lib/translate.mjs';
import { memoryStore } from '../lib/store.mjs';
import { loadCatalog } from '../lib/i18n.mjs';
import { LANGUAGES, languageOf } from '../../config/languages.mjs';
import { chartReadingPrompt } from '../lib/prompts.mjs';

/** A stand-in model that "translates" by wrapping each string, and counts its calls. */
function fakeAi({ configured = true, reply } = {}) {
  const calls = [];
  return {
    calls,
    configured: () => configured,
    async complete(prompt) {
      calls.push(prompt);
      const list = JSON.parse(prompt.messages[0].content);
      return { text: reply ? reply(list) : JSON.stringify(list.map((s) => `«${s}»`)) };
    },
  };
}
const get = (path) => new Request(`http://localhost${path}`);

test('translator: translates once, then serves from the store', async () => {
  const ai = fakeAi();
  const store = memoryStore(new Map());
  const tr = createTranslator({ ai, store });
  const first = await tr.translate('gu', ['Save', 'Hello {name}', 'Save']);
  assert.deepEqual(first.strings, { Save: '«Save»', 'Hello {name}': '«Hello {name}»' });
  assert.equal(first.complete, true);
  assert.equal(ai.calls.length, 1);
  assert.match(ai.calls[0].system, /Gujarati/);

  const again = await createTranslator({ ai, store }).translate('gu', ['Save']);
  assert.equal(again.strings.Save, '«Save»');
  assert.equal(ai.calls.length, 1, 'a known string is not sent to the model again');
});

test('translator: a reply that drops a placeholder or miscounts is not kept', async () => {
  const store = memoryStore(new Map());
  const dropped = createTranslator({ ai: fakeAi({ reply: (l) => JSON.stringify(l.map(() => 'no placeholder')) }), store });
  const a = await dropped.translate('ta', ['Hello {name}', 'Plain']);
  assert.deepEqual(a.strings, { Plain: 'no placeholder' });
  assert.equal(a.complete, false);

  const short = createTranslator({ ai: fakeAi({ reply: () => '["only one"]' }), store: memoryStore(new Map()) });
  const b = await short.translate('ta', ['One', 'Two']);
  assert.deepEqual(b.strings, {});
});

test('translator: English and missing AI need no work; bundled translations win', async () => {
  const ai = fakeAi({ configured: false });
  const tr = createTranslator({ ai, store: memoryStore(new Map()) });
  assert.deepEqual(await tr.translate('en', ['Save']), { strings: {}, complete: true });
  const r = await tr.translate('hi', ['Save', 'Other'], { known: { Save: 'सेव करें' } });
  assert.deepEqual(r.strings, { Save: 'सेव करें' });
  assert.equal(r.complete, false);
  assert.equal(ai.calls.length, 0);
});

test('translator.localize: translates only the chosen fields, in place', async () => {
  const tr = createTranslator({ ai: fakeAi(), store: memoryStore(new Map()) });
  const payload = [{ signName: 'Mesha', content: { title: 'A day', focus: ['Energy', 'Mood'], tone: 'steady', moon: { sign: 'Tula' } } }];
  assert.equal(await tr.localize('bn', payload, ['title', 'text', 'focus']), true);
  assert.deepEqual(payload[0].content, { title: '«A day»', focus: ['«Energy»', '«Mood»'], tone: 'steady', moon: { sign: 'Tula' } });
  assert.equal(payload[0].signName, 'Mesha');
});

test('GET /api/i18n: Hindi comes complete from the bundled file, with no AI call', async () => {
  const res = await handleI18n(get('/api/i18n?lang=hi'), { loadCatalog });
  assert.equal(res.status, 200);
  const body = await res.json();
  const { catalog } = await loadCatalog('hi');
  assert.equal(body.complete, true);
  assert.equal(Object.keys(body.strings).length, catalog.length, 'every catalogue string has a Hindi translation');
  assert.equal(body.strings['My charts'], 'मेरी कुंडलियाँ');
  assert.match(res.headers.get('cache-control'), /s-maxage/);
});

test('GET /api/i18n: another language is filled by the translator and kept', async () => {
  const ai = fakeAi();
  const store = memoryStore(new Map());
  const translator = async () => createTranslator({ ai, store });
  const one = await (await handleI18n(get('/api/i18n?lang=gu'), { loadCatalog, translator })).json();
  assert.equal(one.complete, true);
  assert.equal(one.strings.Today, '«Today»');
  const callsAfterFirst = ai.calls.length;
  assert.ok(callsAfterFirst > 1, 'the catalogue is sent in several small requests');
  const two = await (await handleI18n(get('/api/i18n?lang=gu'), { loadCatalog, translator: async () => createTranslator({ ai, store }) })).json();
  assert.equal(two.strings.Today, '«Today»');
  assert.equal(ai.calls.length, callsAfterFirst, 'the second visitor costs nothing');
});

test('GET /api/i18n: without AI an unseeded language is incomplete and not cached; bad codes are refused', async () => {
  const res = await handleI18n(get('/api/i18n?lang=ta'), { loadCatalog });
  const body = await res.json();
  assert.equal(body.complete, false);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await handleI18n(get('/api/i18n?lang=xx'), { loadCatalog })).status, 400);
  assert.equal((await handleI18n(get('/api/i18n?lang=en'), { loadCatalog })).status, 400);
});

test('GET /api/horoscope: lang translates the reading text and leaves names and structure alone', async () => {
  const translator = async () => createTranslator({ ai: fakeAi(), store: memoryStore(new Map()) });
  const en = await (await handleHoroscope(get('/api/horoscope?system=vedic&sign=3&date=2026-11-27'))).json();
  const gu = await (await handleHoroscope(get('/api/horoscope?system=vedic&sign=3&date=2026-11-27&lang=gu'), { translator })).json();
  assert.equal(gu.language, 'gu');
  assert.equal(gu.readings[0].content.title, `«${en.readings[0].content.title}»`);
  assert.equal(gu.readings[0].signName, en.readings[0].signName);
  assert.equal(gu.readings[0].content.tone, en.readings[0].content.tone);
  // No translator: the reading stays English and says so.
  const plain = await (await handleHoroscope(get('/api/horoscope?system=vedic&sign=3&date=2026-11-27&lang=gu'))).json();
  assert.equal(plain.language, 'en');
});

test('languages: ten are offered, unknown codes fall back to English, and prompts name the language', () => {
  assert.equal(LANGUAGES.length, 10);
  assert.equal(languageOf('te'), 'te');
  assert.equal(languageOf('xx'), 'en');
  assert.match(chartReadingPrompt({ language: 'ta', factsText: 'x' }).system, /Write in Tamil, in Tamil script/);
  assert.match(chartReadingPrompt({ language: 'en', factsText: 'x' }).system, /Write in English\./);
});
