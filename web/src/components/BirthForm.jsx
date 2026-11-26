import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/** Birth-place picker: searches towns and cities, with manual coordinates as a fallback. */
function PlaceField({ value, onChange }) {
  const id = useId();
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [manual, setManual] = useState(false);
  const timer = useRef(null);
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text) {
    setQuery(text);
    onChange(null);
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setResults([]); setStatus('idle'); return; }
    setStatus('loading');
    timer.current = setTimeout(async () => {
      const ticket = ++latest.current;
      try {
        const data = await api(`/api/places?q=${encodeURIComponent(text.trim())}`);
        if (ticket !== latest.current) return;
        setResults(data.places);
        setStatus('done');
      } catch {
        if (ticket === latest.current) setStatus('error');
      }
    }, 250);
  }

  function pick(place) {
    setQuery(place.label);
    setResults([]);
    setStatus('idle');
    onChange({ label: place.label, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone });
  }

  if (manual) {
    const v = value ?? { label: '', latitude: '', longitude: '', timezone: 'Asia/Kolkata' };
    const set = (patch) => onChange({ ...v, ...patch, manual: true });
    return (
      <fieldset className="manual-place">
        <legend>Birth place</legend>
        <label>Place name<input value={v.label} onChange={(e) => set({ label: e.target.value })} required placeholder="Village or town, district" /></label>
        <div className="row">
          <label>Latitude<input type="number" step="any" min="-90" max="90" value={v.latitude} onChange={(e) => set({ latitude: e.target.value })} required placeholder="26.47" /></label>
          <label>Longitude<input type="number" step="any" min="-180" max="180" value={v.longitude} onChange={(e) => set({ longitude: e.target.value })} required placeholder="84.44" /></label>
        </div>
        <label>Timezone<input value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} required placeholder="Asia/Kolkata" /></label>
        <p className="hint">North and east are positive. All of India uses Asia/Kolkata.</p>
        <button type="button" className="link" onClick={() => { setManual(false); onChange(null); setQuery(''); }}>Search for a town instead</button>
      </fieldset>
    );
  }

  return (
    <div className="place-field">
      <label htmlFor={id}>Birth place</label>
      <input
        id={id} value={query} onChange={(e) => search(e.target.value)} autoComplete="off" required
        placeholder="Start typing a town or city" role="combobox" aria-expanded={results.length > 0} aria-controls={`${id}-list`}
      />
      {value ? <p className="hint">Latitude {value.latitude}, longitude {value.longitude}, {value.timezone}</p> : null}
      {status === 'loading' ? <p className="hint">Searching…</p> : null}
      {status === 'error' ? <p className="hint error">Place search isn't responding. Try again, or enter coordinates.</p> : null}
      {results.length > 0 ? (
        <ul className="place-results" id={`${id}-list`} role="listbox">
          {results.map((p) => (
            <li key={`${p.label}-${p.latitude}-${p.longitude}`} role="option" aria-selected="false">
              <button type="button" onClick={() => pick(p)}>{p.label}</button>
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'done' && results.length === 0 ? <p className="hint">No town found with that name. Try the nearest larger town.</p> : null}
      <button type="button" className="link" onClick={() => { setManual(true); onChange(null); }}>Small village? Enter coordinates yourself</button>
    </div>
  );
}

/**
 * Birth details form.
 * `withName` adds the name and relation fields (used when saving a profile).
 * `onSubmit` receives { name, relation, date, time, timeUnknown, place }.
 */
export default function BirthForm({ withName = false, initial, submitLabel, busyLabel, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [relation, setRelation] = useState(initial?.relation ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [timeUnknown, setTimeUnknown] = useState(initial?.timeUnknown ?? false);
  const [place, setPlace] = useState(initial?.place ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!place || place.latitude === '' || place.longitude === '' || !place.timezone) {
      setError('Choose a birth place from the list, or enter its coordinates.');
      return;
    }
    if (!timeUnknown && !time) {
      setError('Enter the birth time, or tick "I don\'t know the birth time".');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(), relation: relation.trim(), date, time: timeUnknown ? null : time, timeUnknown,
        place: { ...place, latitude: Number(place.latitude), longitude: Number(place.longitude) },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="birth-form" onSubmit={submit}>
      {withName ? (
        <div className="row">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Whose chart is this?" /></label>
          <label>Relation (optional)<input value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={40} placeholder="Me, spouse, mother…" /></label>
        </div>
      ) : null}
      <div className="row">
        <label>Date of birth<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min="1800-01-01" max="2200-12-31" /></label>
        <label>Time of birth<input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={timeUnknown} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} /> I don't know the birth time</label>
      <PlaceField value={place} onChange={setPlace} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" className="primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
    </form>
  );
}
