// ---------------------------------------------------------------------------
// Live job-change detection for single-page job boards (LinkedIn, NUworks/
// Symplicity, Greenhouse embeds, etc.). On these sites, clicking a different
// listing swaps the job description in-place WITHOUT a full page reload, so the
// content script only runs once and would otherwise show a stale score.
//
// This watches for:
//   - DOM content swaps (MutationObserver on <body>) — the main signal
//   - URL changes (history pushState/replaceState navigations) via a 1s poll
//   - back/forward (popstate)
// ...debounces them, re-extracts the JD, and fires the callback ONLY when the
// extracted JD text actually changes (so mutation noise doesn't re-bill the LLM).
// ---------------------------------------------------------------------------
import { extractJob, isLikelyJobPage } from './jd-extract';
import { fnv1a } from './hash';
import type { JobContext } from './types';

// Normalize for *change detection only* (full text is still sent to the LLM):
// lowercase, drop digits and collapse whitespace so volatile bits like
// "37 applicants" / timestamps / notification counts don't look like a new job.
const normHash = (t: string): string =>
  fnv1a(t.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim());

export interface WatchHandlers {
  /** Fires when a new, stable job posting is detected. */
  onJob: (job: JobContext) => void;
  /** Fires when the current page is not (or no longer) a job posting. */
  onLeave?: () => void;
}

export function watchJob(handlers: WatchHandlers): () => void {
  const { onJob, onLeave } = handlers;
  let lastFired = '';
  let pending = '';
  let leftNotified = false;
  let lastUrl = location.href;
  let timer: number | undefined;

  // "Debounce until stable": only act once two consecutive reads (≈450ms apart)
  // produce the same JD. This avoids firing mid-render and stops the runaway
  // re-evaluation loop on chatty pages like LinkedIn.
  const check = () => {
    const job = extractJob();

    // Gate: only score actual job postings, never a site's feed/search/homepage.
    if (job.jdText.trim().length < 80 || !isLikelyJobPage(job)) {
      if (lastFired !== '' || !leftNotified) {
        lastFired = '';
        pending = '';
        leftNotified = true;
        onLeave?.();
      }
      return;
    }
    leftNotified = false;

    const h = normHash(job.jdText);
    if (h !== pending) {
      pending = h; // DOM still settling — wait one more cycle
      schedule();
      return;
    }
    if (h !== lastFired) {
      lastFired = h;
      onJob(job);
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(check, 450);
  };

  // DOM swaps are the reliable cross-site signal. We deliberately do NOT watch
  // characterData to cut noise; JD panels are replaced as element subtrees.
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true });

  // pushState/replaceState fire no event and (from the content script's isolated
  // world) can't be reliably monkey-patched, so poll the URL cheaply.
  const urlPoll = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      schedule();
    }
  }, 1000);

  window.addEventListener('popstate', schedule);

  // Initial extraction.
  check();

  return () => {
    mo.disconnect();
    clearInterval(urlPoll);
    if (timer) clearTimeout(timer);
    window.removeEventListener('popstate', schedule);
  };
}
