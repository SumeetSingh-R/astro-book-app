import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { formatBirth } from '../lib/format.js';

/** Shared loader for the signed-in user's saved birth profiles. */
export function useProfiles() {
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  async function load() {
    const { data, error: err } = await supabase
      .from('birth_profiles')
      .select('id, name, relation, birth_date, birth_time, time_unknown, place_name')
      .order('created_at', { ascending: true });
    if (err) setError('Your charts could not be loaded. Refresh the page to try again.');
    else setProfiles(data);
  }
  useEffect(() => { load(); }, []);
  return { profiles, error, reload: load };
}

export default function Profiles() {
  const { profiles, error, reload } = useProfiles();
  const [confirming, setConfirming] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function remove(id) {
    setActionError(null);
    const { error: err } = await supabase.from('birth_profiles').delete().eq('id', id);
    if (err) setActionError('That chart could not be deleted. Try again.');
    setConfirming(null);
    reload();
  }

  return (
    <>
      <div className="title-row">
        <h1>My charts</h1>
        <Link className="button primary" to="/charts/new">Add a person</Link>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {actionError ? <p className="error" role="alert">{actionError}</p> : null}
      {!profiles && !error ? <p className="muted">Loading your charts…</p> : null}
      {profiles?.length === 0 ? (
        <div className="empty">
          <p>No charts saved yet. Add your own birth details first, then family members you want to match or follow.</p>
          <Link className="button primary" to="/charts/new">Add your birth details</Link>
        </div>
      ) : null}
      <ul className="profile-list">
        {profiles?.map((p) => (
          <li key={p.id}>
            <div>
              <h2><Link to={`/charts/${p.id}`}>{p.name}</Link>{p.relation ? <span className="relation"> ({p.relation})</span> : null}</h2>
              <p className="muted">{formatBirth(p)}, {p.place_name}</p>
            </div>
            <div className="actions">
              <Link className="button" to={`/charts/${p.id}`}>Open chart</Link>
              {confirming === p.id ? (
                <>
                  <button type="button" className="button danger" onClick={() => remove(p.id)}>Delete {p.name}'s chart</button>
                  <button type="button" className="link" onClick={() => setConfirming(null)}>Keep it</button>
                </>
              ) : (
                <button type="button" className="link" onClick={() => setConfirming(p.id)}>Delete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
