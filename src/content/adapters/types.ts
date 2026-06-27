import type { JobSummary } from '../../lib/types';

/**
 * Per-site DOM contract. No selectors live in shared code — every platform
 * implements this against its own markup.
 */
export interface JobSiteAdapter {
  readonly site: string;

  /** True when the current URL/page is a jobs page this adapter handles. */
  isSupportedPage(): boolean;

  /** The element to scope the MutationObserver to (the results list). */
  getResultsContainer(): HTMLElement | null;

  /** All currently-rendered job cards in the list. */
  getJobCards(): HTMLElement[];

  /** Stable id for a card (survives virtualized re-use). */
  getJobId(card: HTMLElement): string | null;

  extractJobSummary(card: HTMLElement): JobSummary | null;

  /** Element to append our card UI into (we append at the bottom). */
  findCardInsertionPoint(card: HTMLElement): HTMLElement | null;

  /** The selected-job details panel container, if open. */
  findDetailsPanel(): HTMLElement | null;

  /** Element to insert the details UI *before* (lands under apply/top-card). */
  findDetailsInsertionPoint(detailsPanel: HTMLElement): HTMLElement | null;

  /** Stable id of the currently-selected job. */
  findDetailsJobId(): string | null;

  extractDetailsSummary(): JobSummary | null;

  extractFullJobDescription(): string | null;

  /** Trigger the site's native Apply button (Quick Apply). */
  clickApply?(): void;
}
