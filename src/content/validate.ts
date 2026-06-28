// ---------------------------------------------------------------------------
// Strict page validation. Before injecting/analysing, we require:
//   1. A canonical job key + minimum field lengths (title/company/description).
//   2. At least one positive "this is a real posting" signal.
//   3. No clear rejection heuristic firing (login page, application form,
//      search-results list with nothing selected, career homepage, ATS dash).
// Heuristics are deliberately conservative: when unsure, detectRejection()
// returns null and the field-minimums + signal requirement do the gating.
// ---------------------------------------------------------------------------
import { PAGE_VALIDATION } from '../config/patterns';
import { hasJobPostingJsonLd } from '../lib/jd-extract';
import type { ExtractedJob, JobSiteAdapter } from './adapters/types';
import { adapterMatchesUrl } from './adapters/extract';

export type Signal = 'job-posting-json-ld' | 'known-job-url' | 'known-ats-selector';

export type RejectReason =
  | 'search-results-without-selected-job'
  | 'generic-career-homepage'
  | 'login-page'
  | 'application-form'
  | 'employer-homepage'
  | 'ats-dashboard'
  | 'missing-fields'
  | 'no-signal';

export interface ValidatedJob {
  key: string;
  title: string;
  company: string;
  description: string;
  url: string;
}

interface ExtractedInput {
  key: string;
  title: string;
  company: string;
  description: string;
  url: string;
}

/** Positive evidence that the current page is a single, real job posting. */
export function detectSignals(
  adapter: JobSiteAdapter,
  extracted: ExtractedInput,
): Signal[] {
  const signals: Signal[] = [];

  if (hasJobPostingJsonLd()) signals.push('job-posting-json-ld');

  // Active adapter matched this URL and produced a canonical key.
  let url: URL | null = null;
  try {
    url = new URL(location.href);
  } catch {
    url = null;
  }
  if (url && adapterMatchesUrl(adapter, url) && extracted.key) {
    signals.push('known-job-url');
  }

  // A dedicated (non-generic) adapter pulled a real job from site-specific
  // selectors. Company is intentionally NOT required here — many real boards
  // (Indeed, Greenhouse, …) render the company in a logo/header that varies, and
  // a canonical key + title + a substantial description is already strong proof.
  if (
    adapter.dedicated &&
    extracted.title.length > 0 &&
    extracted.description.length >= PAGE_VALIDATION.minimumDescriptionLength
  ) {
    signals.push('known-ats-selector');
  }

  return signals;
}

const REJECT_URL_RX = {
  login: /(login|sign-?in|signin|auth|authenticate)/i,
  apply: /(apply|application)/i,
  homepage: /(dashboard|admin|recruiter|employer|manage)/i,
};

function visiblePasswordInput(): boolean {
  for (const el of Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  )) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return true;
  }
  return false;
}

function longestDescriptionLength(): number {
  // A crude "is there a substantial JD on the page" probe used by rejection
  // heuristics so a login/search page with a tiny blurb still rejects.
  const main = document.querySelector('main, article, [role="main"]') as HTMLElement | null;
  const text = (main?.innerText || document.body?.innerText || '').trim();
  return text.length;
}

function jobCardCount(): number {
  const sels = [
    '[data-jk]',
    '.job-card',
    '.job_card',
    '[class*="job-card"]',
    'li[role="listitem"]',
    '[data-testid*="job-card"]',
    'article[class*="job"]',
  ];
  const seen = new Set<Element>();
  for (const s of sels) {
    for (const el of Array.from(document.querySelectorAll(s))) seen.add(el);
  }
  return seen.size;
}

/**
 * Conservative rejection heuristics. Returns null unless evidence is clear.
 * When `strongSignal` is true (a JobPosting JSON-LD or a dedicated adapter
 * extracted a complete job) the page IS a real posting, so the structural
 * "no selected job" heuristics (search list / career homepage / employer page /
 * ATS dashboard) must not override it — e.g. Indeed's /jobs?vjk=<id> selected
 * job has path "/jobs" but is a real posting.
 */
