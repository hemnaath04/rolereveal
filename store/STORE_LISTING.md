# Chrome Web Store — Listing Copy & Submission Notes

## Name
RoleReveal — AI Job Fit & Resume Match Score

## Short description (≤132 chars)
Instantly score any job posting against your resume — match %, Apply/Maybe/Skip verdict, and the skills you're missing.

## Category
Productivity

## Detailed description
RoleReveal reads the job posting you're viewing and scores how well it matches your
resume — right inside the page, as you browse.

• Live match score + Apply / Maybe / Skip verdict on every posting
• One-line summary of why, with required vs. nice-to-have qualifications
• Matching skills and the skills you're missing
• Sponsorship / work-mode / salary signals pulled from the description
• Works on LinkedIn, your school job board (NUworks/Symplicity), Greenhouse,
  Lever, and virtually any career site or job board
• Application tracker built in

How it works: add your resume once. Open any job posting and RoleReveal shows a
match panel inline. Use the built-in backend (no setup) or bring your own LLM
provider/API key in Options.

Open source: https://github.com/hemnaath/ai-jobby

## Single purpose (required field)
Score the job posting the user is viewing against their resume and show the match
details.

## Permission justifications (paste into the dashboard)
- storage: Store the user's resumes, settings, and application tracker locally on
  their device.
- activeTab: Read the job description on the tab the user is viewing so it can be
  scored when they open the popup.
- contextMenus: Provide a right-click "evaluate selected text" option to score a
  highlighted job description.
- Host permissions (all sites): Job postings appear on many different career sites
  and job boards, so the extension must be able to read a job description on
  whatever site the user is on. It only activates when a job posting is detected
  and is otherwise inert.

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
- Privacy policy URL: https://github.com/hemnaath/ai-jobby/blob/main/PRIVACY.md

## Assets needed (you provide / generate)
- Store icon 128×128 — use icons/icon128.png ✓
- At least 1 screenshot 1280×800 (or 640×400) — a job page with the match panel
- Small promo tile 440×280 (optional but recommended)
- (Optional) marquee 1400×560
