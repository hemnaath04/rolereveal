# RoleReveal

A Chrome / Edge (Manifest V3) extension that scores how well **your** resume
matches the job posting you're viewing — an **Apply / Maybe / Skip** verdict, a
one-line summary, and (on expand) required vs. nice-to-have qualifications and
your matching / missing skills — injected **inline on the page**, on virtually
any job site.

> Open source. Not affiliated with or endorsed by LinkedIn, Indeed, Greenhouse,
> Lever, Workday, or any job board. It only reads the posting you're actively
> viewing — it does not crawl, scrape in bulk, or automate any site.

---

## Features

- **Inline match panel** on the job posting: score (0–100), Apply/Maybe/Skip
  verdict, a ≤20-word summary, and a **Show match details** toggle for required /
  nice-to-have qualifications and matching / missing skills.
- **Deterministic signals** pulled from the description with no LLM: sponsorship /
  citizenship wording, work mode, and salary.
- **Works everywhere**: dedicated adapters for LinkedIn and NUworks/Symplicity,
  plus a universal adapter (schema.org `JobPosting` + heading/heuristic detection)
  for Greenhouse, Lever, company career pages, and beyond. It only activates when
  a real posting is detected.
- **Multiple resumes** managed in Options (PDF upload parsed client-side, paste,
  or JSON import); the best-scoring one is picked automatically.
- **Application tracker** — "Mark applied" logs company, title, URL, score, date.
- **Your choice of backend**: a built-in proxy (zero setup) **or** your own
  provider + API key (Anthropic, OpenAI, or any OpenAI-compatible endpoint).

---

## How it works

| Part | Responsibility |
|------|----------------|
| **Content script** (`src/content/`) | Per-site adapters detect the posting and inject a Shadow-DOM panel; idempotent + SPA-aware. |
| **Background worker** (`src/background/`) | The only place that makes the LLM call. Builds the prompt, caches results per job description. |
| **Backend proxy** (separate repo) | Holds the real LLM key server-side and enforces per-user rate limits, so the published extension ships **no key**. |

By default the extension sends the **job description** and your **selected
resume** to the RoleReveal backend, which forwards them to an LLM to compute the
score. You can switch to your **own provider + key** in Options, in which case
requests go directly to the provider you choose. See **[Privacy](./PRIVACY.md)**.

---

## Build & load unpacked

```bash
npm install
npm run build            # outputs to dist/
```
Then in Chrome/Edge → `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select **`dist/`**.

---

## Privacy & disclaimer

- Resumes, settings, and the tracker are stored in `chrome.storage.local` on your
  device. Scoring sends the job description + resume to the configured backend/LLM
  (see [PRIVACY.md](./PRIVACY.md)). Use your own key to keep it provider-direct.
- Provided **as-is, without warranty**. AI scores are guidance, not a hiring
  decision — verify before relying on them.
- All trademarks (LinkedIn, Indeed, etc.) belong to their owners; this project is
  independent and unaffiliated.

## License

MIT — see [LICENSE](./LICENSE).
