// ---------------------------------------------------------------------------
// Shared types for RoleReveal. Used by background, content, popup, and options.
// ---------------------------------------------------------------------------
import { DEFAULT_BACKEND } from './config';

/** A saved resume the user manages in the options page. */
export interface Resume {
  id: string;
  label: string;
  text: string;
  favorite: boolean;
  /** When false, this resume is skipped during evaluation. */
  enabled: boolean;
  source: 'pdf' | 'paste' | 'json';
  createdAt: number;
  updatedAt: number;
}

/** A provider id from the registry in providers.ts ('builtin','openai',…). */
export type Provider = string;

export interface Settings {
  /** Provider id (see src/lib/providers.ts). 'builtin' = RoleReveal's hosted AI. */
  provider: Provider;
  /** API key for the chosen provider. Stored only in chrome.storage.local. */
  apiKey: string;
  /** Model id, e.g. claude-haiku-4-5 or gpt-4o-mini. Empty = provider default. */
  model: string;
  /** Base URL — only used by providers that need one (Custom, Ollama). For
   *  hosted providers the base URL comes from the registry, not from here. */
  customBaseUrl: string;
  /** Score thresholds for the verdict colours/labels. */
  thresholds: { apply: number; maybe: number };
  /** Auto-run evaluation on page load vs. wait for a manual click. */
  autoRun: boolean;
  /** Mask personal info (name, email, phone, links) before sending to the LLM. */
  redactPii: boolean;
  /** Preferred resume id; used as a tie-break / default ordering hint. */
  defaultResumeId: string | null;
  /** Remembered overlay position + collapsed state. */
  overlay: { x: number; y: number; collapsed: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  // Ship on the built-in hosted AI so new users score jobs with zero setup. The
  // built-in provider's base URL lives in the registry (providers.ts), not here,
  // so it stays out of the visible settings. Users can switch to their own
  // provider/key under "Advanced" in Options.
  provider: 'builtin',
  apiKey: DEFAULT_BACKEND.apiKey,
  model: '',
  customBaseUrl: '',
  thresholds: { apply: 75, maybe: 55 },
  autoRun: true,
  redactPii: true,
  defaultResumeId: null,
  overlay: { x: -1, y: -1, collapsed: false },
};

/** Per-resume score (just label + score; used to pick the best resume). */
export interface PerResumeScore {
  label: string;
  score: number;
}

export type Verdict = 'Apply' | 'Maybe' | 'Skip';

/** Per-dimension sub-scores (0–100) shown as bars in the panel. */
export interface ScoreDimensions {
  skills: number;
  experience: number;
  roleContext: number;
}

/**
 * Evaluation contract. The card strip uses only `overallScore`/`verdict`; the
 * details panel renders the donut, dimension bars, and why/watch-outs.
 */
export interface EvalResult {
  perResume: PerResumeScore[];
  bestResume: string;
  overallScore: number;
  verdict: Verdict;
  /** One sentence, max 20 words, explaining the verdict. */
  summary: string;
  dimensions: ScoreDimensions;
  /** Short phrase: the genuine strengths for this role. */
  whyMatch: string;
  /** Short phrase: the main gaps / risks (incl. eligibility). */
  watchOuts: string;
}

/** Lightweight per-card job identity extracted from a list card. */
export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
}

/** How confident JD auto-detection was, surfaced in the overlay. */
export type DetectionQuality = 'clean' | 'fallback' | 'manual' | 'none';

export interface JobContext {
  url: string;
  title: string;
  company: string;
  jdText: string;
  detection: DetectionQuality;
  site: string;
}

/** A row in the application tracker. */
export interface TrackedApplication {
  id: string;
  company: string;
  title: string;
  url: string;
  score: number;
  bestResume: string;
  date: number;
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
}

/** Cached evaluation keyed by a hash of (JD + enabled resume ids). */
export interface CachedEval {
  hash: string;
  result: EvalResult;
  createdAt: number;
}

// --- chrome.storage.local schema --------------------------------------------
export interface StorageShape {
  resumes: Resume[];
  settings: Settings;
  tracker: TrackedApplication[];
  evalCache: Record<string, CachedEval>;
}

// --- Messaging protocol (content/popup <-> background) -----------------------
export type Message =
  | { type: 'EVALUATE'; job: JobContext; force?: boolean }
  | { type: 'TAILOR'; job: JobContext; resumeLabel: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'GET_RESUMES' }
  | { type: 'TRACK_APPLY'; app: Omit<TrackedApplication, 'id' | 'date' | 'status'> }
  | { type: 'DISMISS_PANEL'; url: string }
  | { type: 'IS_DISMISSED'; url: string }
  | { type: 'CLEAR_DISMISS'; url: string }
  | { type: 'OPEN_PANEL' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'GET_JOB' }
  | { type: 'PING_CONTENT' }
  | { type: 'PING' };

export type EvaluateResponse =
  | { ok: true; result: EvalResult; cached: boolean }
  | { ok: false; error: string };

/** Response to IS_DISMISSED: whether the panel was dismissed for this url+tab. */
export type IsDismissedResponse = { dismissed: boolean };

export type TailorResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };
