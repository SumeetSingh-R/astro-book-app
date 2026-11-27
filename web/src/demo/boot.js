// First thing the prototype runs: from here on, every request the app makes is answered by the
// stand-in backend in this page. Nothing leaves the browser.
import { answer } from './backend.js';

const real = window.fetch.bind(window);
window.fetch = async (input, init) => (await answer(input, init)) ?? real(input, init);

// What the app should say and do where it would normally use its own web address.
globalThis.ASTRO_BOOK_SITE = { origin: 'https://astro-book-app.netlify.app', reloadAt: null };
