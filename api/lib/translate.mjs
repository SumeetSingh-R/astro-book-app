// Translation of the app's own text. Every string is translated once by the AI model and then kept
// in the store, so later visitors get it straight from there. Only text the app itself wrote is ever
// sent here (the interface catalogue and engine-written sentences), never text typed by a visitor.
import { languageInfo } from '../../config/languages.mjs';

const CHUNK = 30;        // strings per request to the model
const PARALLEL = 4;      // requests at a time
const WARM_FOR = 5 * 60 * 1000;
const warm = new Map();  // dictionaries already read by this server instance

const placeholders = (s) => (s.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort().join(',');
const translatable = (s) => typeof s === 'string' && /\p{L}/u.test(s);

function systemPrompt(lang) {
  const { name, native, script } = languageInfo(lang);
  return `You translate text for Astro Book, a Vedic astrology (Jyotish) app for young Indian users, from English into ${name} (${native}).

You receive a JSON array of English strings. Reply with only a JSON array of strings: one translation per input string, in the same order, with the same number of items. No notes, no code fences.

Rules
- Natural, warm, everyday ${name}, the way young people speak and write it today. Not stiff, bookish or heavily Sanskritised. English words people really use in daily life (profile, email, chat, match, sign in) may stay, written in ${script} script.
- Write in ${script} script.
- Keep these exactly as they are: "Astro Book", "Google", "Claude", "AI", "Swiss Ephemeris", "GeoNames", email addresses and web addresses.
- Keep every placeholder in curly braces, such as {name} or {0}, exactly as written, placed where the ${name} sentence needs it.
- Use the usual ${name} names for the rashis, grahas and nakshatras, and the usual Jyotish words (kundli, lagna, dasha, guna, Manglik).
- Keep the meaning and the length close to the original. Keep a trailing colon or ellipsis. Never use an em dash.
- Astrology is described as tendencies, never as certain outcomes. Do not make a sentence sound more certain or more frightening than the English.`;
}

function parseArray(text, expected) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const list = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(list) && list.length === expected ? list : null;
  } catch { return null; }
}

export function createTranslator({ ai, store, now = Date.now }) {
  async function load(space, lang) {
    const key = `${space}/${lang}`;
    const hit = warm.get(key);
    if (hit && hit.store === store && now() - hit.at < WARM_FOR) return hit.dict;
    let dict = {};
    try { dict = (await store.get(key)) ?? {}; } catch (e) { console.error('Translation store could not be read:', e?.message ?? e); }
    warm.set(key, { dict, at: now(), store });
    return dict;
  }

  async function chunk(lang, texts) {
    try {
      const out = await ai.complete({ system: systemPrompt(lang), messages: [{ role: 'user', content: JSON.stringify(texts) }], maxTokens: 6000 });
      const list = parseArray(out.text, texts.length);
      if (!list) { console.error('A translation reply could not be read.'); return {}; }
      const done = {};
      texts.forEach((source, i) => {
        const t = typeof list[i] === 'string' ? list[i].trim() : '';
        // A translation that lost or invented a placeholder would break the sentence it is used in.
        if (t && placeholders(t) === placeholders(source)) done[source] = t;
      });
      return done;
    } catch (e) {
      console.error('Translation failed:', e?.code ?? e?.message ?? e);
      return {};
    }
  }

  /**
   * Translations for a list of English strings: { english: translated } for every one that is known.
   * Unknown ones are translated now, as many as fit in `budgetMs`; the rest stay English this time.
   * `known` is consulted first (bundled, human-checked translations).
   */
  async function translate(lang, texts, { space = 'prose', known = {}, budgetMs = 8000 } = {}) {
    const wanted = [...new Set(texts.filter(translatable))];
    if (lang === 'en' || !wanted.length) return { strings: {}, complete: true };
    const dict = await load(space, lang);
    const missing = wanted.filter((s) => !(s in known) && !(s in dict));

    if (missing.length && ai.configured()) {
      const groups = [];
      for (let i = 0; i < missing.length; i += CHUNK) groups.push(missing.slice(i, i + CHUNK));
      const deadline = now() + budgetMs;
      let added = 0;
      let next = 0;
      const worker = async () => {
        while (next < groups.length && now() < deadline) {
          const done = await chunk(lang, groups[next++]);
          for (const [k, v] of Object.entries(done)) { dict[k] = v; added += 1; }
        }
      };
      const work = Promise.all(Array.from({ length: Math.min(PARALLEL, groups.length) }, worker));
      await Promise.race([work, new Promise((r) => setTimeout(r, budgetMs + 500))]);
      if (added) {
        try {
          // Merge with whatever another request saved meanwhile, so neither loses its work.
          const latest = (await store.get(`${space}/${lang}`)) ?? {};
          Object.assign(dict, { ...latest, ...dict });
          await store.set(`${space}/${lang}`, dict);
        } catch (e) { console.error('Translation store could not be written:', e?.message ?? e); }
      }
    }

    const strings = {};
    let complete = true;
    for (const s of wanted) {
      const t = known[s] ?? dict[s];
      if (t) strings[s] = t; else complete = false;
    }
    return { strings, complete };
  }

  /** Translate chosen text fields of an API payload in place. Returns true when everything was translated. */
  async function localize(lang, payload, fields, options) {
    if (lang === 'en') return true;
    const spots = [];
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (fields.includes(k)) {
          if (typeof v === 'string') spots.push([node, k]);
          else if (Array.isArray(v)) v.forEach((item, i) => { if (typeof item === 'string') spots.push([v, i]); else walk(item); });
          else walk(v);
        } else walk(v);
      }
    };
    walk(payload);
    const { strings, complete } = await translate(lang, spots.map(([o, k]) => o[k]), options);
    for (const [o, k] of spots) if (strings[o[k]]) o[k] = strings[o[k]];
    return complete;
  }

  return { translate, localize, available: () => ai.configured() };
}
