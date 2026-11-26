import { useState } from 'react';
import Kundli from './Kundli.jsx';
import WesternWheel from './WesternWheel.jsx';
import Icon from './Icon.jsx';
import { dms, formatDate, PLANET_GLYPHS } from '../lib/format.js';

function Fold({ title, children, open: initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="fold">
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>{title}<Icon name="plus" size={20} /></button>
      {open ? <div className="fold-body msg">{children}</div> : null}
    </div>
  );
}

function Dasha({ dasha }) {
  const now = Date.now();
  const current = dasha.mahadashas.find((m) => Date.parse(m.start) <= now && now < Date.parse(m.end));
  const [open, setOpen] = useState(current?.lord ?? null);
  const month = (iso) => formatDate(iso, { month: 'short', year: 'numeric' });
  return (
    <>
      <p className="hint">Counted from the Moon in {dasha.moonNakshatra} at birth. Choose a period to see its sub-periods.</p>
      <ol className="dasha">
        {dasha.mahadashas.map((m) => {
          const isCurrent = m === current;
          const isOpen = open === m.lord;
          return (
            <li key={m.lord} className={isCurrent ? 'current' : undefined}>
              <button type="button" className="dasha-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.lord)}>
                <span className="dasha-lord">{m.lord}</span>
                <span className="dasha-dates">{month(m.start)} to {month(m.end)}</span>
                {isCurrent ? <span className="tag focus">Now</span> : null}
              </button>
              {isOpen ? (
                <ol className="antardasha msg">
                  {m.antardashas.map((a) => {
                    const subNow = Date.parse(a.start) <= now && now < Date.parse(a.end);
                    return (
                      <li key={a.lord} className={subNow ? 'current' : undefined}>
                        <span>{m.lord} / {a.lord}</span>
                        <span className="dasha-dates">{month(a.start)} to {month(a.end)}</span>
                        {subNow ? <strong>Now</strong> : null}
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function VedicPanel({ chart, compact, whose }) {
  const v = chart.vedic;
  // The chart and the table are linked: selecting a house marks its grahas in the table,
  // and choosing a graha in the table selects its house in the chart.
  const [inHouse, setInHouse] = useState([]);
  const [focusPlanet, setFocusPlanet] = useState(null);
  const table = (
    <div className="table-wrap">
      <table>
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
      <p className="hint">Choose a graha to find it in the chart.</p>
    </div>
  );
  return (
    <div className="chart-stack">
      <Kundli vedic={v} views reader="side" whose={whose} label="Vedic birth chart (kundli)" onSelect={(sel) => setInHouse(sel.planets)} focusPlanet={focusPlanet} />
      <div className="chart-details">
        <dl className="facts">
          <div><dt>Rising sign (lagna)</dt><dd>{v.lagna ? `${v.lagna.rashi} ${dms(v.lagna.degreeInRashi)}` : 'Needs a birth time'}</dd></div>
          <div><dt>Moon sign</dt><dd>{v.moonSign}</dd></div>
          <div><dt>Birth star (nakshatra)</dt><dd>{v.dasha.moonNakshatra}</dd></div>
          <div><dt>Ayanamsa</dt><dd>{v.ayanamsa.name} {dms(v.ayanamsa.value)}</dd></div>
        </dl>
        {compact ? <Fold title="Where every graha sits (for astrologers)">{table}</Fold> : <><h3>Where every graha sits</h3>{table}</>}
        {compact ? <Fold title="The periods of life (dasha timeline)"><Dasha dasha={v.dasha} /></Fold> : <><h3>The periods of life (dasha timeline)</h3><Dasha dasha={v.dasha} /></>}
      </div>
    </div>
  );
}

function WesternPanel({ chart }) {
  const w = chart.western;
  return (
    <div className="chart-stack western">
      <div className="western-top">
        <WesternWheel western={w} label="Western birth chart" />
        <dl className="facts">
          <div><dt>Sun sign</dt><dd>{w.planets.find((p) => p.name === 'Sun').sign}</dd></div>
          <div><dt>Moon sign</dt><dd>{w.planets.find((p) => p.name === 'Moon').sign}</dd></div>
          <div><dt>Ascendant</dt><dd>{w.ascendant ? `${w.ascendant.sign} ${dms(w.ascendant.degreeInSign)}` : 'Needs a birth time'}</dd></div>
          <div><dt>Midheaven</dt><dd>{w.midheaven ? `${w.midheaven.sign} ${dms(w.midheaven.degreeInSign)}` : 'Needs a birth time'}</dd></div>
        </dl>
      </div>
      <div className="chart-details">
        <h3>Planet positions</h3>
        <div className="table-wrap">
          <table>
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

/**
 * One calculated chart in both systems.
 * `compact` folds the tables away; `whose` ('your' or 'their') lets the house reading speak about the person's current period.
 */
export default function ChartView({ chart, initial = 'vedic', compact = false, whose = null }) {
  const [system, setSystem] = useState(initial);
  return (
    <div>
      <div className="pills" role="group" aria-label="Astrology system">
        {[['vedic', 'Vedic'], ['western', 'Western']].map(([key, name]) => (
          <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'pill on' : 'pill'} onClick={() => setSystem(key)}>{name}</button>
        ))}
      </div>
      {chart.notes?.map((n) => <p key={n} className="notice">{n}</p>)}
      {system === 'vedic' ? <VedicPanel chart={chart} compact={compact} whose={whose} /> : <WesternPanel chart={chart} />}
    </div>
  );
}
