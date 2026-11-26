import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChart, chartFacts, factsToText, detectTopic, topicWindows, windowsToText,
  personalDay, dayToText, taraBala, TOPICS,
} from '../src/index.mjs';
import { dignityOf, influences, dashaAt } from '../src/facts.mjs';
import { significators } from '../src/timing.mjs';

const BIRTH = { date: '1996-02-19', time: '10:00', timezone: 'Asia/Kolkata', latitude: 26.47, longitude: 84.44 };
const NOW = Date.parse('2026-11-26T10:00:00Z');

test('dignity: exaltation, debilitation and own sign', () => {
  assert.equal(dignityOf('Sun', 1), 'exalted');
  assert.equal(dignityOf('Sun', 7), 'debilitated');
  assert.equal(dignityOf('Mars', 1), 'own sign');
  assert.equal(dignityOf('Saturn', 7), 'exalted');
  assert.equal(dignityOf('Venus', 6), 'debilitated');
  assert.equal(dignityOf('Jupiter', 2), null);
  assert.equal(dignityOf('Rahu', 3), null);
});

test('graha aspects: everyone sees the 7th; Mars, Jupiter and Saturn see more', () => {
  const seen = (name) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((r) => influences(name, 1, r) === 'aspects');
  assert.deepEqual(seen('Sun'), [7]);
  assert.deepEqual(seen('Mars'), [4, 7, 8]);
  assert.deepEqual(seen('Jupiter'), [5, 7, 9]);
  assert.deepEqual(seen('Saturn'), [3, 7, 10]);
  assert.equal(influences('Moon', 5, 5), 'occupies');
  // Counting wraps round the zodiac: Saturn in Meena (12) sees Vrishabha (2), Kanya (6) and Dhanu (9).
  assert.equal(influences('Saturn', 12, 2), 'aspects');
  assert.equal(influences('Saturn', 12, 9), 'aspects');
  assert.equal(influences('Saturn', 12, 3), null);
});

test('chart facts: houses, lords and occupants agree with the chart', async () => {
  const chart = await computeChart(BIRTH);
  const f = chartFacts(chart, NOW);
  assert.equal(f.houseBasis, 'lagna');
  assert.equal(f.lagna.rashi, 'Mesha');
  assert.equal(f.age, 30);
  assert.equal(f.houses.length, 12);
  const h7 = f.houses[6];
  assert.equal(h7.rashi, 'Tula');
  assert.equal(h7.lord, 'Venus');
  assert.equal(h7.lordInHouse, 12);
  assert.equal(h7.lordDignity, 'exalted');
  // Every graha appears as an occupant of exactly the house the chart gives it.
  for (const p of chart.vedic.planets) {
    assert.ok(f.houses[p.house - 1].occupants.includes(p.name), `${p.name} in house ${p.house}`);
  }
  // The seven sign-owning grahas rule all twelve houses between them, each house once.
  const ruled = f.planets.flatMap((p) => p.rulesHouses).sort((a, b) => a - b);
  assert.deepEqual(ruled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(f.planets.find((p) => p.name === 'Jupiter').dignity, 'own sign');
  assert.equal(f.dasha.now.maha, 'Jupiter');
  assert.equal(f.dasha.now.antar, 'Rahu');
});

test('chart facts as text carry no birth date, time or place', async () => {
  const chart = await computeChart(BIRTH);
  const text = factsToText(chartFacts(chart, NOW));
  assert.ok(!text.includes('1996-02-19'));
  assert.ok(!text.includes('10:00'));
  assert.ok(!/26\.47|84\.44|Kolkata/.test(text));
  assert.match(text, /House 7 \(marriage and partnerships\): Tula; lord Venus in house 12 \(exalted\)/);
  assert.match(text, /Current period: Jupiter mahadasha/);
});

test('unknown birth time: houses are counted from the Moon', async () => {
  const chart = await computeChart({ ...BIRTH, time: null });
  const f = chartFacts(chart, NOW);
  assert.equal(f.houseBasis, 'moon');
  assert.equal(f.lagna, null);
  assert.equal(f.planets.find((p) => p.name === 'Moon').house, 1);
  assert.match(factsToText(f), /Birth time is unknown/);
});

test('dashaAt finds the running period and returns null outside the timeline', async () => {
  const chart = await computeChart(BIRTH);
  const d = dashaAt(chart.vedic.dasha, NOW);
  assert.ok(Date.parse(d.antarStart) <= NOW && NOW < Date.parse(d.antarEnd));
  assert.ok(Date.parse(d.mahaStart) <= Date.parse(d.antarStart));
  assert.equal(dashaAt(chart.vedic.dasha, Date.parse('1800-01-01T00:00:00Z')), null);
});

test('topic detection in English, Hinglish and Hindi', () => {
  assert.equal(detectTopic('When will I get married?'), 'marriage');
  assert.equal(detectTopic('meri shaadi kab hogi'), 'marriage');
  assert.equal(detectTopic('मेरी शादी कब होगी?'), 'marriage');
  assert.equal(detectTopic('Will I get a new job this year'), 'career');
  assert.equal(detectTopic('मुझे नौकरी कब मिलेगी'), 'career');
  assert.equal(detectTopic('Should I buy a house or a car?'), 'home');
  assert.equal(detectTopic('Will I settle abroad?'), 'travel');
  assert.equal(detectTopic('How is my health'), 'health');
  assert.equal(detectTopic('What is the reason for my mood'), null); // "son" inside "reason" is not a match
  assert.equal(detectTopic('Tell me about myself'), null);
});

test('significators: house lord, occupants, karaka and the nodes rule', async () => {
  const f = chartFacts(await computeChart(BIRTH), NOW);
  const sig = significators(f, 'marriage');
  const venus = sig.find((s) => s.name === 'Venus');
  assert.ok(venus.primary);
  assert.ok(venus.roles.includes('rules house 7'));
  // Ketu sits with Venus (7th lord) in Meena, so it speaks for marriage too.
  const ketu = sig.find((s) => s.name === 'Ketu');
  assert.ok(ketu.primary);
  assert.ok(ketu.roles.some((r) => r.includes('sits with Venus')));
  // Saturn only rules a supporting house (11): present but not primary.
  assert.equal(sig.find((s) => s.name === 'Saturn').primary, false);
});

test('topic windows: month ranges with reasons, deterministic, never for health', async () => {
  const chart = await computeChart(BIRTH);
  const a = await topicWindows(chart, 'career', { nowMs: NOW });
  const b = await topicWindows(chart, 'career', { nowMs: NOW });
  assert.deepEqual(a, b);
  assert.ok(a.windows.length > 0);
  for (const w of a.windows) {
    assert.match(w.from, /^[A-Z][a-z]+ \d{4}$/);
    assert.match(w.to, /^[A-Z][a-z]+ \d{4}$/);
    assert.ok(['strong', 'favourable', 'some'].includes(w.level));
    assert.ok(['past', 'current', 'upcoming'].includes(w.status));
    assert.ok(w.reasons.length > 0);
  }
  // A "favourable" or "strong" window always names the dasha lord and a Jupiter transit.
  const good = a.windows.filter((w) => w.level !== 'some');
  assert.ok(good.length > 0);
  for (const w of good) {
    assert.ok(w.reasons.some((r) => /antardasha|mahadasha/.test(r)), w.reasons.join('|'));
    assert.ok(w.reasons.some((r) => r.startsWith('Jupiter in ')), w.reasons.join('|'));
  }
  const text = windowsToText(a);
  assert.match(text, /never exact dates/);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(text), 'no exact dates in the timing text');

  const health = await topicWindows(chart, 'health', { nowMs: NOW });
  assert.deepEqual(health.windows, []);
  assert.match(windowsToText(health), /No timing windows are provided/);
  assert.equal(TOPICS.health.timing, false);
  await assert.rejects(() => topicWindows(chart, 'lottery', { nowMs: NOW }), /Unknown topic/);
});

