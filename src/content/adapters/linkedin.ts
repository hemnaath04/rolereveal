import type { JobSiteAdapter } from './types';
import type { JobSummary } from '../../lib/types';
import { revealApply } from './reveal';
import { insertionBelowApply } from './insert';

const clean = (s: string | null | undefined): string =>
  (s || '').replace(/\s+/g, ' ').trim();

/** textContent (not innerText) so CSS-clamped "see more" description is included. */
const fullText = (el: Element | null): string => {
  if (!el) return '';
  const h = el as HTMLElement;
  const inner = clean(h.innerText);
  const text = clean(h.textContent);
  return text.length > inner.length ? text : inner;
};

const first = (root: ParentNode, sels: string[]): HTMLElement | null => {
  for (const s of sels) {
    const el = root.querySelector(s);
    if (el) return el as HTMLElement;
  }
  return null;
};

/** Find a heading/element whose exact trimmed text matches (stable across
 *  LinkedIn's hashed-class redesigns). */
function byExactText(tags: string, text: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(tags))) {
    if (clean(el.textContent) === text) return el;
  }
  return null;
}

function jobIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const m = href.match(/\/jobs\/view\/(\d+)/) || href.match(/currentJobId=(\d+)/);
  return m ? m[1] : null;
}

export const linkedInAdapter: JobSiteAdapter = {
  site: 'linkedin',
  dedicated: true,

  matches(url: URL) {
    return url.hostname.endsWith('linkedin.com') && url.pathname.includes('/jobs');
  },

  isSupportedPage() {
    return (
      location.hostname.endsWith('linkedin.com') &&
      location.pathname.includes('/jobs')
    );
  },

  getResultsContainer() {
    // New UI swaps the right-pane DOM without always touching the list, so watch
    // a container that covers both the list and the details pane.
    return (document.querySelector('main') as HTMLElement) || document.body;
  },

  // Per-card list badges are dropped, matching every other adapter (Indeed,
  // Glassdoor, ZipRecruiter, Workable, Greenhouse, Lever, Ashby, Workday,
  // SmartRecruiters, iCIMS, generic all return no cards here too): the quick
  // local estimate they show is a rough resume-title keyword-overlap heuristic
  // with no LLM behind it, not the real score, and reads as inaccurate/noisy
  // in a dense list. The details panel (the real, LLM-backed score) is
  // unaffected.
  getJobCards() {
    return [];
  },

  getJobId(card) {
    return (
      card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
      card.getAttribute('data-occludable-job-id') ||
      jobIdFromHref(card.querySelector('a')?.getAttribute('href') ?? null)
    );
  },

  extractJobSummary(card) {
    const id = this.getJobId(card);
    if (!id) return null;
    const title = clean(
      first(card, [
        '.job-card-list__title',
        '.artdeco-entity-lockup__title',
      ])?.innerText || card.querySelector('a')?.textContent,
    );
    if (!title) return null;
    const company = clean(
      first(card, [
        '.job-card-container__primary-description',
        '.artdeco-entity-lockup__subtitle',
      ])?.innerText,
    );
    const location = clean(
      first(card, ['.job-card-container__metadata-item', '.artdeco-entity-lockup__caption'])
        ?.innerText,
    );
    const url = (card.querySelector('a') as HTMLAnchorElement | null)?.href;
    return { id, title, company, location, url };
  },

  findCardInsertionPoint(card) {
    return (card.querySelector('.job-card-container') as HTMLElement) || card;
  },

  findDetailsPanel() {
    // Anchor on the JD box / "About the job" heading (both stable across both UIs)
    // and use the page main as the panel scope.
    const jd =
      document.querySelector('[data-testid="expandable-text-box"]') ||
      first(document, ['#job-details', '.jobs-description__content', '.jobs-description']) ||
      byExactText('h2', 'About the job');
    if (!jd) return null;
    return (document.querySelector('main') as HTMLElement) || document.body;
  },

  findDetailsInsertionPoint(panel) {
    // Land directly under the Apply / top-card (handles "Easy Apply" too via the
    // shared matcher). Always returns a usable anchor, so the panel never
    // silently fails to inject on a job we detected.
    return (
      insertionBelowApply(panel) ||
      byExactText('h2', 'About the job') ||
      (document.querySelector('[data-testid="expandable-text-box"]') as HTMLElement) ||
      first(document, ['#job-details', '.jobs-description__content', '.jobs-description'])
    );
  },

  findDetailsJobId() {
    return jobIdFromHref(location.href);
  },

  extractDetailsSummary() {
    const id = this.findDetailsJobId();
    // New UI: parse the document title "Title | Company | LinkedIn".
    const parts = document.title.split('|').map((s) => s.trim());
    const title =
      clean(
        first(document, [
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title',
        ])?.innerText,
      ) ||
      (parts[0] && parts[0] !== 'LinkedIn' ? parts[0] : '');
    const company =
      clean(
        first(document, ['.job-details-jobs-unified-top-card__company-name'])?.innerText,
      ) || (parts.length >= 3 ? parts[1] : '');
    if (!id || !title) return null;
    return { id, title, company, url: location.href };
  },

  extractFullJobDescription() {
    const el =
      document.querySelector('[data-testid="expandable-text-box"]') ||
      first(document, [
        '#job-details',
        '.jobs-description__content',
        '.jobs-box__html-content',
        '.jobs-description',
      ]);
    const t = fullText(el);
    return t.length >= 80 ? t : null;
  },

  clickApply() {
    const byText = (rx: RegExp): HTMLElement | null => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('a, button'))) {
        const t = clean(el.textContent).toLowerCase();
        if (t && t.length < 22 && rx.test(t)) return el;
      }
      return null;
    };
    // Passive: reveal LinkedIn's own Apply button; the user clicks it.
    revealApply(byText(/^apply\b/) || byText(/quick apply/));
  },
};
