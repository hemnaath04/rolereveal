import type { JobSiteAdapter } from './types';
import {
  extractJob,
  getJdAnchor,
  hasJobPostingJsonLd,
  isLikelyJobPage,
} from '../../lib/jd-extract';

// Universal fallback: works on any job posting on the web. Details-panel only
// (no per-card injection). Gated by isLikelyJobPage so it never fires on a
// non-posting page (a repo, an inbox, a blog post).
export const genericAdapter: JobSiteAdapter = {
  site: 'web',

  isSupportedPage() {
    if (hasJobPostingJsonLd()) return true;
    return isLikelyJobPage(extractJob());
  },

  getResultsContainer() {
    return document.body;
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
    if (!hasJobPostingJsonLd() && !isLikelyJobPage(extractJob())) return null;
    return (document.querySelector('main') as HTMLElement) || document.body;
  },

  findDetailsInsertionPoint() {
    // getJdAnchor returns the description container or a "Job Description"-style
    // heading; we insert our panel right before it (above the description).
    return getJdAnchor();
  },

  findDetailsJobId() {
    // Stable per posting within a site (covers SPA query-param routing too).
    return location.pathname + location.search;
  },

  extractDetailsSummary() {
    const j = extractJob();
    return {
      id: location.pathname + location.search,
      title: j.title,
      company: j.company,
      url: location.href,
    };
  },

  extractFullJobDescription() {
    const t = extractJob().jdText;
    return t.length >= 80 ? t : null;
  },

  clickApply() {
    for (const b of Array.from(document.querySelectorAll<HTMLElement>('a, button'))) {
      const t = (b.textContent || '').trim().toLowerCase();
      if (/^apply\b/.test(t) && !t.includes('filter')) {
        b.click();
        return;
      }
    }
  },
};
