import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';
import BirthForm from '../components/BirthForm.jsx';
import ChartView from '../components/ChartView.jsx';
import Kundli from '../components/Kundli.jsx';
import HoroscopeReader from '../components/HoroscopeReader.jsx';

// Ujjain: the traditional prime meridian of Indian astronomy.
const UJJAIN = { latitude: 23.1765, longitude: 75.7885, timezone: 'Asia/Kolkata' };

function nowInIndia() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** A small line drawing in an arch frame, the brand's window shape. */
function ArchPicture({ children }) {
  return (
    <span className="arch-picture" aria-hidden="true">
      <svg viewBox="0 0 64 64">{children}</svg>
    </span>
  );
}

const FEATURES = [
  {
    title: 'Kundli and birth chart',
    text: 'Your Vedic kundli and Western wheel from one set of birth details, then explained in plain words, in English or Hindi.',
    link: ['#draw', 'Draw my chart'],
    art: <><rect x="12" y="12" width="40" height="40" /><path d="M12 12L52 52M52 12L12 52M32 12L52 32L32 52L12 32Z" /></>,
  },
  {
    title: 'Matching',
    text: 'Ashtakoot matching out of 36 gunas, shown koota by koota, with doshas, cancellations and a Manglik check.',
    link: ['/match', 'Match two charts'],
    art: <><circle cx="25" cy="32" r="14" /><circle cx="39" cy="32" r="14" /></>,
  },
  {
    title: 'A reading for your day',
    text: 'With an account, each day is read against your own chart: where today\'s Moon falls from your birth Moon and lagna.',
    link: ['/today', 'Read my day'],
    art: <><path d="M40 14a19 19 0 1 0 10 31a15 15 0 0 1-10-31Z" /><circle cx="18" cy="20" r="1.6" className="dot" /><circle cx="27" cy="12" r="1.6" className="dot" /></>,
  },
  {
    title: 'Ask your chart',
    text: 'Ask in plain words, such as when a good period for marriage or a job change is, and get an answer drawn from your own chart.',
    link: ['/charts', 'Ask my chart'],
    art: <><path d="M12 16H52V42H30L20 52V42H12Z" /><circle cx="24" cy="29" r="1.8" className="dot" /><circle cx="32" cy="29" r="1.8" className="dot" /><circle cx="40" cy="29" r="1.8" className="dot" /></>,
  },
];

