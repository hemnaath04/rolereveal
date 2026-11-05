import { describe, expect, it } from 'vitest';
import { buildOpenAiBody, type ChatArgs } from './llm';

const args: ChatArgs = {
  system: 's',
  user: 'u',
  temperature: 0.2,
  maxTokens: 900,
  jsonMode: true,
};

describe('buildOpenAiBody', () => {
  it('turns reasoning off for GPT-6.1 Terra and keeps temperature', () => {
    const body = buildOpenAiBody('openai', 'gpt-6.1-terra', args);
    expect(body.reasoning_effort).toBe('none');
    expect(body.temperature).toBe(0.2);
    expect(body.max_completion_tokens).toBe(900);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('uses low effort, no temperature and extra headroom where none is unsupported', () => {
    for (const model of ['gpt-6.1-sol', 'gpt-6-astra', 'o4-mini']) {
      const body = buildOpenAiBody('openai', model, args);
      expect(body.reasoning_effort).toBe('low');
      expect(body).not.toHaveProperty('temperature');
      expect(body.max_completion_tokens).toBe(900 + 2048);
      expect(body).not.toHaveProperty('max_tokens');
    }
  });

  it('keeps temperature for non-reasoning OpenAI models', () => {
    const body = buildOpenAiBody('openai', 'gpt-4.1-mini', args);
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body.temperature).toBe(0.2);
    expect(body.max_completion_tokens).toBe(900);
  });

  it('leaves other providers and the built-in proxy on the classic fields', () => {
    for (const id of ['builtin', 'custom', 'openrouter', 'groq']) {
      const body = buildOpenAiBody(id, 'gpt-6.1-terra', args);
      expect(body.max_tokens).toBe(900);
      expect(body.temperature).toBe(0.2);
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body).not.toHaveProperty('max_completion_tokens');
    }
  });
});
