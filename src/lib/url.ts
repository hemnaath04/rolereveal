// ---------------------------------------------------------------------------
// URL normalization used as the dismissal key. We strip the hash and noisy
// tracking params but KEEP job-identifying params (e.g. currentJobId) so two
// genuinely different jobs map to different keys, while the same job with
// different tracking junk maps to the same key.
// ---------------------------------------------------------------------------

// Tracking / analytics params that never identify a job.
const TRACKING_PARAMS = new Set([
  'ref',
  'refId',
  'trk',
  'trackingId',
  'eBP',
  'origin',
  'geoId',
  'savedSearchId',
  'lici',
  'lipi',
  'midToken',
  'midSig',
]);

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    const params = u.searchParams;
    for (const key of [...params.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key)) {
        params.delete(key);
      }
    }
    return u.toString();
  } catch {
    // Best-effort hash strip on a non-parseable URL.
    const hashIdx = raw.indexOf('#');
    return hashIdx === -1 ? raw : raw.slice(0, hashIdx);
  }
}
