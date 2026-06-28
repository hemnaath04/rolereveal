import React, { useEffect, useRef, useState } from 'react';
import type { Resume, Settings } from '../lib/types';
import { getResumes, getSettings, saveResumes, saveSettings } from '../lib/storage';
import { extractPdfText } from '../lib/pdf';
import { parseResumeImport } from '../lib/resume-import';
import { newId } from '../lib/tracker';
import { getProvider, selectableProviders } from '../lib/providers';

export function Options() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getResumes().then(setResumes);
    void getSettings().then(setSettings);
  }, []);

  const persistResumes = async (next: Resume[]) => {
    setResumes(next);
    await saveResumes(next);
  };

  const patchSettings = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  if (!settings) return <div className="options">Loading…</div>;

  return (
    <div className="options">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <img src={chrome.runtime.getURL('icons/icon128.png')} width={30} height={30} style={{ borderRadius: 8 }} alt="" />
        <h1 style={{ fontSize: 22, margin: 0 }}>RoleReveal</h1>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Score any job posting against your resumes, get an Apply/Maybe/Skip verdict, tailor a resume, and track applications — all local.
      </p>

      <div className="privacy space">
        🔒 Your resumes, API key, settings, and tracker live only in this browser
        (chrome.storage.local). The job description and the chosen resume text are sent
        only to the AI used for scoring — the built-in RoleReveal service by default, or
        your own provider if you set one below — and to no other server.
      </div>

      {err && <div className="err space">{err}</div>}

      {/* ---------------- Resumes ---------------- */}
      <h2 style={{ fontSize: 17, marginTop: 24 }}>Resumes</h2>
      <ResumeAdder onAdd={(items) => persistResumes([...resumes, ...items])} onError={setErr} />

      <div className="col space">
        {resumes.length === 0 && <p className="muted small">No resumes yet. Add one above.</p>}
        {resumes.map((r) => (
          <ResumeRow
            key={r.id}
            resume={r}
            onChange={(updated) => persistResumes(resumes.map((x) => (x.id === r.id ? updated : x)))}
            onDelete={() => persistResumes(resumes.filter((x) => x.id !== r.id))}
          />
        ))}
      </div>

      <div className="divider" />

      {/* ---------------- Settings ---------------- */}
      <h2 style={{ fontSize: 17 }}>Settings {saved && <span className="muted small">· saved ✓</span>}</h2>

      {(() => {
        const advanced = settings.provider !== 'builtin';
        const preset = getProvider(settings.provider);
        return (
          <>
            <label className="toggle space">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) =>
                  patchSettings(
                    e.target.checked
                      ? { provider: 'openai', model: '', customBaseUrl: '' }
                      : { provider: 'builtin' },
                  )
                }
              />
              Use my own AI provider / API key (advanced)
            </label>

            {!advanced ? (
              <div className="privacy space">
                ✨ <b>Built-in AI is on.</b> RoleReveal scores jobs out of the box —
                no API key or setup needed. Turn on the option above only if you want
                to use your own provider, model, or key.
              </div>
            ) : (
              <>
                <div className="grid2 space">
                  <label className="field">
                    <span className="lbl">AI provider</span>
                    <select
                      value={settings.provider}
                      onChange={(e) => {
                        const next = getProvider(e.target.value);
                        patchSettings({
                          provider: next.id,
                          model: '',
                          customBaseUrl: next.needsBaseUrl ? (next.defaultBaseUrl ?? '') : '',
                        });
                      }}
                    >
                      {selectableProviders().map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="lbl">Model</span>
                    <input
                      list="rr-models"
                      placeholder={preset.defaultModel || 'model id'}
                      value={settings.model}
                      onChange={(e) => patchSettings({ model: e.target.value })}
                    />
                    <datalist id="rr-models">
                      {(preset.models ?? []).map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </label>
                </div>

                {preset.needsBaseUrl && (
                  <label className="field space">
                    <span className="lbl">Base URL (OpenAI-compatible)</span>
                    <input
                      placeholder={preset.defaultBaseUrl || 'https://…/v1'}
                      value={settings.customBaseUrl}
                      onChange={(e) => patchSettings({ customBaseUrl: e.target.value })}
                    />
                    <span className="muted small">
                      Supported out of the box: the listed providers and a local model at
                      localhost. A remote custom endpoint on another domain isn’t reachable in
                      the published build.
                    </span>
                  </label>
                )}

                <label className="field space">
                  <span className="lbl">
                    API key {preset.needsKey ? '' : '(optional for local models)'}
                    {preset.keyUrl && (
                      <>
                        {' · '}
                        <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer">
                          get a key
                        </a>
                      </>
                    )}
                  </span>
                  <input
                    type="password"
                    placeholder={preset.keyHint || 'sk-…'}
                    value={settings.apiKey}
                    onChange={(e) => patchSettings({ apiKey: e.target.value })}
                  />
                </label>
              </>
            )}
          </>
        );
      })()}

      <div className="grid2 space">
        <label className="field">
          <span className="lbl">Apply threshold (≥)</span>
          <input
            type="number" min={0} max={100} value={settings.thresholds.apply}
            onChange={(e) => patchSettings({ thresholds: { ...settings.thresholds, apply: clampNum(e.target.value) } })}
          />
        </label>
        <label className="field">
          <span className="lbl">Maybe threshold (≥)</span>
          <input
            type="number" min={0} max={100} value={settings.thresholds.maybe}
            onChange={(e) => patchSettings({ thresholds: { ...settings.thresholds, maybe: clampNum(e.target.value) } })}
          />
        </label>
      </div>

      <div className="grid2 space">
        <label className="field">
          <span className="lbl">Default resume</span>
          <select
            value={settings.defaultResumeId ?? ''}
            onChange={(e) => patchSettings({ defaultResumeId: e.target.value || null })}
          >
            <option value="">— none —</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="toggle">
            <input
              type="checkbox" checked={settings.autoRun}
              onChange={(e) => patchSettings({ autoRun: e.target.checked })}
            />
            Auto-run on page load (otherwise click Evaluate)
          </label>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="toggle">
            <input
              type="checkbox" checked={settings.redactPii !== false}
              onChange={(e) => patchSettings({ redactPii: e.target.checked })}
            />
            Mask personal info (name, email, phone, links) before sending
          </label>
        </label>
      </div>

      <p className="muted small space">
        Tip: turn on “Use my own AI provider” to pick OpenAI, Anthropic, Gemini, Groq,
        OpenRouter, and more (just paste your key — we handle the rest), or run a local
        Ollama model (<code>http://localhost:11434/v1</code>) so evaluations cost nothing.
      </p>

      <p className="muted small">
        Privacy: scoring sends your (masked) resume and the job description to the
        configured AI backend to generate the score. Resumes and settings are stored
        locally on your device.{' '}
        <a
          href="https://github.com/hemnaath04/rolereveal/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        . AI results are informational only — not legal, immigration, or career advice.
      </p>
    </div>
  );
}

