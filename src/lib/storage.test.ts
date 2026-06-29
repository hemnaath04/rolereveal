import { describe, it, expect, beforeEach } from 'vitest';
import { ensureDefaultResume, getDefaultResumeId } from './storage';
import type { Resume } from './types';

// in-memory chrome.storage.local for these tests
let mem: Record<string, unknown> = {};
beforeEach(() => {
  mem = {};
  const local = (globalThis as unknown as { chrome: { storage: { local: Record<string, unknown> } } })
    .chrome.storage.local as { get: unknown; set: unknown };
  local.get = (k: string | Record<string, unknown> | undefined) =>
    Promise.resolve(
      typeof k === 'string'
        ? { [k]: mem[k] }
        : k
          ? Object.fromEntries(Object.keys(k).map((x) => [x, mem[x] ?? (k as Record<string, unknown>)[x]]))
          : { ...mem },
    );
  local.set = (o: Record<string, unknown>) => {
    Object.assign(mem, o);
    return Promise.resolve();
  };
});

const mk = (id: string, enabled = true, text = 'resume text long enough'): Resume => ({
  id,
  label: id,
  text,
  favorite: false,
  enabled,
  source: 'paste',
  createdAt: 1,
  updatedAt: 1,
});

describe('ensureDefaultResume', () => {
  it('auto-selects the single enabled résumé when no default is set', async () => {
    mem.resumes = [mk('a')];
    const r = await ensureDefaultResume();
    expect(r?.id).toBe('a');
    expect(await getDefaultResumeId()).toBe('a');
  });

  it('repairs a stale default id (points at a missing résumé)', async () => {
    mem.resumes = [mk('a')];
    mem.settings = { defaultResumeId: 'ghost' };
    const r = await ensureDefaultResume();
    expect(r?.id).toBe('a');
    expect(await getDefaultResumeId()).toBe('a');
  });

  it('keeps a valid current default', async () => {
    mem.resumes = [mk('a'), mk('b')];
    mem.settings = { defaultResumeId: 'b' };
    const r = await ensureDefaultResume();
    expect(r?.id).toBe('b');
  });

  it('returns null and clears stale default when 0 enabled résumés', async () => {
    mem.resumes = [mk('a', false)];
    mem.settings = { defaultResumeId: 'a' };
    const r = await ensureDefaultResume();
    expect(r).toBeNull();
    expect(await getDefaultResumeId()).toBeNull();
  });

  it('returns null (chooser) when multiple enabled and none chosen', async () => {
    mem.resumes = [mk('a'), mk('b')];
    const r = await ensureDefaultResume();
    expect(r).toBeNull();
    expect(await getDefaultResumeId()).toBeNull();
  });
});
