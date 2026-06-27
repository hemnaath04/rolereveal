// ---------------------------------------------------------------------------
// LLM client. Runs ONLY in the background service worker, so the API key never
// touches page context. Supports three providers:
//   - anthropic : api.anthropic.com /v1/messages
//   - openai    : api.openai.com /v1/chat/completions
//   - custom    : any OpenAI-compatible /v1/chat/completions (Manifest gateway,
//                 Ollama at http://localhost:11434/v1, etc.)
// ---------------------------------------------------------------------------
import type { Settings } from './types';

export interface ChatArgs {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  /** Ask OpenAI-style providers for a JSON object response. */
  jsonMode?: boolean;
  /** Per-install id, sent to the custom backend for per-user rate limiting. */
  clientId?: string;
}

class LlmError extends Error {}

function requireKey(settings: Settings) {
  if (settings.provider !== 'custom' && !settings.apiKey.trim()) {
    throw new LlmError(
      `No API key set. Add your ${settings.provider} key in AI Jobby options.`,
    );
  }
}

async function callAnthropic(settings: Settings, args: ChatArgs): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      // Required when calling the API from a browser-context origin.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
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

async function callOpenAiCompatible(
  settings: Settings,
  args: ChatArgs,
): Promise<string> {
  const base =
    settings.provider === 'openai'
      ? 'https://api.openai.com/v1'
      : settings.customBaseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (settings.apiKey.trim()) {
    headers['authorization'] = `Bearer ${settings.apiKey}`;
  }
  // Let the backend enforce a per-user daily quota without accounts.
  if (settings.provider === 'custom' && args.clientId) {
    headers['x-client-id'] = args.clientId;
  }
  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: args.temperature,
    max_tokens: args.maxTokens,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
  };
  if (args.jsonMode) body.response_format = { type: 'json_object' };

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
  if (!text) throw new LlmError(`${settings.provider} returned an empty response.`);
  return text;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

/** Single entry point. Routes to the configured provider. */
export async function chatComplete(
  settings: Settings,
  args: ChatArgs,
): Promise<string> {
  requireKey(settings);
  if (settings.provider === 'anthropic') return callAnthropic(settings, args);
  return callOpenAiCompatible(settings, args);
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