test('tara bala: the nine-star cycle counted from the birth star', () => {
  assert.equal(taraBala(1, 1).name, 'Janma');
  assert.equal(taraBala(1, 2).name, 'Sampat');
  assert.equal(taraBala(1, 3).quality, 'difficult'); // Vipat
  assert.equal(taraBala(1, 10).name, 'Janma');       // the cycle repeats every nine stars
  assert.equal(taraBala(27, 1).name, 'Sampat');      // counting wraps from Revati to Ashwini
  assert.equal(taraBala(24, 5).count, 9);            // Shatabhisha to Mrigashira
  assert.equal(taraBala(24, 5).name, 'Parama Mitra');
});

test('personal day: read from the birth Moon and lagna', async () => {
  const chart = await computeChart(BIRTH);
  const d = await personalDay(chart, '2026-11-26');
  // The full moon of 24 Nov 2026 fell near 8 degrees Vrishabha; a day and a half later the Moon is
  // near 26 degrees Vrishabha, in Mrigashira. Birth Moon Kumbha (Shatabhisha), lagna Mesha.
  assert.equal(d.moon.rashi, 'Vrishabha');
  assert.equal(d.moon.nakshatra, 'Mrigashira');
  assert.equal(d.moon.houseFromMoon, 4);
  assert.equal(d.moon.houseFromLagna, 2);
  assert.equal(d.moon.chandraBala, 'weak');
  assert.equal(d.tara.name, 'Parama Mitra');
  assert.equal(d.theme.house, 2);
  assert.equal(d.dayLord, 'Jupiter'); // a Thursday
  assert.equal(d.dayLordIsDashaLord, true);
  // Saturn is in Meena through 2026, the sign after a Kumbha Moon: the last phase of Sade Sati.
  assert.equal(d.saturn.houseFromMoon, 2);
  assert.match(d.saturn.phase, /Sade Sati, last phase/);
  assert.ok(['supportive', 'steady', 'demanding'].includes(d.tone));
  assert.ok(d.ruleReading.text.length > 80);
  const text = dayToText(d);
  assert.match(text, /Tara bala: Parama Mitra/);
  assert.ok(!text.includes('1996'));
});

test('personal day without a birth time takes its theme from the Moon', async () => {
  const chart = await computeChart({ ...BIRTH, time: null });
  const d = await personalDay(chart, '2026-11-26');
  assert.equal(d.moon.houseFromLagna, null);
  assert.equal(d.theme.basis, 'moon');
  assert.equal(d.theme.house, d.moon.houseFromMoon);
  assert.match(dayToText(d), /Birth time unknown/);
});
