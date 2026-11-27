import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useRemembered } from '../lib/cache.js';
import { useAccount } from '../lib/account.jsx';
import ChartView from '../components/ChartView.jsx';
import ChartReading from '../components/ChartReading.jsx';
import AskChart from '../components/AskChart.jsx';
import Icon from '../components/Icon.jsx';
import { useT } from '../lib/language.jsx';
import { ChartPageSkeleton } from '../components/Skeleton.jsx';

export default function ChartPage() {
  const t = useT();
  const { id } = useParams();
  const { self } = useAccount();
  // A chart only changes when its birth details do, and editing those forgets it (see Profile.jsx).
  const { data, error } = useRemembered(
    `chart:${id}`,
    () => api('/api/chart', { method: 'POST', auth: true, body: { birthProfileId: id } }),
    { maxAge: 7 * 24 * 3600 * 1000 },
  );

  const v = data?.chart.vedic;
  const mine = self?.id === id;
  return (
    <>
      <p><Link className="back" to="/charts"><Icon name="back" size={18} />{t('My charts')}</Link></p>
      {error ? <><h1>{t('Chart unavailable')}</h1><p className="error" role="alert">{t(error)}</p></> : null}
      {!data && !error ? <ChartPageSkeleton label={t('Calculating the chart…')} /> : null}
      {data ? (
        <>
          <div className="chart-top">
            <div className="chart-read">
              <div className="title-row">
                <div>
                  <h1>{data.profile.name}</h1>
                  <p className="muted">{v.lagna ? `${t('{0} rising', [t(v.lagna.rashi)])}, ` : ''}{t('{0} Moon', [t(v.moonSign)])}, {t(v.dasha.moonNakshatra)}</p>
                </div>
              </div>
              <ChartReading profileId={id} />
            </div>
            <AskChart profileId={id} />
          </div>
          <section className="the-chart" aria-labelledby="chart-title">
            <div>
              <h2 id="chart-title">{mine ? t('Your birth chart') : t('{0}\'s birth chart', [data.profile.name])}</h2>
              <p className="muted">{mine ? t('Tap any house to see what it stands for and how it looks for you right now.') : t('Tap any house to see what it stands for and how it looks for them right now.')}</p>
            </div>
            <ChartView chart={data.chart} compact whose={mine ? 'your' : 'their'} />
          </section>
        </>
      ) : null}
    </>
  );
}
