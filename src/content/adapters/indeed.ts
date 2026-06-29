import type { JobSiteAdapter } from './types';
import { revealApply } from './reveal';
import { insertionBelowApply } from './insert';

const clean = (s: string | null | undefined): string =>
  (s || '').replace(/\s+/g, ' ').trim();

/** textContent (not innerText) so CSS-clamped descriptions are still captured. */
const fullText = (el: Element | null): string => {
  if (!el) return '';
  const h = el as HTMLElement;
  const inner = clean(h.innerText);
  const text = clean(h.textContent);
  return text.length > inner.length ? text : inner;
};

// All extraction is scoped to the SELECTED right-side detail pane — never the
// left search-result cards. The detail pane fills the page on /viewjob, or is the
// right column on a split search page.
const PANE_SELECTORS = [
  '.jobsearch-RightPane',
  '[data-testid="jobsearch-ViewjobPaneWrapper"]',
  '#jobsearch-ViewjobPaneWrapper',
  '.jobsearch-JobComponent',
  '#vjs-container',
];
// Title/company/desc selectors, queried ONLY inside the detail pane. (No
// 'simpler-jobTitle' here — that's a left search-card title.)
const TITLE_SELECTORS = [
  '[data-testid="jobsearch-JobInfoHeader-title"]',
  'h2.jobsearch-JobInfoHeader-title',
  'h1.jobsearch-JobInfoHeader-title',
];
const COMPANY_SELECTORS = [
  '[data-testid="inlineHeader-companyName"]',
  '[data-testid="jobsearch-JobInfoHeader-companyName"]',
  '[data-company-name="true"]',
  '.jobsearch-JobInfoHeader-companyNameLink',
  '.jobsearch-CompanyInfoContainer a',
];
const LOCATION_SELECTORS = [
  '[data-testid="inlineHeader-companyLocation"]',
  '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
  '[data-testid="job-location"]',
];
const DESC_SELECTORS = ['#jobDescriptionText', '[data-testid="jobsearch-JobComponent-description"]'];

/** The currently-selected job's detail pane, or null on a bare search list. */
function detailPane(): HTMLElement | null {
  for (const s of PANE_SELECTORS) {
    const el = document.querySelector(s) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

/** First matching element WITHIN a root (pane-scoped). */
function within(root: ParentNode | null, sels: string[]): HTMLElement | null {
  if (!root) return null;
  for (const s of sels) {
    const el = root.querySelector(s) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

function paneTitle(pane: HTMLElement | null): string {
  // SERP split-view appends " - job post" to the title node; strip it.
  return clean(within(pane, TITLE_SELECTORS)?.textContent).replace(/\s*-\s*job post\s*$/i, '');
}

/**
 * Canonical selected-job key. Strongest signal first: URL vjk/jk (Indeed sets
 * these to the SELECTED job), then the apply link's jk, then a hash of the
 * right-pane title so the panel still re-keys between selections.
 */
function jobKey(pane: HTMLElement | null): string | null {
  const p = new URLSearchParams(location.search);
  const k = p.get('vjk') || p.get('jk');
  if (k) return k;
  const applyHref =
    pane?.querySelector<HTMLAnchorElement>('a[href*="jk="]')?.getAttribute('href') || '';
  const m = applyHref.match(/[?&]jk=([^&]+)/);
  if (m) return m[1];
  const t = paneTitle(pane);
  return t ? `t:${t}` : null;
}

export const indeedAdapter: JobSiteAdapter = {
  site: 'indeed',
  dedicated: true,

  matches(url: URL) {
    return /(^|\.)indeed\.[a-z.]+$/.test(url.hostname);
  },

  isSupportedPage() {
    if (!/(^|\.)indeed\.[a-z.]+$/.test(location.hostname)) return false;
    // Require a selected detail pane with a real title + description. A bare
    // search list (nothing selected) has no pane → no panel.
    const pane = detailPane();
    return !!within(pane, TITLE_SELECTORS) && !!within(pane, DESC_SELECTORS);
  },

  getResultsContainer() {
    return (document.querySelector('main') as HTMLElement) || document.body;
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
    const pane = detailPane();
    if (!pane || !within(pane, TITLE_SELECTORS) || !within(pane, DESC_SELECTORS)) return null;
    return pane;
  },

  findDetailsInsertionPoint(panel) {
    const pane = (panel as HTMLElement) || detailPane();
    if (!pane) return null;
    // Required order: title → company/location → apply → RoleReveal → body.
    // Insert just above the body block (Job details / description), i.e. right
    // after the header + native apply controls, in normal flow.
    const body =
      (pane.querySelector('.jobsearch-embeddedBody') as HTMLElement | null) ||
      (pane.querySelector('.jobsearch-BodyContainer') as HTMLElement | null);
    if (body && body.parentElement) return body;
    // Fallback: directly above the description wrapper.
    const desc = within(pane, DESC_SELECTORS);
    const descBlock =
      (desc?.closest('[data-testid="jobsearch-JobComponent-description"]') as HTMLElement) || desc;
    if (descBlock && descBlock.parentElement) return descBlock;
    // Last resort: below the apply control.
    return insertionBelowApply(pane);
  },

  findDetailsJobId() {
    return jobKey(detailPane());
  },

  extractDetailsSummary() {
    const pane = detailPane();
    const id = jobKey(pane);
    const title = paneTitle(pane);
    if (!id || !title) return null;
    const company = clean(within(pane, COMPANY_SELECTORS)?.textContent);
    const loc = clean(within(pane, LOCATION_SELECTORS)?.textContent) || undefined;
    return { id, title, company, location: loc, url: window.location.href };
  },

  extractFullJobDescription() {
    const pane = detailPane();
    const t = fullText(within(pane, DESC_SELECTORS));
    return t.length >= 80 ? t : null;
  },

  clickApply() {
    const pane = detailPane() || document;
    for (const el of Array.from(pane.querySelectorAll<HTMLElement>('a, button'))) {
      const t = clean(el.textContent).toLowerCase();
      if (t && t.length < 28 && /\bapply\b/.test(t) && !t.includes('filter')) {
        revealApply(el);
        return;
      }
    }
  },
};
