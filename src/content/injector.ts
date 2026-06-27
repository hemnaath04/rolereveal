import type { JobSiteAdapter } from './adapters/types';
import type { EvalResult, EvaluateResponse, JobContext } from '../lib/types';
import { deterministicSignals, quickLocalScore } from './deterministic';
import {
  ROOT_ATTR,
  appOf,
  createShadowHost,
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
export function processSelectedJobDetails(adapter: JobSiteAdapter): void {
  const panel = adapter.findDetailsPanel();
  if (!panel) return;
  const jobId = adapter.findDetailsJobId();
  if (!jobId) return;
  const insertion = adapter.findDetailsInsertionPoint(panel);
  if (!insertion || !insertion.parentElement) return;

  const existing = panel.querySelector<HTMLElement>(`[${ROOT_ATTR}="details"]`);
  if (existing && existing.dataset.jobId === jobId && existing.isConnected) return;
  existing?.remove();

  const host = createShadowHost(jobId, 'details');
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

  const jd = adapter.extractFullJobDescription();
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
  const signals = deterministicSignals(adapter.extractFullJobDescription() || '');
  let expanded = false; // collapsed by default — details behind "Show match details"

  const draw = () =>
    renderDetailsResult(app, result, signals, {
      onRerun: () => {
        detailsCache.delete(jobId);
        const host =
          app.getRootNode() instanceof ShadowRoot
            ? ((app.getRootNode() as ShadowRoot).host as HTMLElement)
            : null;
        if (host) void analyzeDetails(adapter, jobId, host, app, true);
      },
      onToggle: () => {
        expanded = !expanded;
        draw();
      },
      onQuickApply: () => adapter.clickApply?.(),
      onMarkApplied: () => {
        const summary = adapter.extractDetailsSummary();
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
    }, expanded);

  draw();
}

export function resetDetailsState(): void {
  detailsInFlight = null;
  detailsRenderedId = null;
}
