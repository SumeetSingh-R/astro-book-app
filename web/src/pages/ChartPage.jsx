import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import ChartView from '../components/ChartView.jsx';

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
      {!data && !error ? <p className="muted">Calculating the chart…</p> : null}
      {data ? (
        <>
          <h1>{data.profile.name}</h1>
          <p className="lede">{data.profile.placeName}</p>
          <ChartView chart={data.chart} />
        </>
      ) : null}
    </>
  );
}
