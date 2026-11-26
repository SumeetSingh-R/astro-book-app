// The AI model that turns engine-calculated chart facts into plain language.
// The key is read from the server's environment (ANTHROPIC_API_KEY) and never reaches the browser
// or the repository. Without a key the app still works: readings fall back to fixed text and
// "Ask your chart" says it is not switched on yet.
import { ApiError } from './http.mjs';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const API_VERSION = '2023-06-01';

export function createAi(env = process.env, fetchImpl = fetch) {
  const key = env.ANTHROPIC_API_KEY;
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const base = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const effort = env.AI_EFFORT || 'low';

  return {
    model,
    configured: () => Boolean(key),

    /** Send one request and return the model's text. Throws ApiError with a message safe to show. */
    async complete({ system, messages, maxTokens = 2500 }) {
      if (!key) throw new ApiError(503, 'ai_not_configured', 'Answers from your chart are not switched on yet.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let res;
      try {
        res = await fetchImpl(`${base}/v1/messages`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': API_VERSION },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, output_config: { effort } }),
        });
      } catch (e) {
        console.error('AI request failed:', e?.name ?? e);
        throw new ApiError(504, 'ai_unreachable', 'The answer took too long to arrive. Please try again.');
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json())?.error?.message ?? ''; } catch { /* not JSON */ }
        console.error(`AI request returned ${res.status}: ${detail}`);
        if (res.status === 401 || res.status === 403) {
          throw new ApiError(503, 'ai_not_configured', 'Answers from your chart are not available: the AI key was not accepted.');
        }
        if (res.status === 429 || res.status === 529) {
          throw new ApiError(503, 'ai_busy', 'The service is busy right now. Please try again in a minute.');
        }
        throw new ApiError(502, 'ai_error', 'The answer could not be written just now. Please try again.');
      }

      const data = await res.json();
      const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (!text) {
        console.error('AI returned no text. stop_reason:', data.stop_reason);
        throw new ApiError(502, 'ai_error', 'The answer could not be written just now. Please try again.');
      }
      return { text, usage: data.usage ?? null, model: data.model ?? model };
    },
  };
}
