import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../App.jsx';
import BirthForm from '../components/BirthForm.jsx';

function pendingBirth() {
  try { return JSON.parse(sessionStorage.getItem('pendingBirth')); } catch { return null; }
}

export default function NewProfile() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pending = pendingBirth();

  async function save(values) {
    const { data, error } = await supabase
      .from('birth_profiles')
      .insert({
        user_id: session.user.id,
        name: values.name,
        relation: values.relation || null,
        birth_date: values.date,
        birth_time: values.time,
        time_unknown: values.timeUnknown,
        place_name: values.place.label,
        latitude: values.place.latitude,
        longitude: values.place.longitude,
        timezone: values.place.timezone,
      })
      .select('id')
      .single();
    if (error) throw new Error('These birth details could not be saved. Check them and try again.');
    try { sessionStorage.removeItem('pendingBirth'); } catch { /* storage unavailable */ }
    navigate(`/charts/${data.id}`);
  }

  return (
    <div className="narrow">
      <p><Link to="/charts">Back to my charts</Link></p>
      <h1>Add a person</h1>
      <p className="lede">Birth time matters: the lagna changes sign about every two hours. If the time is unknown, the chart is still drawn, without houses.</p>
      <BirthForm withName initial={pending ?? undefined} submitLabel="Save and draw chart" busyLabel="Saving…" onSubmit={save} />
    </div>
  );
}
