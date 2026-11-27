// The stand-in backend for the clickable prototype. It answers every request the app makes (the
// database, sign-in and the server functions) from a sample world held in the browser, so the
// whole app can be clicked through with no server and no real accounts.
// It follows the same rules as the real database where a screen depends on them: who may see
// what, what a family helper may do, message limits, and notifications.
import fixtures from './fixtures.json';
import generated from './generated.json';
import { keysFromChart } from '../lib/meet.js';
import { emit, uploads } from './bus.js';
import { seed, SELF_ID, PLACES, REPLIES } from './data.js';

const STORE = 'astrobook.prototype.v3';
const ASK_LIMIT = 10;
const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `x${Math.random().toString(36).slice(2)}${Date.now()}`);

// ---------- the sample world ----------
let db = load();
function load() {
  try { const saved = JSON.parse(localStorage.getItem(STORE)); if (saved?.users) return saved; } catch { /* storage unavailable: start fresh each visit */ }
  return seed();
}
function save() {
  // Photos picked in this visit live in memory only, so their rows are not kept either.
  try { localStorage.setItem(STORE, JSON.stringify({ ...db, meet_photos: [] })); } catch { /* fine without it */ }
}
export function reset() { db = seed(); uploads.clear(); save(); }
const ownKeys = () => keysFromChart(fixtures.chart.chart);
function keysOf(userId) {
  const row = db.meet_keys.find((k) => k.user_id === userId);
  if (row) return row;
  // In the prototype every new chart is the sample chart, so its match keys are the sample ones too.
  return db.birth_profiles.some((b) => b.user_id === userId && b.is_self) ? { user_id: userId, ...ownKeys() } : null;
}

