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

    /** The stored reading for a chart (kind 'chart') or a day (kind 'daily'), newest first. */
    async getReading({ birthProfileId, kind, language, forDate, engineVersion }) {
      let query = supabase
        .from('readings')
        .select('content, model, created_at')
        .eq('birth_profile_id', birthProfileId)
        .eq('kind', kind)
        .eq('language', language)
        .eq('engine_version', engineVersion);
      query = forDate ? query.eq('for_date', forDate) : query.is('for_date', null);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(1);
      if (error) fail(error, 'getReading');
      return data?.[0] ?? null;
    },

    async saveReading(row) {
      const { error } = await supabase.from('readings').insert(row);
      if (error) fail(error, 'saveReading');
    },

    /** Count one AI request against today's allowance. Returns how many are left, or -1 if none. */
    async consumeQuota(kind, limit) {
      const { data, error } = await supabase.rpc('consume_ai_quota', { p_kind: kind, p_limit: limit });
      if (error) fail(error, 'consumeQuota');
      return data;
    },

    /** The latest messages of a chart's conversation, oldest first. */
    async getRecentMessages(birthProfileId, limit) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('birth_profile_id', birthProfileId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) fail(error, 'getRecentMessages');
      return (data ?? []).reverse();
    },

    async saveMessages(rows) {
      const { error } = await supabase.from('chat_messages').insert(rows);
      if (error) fail(error, 'saveMessages');
    },
  };
}
