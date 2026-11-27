import { SIGN_GLYPHS, PLANET_GLYPHS, SIGNS } from '../lib/format.js';
import { useT } from '../lib/language.jsx';

const C = 200;
const rad = Math.PI / 180;

export default function WesternWheel({ western, label }) {
  const t = useT();
  const asc = western.ascendant ? western.ascendant.longitude : 0;
  // The ascendant sits at 9 o'clock and the zodiac runs anticlockwise.
  const point = (lon, r) => {
    const a = (180 + (lon - asc)) * rad;
    return [C + r * Math.cos(a), C - r * Math.sin(a)];
  };
  const line = (lon, r1, r2) => {
    const [x1, y1] = point(lon, r1);
    const [x2, y2] = point(lon, r2);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  // Stagger planets that sit close together so their symbols don't overlap.
  const sorted = [...western.planets].sort((a, b) => a.longitude - b.longitude);
  const radii = [];
  sorted.forEach((p, i) => {
    let level = 0;
    for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
      if (p.longitude - sorted[k].longitude < 9 && radii[k] === level) level = (level + 1) % 3;
    }
    radii.push(level);
  });

  const summary = western.planets.map((p) => t('{0} in {1}', [t(p.name), t(p.sign)])).join(', ');

  return (
    <figure className="wheel">
      <svg viewBox="0 0 400 400" role="img" aria-label={`${label ?? t('Birth chart wheel')}. ${summary}`}>
        <circle cx={C} cy={C} r="192" className="wheel-outer" />
        <circle cx={C} cy={C} r="158" className="wheel-ring" />
        <circle cx={C} cy={C} r="62" className="wheel-core" />
        {SIGNS.map((name, i) => {
          const [x, y] = point(i * 30 + 15, 175);
          return (
            <g key={name}>
              <path d={line(i * 30, 158, 192)} className="wheel-sign-line" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="wheel-sign">{SIGN_GLYPHS[i]}</text>
            </g>
          );
        })}
        {western.houses?.map((h) => {
          const next = western.houses[h.house % 12].cusp;
          const mid = h.cusp + ((((next - h.cusp) % 360) + 360) % 360) / 2;
          const [x, y] = point(mid, 76);
          const angular = [1, 4, 7, 10].includes(h.house);
          return (
            <g key={h.house}>
              <path d={line(h.cusp, 62, 158)} className={angular ? 'wheel-cusp angular' : 'wheel-cusp'} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="wheel-house">{h.house}</text>
            </g>
          );
        })}
        {sorted.map((p, i) => {
          const r = 138 - radii[i] * 22;
          const [x, y] = point(p.longitude, r);
          return (
            <g key={p.name}>
              <path d={line(p.longitude, 152, 158)} className="wheel-tick" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="wheel-planet">
                {PLANET_GLYPHS[p.name]}{'︎'}
                <title>{t('{0} in {1}', [t(p.name), t(p.sign)])}{p.retrograde ? ` (${t('retrograde')})` : ''}</title>
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        {western.ascendant ? t('The ascendant is on the left. Inner numbers are houses (Placidus).') : t('Birth time unknown, so houses and the ascendant are left out and Aries starts on the left.')}
      </figcaption>
    </figure>
  );
}
