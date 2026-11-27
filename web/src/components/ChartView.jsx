import { useState } from 'react';
import Kundli from './Kundli.jsx';
import WesternWheel from './WesternWheel.jsx';
import Icon from './Icon.jsx';
import { dms, formatDate, PLANET_GLYPHS } from '../lib/format.js';
import { useT } from '../lib/language.jsx';

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
  const t = useT();
  const now = Date.now();
  const current = dasha.mahadashas.find((m) => Date.parse(m.start) <= now && now < Date.parse(m.end));
  const [open, setOpen] = useState(current?.lord ?? null);
  const month = (iso) => formatDate(iso, { month: 'short', year: 'numeric' });
  return (
    <>
      <p className="hint">{t('Counted from the Moon in {0} at birth. Choose a period to see its sub-periods.', [t(dasha.moonNakshatra)])}</p>
      <ol className="dasha">
        {dasha.mahadashas.map((m) => {
          const isCurrent = m === current;
          const isOpen = open === m.lord;
          return (
            <li key={m.lord} className={isCurrent ? 'current' : undefined}>
              <button type="button" className="dasha-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.lord)}>
                <span className="dasha-lord">{t(m.lord)}</span>
                <span className="dasha-dates">{month(m.start)}{' '}{t('to')}{' '}{month(m.end)}</span>
                {isCurrent ? <span className="tag focus">{t('Now')}</span> : null}
              </button>
              {isOpen ? (
                <ol className="antardasha msg">
                  {m.antardashas.map((a) => {
                    const subNow = Date.parse(a.start) <= now && now < Date.parse(a.end);
                    return (
                      <li key={a.lord} className={subNow ? 'current' : undefined}>
                        <span>{t(m.lord)} / {t(a.lord)}</span>
                        <span className="dasha-dates">{month(a.start)}{' '}{t('to')}{' '}{month(a.end)}</span>
                        {subNow ? <strong>{t('Now')}</strong> : null}
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
  const t = useT();
  const v = chart.vedic;
  // The chart and the table are linked: selecting a house marks its grahas in the table,
  // and choosing a graha in the table selects its house in the chart.
  const [inHouse, setInHouse] = useState([]);
  const [focusPlanet, setFocusPlanet] = useState(null);
  const table = (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{t('Graha')}</th><th>{t('Rashi')}</th><th>{t('Degree')}</th><th>{t('Nakshatra')}</th><th>{t('House')}</th><th>{t('Navamsa')}</th></tr></thead>
        <tbody>
          {v.planets.map((p) => (
            <tr key={p.name} className={inHouse.includes(p.name) ? 'hl' : undefined}>
              <th scope="row">
                <button type="button" className="rowlink" onClick={() => setFocusPlanet({ name: p.name, t: Date.now() })}>{t(p.name)}</button>
                {p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu' ? <span className="retro" title={t('Retrograde')}> R</span> : null}
              </th>
              <td>{t(p.rashi)}</td><td>{dms(p.degreeInRashi)}</td><td>{t('{0}, pada {1}', [t(p.nakshatra), p.pada])}</td><td>{p.house ?? '–'}</td><td>{t(p.navamsaRashi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{t('Choose a graha to find it in the chart.')}</p>
    </div>
  );
  return (
    <div className="chart-stack">
      <Kundli vedic={v} views reader="side" whose={whose} label={t('Vedic birth chart (kundli)')} onSelect={(sel) => setInHouse(sel.planets)} focusPlanet={focusPlanet} />
      <div className="chart-details">
        <dl className="facts">
          <div><dt>{t('Rising sign (lagna)')}</dt><dd>{v.lagna ? `${t(v.lagna.rashi)} ${dms(v.lagna.degreeInRashi)}` : t('Needs a birth time')}</dd></div>
          <div><dt>{t('Moon sign')}</dt><dd>{t(v.moonSign)}</dd></div>
          <div><dt>{t('Birth star (nakshatra)')}</dt><dd>{t(v.dasha.moonNakshatra)}</dd></div>
          <div><dt>{t('Ayanamsa')}</dt><dd>{t(v.ayanamsa.name)} {dms(v.ayanamsa.value)}</dd></div>
        </dl>
        {compact ? <Fold title={t('Where every graha sits (for astrologers)')}>{table}</Fold> : <><h3>{t('Where every graha sits')}</h3>{table}</>}
        {compact ? <Fold title={t('The periods of life (dasha timeline)')}><Dasha dasha={v.dasha} /></Fold> : <><h3>{t('The periods of life (dasha timeline)')}</h3><Dasha dasha={v.dasha} /></>}
      </div>
    </div>
  );
}

function WesternPanel({ chart }) {
  const t = useT();
  const w = chart.western;
  return (
    <div className="chart-stack western">
      <div className="western-top">
        <WesternWheel western={w} label={t('Western birth chart')} />
        <dl className="facts">
          <div><dt>{t('Sun sign')}</dt><dd>{t(w.planets.find((p) => p.name === 'Sun').sign)}</dd></div>
          <div><dt>{t('Moon sign')}</dt><dd>{t(w.planets.find((p) => p.name === 'Moon').sign)}</dd></div>
          <div><dt>{t('Ascendant')}</dt><dd>{w.ascendant ? `${t(w.ascendant.sign)} ${dms(w.ascendant.degreeInSign)}` : t('Needs a birth time')}</dd></div>
          <div><dt>{t('Midheaven')}</dt><dd>{w.midheaven ? `${t(w.midheaven.sign)} ${dms(w.midheaven.degreeInSign)}` : t('Needs a birth time')}</dd></div>
        </dl>
      </div>
      <div className="chart-details">
        <h3>{t('Planet positions')}</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Planet')}</th><th>{t('Sign')}</th><th>{t('Degree')}</th><th>{t('House')}</th></tr></thead>
            <tbody>
              {w.planets.map((p) => (
                <tr key={p.name}>
                  <th scope="row"><span className="glyph" aria-hidden="true">{PLANET_GLYPHS[p.name]}{'︎'}</span> {t(p.name)}{p.retrograde ? <span className="retro" title={t('Retrograde')}> R</span> : null}</th>
                  <td>{t(p.sign)}</td><td>{dms(p.degreeInSign)}</td><td>{p.house ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>{t('Aspects')}</h3>
        {w.aspects.length === 0 ? <p className="muted">{t('No major aspects within orb.')}</p> : (
          <ul className="aspects">
            {w.aspects.map((a) => (
              <li key={`${a.a}-${a.b}`}><span>{t(a.a)} <em>{t(a.type)}</em> {t(a.b)}</span><span className="muted">{t('orb')}{' '}{dms(a.orb)}</span></li>
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
  const t = useT();
  const [system, setSystem] = useState(initial);
  return (
    <div>
      <div className="pills" role="group" aria-label={t('Astrology system')}>
        {[['vedic', t('Vedic')], ['western', t('Western')]].map(([key, name]) => (
          <button key={key} type="button" aria-pressed={system === key} className={system === key ? 'pill on' : 'pill'} onClick={() => setSystem(key)}>{name}</button>
        ))}
      </div>
      {chart.notes?.map((n) => <p key={n} className="notice">{n}</p>)}
      {system === 'vedic' ? <VedicPanel chart={chart} compact={compact} whose={whose} /> : <WesternPanel chart={chart} />}
    </div>
  );
}
