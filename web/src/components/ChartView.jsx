import { useState } from 'react';
import Kundli from './Kundli.jsx';
import WesternWheel from './WesternWheel.jsx';
import { dms, formatDate, PLANET_GLYPHS } from '../lib/format.js';

function Dasha({ dasha }) {
  const now = Date.now();
  const current = dasha.mahadashas.find((m) => Date.parse(m.start) <= now && now < Date.parse(m.end));
  const [open, setOpen] = useState(current?.lord ?? null);
  return (
    <section>
      <h3>Vimshottari dasha</h3>
      <p className="muted">Moon in {dasha.moonNakshatra} at birth. Select a period to see its sub-periods.</p>
      <ol className="dasha">
        {dasha.mahadashas.map((m) => {
          const isCurrent = m === current;
          const isOpen = open === m.lord;
          return (
            <li key={m.lord} className={isCurrent ? 'current' : undefined}>
              <button type="button" className="dasha-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.lord)}>
                <span className="dasha-lord">{m.lord}</span>
                <span className="dasha-dates">{formatDate(m.start)} to {formatDate(m.end)}</span>
                {isCurrent ? <span className="tag">Now</span> : null}
              </button>
              {isOpen ? (
                <ol className="antardasha">
                  {m.antardashas.map((a) => {
                    const subNow = Date.parse(a.start) <= now && now < Date.parse(a.end);
                    return (
                      <li key={a.lord} className={subNow ? 'current' : undefined}>
                        <span>{m.lord} / {a.lord}</span>
                        <span className="dasha-dates">{formatDate(a.start)} to {formatDate(a.end)}</span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function VedicPanel({ chart }) {
  const v = chart.vedic;
  // The chart and the table are linked: selecting a house marks its grahas in the table,
  // and choosing a graha in the table selects its house in the chart.
  const [inHouse, setInHouse] = useState([]);
  const [focusPlanet, setFocusPlanet] = useState(null);
  return (
    <div className="chart-grid">
      <Kundli vedic={v} views label="Vedic birth chart (kundli)" onSelect={(sel) => setInHouse(sel.planets)} focusPlanet={focusPlanet} />
      <div>
        <dl className="facts">
          <div><dt>Lagna</dt><dd>{v.lagna ? `${v.lagna.rashi} ${dms(v.lagna.degreeInRashi)}` : 'Needs a birth time'}</dd></div>
          <div><dt>Moon sign</dt><dd>{v.moonSign}</dd></div>
          <div><dt>Birth nakshatra</dt><dd>{v.dasha.moonNakshatra}</dd></div>
          <div><dt>Ayanamsa</dt><dd>{v.ayanamsa.name} {dms(v.ayanamsa.value)}</dd></div>
        </dl>
        <div className="table-wrap">
          <table>
            <caption>Graha positions <span className="caption-hint">Choose a graha to find it in the chart.</span></caption>
            <thead><tr><th>Graha</th><th>Rashi</th><th>Degree</th><th>Nakshatra</th><th>House</th><th>Navamsa</th></tr></thead>
            <tbody>
              {v.planets.map((p) => (
                <tr key={p.name} className={inHouse.includes(p.name) ? 'hl' : undefined}>
                  <th scope="row">
                    <button type="button" className="rowlink" onClick={() => setFocusPlanet({ name: p.name, t: Date.now() })}>{p.name}</button>
                    {p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu' ? <span className="retro" title="Retrograde"> R</span> : null}
                  </th>
                  <td>{p.rashi}</td><td>{dms(p.degreeInRashi)}</td><td>{p.nakshatra}, pada {p.pada}</td><td>{p.house ?? '–'}</td><td>{p.navamsaRashi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="span-2"><Dasha dasha={v.dasha} /></div>
    </div>
  );
}

function WesternPanel({ chart }) {
  const w = chart.western;
  return (
    <div className="chart-grid">
      <WesternWheel western={w} label="Western birth chart" />
      <div>
        <dl className="facts">
          <div><dt>Sun sign</dt><dd>{w.planets.find((p) => p.name === 'Sun').sign}</dd></div>
          <div><dt>Moon sign</dt><dd>{w.planets.find((p) => p.name === 'Moon').sign}</dd></div>
          <div><dt>Ascendant</dt><dd>{w.ascendant ? `${w.ascendant.sign} ${dms(w.ascendant.degreeInSign)}` : 'Needs a birth time'}</dd></div>
          <div><dt>Midheaven</dt><dd>{w.midheaven ? `${w.midheaven.sign} ${dms(w.midheaven.degreeInSign)}` : 'Needs a birth time'}</dd></div>
        </dl>
        <div className="table-wrap">
          <table>
            <caption>Planet positions</caption>
            <thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>House</th></tr></thead>
            <tbody>
              {w.planets.map((p) => (
                <tr key={p.name}>
                  <th scope="row"><span className="glyph" aria-hidden="true">{PLANET_GLYPHS[p.name]}{'︎'}</span> {p.name}{p.retrograde ? <span className="retro" title="Retrograde"> R</span> : null}</th>
                  <td>{p.sign}</td><td>{dms(p.degreeInSign)}</td><td>{p.house ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="span-2">
        <h3>Aspects</h3>
        {w.aspects.length === 0 ? <p className="muted">No major aspects within orb.</p> : (
          <ul className="aspects">
            {w.aspects.map((a) => (
              <li key={`${a.a}-${a.b}`}><span>{a.a} {a.type.toLowerCase()} {a.b}</span><span className="muted">orb {dms(a.orb)}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Tabs for the two systems over one calculated chart. */
export default function ChartView({ chart, initial = 'vedic' }) {
  const [system, setSystem] = useState(initial);
  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Astrology system">
        {[['vedic', 'Vedic'], ['western', 'Western']].map(([key, name]) => (
          <button key={key} type="button" role="tab" aria-selected={system === key} className={system === key ? 'on' : undefined} onClick={() => setSystem(key)}>{name}</button>
        ))}
      </div>
      {chart.notes?.map((n) => <p key={n} className="notice">{n}</p>)}
      {system === 'vedic' ? <VedicPanel chart={chart} /> : <WesternPanel chart={chart} />}
    </div>
  );
}
