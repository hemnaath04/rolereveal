// jobs.workable.com — Workable's aggregated job-search board (split master-detail).
// This is a DIFFERENT layout from apply.workable.com / company boards (handled by
// workable.ts): the left column lists jobs, the right `.desktopView__container`
// shows the selected job. The detail is a sticky, independently-scrolling pane, so
// we mount in its flow above the description. Per-job key is the URL selectedJobId.
import { makeSplitPaneAdapter, hashKey } from './split-pane';

const clean = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

export const workableJobsAdapter = makeSplitPaneAdapter({
  site: 'Workable',
  matches(url) {
    return url.hostname === 'jobs.workable.com';
  },
  paneSelectors: [
    '[class*="desktopView__container"]',
    '[class*="jobOverview__job-overview"]',
    '[class*="jobsMasterDetailView__container"]',
  ],
  // jobs.workable.com renders NO <h1>; the title is an <h2 data-ui="overview-title">
  // and the company an <h3 data-ui="overview-company"> ("at <Company>").
  titleSelectors: [
    '[data-ui="overview-title"]',
    '[data-ui="overview-job-title"]',
    '[data-ui="job-title"]',
    '[class*="jobOverview"] h2',
  ],
  companySelectors: [
    '[data-ui="overview-company"]',
    '[data-ui="overview-company-name"]',
    '[data-ui="company-name"]',
    '[class*="jobOverview"] a[href*="/company"]',
  ],
  descSelectors: ['[aria-label="Job description"]', '[data-ui="job-description"]'],
  applySelectors: ['[data-ui="overview-apply-now"]', '[data-ui="apply-button"]', 'a[href*="/apply"]'],
  key(pane) {
    const sel = new URLSearchParams(location.search).get('selectedJobId');
    if (sel) return `wk:${sel}`;
    const title = clean(pane.querySelector('h1,h2')?.textContent);
    if (!title) return null;
    return `wk:${hashKey(title)}`;
  },
});
