// Alerts when Astro Book is closed (web push). Off until the site owner has added the push keys;
// until then every function here quietly reports that and the app behaves as before.
import { supabase } from './supabase.js';
import { api } from './api.js';
import { remember } from './cache.js';
import { msg } from './msg.js';

// Said by the alert itself, which is written on the server; listed here so it is translated with the rest.
msg('{0} sent you a message');

const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** True on an iPhone or iPad where the app was opened in the browser, not from the Home Screen. Alerts need the Home Screen there. */
export const needsHomeScreen = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);

const bytes = (base64url) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const serverKey = () => remember('pushKey', async () => (await api('/api/push')).publicKey ?? false, { maxAge: 10 * 60 * 1000 }).catch(() => false);
const registration = () => navigator.serviceWorker.getRegistration('/');
const save = (sub) => {
  const j = sub.toJSON();
  return supabase.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
};

/**
 * Where alerts stand on this device:
 * 'unconfigured' (the site has no keys yet), 'unsupported', 'home-screen' (iPhone: add to Home Screen first),
 * 'blocked' (refused in the browser), 'on', or 'off'.
 */
export async function pushStatus() {
  if (!(await serverKey())) return 'unconfigured';
  if (!supported()) return needsHomeScreen() ? 'home-screen' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Turn alerts on for this device. Must be called from a tap. Returns the new status. */
export async function enablePush() {
  const key = await serverKey();
  if (!key || !supported()) return pushStatus();
  if ((await Notification.requestPermission()) !== 'granted') return 'blocked';
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) }));
  const { error } = await save(sub);
  if (error) throw new Error('push');
  return 'on';
}

/** Turn alerts off for this device. Also used when signing out, so the next person here does not get them. */
export async function disablePush() {
  if (!supported()) return;
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch { /* nothing to undo */ }
}

/** If alerts are already on here, make sure the server still has this device's current address. Run once when the app opens. */
export async function syncPush() {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch { /* try again next time */ }
}

/**
 * Ask the server to alert someone about something the signed-in person just did
 * (kinds: message, match, invite_accepted, family_joined, family_suggested, photo_approved, photo_rejected).
 * The database checks it really happened. Never waits and never fails the action that caused it.
 */
export function sendPush(kind, to) {
  if (!to) return;
  api('/api/push', { method: 'POST', auth: true, body: { kind, to } }).catch(() => {});
}

/**
 * Make a push key pair on this device, for the site owner to copy into the server's settings.
 * Nothing is sent anywhere: the keys exist only on the screen until they are pasted.
 */
export async function makePushKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const publicKey = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
  return { publicKey, privateKey };
}
