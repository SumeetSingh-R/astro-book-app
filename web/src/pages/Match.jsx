import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { dms } from '../lib/format.js';
import { useProfiles } from './Profiles.jsx';

function VedicResult({ result, a, b }) {
  return (
    <article className="match-result" aria-live="polite">
      <h2>{a.name} and {b.name}</h2>
      <p className="score"><strong>{result.total}</strong> out of {result.max} gunas. {result.band}.</p>
      <div className="meter" role="img" aria-label={`${result.total} of ${result.max}`}>
        <span style={{ width: `${(result.total / result.max) * 100}%` }} />
        <i style={{ left: '50%' }} title="Traditional minimum: 18" />
      </div>
      <div className="table-wrap">
        <table>
          <caption>Ashtakoot, koota by koota</caption>
          <thead><tr><th>Koota</th><th>{a.name} (groom)</th><th>{b.name} (bride)</th><th>Points</th></tr></thead>
          <tbody>
            {result.kootas.map((k) => (
              <tr key={k.name}><th scope="row">{k.name}</th><td>{k.groom}</td><td>{k.bride}</td><td>{k.score} / {k.max}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Doshas</h3>
      {result.doshas.length === 0 ? <p>No Nadi, Bhakoot or Gana dosha.</p> : (
        <ul className="doshas">
          {result.doshas.map((d) => (
            <li key={d.name}>
              <span className="dosha-head">
                <strong>{d.name}</strong>
                <span className={d.cancelled ? 'status cancelled' : 'status active'}>{d.cancelled ? 'Cancelled' : 'Present'}</span>
              </span>
              <span>Present because {d.reason}.</span>
              {d.cancelled
                ? <span>Traditionally treated as cancelled because {d.cancellations.join(', and because ')}.</span>
                : <span>None of the common cancellation rules apply.</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">A cancelled dosha still counts as 0 points in the score above. Cancellation rules vary between traditions, so an astrologer may read these differently.</p>
      <h3>Manglik</h3>
      <p>{result.manglik.summary}</p>
      <ul>
        <li>{a.name}: {result.manglik.groom.isManglik ? 'Manglik' : 'Not Manglik'} (Mars in house {result.manglik.groom.marsHouseFromLagna ?? result.manglik.groom.marsHouseFromMoon} from the {result.manglik.groom.basis === 'Lagna' ? 'lagna' : 'Moon'})</li>
        <li>{b.name}: {result.manglik.bride.isManglik ? 'Manglik' : 'Not Manglik'} (Mars in house {result.manglik.bride.marsHouseFromLagna ?? result.manglik.bride.marsHouseFromMoon} from the {result.manglik.bride.basis === 'Lagna' ? 'lagna' : 'Moon'})</li>
      </ul>
      {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
    </article>
  );
}

function WesternResult({ result, a, b }) {
  return (
    <article className="match-result" aria-live="polite">
      <h2>{a.name} and {b.name}</h2>
      <p className="score">{result.summary.harmonious} harmonious, {result.summary.challenging} challenging and {result.summary.blending} blending aspects between your charts.</p>
      <div className="table-wrap">
        <table>
          <caption>Sun, Moon, Venus and Mars</caption>
          <thead><tr><th>Planet</th><th>{a.name}</th><th>{b.name}</th></tr></thead>
          <tbody>
            {['Sun', 'Moon', 'Venus', 'Mars'].map((p) => (
              <tr key={p}><th scope="row">{p}</th><td>{result.a[p].sign} ({result.a[p].element})</td><td>{result.b[p].sign} ({result.b[p].element})</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Aspects, tightest first</h3>
      <ul className="aspects">
        {result.aspects.map((x) => (
          <li key={`${x.a}-${x.b}`} className={x.nature}>
            <span>{a.name}'s {x.a} {x.type.toLowerCase()} {b.name}'s {x.b}</span>
            <span className="muted">{x.nature}, orb {dms(x.orb)}</span>
          </li>
        ))}
      </ul>
      {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
    </article>
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

  const options = profiles?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.relation ? ` (${p.relation})` : ''}</option>);

  return (
    <>
      <h1>Matching</h1>
      <p className="lede">Vedic matching scores 36 gunas from the two Moon positions. Western matching compares the aspects between two charts.</p>
      {loadError ? <p className="error" role="alert">{loadError}</p> : null}
      {profiles && profiles.length < 2 ? (
        <div className="empty">
          <p>Matching needs two saved charts. You have {profiles.length}.</p>
          <Link className="button primary" to="/charts/new">Add a person</Link>
        </div>
      ) : null}
      {profiles && profiles.length >= 2 ? (
        <form className="birth-form" onSubmit={run}>
          <div className="segmented" role="tablist" aria-label="Astrology system">
            {[['vedic', 'Vedic (36 gunas)'], ['western', 'Western (synastry)']].map(([key, name]) => (
              <button key={key} type="button" role="tab" aria-selected={system === key} className={system === key ? 'on' : undefined} onClick={() => { setSystem(key); setOutcome(null); }}>{name}</button>
            ))}
          </div>
          <div className="row">
            <label>{system === 'vedic' ? 'Groom' : 'First person'}
              <select value={first} onChange={(e) => setFirst(e.target.value)} required><option value="">Choose…</option>{options}</select>
            </label>
            <label>{system === 'vedic' ? 'Bride' : 'Second person'}
              <select value={second} onChange={(e) => setSecond(e.target.value)} required><option value="">Choose…</option>{options}</select>
            </label>
          </div>
          {system === 'vedic' ? <p className="hint">The traditional method scores some kootas differently for the groom and the bride, so the roles matter.</p> : null}
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Matching…' : 'Match charts'}</button>
        </form>
      ) : null}
      {outcome?.system === 'vedic' ? <VedicResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
      {outcome?.system === 'western' ? <WesternResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
    </>
  );
}
