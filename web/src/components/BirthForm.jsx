import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import TimePicker from './TimePicker.jsx';
import Icon from './Icon.jsx';

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
        <legend>Place of birth</legend>
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
      <label htmlFor={id}>Place of birth</label>
      <input
        id={id} value={query} onChange={(e) => search(e.target.value)} autoComplete="off" required
        placeholder="Start typing a town or city" role="combobox" aria-expanded={results.length > 0} aria-controls={`${id}-list`}
      />
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
 * Birth details form, used for a quick chart, for a person's profile and for adding someone else.
 *  - kind: 'quick' (date, time, place), 'self' (adds your name) or 'person' (adds their name and relation)
 *  - children are placed above the submit button (for example a language choice)
 * `onSubmit` receives { name, relation, date, time, timeUnknown, place }.
 */
export default function BirthForm({ kind = 'quick', initial, submitLabel, busyLabel, onSubmit, children, done }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [relation, setRelation] = useState(initial?.relation ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [timeUnknown, setTimeUnknown] = useState(initial?.timeUnknown ?? false);
  const [place, setPlace] = useState(initial?.place ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const whose = kind === 'person' ? 'their' : 'my';

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!place || place.latitude === '' || place.longitude === '' || !place.timezone) {
      setError('Choose a birth place from the list, or enter its coordinates.');
      return;
    }
    if (!timeUnknown && !time) {
      setError(`Choose the hour and minute of birth, or tick "I don't know ${whose} birth time".`);
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
      <div className="fields">
        {kind === 'self' ? (
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" placeholder="What should we call you?" /></label>
        ) : null}
        {kind === 'person' ? (
          <>
            <label>Their name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Whose chart is this?" /></label>
            <label>How you know them (optional)<input value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={40} placeholder="Husband, mother, friend…" /></label>
          </>
        ) : null}
        <label>Date of birth<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min="1800-01-01" max="2200-12-31" /></label>
        <div>
          <TimePicker value={time} onChange={setTime} disabled={timeUnknown} whose={whose} />
          <label className="check"><input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} /> I don't know {whose} birth time</label>
        </div>
        <PlaceField value={place} onChange={setPlace} />
      </div>
      {children}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {done ? <p className="saved msg" role="status"><Icon name="check" size={20} /> {done}</p> : null}
      <button type="submit" className="btn" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
    </form>
  );
}
