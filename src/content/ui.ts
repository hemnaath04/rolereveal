import type { EvalResult, JobSummary } from '../lib/types';
import type { DeterministicSignals } from './deterministic';

export const ROOT_ATTR = 'data-job-extension-root';
const LOGO_URL = chrome.runtime.getURL('icons/icon48.png');
const CIRC = 327; // 2πr for r=52

export function scoreColor(score: number): string {
  if (score >= 70) return '#9be870';
  if (score >= 45) return '#FFB45C';
  return '#FF7B8B';
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// RoleReveal brand card — dark navy, purple→teal gradients, lime "fit" badge.
const BASE_CSS = `
  :host { all: initial; display: block; width: 100%; box-sizing: border-box;
    font-family: 'Sora', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  *, *::before, *::after { box-sizing: border-box; }
  .aj { position:relative; overflow:hidden; background:#14101F; color:#fff; border-radius:16px;
    border:1px solid rgba(255,255,255,.09); box-shadow:0 18px 44px rgba(0,0,0,.5); }
  .muted { color:#BDB6CE; }
  .iconbtn { border:none; background:transparent; cursor:pointer; font-size:15px; color:#8E8799; padding:2px 6px; line-height:1; }
  .iconbtn:hover { color:#fff; }
`;

const CARD_CSS = BASE_CSS + `
  .aj { margin:6px 8px 10px; padding:8px 10px 8px 12px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .dot { width:8px; height:8px; border-radius:3px; background:linear-gradient(135deg,#7B61FF,#18D6B8); }
  .est { font-weight:800; font-size:13px; }
  .chip { font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
    border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05); color:#cfc8de; }
  .chip.bad{ background:rgba(255,123,139,.16); border-color:rgba(255,123,139,.4); color:#FF7B8B; }
  .chip.warn{ background:rgba(255,180,92,.16); border-color:rgba(255,180,92,.4); color:#FFB45C; }
  .chip.ok{ background:rgba(24,214,184,.16); border-color:rgba(24,214,184,.4); color:#43D6C5; }
`;

const DETAILS_CSS = BASE_CSS + `
  .aj { margin:10px 0; padding:16px 18px; }
  .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .brand { display:flex; align-items:center; gap:7px; font-weight:800; font-size:12px; letter-spacing:.03em; }
  .brand img { width:16px; height:16px; border-radius:4px; }
  .top { display:flex; align-items:center; gap:16px; }
  .donut { position:relative; display:grid; place-items:center; flex:0 0 auto; }
  .donut svg { transform:rotate(-90deg); }
  .ring-track { fill:none; stroke:rgba(255,255,255,.12); stroke-width:9; }
  .ring-prog { fill:none; stroke:url(#rrGrad); stroke-width:9; stroke-linecap:round;
    stroke-dasharray:${CIRC}; stroke-dashoffset:${CIRC};
    transition:stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1); }
  .donut-num { position:absolute; font-weight:800; font-size:26px; }
  .meta { display:flex; flex-direction:column; gap:7px; min-width:0; }
  .badge { align-self:flex-start; font-size:11px; font-weight:700; letter-spacing:.05em;
    text-transform:uppercase; padding:5px 11px; border-radius:999px; }
  .badge.strong { background:#EAF9C4; color:#5b6b12; }
  .badge.partial { background:rgba(255,180,92,.18); color:#FFB45C; }
  .badge.low { background:rgba(255,123,139,.18); color:#FF7B8B; }
  .title { font-size:13.5px; color:#D8D1E7; line-height:1.35; }
  .bars { margin-top:16px; display:flex; flex-direction:column; gap:11px; }
  .bar-row { display:grid; grid-template-columns:104px 1fr 46px; align-items:center; gap:12px; font-size:13px; color:#BDB6CE; }
  .bar-row b { color:#fff; text-align:right; }
  .bar { height:8px; border-radius:999px; background:rgba(255,255,255,.1); overflow:hidden; }
  .bar i { display:block; height:100%; width:0; border-radius:999px;
    background:linear-gradient(90deg,#7B61FF,#35A7FF,#18D6B8); transition:width 1.1s cubic-bezier(.2,.8,.2,1); }
  .notes { margin-top:15px; display:flex; flex-direction:column; gap:9px; font-size:13px; color:#BDB6CE; line-height:1.5; }
  .tag { display:inline-block; font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:7px; margin-right:7px; }
  .tag.good { background:rgba(24,214,184,.16); color:#43D6C5; }
  .tag.warn { background:rgba(255,180,92,.16); color:#FFB45C; }
  .actions { display:flex; gap:8px; margin-top:16px; }
  .btn { font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; border-radius:10px;
    border:1px solid rgba(255,255,255,.16); background:transparent; color:#fff; padding:8px 13px; transition:transform .15s; }
  .btn:hover { transform:translateY(-1px); }
  .btn.primary { background:linear-gradient(135deg,#7B61FF,#35A7FF); border-color:transparent; }
  .skel { background:linear-gradient(90deg,#1b1626,#2a2338,#1b1626); background-size:200% 100%;
    animation:sh 1.2s infinite; border-radius:8px; height:12px; }
  @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .spinner { width:52px; height:52px; border-radius:50%;
    border:4px solid rgba(255,255,255,.14); border-top-color:#9b8cff;
    animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg) } }
  .badge.loading { background:rgba(155,140,255,.18); color:#b9aaff; }
  .bar i.pulse { width:30%; background:linear-gradient(90deg,#7B61FF,#35A7FF,#18D6B8);
    animation:loadbar 1.15s ease-in-out infinite; }
  @keyframes loadbar { 0%{width:12%} 50%{width:88%} 100%{width:12%} }
  .load-note { font-size:11.5px; margin-top:14px; line-height:1.5; }
`;

// Per-card hosts (LinkedIn list strips) — there are many of these, one per card.
export function createShadowHost(jobId: string, kind: 'card' | 'details'): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute(ROOT_ATTR, kind);
  host.dataset.jobId = jobId;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = kind === 'card' ? CARD_CSS : DETAILS_CSS;
  shadow.appendChild(style);
  const app = document.createElement('div');
  app.id = 'app';
  shadow.appendChild(app);
  return host;
}

