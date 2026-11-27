import HoroscopeReader from '../components/HoroscopeReader.jsx';
import { useT } from '../lib/language.jsx';

export default function Horoscope() {
  const t = useT();
  return (
    <div className="narrow-page">
      <h1>{t('Today\'s horoscope, by sign')}</h1>
      <p className="muted">{t('A general reading for each sign.')}</p>
      <HoroscopeReader />
    </div>
  );
}
