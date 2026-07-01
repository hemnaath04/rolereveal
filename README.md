<div align="center">

<img src="icons/icon128.png" width="84" alt="RoleReveal logo" />

# RoleReveal

### See how well your résumé actually fits a job, right on the posting.

[**➡️ Add to Chrome**](https://chromewebstore.google.com/detail/oplfnlcnahoijcflpjjncplkoakdpobb) · [Privacy Policy](./PRIVACY.md) · [Backend](https://github.com/hemnaath04/rolereveal-backend)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/oplfnlcnahoijcflpjjncplkoakdpobb?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/oplfnlcnahoijcflpjjncplkoakdpobb)
[![Users](https://img.shields.io/chrome-web-store/users/oplfnlcnahoijcflpjjncplkoakdpobb?label=users&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/oplfnlcnahoijcflpjjncplkoakdpobb)
[![Rating](https://img.shields.io/chrome-web-store/rating/oplfnlcnahoijcflpjjncplkoakdpobb)](https://chromewebstore.google.com/detail/oplfnlcnahoijcflpjjncplkoakdpobb)
![MIT License](https://img.shields.io/badge/license-MIT-blue)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-brightgreen)

</div>

---

## What is this?

Job hunting is a guessing game. You read a posting, wonder *"am I even a fit for this?"*, and either spend an hour tailoring your résumé or apply blindly and hope. RoleReveal takes the guesswork out: open any job posting and it instantly shows, **right on the page**, how well your résumé matches — a score out of 100, an **Apply / Maybe / Skip** call, and the exact skills you're missing.

Think of it as a second pair of eyes that reads the job description, compares it to your résumé, and tells you the truth in a couple of seconds — so you spend your energy on the roles you can actually win.

## What it does

- **A match score on every posting.** A 0–100 score and an Apply / Maybe / Skip verdict appear inline as you browse.
- **A one-line "why."** A short, honest summary of the verdict — no fluff.
- **The details when you want them.** Click *Show match details* for required vs. nice-to-have qualifications, the skills you match, and the skills (and ATS keywords) you're missing.
- **Quick signals.** Sponsorship/citizenship wording, work mode, and salary, pulled straight from the description.
- **Auto-runs on 100+ major boards & ATS worldwide.** LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Ashby, Workday, SmartRecruiters, your university job board (NUworks/Symplicity), and more. On any other career site, score the job in one click from the toolbar.
- **Multiple résumés.** Add a few; it automatically scores against your best-matching one.
- **A built-in tracker.** Mark jobs as applied and keep a simple list.

## How it works

1. Add your résumé once (PDF, paste, or JSON) in the options page.
2. Open a job posting on any of the 100+ supported boards/ATS — RoleReveal detects it, reads the description, and shows the match panel automatically. On any other site, click the RoleReveal toolbar button to score the job on that tab.
3. No button-mashing on supported sites; one click everywhere else.

Under the hood it uses an AI model to do the comparison. You can use the **built-in backend** (nothing to set up) or plug in **your own provider and API key** (Anthropic, OpenAI, Gemini, or any OpenAI-compatible endpoint) in Options.

## Your privacy comes first

This was built to be respectful of your data:

- **Personal details are masked before anything is sent.** Your name, email, phone, and links are stripped out, and résumé labels are replaced with generic ones — so your identity isn't shared with the AI. (You can toggle this in Options.)
- **Your résumés never leave your device in full** — they live in your browser's local storage. Only the masked text needed for scoring is sent.
- **It's passive.** RoleReveal only *reads* the posting you're already looking at. It never clicks, auto-applies, navigates, or sends requests to the job site — so it won't put your accounts at risk.
- **No tracking, no ads, no selling data.**

Full details: [Privacy Policy](./PRIVACY.md).

## Install from source (developers)

```bash
npm install
npm run build      # builds to dist/
```
Then in Chrome/Edge → `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the **`dist/`** folder.

## A quick disclaimer

RoleReveal gives you **AI-generated estimates** to help you decide where to spend your time. Scores, verdicts, and any sponsorship/eligibility hints are **informational only — not legal, immigration, or career advice**. Always confirm details with the employer. RoleReveal is an independent project and is **not affiliated with or endorsed by** LinkedIn, Indeed, or any job board; all trademarks belong to their owners.

## License

[MIT](./LICENSE) © Hemnaath Balasubramani
