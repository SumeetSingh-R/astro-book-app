// Timing: which months ahead are traditionally read as supportive for a life topic.
// Two classical tests are combined, month by month:
//   1. Dasha: the running antardasha (or mahadasha) lord is connected with the topic's house.
//   2. Transit: Jupiter occupies or aspects that house or its lord ("double transit" when Saturn does too).
// The result is a list of month ranges with the reasons spelled out. It never produces a date.
import { getSwe } from './chart.mjs';
import { julianDay } from './time.mjs';
import { RASHIS } from './constants.mjs';
import { norm360 } from './vedic.mjs';
import { chartFacts, dashaAt, influences, lordOfRashi } from './facts.mjs';

export const TOPICS = {
  marriage: { label: 'marriage and partnership', primary: [7], supporting: [2, 11], karakas: ['Venus', 'Jupiter'], timing: true },
  career: { label: 'career and work', primary: [10], supporting: [6, 2, 11], karakas: ['Saturn', 'Sun'], timing: true },
  money: { label: 'money and income', primary: [2, 11], supporting: [9], karakas: ['Jupiter'], timing: true },
  children: { label: 'children', primary: [5], supporting: [9], karakas: ['Jupiter'], timing: true },
  education: { label: 'education and learning', primary: [4, 5], supporting: [9], karakas: ['Mercury', 'Jupiter'], timing: true },
  home: { label: 'home, property and vehicles', primary: [4], supporting: [11], karakas: ['Mars', 'Venus'], timing: true },
  travel: { label: 'travel and living abroad', primary: [9, 12], supporting: [3, 7], karakas: ['Rahu'], timing: true },
  // Health is described from the chart, but no "good" or "bad" months are produced for it.
  health: { label: 'health and wellbeing', primary: [1], supporting: [6], karakas: ['Sun'], timing: false },
};

const KEYWORDS = {
  marriage: ['marry', 'married', 'marriage', 'wedding', 'spouse', 'wife', 'husband', 'partner', 'love', 'relationship', 'girlfriend', 'boyfriend', 'shaadi', 'shadi', 'vivah', 'rishta', 'विवाह', 'शादी', 'पति', 'पत्नी', 'प्यार', 'प्रेम', 'रिश्ता', 'जीवनसाथी'],
  career: ['job', 'career', 'work', 'promotion', 'business', 'profession', 'boss', 'startup', 'office', 'naukri', 'vyapar', 'नौकरी', 'करियर', 'व्यापार', 'बिज़नेस', 'बिजनेस', 'काम', 'प्रमोशन'],
  money: ['money', 'wealth', 'finance', 'income', 'salary', 'rich', 'loan', 'debt', 'invest', 'saving', 'paisa', 'dhan', 'पैसा', 'पैसे', 'धन', 'कमाई', 'आय', 'कर्ज'],
  children: ['child', 'children', 'baby', 'kid', 'pregnan', 'son', 'daughter', 'santan', 'संतान', 'बच्चा', 'बच्चे', 'बेटा', 'बेटी'],
  health: ['health', 'illness', 'disease', 'sick', 'surgery', 'hospital', 'sehat', 'स्वास्थ्य', 'सेहत', 'बीमारी', 'रोग'],
  education: ['study', 'studies', 'exam', 'education', 'college', 'degree', 'course', 'padhai', 'पढ़ाई', 'परीक्षा', 'शिक्षा'],
  home: ['house', 'home', 'property', 'land', 'flat', 'vehicle', 'car', 'ghar', 'makaan', 'घर', 'मकान', 'ज़मीन', 'जमीन', 'गाड़ी', 'संपत्ति'],
  travel: ['abroad', 'foreign', 'travel', 'visa', 'settle', 'overseas', 'videsh', 'विदेश', 'यात्रा'],
};

/** Guess which life topic a question is about. Returns a TOPICS key, or null for a general question. */
export function detectTopic(question) {
  const text = ` ${String(question).toLowerCase()} `;
  let best = null;
  let bestHits = 0;
  for (const [topic, words] of Object.entries(KEYWORDS)) {
    let hits = 0;
    for (const w of words) {
      // Latin keywords must start a word ("son" should not match "reason"); Devanagari ones match anywhere.
      const found = /^[a-z]/.test(w) ? new RegExp(`[^a-z]${w}`).test(text) : text.includes(w);
      if (found) hits++;
    }
    if (hits > bestHits) { best = topic; bestHits = hits; }
  }
  return best;
}

