import test from 'node:test';
import assert from 'node:assert/strict';
import { computeChart, matchVedic } from '../../engine/src/index.mjs';
import { keysFromChart, chartFromKeys, scoreBetween, fitsPreferences, whyLines, blankPreferences } from '../src/lib/meet.js';

const at = (date, time, lat, lon) => computeChart({ date, time, timezone: 'Asia/Kolkata', latitude: lat, longitude: lon });

test('match keys: the score from keys equals the score from the full charts', async () => {
  const pairs = [[['1995-05-03', '11:30', 21.17, 72.83], ['1994-03-12', '08:20', 26.91, 75.79]], [['1992-01-14', '21:10', 23.02, 72.57], ['1994-03-12', '08:20', 26.91, 75.79]],
    [['1993-11-23', '07:55', 23.02, 72.57], ['1997-08-05', null, 21.17, 72.83]]];
  for (const [g, b] of pairs) {
    const groom = await at(...g); const bride = await at(...b);
    const full = matchVedic(groom, bride);
    const viaKeys = matchVedic(chartFromKeys(keysFromChart(groom)), chartFromKeys(keysFromChart(bride)));
    assert.equal(viaKeys.total, full.total);
    assert.deepEqual(viaKeys.kootas, full.kootas);
    assert.deepEqual(viaKeys.doshas, full.doshas);
    assert.equal(viaKeys.manglik.summary, full.manglik.summary);
  }
});

test('match keys carry no birth date, time or place', async () => {
  const keys = keysFromChart(await at('1995-05-03', '11:30', 21.17, 72.83));
  assert.deepEqual(Object.keys(keys).sort(), ['lagna_rashi', 'mars_house', 'mars_rashi', 'moon_pada', 'time_known']);
  assert.ok(Number.isInteger(keys.moon_pada) && keys.moon_pada >= 0 && keys.moon_pada <= 107);
});

test('scoreBetween: a man and a woman take the groom and bride roles; both sides see the same score', async () => {
  const dev = { user_id: 'b', gender: 'man', keys: keysFromChart(await at('1995-05-03', '11:30', 21.17, 72.83)) };
  const asha = { user_id: 'a', gender: 'woman', keys: keysFromChart(await at('1994-03-12', '08:20', 26.91, 75.79)) };
  assert.equal(scoreBetween(dev, asha).total, 30.5);
  assert.equal(scoreBetween(asha, dev).total, 30.5);
  const x = { ...dev, gender: 'woman' };
  assert.equal(scoreBetween(x, asha).total, scoreBetween(asha, x).total);
});

test('preferences: only the ones that were set are checked, and "open to all" filters nobody out', async () => {
  const dev = { user_id: 'b', gender: 'man', age: 31, height_cm: 180, looking_for: 'marriage', marital_status: 'never_married', religion: 'Hindu', community: 'Patel', mother_tongue: 'Gujarati', income_range: '15_20',
    keys: keysFromChart(await at('1995-05-03', '11:30', 21.17, 72.83)) };
  const asha = { user_id: 'a', gender: 'woman', keys: keysFromChart(await at('1994-03-12', '08:20', 26.91, 75.79)) };
  const match = scoreBetween(asha, dev);
  const open = fitsPreferences(dev, blankPreferences(), match);
  assert.equal(open.fits, true);
  assert.deepEqual(open.checks.map(([label]) => label), ['Age', 'Vibe score']);
  const strict = fitsPreferences(dev, { ...blankPreferences(), age_max: 30, communities: ['rajput'], religions: ['hindu'], income_min: '10_15', min_score: 31 }, match);
  assert.equal(strict.fits, false);
  assert.deepEqual(Object.fromEntries(strict.checks), { Age: false, Religion: true, Community: false, Income: true, 'Vibe score': false });
  const hidden = fitsPreferences({ ...dev, community: '' }, { ...blankPreferences(), communities: ['Patel'] }, match);
  assert.equal(hidden.fits, false, 'a hidden community cannot satisfy a named community');
});

test('whyLines: names the strongest tests and the one thing to talk about', async () => {
  const dev = { user_id: 'b', gender: 'man', keys: keysFromChart(await at('1995-05-03', '11:30', 21.17, 72.83)) };
  const asha = { user_id: 'a', gender: 'woman', keys: keysFromChart(await at('1994-03-12', '08:20', 26.91, 75.79)) };
  const why = whyLines(scoreBetween(dev, asha));
  assert.equal(why.good.length, 3);
  assert.ok(why.good.every((k) => k.score / k.max >= 0.75));
  assert.deepEqual(why.care, { kind: 'manglik' });
});
