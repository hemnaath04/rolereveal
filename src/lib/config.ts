import type { Provider } from './types';

/**
 * Default backend shipped with the public build so a new user can score jobs
 * immediately with no setup. Anything the user enters in Options overrides this.
 *
 * This points at the AI Jobby backend proxy (see ../../../ai-jobby-backend),
 * which holds the real LLM key SERVER-SIDE. The extension therefore ships with
 * NO provider key — only the public proxy URL (and optionally a revocable app
 * token). Never put a raw Anthropic/OpenAI key here.
 */
export const DEFAULT_BACKEND: {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  model: string;
} = {
  provider: 'custom',
  // The proxy's base URL. Note the trailing `/api` — the client POSTs to
  // `${customBaseUrl}/chat/completions`, i.e. /api/chat/completions.
  customBaseUrl: 'https://ai-jobby-backend.vercel.app/api',
  // Leave '' unless you set APP_TOKEN on the proxy; then put that token here
  // (it's public + revocable — NOT a provider key).
  apiKey: '',
  model: 'gemini-3.5-flash',
};
