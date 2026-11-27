import { createContext, useContext } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { supabase } from './supabase.js';
import { useRemembered } from './cache.js';
import { useAuth } from '../App.jsx';
import { useT } from './language.jsx';
import Icon from '../components/Icon.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';

// Family help: a parent (or other family member) the person invited can use Discover and Chats on
// the person's behalf. The pages are the same ones; "acting" says whose side they are showing.
// What a helper may read or do is decided by the database, not here.

const ActingContext = createContext(null);

/** Both sides of the signed-in person's family help: { helpers, helping, invites }. */
export function useFamily(userId) {
  return useRemembered(userId ? `family:${userId}` : null, async () => {
    const { data, error } = await supabase.rpc('my_family');
    if (error || !data) throw new Error('Your family help could not be loaded. Refresh the page to try again.');
    return data;
  }, { maxAge: 30 * 1000 });
}

/**
 * Whose meet-and-match this page is showing.
 * { own, userId, acting, base }: `userId` is the person being helped when acting, otherwise the
 * signed-in person; `base` goes in front of links so they stay on the helped person's pages.
 */
export function useActor() {
  const { session } = useAuth();
  const acting = useContext(ActingContext);
  const own = session.user.id;
  return { own, userId: acting ? acting.person : own, acting, base: acting ? `/family/${acting.person}` : '' };
}

/** Wraps the pages a helper uses for someone else. Checks the help is still on, and says clearly whose pages these are. */
export function Acting({ children }) {
  const t = useT();
  const { person } = useParams();
  const { session } = useAuth();
  const family = useFamily(session.user.id);
  if (family.error) return <p className="error" role="alert">{t(family.error)}</p>;
  if (!family.data) return <ListSkeleton label={t('Loading…')} />;
  const link = family.data.helping.find((h) => h.person === person) ?? null;
  if (!link || link.paused) {
    return (
      <div className="sheet">
        <h1>{t('You cannot help with this profile right now')}</h1>
        <p className="muted">{link ? t('{0} has paused your help. They can turn it back on at any time.', [link.name]) : t('The person may have ended the help, or the link is wrong.')}</p>
        <Link className="btn" to="/family">{t('Back to family')}</Link>
      </div>
    );
  }
  const base = `/family/${link.person}`;
  return (
    <ActingContext.Provider value={link}>
      <div className="acting-bar" role="status">
        <p><Icon name="match" size={20} /><span>{t('You are helping {0}. They can see what you do here.', [link.name])}</span></p>
        <nav aria-label={t('Helping {0}', [link.name])}>
          <NavLink to={`${base}/discover`}>{t('Discover')}</NavLink>
          {link.can_chat ? <NavLink to={`${base}/chats`}>{t('Chats')}</NavLink> : null}
          <Link to="/family">{t('Stop')}</Link>
        </nav>
      </div>
      {children}
    </ActingContext.Provider>
  );
}
