import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Home from './pages/Home.jsx';
import Horoscope from './pages/Horoscope.jsx';
import Profiles from './pages/Profiles.jsx';
import NewProfile from './pages/NewProfile.jsx';
import ChartPage from './pages/ChartPage.jsx';
import Match from './pages/Match.jsx';
import SignIn from './pages/SignIn.jsx';
import Today from './pages/Today.jsx';
import { LanguageProvider } from './lib/language.jsx';

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
  if (loading) return <p className="muted">Loading…</p>;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}

function Shell({ children }) {
  const { session, authError } = useAuth();
  return (
    <div className="site">
      <header className="cover">
        <Link to="/" className="brand" aria-label="Astro Book, home">
          <span className="plate"><img src="/brand/logo-symbol.svg" alt="" /></span>
          <img className="wordmark" src="/brand/logo-wordmark-light.svg" alt="Astro Book" />
        </Link>
        <nav aria-label="Main">
          {/* Signed in, "Today" is the reading for your own chart; signed out, it is the home page. */}
          {session ? <NavLink to="/today">Today</NavLink> : <NavLink to="/" end>Today</NavLink>}
          <NavLink to="/charts">My charts</NavLink>
          <NavLink to="/match">Matching</NavLink>
        </nav>
        <div className="account">
          {session
            ? <button type="button" className="link on-dark" onClick={() => supabase.auth.signOut()}>Sign out</button>
            : <Link to="/sign-in" className="on-dark">Sign in</Link>}
        </div>
      </header>
      <main className="page">
        {authError && !session ? <p className="error" role="alert">Sign-in did not complete: {authError}. Try again from the sign-in page.</p> : null}
        {children}
      </main>
      <footer className="colophon">
        <div className="colophon-grid">
          <div>
            <p className="colophon-name">Astro Book</p>
            <p>Your kundli in plain words, answers from your own chart, matching and a reading for each day.</p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <Link to={session ? '/today' : '/'}>Today</Link>
            <Link to="/charts">My charts</Link>
            <Link to="/match">Matching</Link>
          </nav>
          <nav aria-label="About">
            <h2>About</h2>
            <a href="https://github.com/SumeetSingh-R/astro-book-app">Source code</a>
            <a href="https://github.com/SumeetSingh-R/astro-book-app/blob/main/LICENSE">Licence (AGPL-3.0)</a>
            <a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a>
            <a href="https://www.geonames.org/">Place data: GeoNames (CC BY 4.0)</a>
          </nav>
        </div>
        <p className="colophon-small">Vedic charts use the Lahiri ayanamsa. Readings and answers are written by an AI model from calculated chart facts. They are for reflection and guidance, not predictions or professional advice. Astro Book is free, open-source software.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/today" element={<Private><Today /></Private>} />
            <Route path="/horoscope" element={<Horoscope />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/charts" element={<Private><Profiles /></Private>} />
            <Route path="/charts/new" element={<Private><NewProfile /></Private>} />
            <Route path="/charts/:id" element={<Private><ChartPage /></Private>} />
            <Route path="/match" element={<Private><Match /></Private>} />
            <Route path="*" element={<><h1>Page not found</h1><p><Link to="/">Go to today's page</Link></p></>} />
          </Routes>
        </Shell>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
