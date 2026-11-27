import test from 'node:test';
import assert from 'node:assert/strict';
import { feetInches, HEIGHTS, ageOn, toList, blankProfile, blankPreferences, completeness, labelOf, LOOKING_FOR, FIRST_MESSAGES, limitText, waitingForReply } from '../src/lib/meet.js';

test('heights: shown in feet and inches, one inch apart', () => {
  assert.equal(feetInches(170), '5 ft 7 in');
  assert.equal(feetInches(183), '6 ft 0 in');
  assert.equal(HEIGHTS[0][1], '4 ft 6 in');
  assert.equal(HEIGHTS.at(-1)[1], '6 ft 8 in');
  assert.equal(new Set(HEIGHTS.map(([cm]) => cm)).size, HEIGHTS.length);
});

test('age: counts whole years, so a birthday later this year is not yet counted', () => {
  assert.equal(ageOn('1996-02-19', new Date(2026, 10, 27)), 30);
  assert.equal(ageOn('1996-12-19', new Date(2026, 10, 27)), 29);
  assert.equal(ageOn('2008-11-27', new Date(2026, 10, 27)), 18);
  assert.equal(ageOn('2008-11-28', new Date(2026, 10, 27)), 17);
});

test('lists typed with commas are tidied, de-duplicated and capped', () => {
  assert.deepEqual(toList(' Trekking , indie  music,, trekking,Cricket '), ['Trekking', 'indie music', 'Cricket']);
  assert.equal(toList(Array.from({ length: 20 }, (_, i) => `x${i}`).join(',')).length, 10);
  assert.deepEqual(toList(''), []);
});

test('a new profile starts from the saved birth details and is visible to everyone', () => {
  const p = blankProfile({ name: 'Asha Verma', birth_date: '1994-03-12' });
  assert.equal(p.display_name, 'Asha');
  assert.equal(p.birth_year, 1994);
  assert.equal(p.discoverable, true);
  assert.equal(p.only_liked, false);
  assert.deepEqual([p.show_religion, p.show_community, p.show_income], [true, true, true]);
  assert.deepEqual(blankPreferences().communities, [], 'open to all by default');
  assert.equal(blankPreferences().min_score, 18);
});

test('completeness: reaches 100 only when everything is filled, and names what to add next', () => {
  const empty = blankProfile({ name: 'Asha', birth_date: '1994-03-12' });
  const start = completeness(empty, 0);
  assert.equal(start.percent, 0);
  assert.equal(start.next, 'Add a clear photo of your face');
  const full = { ...empty, gender: 'woman', interested_in: 'men', about: 'I plan the trip and you get the window seat.', height_cm: 163, education: 'M.Des', work: 'UX researcher', city: 'Jaipur',
    marital_status: 'never_married', religion: 'Hindu', mother_tongue: 'Hindi', family_type: 'nuclear', diet: 'vegetarian', drinking: 'never', smoking: 'never', interests: ['a', 'b', 'c'] };
  assert.deepEqual(completeness(full, 3), { percent: 100, next: null });
  assert.equal(completeness(full, 1).percent, 90);
  assert.equal(completeness(full, 1).next, 'Add at least 3 photos');
  assert.equal(labelOf(LOOKING_FOR, 'long_term'), 'Something long-term');
});

test('message limits: the database reason becomes plain words, and other errors are left alone', () => {
  assert.match(limitText({ message: 'limit:minute' }), /Wait a minute/);
  assert.match(limitText({ message: 'limit:day' }), /tomorrow/);
  assert.match(limitText({ message: 'limit:first' }), /\{0\}/, 'names the other person');
  assert.equal(limitText({ message: 'new row violates row-level security policy' }), null);
  assert.equal(limitText(null), null);
});

test('opening messages: five are allowed until the other person replies', () => {
  const mine = (n) => Array.from({ length: n }, (_, i) => ({ id: i, sender: 'me' }));
  assert.equal(FIRST_MESSAGES, 5);
  assert.equal(waitingForReply(null, 'me'), false, 'still loading');
  assert.equal(waitingForReply([], 'me'), false);
  assert.equal(waitingForReply(mine(4), 'me'), false);
  assert.equal(waitingForReply(mine(5), 'me'), true);
  assert.equal(waitingForReply([...mine(8), { id: 'r', sender: 'them' }], 'me'), false, 'a reply lifts the limit');
});
