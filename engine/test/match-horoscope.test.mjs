import test from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, ashtakoot, manglik, matchVedic, matchWestern, dailyHoroscope, dailyHoroscopesAll, dailyTransits } from '../src/index.mjs';
import {
  YONI_SCORE, YONI_OF_NAKSHATRA, GANA_OF_NAKSHATRA, NADI_OF_NAKSHATRA, VASHYA_SCORE, GANA_SCORE,
} from '../src/matchTables.mjs';
import { HOUSE_THEMES, TONE_LINES } from '../src/horoscopeText.mjs';

const koota = (r, name) => r.kootas.find((k) => k.name === name);

// ---------- Ashtakoot tables ----------
test('yoni table is symmetric, 4 on the diagonal, with exactly 7 sworn-enemy pairs', () => {
  let zeros = 0;
  for (let i = 0; i < 14; i++) {
    assert.equal(YONI_SCORE[i].length, 14);
    assert.equal(YONI_SCORE[i][i], 4);
    for (let j = 0; j < 14; j++) {
      assert.equal(YONI_SCORE[i][j], YONI_SCORE[j][i], `yoni ${i},${j}`);
      if (i < j && YONI_SCORE[i][j] === 0) zeros++;
    }
  }
  assert.equal(zeros, 7);
});

test('nakshatra lookups cover all 27 nakshatras evenly', () => {
  for (const arr of [YONI_OF_NAKSHATRA, GANA_OF_NAKSHATRA, NADI_OF_NAKSHATRA]) assert.equal(arr.length, 27);
  for (const g of [0, 1, 2]) {
    assert.equal(GANA_OF_NAKSHATRA.filter((x) => x === g).length, 9);
    assert.equal(NADI_OF_NAKSHATRA.filter((x) => x === g).length, 9);
  }
  const yoniCounts = Array(14).fill(0);
  for (const y of YONI_OF_NAKSHATRA) yoniCounts[y]++;
  assert.deepEqual(yoniCounts, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2]); // Mongoose has one (Uttara Ashadha)
  for (const row of VASHYA_SCORE) assert.equal(row.length, 5);
  for (const row of GANA_SCORE) assert.equal(row.length, 3);
});

// ---------- Ashtakoot scoring ----------
test('published worked example: bride Moon in Shravana (Capricorn), groom Moon in Chitra (Virgo) = 17.5/36', () => {
  const r = ashtakoot(175, 286); // groom: Virgo 25° (Chitra); bride: Capricorn 16° (Shravana)
  assert.equal(koota(r, 'Varna').score, 1);
  assert.equal(koota(r, 'Vashya').score, 0.5);
  assert.equal(koota(r, 'Tara').score, 3);
  assert.equal(koota(r, 'Yoni').score, 1);
  assert.equal(koota(r, 'Graha Maitri').score, 4);
  assert.equal(koota(r, 'Gana').score, 0);
  assert.equal(koota(r, 'Bhakoot').score, 0);
  assert.equal(koota(r, 'Nadi').score, 8);
  assert.equal(r.total, 17.5);
  assert.equal(koota(r, 'Yoni').groom, 'Tiger');
  assert.equal(koota(r, 'Yoni').bride, 'Monkey');
  assert.equal(koota(r, 'Nadi').bride, 'Antya');
  // Virgo (Mercury) and Capricorn (Saturn): the lords are not mutual friends, so nothing is cancelled.
  const bhakoot = r.doshas.find((d) => d.name === 'Bhakoot dosha');
  assert.equal(bhakoot.reason, 'the Moon signs are 5/9 apart');
  assert.equal(bhakoot.cancelled, false);
  assert.equal(r.doshas.find((d) => d.name === 'Gana dosha').cancelled, false);
  assert.equal(r.doshas.some((d) => d.name === 'Nadi dosha'), false);
  assert.ok(r.band.startsWith('Below'));
});

test('identical Moon positions: full marks except Nadi (28/36)', () => {
  const r = ashtakoot(40, 40);
  assert.equal(koota(r, 'Nadi').score, 0);
  assert.equal(koota(r, 'Bhakoot').score, 7);
  assert.equal(r.total, 28);
  // same nakshatra, same pada, same sign: Nadi dosha stands
  const nadi = r.doshas.find((d) => d.name === 'Nadi dosha');
  assert.equal(nadi.cancelled, false);
  assert.deepEqual(nadi.cancellations, []);
});

