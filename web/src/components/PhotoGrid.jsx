import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/language.jsx';
import { MAX_PHOTOS } from '../lib/meet.js';
import { addPhoto, removePhotos, reorderPhotos, photoLinks } from '../lib/photos.js';
import Icon from './Icon.jsx';

/** Up to six photos. The first is the main one. Changes are saved as they are made. */
export default function PhotoGrid({ userId, photos, onChange }) {
  const t = useT();
  const input = useRef(null);
  const [links, setLinks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const paths = photos.map((p) => p.path).join('|');

  useEffect(() => {
    let live = true;
    photoLinks(paths ? paths.split('|') : []).then((l) => { if (live) setLinks(l); }).catch(() => {});
    return () => { live = false; };
  }, [paths]);

  async function pick(e) {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError(null);
    let list = photos;
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('type');
        const used = new Set(list.map((p) => p.position));
        const position = [0, 1, 2, 3, 4, 5].find((n) => !used.has(n));
        list = [...list, await addPhoto(userId, file, position)];
        onChange(list);
      }
    } catch {
      setError(t('That photo could not be added. Use a JPG, PNG or WebP picture and try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo) {
    setError(null);
    try {
      await removePhotos([photo]);
      const rest = photos.filter((p) => p.id !== photo.id);
      if (rest.length) await reorderPhotos(rest);
      onChange(rest.map((p, i) => ({ ...p, position: i })));
    } catch { setError(t('That photo could not be removed. Try again.')); }
  }

  async function makeMain(photo) {
    setError(null);
    const next = [photo, ...photos.filter((p) => p.id !== photo.id)];
    try {
      await reorderPhotos(next);
      onChange(next.map((p, i) => ({ ...p, position: i })));
    } catch { setError(t('The order could not be saved. Try again.')); }
  }

  const empty = Array.from({ length: MAX_PHOTOS - photos.length });
  return (
    <div className="photos">
      <ul className="photo-grid">
        {photos.map((p, i) => (
          <li key={p.id} className="photo">
            {links[p.path] ? <img src={links[p.path]} alt={t('Your photo {0}', [i + 1])} /> : <span className="skeleton" aria-hidden="true" />}
            {i === 0 ? <span className="tag">{t('Main')}</span> : <button type="button" className="photo-main" onClick={() => makeMain(p)}>{t('Make main')}</button>}
            <button type="button" className="photo-remove" aria-label={t('Remove photo {0}', [i + 1])} onClick={() => remove(p)}><Icon name="x" size={16} /></button>
          </li>
        ))}
        {empty.map((_, i) => (
          <li key={`empty-${i}`}>
            <button type="button" className="photo-add" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name={i === 0 && photos.length === 0 ? 'camera' : 'plus'} size={24} />
              <span>{busy && i === 0 ? t('Adding…') : t('Add')}</span>
            </button>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
      <p className="hint">{t('Up to 6 photos. A clear photo of your face first. No group photos.')}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
