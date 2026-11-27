import { useState } from 'react';
import { useT } from '../lib/language.jsx';

function parts(value) {
  const m = /^(\d{2}):(\d{2})/.exec(value ?? '');
  if (!m) return { hour: '', minute: '', pm: false };
  const h = Number(m[1]);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: m[2], pm: h >= 12 };
}

/**
 * Birth time as hour, minute and AM/PM, which is how people remember it.
 * `value` and `onChange` use 24-hour 'HH:MM' ('' until both hour and minute are chosen).
 */
export default function TimePicker({ value, onChange, disabled = false, whose = 'my' }) {
  const t = useT();
  const [state, setState] = useState(() => parts(value));

  function update(patch) {
    const next = { ...state, ...patch };
    setState(next);
    if (next.hour && next.minute) {
      const h = (Number(next.hour) % 12) + (next.pm ? 12 : 0);
      onChange(`${String(h).padStart(2, '0')}:${next.minute}`);
    } else {
      onChange('');
    }
  }

  const text = disabled
    ? t('No problem. The chart is drawn from the Moon sign instead.')
    : state.hour && state.minute
      ? t('Born at {0}', [`${state.hour}:${state.minute} ${state.pm ? 'PM' : 'AM'}`])
      : whose === 'my' ? t('Choose the hour and minute. Your birth certificate usually has it.') : t('Choose the hour and minute. Their birth certificate usually has it.');

  return (
    <fieldset className="time-picker">
      <legend>{t('Time of birth')}</legend>
      <div className="time-row" data-off={disabled || undefined}>
        <select aria-label={t('Hour')} value={state.hour} disabled={disabled} onChange={(e) => update({ hour: e.target.value })}>
          <option value="">{t('Hour')}</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
        </select>
        <span aria-hidden="true" className="colon">:</span>
        <select aria-label={t('Minute')} value={state.minute} disabled={disabled} onChange={(e) => update({ minute: e.target.value })}>
          <option value="">{t('Minute')}</option>
          {Array.from({ length: 60 }, (_, i) => <option key={i}>{String(i).padStart(2, '0')}</option>)}
        </select>
        <div className="ampm" role="group" aria-label={t('AM or PM')}>
          <button type="button" aria-pressed={!state.pm} className={!state.pm ? 'on' : undefined} disabled={disabled} onClick={() => update({ pm: false })}>AM</button>
          <button type="button" aria-pressed={state.pm} className={state.pm ? 'on' : undefined} disabled={disabled} onClick={() => update({ pm: true })}>PM</button>
        </div>
      </div>
      <p className="hint" aria-live="polite">{text}</p>
    </fieldset>
  );
}
