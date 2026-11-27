// Astro Book service worker. Its only job is alerts: show one when the server sends it, and open
// the right page when it is tapped. It does not cache pages or change how the app loads.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* not ours; show the plain alert below */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Astro Book', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/notifications' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((w) => 'focus' in w);
    if (!open) return self.clients.openWindow(url);
    return (open.navigate ? open.navigate(url).catch(() => null) : Promise.resolve()).then(() => open.focus());
  }));
});
