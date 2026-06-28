// Shared helpers for the detail-only ATS adapters (Greenhouse, Lever, Ashby,
// Workday, SmartRecruiters, iCIMS, Workable, Glassdoor). These boards render a
// single job per page (no in-page results list), so the adapters only inject the
// details panel.
import type { JobSiteAdapter } from './types';
import type { JobSummary } from '../../lib/types';
import { revealApply } from './reveal';
import { insertionBelowApply } from './insert';
import { readJsonLdJob } from '../../lib/jd-extract';

/** JobPosting JSON-LD on the page (title/company/description), if present. Used
 *  as a fallback when a board's own selectors are missing or slow to render
 *  (e.g. Workday's data-automation-id nodes appear only after async load). */
function ldJob(): { title: string; company: string; description: string } {
  const j = readJsonLdJob();
  return {
    title: (j?.title || '').replace(/\s+/g, ' ').trim(),
    company: (j?.company || '').replace(/\s+/g, ' ').trim(),
    description: (j?.description || '').replace(/\s+/g, ' ').trim(),
  };
}

export const clean = (s: string | null | undefined): string =>
  (s || '').replace(/\s+/g, ' ').trim();

/** textContent vs innerText, whichever is longer (captures clamped JD text). */
export const fullText = (el: Element | null): string => {
  if (!el) return '';
  const h = el as HTMLElement;
  const inner = clean(h.innerText);
  const text = clean(h.textContent);
  return text.length > inner.length ? text : inner;
};

export const firstEl = (sels: string[]): HTMLElement | null => {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) return el as HTMLElement;
  }
  return null;
};

export const firstText = (sels: string[]): string => clean(firstEl(sels)?.textContent);

/** company from og:site_name / og:title / document title, in that order. */
export function ogCompany(): string {
  const site = document
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute('content');
  if (site) return clean(site).slice(0, 80);
  const title = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  if (title) {
    const parts = clean(title).split(/\s+[-–|]\s+/);
    if (parts.length > 1) return parts[parts.length - 1].slice(0, 80);
  }
  return '';
}

/** Reveal the first visible Apply control by text. */
export function clickApplyByText(rx = /\bapply\b/): void {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('a, button'))) {
    const t = clean(el.textContent).toLowerCase();
    if (t && t.length < 28 && rx.test(t) && !t.includes('filter')) {
      revealApply(el);
      return;
    }
  }
}

/**
 * Factory for a detail-only ATS adapter. Each board supplies its host/path match,
 * the title/company/description selectors, and a canonical key extractor.
 */
export interface AtsSpec {
  site: string;
  matches(url: URL): boolean;
  titleSelectors: string[];
  companySelectors?: string[];
  descSelectors: string[];
  /** Canonical, stable job id for this page (param/path). */
  key(url: URL): string | null;
  /** Optional company fallback when selectors miss (e.g. og:site_name). */
  companyFallback?(): string;
}

export function makeAtsAdapter(spec: AtsSpec): JobSiteAdapter {
  const url = () => new URL(location.href);

  const adapter: JobSiteAdapter = {
    site: spec.site,
    dedicated: true,

    matches(u: URL) {
      try {
        return spec.matches(u);
      } catch {
        return false;
      }
    },

    isSupportedPage() {
      try {
        return spec.matches(url());
      } catch {
        return false;
      }
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
      // Inject when the board's own description is present OR a JobPosting
      // JSON-LD exists (covers SPA boards like Workday whose DOM lags).
      if (!firstEl(spec.descSelectors) && !ldJob().description) return null;
      return (document.querySelector('main') as HTMLElement) || document.body;
    },

    findDetailsInsertionPoint(panel) {
      // Prefer landing directly above the description (inside the posting pane),
      // falling back to below-apply / top-of-main.
      const desc = firstEl(spec.descSelectors);
      if (desc && desc.parentElement) return desc;
      return insertionBelowApply(panel);
    },

    findDetailsJobId() {
      try {
        return spec.key(url());
      } catch {
        return null;
      }
    },

    extractDetailsSummary(): JobSummary | null {
      const id = adapter.findDetailsJobId();
      const ld = ldJob();
      const title = firstText(spec.titleSelectors) || ld.title;
      if (!id || !title) return null;
      const company =
        (spec.companySelectors ? firstText(spec.companySelectors) : '') ||
        (spec.companyFallback ? spec.companyFallback() : '') ||
        ld.company ||
        ogCompany();
      return { id, title, company, url: location.href };
    },

    extractFullJobDescription() {
      const sel = fullText(firstEl(spec.descSelectors));
      const ld = ldJob().description;
      // Prefer whichever source gives the fuller description (Workday's DOM may
      // be empty while its JSON-LD is complete; SmartRecruiters' selector may
      // capture only a short intro).
      const best = ld.length > sel.length ? ld : sel;
      return best.length >= 80 ? best : null;
    },

    clickApply() {
      clickApplyByText();
    },
  };

  return adapter;
}
