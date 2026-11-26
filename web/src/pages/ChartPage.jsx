import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAccount } from '../lib/account.jsx';
import ChartView from '../components/ChartView.jsx';
import ChartReading from '../components/ChartReading.jsx';
import AskChart from '../components/AskChart.jsx';
import Icon from '../components/Icon.jsx';
import { LanguageSwitch } from '../lib/language.jsx';
import { ChartPageSkeleton } from '../components/Skeleton.jsx';

export default function ChartPage() {
  const { id } = useParams();
  const { self } = useAccount();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api('/api/chart', { method: 'POST', auth: true, body: { birthProfileId: id } })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id]);

  const v = data?.chart.vedic;
  const mine = self?.id === id;
  return (
    <>
      <p><Link className="back" to="/charts"><Icon name="back" size={18} />My charts</Link></p>
      {error ? <><h1>Chart unavailable</h1><p className="error" role="alert">{error}</p></> : null}
      {!data && !error ? <ChartPageSkeleton label="Calculating the chart…" /> : null}
      {data ? (
        <>
          <div className="chart-top">
            <div className="chart-read">
              <div className="title-row">
                <div>
                  <h1>{data.profile.name}</h1>
                  <p className="muted">{v.lagna ? `${v.lagna.rashi} rising, ` : ''}{v.moonSign} Moon, {v.dasha.moonNakshatra}</p>
                </div>
                <LanguageSwitch />
              </div>
              <ChartReading profileId={id} />
            </div>
            <AskChart profileId={id} />
          </div>
          <section className="the-chart" aria-labelledby="chart-title">
            <div>
              <h2 id="chart-title">{mine ? 'Your birth chart' : `${data.profile.name}'s birth chart`}</h2>
              <p className="muted">Tap any house to see what it stands for and how it looks {mine ? 'for you' : 'for them'} right now.</p>
            </div>
            <ChartView chart={data.chart} compact whose={mine ? 'your' : 'their'} />
          </section>
        </>
      ) : null}
    </>
  );
}