const FAQS = [
  ['What do I need to draw a chart?', 'Your date, time and place of birth. The time matters most: the lagna (rising sign) changes about every two hours, and it decides which house every graha falls in.'],
  ['What if I don\'t know my birth time?', 'Tick "I don\'t know the birth time". Astro Book still calculates every planet\'s position and draws the chart from your Moon sign. Houses and the ascendant are left out, and dasha dates are approximate.'],
  ['Why is my Vedic sign different from my Western sign?', 'Vedic astrology measures the zodiac against the stars (sidereal) and Western astrology measures it against the seasons (tropical). The two are about 24 degrees apart today, so many people have one sign in one system and the previous sign in the other. Astro Book shows both.'],
  ['How are the charts calculated?', 'With Swiss Ephemeris, the astronomy library that professional astrology software is built on. Vedic charts use the Lahiri ayanamsa and whole-sign houses; Western charts use Placidus houses.'],
  ['How does matching work?', 'Vedic matching follows the Ashtakoot method: eight tests on the two Moon positions, worth 36 points in all. Astro Book shows each test, flags Nadi, Bhakoot and Gana dosha, says when a common cancellation rule applies, and checks whether either person is Manglik.'],
  ['How does "Ask your chart" work?', 'The app first calculates the facts of your chart: which graha rules and sits in each house, your dasha periods, and where Jupiter and Saturn will be in the coming years. An AI model (Claude) then writes the answer in plain words from those facts only. It does not calculate anything itself. Timing is given as ranges of months that tradition reads as supportive, never as a date or a promise. Your name, email, birth date and birth place are not sent to the model.'],
  ['Is it free, and who can see my charts?', 'Astro Book is free and open source. A quick chart drawn on this page is not saved anywhere. Charts you save to an account are visible only to you.'],
];

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
          <p className="lede">Astro Book calculates your Vedic and Western charts from your exact birth details, then helps you read them: house by house, period by period, day by day.</p>
          <div className="cta-row">
            <a className="button primary" href="#draw">Draw my chart</a>
            {session
              ? <Link className="button" to="/today">Read my day</Link>
              : <a className="button" href="#today">Read today's horoscope</a>}
          </div>
          <dl className="inside">
            <div><dt>2</dt><dd>systems, Vedic and Western, from one set of birth details</dd></div>
            <div><dt>36</dt><dd>point Ashtakoot matching, shown koota by koota</dd></div>
            <div><dt>120</dt><dd>year dasha timeline, with the period you are in explained</dd></div>
          </dl>
        </div>
        <div className="hero-sky">
          <p className="sky-caption">
            {sky === false ? 'The live sky chart could not load.' : `The sky over Ujjain right now${skyTime ? `, ${skyTime} IST` : ''}`}
          </p>
          {sky ? <Kundli vedic={sky.vedic} animate label="Kundli of the sky over Ujjain right now" /> : <div className="kundli-placeholder" aria-hidden="true" />}
        </div>
      </section>

      <section className="band surface" aria-labelledby="features-title">
        <h2 id="features-title">What you can do here</h2>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <ArchPicture>{f.art}</ArchPicture>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              {f.link[0].startsWith('#') ? <a href={f.link[0]}>{f.link[1]}</a> : <Link to={f.link[0]}>{f.link[1]}</Link>}
            </li>
          ))}
        </ul>
      </section>

      <section id="draw" className="band draw" aria-labelledby="draw-title">
        <div className="draw-copy">
          <h2 id="draw-title">Draw your chart</h2>
          <p className="lede">It takes three things, and nothing is saved unless you choose to.</p>
          <ol className="needs">
            <li><strong>Date of birth.</strong> Sets where the slow planets stand.</li>
            <li><strong>Time of birth.</strong> Sets the lagna and the houses. If you don't know it, you can still draw a Moon chart.</li>
            <li><strong>Place of birth.</strong> Search for the town, or the nearest larger one.</li>
          </ol>
        </div>
        <BirthForm submitLabel="Draw my chart" busyLabel="Calculating…" onSubmit={makeChart} />
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

      <section className="band dark" aria-labelledby="trust-title">
        <h2 id="trust-title">Calculated, not guessed</h2>
        <ul className="trust">
          <li>
            <h3>Real astronomy</h3>
            <p>Planet positions come from Swiss Ephemeris and are checked against an independent astronomy library to within a fiftieth of a degree.</p>
          </li>
          <li>
            <h3>Nothing hidden</h3>
            <p>The app is open source. Every rule it applies, from the ayanamsa to the matching tables, can be read in the code.</p>
          </li>
          <li>
            <h3>Yours alone</h3>
            <p>Saved charts are visible only to your account. A quick chart drawn on this page is never stored.</p>
          </li>
        </ul>
      </section>

      <section id="today" className="band" aria-labelledby="today-title">
        <h2 id="today-title">Today's horoscope, by sign</h2>
        <p>{session
          ? <>This is the general reading for a sign. <Link to="/today">Your own day</Link> is read from your chart.</>
          : <>This is the general reading for a sign. <Link to="/sign-in" state={{ from: '/today', mode: 'sign-up' }}>Create an account</Link> and each day is read from your own chart instead.</>}
        </p>
        <HoroscopeReader />
      </section>

      <section className="band surface" aria-labelledby="faq-title">
        <div className="faq">
          <h2 id="faq-title">Questions people ask first</h2>
          <div>
            {FAQS.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
