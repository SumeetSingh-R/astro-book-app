// A small key-value store for things worked out once and reused by everyone, such as translations.
// On Netlify it is Netlify Blobs (kept with the site, written only by these functions, no extra
// account or key). Anywhere else (local preview, tests) it is plain memory.
const memory = new Map();

export const memoryStore = (map = memory) => ({
  kind: 'memory',
  async get(key) { return map.has(key) ? structuredClone(map.get(key)) : null; },
  async set(key, value) { map.set(key, structuredClone(value)); },
});

let shared;
export async function createStore() {
  if (shared) return shared;
  try {
    const { getStore } = await import('@netlify/blobs');
    const blobs = getStore({ name: 'astro-book', consistency: 'strong' });
    await blobs.get('ping'); // throws at once when not running on Netlify
    shared = {
      kind: 'blobs',
      async get(key) { return (await blobs.get(key, { type: 'json' })) ?? null; },
      async set(key, value) { await blobs.setJSON(key, value); },
    };
  } catch {
    shared = memoryStore();
  }
  return shared;
}
