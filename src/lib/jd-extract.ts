// ---------------------------------------------------------------------------
// Job-description extraction. Runs in the content script (DOM available).
//
// Strategy:
//   1. Match the current host to a small map of per-site CSS selectors.
//   2. If that fails, fall back to a Readability-style heuristic: find the
//      DOM node with the most readable text after stripping nav/footer/etc.
//   3. The content script also offers manual "select text" / "paste JD" modes
//      (handled in the overlay, not here).
// ---------------------------------------------------------------------------
import type { DetectionQuality, JobContext } from './types';

interface SiteRule {
  /** host substring match */
  host: string;
  name: string;
  jd: string[]; // candidate selectors for the JD body, tried in order
  title?: string[];
  company?: string[];
}

// Per-site selectors. These shift over time; the generic fallback covers misses.
const SITE_RULES: SiteRule[] = [
  {
    host: 'linkedin.com',
    name: 'LinkedIn',
    jd: [
      '#job-details',
      '.jobs-description__container',
      '.jobs-box__html-content',
      '.jobs-description-content__text',
      '.jobs-description__content',
      'article[class*="jobs-description"]',
      '.description__text',
    ],
    title: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '.top-card-layout__title',
      'h1',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
    ],
  },
  {
    host: 'indeed.com',
    name: 'Indeed',
    jd: ['#jobDescriptionText', '.jobsearch-jobDescriptionText'],
    title: ['.jobsearch-JobInfoHeader-title', 'h1.jobsearch-JobInfoHeader-title'],
    company: ['[data-company-name]', '.jobsearch-CompanyInfoContainer a'],
  },
  {
    host: 'glassdoor.',
    name: 'Glassdoor',
    jd: ['.JobDetails_jobDescription__uW_fK', '#JobDescriptionContainer', '.jobDescriptionContent'],
    title: ['.JobDetails_jobTitle__Rw_gn', 'h1'],
    company: ['.EmployerProfile_employerName__Xemli', '[data-test="employer-name"]'],
  },
  {
    host: 'greenhouse.io',
    name: 'Greenhouse',
    jd: ['#content', '.job__description', '.content'],
    title: ['.app-title', 'h1.section-header', 'h1'],
    company: ['.company-name', '.app-title'],
  },
  {
    host: 'lever.co',
    name: 'Lever',
    jd: ['.posting-page .section-wrapper', '.posting-description', '[data-qa="job-description"]'],
    title: ['.posting-headline h2', 'h2'],
    company: ['.main-header-logo img', '.posting-categories'],
  },
  {
    host: 'ashbyhq.com',
    name: 'Ashby',
    jd: ['._descriptionText_4u5gj', '[class*="descriptionText"]', '.ashby-job-posting-right-pane'],
    title: ['[class*="jobPostingHeader"] h1', 'h1'],
    company: ['[class*="companyName"]'],
  },
  {
    host: 'myworkdayjobs.com',
    name: 'Workday',
    jd: ['[data-automation-id="jobPostingDescription"]', '[data-automation-id="job-posting-details"]'],
    title: ['[data-automation-id="jobPostingHeader"]', 'h1'],
    company: ['[data-automation-id="company"]'],
  },
  {
    host: 'wellfound.com',
    name: 'Wellfound',
    jd: ['[class*="JobDescription"]', '.job-description', '#job-description'],
    title: ['h1', '[class*="JobTitle"]'],
    company: ['[class*="CompanyName"]', 'a[href*="/company/"]'],
  },
];

const TEXT_MIN = 220; // a JD shorter than this is suspicious

/**
 * Get an element's text, including content hidden behind a "see more" clamp.
 * `innerText` only returns *rendered* text, so a CSS-truncated / display:none
 * description comes back cut off. `textContent` ignores CSS and returns the full
 * node text — so we take whichever is longer.
 */
function richText(el: Element): string {
  const h = el as HTMLElement;
  const inner = cleanText(h.innerText || '');
  const full = cleanText(h.textContent || '');
  return full.length > inner.length ? full : inner;
}

function firstMatchText(selectors: string[] | undefined): string {
  if (!selectors) return '';
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const txt = el ? richText(el) : '';
    if (txt.length >= 40) return txt;
  }
  return '';
}

// NOTE: we deliberately do NOT click "see more" toggles — doing so on real
// sites (LinkedIn especially) ends up triggering unrelated nav menus, filter
// dropdowns, and share popups. Instead, richText() reads textContent, which
// already contains the full description even when it's visually clamped behind
// a "see more" button, so no clicking is needed.

