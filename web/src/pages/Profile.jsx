import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { forget } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useAccount, toFormValues, toRow } from '../lib/account.jsx';
import { LanguageSwitch, useT } from '../lib/language.jsx';
import BirthForm from '../components/BirthForm.jsx';
import Icon from '../components/Icon.jsx';
import { useAdminRole } from './Admin.jsx';
import { deleteAccount } from '../lib/photos.js';
import { disablePush } from '../lib/push.js';

/** Asks once, plainly, then deletes the signed-in person's account and everything in it. */
function DeleteAccount({ onCancel }) {
  const t = useT();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccount('delete_my_account');
    } catch (err) {
      setError(err.message === 'delete:last_owner'
        ? t('You are the only owner of the admin portal. Add another owner there first, then delete your account.')
        : t('Your account could not be deleted. Try again.'));
      setBusy(false);
      return;
    }
    await supabase.auth.signOut({ scope: 'local' }); // the account is gone; this only clears this device
    // A full reload, so nothing of the deleted account is left in the page's memory.
    window.location.replace('/?deleted=1');
  }
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <form className="modal-card report" onSubmit={run}>
        <h2 id="delete-title">{t('Delete your account?')}</h2>
        <p>{t('This removes, for good:')}</p>
        <ul className="plain-list">
          <li>{t('Your birth details, charts, readings and questions')}</li>
          <li>{t('Your meet-and-match profile, photos, likes and matches')}</li>
          <li>{t('Your chats, for you and for the people you chatted with')}</li>
        </ul>
        <label className="check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />{t('I understand this cannot be undone')}</label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" className="btn outline danger" disabled={!sure || busy}>{busy ? t('Deleting…') : t('Delete my account')}</button>
        <button type="button" className="link" onClick={onCancel}>{t('Keep my account')}</button>
      </form>
    </div>
  );
}

/** The person's own details. Saved once here, they feed Today, the chart, matching and questions. */
export default function Profile() {
  const t = useT();
  const { session } = useAuth();
  const { self, reload } = useAccount();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const role = useAdminRole(session.user.id);

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
    await disablePush(); // the next person on this device should not get these alerts
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
      <Link className="card cta" to="/family">
        <span className="cta-text"><Icon name="match" size={26} /><span><strong>{t('Family help')}</strong><span>{t('Invite a parent to look for matches with you')}</span></span></span>
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
      {role ? <Link className="btn outline" to="/admin">Admin portal</Link> : null}
      <button type="button" className="btn outline" onClick={signOut}>{t('Sign out')}</button>
      <div className="account-delete">
        <p className="hint">{t('You can delete your account and everything in it at any time.')}</p>
        <button type="button" className="link quiet" onClick={() => setDeleting(true)}>{t('Delete my account')}</button>
      </div>
      {deleting ? <DeleteAccount onCancel={() => setDeleting(false)} /> : null}
    </div>
  );
}
