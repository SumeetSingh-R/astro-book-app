// A tiny message line between the stand-in backend and the stand-in for the live socket,
// plus the photos picked in this visit (kept in memory only).
const listeners = new Set();
export const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = (event) => { for (const fn of [...listeners]) { try { fn(event); } catch { /* a listener that fails must not stop the rest */ } } };
export const uploads = new Map(); // storage path -> blob: URL