function cleanText(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const STRIP_SELECTORS =
  'nav, header, footer, script, style, noscript, svg, form, aside, [role="navigation"], [aria-hidden="true"], .nav, .footer, .header, .cookie, .consent';

/**
 * Generic fallback: clone <body>, remove chrome (nav/footer/etc.), then walk the
 * remaining elements and pick the block with the most paragraph-like text.
 */
function readabilityFallback(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(STRIP_SELECTORS).forEach((n) => n.remove());

  const candidates = Array.from(
    clone.querySelectorAll<HTMLElement>('article, main, section, div'),
  );

  let best = '';
  let bestScore = 0;
  for (const el of candidates) {
    const text = cleanText(el.innerText || '');
    if (text.length < TEXT_MIN) continue;
    // Score: length, boosted by the count of sentence-ending punctuation and
    // list items, lightly penalized by link density (nav-like blocks).
    const sentences = (text.match(/[.!?]\s/g) || []).length;
    const links = el.querySelectorAll('a').length;
    const linkPenalty = Math.min(links * 25, text.length * 0.5);
    const score = text.length + sentences * 40 - linkPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }
  // As a last resort, use the whole stripped body.
  if (best.length < TEXT_MIN) best = cleanText(clone.innerText || '');
  return best;
}

function detectSite(): SiteRule | undefined {
  const host = location.hostname;
  return SITE_RULES.find((r) => host.includes(r.host));
}

// Cross-site JD container selectors, tried after the per-site rule. Specific
// first, broad last — so anchoring behaves the same on every board.
const GENERIC_JD_SELECTORS = [
  '#jobDescriptionText',
  '[data-automation-id="jobPostingDescription"]',
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[id*="job-description"]',
  '[id*="jobDescription"]',
  '[class*="posting-description"]',
  '[class*="description__"]',
  '.job-details',
  '.job-content',
  '[class*="description"]',
];

// Headings that mark the start of a description, used as a last-resort anchor
// (covers sites with no recognizable container, e.g. NUworks/Symplicity).
const HEADING_RX =
  /^(job description|about the job|about this role|about the role|the role|description|role overview|responsibilities|what you'?ll do|position overview|job summary)\b/i;

function headingAnchor(): HTMLElement | null {
  const nodes = document.querySelectorAll(
    'h1,h2,h3,h4,h5,[role="heading"],strong,b',
  );
  for (const el of Array.from(nodes)) {
    const t = ((el as HTMLElement).innerText || '').trim().toLowerCase();
    if (t.length < 3 || t.length > 40) continue;
    if (HEADING_RX.test(t)) return el as HTMLElement;
  }
  return null;
}

/**
 * The element to anchor the inline widget to. We insert our widget right
 * *before* it, so it lands under the apply/top-card and above the description on
 * every site. Order: per-site rule → generic JD container → description heading
 * → main content region → null (caller floats it).
 */
export function getJdAnchor(): HTMLElement | null {
  const rule = detectSite();
  if (rule) {
    for (const sel of rule.jd) {
      const el = document.querySelector(sel);
      if (el && (el as HTMLElement).innerText.trim().length > 60) {
        return el as HTMLElement;
      }
    }
  }
  for (const sel of GENERIC_JD_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && (el as HTMLElement).innerText.trim().length > 120) {
      return el as HTMLElement;
    }
  }
  const heading = headingAnchor();
  if (heading) return heading;

  return (
    (document.querySelector('main, article, [role="main"]') as HTMLElement) || null
  );
}

/** Best-effort company name from a site rule, OpenGraph, or document title. */
function guessCompany(rule?: SiteRule): string {
  const fromRule = firstMatchText(rule?.company);
  if (fromRule) return fromRule.split('\n')[0].slice(0, 80);
  const og = document
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute('content');
  if (og) return og.slice(0, 80);
  return location.hostname.replace(/^www\./, '');
}

function guessTitle(rule?: SiteRule): string {
  const fromRule = firstMatchText(rule?.title);
  if (fromRule) return fromRule.split('\n')[0].slice(0, 140);
  const h1 = document.querySelector('h1');
  if (h1 && (h1 as HTMLElement).innerText.trim())
    return (h1 as HTMLElement).innerText.trim().slice(0, 140);
  return cleanText(document.title).slice(0, 140);
}

/** Extract the JobContext for the current page. */
// Short-lived memo: the generic adapter calls extractJob several times per
// process tick (and on every page, since the script now runs on <all_urls>).
let _jobMemo: { t: number; url: string; job: JobContext } | null = null;

export function extractJob(): JobContext {
  if (_jobMemo && _jobMemo.url === location.href && Date.now() - _jobMemo.t < 800) {
    return _jobMemo.job;
  }

  const rule = detectSite();
  let jdText = '';
  let detection: DetectionQuality = 'none';

  if (rule) {
    jdText = firstMatchText(rule.jd);
    if (jdText.length >= TEXT_MIN) detection = 'clean';
  }
  // schema.org JobPosting JSON-LD is the cleanest source when present.
  if (jdText.length < TEXT_MIN) {
    const ld = readJsonLdJob();
    if (ld?.description && cleanText(ld.description).length > jdText.length) {
      jdText = cleanText(ld.description);
      if (jdText.length >= TEXT_MIN) detection = 'clean';
    }
  }
  if (jdText.length < TEXT_MIN) {
    const fallback = readabilityFallback();
    if (fallback.length > jdText.length) {
      jdText = fallback;
      detection = jdText.length >= TEXT_MIN ? 'fallback' : 'none';
    }
  }

  const result: JobContext = {
    url: location.href,
    title: guessTitle(rule),
    company: guessCompany(rule),
    jdText: jdText.slice(0, 18000), // keep tokens sane
    detection,
    site: rule?.name ?? location.hostname.replace(/^www\./, ''),
  };
  _jobMemo = { t: Date.now(), url: location.href, job: result };
  return result;
}

// --- JSON-LD (schema.org JobPosting) ----------------------------------------
interface LdJob {
  description?: string;
  title?: string;
  company?: string;
}

/** Read a schema.org JobPosting from <script type="application/ld+json">. This
 *  is the most reliable "this is a real posting" signal — generic pages (a repo,
 *  an inbox, a search results page) don't carry it. */
function readJsonLdJob(): LdJob | null {
  const nodes = document.querySelectorAll('script[type="application/ld+json"]');
  for (const n of Array.from(nodes)) {
    let data: any;
    try {
      data = JSON.parse(n.textContent || '');
    } catch {
      continue;
    }
    // Could be a single object, an array, or a @graph wrapper.
    const candidates: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.['@graph'])
        ? data['@graph']
        : [data];
    for (const c of candidates) {
      const t = c?.['@type'];
      const isJob = t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'));
      if (isJob) {
        const desc =
          typeof c.description === 'string'
            ? c.description.replace(/<[^>]+>/g, ' ') // strip HTML tags
            : undefined;
        return {
          description: desc,
          title: typeof c.title === 'string' ? c.title : undefined,
          company:
            typeof c.hiringOrganization?.name === 'string'
              ? c.hiringOrganization.name
              : undefined,
        };
      }
    }
  }
  return null;
}

