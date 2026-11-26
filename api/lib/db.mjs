// Database access for the API. Every call runs as the signed-in user (their token is forwarded),
// so Supabase row-level security decides what they can read and write. No admin key is used.
import { createClient } from '@supabase/supabase-js';
import { ApiError } from './http.mjs';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config/public.mjs';

export function createDb(token, env = process.env) {
  const url = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const fail = (error, what) => {
    console.error(`Database error (${what}):`, error);
    throw new ApiError(500, 'database_error', 'Could not reach the database. Please try again.');
  };

  return {
    async getUserId() {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) throw new ApiError(401, 'not_signed_in', 'Your session has expired. Sign in again.');
      return data.user.id;
    },

    async getBirthProfile(id) {
      const { data, error } = await supabase
        .from('birth_profiles')
        .select('id, user_id, name, birth_date, birth_time, time_unknown, place_name, latitude, longitude, timezone')
        .eq('id', id)
        .maybeSingle();
      if (error) fail(error, 'getBirthProfile');
      return data; // null when it doesn't exist or belongs to someone else
    },

    async getCharts(birthProfileId, engineVersion) {
      const { data, error } = await supabase
        .from('charts')
        .select('system, data')
        .eq('birth_profile_id', birthProfileId)
        .eq('engine_version', engineVersion);
      if (error) fail(error, 'getCharts');
      return data ?? [];
    },

    async saveCharts(rows) {
      const { error } = await supabase
        .from('charts')
        .upsert(rows, { onConflict: 'birth_profile_id,system,engine_version', ignoreDuplicates: true });
      if (error) fail(error, 'saveCharts');
    },

    async saveMatch(row) {
      const { data, error } = await supabase.from('matches').insert(row).select('id, created_at').single();
      if (error) fail(error, 'saveMatch');
      return data;
    },
  };
}
