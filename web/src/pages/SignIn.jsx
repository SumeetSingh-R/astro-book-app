import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../App.jsx';

export default function SignIn() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from ?? '/charts';
  const [mode, setMode] = useState(location.state?.mode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-up') {
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

  if (sent) {
    return (
      <>
        <h1>Confirm your email</h1>
        <p className="lede">A confirmation link is on its way to {email}. Open it to finish creating your account, then sign in here.</p>
        <button type="button" className="button" onClick={() => { setSent(false); setMode('sign-in'); }}>Back to sign in</button>
      </>
    );
  }

  return (
    <div className="narrow">
      <h1>{mode === 'sign-up' ? 'Create your account' : 'Sign in'}</h1>
      <p className="lede">An account keeps your charts and matches private to you.</p>
      <div className="segmented" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'on' : undefined} onClick={() => setMode('sign-in')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'on' : undefined} onClick={() => setMode('sign-up')}>Create account</button>
      </div>
      <form onSubmit={submit} className="birth-form">
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>
        {mode === 'sign-up' ? <p className="hint">At least 8 characters.</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
