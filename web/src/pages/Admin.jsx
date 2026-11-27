import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useRemembered } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { formatDate } from '../lib/format.js';
import AdminPhotos from './AdminPhotos.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

// The admin portal is a staff tool, so its own text is in English only.
// Access is decided by the database (the meet_admins table), not by this page.

/** The signed-in person's admin role: 'owner', 'reviewer', or false. Null while loading. */
export function useAdminRole(userId) {
  return useRemembered(userId ? `adminRole:${userId}` : null, async () => (await supabase.rpc('meet_admin_role')).data ?? false, { maxAge: 5 * 60 * 1000 }).data;
}
const call = async (name, args) => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'That did not work. Try again.');
  return data;
};

function Overview() {
  const { data, error } = useRemembered('admin:overview', () => call('admin_overview'), { maxAge: 0 });
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <ListSkeleton label="Loading…" />;
  const stats = [
    ['Accounts', data.accounts, `${data.new_this_week} new this week`], ['Meet profiles', data.profiles, `${data.discoverable} visible in Discover`],
    ['Photos to review', data.photos_pending, `${data.photos_approved} approved, ${data.photos_rejected} rejected`], ['Likes', data.likes, `${data.matches} mutual matches`],
    ['Suspended profiles', data.suspended, 'Hidden from Discover by an admin'], ['Charts saved', data.charts_saved, `${data.questions_asked} questions asked`],
  ];
  return <ul className="stats">{stats.map(([label, value, note]) => <li key={label} className="card"><p className="note-label">{label}</p><p className="stat">{value}</p><p className="hint">{note}</p></li>)}</ul>;
}

