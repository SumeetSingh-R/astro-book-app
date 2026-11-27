/** An on/off switch with its label beside it. */
export default function Toggle({ checked, onChange, label, hint, disabled = false }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong>{hint ? <span className="hint">{hint}</span> : null}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={checked ? 'toggle on' : 'toggle'} onClick={() => onChange(!checked)}><span /></button>
    </label>
  );
}
