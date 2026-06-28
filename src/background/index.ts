// ---------------------------------------------------------------------------
// Background service worker. The ONLY place that holds the API key and makes LLM
// network calls. Content script / popup talk to it via chrome.runtime messages.
// ---------------------------------------------------------------------------
import { chatComplete, extractJson } from '../lib/llm';
import { redactResume } from '../lib/redact';
import {
  buildEvalUserPrompt,
  EVAL_SYSTEM_PROMPT,
  buildTailorUserPrompt,
  TAILOR_SYSTEM_PROMPT,
} from '../lib/prompts';
import { normalizeResult } from '../lib/scoring';
import {
  getClientId,
  getEnabledResumes,
  getResumes,
  getSettings,
  readCache,
  writeCache,
} from '../lib/storage';
import { evalCacheKey } from '../lib/hash';
import { addApplication } from '../lib/tracker';
import { normalizeUrl } from '../lib/url';
import type {
  EvaluateResponse,
  IsDismissedResponse,
  Message,
  TailorResponse,
} from '../lib/types';

// ── Per-tab dismissed-panel registry (chrome.storage.session) ────────────────
// Content scripts can't read chrome.storage.session, so dismissal state lives
// here and is queried over messages. Keyed `dismissed:<tabId>` → string[] of
// normalizeUrl(url).
const dismissKey = (tabId: number): string => `dismissed:${tabId}`;

async function getDismissed(tabId: number): Promise<string[]> {
  const key = dismissKey(tabId);
  const store = await chrome.storage.session.get(key);
  const value = store[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

async function addDismissed(tabId: number, url: string): Promise<void> {
  const norm = normalizeUrl(url);
  const list = await getDismissed(tabId);
  if (!list.includes(norm)) list.push(norm);
  await chrome.storage.session.set({ [dismissKey(tabId)]: list });
}

async function removeDismissed(tabId: number, url: string): Promise<void> {
  const norm = normalizeUrl(url);
  const list = (await getDismissed(tabId)).filter((u) => u !== norm);
  await chrome.storage.session.set({ [dismissKey(tabId)]: list });
}

// Drop a tab's dismissal list when it closes so the session store doesn't grow.
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(dismissKey(tabId));
});

// Fingerprint of the resumes in play so editing a resume invalidates the cache.
function resumeFingerprint(
  resumes: { id: string; updatedAt: number }[],
): string {
  return resumes
    .map((r) => `${r.id}:${r.updatedAt}`)
    .sort()
    .join('|');
}

async function handleEvaluate(
  msg: Extract<Message, { type: 'EVALUATE' }>,
): Promise<EvaluateResponse> {
  const settings = await getSettings();
  const resumes = await getEnabledResumes();
  if (resumes.length === 0) {
    return { ok: false, error: 'No enabled resumes. Add one in RoleReveal options.' };
  }
  if (msg.job.jdText.trim().length < 80) {
    return {
      ok: false,
      error: 'Job description looks too short. Use "Select text" or "Paste JD".',
    };
  }

  const key = evalCacheKey(msg.job.jdText, resumeFingerprint(resumes));
  if (!msg.force) {
    const cached = await readCache(key);
    if (cached) return { ok: true, result: cached.result, cached: true };
  }

  // Mask personal data before it leaves the device (default on). The full
  // resume stays in local storage; only the redacted copy is sent.
  const sendResumes =
    settings.redactPii === false
      ? resumes
      : resumes.map((r) => ({ ...r, text: redactResume(r.text) }));

  try {
    const raw = await chatComplete(settings, {
      system: EVAL_SYSTEM_PROMPT,
      user: buildEvalUserPrompt(msg.job.jdText, sendResumes),
      temperature: 0.2,
      maxTokens: 900,
      jsonMode: true,
      clientId: await getClientId(),
    });
    const parsed = extractJson<any>(raw);
    const result = normalizeResult(parsed, settings);
    // Map the LLM's generic "Resume N" labels back to the user's real labels.
    const realLabel = (lbl: string): string => {
      const m = lbl.match(/Resume\s+(\d+)/i);
      const idx = m ? Number(m[1]) - 1 : -1;
      return resumes[idx]?.label ?? lbl;
    };
    result.perResume = result.perResume.map((pr) => ({ ...pr, label: realLabel(pr.label) }));
    result.bestResume = realLabel(result.bestResume);
    await writeCache({ hash: key, result, createdAt: Date.now() });
    return { ok: true, result, cached: false };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

async function handleTailor(
  msg: Extract<Message, { type: 'TAILOR' }>,
): Promise<TailorResponse> {
  const settings = await getSettings();
  const resumes = await getResumes();
  const resume =
    resumes.find((r) => r.label === msg.resumeLabel) ??
    (await getEnabledResumes())[0];
  if (!resume) return { ok: false, error: 'Resume not found.' };

  try {
    const text = await chatComplete(settings, {
      system: TAILOR_SYSTEM_PROMPT,
      user: buildTailorUserPrompt(msg.job.jdText, resume.text),
      temperature: 0.3,
      maxTokens: 2200,
    });
    return { ok: true, text: text.trim() };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Central message router. Returning true keeps the sendResponse channel open
// for the async work above.
chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'PING':
        sendResponse({ ok: true });
        break;
      case 'GET_SETTINGS':
        sendResponse(await getSettings());
        break;
      case 'GET_RESUMES':
        sendResponse(await getResumes());
        break;
      case 'EVALUATE':
        sendResponse(await handleEvaluate(msg));
        break;
      case 'TAILOR':
        sendResponse(await handleTailor(msg));
        break;
      case 'TRACK_APPLY':
        sendResponse({ ok: true, tracker: await addApplication(msg.app) });
        break;
      case 'DISMISS_PANEL': {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) await addDismissed(tabId, msg.url);
        sendResponse({ ok: true });
        break;
      }
      case 'IS_DISMISSED': {
        const tabId = sender.tab?.id;
        const list = tabId !== undefined ? await getDismissed(tabId) : [];
        const res: IsDismissedResponse = { dismissed: list.includes(normalizeUrl(msg.url)) };
        sendResponse(res);
        break;
      }
      case 'CLEAR_DISMISS': {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) await removeDismissed(tabId, msg.url);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message' });
    }
  })();
  return true; // async response
});

// Right-click → "RoleReveal: evaluate selected text as JD" fallback for sites
// where auto-detection fails.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rolereveal-eval-selection',
    title: 'RoleReveal: evaluate selected text as JD',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rolereveal-eval-selection' && tab?.id && info.selectionText) {
    const tabId = tab.id;
    const text = info.selectionText;
    void (async () => {
      // The content script may not be auto-injected on this site — inject it on
      // demand (the right-click is a user gesture that grants activeTab).
      const present = await chrome.tabs
        .sendMessage(tabId, { type: 'PING_CONTENT' })
        .then(() => true)
        .catch(() => false);
      if (!present) {
        const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
        if (files.length) {
          try {
            await chrome.scripting.executeScript({ target: { tabId }, files });
            await new Promise((r) => setTimeout(r, 300));
          } catch {
            return;
          }
        }
      }
      chrome.tabs.sendMessage(tabId, { type: 'EVAL_SELECTION', text }).catch(() => null);
    })();
  }
});
