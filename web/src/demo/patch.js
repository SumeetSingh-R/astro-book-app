// Stand-ins for the three parts of the database client that are not plain requests:
// the live socket, photo storage, and signing in with Google.
import { supabase } from '../lib/supabase.js';
import { on, uploads } from './bus.js';
import { sessionFor } from './backend.js';

// ---- live socket: channels that the stand-in backend can speak into
const channels = new Set();
const fits = (filter, row) => { if (!filter) return true; const [column, rest] = filter.split('=eq.'); return String(row?.[column]) === rest; };
supabase.channel = (name) => {
  const channel = {
    name, state: 'closed', binds: [],
    on(type, filter, cb) { this.binds.push({ type, filter, cb }); return this; },
    subscribe(cb) { this.state = 'joined'; channels.add(this); setTimeout(() => cb?.('SUBSCRIBED'), 0); return this; },
    send() { return Promise.resolve('ok'); },
    unsubscribe() { channels.delete(this); this.state = 'closed'; return Promise.resolve('ok'); },
  };
  return channel;
};
supabase.removeChannel = async (channel) => { channels.delete(channel); return 'ok'; };
supabase.realtime.setAuth = async () => {};
on((event) => {
  for (const channel of [...channels]) {
    for (const bind of channel.binds) {
      if (event.kind === 'pg' && bind.type === 'postgres_changes' && bind.filter.table === event.table && (bind.filter.event === '*' || bind.filter.event === event.type) && fits(bind.filter.filter, event.new)) {
        bind.cb({ eventType: event.type, new: { ...event.new }, old: {} });
      } else if (event.kind === 'broadcast' && bind.type === 'broadcast' && channel.name === event.topic && bind.filter.event === event.event) {
        bind.cb({ event: event.event, payload: event.payload });
      }
    }
  }
});

// ---- photo storage: pictures picked in this visit are kept in the page's memory
const storage = {
  from: () => ({
    upload: async (path, blob) => { uploads.set(path, URL.createObjectURL(blob)); return { data: { path }, error: null }; },
    remove: async (paths) => { for (const path of paths) { const url = uploads.get(path); if (url) URL.revokeObjectURL(url); uploads.delete(path); } return { data: [], error: null }; },
    createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: uploads.get(path) ?? null, error: uploads.has(path) ? null : 'not found' })), error: null }),
  }),
};
Object.defineProperty(supabase, 'storage', { get: () => storage });

/** View the prototype as one of the sample people. */
export async function signInAs(userId) {
  const session = sessionFor(userId);
  const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw error;
}
export const signOut = () => supabase.auth.signOut({ scope: 'local' });
supabase.auth.signInWithOAuth = async () => { await signInAs('u'); return { data: { provider: 'google', url: null }, error: null }; };
