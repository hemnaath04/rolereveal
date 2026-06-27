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

export type Provider = 'anthropic' | 'openai' | 'custom';

export interface Settings {
  provider: Provider;
  /** API key for the chosen provider. Stored only in chrome.storage.local. */
  apiKey: string;
  /** Model id, e.g. claude-opus-4-8 or gpt-4o. */
  model: string;
  /** Base URL for the "custom" OpenAI-compatible provider (Manifest gateway,
   *  Ollama at http://localhost:11434/v1, etc.). Ignored for anthropic/openai. */
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
  // Ship with the built-in backend so new users score jobs with zero setup;
  // anything they set in Options overrides this. See src/lib/config.ts.
  provider: DEFAULT_BACKEND.provider,
  apiKey: DEFAULT_BACKEND.apiKey,
  model: DEFAULT_BACKEND.model,
  customBaseUrl: DEFAULT_BACKEND.customBaseUrl,
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

/** A single qualification with whether the candidate appears to meet it. */
export interface Qual {
  name: string;
  have: boolean;
}

/**
 * Evaluation contract. The card strip uses only `overallScore`/`verdict`; the
 * details panel uses the full breakdown.
 */
export interface EvalResult {
  perResume: PerResumeScore[];
  bestResume: string;
  overallScore: number;
  verdict: Verdict;
  /** One sentence, max 20 words, explaining the verdict. */
  summary: string;
  requiredQualifications: Qual[];
  optionalQualifications: Qual[];
  matchedSkills: string[];
  missingSkills: string[];
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
  | { type: 'PING' };

export type EvaluateResponse =
  | { ok: true; result: EvalResult; cached: boolean }
  | { ok: false; error: string };

export type TailorResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };
