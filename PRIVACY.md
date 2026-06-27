# RoleReveal — Privacy Policy

_Last updated: 2026-06-27_

RoleReveal is a browser extension that scores the job posting you're viewing
against your resume. This policy explains exactly what data it handles.

## What is stored, and where
The following is stored **locally on your device** using the browser's extension
storage (`chrome.storage.local`). It never leaves your machine except as
described in "What is sent for scoring" below:
- Your resume text and labels
- Your settings (provider, model, thresholds, preferences)
- Your saved application tracker entries

RoleReveal does **not** have user accounts and does **not** collect analytics,
advertising identifiers, or browsing history.

## What is sent for scoring
When a job posting is scored, the extension sends the **job description text**
from the page and your **selected resume text** to the RoleReveal backend
(`ai-jobby-backend.vercel.app`), which forwards them to a large language model
(LLM) to compute the match score and analysis. The result is returned to the
extension and displayed.

- **Personal info is masked first (on by default).** Before the resume leaves
  your device, RoleReveal redacts your name, email, phone number, and links, and
  replaces resume labels with generic ones ("Resume 1") — so your contact details
  and name are **not** sent to the backend or the LLM. Skills and experience are
  kept so scoring still works. You can toggle this in Options.
- This data is sent **only** to generate a score, when a job posting is detected
  or you trigger a scoring action.
- The RoleReveal backend does **not** persistently store your resume or job
  descriptions; they are processed transiently to produce the score.
- The request is processed by the configured LLM provider, whose use of the data
  is governed by that provider's own privacy policy.
- **You can avoid the backend entirely:** set your own provider and API key in
  the extension's Options. Then scoring requests go directly from your browser to
  the provider you choose, not through the RoleReveal backend.

## What is NOT collected
- No selling or sharing of personal data with third parties for advertising.
- No tracking across sites; the extension only reads the content of a page when
  it detects a job posting on it.
- No keystroke logging, no form data beyond the resume you explicitly add.
- No scraping of profiles, connections, recruiters, or contact lists — only the
  job description, title, and company are read.

## Passive by design
RoleReveal only **reads** the job posting you are actively viewing. It does **not**
click, submit, auto-apply, navigate, automate, or send any network request to the
job site itself. The only outbound request is the scoring call to the backend /
LLM provider described above. This is deliberate — it keeps the extension clear of
job-site automation rules and keeps your account safe.

## Permissions
- **storage** — save your resumes, settings, and tracker on your device.
- **activeTab** — read the job posting on the tab you're viewing to score it.
- **contextMenus** — provide a right-click "evaluate selected text" option.
- **host access (all sites)** — job postings appear on many different career
  sites and job boards, so the extension must be able to read a job description
  wherever you encounter one. It only acts when a posting is detected.

## Data deletion
Removing the extension deletes all locally stored data. You can also clear
resumes, settings, and tracker entries from the Options page at any time.

## Not professional advice
RoleReveal produces automated estimates to help you triage postings. Scores,
verdicts, and any sponsorship / work-authorization / eligibility signals are
**informational only** and may be wrong. They are **not** legal, immigration,
financial, or career advice. Always verify details directly with the employer.

## International data transfer
The backend and LLM providers may process requests on servers located in the
United States or other countries. By using the default backend you consent to
this transfer. To avoid it, configure your own provider/key in Options.

## Children
RoleReveal is intended for job seekers and is not directed to children under 16.
We do not knowingly collect data from children.

## Your choices
- Toggle PII masking in Options (on by default).
- Use your own provider + API key to bypass the RoleReveal backend entirely.
- Clear resumes/settings/tracker from Options, or uninstall to delete all local data.

## Changes
Material changes to this policy will be reflected here with an updated date.

## Contact
Questions: open an issue at https://github.com/hemnaath/ai-jobby/issues
