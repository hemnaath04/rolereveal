// Split-pane adapter family: search-results sites where the LEFT column is a list
// of cards and the RIGHT column shows the selected job's full detail (Indeed,
// Glassdoor, ZipRecruiter, jobs.workable.com aggregator, …). Everything is
// extracted from the SAME selected-job pane in one pass — never from a left card.
// The canonical key comes from a per-job signal (data-id / url param / apply
// token / title hash), NOT from a URL that may lag or stay constant across jobs.
import type { JobSiteAdapter } from './types';
import type { JobSummary } from '../../lib/types';
import { revealApply } from './reveal';

const clean = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

const fullText = (el: Element | null): string => {
  if (!el) return '';
  const h = el as HTMLElement;
  const inner = clean(h.innerText);
  const text = clean(h.textContent);
  return text.length > inner.length ? text : inner;
};

const within = (root: ParentNode | null, sels: string[]): HTMLElement | null => {
  if (!root) return null;
  for (const s of sels) {
    const el = root.querySelector(s) as HTMLElement | null;
    if (el) return el;
  }
  return null;
};

/** Largest text block inside the pane — used as the description when a site has
 *  no semantic description selector (e.g. ZipRecruiter's Tailwind markup). */
function largestTextBlock(pane: HTMLElement): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLen = 0;
  for (const e of Array.from(pane.querySelectorAll<HTMLElement>('div,section,article'))) {
    const t = clean(e.textContent);
    if (t.length > bestLen && t.length < 25000) {
      best = e;
      bestLen = t.length;
    }
  }
  return best;
}

/** Stable short hash for a fallback job key (title+company+desc). */
export function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

export interface SplitPaneSpec {
  site: string;
  matches(url: URL): boolean;
  /** The selected-job detail pane (right column). */
  paneSelectors: string[];
  /** Title within the pane. */
  titleSelectors: string[];
  /** Company within the pane (optional). */
  companySelectors?: string[];
  /** Detail description within the pane (optional → largest text block used). */
  descSelectors?: string[];
  /** Apply control within the pane (optional → text match used). */
  applySelectors?: string[];
  /** Canonical key for the SELECTED job, derived from the pane/page. */
  key(pane: HTMLElement): string | null;
}

export function makeSplitPaneAdapter(spec: SplitPaneSpec): JobSiteAdapter {
  // A pane is "complete" when it actually holds the selected job's title AND a
  // substantial description. Some sites render multiple matching containers (e.g.
  // Workable keeps enter/exit transition copies; Glassdoor has nested JobDetails_*
  // wrappers), so we can't just take the first selector hit — pick the first
  // COMPLETE one, falling back to the first match.
  const isComplete = (el: HTMLElement): boolean => {
    const hasTitle = !!(within(el, spec.titleSelectors) || el.querySelector('h1,h2'));
    const hasDesc = !!(
      (spec.descSelectors && within(el, spec.descSelectors)) ||
      clean(el.textContent).length >= 200
    );
    return hasTitle && hasDesc;
  };
  const pane = (): HTMLElement | null => {
    let first: HTMLElement | null = null;
    for (const s of spec.paneSelectors) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
        if (!first) first = el;
        if (isComplete(el)) return el;
      }
    }
    return first;
  };
  const titleEl = (p: HTMLElement) =>
    within(p, spec.titleSelectors) || p.querySelector<HTMLElement>('h1') || p.querySelector<HTMLElement>('h2');
  const descEl = (p: HTMLElement) =>
    (spec.descSelectors ? within(p, spec.descSelectors) : null) || largestTextBlock(p);
  const applyEl = (p: HTMLElement): HTMLElement | null => {
    const s = spec.applySelectors ? within(p, spec.applySelectors) : null;
    if (s) return s;
    for (const el of Array.from(p.querySelectorAll<HTMLElement>('a,button,[role="button"]'))) {
      const t = clean(el.textContent).toLowerCase();
      if (t && t.length < 32 && /\bapply\b/.test(t) && !t.includes('filter')) return el;
    }
    return null;
  };
  const descText = (p: HTMLElement): string => {
    const t = fullText(descEl(p));
    return t.length >= 200 ? t : fullText(p);
  };

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
        if (!spec.matches(new URL(location.href))) return false;
        const p = pane();
        return !!p && !!titleEl(p) && descText(p).length >= 200;
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
      const p = pane();
      if (!p || !titleEl(p) || descText(p).length < 200) return null;
      return p;
    },
    findDetailsInsertionPoint(panel) {
      const p = (panel as HTMLElement) || pane();
      if (!p) return null;
      // Mount directly above the description (in normal flow), i.e. below the
      // header + native Apply controls. Description is always in flow, so this
      // pushes it down and never overlaps.
      const d = descEl(p);
      if (d && d.parentElement) return d;
      const a = applyEl(p);
      if (a && a.nextElementSibling && (a.nextElementSibling as HTMLElement).parentElement) {
        return a.nextElementSibling as HTMLElement;
      }
      return (p.firstElementChild as HTMLElement) || null;
    },
    findDetailsJobId() {
      const p = pane();
      return p ? spec.key(p) : null;
    },
    extractDetailsSummary(): JobSummary | null {
      const p = pane();
      if (!p) return null;
      const id = spec.key(p);
      const title = clean(titleEl(p)?.textContent);
      if (!id || !title) return null;
      const company = clean(
        (spec.companySelectors ? within(p, spec.companySelectors) : null)?.textContent,
      );
      return { id, title, company, url: location.href };
    },
    extractFullJobDescription() {
      const p = pane();
      if (!p) return null;
      const t = descText(p);
      return t.length >= 80 ? t : null;
    },
    clickApply() {
      const p = pane();
      revealApply((p && applyEl(p)) || null);
    },
  };
  return adapter;
}