// The ONE details-panel root id for the whole tab.
export const DETAILS_ROOT_ID = 'role-reveal-extension-root';

/**
 * Atomically get the single details root. If it already exists — from a
 * re-injection race, an SPA tick, or even a second content-script instance (the
 * DOM is shared between isolated worlds) — reuse it; never create a second. Any
 * accidental extras are removed so the page always has zero or one root. This is
 * the fix for the duplicate-panel bug: the dedupe is global-by-id, not scoped to
 * a subtree the host might be inserted outside of.
 */
export function getOrCreateDetailsHost(): HTMLElement {
  const all = document.querySelectorAll<HTMLElement>(`#${DETAILS_ROOT_ID}`);
  if (all.length) {
    for (let i = 1; i < all.length; i++) all[i].remove(); // keep only the first
    return all[0];
  }
  const host = document.createElement('div');
  host.id = DETAILS_ROOT_ID;
  host.setAttribute(ROOT_ATTR, 'details');
  host.dataset.owner = chrome.runtime.id;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = DETAILS_CSS;
  shadow.appendChild(style);
  const app = document.createElement('div');
  app.id = 'app';
  shadow.appendChild(app);
  return host;
}

/** The current single details root, if mounted. */
export function detailsHost(): HTMLElement | null {
  return document.getElementById(DETAILS_ROOT_ID);
}

/** Remove the details root (and any stray extras). Used on dismiss / leaving a job. */
export function removeDetailsHost(): void {
  document.querySelectorAll(`#${DETAILS_ROOT_ID}`).forEach((el) => el.remove());
}

export function appOf(host: HTMLElement): HTMLElement {
  return host.shadowRoot!.getElementById('app')!;
}

// ── Card strip (list) ──────────────────────────────────────────────────────
export function renderCardPanel(app: HTMLElement, est: number, signals: DeterministicSignals): void {
  const chips: string[] = [];
  if (signals.workMode) chips.push(`<span class="chip">${signals.workMode}</span>`);
  if (signals.salary) chips.push(`<span class="chip">${esc(signals.salary)}</span>`);
  if (signals.sponsorship === 'none') chips.push(`<span class="chip bad">No sponsorship</span>`);
  else if (signals.sponsorship === 'citizenship') chips.push(`<span class="chip warn">Citizenship/clearance</span>`);
  else if (signals.sponsorship === 'available') chips.push(`<span class="chip ok">Sponsorship</span>`);

  app.innerHTML = `
    <div class="aj">
      <span class="dot"></span>
      <span class="est" style="color:${scoreColor(est)}" title="Quick estimate — open the job for the full score">~${est}% est.</span>
      <span style="display:flex;gap:6px;flex-wrap:wrap">${chips.join('')}</span>
    </div>`;
}

// ── Details panel (selected job) ───────────────────────────────────────────
export function renderDetailsSkeleton(app: HTMLElement, summary: JobSummary | null): void {
  const what = summary?.title ? esc(summary.title) : 'this role';
  const loadingBar = (label: string) =>
    `<div class="bar-row"><span>${label}</span><div class="bar"><i class="pulse"></i></div><b class="muted">…</b></div>`;
  app.innerHTML = `
    <div class="aj">
      <div class="head"><span class="brand"><img src="${LOGO_URL}" alt=""> RoleReveal</span></div>
      <div class="top">
        <div class="donut" style="width:92px;height:92px"><div class="spinner"></div></div>
        <div class="meta">
          <span class="badge loading">Analyzing…</span>
          <div class="title">Scoring ${what} against your resume</div>
        </div>
      </div>
      <div class="bars">
        ${loadingBar('Skills')}
        ${loadingBar('Experience')}
        ${loadingBar('Role context')}
      </div>
      <div class="muted load-note">Reading the job description and comparing it with your resume — this usually takes a few seconds.</div>
    </div>`;
}

