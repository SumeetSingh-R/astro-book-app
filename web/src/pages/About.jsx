import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="prose">
      <h1>About Astro Book</h1>
      <p className="lede">A simple way to read your own birth chart.</p>
      <h2>How your readings are made</h2>
      <p>Astro Book first calculates your chart from your birth details: where each graha stood, your houses, and the periods of your life. An AI model then turns those facts into plain words. It only explains; it never does the calculating.</p>
      <h2>What to expect from it</h2>
      <p>Readings and answers describe tendencies, not certainties. Timing is given as ranges of months that tradition reads as supportive, never as a date or a promise. For health, legal or money decisions, please speak to a qualified professional.</p>
      <h2>Your privacy</h2>
      <p>Your profile and saved charts are visible only to you. When you ask a question, your question, your age and your chart positions are sent to the AI model. Your name, email, birth date and birth place are not.</p>
      <h2>Credits</h2>
      <p>Planet positions are calculated with <a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a>, using the Lahiri ayanamsa for Vedic charts. Place names and coordinates come from <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0). Astro Book is open-source software under the AGPL-3.0 licence, and <a href="https://github.com/SumeetSingh-R/astro-book-app">its source code is public</a>.</p>
      <p><Link className="btn outline" to="/">Back to the home page</Link></p>
    </div>
  );
}