function People({ owner }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const people = useRemembered(`admin:people:${query}`, () => call('admin_people', { p_search: query }), { maxAge: 0 });

  async function suspend(person, on) {
    setError(null);
    try {
      await call('admin_set_suspended', { p_user: person.user_id, p_on: on, p_reason: on ? reason : '' });
      people.set((list) => list.map((p) => (p.user_id === person.user_id ? { ...p, suspended: on, reason: on ? reason : '' } : p)));
      setReasonFor(null);
      setReason('');
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
        <label className="visually-hidden" htmlFor="admin-search">Search people</label>
        <input id="admin-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={owner ? 'Search by name, city or email' : 'Search by name or city'} />
        <button type="submit" className="btn small">Search</button>
      </form>
      {error || people.error ? <p className="error" role="alert">{error ?? people.error}</p> : null}
      {!people.data && !people.error ? <ListSkeleton label="Loading…" /> : null}
      {people.data?.length === 0 ? <p className="notice">No profiles found.</p> : null}
      <ul className="meet-list">
        {(people.data ?? []).map((p) => (
          <li key={p.user_id} className="card admin-row">
            <div>
              <p><strong>{p.display_name}, {p.age}</strong> <span className="hint">{[p.gender, p.city, p.looking_for.replace('_', ' ')].filter(Boolean).join(' · ')}</span></p>
              <p className="hint">{owner && p.email ? `${p.email} · ` : ''}Joined {formatDate(p.created_at)} · {p.photos} {p.photos === 1 ? 'photo' : 'photos'}{p.photos_pending ? `, ${p.photos_pending} to review` : ''}</p>
              <p className="pills">
                {p.suspended ? <span className="tag">Suspended{p.reason ? `: ${p.reason}` : ''}</span> : null}
                {!p.discoverable ? <span className="tag plain">Paused by the person</span> : null}
              </p>
              {reasonFor === p.user_id ? (
                <form className="admin-search" onSubmit={(e) => { e.preventDefault(); suspend(p, true); }}>
                  <label className="visually-hidden" htmlFor={`reason-${p.user_id}`}>Reason, shown to the person</label>
                  <input id={`reason-${p.user_id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason, shown to the person" />
                  <button type="submit" className="btn small danger">Suspend</button>
                  <button type="button" className="link" onClick={() => setReasonFor(null)}>Cancel</button>
                </form>
              ) : null}
            </div>
            {p.suspended ? <button type="button" className="btn small outline" onClick={() => suspend(p, false)}>Restore</button>
              : reasonFor === p.user_id ? null : <button type="button" className="btn small danger" onClick={() => { setReasonFor(p.user_id); setReason(''); }}>Suspend</button>}
          </li>
        ))}
      </ul>
    </>
  );
}

function Team({ userId }) {
  const team = useRemembered('admin:team', () => call('admin_team'), { maxAge: 0 });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('reviewer');
  const [note, setNote] = useState(null);

  async function add(e) {
    e.preventDefault();
    setNote(null);
    try {
      const found = await call('admin_grant', { p_email: email, p_role: role });
      if (!found) { setNote('No account uses that email yet. Ask them to create an Astro Book account first, then add them here.'); return; }
      setEmail('');
      team.refresh();
    } catch (err) { setNote(err.message); }
  }
  async function remove(member) {
    setNote(null);
    try { await call('admin_revoke', { p_user: member.user_id }); team.set((list) => list.filter((m) => m.user_id !== member.user_id)); } catch (err) { setNote(err.message); }
  }

  return (
    <>
      <p className="muted">Owners can do everything, including changing this list. Reviewers can review photos and suspend profiles, and cannot see emails.</p>
      {team.error ? <p className="error" role="alert">{team.error}</p> : null}
      <ul className="meet-list">
        {(team.data ?? []).map((m) => (
          <li key={m.user_id} className="card admin-row">
            <div><p><strong>{m.email}</strong></p><p className="hint">{m.role === 'owner' ? 'Owner' : 'Reviewer'} · added {formatDate(m.created_at)}</p></div>
            {m.user_id === userId ? <span className="tag plain">You</span> : <button type="button" className="btn small danger" onClick={() => remove(m)}>Remove</button>}
          </li>
        ))}
      </ul>
      <form className="card admin-add" onSubmit={add}>
        <h2>Add someone to the team</h2>
        <p className="hint">They need an Astro Book account first. They keep signing in the way they already do.</p>
        <div className="admin-search">
          <label className="visually-hidden" htmlFor="admin-email">Their email</label>
          <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" />
          <label className="visually-hidden" htmlFor="admin-role">Role</label>
          <select id="admin-role" value={role} onChange={(e) => setRole(e.target.value)}><option value="reviewer">Reviewer</option><option value="owner">Owner</option></select>
          <button type="submit" className="btn small">Add</button>
        </div>
        {note ? <p className="error" role="alert">{note}</p> : null}
      </form>
    </>
  );
}

/** The admin portal: overview, photo review, people, and the admin team. */
export default function Admin() {
  const { session } = useAuth();
  const userId = session.user.id;
  const role = useAdminRole(userId);
  const [tab, setTab] = useState('overview');
  if (role === null) return <ListSkeleton label="Loading…" />;
  if (!role) return <div className="sheet"><h1>Page not found</h1></div>;
  const tabs = [['overview', 'Overview'], ['photos', 'Photos'], ['people', 'People'], ...(role === 'owner' ? [['team', 'Team']] : [])];
  return (
    <>
      <div className="title-row">
        <div><h1>Admin</h1><p className="muted">Signed in as {session.user.email} · {role === 'owner' ? 'Owner' : 'Reviewer'}</p></div>
        <div className="pills" role="group" aria-label="Admin sections">
          {tabs.map(([key, name]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'pill on' : 'pill'} onClick={() => setTab(key)}>{name}</button>)}
        </div>
      </div>
      {tab === 'overview' ? <Overview /> : null}
      {tab === 'photos' ? <AdminPhotos embedded /> : null}
      {tab === 'people' ? <People owner={role === 'owner'} /> : null}
      {tab === 'team' && role === 'owner' ? <Team userId={userId} /> : null}
    </>
  );
}
