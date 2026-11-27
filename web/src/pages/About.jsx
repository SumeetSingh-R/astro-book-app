import { Link } from 'react-router-dom';
import { useT } from '../lib/language.jsx';

export default function About() {
  const t = useT();
  return (
    <div className="prose">
      <h1>{t('About Astro Book')}</h1>
      <p className="lede">{t('Read your own birth chart, and meet people whose charts fit yours.')}</p>
      <h2>{t('How your readings are made')}</h2>
      <p>{t('Astro Book first calculates your chart from your birth details: where each graha stood, your houses, and the periods of your life. An AI model then turns those facts into plain words. It only explains; it never does the calculating.')}</p>
      <h2>{t('What to expect from it')}</h2>
      <p>{t('Readings and answers describe tendencies, not certainties. Timing is given as ranges of months that tradition reads as supportive, never as a date or a promise. For health, legal or money decisions, please speak to a qualified professional.')}</p>
      <h2>{t('Your privacy')}</h2>
      <p>{t('Your profile and saved charts are visible only to you. When you ask a question, your question, your age and your chart positions are sent to the AI model. Your name, email, birth date and birth place are not.')}</p>
      <p>{t('If you set up a Vibe match profile, other signed-in people see what you put on it and your approved photos. They never see your date, time or place of birth.')}</p>
      <p>{t('If you invite a family member to help, they see the people you can meet. They can like or chat for you only if you allow it, you see everything they do, and you can stop it at any time.')}</p>
      <p>{t('You can delete your account, and everything in it, from your profile page at any time.')}</p>
      <h2>{t('Credits')}</h2>
      <p>{t('Planet positions are calculated with Swiss Ephemeris, using the Lahiri ayanamsa for Vedic charts. Place names and coordinates come from GeoNames (CC BY 4.0).')}</p>
      <p>{t('Astro Book is open-source software under the AGPL-3.0 licence.')}{' '}<a href="https://github.com/SumeetSingh-R/astro-book-app">{t('See the source code')}</a>{' · '}<a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a>{' · '}<a href="https://www.geonames.org/">GeoNames</a></p>
      <p><Link className="btn outline" to="/">{t('Back to the home page')}</Link></p>
    </div>
  );
}
