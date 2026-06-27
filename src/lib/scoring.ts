// ---------------------------------------------------------------------------
// Post-processing for the LLM's evaluation: validate/normalize the JSON, make
// the verdict consistent with the user's thresholds, and pick the best resume.
// ---------------------------------------------------------------------------
import type { EvalResult, PerResumeScore, Settings, Verdict } from './types';

const clamp = (n: unknown): number => {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
};

export function deriveVerdict(score: number, t: Settings['thresholds']): Verdict {
  if (score >= t.apply) return 'Apply';
  if (score >= t.maybe) return 'Maybe';
  return 'Skip';
}

/** Color for the badge: green >= apply, yellow >= maybe, red below. */
export function colorForScore(score: number, t: Settings['thresholds']): string {
  if (score >= t.apply) return '#16a34a'; // green
  if (score >= t.maybe) return '#d97706'; // amber
  return '#dc2626'; // red
}

/**
 * Take whatever the model returned (already JSON.parsed) and coerce it into a
 * safe, fully-populated EvalResult. We trust the model's per-resume scores but
 * re-derive bestResume/overallScore/verdict so the UI is always self-consistent.
 */
export function normalizeResult(raw: any, settings: Settings): EvalResult {
  const perResume: PerResumeScore[] = Array.isArray(raw?.perResume)
    ? raw.perResume.map((r: any) => ({
        label: typeof r?.label === 'string' ? r.label : 'Resume',
        score: clamp(r?.score),
      }))
    : [];

  // Pick the best resume by score (the model also reports one; we trust scores).
  const best =
    perResume.length > 0
      ? perResume.reduce((a, b) => (b.score > a.score ? b : a))
      : undefined;

  const overallScore = best ? best.score : clamp(raw?.overallScore);
  const bestResume =
    best?.label ?? (typeof raw?.bestResume === 'string' ? raw.bestResume : '—');

  const d = raw?.dimensions ?? {};
  // Fall back to the overall score if a sub-score is missing.
  const dim = (v: unknown) =>
    v === undefined || v === null || v === '' ? overallScore : clamp(v);
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? clampWords(v, max) : '';

  return {
    perResume,
    bestResume,
    overallScore,
    // Re-derive so it always matches the user's thresholds.
    verdict: deriveVerdict(overallScore, settings.thresholds),
    summary: clampWords(typeof raw?.summary === 'string' ? raw.summary : '', 20),
    dimensions: {
      skills: dim(d.skills),
      experience: dim(d.experience),
      roleContext: dim(d.roleContext),
    },
    whyMatch: str(raw?.whyMatch, 16),
    watchOuts: str(raw?.watchOuts, 18),
  };
}

/** Hard-cap a summary to N words so the overlay stays tiny. */
function clampWords(s: string, n: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return s.trim();
  return words.slice(0, n).join(' ') + '…';
}
