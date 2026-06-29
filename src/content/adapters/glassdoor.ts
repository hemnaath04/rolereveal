// Glassdoor (glassdoor.com and country TLDs) — split master-detail search view.
// The left column is a list of job cards; the right column shows the selected
// job's detail. The bug this fixes: Glassdoor keeps ONE search URL across job
// selections, so a URL-derived key never changes and the panel goes stale after
// you click a different job. The per-job key here is the SELECTED card's
// `data-jobid`, which changes on every selection → the panel re-keys + re-scores.
import { makeSplitPaneAdapter } from './split-pane';

const clean = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

/** The job id of the currently-selected left-column card. */
function selectedJobId(): string | null {
  const selectedCard =
    document.querySelector('[data-test="job-card-wrapper"][data-selected="true"]') ||
    document.querySelector('li[class*="JobsList_selected"]') ||
    document.querySelector('li[class*="JobCard_selected"]');
  const li =
    selectedCard?.closest('li[data-jobid]') ||
    selectedCard?.querySelector('[data-jobid]') ||
    selectedCard;
  const id = li?.getAttribute?.('data-jobid');
  return id || null;
}

export const glassdoorAdapter = makeSplitPaneAdapter({
  site: 'Glassdoor',
  matches(url) {
    return /(^|\.)glassdoor\.[a-z.]+$/.test(url.hostname);
  },
  // The right detail column. Derived robustly: any JobDetails_* container.
  paneSelectors: [
    '[class*="JobDetails_jobDetailsContainer"]',
    '[class*="JobDetails_jobDetails"]',
    '#JDCol',
    '[class*="TwoColumnLayout_columnRight"]',
  ],
  titleSelectors: [
    'header[class*="JobDetails_jobDetailsHeader"] h1',
    'h1[class*="heading_Level1"]',
    '[data-test="job-title"]',
    'h1',
  ],
  companySelectors: [
    '[class*="EmployerProfile_employerName"]',
    '[data-test="employer-name"]',
    '[class*="EmployerProfile"] a',
  ],
  descSelectors: [
    '[class*="JobDetails_jobDescription"]',
    '#JobDescriptionContainer',
    '[class*="JobDetails_showHidden"]',
  ],
  applySelectors: [
    'button[data-test="applyButton"]',
    '[class*="JobDetails_applyButton"] button',
    'a[data-test="applyButton"]',
  ],
  key(pane) {
    const id = selectedJobId();
    if (id) return id;
    // Fallbacks: a job id in the URL, else the detail title (still re-keys).
    const u =
      new URLSearchParams(location.search).get('jobListingId') ||
      new URLSearchParams(location.search).get('jl');
    if (u) return u;
    const t = clean(pane.querySelector('h1')?.textContent);
    return t ? `g:${t}` : null;
  },
});
