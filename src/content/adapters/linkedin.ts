import type { JobSiteAdapter } from './types';
import type { JobSummary } from '../../lib/types';

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

  // The new beta UI is a virtualized lazy-column with hashed classes and cards
  // whose anchors carry no stable text — per-card strips aren't reliably/ safely
  // injectable there, so we only inject cards on the classic UI.
  getJobCards() {
    const cards = document.querySelectorAll<HTMLElement>(
      'li.scaffold-layout__list-item, li.jobs-search-results__list-item, div.job-card-container',
    );
    return Array.from(cards).filter((c) => this.getJobId(c));
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

  findDetailsInsertionPoint() {
    // Prefer to sit right under the apply/top-card. Find the native Apply link,
    // climb to the tall top-card block, and insert after it. Hashed classes make
    // structural climbing the only stable option on the beta UI.
    const apply = (() => {
      for (const a of Array.from(document.querySelectorAll<HTMLElement>('a'))) {
        if (clean(a.textContent).toLowerCase() === 'apply') return a;
      }
      return null;
    })();
    if (apply) {
      let block: HTMLElement = apply;
      for (let i = 0; i < 10 && block.parentElement; i++) {
        if (block.parentElement.getBoundingClientRect().height >= 150) {
          block = block.parentElement;
          break;
        }
        block = block.parentElement;
      }
      return (block.nextElementSibling as HTMLElement) || block;
    }
    // Fallbacks (classic UI / apply not found).
    return (
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
    (byText(/^apply\b/) || byText(/quick apply/))?.click();
  },
};
