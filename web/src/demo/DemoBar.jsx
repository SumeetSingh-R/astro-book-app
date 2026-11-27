import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { clearCache } from '../lib/cache.js';
import { PERSONAS } from './data.js';
import { reset } from './backend.js';
import { signInAs, signOut } from './patch.js';
import './demo.css';

// The strip across the top of the prototype: says plainly that this is sample data, and lets the
// viewer jump to any screen or look at the app as a different person. It is not part of the product.
const SCREENS = [
  ['Start here', [
    [null, '/', 'Landing page'], [null, '/sign-in', 'Sign in or create an account'], [null, '/horoscope', 'Horoscope by sign'], [null, '/about', 'About'],
  ]],
  ['Asha: her day and her charts', [
    ['u', '/today', 'Today\'s vibe'], ['u', '/charts', 'My charts'], ['u', '/charts/11111111-1111-4111-8111-111111111111', 'A chart, explained'], ['u', '/ask', 'Ask your chart'], ['u', '/match', 'Kundli match (two saved charts)'], ['u', '/profile', 'Account and birth details'],
  ]],
  ['Asha: Vibe match', [
    ['u', '/discover', 'Vibe match: swipe or browse'], ['u', '/people/p1', 'A full profile (Dev)'], ['u', '/chats', 'Chats'], ['u', '/chats/p1', 'A chat (Dev answers back)'], ['u', '/me', 'My Vibe match profile and photos'], ['u', '/me/preferences', 'Filters'], ['u', '/notifications', 'Notifications'],
  ]],
  ['Asha: Vibe check and Family mode', [
    ['u', '/invite', 'Vibe check: my link'], ['u', '/m/neil4vibe8check', 'A vibe check someone sent me'], ['u', '/family', 'Family mode: who helps me'],
  ]],
  ['Family, using it for Asha', [
    ['h1', '/family', 'Mum: people I help'], ['h1', '/family/u/discover', 'Mum: Vibe match for Asha'], ['h2', '/f/fam7k2qmnpq3', 'Papa: opening Asha\'s invite'],
  ]],
  ['Admin', [
    ['u', '/admin', 'Admin portal'],
  ]],
];

export default function DemoBar() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const me = PERSONAS.find((p) => p.id === session?.user?.id) ?? null;

  // After an account is deleted the app would reload at the home page; here it just goes there.
  useEffect(() => { globalThis.ASTRO_BOOK_SITE.reloadAt = (path) => navigate(path, { replace: true }); }, [navigate]);
  // Remember where the viewer was, so reopening the prototype returns there.
  useEffect(() => { try { sessionStorage.setItem('astrobook.prototype.at', location.pathname); } catch { /* fine without it */ } }, [location.pathname]);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  async function go(persona, path) {
    setBusy(true);
    try {
      if (persona && session?.user?.id !== persona) await signInAs(persona);
      navigate(path);
      window.scrollTo(0, 0);
    } finally { setBusy(false); setOpen(false); }
  }
  async function become(persona) {
    setBusy(true);
    try {
      if (persona) { await signInAs(persona); navigate(persona === 'u' ? '/today' : '/family'); } else { await signOut(); navigate('/'); }
    } finally { setBusy(false); setOpen(false); }
  }
  async function startOver() {
    setBusy(true);
    try { await signOut(); reset(); clearCache(); navigate('/'); } finally { setBusy(false); setOpen(false); }
  }

  return (
    <div className="proto">
      <div className="proto-bar">
        <p><strong>Prototype</strong><span> · sample data, nothing is sent or saved online</span></p>
        <p className="proto-who">{session ? `As ${me ? me.name : 'a new account'}` : 'Signed out'}</p>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Screens'}</button>
      </div>
      {open ? (
        <div className="proto-panel" role="dialog" aria-label="Prototype screens and people">
          <section>
            <h2>View as</h2>
            <div className="proto-people">
              {PERSONAS.map((p) => (
                <button key={p.id} type="button" disabled={busy} className={session?.user?.id === p.id ? 'on' : undefined} onClick={() => become(p.id)}><strong>{p.name}</strong><span>{p.note}</span></button>
              ))}
              <button type="button" disabled={busy} className={session ? undefined : 'on'} onClick={() => become(null)}><strong>Signed out</strong><span>A first-time visitor. Any email and password work on the sign-in page.</span></button>
            </div>
          </section>
          {SCREENS.map(([title, items]) => (
            <section key={title}>
              <h2>{title}</h2>
              <ul>{items.map(([persona, path, label]) => <li key={path + label}><button type="button" disabled={busy} className={location.pathname === path ? 'on' : undefined} onClick={() => go(persona, path)}>{label}</button></li>)}</ul>
            </section>
          ))}
          <section>
            <h2>About this prototype</h2>
            <p>This is the real app running on made-up people. Likes, chats, family help, photo review and settings all work and are remembered in this browser. Readings, answers and the sample chart are fixed samples; the live app works them out for each person. Languages other than Hinglish, English and Hindi, and alerts, need the live site.</p>
            <button type="button" className="proto-reset" disabled={busy} onClick={startOver}>Start over with fresh sample data</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
