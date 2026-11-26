import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Home from './pages/Home.jsx';
import Horoscope from './pages/Horoscope.jsx';
import Profiles from './pages/Profiles.jsx';
import NewProfile from './pages/NewProfile.jsx';
import ChartPage from './pages/ChartPage.jsx';
import Match from './pages/Match.jsx';
import SignIn from './pages/SignIn.jsx';

const AuthContext = createContext({ session: null, loading: true });
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: true });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
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
  const { session } = useAuth();
  return (
    <div className="booklet">
      <header className="cover">
        <Link to="/" className="brand">Astro Booklet</Link>
        <nav aria-label="Main">
          <NavLink to="/" end>Today</NavLink>
          <NavLink to="/charts">My charts</NavLink>
          <NavLink to="/match">Matching</NavLink>
          <NavLink to="/horoscope">Horoscope</NavLink>
        </nav>
        <div className="account">
          {session
            ? <button type="button" className="link on-dark" onClick={() => supabase.auth.signOut()}>Sign out</button>
            : <Link to="/sign-in" className="on-dark">Sign in</Link>}
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="colophon">
        <p>Calculated with Swiss Ephemeris. Vedic charts use the Lahiri ayanamsa. Readings are for reflection and guidance, not a substitute for professional advice.</p>
        <p>Astro Booklet is free, open-source software under the AGPL-3.0 licence: <a href="https://github.com/SumeetSingh-R/astro-booklet">get the source code</a>. Place data from <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0).</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/horoscope" element={<Horoscope />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/charts" element={<Private><Profiles /></Private>} />
            <Route path="/charts/new" element={<Private><NewProfile /></Private>} />
            <Route path="/charts/:id" element={<Private><ChartPage /></Private>} />
            <Route path="/match" element={<Private><Match /></Private>} />
            <Route path="*" element={<><h1>Page not found</h1><p><Link to="/">Go to today's page</Link></p></>} />
          </Routes>
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}
