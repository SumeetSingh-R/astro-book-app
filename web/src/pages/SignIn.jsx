import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { useT, msg } from '../lib/language.jsx';

const BENEFITS = [['sun', msg('A reading for each day, made from your own chart')], ['chat', msg('Answers to your questions, in plain words')], ['lock', msg('Your birth details saved once, private to you')]];

export default function SignIn() {
  const t = useT();
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
      setError(err.message === 'Invalid login credentials' ? t('That email and password don\'t match an account.') : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    // Remember where to go after Google sends the visitor back to the site.
    try { sessionStorage.setItem('postAuthPath', from); } catch { /* storage unavailable */ }
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (err) setError(t('Google sign-in could not start. Try again, or use email and password.'));
  }

  return (
    <div className="auth">
      <section className="auth-side" aria-hidden="true">
        <img className="float" src="/brand/logo-symbol.svg" alt="" />
        <p className="auth-headline">{t('Your chart, kept in one place')}</p>
        <ul>
          {BENEFITS.map(([icon, text]) => <li key={text}><Icon name={icon} size={20} />{t(text)}</li>)}
        </ul>
      </section>
      <section className="auth-card">
        {sent ? (
          <>
            <h1>{t('Confirm your email')}</h1>
            <p className="muted">{t('A confirmation link is on its way to {0}. Open it to finish creating your account, then sign in here.', [email])}</p>
            <button type="button" className="btn" onClick={() => { setSent(false); setMode('sign-in'); }}>{t('Back to sign in')}</button>
          </>
        ) : (
          <>
            <div>
              <h1>{up ? t('Create your account') : t('Welcome back')}</h1>
              <p className="muted">{up ? t('It takes a minute. Next, we ask for your birth details once.') : t('Sign in to see your day and your charts.')}</p>
            </div>
            <div className="switch" role="group" aria-label={t('Account')}>
              <button type="button" aria-pressed={!up} className={!up ? 'on' : undefined} onClick={() => setMode('sign-in')}>{t('Sign in')}</button>
              <button type="button" aria-pressed={up} className={up ? 'on' : undefined} onClick={() => setMode('sign-up')}>{t('Create account')}</button>
            </div>
            <button type="button" className="btn outline" onClick={google}><span className="g" aria-hidden="true">G</span>{up ? t('Sign up with Google') : t('Continue with Google')}</button>
            <p className="or"><span>{t('or use your email')}</span></p>
            <form onSubmit={submit} className="auth-form">
              <label>{t('Email')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
              <label>{t('Password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={up ? 'new-password' : 'current-password'} placeholder={up ? t('At least 8 characters') : ''} /></label>
              {error ? <p className="error" role="alert">{t(error)}</p> : null}
              <button type="submit" className="btn" disabled={busy}>
                {busy ? t('Please wait…') : up ? t('Create my account') : t('Sign in')}<Icon name="go" size={20} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
