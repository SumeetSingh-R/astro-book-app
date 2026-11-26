import { GRAHA_ABBR, RASHIS } from '../lib/format.js';

// Where each house's sign number and planet list sit inside the 400x400 diamond chart.
// Houses run anticlockwise from the top-centre diamond (house 1), as in a North Indian kundli.
const HOUSES = [
  { p: [200, 96], s: [200, 172], perLine: 3 },
  { p: [100, 40], s: [100, 84], perLine: 3 },
  { p: [40, 100], s: [84, 100], perLine: 1 },
  { p: [100, 200], s: [172, 200], perLine: 3 },
  { p: [40, 300], s: [84, 300], perLine: 1 },
  { p: [100, 362], s: [100, 318], perLine: 3 },
  { p: [200, 306], s: [200, 230], perLine: 3 },
  { p: [300, 362], s: [300, 318], perLine: 3 },
  { p: [360, 300], s: [316, 300], perLine: 1 },
  { p: [300, 200], s: [228, 200], perLine: 3 },
  { p: [360, 100], s: [316, 100], perLine: 1 },
  { p: [300, 40], s: [300, 84], perLine: 3 },
];

/** Build the 12 houses for the diagram from an engine chart's `vedic` section. */
export function housesFromVedic(vedic) {
  const moon = vedic.planets.find((p) => p.name === 'Moon');
  const firstSign = vedic.lagna ? vedic.lagna.rashiIndex : moon.rashiIndex;
  const houses = Array.from({ length: 12 }, (_, i) => ({ sign: ((firstSign - 1 + i) % 12) + 1, planets: [] }));
  for (const p of vedic.planets) {
    const h = (p.rashiIndex - firstSign + 12) % 12;
    houses[h].planets.push({ abbr: GRAHA_ABBR[p.name], retro: p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu', name: p.name });
  }
  return { houses, basis: vedic.lagna ? 'lagna' : 'moon' };
}

export default function NorthIndianChart({ vedic, animate = false, label }) {
  const { houses, basis } = housesFromVedic(vedic);
  const summary = houses
    .map((h, i) => `House ${i + 1}, ${RASHIS[h.sign - 1]}: ${h.planets.length ? h.planets.map((p) => p.name).join(', ') : 'empty'}`)
    .join('. ');

  return (
    <figure className="kundli">
      <svg viewBox="0 0 400 400" role="img" aria-label={`${label ?? 'Kundli'}. ${summary}`} className={animate ? 'kundli-svg draw' : 'kundli-svg'}>
        <rect x="2" y="2" width="396" height="396" className="kundli-paper" />
        <g className="kundli-lines">
          <rect x="2" y="2" width="396" height="396" pathLength="1" />
          <path d="M2 2L398 398" pathLength="1" />
          <path d="M398 2L2 398" pathLength="1" />
          <path d="M200 2L398 200L200 398L2 200Z" pathLength="1" />
        </g>
        {houses.map((h, i) => {
          const pos = HOUSES[i];
          const lines = [];
          for (let k = 0; k < h.planets.length; k += pos.perLine) lines.push(h.planets.slice(k, k + pos.perLine));
          const lineHeight = 17;
          const startY = pos.p[1] - ((lines.length - 1) * lineHeight) / 2;
          return (
            <g key={i} className="kundli-house">
              <text x={pos.s[0]} y={pos.s[1]} className="kundli-sign" textAnchor="middle" dominantBaseline="central">{h.sign}</text>
              {lines.map((line, li) => (
                <text key={li} x={pos.p[0]} y={startY + li * lineHeight} className="kundli-planets" textAnchor="middle" dominantBaseline="central">
                  {line.map((p, pi) => {
                    // A raised "R" marks a retrograde graha; the next label drops back to the baseline.
                    const afterRetro = pi > 0 && line[pi - 1].retro;
                    return (
                      <tspan key={p.abbr} dx={pi ? 7 : 0} dy={afterRetro ? 5 : 0}>
                        {p.abbr}
                        {p.retro ? <tspan className="kundli-retro" dy="-5" fontSize="9">R</tspan> : null}
                      </tspan>
                    );
                  })}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {basis === 'lagna'
          ? 'House 1 (top centre) is the lagna. Numbers are rashis, counted from Mesha as 1.'
          : 'Birth time unknown, so this chart is drawn from the Moon sign (Chandra kundli).'}
      </figcaption>
    </figure>
  );
}
