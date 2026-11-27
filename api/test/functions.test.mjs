import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

// Each file in netlify/functions is deployed as its own server function. A mistake in one of them
// (a duplicate import, a missing export) only shows at deploy time, so load them all here.
const dir = new URL('../../netlify/functions/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
  test(`server function ${file} loads and declares its path`, async () => {
    const mod = await import(new URL(file, dir));
    assert.equal(typeof mod.default, 'function');
    assert.match(mod.config?.path ?? '', /^\/api\//);
  });
}
