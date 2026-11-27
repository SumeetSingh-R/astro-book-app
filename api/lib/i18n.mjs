// Wiring shared by the functions that translate: the AI model, the store, and the interface catalogue.
import { createAi } from './ai.mjs';
import { createStore } from './store.mjs';
import { createTranslator } from './translate.mjs';

let made;
/** The translator for this server instance. */
export const translator = async () => (made ??= createTranslator({ ai: createAi(), store: await createStore() }));

const seeds = {
  hi: () => import('../../i18n/seed/hi.mjs'),
};
let catalog;
/** The interface catalogue (every English string the web app shows) and the bundled translations for a language. */
export async function loadCatalog(lang) {
  catalog ??= (await import('../../i18n/catalog.mjs')).default;
  const seed = seeds[lang] ? (await seeds[lang]()).default : {};
  return { catalog, seed };
}
