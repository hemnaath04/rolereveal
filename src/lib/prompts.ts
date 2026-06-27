// ---------------------------------------------------------------------------
// Prompt construction for evaluation and resume tailoring.
// ---------------------------------------------------------------------------
import type { Resume } from './types';

export const EVAL_SYSTEM_PROMPT = `You are a precise technical recruiter. Compare the candidate's resume(s) to the job description. Score on genuine skill and requirement match, not keyword stuffing. Never assume skills not present in the resume. Weigh eligibility mismatches heavily (work authorization or sponsorship, role term or season, location, seniority). Be honest: if it is a weak or off-target fit, return Skip.

Provide three 0-100 sub-scores in "dimensions": "skills" (how well the resume's skills cover the role's required skills), "experience" (seniority and years/domain relevance), and "roleContext" (overall fit including location, term, eligibility, and role type). "overallScore" should be consistent with these. Keep "whyMatch" and "watchOuts" to short phrases. Return only valid JSON in the given schema, no other commentary.`;

/** The exact JSON shape the model must return. */
export const EVAL_JSON_SCHEMA = `{
  "perResume": [
    { "label": "string (must match one of the provided resume labels)", "score": 0 }
  ],
  "bestResume": "label of the highest-scoring resume",
  "overallScore": 0,
  "verdict": "Apply | Maybe | Skip",
  "summary": "ONE sentence, MAX 20 words, stating the single most decisive reason for the verdict (include any eligibility mismatch: work authorization/sponsorship, term/season, location, seniority)",
  "dimensions": {
    "skills": 0,
    "experience": 0,
    "roleContext": 0
  },
  "whyMatch": "SHORT phrase (<=12 words) of the candidate's genuine strengths for THIS role, e.g. '5+ yrs backend, REST APIs, CI/CD, Java'",
  "watchOuts": "SHORT phrase (<=14 words) of the main gaps or risks, including any eligibility issue, e.g. 'No fintech domain; visa sponsorship not offered'"
}`;

// Bound the prompt so a long JD or several long resumes don't blow up latency
// and cost: the JD is capped (~8k chars) and each resume is capped per-block.
const MAX_JD_CHARS = 8000;
const MAX_RESUME_CHARS = 6000;

export function buildEvalUserPrompt(jdText: string, resumes: Resume[]): string {
  const jd = jdText.trim().slice(0, MAX_JD_CHARS);
  // Use generic labels ("Resume 1") so a label containing the candidate's name
  // never reaches the LLM. The caller maps these back to real labels locally.
  const resumeBlocks = resumes
    .map(
      (r, i) =>
        `--- RESUME ${i + 1} (label: "Resume ${i + 1}") ---\n${r.text
          .trim()
          .slice(0, MAX_RESUME_CHARS)}`,
    )
    .join('\n\n');

  return `Evaluate the following candidate resume(s) against the job description.

The "overallScore" must equal the score of the best-matching resume.
The "bestResume" must be the label of that resume.
The "summary" must be ONE sentence of at most 20 words.
Return ONLY a JSON object matching this schema, with no markdown fences or commentary:

${EVAL_JSON_SCHEMA}

==================== JOB DESCRIPTION ====================
${jd}

==================== RESUME(S) ====================
${resumeBlocks}
`;
}

export const TAILOR_SYSTEM_PROMPT = `You are an expert resume editor. Tailor the resume to the job description by reordering and rephrasing existing content to surface relevant, truthful keywords. Do not invent skills, tools, employers, dates, or metrics. Keep it to one page. Return the tailored resume as clean plain text only — no commentary, no markdown code fences.`;

export function buildTailorUserPrompt(jdText: string, resumeText: string): string {
  return `Tailor this resume to the job description below. Reorder bullets and rephrase to surface genuinely supported keywords from the JD. Do NOT add skills, tools, employers, dates, or metrics that are not already present. Keep it to one page. Return only the tailored resume text.

==================== JOB DESCRIPTION ====================
${jdText.trim()}

==================== RESUME TO TAILOR ====================
${resumeText.trim()}
`;
}
