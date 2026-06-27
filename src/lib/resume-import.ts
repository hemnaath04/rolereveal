// Convert imported JSON into plain resume text. Accepts:
//  - a JSON Resume object ({ basics, work, education, skills, ... })
//  - { label, text } or an array of those
//  - a raw string
// Returns a list of { label, text } to add.
import type { Resume } from './types';

type Importable = Pick<Resume, 'label' | 'text'>;

export function parseResumeImport(raw: string): Importable[] {
  const data = JSON.parse(raw);
  if (typeof data === 'string') return [{ label: 'Imported resume', text: data }];
  if (Array.isArray(data)) return data.flatMap(parseOne);
  return parseOne(data);
}

function parseOne(d: any): Importable[] {
  if (!d || typeof d !== 'object') return [];
  if (typeof d.text === 'string') {
    return [{ label: String(d.label ?? 'Imported resume'), text: d.text }];
  }
  // Looks like JSON Resume — flatten the common sections to text.
  if (d.basics || d.work || d.education || d.skills) {
    return [{ label: d.basics?.label || d.basics?.name || 'JSON Resume', text: jsonResumeToText(d) }];
  }
  return [];
}

function jsonResumeToText(r: any): string {
  const out: string[] = [];
  const b = r.basics ?? {};
  if (b.name) out.push(b.name);
  const contact = [b.email, b.phone, b.url, b.location?.city].filter(Boolean).join(' · ');
  if (contact) out.push(contact);
  if (b.summary) out.push('\n' + b.summary);

  push(out, 'EXPERIENCE', (r.work ?? []).map((w: any) =>
    `${w.position ?? ''} — ${w.name ?? w.company ?? ''} (${w.startDate ?? ''}–${w.endDate ?? 'present'})\n` +
    [w.summary, ...(w.highlights ?? [])].filter(Boolean).map((h: string) => `  • ${h}`).join('\n')));

  push(out, 'EDUCATION', (r.education ?? []).map((e: any) =>
    `${e.studyType ?? ''} ${e.area ?? ''} — ${e.institution ?? ''} (${e.startDate ?? ''}–${e.endDate ?? ''})`));

  push(out, 'SKILLS', (r.skills ?? []).map((s: any) =>
    `${s.name ?? ''}: ${(s.keywords ?? []).join(', ')}`));

  push(out, 'PROJECTS', (r.projects ?? []).map((p: any) =>
    `${p.name ?? ''}: ${p.description ?? ''}`));

  return out.join('\n').trim();
}

function push(out: string[], heading: string, items: string[]) {
  const filled = items.filter((x) => x && x.trim());
  if (filled.length) out.push(`\n${heading}\n${filled.join('\n')}`);
}
