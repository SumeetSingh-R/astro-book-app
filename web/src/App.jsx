import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import { AccountProvider, useAccount } from './lib/account.jsx';
import { LanguageProvider } from './lib/language.jsx';
import Icon from './components/Icon.jsx';
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
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
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
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <DaySkeleton label="Loading…" />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}

/** Pages read from the person's own chart. Without a profile yet, they are asked for it once. */
function NeedsProfile({ children }) {
  const { self, loading } = useAccount();
  if (loading) return <DaySkeleton label="Loading your profile…" />;
  if (!self) return <Navigate to="/welcome" replace />;
  return children;
}

const TABS = [['/today', 'Today', 'sun'], ['/charts', 'My charts', 'chart'], ['/ask', 'Ask', 'chat'], ['/match', 'Matching', 'match']];

function Shell({ children }) {
  const { session, authError } = useAuth();
  const { self } = useAccount();
  const location = useLocation();
  const bare = location.pathname === '/sign-in' || location.pathname === '/welcome';
  const initial = (self?.name || session?.user?.email || 'A').trim().charAt(0).toUpperCase();
  return (
    <div className={`site${session ? ' signed-in' : ''}${bare ? ' bare' : ''}`}>
      <header className="top">
        <Link to={session ? '/today' : '/'} className="brand" aria-label="Astro Book, home">
          <img className="owl" src="/brand/logo-symbol.svg" alt="" />
          <img className="wordmark" src="/brand/logo-wordmark.svg" alt="Astro Book" />
        </Link>
        {session ? (
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/today">Today</NavLink>
            <NavLink to="/charts">My charts</NavLink>
            <NavLink to="/match">Matching</NavLink>
          </nav>
        ) : null}
        <div className="top-actions">
          {session ? (
            <NavLink to="/profile" className="profile-chip" aria-label="Your profile">
              <span className="avatar" aria-hidden="true">{initial}</span>
              <span className="chip-name">{self?.name ?? 'Profile'}</span>
            </NavLink>
          ) : bare ? null : (
            <>
              <Link className="ghost" to="/sign-in">Sign in</Link>
              <Link className="btn small" to="/sign-in" state={{ mode: 'sign-up' }}>Get started</Link>
            </>
          )}
        </div>
      </header>
      <main className="page" key={location.pathname}>
        {authError && !session ? <p className="error" role="alert">Sign-in did not complete: {authError}. Try again from the sign-in page.</p> : null}
        {children}
      </main>
      {bare ? null : (
        <footer className="foot">
          <div>
            <span>Readings and answers are for reflection and guidance, not predictions or professional advice.</span>
            <Link to="/about">About Astro Book</Link>
          </div>
        </footer>
      )}
      {session && !bare ? (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(([to, label, icon]) => (
            <NavLink key={to} to={to}><Icon name={icon} /><span>{label}</span></NavLink>
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
      <LanguageProvider userId={userId}>{children}</LanguageProvider>
    </AccountProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Providers>
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/horoscope" element={<Horoscope />} />
              <Route path="/about" element={<About />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/welcome" element={<Private><Welcome /></Private>} />
              <Route path="/today" element={<Private><NeedsProfile><Today /></NeedsProfile></Private>} />
              <Route path="/ask" element={<Private><NeedsProfile><Ask /></NeedsProfile></Private>} />
              <Route path="/profile" element={<Private><NeedsProfile><Profile /></NeedsProfile></Private>} />
              <Route path="/charts" element={<Private><Profiles /></Private>} />
              <Route path="/charts/new" element={<Private><NewProfile /></Private>} />
              <Route path="/charts/:id" element={<Private><ChartPage /></Private>} />
              <Route path="/match" element={<Private><Match /></Private>} />
              <Route path="*" element={<><h1>Page not found</h1><p><Link to="/">Go to the home page</Link></p></>} />
            </Routes>
          </Shell>
        </Providers>
      </AuthProvider>
    </BrowserRouter>
  );
}
