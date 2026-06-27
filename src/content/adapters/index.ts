import type { JobSiteAdapter } from './types';
import { linkedInAdapter } from './linkedin';
import { symplicityAdapter } from './symplicity';
import { genericAdapter } from './generic';

// Site-specific adapters first (richer extraction + card injection), then the
// universal generic adapter that handles every other job posting on the web.
const ADAPTERS: JobSiteAdapter[] = [linkedInAdapter, symplicityAdapter, genericAdapter];

export function activeAdapter(): JobSiteAdapter | null {
  return ADAPTERS.find((a) => a.isSupportedPage()) ?? null;
}
