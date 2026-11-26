import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../App.jsx';
import { toRow } from '../lib/account.jsx';
import BirthForm from '../components/BirthForm.jsx';
import Icon from '../components/Icon.jsx';

function pendingBirth() {
  try { return JSON.parse(sessionStorage.getItem('pendingBirth')); } catch { return null; }
}

export default function NewProfile() {
  const { session } = useAuth();
  const navigate = useNavigate();

  async function save(values) {
    const { data, error } = await supabase
      .from('birth_profiles')
      .insert({ user_id: session.user.id, ...toRow(values), relation: values.relation || null })
      .select('id')
      .single();
    if (error) throw new Error('These birth details could not be saved. Check them and try again.');
    try { sessionStorage.removeItem('pendingBirth'); } catch { /* storage unavailable */ }
    navigate(`/charts/${data.id}`);
  }

  return (
    <div className="sheet">
      <div>
        <p><Link className="back" to="/charts"><Icon name="back" size={18} />My charts</Link></p>
        <h1>Add a person</h1>
        <p className="muted">Add someone whose chart you want to read or match with yours. The time of birth matters most; if nobody knows it, tick the box and the chart is still drawn.</p>
      </div>
      <BirthForm kind="person" initial={pendingBirth() ?? undefined} submitLabel="Save and draw their chart" busyLabel="Saving…" onSubmit={save} />
    </div>
  );
}
