# Chrome Web Store — Listing Copy & Submission Notes

## Name
RoleReveal — AI Job Fit & Resume Match Score

## Short description (≤132 chars)
Resume match score for any job — see how well you fit a posting, with an Apply/Maybe/Skip verdict and the skills you're missing.

## Category
Productivity

## Detailed description
> The first ~150 words are the most important for Chrome Web Store search ranking
> — keywords are front-loaded here, naturally (no stuffing).

RoleReveal is an AI resume match score and job-fit checker that works right on the
job posting you're viewing. Open any job on LinkedIn, Indeed, Glassdoor,
Greenhouse, Lever, Workday, or any company careers page, and instantly see how
well your resume matches the role — a 0–100 match score, an Apply / Maybe / Skip
verdict, and the required skills, qualifications, and ATS keywords you're missing
— inline, as you browse.

Stop guessing whether you're a fit. RoleReveal compares your resume against each
job description and shows where you're strong and what to add before you apply.

Features
• Live resume match score (0–100) + Apply / Maybe / Skip verdict on every posting
• Required vs. nice-to-have qualifications, matching skills, and missing skills / ATS keywords
• Sponsorship, work-mode, and salary signals pulled from the job description
• Works on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday,
  NUworks/Symplicity, and virtually any job board or careers page
• Multiple resumes — it automatically picks your best-matching one
• Built-in application tracker

How it works: add your resume once, then open any job posting — RoleReveal shows a
match panel inline. Use the built-in AI (no setup) or bring your own provider/API
key in Options.

Private & safe: your personal info (name, email, phone) is masked before scoring,
resumes stay in local storage, and RoleReveal only reads the posting you're
viewing — no scraping, no automation, no bulk crawling.

Keywords (woven in naturally): resume match score, job fit, ATS resume checker,
resume scanner, job match, skill gap, application tracker, LinkedIn, Indeed.

Open source: https://github.com/hemnaath04/rolereveal

## Single purpose (required field)
Score the job posting the user is viewing against their resume and show the match
details.

## Permission justifications (paste into the dashboard)
- storage: Store the user's resumes, settings, and application tracker locally on
  their device.
- activeTab: When the user clicks "Evaluate current tab", read the job posting on
  the tab they are actively viewing so it can be scored against their resume.
- scripting: Inject the scoring content script on demand into the active tab when
  the user clicks "Evaluate current tab" on a site that is not one of the
  pre-listed job boards. Only runs in response to that explicit user action.
- contextMenus: Provide a right-click "evaluate selected text" option to score a
  highlighted job description.
- Host permissions: Limited to the LLM API endpoints the extension calls to
  generate a score (the built-in RoleReveal service and the optional providers a
  user can choose, plus localhost for self-hosted models). These are needed so
  the background service worker's requests to those APIs are not blocked by CORS.
  The extension does NOT request access to arbitrary websites; it auto-runs only
  on a fixed list of major job boards/ATS platforms (LinkedIn, Indeed, Glassdoor,
  Greenhouse, Lever, Workday, etc.) and otherwise only on the active tab when the
  user explicitly clicks Evaluate.
- optional_host_permissions: Requested at runtime (never at install) only if the
  user configures a custom/self-hosted LLM endpoint, so the worker can reach it.

## Remote code
None. All executed code is bundled in the package. The extension sends data to a
backend API for scoring but does not download or execute remote code.

## Privacy practices / data safety answers
- Does it collect user data? Yes.
  - Personally identifiable information (the resume may contain name/email/phone)
    — used only for app functionality (scoring). Not sold. Not used for ads.
  - Website content (the job description on the current page) — used only to
    compute the score. Not sold.
- Authentication info: No.
- Location, health, financial, personal communications: No.
- Is data sold to third parties? No.
- Is data used for purposes unrelated to the core feature? No.
- Privacy policy URL: https://github.com/hemnaath04/rolereveal/blob/main/PRIVACY.md

## Assets needed (you provide / generate)
- Store icon 128×128 — use icons/icon128.png ✓
- At least 1 screenshot 1280×800 (or 640×400) — a job page with the match panel
- Small promo tile 440×280 (optional but recommended)
- (Optional) marquee 1400×560