export function hasJobPostingJsonLd(): boolean {
  return readJsonLdJob() !== null;
}

// --- "Is this actually a job posting?" gate ---------------------------------
// Even on a job *site*, not every page is a posting (LinkedIn feed, a search
// results list). We only auto-score when the page shows real posting evidence.
const STRONG_PHRASES = [
  'job description',
  'position overview',
  'about the role',
  'about this role',
  'about the job',
  'responsibilities',
  'qualifications',
  "what you'll do",
  'what you will do',
  'minimum qualifications',
  'preferred qualifications',
  'equal opportunity employer',
  'years of experience',
  'who you are',
  'what we offer',
  'role overview',
  'job summary',
];

const JOB_PATH = /\/(jobs?|careers?|vacanc\w*|positions?|opening\w*|posting\w*|apply)\b/i;

function hasApplyAffordance(): boolean {
  // Scan a bounded set of clickable elements for an "Apply" action.
  const els = document.querySelectorAll('a,button,input[type="submit"]');
  let scanned = 0;
  for (const el of Array.from(els)) {
    if (scanned++ > 400) break; // bound the work on huge pages
    const t = (
      (el as HTMLElement).innerText ||
      (el as HTMLInputElement).value ||
      ''
    )
      .trim()
      .toLowerCase();
    if (!t || t.length > 40) continue;
    if (/\bapply\b/.test(t) && !t.includes('filter') && !t.includes('apply to all')) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true only when the current page looks like an actual job posting.
 * Evidence-based and host-agnostic so a job *site's* homepage/feed/search list
 * doesn't get scored. JSON-LD JobPosting is an instant yes.
 */
export function isLikelyJobPage(job: JobContext): boolean {
  if (hasJobPostingJsonLd()) return true;

  const text = job.jdText.toLowerCase();
  let score = 0;
  if (JOB_PATH.test(location.pathname)) score += 2;

  let phraseHits = 0;
  for (const p of STRONG_PHRASES) {
    if (text.includes(p)) phraseHits++;
    if (phraseHits >= 3) break;
  }
  score += phraseHits;

  if (hasApplyAffordance()) score += 2;

  return score >= 3;
}
