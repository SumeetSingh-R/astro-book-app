import { useEffect, useMemo, useRef, useState } from 'react';
import { RASHIS, SIGNS, dms } from '../lib/format.js';
import { HOUSE_SHAPES, HOUSE_MEANINGS, GRAHA_MEANINGS, RASHI_LORDS, VIEW_LABELS, availableViews, buildKundli } from '../lib/kundli.js';

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

/**
 * Interactive North Indian kundli. Select a house (click, tap, or arrow keys) to read what it
 * governs, which rashi it holds, where its lord sits and which grahas occupy it.
 *
 * Props:
 *  - vedic: the `vedic` section of an engine chart
 *  - views: show the Birth / Moon / Navamsa switch
 *  - animate: draw the lines in once on load
 *  - onSelect({house, sign, planets:[names]}): called when the selection changes
 *  - focusPlanet: {name, t} - select the house holding this graha (t makes repeat requests distinct)
 */
export default function Kundli({ vedic, views = false, animate = false, label = 'Kundli', onSelect, focusPlanet }) {
  const options = availableViews(vedic);
  const [view, setView] = useState(options[0]);
  const [selected, setSelected] = useState(1);
  const hitRefs = useRef([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const houses = useMemo(() => buildKundli(vedic, view), [vedic, view]);
  const current = houses[selected - 1];

  useEffect(() => {
    onSelectRef.current?.({ house: current.house, sign: current.sign, planets: current.planets.map((p) => p.name) });
  }, [current]);

  useEffect(() => {
    if (!focusPlanet) return;
    const hit = houses.find((h) => h.planets.some((p) => p.name === focusPlanet.name));
    if (hit) setSelected(hit.house);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPlanet]);

  function onKey(e, house) {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (house % 12) + 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = ((house + 10) % 12) + 1;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(house); return; }
    if (next) { e.preventDefault(); setSelected(next); hitRefs.current[next - 1]?.focus(); }
  }

  const lord = RASHI_LORDS[current.sign - 1];
  const lordHouse = houses.find((h) => h.planets.some((p) => p.name === lord));
  const meaning = HOUSE_MEANINGS[current.house - 1];

  return (
    <figure className="kundli">
      {views && options.length > 1 ? (
        <div className="segmented compact" role="tablist" aria-label="Chart view">
          {options.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'on' : undefined} onClick={() => setView(key)}>{VIEW_LABELS[key]}</button>
          ))}
        </div>
      ) : null}

      <svg viewBox="0 0 400 400" role="group" aria-label={`${label}. Choose a house to read about it.`} className={animate ? 'kundli-svg draw' : 'kundli-svg'}>
        <rect x="0" y="0" width="400" height="400" className="kundli-paper" />
        {houses.map((h, i) => (
          <path
            key={h.house}
            ref={(el) => { hitRefs.current[i] = el; }}
            d={HOUSE_SHAPES[i].d}
            className={h.house === selected ? 'kundli-hit on' : 'kundli-hit'}
            role="button"
            tabIndex={h.house === selected ? 0 : -1}
            aria-pressed={h.house === selected}
            aria-label={`House ${h.house}, ${RASHIS[h.sign - 1]}: ${h.planets.length ? h.planets.map((p) => p.name).join(', ') : 'empty'}`}
            onClick={() => setSelected(h.house)}
            onKeyDown={(e) => onKey(e, h.house)}
          />
        ))}
        <g className="kundli-lines" aria-hidden="true">
          <rect x="1.25" y="1.25" width="397.5" height="397.5" pathLength="1" />
          <path d="M0 0L400 400" pathLength="1" />
          <path d="M400 0L0 400" pathLength="1" />
          <path d="M200 0L400 200L200 400L0 200Z" pathLength="1" />
        </g>
        {houses.map((h, i) => {
          const pos = HOUSE_SHAPES[i];
          const lines = [];
          for (let k = 0; k < h.planets.length; k += pos.perLine) lines.push(h.planets.slice(k, k + pos.perLine));
          const startY = pos.p[1] - ((lines.length - 1) * 17) / 2;
          return (
            <g key={h.house} className="kundli-house" aria-hidden="true">
              <text x={pos.s[0]} y={pos.s[1]} className="kundli-sign" textAnchor="middle" dominantBaseline="central">{h.sign}</text>
              {lines.map((line, li) => (
                <text key={li} x={pos.p[0]} y={startY + li * 17} className="kundli-planets" textAnchor="middle" dominantBaseline="central">
                  {line.map((p, pi) => {
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

      <div className="kundli-panel" aria-live="polite">
        <p className="kundli-panel-title">
          <strong>{ordinal(current.house)} house</strong>
          <span>{RASHIS[current.sign - 1]} ({SIGNS[current.sign - 1]})</span>
        </p>
        <p>{meaning.about}</p>
        {current.planets.length ? (
          <ul>
            {current.planets.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong>{p.retro ? <span className="retro"> retrograde</span> : null}
                {view === 'navamsa' ? '' : `, ${dms(p.degreeInRashi)} in ${p.nakshatra}`}
                <span className="muted">: {GRAHA_MEANINGS[p.name]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No grahas here.</p>
        )}
        <p className="muted">
          {lordHouse
            ? lordHouse.house === current.house
              ? `Its lord, ${lord}, sits here in its own sign.`
              : `Its lord, ${lord}, sits in the ${ordinal(lordHouse.house)} house.`
            : null}
        </p>
      </div>

      <figcaption>
        {view === 'lagna' ? 'House 1 (top centre) is the lagna. ' : null}
        {view === 'moon' ? (vedic.lagna ? 'Drawn from the Moon sign (Chandra kundli). ' : 'Birth time unknown, so the chart is drawn from the Moon sign. ') : null}
        {view === 'navamsa' ? 'The ninth-division chart, read for marriage and inner strength. ' : null}
        Numbers are rashis, counted from Mesha as 1. Select a house to read it.
      </figcaption>
    </figure>
  );
}
