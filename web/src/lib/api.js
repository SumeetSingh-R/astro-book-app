import { supabase } from './supabase.js';

/** Call the Astro Book API. Throws an Error whose message is safe to show to the user. */
export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sign in to use this feature.');
    headers.authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}
