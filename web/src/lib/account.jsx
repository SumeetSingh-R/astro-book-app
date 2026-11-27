import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { peek, store } from './cache.js';

// The signed-in person's own birth details: the one saved chart marked as theirs.
// Today, Ask and the profile page all read from it, so it is entered once.
const AccountContext = createContext({ self: null, loading: true, reload: async () => {} });
export const useAccount = () => useContext(AccountContext);

const COLUMNS = 'id, name, birth_date, birth_time, time_unknown, place_name, latitude, longitude, timezone';

export function AccountProvider({ userId, children }) {
  // `forUser` records whose details are loaded, so a page never acts on the previous (or no) user's answer.
  const [state, setState] = useState({ self: null, forUser: null });
  const reload = useCallback(async () => {
    if (!userId) { setState({ self: null, forUser: null }); return null; }
    const { data } = await supabase.from('birth_profiles').select(COLUMNS).eq('is_self', true).maybeSingle();
    store('self', { row: data ?? null });
    setState({ self: data ?? null, forUser: userId });
    return data ?? null;
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  // What was remembered from the last visit is used until the fresh answer arrives, so pages open at once.
  const remembered = useMemo(() => (userId ? peek('self')?.value ?? null : null), [userId]);
  const loaded = state.forUser === userId;
  const loading = Boolean(userId) && !loaded && !remembered;
  const self = loaded ? state.self : remembered?.row ?? null;
  return <AccountContext.Provider value={{ self: loading ? null : self, loading, reload }}>{children}</AccountContext.Provider>;
}

/** Turn a saved row into the values the birth form edits. */
export function toFormValues(row) {
  return {
    name: row.name,
    date: row.birth_date,
    time: row.time_unknown || !row.birth_time ? '' : String(row.birth_time).slice(0, 5),
    timeUnknown: row.time_unknown,
    place: { label: row.place_name, latitude: row.latitude, longitude: row.longitude, timezone: row.timezone },
  };
}

/** Turn birth form values into database columns. */
export function toRow(values) {
  return {
    name: values.name,
    birth_date: values.date,
    birth_time: values.time,
    time_unknown: values.timeUnknown,
    place_name: values.place.label,
    latitude: values.place.latitude,
    longitude: values.place.longitude,
    timezone: values.place.timezone,
  };
}
