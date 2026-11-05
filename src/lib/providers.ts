// ---------------------------------------------------------------------------
// Provider registry. One place that knows each provider's wire format, base URL,
// and a sensible default model. The options UI shows only what a provider needs:
// for hosted providers we supply the base URL ourselves and just ask for the key;
// only Custom / Ollama ask the user for a base URL.
// ---------------------------------------------------------------------------
import { DEFAULT_BACKEND } from './config';

export type WireApi = 'openai' | 'anthropic';

export interface ProviderPreset {
  id: string;
  label: string;
  api: WireApi;
  /** Fixed base URL. null => the user must supply one (uses settings.customBaseUrl). */
  baseUrl: string | null;
  needsKey: boolean;
  needsBaseUrl: boolean;
  defaultModel: string;
  /** Suggested models for the datalist (free text is still allowed). */
  models?: string[];
  keyHint?: string;
  /** Where to get a key (help link). */
  keyUrl?: string;
  /** Prefill for the base-URL field when needsBaseUrl is true. */
  defaultBaseUrl?: string;
  /** Hidden from the "bring your own" dropdown (the built-in default). */
  hidden?: boolean;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'builtin',
    label: 'Built-in (RoleReveal)',
    api: 'openai',
    baseUrl: DEFAULT_BACKEND.customBaseUrl,
    needsKey: false,
    needsBaseUrl: false,
    defaultModel: DEFAULT_BACKEND.model || 'auto',
    hidden: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'gpt-6.1-terra',
    models: ['gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'claude-haiku-4-5',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8'],
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    api: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'groq',
    label: 'Groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'],
    keyHint: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'grok-2-latest',
    models: ['grok-2-latest', 'grok-beta'],
    keyHint: 'xai-…',
    keyUrl: 'https://console.x.ai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    api: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'together',
    label: 'Together AI',
    api: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyUrl: 'https://api.together.ai/settings/api-keys',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    api: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    keyUrl: 'https://fireworks.ai/account/api-keys',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    api: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    needsKey: true,
    needsBaseUrl: false,
    defaultModel: 'sonar',
    models: ['sonar', 'sonar-pro'],
    keyUrl: 'https://www.perplexity.ai/settings/api',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    api: 'openai',
    baseUrl: null,
    needsKey: false,
    needsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    api: 'openai',
    baseUrl: null,
    needsKey: false,
    needsBaseUrl: true,
    defaultModel: '',
  },
];

const PROVIDER_MAP: Record<string, ProviderPreset> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
);

export function getProvider(id: string): ProviderPreset {
  return PROVIDER_MAP[id] || PROVIDER_MAP.builtin;
}

/** Providers shown in the "use my own provider" dropdown. */
export function selectableProviders(): ProviderPreset[] {
  return PROVIDERS.filter((p) => !p.hidden);
}

export function resolveBaseUrl(s: { provider: string; customBaseUrl: string }): string {
  const p = getProvider(s.provider);
  const base = p.baseUrl ?? s.customBaseUrl ?? '';
  return base.replace(/\/+$/, '');
}

export function resolveModel(s: { provider: string; model: string }): string {
  const p = getProvider(s.provider);
  return (s.model && s.model.trim()) || p.defaultModel;
}
