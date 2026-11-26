import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { dms } from '../lib/format.js';
import { useProfiles } from './Profiles.jsx';
import Icon from '../components/Icon.jsx';

const KOOTA_ABOUT = {
  Varna: 'Outlook and values: whether the two see work and duty in a similar way.',
  Vashya: 'Mutual pull: how naturally each responds to the other.',
  Tara: 'Wellbeing together, counted from each birth star to the other.',
  Yoni: 'Physical and instinctive compatibility.',
  'Graha Maitri': 'Friendship of minds: how the lords of the two Moon signs get on.',
  Gana: 'Temperament: gentle, worldly or forceful natures.',
  Bhakoot: 'Family life and prosperity, from how far apart the Moon signs are.',
  Nadi: 'Health and children. The heaviest test of the eight.',
};
const BAND_NOTE = '18 is the traditional pass mark.';

function Ring({ total, max }) {
  const c = 2 * Math.PI * 54;
  return (
    <svg className="ring" role="img" aria-label={`${total} out of ${max} points`} viewBox="0 0 128 128">
      <defs><linearGradient id="ring-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ring-1)" /><stop offset="1" stopColor="var(--ring-2)" /></linearGradient></defs>
      <circle cx="64" cy="64" r="54" className="ring-track" />
      <circle cx="64" cy="64" r="54" className="ring-value" strokeDasharray={`${(total / max) * c} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" className="ring-number">{total}</text>
      <text x="64" y="84" textAnchor="middle" className="ring-of">of {max}</text>
    </svg>
  );
}

function VedicResult({ result, a, b }) {
  const [open, setOpen] = useState(null);
  const m = result.manglik;
  const marsLine = (name, who) => `${name}: ${who.isManglik ? 'Manglik' : 'not Manglik'} (Mars in house ${who.marsHouseFromLagna ?? who.marsHouseFromMoon} from the ${who.basis === 'Lagna' ? 'rising sign' : 'Moon'}).`;
  return (
    <div className="match-result msg" aria-live="polite">
      <div className="match-main">
        <section className="score-card" aria-label="Result">
          <Ring total={result.total} max={result.max} />
          <div>
            <h2>{result.band} match</h2>
            <p>{a.name} and {b.name}. {BAND_NOTE}</p>
          </div>
        </section>
        <div className="card">
          <p className="card-title">Doshas {result.doshas.length === 0 ? <span className="status good">None</span> : null}</p>
          {result.doshas.length === 0 ? <p className="hint">No Nadi, Bhakoot or Gana dosha.</p> : (
            <ul className="doshas">
              {result.doshas.map((d) => (
                <li key={d.name}>
                  <span className="dosha-head"><strong>{d.name}</strong><span className={d.cancelled ? 'status good' : 'status warn'}>{d.cancelled ? 'Cancelled' : 'Present'}</span></span>
                  <span>Present because {d.reason}.</span>
                  {d.cancelled
                    ? <span>Traditionally treated as cancelled because {d.cancellations.join(', and because ')}.</span>
                    : <span>None of the common cancellation rules apply.</span>}
                </li>
              ))}
            </ul>
          )}
          {result.doshas.length ? <p className="hint">A cancelled dosha still counts as 0 points in the score. Cancellation rules vary between traditions.</p> : null}
        </div>
        <div className="card">
          <p className="card-title">Manglik check</p>
          <p>{m.summary}</p>
          <p className="hint">{marsLine(a.name, m.groom)} {marsLine(b.name, m.bride)}</p>
        </div>
        {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
      </div>
      <section className="tests" aria-labelledby="tests-title">
        <h2 id="tests-title">The eight tests</h2>
        <p className="hint">Choose a test to read what it looks at.</p>
        {result.kootas.map((k) => {
          const isOpen = open === k.name;
          return (
            <button key={k.name} type="button" className={k.score === 0 ? 'test zero' : 'test'} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k.name)}>
              <span className="test-head"><strong>{k.name}</strong><strong className="test-score">{k.score} / {k.max}</strong></span>
              <span className="bar"><span style={{ width: `${(k.score / k.max) * 100}%` }} /></span>
              {isOpen ? <span className="test-about msg">{KOOTA_ABOUT[k.name]} {a.name}: {k.groom}. {b.name}: {k.bride}.</span> : null}
            </button>
          );
        })}
      </section>
    </div>
  );
}

function WesternResult({ result, a, b }) {
  return (
    <div className="match-result msg" aria-live="polite">
      <div className="match-main">
        <section className="score-card three" aria-label="Result">
          <div><p className="big">{result.summary.harmonious}</p><p>harmonious</p></div>
          <div><p className="big">{result.summary.challenging}</p><p>challenging</p></div>
          <div><p className="big">{result.summary.blending}</p><p>blending</p></div>
        </section>
        <div className="card">
          <p className="card-title">Sun, Moon, Venus and Mars</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Planet</th><th>{a.name}</th><th>{b.name}</th></tr></thead>
              <tbody>
                {['Sun', 'Moon', 'Venus', 'Mars'].map((p) => (
                  <tr key={p}><th scope="row">{p}</th><td>{result.a[p].sign} ({result.a[p].element})</td><td>{result.b[p].sign} ({result.b[p].element})</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
      </div>
      <section className="tests" aria-labelledby="links-title">
        <h2 id="links-title">Links between the two charts</h2>
        <p className="hint">Closest first.</p>
        <ul className="links">
          {result.aspects.map((x) => (
            <li key={`${x.a}-${x.b}`} className="card">
              <span>{a.name}'s {x.a} {x.type.toLowerCase()} {b.name}'s {x.b}<span className="hint"> (orb {dms(x.orb)})</span></span>
              <span className={`nature ${x.nature}`}>{x.nature}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function Match() {
  const { profiles, error: loadError } = useProfiles();
  const [system, setSystem] = useState('vedic');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);

  async function run(e) {
    e.preventDefault();
    setError(null);
    setOutcome(null);
    if (!first || !second) { setError('Choose two people to match.'); return; }
    if (first === second) { setError('Choose two different people.'); return; }
    setBusy(true);
    try {
      const body = system === 'vedic'
        ? { system, groomProfileId: first, brideProfileId: second }
        : { system, profileAId: first, profileBId: second };
      const data = await api('/api/match', { method: 'POST', auth: true, body });
      setOutcome({ system, ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = profiles?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_self ? ' (you)' : p.relation ? ` (${p.relation})` : ''}</option>);

  return (
    <>
      <div>
        <h1>Matching</h1>
        <p className="muted">Pick two people from your charts and see how they fit.</p>
      </div>
      {loadError ? <p className="error" role="alert">{loadError}</p> : null}
      {profiles && profiles.length < 2 ? (
        <div className="card empty">
          <p>Matching needs two saved charts. You have {profiles.length}. Add the other person to match with them.</p>
          <Link className="btn" to="/charts/new"><Icon name="plus" size={20} />Add a person</Link>
        </div>
      ) : null}
      {profiles && profiles.length >= 2 ? (
        <form className="match-form" onSubmit={run}>
          <div className="switch" role="group" aria-label="Astrology system">
            {[['vedic', 'Vedic, 36 points'], ['western', 'Western synastry']].map(([key, name]) => (
              <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'on' : undefined} onClick={() => { setSystem(key); setOutcome(null); }}>{name}</button>
            ))}
          </div>
          <div className="two">
            <label>{system === 'vedic' ? 'Groom' : 'First person'}
              <select value={first} onChange={(e) => setFirst(e.target.value)} required><option value="">Choose…</option>{options}</select>
            </label>
            <label>{system === 'vedic' ? 'Bride' : 'Second person'}
              <select value={second} onChange={(e) => setSecond(e.target.value)} required><option value="">Choose…</option>{options}</select>
            </label>
          </div>
          {system === 'vedic' ? <p className="hint">The traditional method scores some tests differently for the groom and the bride, so the roles matter.</p> : null}
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Matching…' : 'Match these two'}<Icon name="go" size={20} /></button>
        </form>
      ) : null}
      {outcome?.system === 'vedic' ? <VedicResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
      {outcome?.system === 'western' ? <WesternResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
    </>
  );
}
