import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useRemembered } from '../lib/cache.js';
import { useAuth } from '../App.jsx';
import { useT } from '../lib/language.jsx';
import { photoLinks } from '../lib/photos.js';
import { ListSkeleton } from '../components/Skeleton.jsx';

/** For photo reviewers only: approve or reject new photos before anyone else can see them. */
export default function AdminPhotos({ embedded = false }) {
  const t = useT();
  const { session } = useAuth();
  const [error, setError] = useState(null);
  const queue = useRemembered(`photoQueue:${session.user.id}`, async () => {
    const admin = await supabase.rpc('is_meet_admin');
    if (admin.data !== true) return { admin: false, photos: [] };
    const { data, error: err } = await supabase.from('meet_photos').select('id, path, created_at').eq('status', 'pending').order('created_at').limit(60);
    if (err) throw new Error('The photos could not be loaded.');
    const links = await photoLinks(data.map((p) => p.path));
    return { admin: true, photos: data.map((p) => ({ ...p, url: links[p.path] ?? null })) };
  }, { maxAge: 0 });

  async function review(photo, status) {
    setError(null);
    const { error: err } = await supabase.rpc('review_meet_photo', { p_id: photo.id, p_status: status });
    if (err) { setError(t('That could not be saved. Try again.')); return; }
    queue.set((q) => ({ ...q, photos: q.photos.filter((p) => p.id !== photo.id) }));
  }

  if (queue.error) return <p className="error" role="alert">{t(queue.error)}</p>;
  if (!queue.data) return <ListSkeleton label={t('Loading…')} />;
  if (!queue.data.admin) return <div className="sheet"><h1>{t('Page not found')}</h1></div>;
  return (
    <>
      <div>{embedded ? <h2>{t('Photos to review')}</h2> : <h1>{t('Photos to review')}</h1>}<p className="muted">{t('Approve a photo if it clearly shows one adult and nothing unsuitable. Rejected photos stay hidden from everyone but their owner.')}</p></div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {queue.data.photos.length === 0 ? <p className="notice">{t('Nothing waiting for review.')}</p> : (
        <ul className="review-grid">
          {queue.data.photos.map((p) => (
            <li key={p.id} className="card">
              {p.url ? <img src={p.url} alt={t('Photo waiting for review')} /> : null}
              <div className="pills"><button type="button" className="btn small" onClick={() => review(p, 'approved')}>{t('Approve')}</button><button type="button" className="btn small danger" onClick={() => review(p, 'rejected')}>{t('Reject')}</button></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
