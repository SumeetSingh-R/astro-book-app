import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { forget } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount, toFormValues, toRow } from '../lib/account.jsx';
import { LanguageSwitch, useT } from '../lib/language.jsx';
import BirthForm from '../components/BirthForm.jsx';
import Icon from '../components/Icon.jsx';

/** The person's own details. Saved once here, they feed Today, the chart, matching and questions. */
export default function Profile() {
  const t = useT();
  const { session } = useAuth();
  const { self, reload } = useAccount();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  async function save(values) {
    setSaved(false);
    const { error } = await supabase.from('birth_profiles').update(toRow(values)).eq('id', self.id);
    if (error) throw new Error(t('Your changes could not be saved. Check the details and try again.'));
    // New birth details mean a new chart, so everything worked out from the old one is forgotten.
    forget('profiles', 'chartFacts', `chart:${self.id}`, `reading:${self.id}`, `today:${self.id}`, 'match:');
    await reload();
    setSaved(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="sheet">
      <div className="profile-head">
        <span className="avatar large" aria-hidden="true">{self.name.trim().charAt(0).toUpperCase()}</span>
        <div>
          <h1>{self.name}</h1>
          <p className="muted">{session.user.email}</p>
        </div>
      </div>
      <p className="banner"><Icon name="check" size={20} />{t('Saved once, used everywhere: your chart, your daily reading, matching and your questions all read from this profile.')}</p>
      <Link className="card cta" to="/me">
        <span className="cta-text"><Icon name="heart" size={26} /><span><strong>{t('Meet and match')}</strong><span>{t('Add photos and details to the profile other people will see')}</span></span></span>
        <Icon name="go" size={20} />
      </Link>
      <h2>{t('Your birth details')}</h2>
      <BirthForm key={self.id} kind="self" initial={toFormValues(self)} submitLabel={t('Save changes')} busyLabel={t('Saving…')} onSubmit={save}
        done={saved ? t('Saved. Your chart and readings are up to date.') : null}>
        <fieldset className="plain-fieldset">
          <legend>{t('Language for readings and answers')}</legend>
          <LanguageSwitch />
        </fieldset>
        <p className="private"><Icon name="lock" size={18} />{t('Your birth details are private to your account and are used only to draw your chart.')}</p>
      </BirthForm>
      <button type="button" className="btn outline" onClick={signOut}>{t('Sign out')}</button>
    </div>
  );
}