/** Which grahas speak for a topic in this chart, and why. */
export function significators(facts, topicKey) {
  const topic = TOPICS[topicKey];
  const roles = new Map();
  const add = (name, role, weight) => {
    const cur = roles.get(name) ?? { name, roles: [], primary: false };
    cur.roles.push(role);
    cur.primary = cur.primary || weight === 'primary';
    roles.set(name, cur);
  };
  for (const h of topic.primary) {
    const house = facts.houses[h - 1];
    add(house.lord, `rules house ${h}`, 'primary');
    for (const occ of house.occupants) add(occ, `sits in house ${h}`, 'primary');
  }
  for (const k of topic.karakas) add(k, `natural significator of ${topic.label}`, 'primary');
  // Rahu and Ketu own no sign: they act for the lord of the sign they sit in, and for a graha they sit with.
  for (const node of ['Rahu', 'Ketu']) {
    const n = facts.planets.find((p) => p.name === node);
    const dispositor = lordOfRashi(n.rashiIndex);
    if (roles.get(dispositor)?.primary) add(node, `acts for ${dispositor}, the lord of the sign it sits in`, 'primary');
    for (const h of topic.primary) {
      const lord = facts.planets.find((p) => p.name === facts.houses[h - 1].lord);
      if (lord.rashiIndex === n.rashiIndex) add(node, `sits with ${lord.name}, the lord of house ${h}`, 'primary');
    }
  }
  for (const h of topic.supporting) add(facts.houses[h - 1].lord, `rules house ${h}`, 'supporting');
  return [...roles.values()];
}

async function slowPlanetsAt(swe, ms) {
  const jd = julianDay(ms);
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL;
  const rashi = (id) => Math.min(11, Math.floor(norm360(swe.calc_ut(jd, id, flags)[0]) / 30)) + 1;
  return { Jupiter: rashi(swe.SE_JUPITER), Saturn: rashi(swe.SE_SATURN) };
}

const monthLabel = (ms) => new Date(ms).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Month-by-month supportive windows for a topic.
 * @returns {{topic, label, basis, significators, windows: Array<{from, to, level, status, reasons}>}}
 *   level: 'strong' (dasha + Jupiter + Saturn), 'favourable' (dasha + Jupiter), 'some' (one of the two tests)
 */
