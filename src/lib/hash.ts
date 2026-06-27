// Small stable string hash (FNV-1a, 32-bit) used to key the eval cache by the
// JD text plus the set of enabled resume ids. Cheap and dependency-free; we
// never need cryptographic strength here.
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Unsigned hex.
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Cache key: hash of the JD plus the ids+updatedAt of the resumes in play, so
 *  editing a resume invalidates stale results automatically. */
export function evalCacheKey(jdText: string, resumeFingerprint: string): string {
  return fnv1a(`${resumeFingerprint}::${jdText.trim()}`);
}
