import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { forget } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount, toRow } from '../lib/account.jsx';
import { LanguageSwitch, useT } from '../lib/language.jsx';
import BirthForm from '../components/BirthForm.jsx';
import Icon from '../components/Icon.jsx';
import { formatBirth } from '../lib/format.js';

function pendingBirth() {
  try { return JSON.parse(sessionStorage.getItem('pendingBirth')); } catch { return null; }
}

/** First sign-in: the person's own birth details, asked once and kept as their profile. */
export default function Welcome() {
  const t = useT();
  const { session } = useAuth();
  const { self, loading, reload } = useAccount();
  const navigate = useNavigate();
  const [initial] = useState(() => {
    const meta = session.user.user_metadata ?? {};
    return { ...(pendingBirth() ?? {}), name: meta.full_name ?? meta.name ?? '' };
  });

  // Someone who saved their own chart before profiles existed can simply point to it.
  const [saved, setSaved] = useState([]);
  const [pickError, setPickError] = useState(null);
  useEffect(() => {
    supabase.from('birth_profiles').select('id, name, birth_date, birth_time, time_unknown, place_name').order('created_at').then(({ data }) => setSaved(data ?? []));
  }, []);
  async function choose(id) {
    setPickError(null);
    const { error } = await supabase.from('birth_profiles').update({ is_self: true }).eq('id', id);
    if (error) { setPickError(t('That could not be saved. Try again.')); return; }
    forget('profiles');
    await reload();
    navigate('/today', { replace: true });
  }

  if (!loading && self) return <Navigate to="/today" replace />;

  async function save(values) {
    const { error } = await supabase.from('birth_profiles').insert({ user_id: session.user.id, ...toRow(values), is_self: true });
    if (error) throw new Error(t('Your profile could not be saved. Check the details and try again.'));
    try { sessionStorage.removeItem('pendingBirth'); } catch { /* storage unavailable */ }
    forget('profiles');
    await reload();
    navigate('/today', { replace: true });
  }

  return (
    <div className="sheet">
      <div>
        <p className="step">{t('Last step')}</p>
        <h1>{t('Let\'s set up your profile')}</h1>
        <p className="muted">{t('Tell us when and where you were born. We ask once, save it to your profile, and use it for your chart, your daily reading and your questions.')}</p>
      </div>
      {saved.length ? (
        <div className="card">
          <p><strong>{t('Already saved your own chart?')}</strong>{' '}{t('Choose it and you\'re done.')}</p>
          {pickError ? <p className="error" role="alert">{t(pickError)}</p> : null}
          <ul className="pick-list">
            {saved.map((p) => (
              <li key={p.id}><span><strong>{p.name}</strong><span className="muted">{formatBirth(p, t)}, {p.place_name}</span></span><button type="button" className="btn small outline" onClick={() => choose(p.id)}>{t('This is me')}</button></li>
            ))}
          </ul>
        </div>
      ) : null}
      <BirthForm kind="self" initial={initial} submitLabel={t('Save and see my day')} busyLabel={t('Saving…')} onSubmit={save}>
        <fieldset className="plain-fieldset">
          <legend>{t('Language for readings and answers')}</legend>
          <LanguageSwitch />
        </fieldset>
        <p className="private"><Icon name="lock" size={18} />{t('Your birth details are private to your account and are used only to draw your chart.')}</p>
      </BirthForm>
    </div>
  );
}
