import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Runs the real service worker file against a stand-in for the browser's worker scope.
function loadWorker({ windows = [] } = {}) {
  const listeners = {};
  const shown = [];
  const opened = [];
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting() {},
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }); } },
    clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async (url) => { opened.push(url); } },
  };
  new Function('self', readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'))(self);
  const fire = async (type, event) => { let wait; listeners[type]({ ...event, waitUntil: (p) => { wait = p; } }); await wait; };
  return { fire, shown, opened };
}

test('service worker: a push shows the alert the server wrote', async () => {
  const sw = loadWorker();
  await sw.fire('push', { data: { json: () => ({ title: 'Astro Book', body: 'Dev sent you a message', url: '/chats/abc', tag: 'message:abc' }) } });
  assert.deepEqual(sw.shown, [{ title: 'Astro Book', body: 'Dev sent you a message', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'message:abc', data: { url: '/chats/abc' } }]);
});

test('service worker: a push it cannot read still shows something, and never links off the site', async () => {
  const sw = loadWorker();
  await sw.fire('push', { data: { json: () => { throw new Error('not json'); } } });
  await sw.fire('push', { data: { json: () => ({ body: 'x', url: 'https://elsewhere.example/steal' }) } });
  assert.equal(sw.shown[0].title, 'Astro Book');
  assert.equal(sw.shown[0].data.url, '/notifications');
  assert.equal(sw.shown[1].data.url, '/notifications');
});

test('service worker: tapping an alert opens the page, in the open window when there is one', async () => {
  const closed = { n: 0 };
  const event = { notification: { close: () => { closed.n++; }, data: { url: '/chats/abc' } } };
  const none = loadWorker();
  await none.fire('notificationclick', event);
  assert.deepEqual(none.opened, ['/chats/abc']);

  const went = [];
  const win = { navigate: async (url) => { went.push(url); }, focus: async () => { went.push('focus'); } };
  const one = loadWorker({ windows: [win] });
  await one.fire('notificationclick', event);
  assert.deepEqual(went, ['/chats/abc', 'focus']);
  assert.deepEqual(one.opened, []);
  assert.equal(closed.n, 2);
});
