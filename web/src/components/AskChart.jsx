import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { todayISO } from '../lib/format.js';
import { useLanguage, wordsFor } from '../lib/language.jsx';
import { ThreadSkeleton, SkeletonLines } from './Skeleton.jsx';
import Icon from './Icon.jsx';

const LIMIT = 10;

/** An answer as paragraphs and short lists, with its closing "Based on:" line set apart. */
function Answer({ text, basedOnLabel }) {
  const lines = text.split('\n');
  let basis = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^\s*(?:Based on|आधार)\s*[:：]\s*(.+)$/i.exec(lines[i]);
    if (m) { basis = m[1]; lines.splice(i, 1); break; }
    if (lines[i].trim()) break;
  }
  const blocks = lines.join('\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        const rows = block.split('\n');
        const isList = rows.length > 1 && rows.every((r) => /^\s*(?:[-•]|\d+[.)])\s+/.test(r));
        return isList
          ? <ul key={i}>{rows.map((r, j) => <li key={j}>{r.replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')}</li>)}</ul>
          : <p key={i}>{block}</p>;
      })}
      {basis ? <p className="basis"><strong>{basedOnLabel}:</strong> {basis}</p> : null}
    </>
  );
}

/** Questions about one saved chart, answered from that chart. The conversation is kept with the account. */
export default function AskChart({ profileId, title, panel = true }) {
  const [language] = useLanguage();
  const w = wordsFor(language);
  const inputId = useId();
  const [messages, setMessages] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let live = true;
    setMessages(null);
    setError(null);
    (async () => {
      const [history, usage] = await Promise.all([
        supabase.from('chat_messages').select('id, role, content, language').eq('birth_profile_id', profileId).order('created_at', { ascending: false }).limit(40),
        supabase.from('ai_usage').select('count').eq('kind', 'ask').eq('day', todayISO('Asia/Kolkata')).maybeSingle(),
      ]);
      if (!live) return;
      setMessages(history.error ? [] : history.data.reverse());
      setRemaining(usage.error ? null : LIMIT - (usage.data?.count ?? 0));
    })();
    return () => { live = false; };
  }, [profileId]);

  async function ask(text) {
    const q = text.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const pending = { id: `pending-${Date.now()}`, role: 'user', content: q, language };
    setMessages((list) => [...(list ?? []), pending]);
    setQuestion('');
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    try {
      const data = await api('/api/ask', { method: 'POST', auth: true, body: { birthProfileId: profileId, question: q, language } });
      setMessages((list) => [...list, { id: `answer-${Date.now()}`, role: 'assistant', content: data.answer, language }]);
      setRemaining(data.remaining);
    } catch (e) {
      // The question was not answered, so take it back out of the thread and return it to the box.
      setMessages((list) => list.filter((m) => m !== pending));
      setQuestion(q);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    const { error: err } = await supabase.from('chat_messages').delete().eq('birth_profile_id', profileId);
    setConfirmClear(false);
    if (err) setError('The conversation could not be deleted. Try again.');
    else setMessages([]);
  }

  const used = remaining !== null && remaining <= 0;
  return (
    <section className={panel ? 'ask panel' : 'ask'} aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} lang={language}>{title ?? w.askTitle}</h2>
      <p className="muted" lang={language}>{w.askIntro}</p>

      {messages === null ? <ThreadSkeleton label="Loading the conversation…" /> : null}
      {messages?.length ? (
        <ol className="thread" aria-live="polite">
          {messages.map((m) => (
            <li key={m.id} className={m.role === 'user' ? 'q msg' : 'a msg'} lang={m.language}>
              {m.role === 'user' ? <p>{m.content}</p> : <Answer text={m.content} basedOnLabel={wordsFor(m.language).basedOn} />}
            </li>
          ))}
          {busy ? <li className="a waiting" lang={language}><p>{w.asking}</p><SkeletonLines count={3} last="50%" /></li> : null}
        </ol>
      ) : null}
      <div ref={endRef} />

      {messages && messages.length < 6 && !busy ? (
        <div className="chips" role="group" aria-label="Questions to start with" lang={language}>
          {w.suggestions.filter((s) => !messages.some((m) => m.content === s)).map((s) => <button key={s} type="button" disabled={used} onClick={() => ask(s)}>{s}</button>)}
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label htmlFor={inputId} className="visually-hidden">{title ?? w.askTitle}</label>
        <input id={inputId} lang={language} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder={w.askPlaceholder} disabled={busy || used} autoComplete="off" />
        <button type="submit" className="send" aria-label={w.ask} disabled={busy || used || question.trim().length < 3}><Icon name="go" /></button>
      </form>

      <p className="hint" lang={language}>
        {remaining !== null ? `${w.left(Math.max(0, remaining), LIMIT)} ` : null}
        {w.privacy}
      </p>
      {messages?.length ? (
        <p className="hint" lang={language}>
          {confirmClear ? (
            <>{w.clearConfirm} <button type="button" className="link" onClick={clear}>{w.clearYes}</button> <button type="button" className="link" onClick={() => setConfirmClear(false)}>{w.clearNo}</button></>
          ) : (
            <button type="button" className="link" onClick={() => setConfirmClear(true)}>{w.clear}</button>
          )}
        </p>
      ) : null}
    </section>
  );
}
