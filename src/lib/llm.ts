// ---------------------------------------------------------------------------
// LLM client. Runs ONLY in the background service worker, so the API key never
// touches page context. The provider registry (providers.ts) supplies the wire
// format (OpenAI-compatible or Anthropic) and base URL; here we just build the
// request. Works for OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek,
// xAI, Mistral, Together, Fireworks, Perplexity, Ollama, the built-in proxy,
// and any custom OpenAI-compatible endpoint.
// ---------------------------------------------------------------------------
import type { Settings } from './types';
import { getProvider, resolveBaseUrl, resolveModel } from './providers';

export interface ChatArgs {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  /** Ask OpenAI-style providers for a JSON object response. */
  jsonMode?: boolean;
  /** Per-install id, sent to the built-in backend for per-user rate limiting. */
  clientId?: string;
}

class LlmError extends Error {}

function requireKey(settings: Settings) {
  const p = getProvider(settings.provider);
  if (p.needsKey && !settings.apiKey.trim()) {
    throw new LlmError(
      `No API key set. Add your ${p.label} key in RoleReveal options.`,
    );
  }
}

async function callAnthropic(
  base: string,
  key: string,
  model: string,
  args: ChatArgs,
): Promise<string> {
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required when calling the API from a browser-context origin.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      system: args.system,
      messages: [{ role: 'user', content: args.user }],
    }),
  });
  if (!res.ok) {
    throw new LlmError(`Anthropic ${res.status}: ${await safeText(res)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  if (!text) throw new LlmError('Anthropic returned an empty response.');
  return text;
}

// OpenAI's GPT-5+/GPT-6 and o-series models are reasoning models. On Chat
// Completions they reject `temperature` unless reasoning effort is `none`, and
// they take `max_completion_tokens` (which also counts hidden reasoning tokens)
// instead of the deprecated `max_tokens`.
const OPENAI_REASONING_MODEL = /^(gpt-([5-9]|\d{2,})|o\d)/i;
// Reasoning models that cannot go down to `none`; they get `low` instead.
const OPENAI_NO_NONE_EFFORT = /^(gpt-6-astra|gpt-6\.1-sol|o\d)/i;
// Room for hidden reasoning tokens when effort can't be `none`, so the visible
// JSON answer isn't cut off by finish_reason "length".
const REASONING_HEADROOM_TOKENS = 2048;

/** Builds the Chat Completions body. Exported for tests. */
export function buildOpenAiBody(
  providerId: string,
  model: string,
  args: ChatArgs,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
  };
  if (args.jsonMode) body.response_format = { type: 'json_object' };

  if (providerId === 'openai' && OPENAI_REASONING_MODEL.test(model)) {
    if (OPENAI_NO_NONE_EFFORT.test(model)) {
      body.reasoning_effort = 'low';
      body.max_completion_tokens = args.maxTokens + REASONING_HEADROOM_TOKENS;
    } else {
      body.reasoning_effort = 'none';
      body.temperature = args.temperature;
      body.max_completion_tokens = args.maxTokens;
    }
  } else if (providerId === 'openai') {
    body.temperature = args.temperature;
    body.max_completion_tokens = args.maxTokens;
  } else {
    // Other OpenAI-compatible providers and the built-in proxy still expect
    // the classic fields.
    body.temperature = args.temperature;
    body.max_tokens = args.maxTokens;
  }
  return body;
}

async function callOpenAiCompatible(
  base: string,
  key: string,
  providerId: string,
  model: string,
  args: ChatArgs,
  clientId?: string,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key.trim()) headers['authorization'] = `Bearer ${key}`;
  // Let the built-in backend enforce a per-user daily quota without accounts.
  if (clientId) headers['x-client-id'] = clientId;
  const body = buildOpenAiBody(providerId, model, args);

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await safeText(res);
    // Surface a clean message (e.g. the daily-limit text) when present.
    let msg = body;
    try {
      const j = JSON.parse(body);
      msg = j?.message || j?.error?.message || j?.error || body;
    } catch {
      /* keep raw */
    }
    throw new LlmError(`${msg} (${res.status})`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new LlmError('The provider returned an empty response.');
  return text;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

/** Single entry point. Routes to the configured provider via the registry. */
export async function chatComplete(
  settings: Settings,
  args: ChatArgs,
): Promise<string> {
  requireKey(settings);
  const p = getProvider(settings.provider);
  const base = resolveBaseUrl(settings);
  const model = resolveModel(settings);
  if (!base) {
    throw new LlmError('No base URL set. Add one in RoleReveal options.');
  }
  if (p.api === 'anthropic') {
    return callAnthropic(base, settings.apiKey, model, args);
  }
  // Only the built-in proxy gets the rate-limit client id.
  const clientId = p.id === 'builtin' ? args.clientId : undefined;
  return callOpenAiCompatible(base, settings.apiKey, p.id, model, args, clientId);
}

/**
 * Robust JSON extraction. Models occasionally wrap JSON in ```json fences or add
 * a stray sentence; this pulls out the first balanced {...} block and parses it.
 */
export function extractJson<T>(raw: string): T {
  let s = raw.trim();
  // Strip markdown code fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Fast path.
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through to bracket scan */
  }

  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in LLM response.');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        return JSON.parse(candidate) as T;
      }
    }
  }
  throw new Error('Could not parse JSON from LLM response.');
}
