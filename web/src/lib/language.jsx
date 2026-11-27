import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { LANGUAGES, languageInfo, languageOf } from '../../../config/languages.mjs';
import { CATALOG_VERSION } from '../../../i18n/version.mjs';
import { setLocale } from './format.js';
import Icon from '../components/Icon.jsx';

// The language the whole app is read in: the interface, the readings and the answers.
// English text is the key. `t('Save')` gives the same words in the chosen language, or English
// while a translation is still on its way.
const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : text);
const LanguageContext = createContext({ language: 'en', setLanguage: () => {}, t: fill, ready: true });

/** [language, setLanguage] */
export const useLanguage = () => { const c = useContext(LanguageContext); return [c.language, c.setLanguage]; };
/** t(text, vars): the text in the chosen language. `vars` fills {name} or {0} placeholders. */
export const useT = () => useContext(LanguageContext).t;
export { msg } from './msg.js';

function stored() {
  try { return languageOf(localStorage.getItem('reading.language')); } catch { return 'en'; }
}
const dictKey = (language) => `ab.i18n.${language}`;
function storedDict(language) {
  try {
    const d = JSON.parse(localStorage.getItem(dictKey(language)));
    return d?.v === CATALOG_VERSION ? d : null;
  } catch { return null; }
}

/** Load the font that carries a language's script, once. */
function useScriptFont(language) {
  useEffect(() => {
    const { font } = languageInfo(language);
    document.documentElement.lang = language;
    document.documentElement.style.setProperty('--font-script', font ? `'${font}'` : "'Mukta'");
    if (!font) return;
    const id = `font-${font.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, '+')}:wght@400;500;700&display=swap`;
    document.head.appendChild(link);
  }, [language]);
}

export function LanguageProvider({ userId, children }) {
  const [language, setState] = useState(stored);
  const [dict, setDict] = useState(() => (language === 'en' ? null : storedDict(language)));
  const tries = useRef(0);
  useScriptFont(language);
  setLocale(languageInfo(language).locale);

  // Signed in, the choice lives with the account so it is the same on every device.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    supabase.from('profiles').select('language').eq('id', userId).maybeSingle().then(({ data }) => {
      if (live && data?.language) { setState(languageOf(data.language)); try { localStorage.setItem('reading.language', data.language); } catch { /* storage unavailable */ } }
    });
    return () => { live = false; };
  }, [userId]);

  // The words for the chosen language: from this device if it has them, otherwise from the server.
  useEffect(() => {
    if (language === 'en') { setDict(null); return undefined; }
    const have = storedDict(language);
    setDict(have);
    if (have?.complete) return undefined;
    let live = true;
    let timer;
    tries.current = 0;
    const load = async () => {
      try {
        const res = await fetch(`/api/i18n?lang=${language}&v=${CATALOG_VERSION}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!live) return;
        const next = { v: CATALOG_VERSION, complete: data.complete, strings: data.strings };
        setDict(next);
        try { localStorage.setItem(dictKey(language), JSON.stringify(next)); } catch { /* storage unavailable */ }
        if (data.complete) return;
      } catch { /* try again below */ }
      // A language being translated for the first time arrives in parts: ask again for the rest.
      tries.current += 1;
      if (live && tries.current < 8) timer = setTimeout(load, 12000);
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [language]);

  const setLanguage = useCallback((value) => {
    const next = languageOf(value);
    setState(next);
    try { localStorage.setItem('reading.language', next); } catch { /* storage unavailable */ }
    if (userId) supabase.from('profiles').update({ language: next }).eq('id', userId).then(() => {});
  }, [userId]);

  const value = useMemo(() => {
    const strings = language === 'en' ? null : dict?.strings ?? null;
    const t = (text, vars) => (typeof text === 'string' ? fill(strings?.[text] ?? text, vars) : text);
    return { language, setLanguage, t, ready: language === 'en' || Boolean(dict) };
  }, [language, dict, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The language picker: each language under its own name. */
export function LanguageSwitch({ compact = false }) {
  const [language, setLanguage] = useLanguage();
  const t = useT();
  return (
    <label className={compact ? 'lang-select compact' : 'lang-select'}>
      <Icon name="globe" size={18} />
      <span className="visually-hidden">{t('Language')}</span>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t('Language')}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.native}</option>)}
      </select>
    </label>
  );
}
