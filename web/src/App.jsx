import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import { setCacheScope, clearCache, pruneCache } from './lib/cache.js';
import { AccountProvider, useAccount } from './lib/account.jsx';
import { LanguageProvider, LanguageSwitch, useT, msg } from './lib/language.jsx';
import { InboxProvider, useInbox, Badge } from './lib/inbox.jsx';
import Icon from './components/Icon.jsx';
import { asset } from './lib/site.js';
import { DaySkeleton } from './components/Skeleton.jsx';
import Home from './pages/Home.jsx';
import Horoscope from './pages/Horoscope.jsx';
import Profiles from './pages/Profiles.jsx';
import NewProfile from './pages/NewProfile.jsx';
import ChartPage from './pages/ChartPage.jsx';
import Match from './pages/Match.jsx';
import SignIn from './pages/SignIn.jsx';
import Today from './pages/Today.jsx';
import Ask from './pages/Ask.jsx';
import Welcome from './pages/Welcome.jsx';
import Profile from './pages/Profile.jsx';
import Me from './pages/Me.jsx';
import Discover from './pages/Discover.jsx';
import Chats, { Chat } from './pages/Chats.jsx';
import Person from './pages/Person.jsx';
import Invite, { InviteLink } from './pages/Invite.jsx';
import Notifications from './pages/Notifications.jsx';
import Family, { FamilyLink } from './pages/Family.jsx';
import { Acting, useFamily } from './lib/acting.jsx';
import AdminPhotos from './pages/AdminPhotos.jsx';
import Admin from './pages/Admin.jsx';
import MeetPreferences from './pages/MeetPreferences.jsx';
import About from './pages/About.jsx';

const AuthContext = createContext({ session: null, loading: true });
export const useAuth = () => useContext(AuthContext);

/** If a sign-in provider sent the visitor back with an error, read it from the address bar. */
function returnedAuthError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('error_description') ?? hash.get('error_description');
}

