// ---------------------------------------------------------------------------
// Thin typed wrappers around chrome.storage.local. Everything RoleReveal persists
// (resumes, settings, tracker, eval cache) lives here and never leaves the
// machine — the only outbound network call is to the LLM provider the user picks.
// ---------------------------------------------------------------------------
import {
  DEFAULT_SETTINGS,
  type Resume,
  type Settings,
  type StorageShape,
  type TrackedApplication,
  type CachedEval,
} from './types';

async function get<K extends keyof StorageShape>(
  key: K,
  fallback: StorageShape[K],
): Promise<StorageShape[K]> {
  const obj = await chrome.storage.local.get(key);
  return (obj[key] as StorageShape[K]) ?? fallback;
}

async function set<K extends keyof StorageShape>(
  key: K,
  value: StorageShape[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// --- Client id --------------------------------------------------------------
// Stable per-install id sent to the backend so it can enforce a per-user daily
// quota without accounts. Not personal data — a random UUID generated locally.
export async function getClientId(): Promise<string> {
  const { clientId } = await chrome.storage.local.get('clientId');
  if (typeof clientId === 'string' && clientId) return clientId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ clientId: id });
  return id;
}

// --- Settings ---------------------------------------------------------------
export async function getSettings(): Promise<Settings> {
  const s = await get('settings', DEFAULT_SETTINGS);
  // Merge so newly-added fields get defaults after an upgrade.
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...s.thresholds },
    overlay: { ...DEFAULT_SETTINGS.overlay, ...s.overlay },
  };
  // Migrate older installs that used provider:'custom' pointed at the bundled
  // proxy — that's now the hidden 'builtin' provider, so the proxy URL never
  // shows in settings.
  if (
    merged.provider === 'custom' &&
    /ai-jobby-backend|rolereveal-backend/.test(merged.customBaseUrl)
  ) {
    merged.provider = 'builtin';
    merged.customBaseUrl = '';
    if (merged.model === 'auto') merged.model = '';
  }
  return merged;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await set('settings', next);
  return next;
}

// --- Resumes ----------------------------------------------------------------
export async function getResumes(): Promise<Resume[]> {
  return get('resumes', []);
}

export async function saveResumes(resumes: Resume[]): Promise<void> {
  await set('resumes', resumes);
}

export async function getEnabledResumes(): Promise<Resume[]> {
  return (await getResumes()).filter((r) => r.enabled && r.text.trim().length > 0);
}

export async function getDefaultResumeId(): Promise<string | null> {
  return (await getSettings()).defaultResumeId;
}

export async function setDefaultResumeId(id: string | null): Promise<void> {
  await saveSettings({ defaultResumeId: id });
}

/**
 * Repair the default-résumé selection so the extension never stalls on a missing
 * or stale default. Returns the usable default résumé, or null when the user
 * genuinely must choose (multiple enabled, none selected) or add one (none).
 * Pure-ish: only writes when it can auto-resolve. Run on startup, when options
 * load, before analysis, and whenever résumés/enabled state change.
 */
export async function ensureDefaultResume(): Promise<Resume | null> {
  const enabled = await getEnabledResumes();
  const defaultId = await getDefaultResumeId();
  const current = enabled.find((r) => r.id === defaultId);
  if (current) return current;

  // Exactly one usable résumé → make it the default automatically.
  if (enabled.length === 1) {
    await setDefaultResumeId(enabled[0].id);
    return enabled[0];
  }
  // Default points at a deleted/disabled résumé → clear the stale id.
  if (defaultId) await setDefaultResumeId(null);
  return null; // 0 enabled (setup) or >1 with none chosen (chooser)
}

// --- Tracker ----------------------------------------------------------------
export async function getTracker(): Promise<TrackedApplication[]> {
  return get('tracker', []);
}

export async function saveTracker(rows: TrackedApplication[]): Promise<void> {
  await set('tracker', rows);
}

// --- Eval cache (keyed by JD+resume hash so re-visits do not re-bill) --------
export async function getCache(): Promise<Record<string, CachedEval>> {
  return get('evalCache', {});
}

export async function readCache(hash: string): Promise<CachedEval | undefined> {
  return (await getCache())[hash];
}

export async function writeCache(entry: CachedEval): Promise<void> {
  const cache = await getCache();
  cache[entry.hash] = entry;
  // Keep the cache bounded: drop oldest beyond 200 entries.
  const entries = Object.values(cache).sort((a, b) => b.createdAt - a.createdAt);
  const trimmed = entries.slice(0, 200);
  const next: Record<string, CachedEval> = {};
  for (const e of trimmed) next[e.hash] = e;
  await set('evalCache', next);
}

export async function clearCache(): Promise<void> {
  await set('evalCache', {});
}
