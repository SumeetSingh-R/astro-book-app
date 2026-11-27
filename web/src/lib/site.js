// The few things that depend on where the app is served from. The clickable prototype
// (src/demo) sets ASTRO_BOOK_SITE to stand in for them; the live site uses the page's own address.

/** The site's address, for links people copy and send. */
export const siteOrigin = () => globalThis.ASTRO_BOOK_SITE?.origin ?? window.location.origin;

/** Load a page afresh, leaving the current state behind (used after an account is deleted). */
export function reloadAt(path) {
  if (globalThis.ASTRO_BOOK_SITE?.reloadAt) globalThis.ASTRO_BOOK_SITE.reloadAt(path);
  else window.location.replace(path);
}

/** The address of a file shipped beside the app, such as the logo. */
export const asset = (path) => `${import.meta.env?.BASE_URL ?? '/'}${path}`;
