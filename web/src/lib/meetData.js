// Loading and saving for Discover: the people one can meet, one's own match keys, likes.
import { supabase } from './supabase.js';
import { api } from './api.js';
import { remember, useRemembered, forget } from './cache.js';
import { keysFromChart, scoreBetween, fitsPreferences, blankPreferences } from './meet.js';

/** Work out the signed-in person's match keys from their own chart and save them, once per visit.
 * It remembers its answer under `meetKeys:<id>`, so a component must not wrap it in useRemembered with that same key:
 * the wrapper would end up waiting on itself. */
export function saveOwnKeys(userId, selfId) {
  return remember(`meetKeys:${userId}`, async () => {
    const { chart } = await remember(`chart:${selfId}`, () => api('/api/chart', { method: 'POST', auth: true, body: { birthProfileId: selfId } }), { maxAge: 7 * 24 * 3600 * 1000 });
    const keys = keysFromChart(chart);
    const { error } = await supabase.from('meet_keys').upsert({ user_id: userId, ...keys }, { onConflict: 'user_id' });
    if (error) throw new Error('keys');
    return keys;
  }, { maxAge: 12 * 3600 * 1000 });
}

/**
 * Everyone the person can meet, each with their kundli match and how they fit the person's
 * preferences, best match first. Null while loading.
 */
export function useDiscover(userId, me, selfId) {
  return useRemembered(me ? `discover:${userId}` : null, async () => {
    const [keys, people, prefs] = await Promise.all([
      saveOwnKeys(userId, selfId),
      supabase.rpc('discover_people'),
      supabase.from('meet_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (people.error) throw new Error('People could not be loaded. Refresh the page to try again.');
    const mine = { user_id: userId, gender: me.gender, keys };
    const wants = { ...blankPreferences(), ...(prefs.data ?? {}) };
    return (people.data ?? []).map((person) => {
      const match = scoreBetween(mine, person);
      return { ...person, match, fit: fitsPreferences(person, wants, match) };
    }).sort((a, b) => Number(b.fit.fits) - Number(a.fit.fits) || b.match.total - a.match.total);
  }, { maxAge: 30 * 1000 });
}

/** Record a like or a pass. Returns true when it was a like and they had already liked you. */
export async function decide(userId, person, kind) {
  const { error } = await supabase.from('meet_likes').upsert({ liker: userId, liked: person.user_id, kind }, { onConflict: 'liker,liked' });
  if (error) throw new Error('like');
  return kind === 'like' && person.liked_me;
}
export const forgetDiscover = (userId) => forget(`discover:${userId}`);
