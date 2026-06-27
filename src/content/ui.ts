import type { EvalResult, JobSummary } from '../lib/types';
import type { DeterministicSignals } from './deterministic';

export const ROOT_ATTR = 'data-job-extension-root';

// Extension logo, loadable inside the injected panel (icons/* is web-accessible).
const LOGO_URL = chrome.runtime.getURL('icons/icon48.png');

export function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 45) return '#d97706';
  return '#dc2626';
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Distinct dark + neon-lime theme so the widget clearly reads as the extension
// and stands out against the host site (never mistaken for native UI).
const BASE_CSS = `
  :host { all: initial; display: block; width: 100%; box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  *, *::before, *::after { box-sizing: border-box; }
  .aj { position:relative; overflow:hidden; background:#0b0b0d; color:#e8e8ea; border-radius:14px;
    border:1px solid rgba(204,255,0,.35);
    box-shadow:0 0 0 1px rgba(204,255,0,.12), 0 16px 44px rgba(0,0,0,.5); }
  .aj::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px;
    background:linear-gradient(180deg,#CCFF00,#DFFF00,#FFFF00); }
  .brand { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800;
    letter-spacing:.09em; text-transform:uppercase; color:#CCFF00; margin-bottom:8px; }
  .mk { width:16px; height:16px; border-radius:4px; display:inline-block; vertical-align:middle; }
  .muted { color:#9aa0a6; }
  .row { display:flex; align-items:center; gap:8px; }
  .chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600;
    padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.14);
    background:rgba(255,255,255,.04); color:#d4d4d8; }
  .chip.ok { background:rgba(204,255,0,.14); border-color:rgba(204,255,0,.5); color:#CCFF00; }
  .chip.bad { background:rgba(239,68,68,.16); border-color:rgba(239,68,68,.5); color:#fca5a5; }
  .chip.warn { background:rgba(234,179,8,.16); border-color:rgba(234,179,8,.5); color:#fde047; }
  .btn { font:inherit; font-size:12px; font-weight:700; cursor:pointer; border-radius:9px;
    border:1px solid rgba(255,255,255,.18); background:transparent; color:#e8e8ea; padding:6px 11px; }
  .btn:hover { border-color:rgba(204,255,0,.6); }
  .btn.primary { background:#CCFF00; color:#0b0b0d; border-color:#CCFF00; }
  .badge { flex:0 0 auto; width:50px; height:50px; border-radius:50%; display:grid; place-items:center;
    color:#0b0b0d; font-weight:800; font-size:18px; box-shadow:0 0 18px rgba(0,0,0,.4); }
  h4 { margin:0 0 6px; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#CCFF00; }
`;

const CARD_CSS = BASE_CSS + `
  .aj { margin:6px 8px 10px; padding:8px 10px 8px 14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .dot { font-size:13px; }
  .est { font-weight:800; font-size:13px; }
`;

const DETAILS_CSS = BASE_CSS + `
  .aj { margin:10px 0; padding:12px 14px 14px 18px; }
  .head { display:flex; gap:12px; align-items:flex-start; }
  .verdict { font-size:18px; font-weight:800; }
  .summary { font-size:13px; line-height:1.45; margin-top:2px; color:#d4d4d8; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .sec { margin-top:12px; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  .skel { background:linear-gradient(90deg,#17171a,#26262b,#17171a); background-size:200% 100%;
    animation:sh 1.2s infinite; border-radius:6px; height:12px; }
  @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .iconbtn { border:none; background:transparent; cursor:pointer; font-size:14px; color:#9aa0a6; padding:2px 6px; }
  .iconbtn:hover { color:#CCFF00; }
`;

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

export function appOf(host: HTMLElement): HTMLElement {
  return host.shadowRoot!.getElementById('app')!;
}

// ── Card strip (list) ──────────────────────────────────────────────────────
export function renderCardPanel(
  app: HTMLElement,
  est: number,
  signals: DeterministicSignals,
): void {
  const chips: string[] = [];
  if (signals.workMode) chips.push(`<span class="chip">${signals.workMode}</span>`);
  if (signals.salary) chips.push(`<span class="chip">${esc(signals.salary)}</span>`);
  if (signals.sponsorship === 'none')
    chips.push(`<span class="chip bad">No sponsorship</span>`);
  else if (signals.sponsorship === 'citizenship')
    chips.push(`<span class="chip warn">Citizenship/clearance</span>`);
  else if (signals.sponsorship === 'available')
    chips.push(`<span class="chip ok">Sponsorship</span>`);

  app.innerHTML = `
    <div class="aj">
      <img class="mk" src="${LOGO_URL}" alt="">
      <span class="est" style="color:${scoreColor(est)}" title="Quick estimate — open the job for the full AI score">~${est}% est.</span>
      <span class="chips">${chips.join('')}</span>
    </div>`;
}

