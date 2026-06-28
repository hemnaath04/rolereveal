// ---------------------------------------------------------------------------
// Content entry. Picks a site adapter, watches the results list + selected job,
// and injects extension UI inline (card strips in the list, an analysis panel
// under the apply area). Everything is idempotent and wrapped so a failure can
// never break the host site.
// ---------------------------------------------------------------------------
import { activeAdapter } from './adapters';
import { createObserver } from './observer';
import { onRouteChange } from './navigation';
import {
  clearDismissForCurrent,
  processSelectedJobDetails,
  processVisibleJobCards,
  resetDetailsState,
  setResumeText,
} from './injector';
import { getEnabledResumes } from '../lib/storage';
import { extractJob } from '../lib/jd-extract';
import type { JobContext } from '../lib/types';

// Single-init guard: crxjs / SPA re-injection can run this module more than once.
// Bail on the second run so we never create duplicate listeners, observers,
// route-change timers, or panel roots.
declare global {
  interface Window {
    __roleRevealInit?: boolean;
  }
}
if (window.__roleRevealInit) {
  // Already initialised in this frame — do nothing.
} else {
  window.__roleRevealInit = true;
  init();
}

function init(): void {
  // Popup "Evaluate current tab" reads the JD from here; OPEN_PANEL re-opens a
  // dismissed panel.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PING_CONTENT') {
      // Lets the popup detect whether the content script is already present
      // before injecting it on demand (activeTab + scripting).
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === 'GET_JOB') {
      const adapter = activeAdapter();
      const jd = adapter?.extractFullJobDescription();
      if (adapter && jd) {
        const s = adapter.extractDetailsSummary();
        const job: JobContext = {
          url: s?.url || location.href,
          title: s?.title || '',
          company: s?.company || '',
          jdText: jd,
          detection: 'clean',
          site: adapter.site,
        };
        sendResponse(job);
      } else {
        sendResponse(extractJob());
      }
      return true;
    }
    if (msg?.type === 'OPEN_PANEL') {
      // Deliberate user re-open: forget the dismissal and re-inject.
      clearDismissForCurrent();
      process();
      sendResponse({ ok: true });
      return true;
    }
    return undefined;
  });

  void main();
}

function process() {
  try {
    // Re-pick each pass so SPA navigation between a job page and a non-job page
    // (or between sites' routes) is handled without a reload.
    const adapter = activeAdapter();
    if (!adapter) return;
    processVisibleJobCards(adapter);
    processSelectedJobDetails(adapter);
  } catch (err) {
    // Never break the host page.
    console.error('[RoleReveal] process failed', err);
  }
}

async function main() {
  if (window.top !== window.self) return; // top frame only

  try {
    const resumes = await getEnabledResumes();
    setResumeText(resumes.map((r) => r.text).join('\n'));
  } catch {
    /* resume text is only for the local estimate */
  }

  const observer = createObserver(process, 150);
  observer.reconnect(document.body);

  onRouteChange(() => {
    resetDetailsState();
    process();
  });

  // Initial passes (the page may still be rendering at document_idle).
  process();
  window.setTimeout(process, 800);
  window.setTimeout(process, 2000);
}
