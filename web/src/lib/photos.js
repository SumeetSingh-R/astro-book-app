// Profile photos: shrink in the browser, keep in the private "meet-photos" store, show through short-lived links.
import { supabase } from './supabase.js';

const BUCKET = 'meet-photos';
const LONGEST_SIDE = 1600;

/** Turn any picked image into a JPEG no larger than 1600px on its longest side. */
export async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('shrink'))), 'image/jpeg', 0.86));
}

/** Add a photo for the signed-in person at a position. Returns the saved row. */
export async function addPhoto(userId, file, position) {
  const blob = await shrink(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from('meet_photos').insert({ user_id: userId, path, position }).select('id, path, position, status').single();
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
  return data;
}

/** Remove photos: the files first, then their rows. */
export async function removePhotos(photos) {
  if (!photos.length) return;
  await supabase.storage.from(BUCKET).remove(photos.map((p) => p.path));
  const { error } = await supabase.from('meet_photos').delete().in('id', photos.map((p) => p.id));
  if (error) throw error;
}

/** Save a new order: the array index becomes each photo's position. */
export async function reorderPhotos(photos) {
  // Positions are unique per person, so park them out of the way first, then set the final ones.
  const { error } = await supabase.rpc('reorder_meet_photos', { p_ids: photos.map((p) => p.id) });
  if (error) throw error;
}

/** Short-lived links for showing the person's own photos: { path: url }. */
export async function photoLinks(paths) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
