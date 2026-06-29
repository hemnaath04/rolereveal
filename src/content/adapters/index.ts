import type { JobSiteAdapter } from './types';
import { linkedInAdapter } from './linkedin';
import { indeedAdapter } from './indeed';
import { glassdoorAdapter } from './glassdoor';
import { zipRecruiterAdapter } from './ziprecruiter';
import { workableJobsAdapter } from './workable-jobs';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { ashbyAdapter } from './ashby';
import { workdayAdapter } from './workday';
import { smartRecruitersAdapter } from './smartrecruiters';
import { icimsAdapter } from './icims';
import { workableAdapter } from './workable';
import { symplicityAdapter } from './symplicity';
import { genericAdapter } from './generic';

// Order matters: activeAdapter() picks the first whose isSupportedPage() is true.
// Split-pane search boards (left list + right detail) come first, then standalone
// ATS posting pages, then the universal generic JSON-LD/heuristic adapter that
// handles every other job posting. workableJobsAdapter (jobs.workable.com) must
// precede workableAdapter so the aggregator board isn't claimed by the ATS one.
export const ADAPTERS: JobSiteAdapter[] = [
  linkedInAdapter,
  indeedAdapter,
  glassdoorAdapter,
  zipRecruiterAdapter,
  workableJobsAdapter,
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  smartRecruitersAdapter,
  icimsAdapter,
  workableAdapter,
  symplicityAdapter,
  genericAdapter,
];

export function activeAdapter(): JobSiteAdapter | null {
  return ADAPTERS.find((a) => a.isSupportedPage()) ?? null;
}
