import HoroscopeReader from '../components/HoroscopeReader.jsx';

export default function Horoscope() {
  return (
    <div className="narrow-page">
      <h1>Today's horoscope, by sign</h1>
      <p className="muted">A general reading for each sign.</p>
      <HoroscopeReader />
    </div>
  );
}
