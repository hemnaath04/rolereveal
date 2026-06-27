import type { JobSiteAdapter } from './types';

const clean = (s: string | null | undefined): string =>
  (s || '').replace(/\s+/g, ' ').trim();

const fullText = (el: Element | null): string => {
  if (!el) return '';
  const h = el as HTMLElement;
  const inner = clean(h.innerText);
  const text = clean(h.textContent);
  return text.length > inner.length ? text : inner;
};

function h3ByText(text: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('h2,h3,h4'))) {
    if (clean(el.textContent) === text) return el;
  }
  return null;
}

const SECTION_LABELS = new Set([
  'Search',
  'Job Description',
  'Additional Job Details',
  'Application Process',
  'About this employer',
  'About the Position',
]);

// NUworks (and other Symplicity CSM career portals). Single job-detail page —
// no list, so only the details panel is injected.
export const symplicityAdapter: JobSiteAdapter = {
  site: 'NUworks',

  isSupportedPage() {
    return (
      location.hostname.endsWith('symplicity.com') &&
      location.pathname.includes('/jobs/detail')
    );
  },

  getResultsContainer() {
    return (document.querySelector('#content-view') as HTMLElement) || document.body;
  },

  getJobCards() {
    return [];
  },
  getJobId() {
    return null;
  },
  extractJobSummary() {
    return null;
  },
  findCardInsertionPoint() {
    return null;
  },

  findDetailsPanel() {
    if (!h3ByText('Job Description')) return null;
    return (
      (document.querySelector('.form-layout') as HTMLElement) ||
      (document.querySelector('#content-view') as HTMLElement) ||
      document.body
    );
  },

  findDetailsInsertionPoint() {
    // Insert as a full-width banner above the description/employer columns,
    // i.e. directly below the header (title + Apply).
    return (
      (document.querySelector('.form-container') as HTMLElement) ||
      (h3ByText('Job Description')?.closest('.margin-lg') as HTMLElement) ||
      (document.querySelector('.form-col') as HTMLElement)
    );
  },

  findDetailsJobId() {
    const m = location.pathname.match(/detail\/([a-z0-9]+)/i);
    return m ? m[1] : null;
  },

  extractDetailsSummary() {
    const id = this.findDetailsJobId();
    const title =
      Array.from(document.querySelectorAll<HTMLElement>('h1'))
        .map((h) => clean(h.textContent))
        .find((t) => t && t !== 'Search' && t.length > 2) || '';
    if (!id || !title) return null;
    const company =
      Array.from(document.querySelectorAll<HTMLElement>('h2,h3,h4'))
        .map((h) => clean(h.textContent))
        .find((t) => t && !SECTION_LABELS.has(t) && t.length < 60) || '';
    return { id, title, company, url: location.href };
  },

  extractFullJobDescription() {
    const jd = h3ByText('Job Description')?.parentElement ?? null;
    let t = fullText(jd);
    if (t.length >= 80) return t;
    t = fullText(document.querySelector('.form-col'));
    return t.length >= 80 ? t : null;
  },

  clickApply() {
    for (const b of Array.from(document.querySelectorAll<HTMLElement>('button, a'))) {
      if (clean(b.textContent).toLowerCase() === 'apply') {
        b.click();
        return;
      }
    }
  },
};
