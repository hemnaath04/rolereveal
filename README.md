# 🐸 AI Jobby

A Chrome / Edge (Manifest V3) extension that scores how well **your** resume matches
any job posting you're viewing, tells you whether to **Apply / Maybe / Skip**, can
**tailor** a resume to the posting, and **tracks** your applications — all as an
on-page overlay. Everything stays local; the only network call is to the LLM
provider you choose with your own key.

---

## Features

- **Auto JD detection** on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Ashby,
  Workday, Wellfound, and generic career pages — with a Readability-style fallback,
  plus **"select text on page"**, **"paste JD"**, and a right-click context-menu
  fallback when auto-detection misses. A badge shows the detection quality.
- **Multiple resumes** managed in the options page — add by **PDF upload** (parsed
  client-side with pdf.js), **paste**, or **JSON import** (JSON Resume schema or
  `{label, text}`). Favorite them and toggle which ones get evaluated.
- **Best-match scoring**: every enabled resume is compared, the highest-scoring one
  is picked and labelled.
- **Structured result**: 0–100 Match Score, verdict, 3–5 reasons, matched keywords,
  missing keywords split into **must-have** vs **nice-to-have**, eligibility flags
  (work auth/sponsorship, term/season, location, seniority), and tailoring tips.
- **Floating badge** (draggable, dismissible) coloured green ≥ 75 / yellow 55–74 /
  red < 55. Click to expand the full breakdown; it remembers position + collapsed state.
- **One-click tailored resume** — reorders/rephrases existing content only (never
  invents skills) and downloads `.txt` + `.md`.
- **Application tracker** — "Mark applied" logs company, title, URL, score, date,
  status to local storage; view + export CSV from the popup.
- **Providers**: Anthropic Claude, OpenAI, or any **OpenAI-compatible custom**
  endpoint (your gateway, or local Ollama at `http://localhost:11434/v1`).
- **Private by design**: resumes, API key, settings, and tracker live only in
  `chrome.storage.local`. Results are cached per JD so re-visits don't re-bill.

---

## Install (load unpacked)

```bash
npm install
npm run build      # outputs to dist/
```

Then in Chrome/Edge:

1. Go to `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the **`dist/`** folder.
4. Open the extension **Options** and add a resume + your LLM API key.

For live development with HMR:

```bash
npm run dev        # then Load unpacked the dist/ folder it generates
```

---

## How it works (architecture)

Three parts, message-passing between them:

| Part | File(s) | Responsibility |
|------|---------|----------------|
| **Content script** | `src/content/` | Detects the JD (`src/lib/jd-extract.ts`), mounts the overlay in a **Shadow DOM** (so site CSS can't leak in), requests evaluation, renders the result, handles select/paste/tailor/apply. |
| **Background service worker** | `src/background/index.ts` | The **only** place with the API key. Builds the prompt, calls the LLM (`src/lib/llm.ts`), parses + normalizes JSON (`src/lib/scoring.ts`), caches by a hash of (JD + resumes) (`src/lib/hash.ts`). |
| **Popup + Options** | `src/popup/`, `src/options/` | Manage resumes, settings, run a manual evaluation, and view the tracker. |

Key files in `src/lib/`: `types.ts` (shared types + messaging), `storage.ts`
(`chrome.storage.local` wrappers), `prompts.ts` (system prompts + JSON schema),
`pdf.ts` (pdf.js), `tracker.ts` (CSV), `resume-import.ts` (JSON Resume → text).

### Why the API key is safe

LLM calls happen in the **background service worker**, never the content script, so
the key is never exposed to page/JS context. The worker has `host_permissions`, so
it can reach the LLM endpoint without page CORS restrictions.

### LLM contract

The model is asked for **strict JSON only** (see `EVAL_JSON_SCHEMA` in
`src/lib/prompts.ts`) at temperature ~0.2, with this system prompt:

> *You are a precise technical recruiter. Compare the candidate's resume(s) to the
> job description. Score on genuine skill and requirement match, not keyword
> stuffing. Never assume skills not present in the resume. Separate missing
> requirements into must-have and nice-to-have. Flag eligibility mismatches… Be
> honest: if it is a weak or off-target fit, return Skip and explain why. Return
> only valid JSON in the given schema.*

The tailoring prompt forbids inventing skills, tools, employers, dates, or metrics —
it only reorders and rephrases existing content.

---

## Cost note

Each evaluation is one LLM call (a fraction of a cent on Anthropic/OpenAI). Results
are **cached per job description**, so re-visiting a posting doesn't re-bill. Prefer
zero cost? Use the **Custom** provider with a local Ollama model.

---

## Privacy

Nothing is sent anywhere except the LLM endpoint you configure. No analytics, no
third-party servers. Resumes, key, settings, and tracker never leave your browser.
