// ---------------------------------------------------------------------------
// Client-side PDF text extraction with pdf.js. Runs in the options page, so the
// PDF bytes never leave the machine. The worker is bundled by Vite and loaded
// from the extension origin (chrome-extension://), satisfying MV3's CSP.
// ---------------------------------------------------------------------------
import * as pdfjsLib from 'pdfjs-dist';
// `?url` gives a string URL to the bundled worker chunk.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Join text items; pdf.js loses some layout, but it is fine for an LLM.
    const text = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+\n/g, '\n');
    pages.push(text);
  }
  await pdf.destroy();
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
