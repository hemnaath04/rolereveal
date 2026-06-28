import type { JobSiteAdapter } from './adapters/types';
import type {
  EvalResult,
  EvaluateResponse,
  IsDismissedResponse,
  JobContext,
} from '../lib/types';
import { normalizeUrl } from '../lib/url';
import { deterministicSignals, quickLocalScore } from './deterministic';
import {
  ROOT_ATTR,
  appOf,
  createShadowHost,
  detailsHost,
  getOrCreateDetailsHost,
  removeDetailsHost,
  renderCardPanel,
  renderDetailsError,
  renderDetailsResult,
  renderDetailsSkeleton,
} from './ui';

const send = <T,>(msg: unknown): Promise<T> =>
  chrome.runtime.sendMessage(msg) as Promise<T>;

// Resume text for the cheap local card estimate (set by index.ts).
let resumeText = '';
export function setResumeText(t: string) {
  resumeText = t;
}

// In-memory result cache + in-flight guard for the details panel, keyed by job
// id so the noisy MutationObserver doesn't re-trigger LLM calls for the same job.
const detailsCache = new Map<string, EvalResult>();
let detailsInFlight: string | null = null;
let detailsRenderedId: string | null = null;

// Dismissal lifecycle, keyed by normalizeUrl(location.href). `dismissed` is the
// in-memory truth that stops the MutationObserver from re-injecting; `checked`
// records which keys we've already queried the background session store for, so
// a reload of a previously-dismissed job stays dismissed without flashing.
const dismissed = new Set<string>();
const checked = new Set<string>();

function directChildRoot(parent: HTMLElement, kind: string): HTMLElement | null {
  for (const c of Array.from(parent.children)) {
    if (c.getAttribute(ROOT_ATTR) === kind) return c as HTMLElement;
  }
  return null;
}

// ── List cards ──────────────────────────────────────────────────────────────
export function processVisibleJobCards(adapter: JobSiteAdapter): void {
  for (const card of adapter.getJobCards()) {
    const summary = adapter.extractJobSummary(card);
    if (!summary) continue;

    const insertion = adapter.findCardInsertionPoint(card);
    if (!insertion) continue;

    const existing = directChildRoot(insertion, 'card');
    // Virtualized cards get reused for a different job — compare the stable id.
    if (existing && existing.dataset.jobId === summary.id) continue;
    existing?.remove();

    const host = createShadowHost(summary.id, 'card');
    insertion.appendChild(host);

    const est = quickLocalScore(
      resumeText,
      `${summary.title} ${summary.company} ${summary.location ?? ''}`,
    );
    const signals = deterministicSignals((card.innerText || '').slice(0, 4000));
    renderCardPanel(appOf(host), est, signals);
  }
}

// ── Selected job details ─────────────────────────────────────────────────────
// One panel per tab, period. The single root is found GLOBALLY by id (not within
// a subtree the host might be inserted outside of) and reused across observer
// ticks, SPA navigations, and even a second content-script instance. We only
// touch the DOM when the selected job actually changes.
export function processSelectedJobDetails(adapter: JobSiteAdapter): void {
  const panel = adapter.findDetailsPanel();
  const jobId = panel ? adapter.findDetailsJobId() : null;

  // Page is not (or no longer) a recognised job posting → remove any stale panel.
  if (!panel || !jobId) {
    removeDetailsHost();
    resetDetailsState();
    return;
  }

  const key = normalizeUrl(location.href);

  // Dismissal guards — run before any injection so the observer can't re-add a
  // panel the user closed for this job url.
  if (dismissed.has(key)) {
    removeDetailsHost();
    return;
  }
  if (!checked.has(key)) {
    // Wait one tick: ask the background session store whether this url was
    // dismissed in this tab (e.g. before a reload) so it doesn't flash.
    checked.add(key);
    void chrome.runtime
      .sendMessage({ type: 'IS_DISMISSED', url: location.href })
      .then((r: IsDismissedResponse | undefined) => {
        if (r?.dismissed) dismissed.add(key);
      })
      .catch(() => {
        /* background unavailable — fall through to normal injection next tick */
      });
    return;
  }

  // Already showing this exact job → do nothing (no re-inject, no re-analyze).
  const current = detailsHost();
  if (current && current.dataset.jobId === jobId) return;

  const insertion = adapter.findDetailsInsertionPoint(panel);
  if (!insertion || !insertion.parentElement) return;

  // Reuse the single global root and (re)position it just below the apply area.
  const host = getOrCreateDetailsHost();
  host.dataset.jobId = jobId;
  insertion.parentElement.insertBefore(host, insertion);
  const app = appOf(host);

  const cached = detailsCache.get(jobId);
  if (cached) {
    renderResult(adapter, jobId, app, cached);
    return;
  }
  void analyzeDetails(adapter, jobId, host, app, false);
}

async function analyzeDetails(
  adapter: JobSiteAdapter,
  jobId: string,
  host: HTMLElement,
  app: HTMLElement,
  force: boolean,
): Promise<void> {
  if (detailsInFlight === jobId && !force) return;
  detailsInFlight = jobId;

  const summary = adapter.extractDetailsSummary();
  renderDetailsSkeleton(app, summary);

  // The job description may still be rendering (SPA route, lazy content). Poll
  // briefly while the loading screen stays up, instead of erroring on the first
  // miss — this is the difference between "loads for some jobs" and all of them.
  let jd = adapter.extractFullJobDescription();
  for (let i = 0; i < 10 && !jd; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (!host.isConnected || adapter.findDetailsJobId() !== jobId) {
      detailsInFlight = null;
      return;
    }
    jd = adapter.extractFullJobDescription();
  }
  if (!jd) {
    if (host.isConnected) renderDetailsError(app, 'no job description found', () => analyzeDetails(adapter, jobId, host, app, true));
    detailsInFlight = null;
    return;
  }

  const job: JobContext = {
    url: summary?.url || location.href,
    title: summary?.title || '',
    company: summary?.company || '',
    jdText: jd,
    detection: 'clean',
    site: adapter.site,
  };

  const res = await send<EvaluateResponse>({ type: 'EVALUATE', job, force });

  // Bail if the user moved to another job while we were waiting.
  if (!host.isConnected || adapter.findDetailsJobId() !== jobId) {
    detailsInFlight = null;
    return;
  }

  if (res.ok) {
    detailsCache.set(jobId, res.result);
    renderResult(adapter, jobId, app, res.result);
    detailsRenderedId = jobId;
  } else {
    renderDetailsError(app, res.error, () => analyzeDetails(adapter, jobId, host, app, true));
  }
  detailsInFlight = null;
}

function renderResult(
  adapter: JobSiteAdapter,
  jobId: string,
  app: HTMLElement,
  result: EvalResult,
): void {
  const summary = adapter.extractDetailsSummary();
  renderDetailsResult(
    app,
    result,
    { title: summary?.title || '', company: summary?.company || '' },
    {
      onRerun: () => {
        detailsCache.delete(jobId);
        const host =
          app.getRootNode() instanceof ShadowRoot
            ? ((app.getRootNode() as ShadowRoot).host as HTMLElement)
            : null;
        if (host) void analyzeDetails(adapter, jobId, host, app, true);
      },
      onQuickApply: () => adapter.clickApply?.(),
      onMarkApplied: () => {
        void send({
          type: 'TRACK_APPLY',
          app: {
            company: summary?.company || '',
            title: summary?.title || '',
            url: summary?.url || location.href,
            score: result.overallScore,
            bestResume: result.bestResume,
          },
        });
        app.querySelector('#aj-track')?.replaceChildren(document.createTextNode('Tracked ✓'));
      },
      onDismiss: () => dismissCurrent(),
    },
  );
}

// Mark the current job url dismissed (in-memory + background session) and remove
// the panel host. The × button calls this; the observer then won't re-inject.
function dismissCurrent(): void {
  const key = normalizeUrl(location.href);
  dismissed.add(key);
  checked.add(key);
  void send({ type: 'DISMISS_PANEL', url: location.href });
  removeDetailsHost();
}

// Deliberate user re-open path (popup "Show panel on page"): forget the
// dismissal so the next process() pass injects a fresh panel.
export function clearDismissForCurrent(): void {
  const key = normalizeUrl(location.href);
  dismissed.delete(key);
  checked.delete(key);
  void send({ type: 'CLEAR_DISMISS', url: location.href });
}

export function resetDetailsState(): void {
  detailsInFlight = null;
  detailsRenderedId = null;
}