function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: true });
  const [authError] = useState(returnedAuthError);
  const navigate = useNavigate();
  useEffect(() => {
    pruneCache();
    supabase.auth.getSession().then(({ data }) => { setCacheScope(data.session?.user.id); setState({ session: data.session, loading: false }); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Remembered data belongs to one person: switch to theirs, and wipe it when they sign out.
      if (event === 'SIGNED_OUT') clearCache();
      setCacheScope(session?.user.id);
      setState({ session, loading: false });
      if (event === 'SIGNED_IN' && session) {
        // After a Google sign-in the visitor lands on the home page; send them where they were going.
        let next = null;
        try { next = sessionStorage.getItem('postAuthPath'); sessionStorage.removeItem('postAuthPath'); } catch { /* storage unavailable */ }
        if (next && next.startsWith('/')) navigate(next, { replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  return <AuthContext.Provider value={{ ...state, authError }}>{children}</AuthContext.Provider>;
}

/** Pages that need an account send signed-out visitors to sign in, then bring them back. */
function Private({ children }) {
  const t = useT();
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <DaySkeleton label={t('Loading…')} />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}

/** Pages read from the person's own chart. Without a profile yet, they are asked for it once. */
function NeedsProfile({ children }) {
  const t = useT();
  const { self, loading } = useAccount();
  if (loading) return <DaySkeleton label={t('Loading your profile…')} />;
  if (!self) return <NoProfile />;
  return children;
}

/** No birth details yet: a family helper goes to the people they help; everyone else is asked for their details. */
function NoProfile() {
  const t = useT();
  const { session } = useAuth();
  const family = useFamily(session.user.id);
  if (!family.data && !family.error) return <DaySkeleton label={t('Loading your profile…')} />;
  return <Navigate to={family.data?.helping.length ? '/family' : '/welcome'} replace />;
}

const TABS = [['/today', msg('Today\'s vibe'), 'sun'], ['/discover', msg('Vibe match'), 'heart'], ['/chats', msg('Chats'), 'chat'], ['/charts', msg('My charts'), 'chart'], ['/ask', msg('Ask'), 'planet']];

function Shell({ children, overlay = null }) {
  const t = useT();
  const { session, authError } = useAuth();
  const { self } = useAccount();
  const { unread, fresh } = useInbox();
  const location = useLocation();
  const bare = location.pathname === '/sign-in' || location.pathname === '/welcome';
  const initial = (self?.name || session?.user?.email || 'A').trim().charAt(0).toUpperCase();
  return (
    <div className={`site${session ? ' signed-in' : ''}${bare ? ' bare' : ''}`}>
      {overlay}
      <header className="top">
        <Link to={session ? '/today' : '/'} className="brand" aria-label={t('Astro Book, home')}>
          <img className="owl" src={asset('brand/logo-symbol.svg')} alt="" />
          <img className="wordmark" src={asset('brand/logo-wordmark.svg')} alt="Astro Book" />
        </Link>
        {session ? (
          <nav className="main-nav" aria-label={t('Main')}>
            <NavLink to="/today">{t('Today\'s vibe')}</NavLink>
            <NavLink to="/discover">{t('Vibe match')}</NavLink>
            <NavLink to="/chats" aria-label={unread ? t('Chats, {0} new messages', [unread]) : undefined}>{t('Chats')}<Badge count={unread} /></NavLink>
            <NavLink to="/charts">{t('My charts')}</NavLink>
            <NavLink to="/match">{t('Kundli match')}</NavLink>
          </nav>
        ) : null}
        <div className="top-actions">
          <LanguageSwitch compact />
          {session && !bare ? (
            <NavLink to="/notifications" className="bell" aria-label={fresh ? t('Notifications, {0} new', [fresh]) : t('Notifications')}><Icon name="bell" size={22} /><Badge count={fresh} /></NavLink>
          ) : null}
          {session ? (
            <NavLink to="/profile" className="profile-chip" aria-label={t('Your profile')}>
              <span className="avatar" aria-hidden="true">{initial}</span>
              <span className="chip-name">{self?.name ?? t('Profile')}</span>
            </NavLink>
          ) : bare ? null : (
            <>
              <Link className="ghost" to="/sign-in">{t('Sign in')}</Link>
              <Link className="btn small" to="/sign-in" state={{ mode: 'sign-up' }}>{t('Get started')}</Link>
            </>
          )}
        </div>
      </header>
      <main className="page" key={location.pathname}>
        {!session && new URLSearchParams(location.search).get('deleted') === '1' ? <p className="notice" role="status">{t('Your account and everything in it has been deleted.')}</p> : null}
        {authError && !session ? <p className="error" role="alert">{t('Sign-in did not complete: {0}. Try again from the sign-in page.', [authError])}</p> : null}
        {children}
      </main>
      {bare ? null : (
        <footer className="foot">
          <div>
            <span>{t('Readings and answers are for reflection and guidance, not predictions or professional advice.')}</span>
            <Link to="/about">{t('About Astro Book')}</Link>
          </div>
        </footer>
      )}
      {session && !bare ? (
        <nav className="tabbar" aria-label={t('Main')}>
          {TABS.map(([to, label, icon]) => (
            <NavLink key={to} to={to} aria-label={to === '/chats' && unread ? t('Chats, {0} new messages', [unread]) : undefined}><span className="tab-icon"><Icon name={icon} />{to === '/chats' ? <Badge count={unread} /> : null}</span><span>{t(label)}</span></NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function Providers({ children }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  return (
    <AccountProvider userId={userId}>
      <LanguageProvider userId={userId}><InboxProvider userId={userId}>{children}</InboxProvider></LanguageProvider>
    </AccountProvider>
  );
}

/** Its own component so it reads the chosen language, which is set up inside the app, not around it. */
function NotFound() {
  const t = useT();
  return <><h1>{t('Page not found')}</h1><p><Link to="/">{t('Go to the home page')}</Link></p></>;
}

/**
 * The whole app. `Router` and `overlay` are only passed by the clickable prototype (src/demo),
 * which keeps its place in memory and adds a strip for jumping between screens.
 */
export default function App({ Router = BrowserRouter, overlay = null }) {
  return (
    <Router>
      <AuthProvider>
        <Providers>
          <Shell overlay={overlay}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/horoscope" element={<Horoscope />} />
              <Route path="/about" element={<About />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/welcome" element={<Private><Welcome /></Private>} />
              <Route path="/today" element={<Private><NeedsProfile><Today /></NeedsProfile></Private>} />
              <Route path="/ask" element={<Private><NeedsProfile><Ask /></NeedsProfile></Private>} />
              <Route path="/profile" element={<Private><NeedsProfile><Profile /></NeedsProfile></Private>} />
              <Route path="/discover" element={<Private><NeedsProfile><Discover /></NeedsProfile></Private>} />
              <Route path="/invite" element={<Private><NeedsProfile><Invite /></NeedsProfile></Private>} />
              <Route path="/m/:code" element={<Private><InviteLink /></Private>} />
              <Route path="/family" element={<Private><Family /></Private>} />
              <Route path="/f/:code" element={<Private><FamilyLink /></Private>} />
              <Route path="/family/:person/discover" element={<Private><Acting><Discover /></Acting></Private>} />
              <Route path="/family/:person/people/:id" element={<Private><Acting><Person /></Acting></Private>} />
              <Route path="/family/:person/chats" element={<Private><Acting><Chats /></Acting></Private>} />
              <Route path="/family/:person/chats/:id" element={<Private><Acting><Chat /></Acting></Private>} />
              <Route path="/notifications" element={<Private><Notifications /></Private>} />
              <Route path="/people/:id" element={<Private><NeedsProfile><Person /></NeedsProfile></Private>} />
              <Route path="/chats" element={<Private><NeedsProfile><Chats /></NeedsProfile></Private>} />
              <Route path="/chats/:id" element={<Private><NeedsProfile><Chat /></NeedsProfile></Private>} />
              <Route path="/matches" element={<Navigate to="/chats" replace />} />
              <Route path="/admin" element={<Private><Admin /></Private>} />
              <Route path="/admin/photos" element={<Private><AdminPhotos /></Private>} />
              <Route path="/me" element={<Private><NeedsProfile><Me /></NeedsProfile></Private>} />
              <Route path="/me/preferences" element={<Private><NeedsProfile><MeetPreferences /></NeedsProfile></Private>} />
              <Route path="/charts" element={<Private><Profiles /></Private>} />
              <Route path="/charts/new" element={<Private><NewProfile /></Private>} />
              <Route path="/charts/:id" element={<Private><ChartPage /></Private>} />
              <Route path="/match" element={<Private><Match /></Private>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Shell>
        </Providers>
      </AuthProvider>
    </Router>
  );
}
