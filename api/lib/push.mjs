// Alerts when the app is closed (web push).
// Sending needs a key pair made once by the site owner: the public half is handed to browsers, the
// private half signs every alert and lives only in the server's environment (VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY). Until both are set, alerts are simply off and nothing else changes.
import webpush from 'web-push';
import hi from '../../i18n/seed/hi.mjs';
import hg from '../../i18n/seed/hg.mjs';

export const PUSH_KINDS = ['message', 'match', 'invite_accepted', 'family_joined', 'family_suggested', 'photo_approved', 'photo_rejected'];

// The words are the same ones the Notifications page uses, so Hindi comes from the same hand-written list.
const TEXT = {
  message: ['{0} sent you a message', (a) => `/chats/${a}`],
  match: ['You and {0} matched', (a) => `/chats/${a}`],
  invite_accepted: ['{0} accepted your invite', () => '/invite'],
  family_joined: ['{0} joined as your family helper', () => '/family'],
  family_suggested: ['{0} suggested someone for you', () => '/discover'],
  photo_approved: ['Your photo was approved', () => '/me'],
  photo_rejected: ['A photo was not approved', () => '/me'],
};
const WORDS = { hi, hg };
const NOBODY = { en: 'Someone', hi: hi.Someone ?? 'Someone', hg: hg.Someone ?? 'Someone' };

/**
 * What an alert says and where it leads. It never includes what a message says: alerts show on lock screens.
 * Hindi and Hinglish readers get their own words; every other language gets English for now.
 */
export function pushText(kind, { name = '', actor = null, language = 'en' } = {}) {
  const [english, path] = TEXT[kind];
  const lang = WORDS[language] ? language : 'en';
  const template = WORDS[lang]?.[english] ?? english;
  return { title: 'Astro Book', body: template.replace('{0}', name || NOBODY[lang]), url: actor ? path(actor) : '/notifications', tag: `${kind}:${actor ?? ''}` };
}

/** The sender. `configured` is false until the owner has added both keys. */
export function createPush(env = process.env) {
  const publicKey = (env.VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY ?? '').trim();
  const subject = (env.VAPID_SUBJECT ?? env.URL ?? 'https://astro-book-app.netlify.app').trim();
  const configured = Boolean(publicKey && privateKey);
  return {
    configured,
    publicKey: configured ? publicKey : null,
    /** Send one alert to one browser. Rejects with `statusCode` 404 or 410 when that browser's address is gone. */
    send(sub, payload) {
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 3600, urgency: 'normal' },
      );
    },
  };
}
