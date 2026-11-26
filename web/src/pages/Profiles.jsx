import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { formatBirth } from '../lib/format.js';
import { ListSkeleton } from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';

/** Shared loader for the signed-in user's saved birth profiles, their own first. */
export function useProfiles() {
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  async function load() {
    const { data, error: err } = await supabase
      .from('birth_profiles')
      .select('id, name, relation, birth_date, birth_time, time_unknown, place_name, is_self')
      .order('is_self', { ascending: false })
      .order('created_at', { ascending: true });
    if (err) setError('Your charts could not be loaded. Refresh the page to try again.');
    else setProfiles(data);
  }
  useEffect(() => { load(); }, []);
  return { profiles, error, reload: load };
}

/** Rising sign, Moon sign and birth star for charts that have already been drawn. */
function useChartFacts(profiles) {
  const [facts, setFacts] = useState({});
  useEffect(() => {
    if (!profiles?.length) return;
    supabase.from('charts')
      .select('birth_profile_id, lagna:data->vedic->lagna->>rashi, moon:data->vedic->>moonSign, star:data->vedic->dasha->>moonNakshatra')
      .eq('system', 'vedic')
      .then(({ data }) => setFacts(Object.fromEntries((data ?? []).map((r) => [r.birth_profile_id, r]))));
  }, [profiles]);
  return facts;
}

export default function Profiles() {
  const { profiles, error, reload } = useProfiles();
  const facts = useChartFacts(profiles);
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
        <div>
          <h1>My charts</h1>
          <p className="muted">Your own chart comes from your profile. Add family and friends to read or match their charts.</p>
        </div>
        <Link className="btn" to="/charts/new"><Icon name="plus" size={20} />Add a person</Link>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {actionError ? <p className="error" role="alert">{actionError}</p> : null}
      {!profiles && !error ? <ListSkeleton label="Loading your charts…" /> : null}
      {profiles?.length === 0 ? (
        <div className="card empty">
          <p>No charts yet. Start with your own: set up your profile and your chart is drawn from it.</p>
          <Link className="btn" to="/welcome">Set up my profile</Link>
        </div>
      ) : null}
      {profiles && profiles.length > 0 && !profiles.some((p) => p.is_self) ? (
        <p className="banner"><Icon name="star" size={20} /><span>Which chart is yours? <Link to="/welcome">Set up your profile</Link> to get your own daily reading.</span></p>
      ) : null}
      <ul className="people">
        {profiles?.map((p) => {
          const f = facts[p.id];
          return (
            <li key={p.id} className="card person">
              <div className="person-head">
                <div>
                  <h2><Link to={`/charts/${p.id}`}>{p.name}</Link></h2>
                  <p className="hint">{formatBirth(p)}, {p.place_name}</p>
                </div>
                {p.is_self ? <span className="tag">You</span> : p.relation ? <span className="tag plain">{p.relation}</span> : null}
              </div>
              <dl className="mini-facts">
                <div><dt>Rising sign</dt><dd>{f ? (f.lagna ?? 'Not known') : '…'}</dd></div>
                <div><dt>Moon sign</dt><dd>{f?.moon ?? '…'}</dd></div>
                <div><dt>Birth star</dt><dd>{f?.star ?? '…'}</dd></div>
              </dl>
              {confirming === p.id ? (
                <div className="actions msg">
                  <span><strong>Delete this chart?</strong></span>
                  <button type="button" className="btn small danger" onClick={() => remove(p.id)}>Delete it</button>
                  <button type="button" className="link" onClick={() => setConfirming(null)}>Keep it</button>
                </div>
              ) : (
                <div className="actions">
                  <Link className="btn small soft" to={`/charts/${p.id}`}>Read this chart<Icon name="go" size={18} /></Link>
                  {p.is_self
                    ? <Link to="/profile">Edit in my profile</Link>
                    : <button type="button" className="link quiet" onClick={() => setConfirming(p.id)}>Delete</button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {profiles && profiles.length >= 2 ? (
        <Link className="card cta" to="/match">
          <span className="cta-text"><Icon name="match" size={26} /><span><strong>Match two charts</strong><span>See how two people fit, test by test</span></span></span>
          <Icon name="go" />
        </Link>
      ) : null}
    </>
  );
}
