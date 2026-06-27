// All overlay CSS lives inside the Shadow DOM, so site styles can't leak in and
// ours can't leak out. Exported as a string injected via a <style> tag.
export const OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }

.aj-root { position: fixed; z-index: 2147483647; }

/* Collapsed pill */
.aj-pill {
  display: flex; align-items: center; gap: 8px;
  background: #0b0f19; color: #fff; border-radius: 999px;
  padding: 8px 14px 8px 10px; cursor: grab;
  box-shadow: 0 8px 28px rgba(0,0,0,.35); user-select: none;
  border: 1px solid rgba(255,255,255,.12);
}
.aj-pill:active { cursor: grabbing; }
.aj-score {
  width: 34px; height: 34px; border-radius: 50%;
  display: grid; place-items: center; font-weight: 700; font-size: 14px; color: #fff;
}
.aj-pill-label { font-size: 12px; opacity: .85; }
.aj-pill-verdict { font-size: 13px; font-weight: 600; }
.aj-spin { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.25);
  border-top-color: #fff; border-radius: 50%; animation: aj-rot .7s linear infinite; }
@keyframes aj-rot { to { transform: rotate(360deg); } }

/* Inline card — injected into the page column, full width of its container */
.aj-card {
  width: 100%; max-width: 560px; box-sizing: border-box;
  background: #0b0f19; color: #e5e7eb; border-radius: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12);
  font-size: 14px; margin: 0;
}
.aj-brandmark { font-size: 16px; }
.aj-head {
  display: flex; align-items: center; gap: 10px; padding: 11px 13px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  background: #0b0f19; border-radius: 14px 14px 0 0;
}
.aj-head-meta { flex: 1; min-width: 0; }
.aj-head-title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aj-head-sub { font-size: 12px; opacity: .6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aj-iconbtn { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
.aj-iconbtn:hover { color: #fff; }

.aj-body { padding: 12px 14px; }
.aj-verdict-row { display: flex; align-items: flex-start; gap: 12px; margin: 4px 0 6px; }
.aj-bigscore { flex: 0 0 auto; width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; font-size: 25px; font-weight: 800; color: #fff; }
.aj-verdict-text .v { font-size: 19px; font-weight: 800; }
.aj-verdict-text .r { font-size: 12.5px; opacity: .7; }
.aj-summary { font-size: 13px; line-height: 1.45; color: #cbd5e1; margin-top: 3px; }

.aj-section { margin-top: 16px; }
.aj-section h4 { margin: 0 0 7px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #93c5fd; }
.aj-list { margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.55; }
.aj-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.aj-chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); }
.aj-chip.ok { background: rgba(22,163,74,.16); border-color: rgba(22,163,74,.4); color: #86efac; }
.aj-chip.must { background: rgba(220,38,38,.16); border-color: rgba(220,38,38,.4); color: #fca5a5; }
.aj-chip.nice { background: rgba(217,119,6,.14); border-color: rgba(217,119,6,.4); color: #fcd34d; }

.aj-elig { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 12px; }
.aj-elig .k { opacity: .6; }
.aj-flag { display: inline-block; padding: 1px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.aj-flag.ok { background: rgba(22,163,74,.2); color: #86efac; }
.aj-flag.risk { background: rgba(220,38,38,.2); color: #fca5a5; }
.aj-flag.unknown { background: rgba(148,163,184,.2); color: #cbd5e1; }

.aj-resume-pick { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.aj-resume-pick button { font-size: 11px; padding: 4px 9px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); color: #cbd5e1; }
.aj-resume-pick button.active { background: #2563eb; border-color: #2563eb; color: #fff; }

.aj-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.aj-btn { flex: 1 1 auto; font-size: 12px; font-weight: 600; padding: 8px 10px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; }
.aj-btn.primary { background: #2563eb; color: #fff; }
.aj-btn.primary:hover { background: #1d4ed8; }
.aj-btn.ghost { background: rgba(255,255,255,.06); color: #e5e7eb; border-color: rgba(255,255,255,.12); }
.aj-btn.ghost:hover { background: rgba(255,255,255,.12); }
.aj-btn:disabled { opacity: .5; cursor: default; }

.aj-detect { font-size: 11px; margin-bottom: 10px; padding: 6px 9px; border-radius: 8px; }
.aj-detect.clean { background: rgba(22,163,74,.14); color: #86efac; }
.aj-detect.fallback { background: rgba(217,119,6,.14); color: #fcd34d; }
.aj-detect.manual { background: rgba(37,99,235,.16); color: #93c5fd; }
.aj-detect.none { background: rgba(220,38,38,.14); color: #fca5a5; }

.aj-error { background: rgba(220,38,38,.14); color: #fca5a5; padding: 10px; border-radius: 10px; font-size: 12.5px; }
.aj-textarea { width: 100%; min-height: 120px; background: #060912; color: #e5e7eb; border: 1px solid rgba(255,255,255,.14);
  border-radius: 10px; padding: 8px; font-size: 12px; resize: vertical; }
.aj-privacy { font-size: 10.5px; opacity: .5; margin-top: 12px; text-align: center; }
.aj-hint { font-size: 12px; opacity: .8; margin-bottom: 8px; }
`;