const clampNum = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

function ResumeAdder({
  onAdd,
  onError,
}: {
  onAdd: (items: Resume[]) => void;
  onError: (m: string) => void;
}) {
  const [paste, setPaste] = useState('');
  const [label, setLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const mk = (l: string, text: string, source: Resume['source']): Resume => ({
    id: newId(), label: l.trim() || 'Resume', text, favorite: false, enabled: true,
    source, createdAt: Date.now(), updatedAt: Date.now(),
  });

  const addPaste = () => {
    if (paste.trim().length < 40) return onError('Paste at least a few lines of resume text.');
    onAdd([mk(label || 'Pasted resume', paste.trim(), 'paste')]);
    setPaste(''); setLabel(''); onError('');
  };

  const addPdf = async (file: File) => {
    setBusy(true); onError('');
    try {
      const text = await extractPdfText(file);
      if (text.length < 40) throw new Error('Could not extract text (is it a scanned image PDF?).');
      onAdd([mk(label || file.name.replace(/\.pdf$/i, ''), text, 'pdf')]);
      setLabel('');
    } catch (e: any) {
      onError(e?.message ?? 'PDF parse failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addJson = async (file: File) => {
    onError('');
    try {
      const items = parseResumeImport(await file.text());
      if (items.length === 0) throw new Error('No resumes found in JSON.');
      onAdd(items.map((i) => mk(i.label, i.text, 'json')));
    } catch (e: any) {
      onError(e?.message ?? 'JSON import failed.');
    } finally {
      if (jsonRef.current) jsonRef.current.value = '';
    }
  };

  return (
    <div className="card space">
      <label className="field">
        <span className="lbl">Label (optional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Backend SWE, ML, New Grad" />
      </label>
      <label className="field space">
        <span className="lbl">Paste resume text</span>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste your resume…" />
      </label>
      <div className="row space" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={addPaste}>Add pasted</button>
        <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Parsing PDF…' : 'Upload PDF'}
        </button>
        <button className="btn ghost" onClick={() => jsonRef.current?.click()}>Import JSON</button>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && addPdf(e.target.files[0])} />
        <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && addJson(e.target.files[0])} />
      </div>
    </div>
  );
}

function ResumeRow({
  resume,
  onChange,
  onDelete,
}: {
  resume: Resume;
  onChange: (r: Resume) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(resume.text);
  const [label, setLabel] = useState(resume.label);

  return (
    <div className="card resume-item">
      <div className="resume-head">
        <button className="btn ghost small" title={resume.favorite ? 'Unfavorite' : 'Favorite'}
          onClick={() => onChange({ ...resume, favorite: !resume.favorite, updatedAt: Date.now() })}>
          {resume.favorite ? '★' : '☆'}
        </button>
        <strong className="grow">{resume.label}</strong>
        <span className="muted small">{resume.text.length.toLocaleString()} chars · {resume.source}</span>
        <label className="toggle">
          <input type="checkbox" checked={resume.enabled}
            onChange={(e) => onChange({ ...resume, enabled: e.target.checked, updatedAt: Date.now() })} />
          enabled
        </label>
        <button className="btn ghost small" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Edit'}</button>
        <button className="btn danger small" onClick={onDelete}>Delete</button>
      </div>
      {open && (
        <div className="col">
          <label className="field">
            <span className="lbl">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 200 }} />
          <div className="row">
            <button className="btn primary" onClick={() => { onChange({ ...resume, label, text, updatedAt: Date.now() }); setOpen(false); }}>
              Save
            </button>
            <button className="btn ghost" onClick={() => { setText(resume.text); setLabel(resume.label); setOpen(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
