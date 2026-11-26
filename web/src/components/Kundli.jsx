import { useEffect, useMemo, useRef, useState } from 'react';
import { RASHIS, SIGNS, dms } from '../lib/format.js';
import { HOUSE_SHAPES, HOUSE_MEANINGS, GRAHA_MEANINGS, VIEW_LABELS, availableViews, buildKundli, readHouse, periodAt } from '../lib/kundli.js';

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;
const VIEW_NOTES = {
  moon: 'The Moon chart counts the houses from the Moon sign. Astrologers read it beside the birth chart, especially for the mind, feelings and daily life.',
  navamsa: 'The Navamsa divides each sign into nine parts. It is read for marriage and for how strong each graha really is.',
};

/**
 * Interactive North Indian kundli. Choose a house (click, tap, its number, or the arrow keys) to read
 * what it stands for, what sits there, and, in a person's own chart, how it looks for them right now.
 *
 * Props:
 *  - vedic: the `vedic` section of an engine chart
 *  - views: show the Birth / Moon / Navamsa switch
 *  - reader: show the house buttons and the reading ('side' puts it beside the chart on wide screens)
 *  - whose: 'your' or 'their' when the chart belongs to a person, so the reading can speak about the period they are in
 *  - animate: draw the lines in once on load
 *  - onSelect({house, sign, planets:[names]}), focusPlanet {name, t}
 */
export default function Kundli({ vedic, views = false, reader = true, whose = null, animate = false, label = 'Kundli', onSelect, focusPlanet }) {
  const options = availableViews(vedic);
  const [view, setView] = useState(options[0]);
  const [selected, setSelected] = useState(1);
  const hitRefs = useRef([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const houses = useMemo(() => buildKundli(vedic, view), [vedic, view]);
  const current = houses[selected - 1];
  const period = useMemo(() => (whose && view !== 'navamsa' ? periodAt(vedic.dasha) : null), [whose, view, vedic]);
  const reading = useMemo(() => readHouse(houses, selected, period, whose ?? 'your'), [houses, selected, period, whose]);

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

  const meaning = HOUSE_MEANINGS[current.house - 1];
  const caption = view === 'lagna' ? 'House 1 (top centre) is the rising sign. The small numbers are the signs, counted from Mesha as 1.'
    : view === 'moon' ? (vedic.lagna ? 'Drawn from the Moon sign: the Moon\'s sign is house 1.' : 'The birth time is not known, so the chart is drawn from the Moon sign.')
      : 'The ninth-division chart.';

  return (
    <div className={reader === 'side' ? 'kundli side' : 'kundli'}>
      {views && options.length > 1 ? (
        <div className="pills views" role="group" aria-label="Chart view">
          {options.map((key) => (
            <button key={key} type="button" aria-pressed={view === key} className={view === key ? 'pill on' : 'pill'} onClick={() => setView(key)}>{VIEW_LABELS[key]}</button>
          ))}
        </div>
      ) : null}

      <figure className="kundli-figure">
        <svg viewBox="0 0 400 400" role="group" aria-label={`${label}. Choose a house to read about it.`} className={animate ? 'kundli-svg draw' : 'kundli-svg'}>
          <rect x="0" y="0" width="400" height="400" className="kundli-paper" />
          {houses.map((h, i) => (
            <path
              key={h.house}
              ref={(el) => { hitRefs.current[i] = el; }}
              d={HOUSE_SHAPES[i].d}
              className={h.house === selected && reader ? 'kundli-hit on' : 'kundli-hit'}
              role="button"
              tabIndex={h.house === selected ? 0 : -1}
              aria-pressed={h.house === selected}
              aria-label={`House ${h.house}, ${RASHIS[h.sign - 1]}: ${h.planets.length ? h.planets.map((p) => p.name).join(', ') : 'empty'}`}
              onClick={() => setSelected(h.house)}
              onKeyDown={(e) => onKey(e, h.house)}
            />
          ))}
          <g className="kundli-lines" aria-hidden="true">
            <rect x="1.5" y="1.5" width="397" height="397" pathLength="1" />
            <path d="M0 0L400 400" pathLength="1" />
            <path d="M400 0L0 400" pathLength="1" />
            <path d="M200 0L400 200L200 400L0 200Z" pathLength="1" />
          </g>
          {houses.map((h, i) => {
            const pos = HOUSE_SHAPES[i];
            const side = pos.perLine === 1;
            const per = side ? (h.planets.length > 3 ? 2 : 1) : 3;
            const lines = [];
            for (let k = 0; k < h.planets.length; k += per) lines.push(h.planets.slice(k, k + per));
            const startY = pos.p[1] - ((lines.length - 1) * 17) / 2;
            return (
              <g key={h.house} className="kundli-house" aria-hidden="true">
                <text x={pos.s[0]} y={pos.s[1]} className="kundli-sign" textAnchor="middle" dominantBaseline="central">{h.sign}</text>
                {lines.map((line, li) => (
                  <text key={li} x={pos.p[0] - (side && per === 2 ? 4 : 0)} y={startY + li * 17} className="kundli-planets" textAnchor="middle" dominantBaseline="central">
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
        <figcaption>{caption}</figcaption>
      </figure>

      {reader ? (
        <div className="house-reader">
          <div>
            <p className="reader-lead">Tap any house in the chart, or pick its number</p>
            <p className="hint">Each house is one area of life.</p>
          </div>
          <div className="house-pills" role="group" aria-label="Houses">
            {houses.map((h) => (
              <button key={h.house} type="button" aria-pressed={h.house === selected} className={h.house === selected ? 'on' : undefined} onClick={() => setSelected(h.house)}>{h.house}</button>
            ))}
          </div>
          <div className="house-panel" aria-live="polite">
            <div className="house-head">
              <h3>{ordinal(current.house)} house</h3>
              <span className={reading.status === 'In focus now' ? 'tag focus' : 'tag plain'}>{reading.status}</span>
            </div>
            <p className="house-sign">{RASHIS[current.sign - 1]} ({SIGNS[current.sign - 1]})</p>
            <div className="note">
              <p className="note-label">What this house is about</p>
              <p><strong>{meaning.about}</strong></p>
            </div>
            <div className="note">
              <p className="note-label">{whose === 'your' ? 'In your chart' : 'In this chart'}</p>
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
              ) : <p>No grahas sit here, so this house is read through its lord.</p>}
              {reading.lordLine ? <p>{reading.lordLine}</p> : null}
              {reading.aspectLine ? <p>{reading.aspectLine}</p> : null}
            </div>
            {reading.nowLine ? (
              <div className="note">
                <p className="note-label">{whose === 'your' ? 'Right now for you' : 'Right now for them'}</p>
                <p>{reading.nowLine}</p>
              </div>
            ) : null}
            {view !== 'lagna' && VIEW_NOTES[view] ? <p className="hint">{VIEW_NOTES[view]}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
