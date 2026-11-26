// Local preview: serves the built web app (web/dist) and the API on one port, like Netlify does.
// Usage: npm run build && npm run preview
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleChart, handleMatch, handleHoroscope, handlePlaces, handlePreview } from '../api/lib/handlers.mjs';
import { createDb } from '../api/lib/db.mjs';

const dist = fileURLToPath(new URL('../web/dist/', import.meta.url));
let dataset;
const loadPlaces = async () => (dataset ??= (await import('../api/data/places.generated.mjs')).default);

const routes = {
  '/api/chart': (req) => handleChart(req, { createDb }),
  '/api/chart/preview': (req) => handlePreview(req),
  '/api/match': (req) => handleMatch(req, { createDb }),
  '/api/horoscope': (req) => handleHoroscope(req),
  '/api/places': (req) => handlePlaces(req, { loadPlaces }),
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const port = Number(process.env.PORT ?? 8888);
createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url, `http://localhost:${port}`);
  const route = routes[url.pathname];
  if (route) {
    const chunks = [];
    for await (const c of nodeReq) chunks.push(c);
    const hasBody = !['GET', 'HEAD'].includes(nodeReq.method);
    const res = await route(new Request(url, { method: nodeReq.method, headers: nodeReq.headers, body: hasBody ? Buffer.concat(chunks) : undefined }));
    nodeRes.writeHead(res.status, Object.fromEntries(res.headers));
    nodeRes.end(Buffer.from(await res.arrayBuffer()));
    return;
  }
  const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [join(dist, safe), join(dist, 'index.html')]) {
    try {
      const body = await readFile(candidate);
      nodeRes.writeHead(200, { 'content-type': types[extname(candidate)] ?? 'application/octet-stream' });
      nodeRes.end(body);
      return;
    } catch { /* try the SPA fallback */ }
  }
  nodeRes.writeHead(404).end('Not found');
}).listen(port, () => console.log(`Astro Book preview on http://localhost:${port}`));