// ── Details panel (selected job) ───────────────────────────────────────────
export function renderDetailsSkeleton(app: HTMLElement, summary: JobSummary | null): void {
  app.innerHTML = `
    <div class="aj">
      <div class="brand"><img class="mk" src="${LOGO_URL}" alt=""> RoleReveal</div>
      <div class="head">
        <div class="badge skel" style="background:#26262b"></div>
        <div style="flex:1">
          <div class="skel" style="width:40%"></div>
          <div class="skel" style="width:80%;margin-top:8px"></div>
          <div class="skel" style="width:60%;margin-top:8px"></div>
        </div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">Analyzing ${esc(summary?.title || 'this role')} against your resume…</div>
    </div>`;
}

export interface DetailsHandlers {
  onRerun: () => void;
  onQuickApply: () => void;
  onMarkApplied: () => void;
  onToggle: () => void;
}

export function renderDetailsResult(
  app: HTMLElement,
  result: EvalResult,
  signals: DeterministicSignals,
  handlers: DetailsHandlers,
  expanded: boolean,
): void {
  const color = scoreColor(result.overallScore);
  const qualChip = (name: string, have: boolean) =>
    `<span class="chip ${have ? 'ok' : ''}">${have ? '✓' : '○'} ${esc(name)}</span>`;

  const sponsorChip =
    signals.sponsorship === 'none'
      ? '<span class="chip bad">No sponsorship</span>'
      : signals.sponsorship === 'citizenship'
        ? '<span class="chip warn">Citizenship / clearance required</span>'
        : signals.sponsorship === 'available'
          ? '<span class="chip ok">Sponsorship available</span>'
          : '';

  const section = (title: string, body: string) =>
    body ? `<div class="sec"><h4>${title}</h4>${body}</div>` : '';

  const details = expanded
    ? `
      ${section(
        'Required qualifications',
        result.requiredQualifications.length
          ? `<div class="chips">${result.requiredQualifications.map((q) => qualChip(q.name, q.have)).join('')}</div>`
          : '',
      )}
      ${section(
        'Nice-to-have',
        result.optionalQualifications.length
          ? `<div class="chips">${result.optionalQualifications.map((q) => qualChip(q.name, q.have)).join('')}</div>`
          : '',
      )}
      ${section(
        'Matching skills',
        result.matchedSkills.length
          ? `<div class="chips">${result.matchedSkills.map((s) => `<span class="chip ok">${esc(s)}</span>`).join('')}</div>`
          : '',
      )}
      ${section(
        'Missing skills',
        result.missingSkills.length
          ? `<div class="chips">${result.missingSkills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>`
          : '',
      )}
      <div class="muted" style="font-size:10px;margin-top:8px;line-height:1.4">
        AI estimate — informational only, not legal, immigration, or career advice.
        Verify eligibility and details with the employer.
      </div>`
    : '';

  app.innerHTML = `
    <div class="aj">
      <div class="brand"><img class="mk" src="${LOGO_URL}" alt=""> RoleReveal</div>
      <div class="head">
        <div class="badge" style="background:${color}">${result.overallScore}</div>
        <div style="flex:1">
          <div class="verdict" style="color:${color}">${result.verdict}</div>
          <div class="summary">${esc(result.summary)}</div>
          <div class="muted" style="font-size:11px;margin-top:3px">Best resume: ${esc(result.bestResume)}</div>
        </div>
        <button class="iconbtn" id="aj-rerun" title="Re-run">↻</button>
      </div>

      ${
        sponsorChip || signals.workMode || signals.salary
          ? `<div class="chips" style="margin-top:10px">
              ${sponsorChip}
              ${signals.workMode ? `<span class="chip">${signals.workMode}</span>` : ''}
              ${signals.salary ? `<span class="chip">${esc(signals.salary)}</span>` : ''}
            </div>`
          : ''
      }

      <div class="actions">
        <button class="btn" id="aj-toggle">${expanded ? 'Hide match details' : 'Show match details'}</button>
        <button class="btn primary" id="aj-apply">Apply on site →</button>
        <button class="btn" id="aj-track">Mark applied</button>
      </div>

      ${details}
    </div>`;

  app.querySelector('#aj-rerun')?.addEventListener('click', handlers.onRerun);
  app.querySelector('#aj-toggle')?.addEventListener('click', handlers.onToggle);
  app.querySelector('#aj-apply')?.addEventListener('click', handlers.onQuickApply);
  app.querySelector('#aj-track')?.addEventListener('click', handlers.onMarkApplied);
}

export function renderDetailsError(app: HTMLElement, message: string, onRetry: () => void): void {
  app.innerHTML = `
    <div class="aj">
      <div class="muted" style="font-size:12px">Couldn't analyze this job: ${esc(message)}</div>
      <div class="actions"><button class="btn" id="aj-retry">Retry</button></div>
    </div>`;
  app.querySelector('#aj-retry')?.addEventListener('click', onRetry);
}
