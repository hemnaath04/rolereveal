// ZipRecruiter (ziprecruiter.com and country TLDs) — split master-detail search.
// Tailwind-only markup with no JSON-LD: the selected job's detail lives in
// [data-testid="right-pane"]. The right pane has no semantic description node, so
// the split-pane factory falls back to the pane's largest text block. The per-job
// key is the Apply link's match_token (changes per selection), then a title hash.
import { makeSplitPaneAdapter, hashKey } from './split-pane';

const clean = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

export const zipRecruiterAdapter = makeSplitPaneAdapter({
  site: 'ZipRecruiter',
  matches(url) {
    return /(^|\.)ziprecruiter\.[a-z.]+$/.test(url.hostname);
  },
  paneSelectors: ['[data-testid="right-pane"]', 'main [data-testid*="right"]'],
  titleSelectors: ['h1', 'h2[class*="text-primary"]', '[data-testid="job-title"]'],
  // No reliable company node in the right pane markup; left undefined.
  applySelectors: ['a[aria-label="Apply"]', 'a[href*="job-redirect"]', 'a[href*="apply"]'],
  key(pane) {
    const a =
      pane.querySelector('a[aria-label="Apply"]') ||
      pane.querySelector('a[href*="job-redirect"]');
    const href = a?.getAttribute('href') || '';
    const m = href.match(/match_token=([^&]+)/) || href.match(/\/job\/([^/?#]+)/);
    if (m) return `zr:${m[1].slice(0, 32)}`;
    const title = clean(pane.querySelector('h1,h2')?.textContent);
    if (!title) return null;
    return `zr:${hashKey(title)}`;
  },
});
