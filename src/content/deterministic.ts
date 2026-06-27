// Fast, deterministic (no-LLM) signals pulled straight from the JD text.
// These render instantly before the LLM analysis returns.

export interface DeterministicSignals {
  sponsorship: 'none' | 'available' | 'citizenship' | 'unknown';
  workMode: 'Remote' | 'Hybrid' | 'On-site' | null;
  salary: string | null;
}

const NO_SPONSOR =
  /(not|unable to|cannot|won'?t|do not)\s+(provide|offer|sponsor)[\w\s]*\bsponsor|without\s+sponsorship|no\s+sponsorship|sponsorship\s+is\s+not/i;
const SPONSOR_OK = /(will|can|do)\s+sponsor|sponsorship\s+(is\s+)?available|visa\s+sponsorship\s+(available|offered)/i;
const CITIZEN =
  /(u\.?s\.?\s+citizen(ship)?\s+(is\s+)?required|must be a u\.?s\.? citizen|security clearance|requires? .{0,20}clearance)/i;

const SALARY =
  /\$\s?\d{2,3}(?:,\d{3})?(?:\s?[-–to]+\s?\$?\s?\d{2,3}(?:,\d{3})?)?(?:\s?(?:k|\/yr|per year|a year|\/hour|per hour|\/hr))?/i;

export function deterministicSignals(jd: string): DeterministicSignals {
  const t = jd || '';
  let sponsorship: DeterministicSignals['sponsorship'] = 'unknown';
  if (NO_SPONSOR.test(t)) sponsorship = 'none';
  else if (CITIZEN.test(t)) sponsorship = 'citizenship';
  else if (SPONSOR_OK.test(t)) sponsorship = 'available';

  let workMode: DeterministicSignals['workMode'] = null;
  if (/\bremote\b/i.test(t)) workMode = 'Remote';
  if (/\bhybrid\b/i.test(t)) workMode = 'Hybrid';
  if (/\bon-?site\b|\bin-?office\b/i.test(t)) workMode = 'On-site';

  const salaryMatch = t.match(SALARY);
  const salary = salaryMatch ? salaryMatch[0].replace(/\s+/g, ' ').trim() : null;

  return { sponsorship, workMode, salary };
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'this',
  'that', 'have', 'from', 'job', 'role', 'work', 'team', 'experience',
]);

const tokenize = (s: string): Set<string> =>
  new Set(
    (s.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || []).filter((w) => !STOP.has(w)),
  );

/**
 * Cheap local title↔resume overlap, used only for the at-a-glance card chip.
 * This is an *estimate*; the real score comes from the LLM in the details panel.
 */
export function quickLocalScore(resumeText: string, jobText: string): number {
  const job = tokenize(jobText);
  if (job.size === 0) return 0;
  const resume = tokenize(resumeText);
  let hits = 0;
  for (const w of job) if (resume.has(w)) hits++;
  return Math.round((hits / job.size) * 100);
}