export async function topicWindows(chart, topicKey, { nowMs = Date.now(), monthsBack = 12, monthsAhead = 96 } = {}) {
  const topic = TOPICS[topicKey];
  if (!topic) throw new Error(`Unknown topic: ${topicKey}`);
  const facts = chartFacts(chart, nowMs);
  const sig = significators(facts, topicKey);
  const base = { topic: topicKey, label: topic.label, basis: facts.houseBasis, significators: sig, windows: [] };
  if (!topic.timing) return base;

  const swe = await getSwe();
  swe.set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);

  // Rashis that matter for the transit test: each primary house, and where its lord sits at birth.
  const targets = [];
  for (const h of topic.primary) {
    const house = facts.houses[h - 1];
    targets.push({ rashi: house.rashiIndex, what: `house ${h}` });
    const lord = facts.planets.find((p) => p.name === house.lord);
    targets.push({ rashi: lord.rashiIndex, what: `the lord of house ${h} (${house.lord})` });
  }
  const sigByName = new Map(sig.map((s) => [s.name, s]));

  const start = new Date(nowMs);
  const months = [];
  for (let i = -monthsBack; i <= monthsAhead; i++) {
    const ms = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15);
    const d = dashaAt(chart.vedic.dasha, ms);
    if (!d) continue;
    const t = await slowPlanetsAt(swe, ms);

    const antar = sigByName.get(d.antar);
    const maha = sigByName.get(d.maha);
    const dashaScore = (antar ? (antar.primary ? 2 : 1) : 0) + (maha?.primary ? 1 : 0);
    const dashaOn = dashaScore >= 2;

    const hit = (name) => {
      for (const target of targets) {
        const how = influences(name, t[name], target.rashi);
        if (how) return `${name} in ${RASHIS[t[name] - 1]} ${how} ${target.what}`;
      }
      return null;
    };
    const jupiter = hit('Jupiter');
    const saturn = hit('Saturn');

    let level = null;
    if (dashaOn && jupiter && saturn) level = 'strong';
    else if (dashaOn && jupiter) level = 'favourable';
    else if (dashaOn || (jupiter && saturn)) level = 'some';

    const dashaReasons = [];
    if (dashaOn) {
      const why = (s, period) => `${s.name} ${period} (${s.name}: ${s.roles.join(', ')})`;
      if (antar) dashaReasons.push(why(antar, 'antardasha'));
      if (maha?.primary && maha !== antar) dashaReasons.push(why(maha, 'mahadasha'));
    }
    const transitReasons = [jupiter, level === 'strong' || !dashaOn ? saturn : null].filter(Boolean);
    const cls = level === 'strong' || level === 'favourable' ? 'good' : level;
    months.push({ ms, level, key: `${cls}|${d.maha}|${d.antar}|${dashaOn}`, dashaReasons, transitReasons, period: `${d.maha}/${d.antar}` });
  }

  // Merge neighbouring months of the same kind within one dasha period into a window.
  const windows = [];
  for (const m of months) {
    let w = windows[windows.length - 1];
    if (!w || w.key !== m.key) {
      w = { key: m.key, level: m.level, fromMs: m.ms, toMs: m.ms, strong: [], reasons: [...m.dashaReasons], transit: [], period: m.period };
      windows.push(w);
    }
    w.toMs = m.ms;
    if (m.level === 'strong') { w.level = 'strong'; w.strong.push(m.ms); }
    for (const r of m.transitReasons) if (!w.transit.includes(r)) w.transit.push(r);
  }
  const ranges = (list) => {
    const out = [];
    for (const ms of list) {
      const last = out[out.length - 1];
      const d = new Date(ms);
      const prev = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15);
      if (last && last.toMs === prev) last.toMs = ms; else out.push({ fromMs: ms, toMs: ms });
    }
    return out.map((r) => (r.fromMs === r.toMs ? monthLabel(r.fromMs) : `${monthLabel(r.fromMs)} to ${monthLabel(r.toMs)}`));
  };
  base.windows = windows
    .filter((w) => w.level)
    .map((w) => {
      const monthsInWindow = Math.round((w.toMs - w.fromMs) / (30.44 * 86400000)) + 1;
      return {
        from: monthLabel(w.fromMs),
        to: monthLabel(w.toMs),
        level: w.level,
        strongest: w.level === 'strong' && w.strong.length < monthsInWindow ? ranges(w.strong) : [],
        status: w.toMs < nowMs - 20 * 86400000 ? 'past' : w.fromMs > nowMs + 20 * 86400000 ? 'upcoming' : 'current',
        period: w.period,
        reasons: [...w.reasons, ...w.transit.slice(0, 4)],
      };
    });
  return base;
}

/** Topic windows as compact text for an AI prompt. */
export function windowsToText(tw) {
  const lines = [];
  lines.push(`Topic: ${tw.label}. Houses are counted from the ${tw.basis === 'lagna' ? 'lagna' : 'Moon (birth time unknown, so this is less precise)'}.`);
  lines.push(`Grahas that speak for this topic in this chart: ${tw.significators.map((s) => `${s.name} (${s.roles.join(', ')})`).join('; ')}.`);
  if (!tw.windows.length) {
    lines.push('No timing windows are provided for this topic.');
    return lines.join('\n');
  }
  const rank = { strong: 'strongly favourable', favourable: 'favourable', some: 'some support' };
  const good = tw.windows.filter((w) => w.level !== 'some');
  const shown = (good.length ? good : tw.windows).filter((w) => w.status !== 'past').slice(0, 8);
  const past = (good.length ? good : tw.windows).filter((w) => w.status === 'past').slice(-3);
  const fmt = (w) => `- ${w.from === w.to ? w.from : `${w.from} to ${w.to}`} [${rank[w.level]}${w.strongest.length ? `, strongest in ${w.strongest.join(' and ')}` : ''}; ${w.status}; ${w.period} period]: ${w.reasons.join('; ')}.`;
  lines.push('Months traditionally read as supportive for this topic (month ranges, never exact dates):');
  for (const w of past) lines.push(fmt(w));
  for (const w of shown) lines.push(fmt(w));
  if (!shown.length) lines.push('- No clearly supportive window in the next eight years by these two tests.');
  return lines.join('\n');
}
