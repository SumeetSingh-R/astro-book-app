// Builds the clickable prototype: the same app, started from src/demo/main.jsx so that a stand-in
// backend answers everything. Paths are relative, because the prototype is hosted as a folder of
// files rather than at the root of a site. Output: web/dist-prototype (index.html plus its files).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { renameSync } from 'node:fs';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [react(), { name: 'prototype-index', closeBundle() { renameSync(`${root}dist-prototype/prototype.html`, `${root}dist-prototype/index.html`); } }],
  build: { outDir: 'dist-prototype', emptyOutDir: true, rollupOptions: { input: `${root}prototype.html` } },
});
