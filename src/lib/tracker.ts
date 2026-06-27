// ---------------------------------------------------------------------------
// Application tracker helpers: add an "applied" row and export the table to CSV.
// ---------------------------------------------------------------------------
import { getTracker, saveTracker } from './storage';
import type { TrackedApplication } from './types';

export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export async function addApplication(
  row: Omit<TrackedApplication, 'id' | 'date' | 'status'>,
): Promise<TrackedApplication[]> {
  const rows = await getTracker();
  // De-dupe by URL: if already tracked, leave the original.
  if (rows.some((r) => r.url === row.url)) return rows;
  const entry: TrackedApplication = {
    ...row,
    id: newId(),
    date: Date.now(),
    status: 'applied',
  };
  const next = [entry, ...rows];
  await saveTracker(next);
  return next;
}

export async function updateStatus(
  id: string,
  status: TrackedApplication['status'],
): Promise<TrackedApplication[]> {
  const rows = await getTracker();
  const next = rows.map((r) => (r.id === id ? { ...r, status } : r));
  await saveTracker(next);
  return next;
}

export async function removeApplication(id: string): Promise<TrackedApplication[]> {
  const rows = (await getTracker()).filter((r) => r.id !== id);
  await saveTracker(rows);
  return rows;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: TrackedApplication[]): string {
  const header = ['Company', 'Title', 'Score', 'Best Resume', 'Status', 'Date', 'URL'];
  const lines = rows.map((r) =>
    [
      csvCell(r.company),
      csvCell(r.title),
      csvCell(r.score),
      csvCell(r.bestResume),
      csvCell(r.status),
      csvCell(new Date(r.date).toISOString().slice(0, 10)),
      csvCell(r.url),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

/** Trigger a CSV download from an extension page (popup/options). */
export function downloadCsv(rows: TrackedApplication[]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-jobby-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
