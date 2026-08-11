// The popup and the in-page panel are separate contexts, so both can ask for the
// same job at once. Two identical upstream calls in the same second is what trips
// the gateway's per-minute quota on its primary model, and when the Anthropic
// fallback is misconfigured the rate-limited one has nowhere to land. The
// background worker is the only place that sees every caller, so the dedupe lives
// there — these tests pin that behaviour.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, type Resume } from '../lib/types';

const chatComplete = vi.fn();
const readCache = vi.fn();
const writeCache = vi.fn();

vi.mock('../lib/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/llm')>();
  return { ...actual, chatComplete };
});

vi.mock('../lib/storage', () => ({
  ensureDefaultResume: () => Promise.resolve(null),
  getClientId: () => Promise.resolve('test-client'),
  getEnabledResumes: () => Promise.resolve(resumes),
  getResumes: () => Promise.resolve(resumes),
  getSettings: () => Promise.resolve(DEFAULT_SETTINGS),
  readCache,
  writeCache,
}));

const resumes: Resume[] = [
  {
    id: 'r1',
    label: 'Backend',
    text: 'resume text long enough to pass validation',
    favorite: false,
    enabled: true,
    source: 'paste',
    createdAt: 1,
    updatedAt: 1,
  },
];

// A distinct JD per test, so the cache key differs and a still-pending entry from
// one case can never be shared into the next.
const jobFor = (jd: string) =>
  ({ title: 'Engineer', company: 'Acme', url: 'https://example.com/j/1', jdText: jd.padEnd(200, 'x') }) as never;

const modelJson = JSON.stringify({
  perResume: [{ label: 'Resume 1', score: 72 }],
  bestResume: 'Resume 1',
  overallScore: 72,
  verdict: 'Maybe',
  summary: 'Decent overlap.',
  dimensions: { skills: 70, experience: 74, roleContext: 71 },
  whyMatch: 'Backend overlap.',
  watchOuts: 'Needs Kafka.',
});

// The worker registers install/context-menu listeners at import time, which the
// shared jsdom chrome stub doesn't cover. Extend it here rather than in setup.ts,
// so no other suite depends on these.
const chromeStub = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome;
Object.assign(chromeStub.runtime as object, { onInstalled: { addListener: () => {} } });
chromeStub.contextMenus = { create: () => {}, onClicked: { addListener: () => {} } };

// Imported after the mocks and stubs are registered.
const { handleEvaluate } = await import('./index');

beforeEach(() => {
  vi.clearAllMocks();
  readCache.mockResolvedValue(undefined);
  writeCache.mockResolvedValue(undefined);
});

describe('handleEvaluate in-flight coalescing', () => {
  it('makes one LLM call when two callers race on the same job', async () => {
    const job = jobFor('race');
    let release: (v: string) => void = () => {};
    chatComplete.mockImplementation(
      () => new Promise<string>((resolve) => { release = resolve; }),
    );

    const a = handleEvaluate({ type: 'EVALUATE', job, force: false });
    const b = handleEvaluate({ type: 'EVALUATE', job, force: true });
    // Both callers must reach the coalescing point before the single call
    // resolves, otherwise this passes for the wrong reason.
    await vi.waitFor(() => expect(chatComplete).toHaveBeenCalledTimes(1));
    release(modelJson);

    const [ra, rb] = await Promise.all([a, b]);
    expect(chatComplete).toHaveBeenCalledTimes(1);
    expect(ra.ok && rb.ok).toBe(true);
    expect(ra).toEqual(rb);
  });

  it('runs again once the first call has settled', async () => {
    const job = jobFor('sequential');
    chatComplete.mockResolvedValue(modelJson);

    await handleEvaluate({ type: 'EVALUATE', job, force: true });
    await handleEvaluate({ type: 'EVALUATE', job, force: true });

    expect(chatComplete).toHaveBeenCalledTimes(2);
  });

  it('shares a failure instead of firing a second call after it', async () => {
    const job = jobFor('failure');
    chatComplete.mockRejectedValue(new Error('429 rate limited'));

    const [a, b] = await Promise.all([
      handleEvaluate({ type: 'EVALUATE', job, force: false }),
      handleEvaluate({ type: 'EVALUATE', job, force: false }),
    ]);

    expect(chatComplete).toHaveBeenCalledTimes(1);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });
});
