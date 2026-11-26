import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';
import BirthForm from '../components/BirthForm.jsx';
import ChartView from '../components/ChartView.jsx';
import NorthIndianChart from '../components/NorthIndianChart.jsx';

// Ujjain: the traditional prime meridian of Indian astronomy.
const UJJAIN = { latitude: 23.1765, longitude: 75.7885, timezone: 'Asia/Kolkata' };

function nowInIndia() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export default function Home() {
  const { session } = useAuth();
  const [sky, setSky] = useState(null);
  const [skyTime, setSkyTime] = useState(null);
  const [preview, setPreview] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const now = nowInIndia();
    setSkyTime(now.time);
    api('/api/chart/preview', { method: 'POST', body: { ...now, ...UJJAIN } })
      .then((d) => setSky(d.chart))
      .catch(() => setSky(false));
  }, []);

  async function makeChart(values) {
    const data = await api('/api/chart/preview', {
      method: 'POST',
      body: { date: values.date, time: values.time, timezone: values.place.timezone, latitude: values.place.latitude, longitude: values.place.longitude },
    });
    setPreview({ chart: data.chart, values });
    try { sessionStorage.setItem('pendingBirth', JSON.stringify(values)); } catch { /* storage unavailable */ }
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Your kundli and birth chart, kept like a book</h1>
          <p className="lede">Enter a date, time and place of birth. Astro Book calculates the Vedic and Western charts, the dasha timeline, compatibility and a daily reading.</p>
          <BirthForm submitLabel="Draw my chart" busyLabel="Calculating…" onSubmit={makeChart} />
        </div>
        <div className="hero-sky">
          {sky ? <NorthIndianChart vedic={sky.vedic} animate label="Kundli of the sky over Ujjain right now" /> : <div className="kundli-placeholder" aria-hidden="true" />}
          <p className="sky-caption">
            {sky === false ? 'The live sky chart could not load.' : `The sky over Ujjain right now${skyTime ? `, ${skyTime} IST` : ''}`}
          </p>
        </div>
      </section>

      {preview ? (
        <section ref={resultRef} className="result" aria-live="polite">
          <h2>Chart for {preview.values.place.label}</h2>
          <ChartView chart={preview.chart} />
          <div className="save-prompt">
            <p>This chart isn't saved yet.</p>
            {session
              ? <Link className="button accent" to="/charts/new">Save it to my charts</Link>
              : <Link className="button accent" to="/sign-in" state={{ from: '/charts/new', mode: 'sign-up' }}>Create an account to save it</Link>}
          </div>
        </section>
      ) : null}

      <section className="today-links">
        <h2>Today</h2>
        <p>Read today's horoscope for your Moon sign (Vedic) or Sun sign (Western).</p>
        <Link className="button" to="/horoscope">Read today's horoscope</Link>
      </section>
    </>
  );
}