test('dosha cancellation rules', () => {
  const dosha = (g, b, name) => ashtakoot(g, b).doshas.find((d) => d.name === name);

  // Bhakoot: Aries-Scorpio is 6/8 but both are ruled by Mars
  const sameLord = dosha(5, 215, 'Bhakoot dosha');
  assert.equal(sameLord.reason, 'the Moon signs are 6/8 apart');
  assert.equal(sameLord.cancelled, true);
  assert.deepEqual(sameLord.cancellations, ['both Moon signs are ruled by Mars']);
  // Bhakoot: Aries-Pisces is 2/12; Mars and Jupiter are mutual friends
  const friends = dosha(5, 335, 'Bhakoot dosha');
  assert.equal(friends.cancelled, true);
  assert.match(friends.cancellations[0], /Mars and Jupiter, are mutual friends/);
  // Bhakoot: Aries-Virgo is 6/8; Mars and Mercury are not friends
  assert.equal(dosha(5, 155, 'Bhakoot dosha').cancelled, false);
  // Bhakoot: Cancer-Aquarius is 6/8; Moon and Saturn are not mutual friends
  assert.equal(dosha(95, 305, 'Bhakoot dosha').cancelled, false);
  // the score itself is unchanged by a cancellation
  assert.equal(ashtakoot(5, 215).kootas.find((k) => k.name === 'Bhakoot').score, 0);

  // Nadi: same nakshatra (Rohini), different padas
  const padas = dosha(41, 45, 'Nadi dosha');
  assert.equal(padas.cancelled, true);
  assert.deepEqual(padas.cancellations, ['both have the same nakshatra but different padas']);
  // Nadi: same sign (Taurus), different nakshatras (Krittika and Rohini, both Antya)
  const sameSign = dosha(35, 45, 'Nadi dosha');
  assert.deepEqual(sameSign.cancellations, ['both have the same Moon sign but different nakshatras']);
  // Nadi: same nakshatra (Krittika) across two signs (Aries and Taurus)
  const acrossSigns = dosha(28, 35, 'Nadi dosha');
  assert.ok(acrossSigns.cancellations.includes('both have the same nakshatra but different Moon signs'));
  // Nadi: different nakshatras in different signs with the same nadi (Ashwini and Ardra, both Aadi) stands
  const stands = dosha(5, 70, 'Nadi dosha');
  assert.equal(stands.reason, 'both are Aadi nadi');
  assert.equal(stands.cancelled, false);

  // Gana: Rakshasa groom (Krittika in Aries) with Deva bride (Anuradha in Scorpio): same lord Mars cancels
  const gana = dosha(28, 215, 'Gana dosha');
  assert.equal(gana.reason, "the groom's gana is Rakshasa and the bride's is Deva");
  assert.equal(gana.cancelled, true);
  assert.deepEqual(gana.cancellations, ['both Moon signs are ruled by Mars']);
  // every dosha entry has the full shape
  for (const d of ashtakoot(175, 286).doshas) {
    assert.deepEqual(Object.keys(d).sort(), ['cancellations', 'cancelled', 'name', 'reason']);
  }
});

test('graha maitri combinations', () => {
  const lon = { Sun: 125, Moon: 95, Mars: 5, Mercury: 65, Jupiter: 245, Venus: 35, Saturn: 275 };
  const gm = (a, b) => koota(ashtakoot(lon[a], lon[b]), 'Graha Maitri').score;
  assert.equal(gm('Saturn', 'Mercury'), 4);   // friend + neutral
  assert.equal(gm('Sun', 'Saturn'), 0);       // mutual enemies
  assert.equal(gm('Moon', 'Mars'), 4);        // neutral + friend
  assert.equal(gm('Jupiter', 'Venus'), 0.5);  // enemy + neutral
  assert.equal(gm('Sun', 'Moon'), 5);         // mutual friends
  assert.equal(gm('Mars', 'Mercury'), 0.5);   // enemy + neutral
  assert.equal(gm('Mars', 'Venus'), 3);       // both neutral
  assert.equal(gm('Sun', 'Mercury'), 4);      // neutral + friend
});

test('every pada pairing scores between 0 and 36 in half-point steps, and 36 is reachable', () => {
  let max = 0; let min = 36;
  for (let g = 0; g < 108; g++) {
    for (let b = 0; b < 108; b++) {
      const r = ashtakoot(g * (10 / 3) + 1, b * (10 / 3) + 1);
      assert.ok(r.total >= 0 && r.total <= 36);
      assert.equal((r.total * 2) % 1, 0);
      assert.equal(r.kootas.length, 8);
      for (const k of r.kootas) assert.ok(k.score >= 0 && k.score <= k.max, `${k.name} ${k.score}`);
      max = Math.max(max, r.total); min = Math.min(min, r.total);
    }
  }
  assert.equal(max, 36);
  assert.ok(min < 10);
});

// ---------- Chart-level matching ----------
const A = { date: '1996-02-19', time: '10:00', timezone: 'Asia/Kolkata', latitude: 26.47, longitude: 84.44 };
const B = { date: '1997-08-05', time: '18:40', timezone: 'Asia/Kolkata', latitude: 21.17, longitude: 72.83 };

test('matchVedic: total equals sum of kootas, manglik houses agree with the charts', async () => {
  const [ca, cb] = await Promise.all([computeChart(A), computeChart(B)]);
  const m = matchVedic(ca, cb);
  assert.equal(m.max, 36);
  assert.equal(m.total, m.kootas.reduce((s, k) => s + k.score, 0));
  for (const [chart, mg] of [[ca, m.manglik.groom], [cb, m.manglik.bride]]) {
    const mars = chart.vedic.planets.find((p) => p.name === 'Mars');
    assert.equal(mg.marsHouseFromLagna, mars.house);
    assert.equal(mg.isManglik, [1, 2, 4, 7, 8, 12].includes(mars.house));
    assert.equal(mg.basis, 'Lagna');
  }
  assert.equal(m.manglik.compatible, m.manglik.groom.isManglik === m.manglik.bride.isManglik);
  assert.equal(m.notes.length, 0);
});