export interface DetailsHandlers {
  onRerun: () => void;
  onQuickApply: () => void;
  onMarkApplied: () => void;
  onDismiss: () => void;
}

const FIT = {
  Apply: { label: 'Strong fit', cls: 'strong' },
  Maybe: { label: 'Partial fit', cls: 'partial' },
  Skip: { label: 'Low fit', cls: 'low' },
} as const;

export function renderDetailsResult(
  app: HTMLElement,
  result: EvalResult,
  job: { title: string; company: string },
  handlers: DetailsHandlers,
): void {
  const fit = FIT[result.verdict];
  // Guard against older cached results that predate the dimensions field.
  const dims = result.dimensions ?? {
    skills: result.overallScore,
    experience: result.overallScore,
    roleContext: result.overallScore,
  };
  const titleLine = [job.title, job.company].filter(Boolean).join(' · ') || 'This role';
  const bar = (label: string, val: number) =>
    `<div class="bar-row"><span>${label}</span><div class="bar"><i data-w="${val}"></i></div><b>${val}%</b></div>`;

  app.innerHTML = `
    <div class="aj">
      <div class="head">
        <span class="brand"><img src="${LOGO_URL}" alt=""> RoleReveal</span>
        <span>
          <button class="iconbtn" id="aj-rerun" title="Re-run">↻</button>
          <button class="iconbtn" id="aj-x" title="Dismiss">×</button>
        </span>
      </div>

      <div class="top">
        <div class="donut">
          <svg viewBox="0 0 120 120" width="92" height="92">
            <defs><linearGradient id="rrGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#7B61FF"/><stop offset="1" stop-color="#18D6B8"/>
            </linearGradient></defs>
            <circle class="ring-track" cx="60" cy="60" r="52"/>
            <circle class="ring-prog" cx="60" cy="60" r="52"/>
          </svg>
          <div class="donut-num" id="aj-num">0</div>
        </div>
        <div class="meta">
          <span class="badge ${fit.cls}">${fit.label}</span>
          <div class="title">${esc(titleLine)}</div>
        </div>
      </div>

      <div class="bars">
        ${bar('Skills', dims.skills)}
        ${bar('Experience', dims.experience)}
        ${bar('Role context', dims.roleContext)}
      </div>

      <div class="notes">
        ${result.whyMatch ? `<div><span class="tag good">Why you match</span>${esc(result.whyMatch)}</div>` : ''}
        ${result.watchOuts ? `<div><span class="tag warn">Watch-outs</span>${esc(result.watchOuts)}</div>` : ''}
      </div>

      <div class="actions">
        <button class="btn primary" id="aj-apply">Apply on site →</button>
        <button class="btn" id="aj-track">Mark applied</button>
      </div>
    </div>`;

  // Animate donut, number, and bars on the next frame.
  const ring = app.querySelector<SVGCircleElement>('.ring-prog');
  requestAnimationFrame(() => {
    if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - result.overallScore / 100));
    app.querySelectorAll<HTMLElement>('.bar i').forEach((i) => {
      i.style.width = `${i.dataset.w}%`;
    });
  });
  countUp(app.querySelector('#aj-num'), result.overallScore);

  app.querySelector('#aj-rerun')?.addEventListener('click', handlers.onRerun);
  app.querySelector('#aj-apply')?.addEventListener('click', handlers.onQuickApply);
  app.querySelector('#aj-track')?.addEventListener('click', handlers.onMarkApplied);
  // Dismissal removal + persistence is owned by injector's onDismiss, so the
  // observer can't re-inject the panel the user just closed.
  app.querySelector('#aj-x')?.addEventListener('click', handlers.onDismiss);
}

function countUp(el: Element | null, to: number): void {
  if (!el) return;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / 1200);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function renderDetailsError(app: HTMLElement, message: string, onRetry: () => void): void {
  app.innerHTML = `
    <div class="aj">
      <div class="head"><span class="brand"><img src="${LOGO_URL}" alt=""> RoleReveal</span></div>
      <div class="muted" style="font-size:12.5px">Couldn't score this job: ${esc(message)}</div>
      <div class="actions"><button class="btn" id="aj-retry">Retry</button></div>
    </div>`;
  app.querySelector('#aj-retry')?.addEventListener('click', onRetry);
}