export function detectRejection(strongSignal = false): RejectReason | null {
  if (strongSignal) return null;
  let url: URL;
  try {
    url = new URL(location.href);
  } catch {
    return null;
  }
  const path = url.pathname;
  const hasJsonLd = hasJobPostingJsonLd();

  // login-page: a visible password input with no real JD, or an auth URL.
  if (
    (visiblePasswordInput() && longestDescriptionLength() < 400) ||
    REJECT_URL_RX.login.test(path)
  ) {
    return 'login-page';
  }

  // application-form: many form fields + apply URL/heading + no JobPosting JSON-LD.
  const formFields = document.querySelectorAll(
    'form input, form textarea, form select',
  ).length;
  const headingText = (document.querySelector('h1')?.textContent || '').toLowerCase();
  if (
    !hasJsonLd &&
    formFields >= 4 &&
    (REJECT_URL_RX.apply.test(path) || REJECT_URL_RX.apply.test(headingText))
  ) {
    return 'application-form';
  }

  // search-results-without-selected-job: many cards, no detail pane, no posting.
  if (!hasJsonLd && jobCardCount() >= 5) {
    const hasDetail = !!document.querySelector(
      '[data-testid*="jobInfoHeader"], .jobsearch-JobComponent, #jobDescriptionText, [data-automation-id="jobPostingDescription"]',
    );
    if (!hasDetail) return 'search-results-without-selected-job';
  }

  // generic-career-homepage / employer-homepage: root/careers/jobs path, no id, no posting.
  if (!hasJsonLd && /^\/(careers?|jobs?)?\/?$/.test(path)) {
    return 'generic-career-homepage';
  }

  // ats-dashboard: recruiter/admin UI with no public posting.
  if (!hasJsonLd && REJECT_URL_RX.homepage.test(path)) {
    return 'ats-dashboard';
  }

  return null;
}

export function validatePage(
  adapter: JobSiteAdapter,
  extracted: ExtractedInput,
): { ok: true; job: ValidatedJob } | { ok: false; reason: RejectReason } {
  // Field minimums + canonical key.
  if (PAGE_VALIDATION.requireCanonicalJobKey && !extracted.key) {
    return { ok: false, reason: 'missing-fields' };
  }
  // Company length is required only for the generic (non-dedicated) adapter.
  // Dedicated site adapters only fire on a real job-detail page, so we don't let
  // a missing/odd company field (common DOM variance) block a real posting.
  const companyOk =
    adapter.dedicated || extracted.company.length >= PAGE_VALIDATION.minimumCompanyLength;
  if (
    extracted.title.length < PAGE_VALIDATION.minimumTitleLength ||
    !companyOk ||
    extracted.description.length < PAGE_VALIDATION.minimumDescriptionLength
  ) {
    return { ok: false, reason: 'missing-fields' };
  }

  // Require >=1 accepted signal.
  const accepted = new Set(PAGE_VALIDATION.acceptedSignals);
  const signals = detectSignals(adapter, extracted).filter((s) => accepted.has(s));
  if (signals.length === 0) {
    return { ok: false, reason: 'no-signal' };
  }

  // A JSON-LD JobPosting or a complete dedicated-adapter extraction is strong
  // proof this is a real posting; structural "no selected job" rejections are
  // then skipped (they exist for the weak/generic case).
  const strongSignal =
    signals.includes('job-posting-json-ld') || signals.includes('known-ats-selector');

  // Run rejection heuristics, but only fail on a configured reject type.
  const rejection = detectRejection(strongSignal);
  if (rejection && PAGE_VALIDATION.rejectPageTypes.includes(rejection)) {
    return { ok: false, reason: rejection };
  }

  return {
    ok: true,
    job: {
      key: extracted.key,
      title: extracted.title,
      company: extracted.company,
      description: extracted.description,
      url: extracted.url,
    },
  };
}