test('matchVedic with an unknown birth time falls back to the Moon for manglik and adds a note', async () => {
  const [ca, cb] = await Promise.all([computeChart({ ...A, time: null }), computeChart(B)]);
  const m = matchVedic(ca, cb);
  assert.equal(m.manglik.groom.basis, 'Moon (birth time unknown)');
  assert.equal(m.manglik.groom.marsHouseFromLagna, null);
  assert.equal(m.notes.length, 1);
  assert.equal(manglik(ca).isManglik, manglik(ca).fromMoon);
});

test('matchWestern: aspects are within orb, sorted, and counted correctly', async () => {
  const [ca, cb] = await Promise.all([computeChart(A), computeChart(B)]);
  const m = matchWestern(ca, cb);
  assert.ok(m.aspects.length > 0);
  for (let i = 1; i < m.aspects.length; i++) assert.ok(m.aspects[i].orb >= m.aspects[i - 1].orb);
  for (const a of m.aspects) assert.ok(a.orb <= 8);
  const s = m.summary;
  assert.equal(s.harmonious + s.challenging + s.blending, m.aspects.length);
  // a chart against itself has an exact Sun-Sun conjunction
  const self = matchWestern(ca, ca);
  const sunSun = self.aspects.find((x) => x.a === 'Sun' && x.b === 'Sun');
  assert.equal(sunSun.type, 'Conjunction');
  assert.ok(sunSun.orb < 1e-9);
});

// ---------- Daily horoscope ----------
test('text library is complete', () => {
  for (let h = 1; h <= 12; h++) {
    assert.ok(HOUSE_THEMES[h].title.length > 0);
    assert.equal(HOUSE_THEMES[h].body.length, 3);
    assert.ok(HOUSE_THEMES[h].focus.length >= 3);
    for (const b of HOUSE_THEMES[h].body) assert.ok(b.length > 80);
  }
  for (const tone of ['supportive', 'demanding', 'steady']) assert.ok(TONE_LINES[tone].length >= 2);
});

test('daily horoscopes: 24 readings, each system covers all 12 houses once', async () => {
  const all = await dailyHoroscopesAll('2026-11-26');
  assert.equal(all.length, 24);
  for (const system of ['vedic', 'western']) {
    const rows = all.filter((r) => r.system === system);
    assert.equal(rows.length, 12);
    assert.deepEqual(rows.map((r) => r.sign), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual([...new Set(rows.map((r) => r.content.moon.houseFromSign))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const r of rows) {
      assert.ok(r.content.text.length > 100);
      assert.ok(['supportive', 'demanding', 'steady'].includes(r.content.tone));
      // the sign the Moon is in reads as house 1
      if (r.content.moon.houseFromSign === 1) assert.equal(r.content.moon.sign, r.signName);
    }
  }
  assert.ok(all.filter((r) => r.system === 'vedic').every((r) => typeof r.content.moon.nakshatra === 'string'));
});

test('daily transits agree with the chart engine for the same instant', async () => {
  const t = await dailyTransits('2026-11-26');
  const c = await computeChart({ date: '2026-11-26', time: '06:00', timezone: 'Asia/Kolkata', latitude: 0, longitude: 0 });
  const wMoon = c.western.planets.find((p) => p.name === 'Moon').longitude;
  const vMoon = c.vedic.planets.find((p) => p.name === 'Moon').longitude;
  assert.ok(Math.abs(t.planets.Moon.tropical - wMoon) < 1e-6);
  assert.ok(Math.abs(t.planets.Moon.sidereal - vMoon) < 0.01);
  assert.equal(t.planets.Sun.retrograde, false);
});

test('daily horoscope is deterministic and validates its inputs', async () => {
  const a = await dailyHoroscope('2026-11-26', 'western', 9);
  const b = await dailyHoroscope('2026-11-26', 'western', 9);
  assert.deepEqual(a, b);
  assert.equal(a.signName, 'Sagittarius');
  await assert.rejects(dailyHoroscope('2026-11-26', 'chinese', 1));
  await assert.rejects(dailyHoroscope('2026-11-26', 'vedic', 13));
});

test('Mercury retrograde adds the caution line (April 2025 retrograde period)', async () => {
  const r = await dailyHoroscope('2025-03-25', 'western', 1);
  const t = await dailyTransits('2025-03-25');
  assert.equal(t.planets.Mercury.retrograde, true);
  assert.ok(r.content.text.includes('Mercury is retrograde'));
  const direct = await dailyHoroscope('2025-05-20', 'western', 1);
  assert.ok(!direct.content.text.includes('Mercury is retrograde'));
});
