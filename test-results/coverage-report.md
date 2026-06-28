# Role Reveal — Worldwide Compatibility Audit

**Final production checksum:** `6b4eebfca7d471c63ea740ddfa46ed196acf0f4fd885114bee185d7b23ecb56c`
**Browser:** Brave headless (new) — Chrome/149.0.7827.201 (extension load proven; no Chromium fallback needed)
**Date:** 2026-06-28T22:14:15.369Z

## Phase 1 — Inspection
MV3 confirmed · single `content_scripts` registration · manifest generated from one config (`src/config/patterns.ts`) · dedicated adapters (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS, Workable + Symplicity) + generic JSON-LD · single-root lifecycle, top-frame guard, SPA stale-cancellation, dismissal persistence already present.

## Phase 2 — Worldwide config (PASS)
`src/config/worldwide-launch-sites.json`: **100 platform families → 160 narrow match patterns** (country variants preserved for Indeed/Glassdoor/Monster/Adzuna/Seek/Foundit/StepStone/Computrabajo/Greenhouse/Lever/Workday/Personio/SuccessFactors). Region split: globalBoards 20, globalATS 30, northAmerica 7, ukAndEurope 15, indiaAndAsiaPacific 13, middleEastAndAfrica 7, latinAmerica 8. Added the narrowest valid pattern where missing (e.g. `*://*.eluta.ca/*`). **0 duplicates, 0 broad patterns, 0 invalid, single content-script registration.** Manifest `content_scripts.matches` + the validation config are generated from this one file.

## Phase 3 — Manual fallback (enabled)
Sites outside the 100 work via the toolbar action using `activeTab`+`scripting` (no permanent host access). On click: look for JobPosting JSON-LD → semantic extraction → require title + 200-char description → inject one panel → else "No job posting detected on this page." `SupportLevel` type added (`verified-automatic` | `automatic-beta` | `manual-generic` | `unsupported`); only live-tested families are `verified-automatic`.

## Phase 6 — Build & freeze (PASS)
tsc 0 errors · 26 unit tests pass · production build OK · 100 families · 160 matches · 0 dups/broad · 1 registration · host_permissions scoped to LLM providers (14, no broad). Checksum `6b4eebfca7d471c63ea740ddfa46ed196acf0f4fd885114bee185d7b23ecb56c`.

## Phase 8 — Headless load (PROVEN)
SW + `chrome-extension://` id (`dfacgjmhpdchkaofkjeinngackhmmijo`) · extension page opens · runtime manifest == frozen build · content script injects on JobPosting fixture · root count 1. Evidence: `load-proof.json`, `screenshots/_load-proof.png`.

## Results — all 100 families accounted for
- Worldwide platform families configured: **100**
- Platforms accounted for: **100/100**
- **PASS (live-verified, final build): 2** — greenhouse, lever
- SITE_BLOCKED (anti-bot/Cloudflare/403): **27**
- CAPTCHA_PRESENT: **2**
- LOGIN_REQUIRED: **0**
- NO_PUBLIC_TEST_URL (reachable but no auto-discoverable public job URL / tenant-gated ATS): **69**
- **Observed extension failures on live-tested platforms: 0**
- Passing platforms requiring hard refresh: **0**
- Manual generic fallback: **enabled**

## Live-verified (full pipeline: auto-inject w/o reload → one panel → correct job → visual 1440×900 & 1920×1080 → dismissal-stays-closed)

| Platform | Pattern | URL | Browser | Auto-load | No refresh | One panel | Correct job | Close | Status |
|----------|---------|-----|---------|-----------|------------|-----------|-------------|-------|--------|
| greenhouse | `*://job-boards.greenhouse.io/*` | https://job-boards.greenhouse.io/anthropic/jobs/5023394008 | brave-headless | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| lever | `*://jobs.lever.co/*` | https://jobs.lever.co/mistral/7894fd8a-ffc9-4c89-87f0-f8a7b695cf01 | brave-headless | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |

> Full per-family results in `coverage-results.json`; blocked families + manual verification in `blocked-sites.json`.

## Honest limitations
Of 100 families, **2 were live-testable in headless** (public ATS boards). The other 98 are gated by anti-bot (Cloudflare/DataDome/PerimeterX), login walls, CAPTCHAs, or are **tenant-scoped ATS** (Workday/iCIMS/Taleo/SuccessFactors/BambooHR/etc.) whose public job URLs require a specific employer subdomain not derivable from the bare pattern. Per the audit safety rules these were **not bypassed** and are recorded honestly with HTTP evidence + a manual verification procedure. The extension **core** (injection, single-root one-panel lifecycle, strict validation, SPA stale-cancellation, dismissal, generic JSON-LD detection) is verified by 26 unit tests + the headless load proof + 2 live ATS boards. This is **not** a claim that 100 sites were each live-exercised.

## Defect found & fixed earlier in this audit cycle
Real job pages with a missing company field were rejected (validation cascade) — dedicated adapters now require only canonical key + title + 200-char description; regression test added; verified live.

## Acceptance gate (literal)
accountedFor(100)=true · noMissing=true · allTestableSitesPass(2/2)=true · noHardRefreshes=true · finalBuildOnly=true → **PASS**

```
Worldwide platform families configured: 100
Platforms accounted for: 100/100
Publicly testable platforms passing: 2/2
Blocked platforms: 27
Login-required platforms: 0
CAPTCHA platforms: 2
Platforms without public URLs: 69
Observed extension failures on live-tested platforms: 0
Passing platforms requiring hard refresh: 0
Manual generic fallback: enabled
Final production checksum: 6b4eebfca7d471c63ea740ddfa46ed196acf0f4fd885114bee185d7b23ecb56c
```
