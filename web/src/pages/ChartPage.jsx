import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import ChartView from '../components/ChartView.jsx';
import ChartReading from '../components/ChartReading.jsx';
import AskChart from '../components/AskChart.jsx';
import { LanguageSwitch } from '../lib/language.jsx';
import { ChartPageSkeleton } from '../components/Skeleton.jsx';

export default function ChartPage() {
  const { id } = useParams();
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

  return (
    <>
      <p><Link to="/charts">Back to my charts</Link></p>
      {error ? <><h1>Chart unavailable</h1><p className="error" role="alert">{error}</p></> : null}
      {!data && !error ? <ChartPageSkeleton label="Calculating the chart…" /> : null}
      {data ? (
        <>
          <div className="title-row">
            <div>
              <h1>{data.profile.name}</h1>
              <p className="lede">{data.profile.placeName}</p>
            </div>
            <LanguageSwitch />
          </div>
          <ChartReading profileId={id} />
          <AskChart profileId={id} />
          <section className="the-chart" aria-labelledby="chart-title">
            <h2 id="chart-title">The chart itself</h2>
            <ChartView chart={data.chart} compact />
          </section>
        </>
      ) : null}
    </>
  );
}
