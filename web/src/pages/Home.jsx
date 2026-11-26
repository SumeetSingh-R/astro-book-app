import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';
import { useAccount } from '../lib/account.jsx';
import BirthForm from '../components/BirthForm.jsx';
import ChartView from '../components/ChartView.jsx';
import Kundli from '../components/Kundli.jsx';
import HoroscopeReader from '../components/HoroscopeReader.jsx';
import Icon from '../components/Icon.jsx';

// Ujjain: the traditional prime meridian of Indian astronomy.
const UJJAIN = { latitude: 23.1765, longitude: 75.7885, timezone: 'Asia/Kolkata' };

function nowInIndia() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const FEATURES = [
  ['chart', 'Your chart, in plain words', 'Your kundli explained area by area: work, money, marriage, family. In English or Hindi.'],
  ['chat', 'Ask your chart', 'Ask when a good period for marriage or a job change is, and get an answer drawn from your own chart.'],
  ['sun', 'A reading for your day', 'Each morning, a reading made from your own chart, not only your sign.'],
  ['match', 'Matching', 'See how two people fit: 36-point matching, shown test by test.'],
];

const FAQS = [
  ['What do I need to get started?', 'Your date, time and place of birth. You enter them once in your profile and Astro Book uses them for everything: your chart, your daily reading and your questions.'],
  ['What if I don\'t know my birth time?', 'Tick "I don\'t know my birth time". Your chart is still drawn from your Moon sign. A few details that depend on the exact time are left out.'],
  ['How does "Ask your chart" work?', 'The app first works out the facts of your chart. An AI model then writes the answer in plain words from those facts only. Timing is given as ranges of months, never as a date or a promise.'],
  ['Why is my Vedic sign different from my Western sign?', 'Vedic astrology measures the zodiac against the stars and Western astrology against the seasons. The two are about 24 degrees apart today, so many people have a different sign in each.'],
  ['Is it free, and who can see my details?', 'Astro Book is free. Your profile and saved charts are visible only to you.'],
];

export default function Home() {
  const { session } = useAuth();
  const { self } = useAccount();
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
          <h1>Your kundli, explained in plain words</h1>
          <p className="lede">Tell us when you were born. Astro Book reads your chart for you: day by day, question by question, in English or Hindi.</p>
          <div className="cta-row">
            {session
              ? <Link className="btn" to="/today">Read my day<Icon name="go" size={20} /></Link>
              : <Link className="btn" to="/sign-in" state={{ mode: 'sign-up' }}>Get started free<Icon name="go" size={20} /></Link>}
            <a className="btn outline" href="#draw">Try it first: draw a chart</a>
          </div>
          <ul className="trust-row">
            <li><Icon name="check" size={18} />Free to use</li>
            <li><Icon name="check" size={18} />Birth details saved once</li>
            <li><Icon name="lock" size={18} />Private to you</li>
          </ul>
        </div>
        <div className="hero-arch float">
          {sky ? <Kundli vedic={sky.vedic} reader={false} animate label="Kundli of the sky over Ujjain right now" /> : <div className="kundli-placeholder" aria-hidden="true" />}
          <p>{sky === false ? 'The live sky chart could not load.' : `The sky over Ujjain right now${skyTime ? `, ${skyTime} IST` : ''}. Yours is drawn from your own birth details.`}</p>
        </div>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title">What you can do here</h2>
        <ul className="features">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title} className="card">
              <span className="arch-badge"><Icon name={icon} /></span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <div className="home-split">
        <section id="draw" aria-labelledby="draw-title">
          <h2 id="draw-title">Draw your chart</h2>
          <div className="card form-card">
            <BirthForm submitLabel="Draw my chart" busyLabel="Calculating…" onSubmit={makeChart} />
            <p className="hint">Just looking? Nothing is saved until you create an account.</p>
          </div>
        </section>
        <section id="today" aria-labelledby="today-title">
          <h2 id="today-title">Today's horoscope, by sign</h2>
          <p className="muted">
            A general reading for each sign. {session
              ? <><Link to="/today">Your own day</Link> is read from your chart.</>
              : <>With a profile, your day is read from your own chart instead.</>}
          </p>
          <HoroscopeReader />
        </section>
      </div>

      {preview ? (
        <section ref={resultRef} className="the-chart" aria-live="polite">
          <div>
            <h2>Chart for {preview.values.place.label}</h2>
            <p className="muted">Tap any house to see what it stands for.</p>
          </div>
          <ChartView chart={preview.chart} compact />
          <div className="banner save">
            <p><strong>This chart isn't saved yet.</strong> Save it to get it explained in plain words and to ask it questions.</p>
            {session
              ? <Link className="btn" to={self ? '/charts/new' : '/welcome'}>{self ? 'Save it to my charts' : 'Save it as my profile'}</Link>
              : <Link className="btn" to="/sign-in" state={{ from: '/welcome', mode: 'sign-up' }}>Create a free account</Link>}
          </div>
        </section>
      ) : null}

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions people ask first</h2>
        <div>
          {FAQS.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}<Icon name="plus" size={18} /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
