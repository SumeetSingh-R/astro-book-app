import { useAccount } from '../lib/account.jsx';
import { LanguageSwitch, useT } from '../lib/language.jsx';
import AskChart from '../components/AskChart.jsx';

/** Questions about your own chart, as a page of its own. */
export default function Ask() {
  const t = useT();
  const { self } = useAccount();
  return (
    <div className="narrow-page">
      <div className="title-row end"><LanguageSwitch /></div>
      <AskChart profileId={self.id} title={t('Ask your chart')} panel={false} />
    </div>
  );
}