// ---------- sign-in ----------
const b64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenFor = (user) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 30 * 86400 })}.c2FtcGxl`;
const authUser = (user) => ({ id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: user.created_at, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: user.created_at, updated_at: user.created_at });
export function sessionFor(userId) {
  const user = db.users.find((u) => u.id === userId);
  return { access_token: tokenFor(user), token_type: 'bearer', expires_in: 30 * 86400, expires_at: Math.floor(Date.now() / 1000) + 30 * 86400, refresh_token: `r.${user.id}`, user: authUser(user) };
}
function uidOf(headers) {
  const m = /^Bearer\s+(.+)$/i.exec(headers.get('authorization') ?? '');
  const parts = m ? m[1].split('.') : [];
  if (parts.length !== 3) return null;
  try { const sub = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))))).sub; return db.users.some((u) => u.id === sub) ? sub : null; } catch { return null; }
}
function userByEmail(email) {
  const clean = String(email ?? '').trim().toLowerCase() || 'guest@example.com';
  let user = db.users.find((u) => u.email === clean);
  if (!user) { user = { id: id(), email: clean, created_at: now() }; db.users.push(user); db.profiles.push({ id: user.id, language: 'hg' }); save(); }
  return user;
}

// ---------- who may see and do what ----------
const link = (person, helper) => db.family_links.find((g) => g.person === person && g.helper === helper && !g.paused);
function actsFor(uid, person, what = 'view') {
  if (!uid) return false;
  if (uid === person) return true;
  const g = link(person, uid);
  return Boolean(g && (what === 'view' || (what === 'like' && g.can_like) || (what === 'chat' && g.can_chat)));
}
const likes = (a, b) => db.meet_likes.some((l) => l.liker === a && l.liked === b && l.kind === 'like');
const blocked = (a, b) => db.meet_blocks.some((x) => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
const suspended = (userId) => db.meet_suspensions.some((s) => s.user_id === userId);
const canChat = (a, b) => likes(a, b) && likes(b, a) && !blocked(a, b) && !suspended(a) && !suspended(b);
const adminRole = (uid) => db.meet_admins.find((a) => a.user_id === uid)?.role ?? null;
const ownsProfile = (uid, birthProfileId) => db.birth_profiles.some((b) => b.id === birthProfileId && b.user_id === uid);
function nameOf(userId) {
  return db.meet_profiles.find((p) => p.user_id === userId)?.display_name
    ?? db.birth_profiles.find((b) => b.user_id === userId && b.is_self)?.name?.trim().split(/\s+/)[0] ?? 'Someone';
}
const invitePerson = (userId) => ({ user_id: userId, name: nameOf(userId), gender: db.meet_profiles.find((p) => p.user_id === userId)?.gender ?? null, keys: keysOf(userId) ? (({ user_id, ...k }) => k)(keysOf(userId)) : null });

const SEE = {
  profiles: (r, u) => r.id === u,
  birth_profiles: (r, u) => r.user_id === u,
  chat_messages: (r, u) => ownsProfile(u, r.birth_profile_id),
  ai_usage: (r, u) => r.user_id === u,
  meet_profiles: (r, u) => actsFor(u, r.user_id),
  meet_preferences: (r, u) => actsFor(u, r.user_id),
  meet_keys: (r, u) => actsFor(u, r.user_id),
  meet_photos: (r, u) => actsFor(u, r.user_id) || Boolean(adminRole(u)),
  meet_likes: (r, u) => actsFor(u, r.liker) || (r.kind === 'like' && actsFor(u, r.liked)),
  meet_messages: (r, u) => r.sender === u || r.recipient === u || actsFor(u, r.sender, 'chat') || actsFor(u, r.recipient, 'chat'),
  meet_blocks: (r, u) => r.blocker === u,
  meet_reports: (r, u) => r.reporter === u,
  meet_suspensions: (r, u) => r.user_id === u,
  meet_invites: (r, u) => r.inviter === u,
  family_invites: (r, u) => r.person === u,
  family_links: (r, u) => r.person === u || r.helper === u,
  family_suggestions: (r, u) => r.person === u || r.helper === u,
};
const KEY = { profiles: ['id'], meet_profiles: ['user_id'], meet_preferences: ['user_id'], meet_keys: ['user_id'], meet_likes: ['liker', 'liked'], meet_blocks: ['blocker', 'blocked'], family_links: ['person', 'helper'], family_suggestions: ['person', 'suggested'], meet_invites: ['code'], family_invites: ['code'] };

// ---------- things that happen as a result ----------
function notify(userId, kind, actor = null) {
  if (!db.users.some((u) => u.id === userId)) return;
  let row = actor ? db.meet_notifications.find((n) => n.user_id === userId && n.kind === kind && n.actor === actor) : db.meet_notifications.find((n) => n.user_id === userId && n.kind === kind && !n.read_at);
  if (row) { row.created_at = now(); row.read_at = null; } else { row = { id: id(), user_id: userId, kind, actor, created_at: now(), read_at: null }; db.meet_notifications.push(row); }
  emit({ kind: 'pg', table: 'meet_notifications', type: 'INSERT', new: row });
}
function refuse(message, code = '42501', status = 403) { const e = new Error(message); e.pg = { code, message, details: null, hint: null }; e.status = status; return e; }

const after = {
  meet_likes(row, uid, before) {
    row.acted_by = uid !== row.liker ? uid : null;
    if (before?.kind !== row.kind) row.created_at = now();
    if (row.kind === 'like' && before?.kind !== 'like' && likes(row.liked, row.liker) && !blocked(row.liker, row.liked)) {
      notify(row.liked, 'match', row.liker);
      if (row.acted_by) notify(row.liker, 'match', row.liked);
    }
    if (row.kind === 'pass') db.meet_notifications = db.meet_notifications.filter((n) => !(n.kind === 'match' && ((n.user_id === row.liker && n.actor === row.liked) || (n.user_id === row.liked && n.actor === row.liker))));
  },
  meet_messages(row, uid) {
    row.id = id(); row.created_at = now(); row.read_at = null; row.sent_by = uid !== row.sender ? uid : null;
    emit({ kind: 'pg', table: 'meet_messages', type: 'INSERT', new: row });
    answerLater(row);
  },
  meet_photos(row) { row.id = id(); row.status = 'pending'; row.created_at = now(); },
  meet_reports(row) { row.id = id(); row.status = 'open'; row.created_at = now(); },
  meet_blocks(row) { row.created_at = now(); db.meet_notifications = db.meet_notifications.filter((n) => !((n.user_id === row.blocker && n.actor === row.blocked) || (n.user_id === row.blocked && n.actor === row.blocker))); },
  family_suggestions(row) { row.created_at = now(); notify(row.person, 'family_suggested', row.helper); },
  family_invites(row) { row.created_at = now(); row.expires_at = new Date(Date.now() + 7 * 86400000).toISOString(); row.used_at = null; },
  meet_invites(row) { row.created_at = now(); row.expires_at = new Date(Date.now() + 7 * 86400000).toISOString(); },
  birth_profiles(row) { row.id ??= id(); row.created_at ??= now(); if (!db.chart_facts.some((c) => c.birth_profile_id === row.id)) db.chart_facts.push({ birth_profile_id: row.id, lagna: row.time_unknown ? null : 'Mesha', moon: 'Kumbha', star: 'Shatabhisha' }); },
  meet_profiles(row) { row.created_at ??= now(); },
};
const check = {
  meet_likes(row, uid) { if (!actsFor(uid, row.liker, 'like')) throw refuse('new row violates row-level security policy for table "meet_likes"'); },
  meet_messages(row, uid) {
    if (!actsFor(uid, row.sender, 'chat') || !canChat(row.sender, row.recipient)) throw refuse('new row violates row-level security policy for table "meet_messages"');
    const sent = db.meet_messages.filter((m) => m.sender === row.sender);
    if (sent.filter((m) => Date.now() - Date.parse(m.created_at) < 60000).length >= 20) throw refuse('limit:minute', 'P0001', 400);
    if (!db.meet_messages.some((m) => m.sender === row.recipient && m.recipient === row.sender) && sent.filter((m) => m.recipient === row.recipient).length >= 5) throw refuse('limit:first', 'P0001', 400);
  },
  family_suggestions(row, uid) { if (row.helper !== uid || !actsFor(uid, row.person)) throw refuse('new row violates row-level security policy for table "family_suggestions"'); },
};

/** The sample people answer: they "type" for a moment, read what was sent, then reply. */
function answerLater(message) {
  const them = message.recipient;
  if (!/^p\d+$/.test(them)) return;
  const me = message.sender;
  const topic = `chat:${[me, them].sort().join(':')}`;
  setTimeout(() => emit({ kind: 'broadcast', topic, event: 'typing', payload: { from: them } }), 900);
  setTimeout(() => emit({ kind: 'broadcast', topic, event: 'typing', payload: { from: them } }), 2200);
  setTimeout(() => {
    if (!canChat(me, them)) return;
    for (const m of db.meet_messages) if (m.sender === me && m.recipient === them && !m.read_at) { m.read_at = now(); emit({ kind: 'pg', table: 'meet_messages', type: 'UPDATE', new: m }); }
    const said = db.meet_messages.filter((m) => m.sender === them && m.recipient === me).length;
    const reply = { id: id(), sender: them, recipient: me, body: REPLIES[said % REPLIES.length], created_at: now(), read_at: null, sent_by: null };
    db.meet_messages.push(reply);
    save();
    emit({ kind: 'pg', table: 'meet_messages', type: 'INSERT', new: reply });
  }, 3600);
}

// ---------- reading and writing rows, the way the database's web address does ----------
function splitTop(text) {
  const parts = []; let depth = 0; let start = 0;
  for (let i = 0; i < text.length; i++) { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; else if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; } }
  parts.push(text.slice(start));
  return parts;
}
function test(op, want, value) {
  const have = value === null || value === undefined ? null : String(value);
  if (op === 'eq') return have === want;
  if (op === 'neq') return have !== want;
  if (op === 'is') return want === 'null' ? have === null : have === want;
  if (op === 'in') return want.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(have);
  if (op === 'gt') return have > want; if (op === 'gte') return have >= want; if (op === 'lt') return have < want; if (op === 'lte') return have <= want;
  return true;
}
function term(text) {
  if (text.startsWith('and(')) { const inner = splitTop(text.slice(4, -1)).map(term); return (row) => inner.every((f) => f(row)); }
  if (text.startsWith('or(')) { const inner = splitTop(text.slice(3, -1)).map(term); return (row) => inner.some((f) => f(row)); }
  const [column, op, ...rest] = text.split('.');
  return (row) => test(op, rest.join('.'), row[column]);
}
function filtersOf(params) {
  const out = [];
  for (const [name, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(name)) continue;
    if (name === 'or') { const inner = splitTop(value.slice(1, -1)).map(term); out.push((row) => inner.some((f) => f(row))); continue; }
    const dot = value.indexOf('.');
    out.push((row) => test(value.slice(0, dot), value.slice(dot + 1), row[name]));
  }
  return out;
}
function rest(table, method, url, headers, body, uid) {
  const rows = db[table];
  const see = SEE[table];
  if (!rows || !see) return [];
  const wants = filtersOf(url.searchParams);
  const match = (row) => see(row, uid) && wants.every((f) => f(row));
  const one = (headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const back = (list) => {
    if (method !== 'GET' && !(headers.get('prefer') ?? '').includes('return=representation')) return null;
    if (!one) return list;
    if (list.length === 1) return list[0];
    throw refuse('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406);
  };
  if (method === 'GET' || method === 'HEAD') {
    let list = rows.filter(match);
    for (const part of (url.searchParams.get('order') ?? '').split(',').filter(Boolean).reverse()) {
      const [column, direction] = part.split('.');
      list = [...list].sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? '')) * (direction === 'desc' ? -1 : 1));
    }
    const limit = Number(url.searchParams.get('limit'));
    return back(limit ? list.slice(0, limit) : list);
  }
  if (!uid) throw refuse('permission denied', '42501', 401);
  if (method === 'POST') {
    const incoming = Array.isArray(body) ? body : [body];
    const upsert = (headers.get('prefer') ?? '').includes('resolution=');
    const keep = (headers.get('prefer') ?? '').includes('ignore-duplicates');
    const out = [];
    for (const raw of incoming) {
      const row = { ...raw };
      check[table]?.(row, uid);
      const key = (url.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
      const conflict = key.length ? key : KEY[table] ?? [];
      const old = upsert && conflict.length ? rows.find((r) => conflict.every((k) => String(r[k]) === String(row[k]))) : null;
      if (old) { if (!keep) { const before = { ...old }; Object.assign(old, row); after[table]?.(old, uid, before); } out.push(old); } else { after[table]?.(row, uid, null); rows.push(row); out.push(row); }
    }
    save();
    return back(out);
  }
  if (method === 'PATCH') {
    const list = rows.filter(match);
    for (const row of list) { const before = { ...row }; Object.assign(row, body); if (table === 'meet_likes') after.meet_likes(row, uid, before); }
    save();
    return back(list);
  }
  if (method === 'DELETE') {
    const gone = rows.filter(match);
    db[table] = rows.filter((r) => !gone.includes(r));
    if (table === 'family_links') for (const g of gone) { db.family_suggestions = db.family_suggestions.filter((s) => !(s.person === g.person && s.helper === g.helper)); db.meet_notifications = db.meet_notifications.filter((n) => !(n.user_id === g.person && n.actor === g.helper && n.kind.startsWith('family'))); }
    if (table === 'birth_profiles') db.chat_messages = db.chat_messages.filter((m) => !gone.some((g) => g.id === m.birth_profile_id));
    save();
    return back(gone);
  }
  return [];
}

// ---------- the database functions the app calls ----------
function wipe(userId) {
  for (const [table, columns] of Object.entries({ profiles: ['id'], birth_profiles: ['user_id'], ai_usage: ['user_id'], meet_profiles: ['user_id'], meet_preferences: ['user_id'], meet_keys: ['user_id'], meet_photos: ['user_id'], meet_likes: ['liker', 'liked'], meet_messages: ['sender', 'recipient'], meet_blocks: ['blocker', 'blocked'], meet_reports: ['reporter', 'reported'], meet_suspensions: ['user_id'], meet_admins: ['user_id'], meet_invites: ['inviter'], meet_invite_accepts: ['invitee'], family_invites: ['person'], family_links: ['person', 'helper'], family_suggestions: ['person', 'suggested', 'helper'], meet_notifications: ['user_id', 'actor'], users: ['id'] })) {
    db[table] = db[table].filter((row) => !columns.some((c) => row[c] === userId));
  }
}
const admin = (uid, owner = false) => { const role = adminRole(uid); if (!role || (owner && role !== 'owner')) throw refuse('not allowed'); return role; };
const RPC = {
  discover_people(uid, { p_as } = {}) {
    const meId = p_as ?? uid;
    const me = db.meet_profiles.find((p) => p.user_id === meId);
    if (!me || !actsFor(uid, meId)) return [];
    const year = new Date().getFullYear();
    const wants = (a, b) => a.interested_in === 'everyone' || (a.interested_in === 'men' && b.gender === 'man') || (a.interested_in === 'women' && b.gender === 'woman');
    return db.meet_profiles.filter((p) => p.user_id !== meId && p.user_id !== uid && keysOf(p.user_id)
      && (p.discoverable || (likes(p.user_id, meId) && likes(meId, p.user_id))) && !suspended(p.user_id) && !blocked(meId, p.user_id)
      && wants(me, p) && wants(p, me) && (!p.only_liked || likes(p.user_id, meId)))
      .map((p) => {
        const suggestion = db.family_suggestions.find((s) => s.person === meId && s.suggested === p.user_id);
        const { user_id: _u, ...keys } = keysOf(p.user_id);
        return {
          user_id: p.user_id, display_name: p.display_name, age: year - p.birth_year, gender: p.gender, looking_for: p.looking_for, about: p.about, height_cm: p.height_cm,
          education: p.education, work: p.work, city: p.city, marital_status: p.marital_status, diet: p.diet, drinking: p.drinking, smoking: p.smoking, interests: p.interests ?? [],
          religion: p.show_religion ? p.religion : '', community: p.show_community ? p.community : '', mother_tongue: p.mother_tongue, income_range: p.show_income ? p.income_range : null,
          family_type: p.family_type, parents: p.parents, siblings: p.siblings, keys,
          photos: db.meet_photos.filter((ph) => ph.user_id === p.user_id && ph.status === 'approved').sort((a, b) => a.position - b.position).map((ph) => ph.path),
          liked_me: likes(p.user_id, meId), my_kind: db.meet_likes.find((l) => l.liker === meId && l.liked === p.user_id)?.kind ?? null,
          family_helps: db.family_links.some((g) => g.person === p.user_id && !g.paused && (g.can_like || g.can_chat)),
          suggested_by: suggestion ? (db.family_links.find((g) => g.person === meId && g.helper === suggestion.helper)?.label ?? '') : null,
        };
      });
  },
  meet_inbox(uid) {
    if (!uid) return null;
    const unread = db.meet_messages.filter((m) => m.recipient === uid && !m.read_at && canChat(m.sender, uid)).length;
    const mine = db.meet_profiles.find((p) => p.user_id === uid);
    return {
      unread_messages: unread,
      notifications: db.meet_notifications.filter((n) => n.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).map((n) => ({
        id: n.id, kind: n.kind, created_at: n.created_at, read: Boolean(n.read_at), actor_id: n.actor,
        actor_name: !n.actor ? null : n.kind.startsWith('family') ? (db.family_links.find((g) => g.person === uid && g.helper === n.actor)?.label ?? null) : nameOf(n.actor) })),
      review: adminRole(uid) ? { photos: db.meet_photos.filter((p) => p.status === 'pending').length, reports: db.meet_reports.filter((r) => r.status === 'open').length } : null,
      online: mine?.show_online ? db.online.filter((o) => canChat(uid, o)) : [],
    };
  },
  meet_notifications_read(uid) { for (const n of db.meet_notifications) if (n.user_id === uid && !n.read_at) n.read_at = now(); save(); return null; },
  meet_mark_read(uid, { p_other }) { for (const m of db.meet_messages) if (m.recipient === uid && m.sender === p_other && !m.read_at) m.read_at = now(); save(); return null; },
  my_invites(uid) {
    return db.meet_invites.filter((i) => i.inviter === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((i) => ({ code: i.code, created_at: i.created_at, expires_at: i.expires_at, active: Date.parse(i.expires_at) > Date.now(),
      accepts: db.meet_invite_accepts.filter((a) => a.code === i.code).map((a) => ({ ...invitePerson(a.invitee), accepted_at: a.created_at })) }));
  },
  open_invite(uid, { p_code }) {
    const i = db.meet_invites.find((x) => x.code === p_code && Date.parse(x.expires_at) > Date.now());
    return i ? { code: i.code, mine: i.inviter === uid, expires_at: i.expires_at, accepted: db.meet_invite_accepts.some((a) => a.code === i.code && a.invitee === uid), inviter: invitePerson(i.inviter) } : null;
  },
  accept_invite(uid, { p_code }) {
    const i = db.meet_invites.find((x) => x.code === p_code && Date.parse(x.expires_at) > Date.now());
    if (!i || i.inviter === uid || !keysOf(uid) || blocked(uid, i.inviter)) return false;
    if (!db.meet_invite_accepts.some((a) => a.code === p_code && a.invitee === uid)) { db.meet_invite_accepts.push({ code: p_code, invitee: uid, created_at: now() }); notify(i.inviter, 'invite_accepted', uid); }
    save();
    return true;
  },
  my_family(uid) {
    return {
      helpers: db.family_links.filter((g) => g.person === uid).map((g) => ({ helper: g.helper, label: g.label, can_like: g.can_like, can_chat: g.can_chat, paused: g.paused, created_at: g.created_at })),
      helping: db.family_links.filter((g) => g.helper === uid).map((g) => ({ person: g.person, name: nameOf(g.person), can_like: g.can_like, can_chat: g.can_chat, paused: g.paused, created_at: g.created_at,
        ready: db.meet_profiles.some((p) => p.user_id === g.person) && Boolean(keysOf(g.person)) })),
      invites: db.family_invites.filter((i) => i.person === uid && !i.used_at && Date.parse(i.expires_at) > Date.now()).map((i) => ({ code: i.code, label: i.label, can_like: i.can_like, can_chat: i.can_chat, expires_at: i.expires_at })),
    };
  },
  family_activity(uid) {
    const label = (helper) => db.family_links.find((g) => g.person === uid && g.helper === helper)?.label ?? null;
    return [
      ...db.meet_likes.filter((l) => l.liker === uid && l.acted_by).map((l) => ({ kind: l.kind, at: l.created_at, by: label(l.acted_by), name: nameOf(l.liked) })),
      ...db.meet_messages.filter((m) => m.sender === uid && m.sent_by).map((m) => ({ kind: 'message', at: m.created_at, by: label(m.sent_by), name: nameOf(m.recipient) })),
      ...db.family_suggestions.filter((s) => s.person === uid).map((s) => ({ kind: 'suggest', at: s.created_at, by: label(s.helper), name: nameOf(s.suggested) })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  },
  open_family_invite(uid, { p_code }) {
    const i = db.family_invites.find((x) => x.code === p_code && Date.parse(x.expires_at) > Date.now());
    const already = i ? db.family_links.some((g) => g.person === i.person && g.helper === uid) : false;
    return i && (!i.used_at || already) ? { code: i.code, mine: i.person === uid, can_like: i.can_like, can_chat: i.can_chat, person: i.person, name: nameOf(i.person), already } : null;
  },
  accept_family_invite(uid, { p_code }) {
    const i = db.family_invites.find((x) => x.code === p_code && !x.used_at && Date.parse(x.expires_at) > Date.now());
    if (!i || !uid || i.person === uid) return false;
    if (db.family_links.some((g) => g.person === i.person && g.helper === uid)) return true;
    if (db.family_links.filter((g) => g.person === i.person).length >= 4) return false;
    db.family_links.push({ person: i.person, helper: uid, label: i.label, can_like: i.can_like, can_chat: i.can_chat, paused: false, created_at: now() });
    i.used_at = now();
    notify(i.person, 'family_joined', uid);
    save();
    return true;
  },
  meet_admin_role: (uid) => adminRole(uid),
  is_meet_admin: (uid) => Boolean(adminRole(uid)),
  review_meet_photo(uid, { p_id, p_status }) { admin(uid); const p = db.meet_photos.find((x) => x.id === p_id); if (p) { p.status = p_status; notify(p.user_id, `photo_${p_status}`); } return null; },
  reorder_meet_photos(uid, { p_ids }) { p_ids.forEach((pid, n) => { const p = db.meet_photos.find((x) => x.id === pid && x.user_id === uid); if (p) p.position = n; }); return null; },
  admin_overview(uid) {
    admin(uid);
    const pairs = db.meet_likes.filter((l) => l.kind === 'like' && l.liker < l.liked && likes(l.liked, l.liker)).length;
    return { accounts: db.users.length, new_this_week: db.users.filter((u) => Date.now() - Date.parse(u.created_at) < 7 * 86400000).length, profiles: db.meet_profiles.length,
      discoverable: db.meet_profiles.filter((p) => p.discoverable && !suspended(p.user_id)).length, suspended: db.meet_suspensions.length,
      photos_pending: db.meet_photos.filter((p) => p.status === 'pending').length, photos_approved: db.meet_photos.filter((p) => p.status === 'approved').length, photos_rejected: db.meet_photos.filter((p) => p.status === 'rejected').length,
      likes: db.meet_likes.filter((l) => l.kind === 'like').length, matches: pairs, charts_saved: db.birth_profiles.length, questions_asked: db.chat_messages.filter((m) => m.role === 'user').length };
  },
  admin_people(uid, { p_search = '' } = {}) {
    const role = admin(uid);
    const q = p_search.trim().toLowerCase();
    const year = new Date().getFullYear();
    return db.meet_profiles.map((p) => ({ user_id: p.user_id, display_name: p.display_name, age: year - p.birth_year, gender: p.gender, city: p.city, looking_for: p.looking_for, created_at: p.created_at, discoverable: p.discoverable,
      email: role === 'owner' ? db.users.find((u) => u.id === p.user_id)?.email ?? null : null, suspended: suspended(p.user_id), reason: db.meet_suspensions.find((s) => s.user_id === p.user_id)?.reason ?? '',
      photos: db.meet_photos.filter((ph) => ph.user_id === p.user_id).length, photos_pending: db.meet_photos.filter((ph) => ph.user_id === p.user_id && ph.status === 'pending').length }))
      .filter((p) => !q || [p.display_name, p.city, p.email].some((x) => String(x ?? '').toLowerCase().includes(q)));
  },
  admin_set_suspended(uid, { p_user, p_on, p_reason }) { admin(uid); db.meet_suspensions = db.meet_suspensions.filter((s) => s.user_id !== p_user); if (p_on) db.meet_suspensions.push({ user_id: p_user, reason: p_reason ?? '', created_at: now() }); return null; },
  admin_reports(uid) {
    admin(uid);
    return db.meet_reports.filter((r) => r.status === 'open').map((r) => ({ id: r.id, reason: r.reason, details: r.details, created_at: r.created_at, reporter: nameOf(r.reporter), reported_id: r.reported, reported: nameOf(r.reported),
      reported_city: db.meet_profiles.find((p) => p.user_id === r.reported)?.city ?? '', suspended: suspended(r.reported), reports_against: db.meet_reports.filter((x) => x.reported === r.reported).length }));
  },
  admin_close_report(uid, { p_id }) { admin(uid); const r = db.meet_reports.find((x) => x.id === p_id); if (r) r.status = 'closed'; return null; },
  admin_team(uid) { admin(uid, true); return db.meet_admins.map((a) => ({ user_id: a.user_id, email: db.users.find((u) => u.id === a.user_id)?.email, role: a.role, created_at: a.created_at })); },
  admin_grant(uid, { p_email, p_role }) { admin(uid, true); const user = db.users.find((u) => u.email === String(p_email).trim().toLowerCase()); if (!user) throw refuse('No account uses that email yet. Ask them to create one first.', 'P0001', 400); db.meet_admins = db.meet_admins.filter((a) => a.user_id !== user.id); db.meet_admins.push({ user_id: user.id, role: p_role, created_at: now() }); return null; },
  admin_revoke(uid, { p_user }) { admin(uid, true); if (p_user === uid) throw refuse('You cannot remove yourself.', 'P0001', 400); db.meet_admins = db.meet_admins.filter((a) => a.user_id !== p_user); return null; },
  account_files(uid, { p_user } = {}) { const who = p_user ?? uid; if (who !== uid) admin(uid, true); return [...uploads.keys()].filter((path) => path.startsWith(`${who}/`)); },
  delete_my_account(uid) {
    if (adminRole(uid) === 'owner' && db.meet_admins.filter((a) => a.role === 'owner').length === 1) throw refuse('delete:last_owner', 'P0001', 400);
    wipe(uid);
    return null;
  },
  admin_delete_account(uid, { p_user }) {
    admin(uid, true);
    if (p_user === uid) throw refuse('delete:self', 'P0001', 400);
    if (adminRole(p_user)) throw refuse('delete:admin', 'P0001', 400);
    wipe(p_user);
    return null;
  },
  push_subscribe: () => null,
  push_unsubscribe: () => null,
};

// ---------- the server functions (/api/...) ----------
const SAMPLE = 'Prototype: this is a sample answer. In the live app each answer is written from your own chart.\n\n';
const ANSWER = 'The chart points to February to June 2027 as the next period tradition reads as supportive for marriage. If you are already married, read it as a good stretch for the relationship.\n\nIn those months you are in the sub-period of Venus, the graha that rules your 7th house of partnership.\n\nBased on: Venus rules your 7th house and is exalted; the Venus sub-period until October 2028.';
const ANSWER_HG = 'Tumhari kundli ke hisaab se February se June 2027 shaadi ke liye supportive time hai. Agar shaadi ho chuki hai, toh ise rishte ke liye achha phase samjho.\n\nIn mahino mein Shukra (Venus) ka sub-period chal raha hoga, jo tumhare 7th house, yaani partnership ka swami hai.\n\nBased on: Shukra 7th house ka swami hai aur uchch ka hai; Shukra ka sub-period October 2028 tak.';
const TODAY_HG = { title: 'Paise aur family ki baaton ka din', text: 'Aaj Moon tumhari kundli ke us hisse ko light up kar raha hai jo paisa, khana aur family se juda hai, toh ghar ke practical kaam thodi attention maangenge. Aaj ka nakshatra tumhare janm nakshatra ka dost hai, isliye plans smoothly chalenge, bas mood ko thoda settle hone do. Guru, jo abhi tumhare life period ka graha hai, aaj ka swami bhi hai, toh kisi bade ki advice sunna worth it rahega.', goodFor: 'Koi bill sort karna, family ke saath khana, plans par shaant baat', takeCare: 'Comfort ke naam par impulse shopping' };

async function api(path, method, url, headers, body) {
  const uid = uidOf(headers);
  const needUser = () => { if (!uid) throw Object.assign(new Error('Sign in to use this feature.'), { status: 401, code: 'not_signed_in' }); };
  const profileName = (pid) => db.birth_profiles.find((b) => b.id === pid && b.user_id === uid);
  if (path === '/api/chart/preview') return { chart: fixtures.chart.chart };
  if (path === '/api/horoscope') {
    const system = url.searchParams.get('system') === 'western' ? 'western' : 'vedic';
    const sign = Number(url.searchParams.get('sign'));
    const all = generated.horoscope[system];
    return { date: generated.builtOn, system, language: 'en', readings: sign ? all.filter((r) => r.sign === sign) : all };
  }
  if (path === '/api/places') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    return { places: PLACES.filter(([name]) => q && name.toLowerCase().includes(q)).map(([name, state, latitude, longitude]) => ({ name, state, country: 'IN', countryName: 'India', label: `${name}, ${state}, India`, latitude, longitude, timezone: 'Asia/Kolkata', population: 0 })) };
  }
  if (path === '/api/i18n') {
    if (url.searchParams.get('lang') === 'hi') return { lang: 'hi', complete: true, strings: (await import('../../../i18n/seed/hi.mjs')).default };
    return { lang: url.searchParams.get('lang'), complete: true, strings: {} }; // other languages are translated by the live site
  }
  if (path === '/api/push') return method === 'GET' ? { configured: false, publicKey: null } : { configured: false, sent: 0 };
  needUser();
  if (path === '/api/chart') { const p = profileName(body.birthProfileId); if (!p) throw Object.assign(new Error('That chart was not found.'), { status: 404, code: 'not_found' }); return { ...fixtures.chart, profile: { id: p.id, name: p.name, placeName: p.place_name } }; }
  if (path === '/api/reading') { const lang = body.language === 'hi' ? 'hi' : 'en'; const data = fixtures[`reading_${lang}`]; return { ...data, reading: { ...data.reading, language: body.language ?? 'en' } }; }
  if (path === '/api/today') {
    const p = profileName(body.birthProfileId) ?? { id: SELF_ID, name: 'Asha' };
    const base = fixtures.today_en;
    const reading = body.language === 'hg' ? { ...base.reading, ...TODAY_HG, language: 'hg' } : { ...base.reading, language: body.language ?? 'en' };
    return { ...base, date: generated.builtOn, profile: { id: p.id, name: p.name }, reading };
  }
  if (path === '/api/match') {
    const data = fixtures[`match_${body.system === 'western' ? 'western' : 'vedic'}`];
    const [a, b] = body.system === 'vedic' ? [body.groomProfileId, body.brideProfileId] : [body.profileAId, body.profileBId];
    const named = (pid, fallback) => ({ id: pid, name: profileName(pid)?.name ?? fallback });
    return { ...data, id: id(), createdAt: now(), a: named(a, data.a.name), b: named(b, data.b.name) };
  }
  if (path === '/api/ask') {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let usage = db.ai_usage.find((x) => x.user_id === uid && x.kind === 'ask' && x.day === day);
    if (!usage) { usage = { user_id: uid, kind: 'ask', day, count: 0 }; db.ai_usage.push(usage); }
    if (usage.count >= ASK_LIMIT) throw Object.assign(new Error('You have used today\'s questions. Come back tomorrow.'), { status: 429, code: 'limit_reached' });
    usage.count += 1;
    await new Promise((r) => setTimeout(r, 900));
    const answer = SAMPLE + (body.language === 'hg' ? ANSWER_HG : ANSWER);
    db.chat_messages.push({ id: id(), birth_profile_id: body.birthProfileId, role: 'user', content: body.question, language: body.language ?? 'en', created_at: now() });
    db.chat_messages.push({ id: id(), birth_profile_id: body.birthProfileId, role: 'assistant', content: answer, language: body.language ?? 'en', created_at: new Date(Date.now() + 1).toISOString() });
    save();
    return { answer, remaining: ASK_LIMIT - usage.count, limit: ASK_LIMIT, topic: 'marriage' };
  }
  throw Object.assign(new Error('Not in the prototype.'), { status: 404, code: 'not_found' });
}

// ---------- one door for every request ----------
const reply = (body, status = 200) => new Response(body === null || body === undefined ? null : JSON.stringify(body), { status: body === null || body === undefined ? (status === 200 ? 204 : status) : status, headers: { 'content-type': 'application/json' } });

/** Answer a request the app made, or return null when it is not one of ours (the browser then handles it as usual). */
export async function answer(input, init = {}) {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : String(input), location.href);
  const isDb = url.hostname.endsWith('.supabase.co');
  const isApi = url.pathname.startsWith('/api/') || url.pathname.includes('/api/');
  if (!isDb && !isApi) return null;
  const method = (init.method ?? request?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? request?.headers ?? {});
  let body = null;
  try { const raw = init.body ?? (request && !['GET', 'HEAD'].includes(method) ? await request.clone().text() : null); body = typeof raw === 'string' && raw ? JSON.parse(raw) : null; } catch { body = null; }
  await new Promise((r) => setTimeout(r, 120)); // a little wait, so loading states are seen as they will be
  try {
    if (isApi) return reply(await api(url.pathname.slice(url.pathname.indexOf('/api/')), method, url, headers, body ?? {}));
    const path = url.pathname;
    if (path.startsWith('/auth/v1/')) {
      if (path.endsWith('/token')) {
        const user = url.searchParams.get('grant_type') === 'refresh_token' ? db.users.find((u) => `r.${u.id}` === body?.refresh_token) : userByEmail(body?.email);
        return user ? reply(sessionFor(user.id)) : reply({ error: 'invalid_grant', error_description: 'Invalid Refresh Token' }, 400);
      }
      if (path.endsWith('/signup')) return reply(sessionFor(userByEmail(body?.email).id));
      if (path.endsWith('/user')) { const uid = uidOf(headers); return uid ? reply(authUser(db.users.find((u) => u.id === uid))) : reply({ code: 401, msg: 'invalid token' }, 401); }
      return reply(null);
    }
    const uid = uidOf(headers);
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = RPC[path.split('/').pop()];
      const result = fn ? fn(uid, body ?? {}) : null;
      save();
      return reply(result === undefined ? null : result);
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').pop();
      if (table === 'charts') {
        const mine = db.chart_facts.filter((c) => ownsProfile(uid, c.birth_profile_id));
        const wanted = url.searchParams.get('birth_profile_id');
        const list = wanted?.startsWith('eq.') ? mine.filter((c) => c.birth_profile_id === wanted.slice(3)) : mine;
        return reply((headers.get('accept') ?? '').includes('vnd.pgrst.object') ? list[0] ?? null : list);
      }
      return reply(rest(table, method, url, headers, body, uid));
    }
    return reply([]); // storage and anything else: nothing to say
  } catch (e) {
    if (e.pg) return reply(e.pg, e.status ?? 400);
    return reply({ error: { code: e.code ?? 'internal_error', message: e.message } }, e.status ?? 500);
  }
}
