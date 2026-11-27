import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useRemembered } from '../lib/cache.js';
import { supabase } from '../lib/supabase.js';
import { todayISO } from '../lib/format.js';
import { useLanguage, useT, msg } from '../lib/language.jsx';

const SUGGESTIONS = [msg('When is a good period for marriage?'), msg('What kind of work suits me?'), msg('How do the next two years look for money?'), msg('What is my current period about?')];
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
  const t = useT();
  const inputId = useId();
  // The conversation is shown from memory at once and then checked against the server.
  const thread = useRemembered(`chat:${profileId}`, async () => {
    const { data, error: err } = await supabase.from('chat_messages').select('id, role, content, language').eq('birth_profile_id', profileId).order('created_at', { ascending: false }).limit(40);
    if (err) throw new Error(t('The conversation could not be loaded.'));
    return data.reverse();
  }, { maxAge: 0 });
  const messages = thread.data ?? (thread.error ? [] : null);
  const setMessages = thread.set;
  const [remaining, setRemaining] = useState(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let live = true;
    setError(null);
    supabase.from('ai_usage').select('count').eq('kind', 'ask').eq('day', todayISO('Asia/Kolkata')).maybeSingle()
      .then((usage) => { if (live) setRemaining(usage.error ? null : LIMIT - (usage.data?.count ?? 0)); });
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
    if (err) setError(t('The conversation could not be deleted. Try again.'));
    else setMessages([]);
  }

  const used = remaining !== null && remaining <= 0;
  return (
    <section className={panel ? 'ask panel' : 'ask'} aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} lang={language}>{title ?? t('Ask about this chart')}</h2>
      <p className="muted" lang={language}>{t('Ask in your own words. The answer is written from this chart, not from a sign.')}</p>

      {messages === null ? <ThreadSkeleton label={t('Loading the conversation…')} /> : null}
      {messages?.length ? (
        <ol className="thread" aria-live="polite">
          {messages.map((m) => (
            <li key={m.id} className={m.role === 'user' ? 'q msg' : 'a msg'} lang={m.language}>
              {m.role === 'user' ? <p>{m.content}</p> : <Answer text={m.content} basedOnLabel={t('Based on')} />}
            </li>
          ))}
          {busy ? <li className="a waiting" lang={language}><p>{t('Reading the chart…')}</p><SkeletonLines count={3} last="50%" /></li> : null}
        </ol>
      ) : null}
      <div ref={endRef} />

      {messages && messages.length < 6 && !busy ? (
        <div className="chips" role="group" aria-label={t('Questions to start with')} lang={language}>
          {SUGGESTIONS.map((s) => t(s)).filter((s) => !messages.some((m) => m.content === s)).map((s) => <button key={s} type="button" disabled={used} onClick={() => ask(s)}>{s}</button>)}
        </div>
      ) : null}

      {error ? <p className="error" role="alert">{t(error)}</p> : null}
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label htmlFor={inputId} className="visually-hidden">{title ?? t('Ask about this chart')}</label>
        <input id={inputId} lang={language} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder={t('When is a good period for…')} disabled={busy || used} autoComplete="off" />
        <button type="submit" className="send" aria-label={t('Ask')} disabled={busy || used || question.trim().length < 3}><Icon name="go" /></button>
      </form>

      <p className="hint" lang={language}>
        {remaining !== null ? `${t('{0} of {1} questions left today.', [Math.max(0, remaining), LIMIT])} ` : null}
        {t('Your question, your age and this chart\'s planet positions go to an AI model (Claude) to write the answer. Your name, email, birth date and birth place are not sent. Answers are for reflection, not certainties.')}
      </p>
      {messages?.length ? (
        <p className="hint" lang={language}>
          {confirmClear ? (
            <>{t('Delete every question and answer here?')} <button type="button" className="link" onClick={clear}>{t('Delete them')}</button> <button type="button" className="link" onClick={() => setConfirmClear(false)}>{t('Keep them')}</button></>
          ) : (
            <button type="button" className="link" onClick={() => setConfirmClear(true)}>{t('Clear this conversation')}</button>
          )}
        </p>
      ) : null}
    </section>
  );
}
