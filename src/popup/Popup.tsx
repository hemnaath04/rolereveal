import React, { useEffect, useState } from 'react';
import type {
  EvalResult,
  EvaluateResponse,
  JobContext,
  Settings,
  TrackedApplication,
} from '../lib/types';
import { colorForScore } from '../lib/scoring';
import { getProvider } from '../lib/providers';
import { getSettings, getTracker } from '../lib/storage';
import { downloadCsv, removeApplication, updateStatus } from '../lib/tracker';

const send = <T,>(msg: unknown): Promise<T> =>
  chrome.runtime.sendMessage(msg) as Promise<T>;

// On non-job sites the content script isn't auto-injected, so the popup injects
// it on demand (activeTab grants host access for the active tab on this click).
// No-op if it's already present (major job sites).
async function ensureContentScript(tabId: number): Promise<void> {
  const present = await chrome.tabs
    .sendMessage(tabId, { type: 'PING_CONTENT' })
    .then(() => true)
    .catch(() => false);
  if (present) return;
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  if (!files.length) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
    await new Promise((r) => setTimeout(r, 300)); // let it register its listener
  } catch {
    /* restricted page (chrome://, web store, etc.) — nothing we can do */
  }
}

type Tab = 'score' | 'tracker';

export function Popup() {
  const [tab, setTab] = useState<Tab>('score');
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  return (
    <div className="popup">
      <div className="brand">
        <img className="logo" src={chrome.runtime.getURL('icons/icon48.png')} alt="" />
        <h1>RoleReveal</h1>
        <span className="spacer" />
        <button className="btn ghost small" onClick={() => chrome.runtime.openOptionsPage()}>
          Options
        </button>
      </div>

      <div className="tabs">
        <button className={tab === 'score' ? 'active' : ''} onClick={() => setTab('score')}>Score</button>
        <button className={tab === 'tracker' ? 'active' : ''} onClick={() => setTab('tracker')}>Tracker</button>
      </div>

      {tab === 'score' ? <ScoreTab settings={settings} /> : <TrackerTab />}
    </div>
  );
}

function ScoreTab({ settings }: { settings: Settings | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [job, setJob] = useState<JobContext | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab.');
      // RoleReveal only auto-runs on major job sites; on any other page we inject
      // the content script on demand here (activeTab + scripting, on the click).
      await ensureContentScript(tab.id);
      const j = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB' }).catch(() => null);
      if (!j) throw new Error("Couldn't read this page. Open a job posting and try again.");
      setJob(j);
      const res = await send<EvaluateResponse>({ type: 'EVALUATE', job: j, force: false });
      if (res.ok) { setResult(res.result); setStatus('done'); }
      else { setError(res.error); setStatus('error'); }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus('error');
    }
  };

  const markApplied = async () => {
    if (!result || !job) return;
    await send({
      type: 'TRACK_APPLY',
      app: { company: job.company, title: job.title, url: job.url, score: result.overallScore, bestResume: result.bestResume },
    });
  };

  const showPanelOnPage = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await ensureContentScript(tab.id);
    void chrome.tabs.sendMessage(tab.id, { type: 'OPEN_PANEL' }).catch(() => null);
  };

  const keyMissing = !!settings && getProvider(settings.provider).needsKey && !settings.apiKey;
  const color = result ? colorForScore(result.overallScore, settings?.thresholds ?? { apply: 75, maybe: 55 }) : '#374151';

  return (
    <div className="pad">
      {keyMissing && (
        <div className="err space" style={{ marginTop: 0 }}>
          No API key set. <a onClick={() => chrome.runtime.openOptionsPage()} style={{ cursor: 'pointer' }}>Open options →</a>
        </div>
      )}

      <button className="btn primary" style={{ width: '100%' }} onClick={run} disabled={status === 'loading'}>
        {status === 'loading' ? 'Scoring…' : 'Evaluate current tab'}
      </button>

      <button className="btn ghost small space" style={{ width: '100%' }} onClick={showPanelOnPage}>
        Show panel on page
      </button>

      {status === 'error' && <div className="err space">{error}</div>}

      {status === 'done' && result && job && (
        <div className="space col">
          <div className="card">
            <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              <div className="bigscore" style={{ background: color }}>{result.overallScore}</div>
              <div>
                <div className="verdict" style={{ color }}>{result.verdict}</div>
                <div className="small" style={{ marginTop: 4 }}>{result.summary}</div>
                <div className="small muted" style={{ marginTop: 4 }}>Best: {result.bestResume}</div>
              </div>
            </div>
            <button className="btn primary space" style={{ width: '100%' }} onClick={markApplied}>Mark applied</button>
          </div>
        </div>
      )}

      {status === 'idle' && (
        <p className="small muted space">
          On major job sites the panel auto-scores as you browse. Anywhere else, open a
          posting and hit “Evaluate current tab”.
        </p>
      )}
    </div>
  );
}

function TrackerTab() {
  const [rows, setRows] = useState<TrackedApplication[]>([]);
  useEffect(() => { void getTracker().then(setRows); }, []);

  const setStatus = async (id: string, status: TrackedApplication['status']) =>
    setRows(await updateStatus(id, status));
  const remove = async (id: string) => setRows(await removeApplication(id));

  if (rows.length === 0) {
    return <div className="pad"><p className="small muted">No applications tracked yet. Click “Mark applied” on the overlay or here.</p></div>;
  }

  return (
    <div className="pad">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="small muted">{rows.length} application{rows.length === 1 ? '' : 's'}</span>
        <button className="btn ghost small" onClick={() => downloadCsv(rows)}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr><th>Role</th><th>Score</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <a href={r.url} target="_blank" rel="noreferrer">{r.title || 'Role'}</a>
                <div className="muted small">{r.company} · {new Date(r.date).toLocaleDateString()}</div>
              </td>
              <td>{r.score}</td>
              <td>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as any)} style={{ padding: '3px 5px' }}>
                  <option value="applied">applied</option>
                  <option value="interview">interview</option>
                  <option value="offer">offer</option>
                  <option value="rejected">rejected</option>
                  <option value="withdrawn">withdrawn</option>
                </select>
              </td>
              <td><button className="btn danger small" onClick={() => remove(r.id)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
