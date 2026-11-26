import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../App.jsx';
import Icon from '../components/Icon.jsx';

const BENEFITS = [['sun', 'A reading for each day, made from your own chart'], ['chat', 'Answers to your questions, in plain words'], ['lock', 'Your birth details saved once, private to you']];

export default function SignIn() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from ?? '/today';
  const [mode, setMode] = useState(location.state?.mode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const up = mode === 'sign-up';

  if (session) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (up) {
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (err) throw err;
        if (!data.session) { setSent(true); return; }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'That email and password don\'t match an account.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    // Remember where to go after Google sends the visitor back to the site.
    try { sessionStorage.setItem('postAuthPath', from); } catch { /* storage unavailable */ }
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (err) setError('Google sign-in could not start. Try again, or use email and password.');
  }

  return (
    <div className="auth">
      <section className="auth-side" aria-hidden="true">
        <img className="float" src="/brand/logo-symbol.svg" alt="" />
        <p className="auth-headline">Your chart, kept in one place</p>
        <ul>
          {BENEFITS.map(([icon, text]) => <li key={text}><Icon name={icon} size={20} />{text}</li>)}
        </ul>
      </section>
      <section className="auth-card">
        {sent ? (
          <>
            <h1>Confirm your email</h1>
            <p className="muted">A confirmation link is on its way to {email}. Open it to finish creating your account, then sign in here.</p>
            <button type="button" className="btn" onClick={() => { setSent(false); setMode('sign-in'); }}>Back to sign in</button>
          </>
        ) : (
          <>
            <div>
              <h1>{up ? 'Create your account' : 'Welcome back'}</h1>
              <p className="muted">{up ? 'It takes a minute. Next, we ask for your birth details once.' : 'Sign in to see your day and your charts.'}</p>
            </div>
            <div className="switch" role="group" aria-label="Account">
              <button type="button" aria-pressed={!up} className={!up ? 'on' : undefined} onClick={() => setMode('sign-in')}>Sign in</button>
              <button type="button" aria-pressed={up} className={up ? 'on' : undefined} onClick={() => setMode('sign-up')}>Create account</button>
            </div>
            <button type="button" className="btn outline" onClick={google}><span className="g" aria-hidden="true">G</span>{up ? 'Sign up with Google' : 'Continue with Google'}</button>
            <p className="or"><span>or use your email</span></p>
            <form onSubmit={submit} className="auth-form">
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={up ? 'new-password' : 'current-password'} placeholder={up ? 'At least 8 characters' : ''} /></label>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Please wait…' : up ? 'Create my account' : 'Sign in'}<Icon name="go" size={20} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
