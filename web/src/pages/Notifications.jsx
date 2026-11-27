import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInbox } from '../lib/inbox.jsx';
import { useT, msg } from '../lib/language.jsx';
import { formatDate } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

const KINDS = {
  match: { icon: 'heart', title: msg('You and {0} matched'), hint: msg('You both liked each other. Say hello.'), to: (n) => `/chats/${n.actor_id}` },
  invite_accepted: { icon: 'match', title: msg('{0} accepted your invite'), hint: msg('See how your charts fit.'), to: () => '/invite' },
  photo_approved: { icon: 'camera', title: msg('Your photo was approved'), hint: msg('Other people can see it now.'), to: () => '/me' },
  photo_rejected: { icon: 'camera', title: msg('A photo was not approved'), hint: msg('Photos need to show you clearly. Choose another one.'), to: () => '/me' },
};

function Row({ to, icon, title, hint, when, fresh }) {
  const t = useT();
  return (
    <li>
      <Link className={`card note-row${fresh ? ' new' : ''}`} to={to}>
        <span className="note-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <span className="chat-row-text"><strong>{title}</strong><span className="hint">{hint}</span></span>
        {fresh ? <span className="tag focus">{t('New')}</span> : when ? <span className="hint when">{when}</span> : null}
      </Link>
    </li>
  );
}

/** Everything waiting for the person, newest first. Opening the page marks it as seen. */
export default function Notifications() {
  const t = useT();
  const { unread, unseen, notifications, review, markRead } = useInbox();
  useEffect(() => { if (unseen > 0) markRead(); }, [unseen, markRead]);

  const empty = !unread && notifications.length === 0 && !(review?.photos || review?.reports);
  return (
    <div className="sheet meet">
      <div><h1>{t('Notifications')}</h1><p className="muted">{t('New matches, accepted invites and photo reviews.')}</p></div>
      {empty ? <div className="empty card"><p>{t('Nothing new yet. When someone likes you back or accepts your invite, you will see it here.')}</p><Link className="btn" to="/discover">{t('Go to Discover')}</Link></div> : (
        <ul className="meet-list">
          {review?.photos ? <Row to="/admin" icon="camera" title={`${review.photos} photos waiting for review`} hint="Open the admin portal to approve or reject them." fresh /> : null}
          {review?.reports ? <Row to="/admin" icon="lock" title={`${review.reports} open reports`} hint="Open the admin portal to read them." fresh /> : null}
          {unread ? <Row to="/chats" icon="chat" title={t('{0} new messages', [unread])} hint={t('Open your chats to read them.')} fresh /> : null}
          {notifications.map((n) => {
            const kind = KINDS[n.kind];
            if (!kind) return null;
            return <Row key={n.id} to={kind.to(n)} icon={kind.icon} title={t(kind.title, [n.actor_name ?? t('Someone')])} hint={t(kind.hint)} fresh={!n.read}
              when={formatDate(n.created_at, { day: 'numeric', month: 'short' })} />;
          })}
        </ul>
      )}
      <p className="private"><Icon name="lock" size={18} />{t('These show only while Astro Book is open. We do not send emails or phone alerts.')}</p>
    </div>
  );
}
