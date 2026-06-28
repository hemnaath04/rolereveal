import { describe, it, expect, beforeEach } from 'vitest';
import { detectSignals, validatePage } from './validate';
import type { ExtractedJob, JobSiteAdapter } from './adapters/types';

// A long-enough description to clear minimumDescriptionLength (200).
const LONG_DESC =
  'We are hiring a senior software engineer. ' +
  'You will build distributed systems, write tests, and ship features. '.repeat(6);

function makeAdapter(over: Partial<JobSiteAdapter> = {}): JobSiteAdapter {
  return {
    site: 'test',
    dedicated: true,
    isSupportedPage: () => true,
    matches: () => true,
    getResultsContainer: () => null,
    getJobCards: () => [],
    getJobId: () => null,
    extractJobSummary: () => null,
    findCardInsertionPoint: () => null,
    findDetailsPanel: () => document.body,
    findDetailsInsertionPoint: () => document.body,
    findDetailsJobId: () => 'job-123',
    extractDetailsSummary: () => ({
      id: 'job-123',
      title: 'Software Engineer',
      company: 'Acme',
      url: location.href,
    }),
    extractFullJobDescription: () => LONG_DESC,
    ...over,
  };
}

function jsonLd(): void {
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({
    '@type': 'JobPosting',
    title: 'Software Engineer',
    description: LONG_DESC,
    hiringOrganization: { name: 'Acme' },
  });
  document.head.appendChild(s);
}

const goodJob = (): ExtractedJob => ({
  key: 'job-123',
  title: 'Software Engineer',
  company: 'Acme',
  description: LONG_DESC,
  url: location.href,
});

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('detectSignals', () => {
  it('detects job-posting-json-ld when present', () => {
    jsonLd();
    const signals = detectSignals(makeAdapter(), goodJob());
    expect(signals).toContain('job-posting-json-ld');
  });

  it('does not report json-ld when absent', () => {
    const signals = detectSignals(makeAdapter(), goodJob());
    expect(signals).not.toContain('job-posting-json-ld');
  });

  it('reports known-ats-selector for a dedicated adapter with full fields', () => {
    const signals = detectSignals(makeAdapter({ dedicated: true }), goodJob());
    expect(signals).toContain('known-ats-selector');
  });

  it('does not report known-ats-selector for the generic adapter', () => {
    const signals = detectSignals(makeAdapter({ dedicated: false }), goodJob());
    expect(signals).not.toContain('known-ats-selector');
  });
});

describe('validatePage', () => {
  it('accepts a valid job (JSON-LD + key + fields) and returns the canonical key', () => {
    jsonLd();
    const r = validatePage(makeAdapter(), goodJob());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.job.key).toBe('job-123');
  });

  it('rejects when description < 200 (missing-fields)', () => {
    jsonLd();
    const r = validatePage(makeAdapter(), { ...goodJob(), description: 'too short' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing-fields');
  });

  it('rejects when title < 3 (missing-fields)', () => {
    jsonLd();
    const r = validatePage(makeAdapter(), { ...goodJob(), title: 'X' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing-fields');
  });

  it('rejects when company < 2 on the generic adapter (missing-fields)', () => {
    jsonLd();
    // Company is required only for the generic (non-dedicated) adapter.
    const r = validatePage(makeAdapter({ dedicated: false }), { ...goodJob(), company: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing-fields');
  });

  it('allows a dedicated adapter even when company is missing', () => {
    const r = validatePage(makeAdapter({ dedicated: true }), { ...goodJob(), company: '' });
    expect(r.ok).toBe(true);
  });

  it('rejects when no key (missing-fields)', () => {
    jsonLd();
    const r = validatePage(makeAdapter({ dedicated: false }), { ...goodJob(), key: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing-fields');
  });

  it('rejects a search-results DOM (many cards, no detail, no posting)', () => {
    // Generic adapter, no JSON-LD: signal would be known-job-url (adapter matches +
    // key). The search-results heuristic must override and reject.
    for (let i = 0; i < 8; i++) {
      const card = document.createElement('div');
      card.className = 'job-card';
      document.body.appendChild(card);
    }
    const r = validatePage(makeAdapter({ dedicated: false }), goodJob());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('search-results-without-selected-job');
  });
});
