import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { remember } from '../lib/cache.js';
import { dms } from '../lib/format.js';
import { useProfiles } from './Profiles.jsx';
import Icon from '../components/Icon.jsx';
import { useT, msg, useLanguage } from '../lib/language.jsx';

export const KOOTA_ABOUT = {
  Varna: msg('Outlook and values: whether the two see work and duty in a similar way.'),
  Vashya: msg('Mutual pull: how naturally each responds to the other.'),
  Tara: msg('Wellbeing together, counted from each birth star to the other.'),
  Yoni: msg('Physical and instinctive compatibility.'),
  'Graha Maitri': msg('Friendship of minds: how the lords of the two Moon signs get on.'),
  Gana: msg('Temperament: gentle, worldly or forceful natures.'),
  Bhakoot: msg('Family life and prosperity, from how far apart the Moon signs are.'),
  Nadi: msg('Health and children. The heaviest test of the eight.'),
};

export function Ring({ total, max }) {
  const t = useT();
  const c = 2 * Math.PI * 54;
  return (
    <svg className="ring" role="img" aria-label={t('{0} out of {1} points', [total, max])} viewBox="0 0 128 128">
      <defs><linearGradient id="ring-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ring-1)" /><stop offset="1" stopColor="var(--ring-2)" /></linearGradient></defs>
      <circle cx="64" cy="64" r="54" className="ring-track" />
      <circle cx="64" cy="64" r="54" className="ring-value" strokeDasharray={`${(total / max) * c} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" className="ring-number">{total}</text>
      <text x="64" y="84" textAnchor="middle" className="ring-of">{t('of {0}', [max])}</text>
    </svg>
  );
}

function VedicResult({ result, a, b }) {
  const t = useT();
  const [open, setOpen] = useState(null);
  const m = result.manglik;
  const marsLine = (name, who) => {
    const house = who.marsHouseFromLagna ?? who.marsHouseFromMoon;
    const line = who.basis === 'Lagna'
      ? (who.isManglik ? t('{0}: Manglik (Mars in house {1} from the rising sign).', [name, house]) : t('{0}: not Manglik (Mars in house {1} from the rising sign).', [name, house]))
      : (who.isManglik ? t('{0}: Manglik (Mars in house {1} from the Moon).', [name, house]) : t('{0}: not Manglik (Mars in house {1} from the Moon).', [name, house]));
    return line;
  };
  return (
    <div className="match-result msg" aria-live="polite">
      <div className="match-main">
        <section className="score-card" aria-label={t('Result')}>
          <Ring total={result.total} max={result.max} />
          <div>
            <h2>{t(result.band)}</h2>
            <p>{t('{0} and {1}. 18 is the traditional pass mark.', [a.name, b.name])}</p>
          </div>
        </section>
        <div className="card">
          <p className="card-title">{t('Doshas')}{' '}{result.doshas.length === 0 ? <span className="status good">{t('None')}</span> : null}</p>
          {result.doshas.length === 0 ? <p className="hint">{t('No Nadi, Bhakoot or Gana dosha.')}</p> : (
            <ul className="doshas">
              {result.doshas.map((d) => (
                <li key={d.name}>
                  <span className="dosha-head"><strong>{t(d.name)}</strong><span className={d.cancelled ? 'status good' : 'status warn'}>{d.cancelled ? t('Cancelled') : t('Present')}</span></span>
                  <span>{t('Present because {0}.', [d.reason])}</span>
                  {d.cancelled
                    ? <span>{t('Traditionally treated as cancelled because:')}{' '}{d.cancellations.join('; ')}.</span>
                    : <span>{t('None of the common cancellation rules apply.')}</span>}
                </li>
              ))}
            </ul>
          )}
          {result.doshas.length ? <p className="hint">{t('A cancelled dosha still counts as 0 points in the score. Cancellation rules vary between traditions.')}</p> : null}
        </div>
        <div className="card">
          <p className="card-title">{t('Manglik check')}</p>
          <p>{m.summary}</p>
          <p className="hint">{marsLine(a.name, m.groom)} {marsLine(b.name, m.bride)}</p>
        </div>
        {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
      </div>
      <section className="tests" aria-labelledby="tests-title">
        <h2 id="tests-title">{t('The eight tests')}</h2>
        <p className="hint">{t('Choose a test to read what it looks at.')}</p>
        {result.kootas.map((k) => {
          const isOpen = open === k.name;
          return (
            <button key={k.name} type="button" className={k.score === 0 ? 'test zero' : 'test'} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k.name)}>
              <span className="test-head"><strong>{t(k.name)}</strong><strong className="test-score">{k.score} / {k.max}</strong></span>
              <span className="bar"><span style={{ width: `${(k.score / k.max) * 100}%` }} /></span>
              {isOpen ? <span className="test-about msg">{t(KOOTA_ABOUT[k.name])} {a.name}: {t(k.groom)}. {b.name}: {t(k.bride)}.</span> : null}
            </button>
          );
        })}
      </section>
    </div>
  );
}

function WesternResult({ result, a, b }) {
  const t = useT();
  return (
    <div className="match-result msg" aria-live="polite">
      <div className="match-main">
        <section className="score-card three" aria-label={t('Result')}>
          <div><p className="big">{result.summary.harmonious}</p><p>{t('harmonious')}</p></div>
          <div><p className="big">{result.summary.challenging}</p><p>{t('challenging')}</p></div>
          <div><p className="big">{result.summary.blending}</p><p>{t('blending')}</p></div>
        </section>
        <div className="card">
          <p className="card-title">{t('Sun, Moon, Venus and Mars')}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('Planet')}</th><th>{a.name}</th><th>{b.name}</th></tr></thead>
              <tbody>
                {['Sun', 'Moon', 'Venus', 'Mars'].map((p) => (
                  <tr key={p}><th scope="row">{t(p)}</th><td>{t(result.a[p].sign)} ({t(result.a[p].element)})</td><td>{t(result.b[p].sign)} ({t(result.b[p].element)})</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {result.notes.map((n) => <p key={n} className="notice">{n}</p>)}
      </div>
      <section className="tests" aria-labelledby="links-title">
        <h2 id="links-title">{t('Links between the two charts')}</h2>
        <p className="hint">{t('Closest first.')}</p>
        <ul className="links">
          {result.aspects.map((x) => (
            <li key={`${x.a}-${x.b}`} className="card">
              <span>{t('{0}\'s {1}', [a.name, t(x.a)])}{' '}<em>{t(x.type)}</em>{' '}{t('{0}\'s {1}', [b.name, t(x.b)])}{' '}<span className="hint">({t('orb')}{' '}{dms(x.orb)})</span></span>
              <span className={`nature ${x.nature}`}>{x.nature}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function Match() {
  const t = useT();
  const [language] = useLanguage();
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
    if (!first || !second) { setError(t('Choose two people to match.')); return; }
    if (first === second) { setError(t('Choose two different people.')); return; }
    setBusy(true);
    try {
      const body = system === 'vedic'
        ? { system, groomProfileId: first, brideProfileId: second }
        : { system, profileAId: first, profileBId: second };
      const data = await remember(`match:${system}:${first}:${second}:${language}`, () => api('/api/match', { method: 'POST', auth: true, body: { ...body, language } }), { maxAge: 7 * 24 * 3600 * 1000 });
      setOutcome({ system, ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = profiles?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_self ? ` (${t('you')})` : p.relation ? ` (${p.relation})` : ''}</option>);

  return (
    <>
      <div>
        <h1>{t('Kundli match')}</h1>
        <p className="muted">{t('Pick two people from your charts and see how they fit.')}</p>
      </div>
      {loadError ? <p className="error" role="alert">{t(loadError)}</p> : null}
      {profiles && profiles.length < 2 ? (
        <div className="card empty">
          <p>{t('Matching needs two saved charts. You have {0}. Add the other person to match with them.', [profiles.length])}</p>
          <Link className="btn" to="/charts/new"><Icon name="plus" size={20} />{t('Add a person')}</Link>
        </div>
      ) : null}
      {profiles && profiles.length >= 2 ? (
        <form className="match-form" onSubmit={run}>
          <div className="switch" role="group" aria-label={t('Astrology system')}>
            {[['vedic', t('Vedic, 36 points')], ['western', t('Western synastry')]].map(([key, name]) => (
              <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'on' : undefined} onClick={() => { setSystem(key); setOutcome(null); }}>{name}</button>
            ))}
          </div>
          <div className="two">
            <label>{system === 'vedic' ? t('Groom') : t('First person')}
              <select value={first} onChange={(e) => setFirst(e.target.value)} required><option value="">{t('Choose…')}</option>{options}</select>
            </label>
            <label>{system === 'vedic' ? t('Bride') : t('Second person')}
              <select value={second} onChange={(e) => setSecond(e.target.value)} required><option value="">{t('Choose…')}</option>{options}</select>
            </label>
          </div>
          {system === 'vedic' ? <p className="hint">{t('The traditional method scores some tests differently for the groom and the bride, so the roles matter.')}</p> : null}
          {error ? <p className="error" role="alert">{t(error)}</p> : null}
          <button type="submit" className="btn" disabled={busy}>{busy ? t('Matching…') : t('Match these two')}<Icon name="go" size={20} /></button>
        </form>
      ) : null}
      {outcome?.system === 'vedic' ? <VedicResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
      {outcome?.system === 'western' ? <WesternResult result={outcome.result} a={outcome.a} b={outcome.b} /> : null}
    </>
  );
}
