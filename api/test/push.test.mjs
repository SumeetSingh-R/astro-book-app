import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import webpush from 'web-push';
import { handlePush } from '../lib/handlers.mjs';
import { createPush, pushText, PUSH_KINDS } from '../lib/push.mjs';
import { ApiError } from '../lib/http.mjs';

const TO = '22222222-2222-4222-8222-222222222222';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const SUBS = [{ endpoint: 'https://push.example.test/a', p256dh: 'k1', auth: 'a1' }, { endpoint: 'https://push.example.test/b', p256dh: 'k2', auth: 'a2' }];
const post = (body, token = 'good') => new Request('https://example.test/api/push', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

function fakes({ target = { name: 'Asha', actor: ACTOR, language: 'en', subs: SUBS }, configured = true, fail = {} } = {}) {
  const seen = { asked: [], sent: [], gone: [] };
  const createDb = (token) => ({
    async getUserId() { if (token !== 'good') throw new ApiError(401, 'not_signed_in', 'Your session has expired. Sign in again.'); return ACTOR; },
    async pushTargets(to, kind) { seen.asked.push([to, kind]); return target; },
    async pushGone(endpoints) { seen.gone.push(...endpoints); },
  });
  const push = { configured, publicKey: configured ? 'PUBLIC' : null, async send(sub, payload) {
    if (fail[sub.endpoint]) throw Object.assign(new Error('push service said no'), { statusCode: fail[sub.endpoint] });
    seen.sent.push([sub.endpoint, payload]);
  } };
  return { seen, deps: { createDb, push } };
}

test('push: the browser can ask for the public key, and learns when alerts are not set up', async () => {
  const on = await (await handlePush(new Request('https://example.test/api/push'), fakes().deps)).json();
  assert.deepEqual(on, { configured: true, publicKey: 'PUBLIC' });
  const off = await (await handlePush(new Request('https://example.test/api/push'), fakes({ configured: false }).deps)).json();
  assert.deepEqual(off, { configured: false, publicKey: null });
});

test('push: sends to every device the database allows, with no message text in the alert', async () => {
  const { seen, deps } = fakes();
  const res = await handlePush(post({ to: TO, kind: 'message' }), deps);
  assert.deepEqual(await res.json(), { configured: true, sent: 2 });
  assert.deepEqual(seen.asked, [[TO, 'message']]);
  assert.deepEqual(seen.sent.map(([endpoint]) => endpoint), SUBS.map((s) => s.endpoint));
  assert.deepEqual(seen.sent[0][1], { title: 'Astro Book', body: 'Asha sent you a message', url: `/chats/${ACTOR}`, tag: `message:${ACTOR}` });
});

test('push: nothing is sent when the database says no alert is due, or when alerts are not set up', async () => {
  const none = fakes({ target: null });
  assert.deepEqual(await (await handlePush(post({ to: TO, kind: 'match' }), none.deps)).json(), { configured: true, sent: 0 });
  assert.equal(none.seen.sent.length, 0);
  const off = fakes({ configured: false });
  assert.deepEqual(await (await handlePush(post({ to: TO, kind: 'match' }), off.deps)).json(), { configured: false, sent: 0 });
  assert.equal(off.seen.asked.length, 0, 'the database is not even asked');
});

test('push: a device whose address is gone is forgotten; other failures are left alone', async () => {
  const { seen, deps } = fakes({ fail: { 'https://push.example.test/a': 410 } });
  assert.deepEqual(await (await handlePush(post({ to: TO, kind: 'message' }), deps)).json(), { configured: true, sent: 1 });
  assert.deepEqual(seen.gone, ['https://push.example.test/a']);
  const busy = fakes({ fail: { 'https://push.example.test/a': 500 } });
  await handlePush(post({ to: TO, kind: 'message' }), busy.deps);
  assert.deepEqual(busy.seen.gone, []);
});

test('push: needs a sign-in, a real id and a known kind', async () => {
  assert.equal((await handlePush(post({ to: TO, kind: 'message' }, null), fakes().deps)).status, 401);
  assert.equal((await handlePush(post({ to: TO, kind: 'message' }, 'bad'), fakes().deps)).status, 401);
  assert.equal((await handlePush(post({ to: 'someone', kind: 'message' }), fakes().deps)).status, 400);
  assert.equal((await handlePush(post({ to: TO, kind: 'shout' }), fakes().deps)).status, 400);
});

test('push text: every kind has words, Hindi readers get Hindi, a missing name still reads well', () => {
  for (const kind of PUSH_KINDS) {
    const en = pushText(kind, { name: 'Asha', actor: ACTOR, language: 'en' });
    assert.ok(en.body.length > 5 && !en.body.includes('{0}'), kind);
    assert.match(en.url, /^\//);
    const hi = pushText(kind, { name: 'Asha', actor: ACTOR, language: 'hi' });
    assert.notEqual(hi.body, en.body, `${kind} has Hindi`);
    assert.ok(!hi.body.includes('{0}'));
  }
  assert.equal(pushText('message', { name: '', actor: ACTOR, language: 'en' }).body, 'Someone sent you a message');
  assert.equal(pushText('message', { name: 'Dev', actor: ACTOR, language: 'hg' }).body, 'Dev ne tumhe message bheja', 'Hinglish readers get Hinglish');
  assert.equal(pushText('photo_approved', { language: 'hg' }).body, 'Tumhari photo approve ho gayi');
  assert.equal(pushText('match', { name: 'Dev', actor: ACTOR, language: 'gu' }).body, 'You and Dev matched', 'other languages fall back to English');
  assert.equal(pushText('photo_approved', { name: '', actor: null }).url, '/notifications');
});

test('push keys: a pair made in the browser, the way the admin page makes it, is accepted by the sending library', async () => {
  const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64url(await webcrypto.subtle.exportKey('raw', pair.publicKey));
  const privateKey = (await webcrypto.subtle.exportKey('jwk', pair.privateKey)).d;
  const push = createPush({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey });
  assert.equal(push.configured, true);
  assert.equal(createPush({ VAPID_PUBLIC_KEY: publicKey }).configured, false, 'both halves are needed');

  // A stand-in browser subscription, then build (not send) a real, signed, encrypted request for it.
  const device = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sub = { endpoint: 'https://push.example.test/device', keys: { p256dh: b64url(await webcrypto.subtle.exportKey('raw', device.publicKey)), auth: b64url(webcrypto.getRandomValues(new Uint8Array(16))) } };
  const details = webpush.generateRequestDetails(sub, JSON.stringify(pushText('match', { name: 'Dev', actor: ACTOR })), { vapidDetails: { subject: 'https://astro-book-app.netlify.app', publicKey, privateKey } });
  assert.match(details.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(details.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(details.body.length > 50);
});
