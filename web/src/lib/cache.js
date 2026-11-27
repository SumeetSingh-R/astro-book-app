// Remembered answers. Anything the app has loaded once is kept in memory and in the browser's
// storage, so going back to a page shows it at once; it is then refreshed quietly if it has aged.
// Everything is kept per signed-in person and wiped when they sign out.
import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'ab.cache.1.';
const KEEP_FOR = 45 * 24 * 3600 * 1000; // nothing is kept longer than this
const memory = new Map();
const inFlight = new Map();
let scope = 'anon';

const full = (key) => `${PREFIX}${scope}|${key}`;

function storageKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
  } catch { /* storage unavailable */ }
  return keys;
}

/** Whose answers are being remembered. Call with the signed-in person's id, or null when signed out. */
export function setCacheScope(userId) {
  scope = userId || 'anon';
}

/** Forget everything, for everyone, on this device (sign out). */
export function clearCache() {
  memory.clear();
  for (const k of storageKeys()) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}

/** Drop entries that are too old to be worth keeping. Run once when the app starts. */
export function pruneCache(now = Date.now()) {
  for (const k of storageKeys()) {
    try {
      const at = JSON.parse(localStorage.getItem(k))?.at ?? 0;
      const daily = k.includes('|today:') || k.includes('|horoscope:') || k.includes('|sky:');
      if (now - at > (daily ? 2 * 24 * 3600 * 1000 : KEEP_FOR)) localStorage.removeItem(k);
    } catch { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  }
}

/** The remembered entry for a key: { value, at } or null. */
export function peek(key) {
  if (!key) return null;
  const k = full(key);
  if (memory.has(k)) return memory.get(k);
  try {
    const entry = JSON.parse(localStorage.getItem(k));
    if (entry && 'value' in entry) { memory.set(k, entry); return entry; }
  } catch { /* storage unavailable or not JSON */ }
  return null;
}

/** Remember a value under a key. */
export function store(key, value) {
  const k = full(key);
  const entry = { value, at: Date.now() };
  memory.set(k, entry);
  const text = JSON.stringify(entry);
  try {
    localStorage.setItem(k, text);
  } catch {
    // Storage is full: make room by dropping the oldest half, then try once more.
    const aged = storageKeys().map((x) => { try { return [x, JSON.parse(localStorage.getItem(x))?.at ?? 0]; } catch { return [x, 0]; } })
      .sort((a, b) => a[1] - b[1]);
    for (const [x] of aged.slice(0, Math.ceil(aged.length / 2))) { try { localStorage.removeItem(x); } catch { /* ignore */ } }
    try { localStorage.setItem(k, text); } catch { /* keep it in memory only */ }
  }
}

/** Forget every key that starts with one of the given beginnings, e.g. forget('chart:abc', 'profiles'). */
export function forget(...beginnings) {
  const starts = beginnings.map((b) => `${PREFIX}${scope}|${b}`);
  const hit = (k) => starts.some((s) => k.startsWith(s));
  for (const k of [...memory.keys()]) if (hit(k)) memory.delete(k);
  for (const k of storageKeys()) if (hit(k)) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}

const ageLimit = (maxAge, value) => (typeof maxAge === 'function' ? maxAge(value) : maxAge);
const isFresh = (entry, maxAge) => Boolean(entry) && Date.now() - entry.at < ageLimit(maxAge, entry.value);

function loadShared(key, load) {
  const k = full(key);
  if (!inFlight.has(k)) {
    inFlight.set(k, Promise.resolve().then(load).then((value) => { store(key, value); return value; }).finally(() => inFlight.delete(k)));
  }
  return inFlight.get(k);
}

/** Get a value: the remembered one if it is fresh enough, otherwise load it and remember it. */
export async function remember(key, load, { maxAge = 5 * 60 * 1000 } = {}) {
  const entry = peek(key);
  if (isFresh(entry, maxAge)) return entry.value;
  return loadShared(key, load);
}

/**
 * Remembered data for a component. Shows what is remembered straight away, and reloads in the
 * background when it is older than `maxAge` (a number of milliseconds, or a function of the value).
 * A null key switches it off.
 * @returns {{ data, error, loading, refresh, set }}
 */
export function useRemembered(key, load, { maxAge = 5 * 60 * 1000 } = {}) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const ageRef = useRef(maxAge);
  ageRef.current = maxAge;
  const [state, setState] = useState(() => ({ key, data: peek(key)?.value ?? null, error: null }));
  // A new key means a different thing is being shown: start again from what is remembered for it.
  const current = state.key === key ? state : { key, data: peek(key)?.value ?? null, error: null };
  if (current !== state) setState(current);

  const run = useCallback((force) => {
    if (!key) return () => {};
    const entry = peek(key);
    if (!force && isFresh(entry, ageRef.current)) return () => {};
    let live = true;
    loadShared(key, () => loadRef.current())
      .then((value) => { if (live) setState({ key, data: value, error: null }); })
      // If an older answer is on screen, a failed refresh is not worth an error message.
      .catch((e) => { if (live && !entry) setState({ key, data: null, error: e?.message ?? 'Could not load. Try again.' }); });
    return () => { live = false; };
  }, [key]);

  useEffect(() => run(false), [run]);

  const refresh = useCallback(() => { run(true); }, [run]);
  const set = useCallback((next) => {
    setState((s) => {
      const value = typeof next === 'function' ? next(s.key === key ? s.data : null) : next;
      if (key) store(key, value);
      return { key, data: value, error: null };
    });
  }, [key]);

  return { data: current.data, error: current.error, loading: Boolean(key) && current.data === null && !current.error, refresh, set };
}
