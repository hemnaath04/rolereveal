import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobSiteAdapter } from './adapters/types';
import { processSelectedJobDetails, resetDetailsState } from './injector';
import { detailsHost, getOrCreateDetailsHost, removeDetailsHost } from './ui';

const LONG_DESC =
  'We are hiring a senior software engineer to build reliable products. ' +
  'You will design systems, write tests, collaborate with teammates, and ship features. '.repeat(6);

function makeAdapter(jobId: string): JobSiteAdapter {
  return {
    site: 'test-board',
    dedicated: true,
    isSupportedPage: () => true,
    matches: () => true,
    getResultsContainer: () => null,
    getJobCards: () => [],
    getJobId: () => null,
    extractJobSummary: () => null,
    findCardInsertionPoint: () => null,
    findDetailsPanel: () => document.querySelector<HTMLElement>('#job-panel'),
    findDetailsInsertionPoint: () => document.querySelector<HTMLElement>('#job-description'),
    findDetailsJobId: () => jobId,
    extractDetailsSummary: () => ({
      id: jobId,
      title: 'Senior Software Engineer',
      company: 'Acme',
      url: location.href,
    }),
    extractFullJobDescription: () => LONG_DESC,
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <main id="job-panel">
      <section id="job-description">${LONG_DESC}</section>
    </main>
  `;
  removeDetailsHost();
  resetDetailsState();
  vi.restoreAllMocks();
});

describe('selected-job overlay lifecycle', () => {
  it('mounts after the asynchronous dismissal check without another DOM mutation', async () => {
    const sendMessage = vi
      .spyOn(chrome.runtime, 'sendMessage')
      .mockResolvedValue({ dismissed: false });
    const adapter = makeAdapter('async-dismiss-check');

    processSelectedJobDetails(adapter);
    expect(detailsHost()).toBeNull();

    await vi.waitFor(() => expect(detailsHost()?.dataset.jobId).toBe('async-dismiss-check'));
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'IS_DISMISSED',
      url: 'test-board:async-dismiss-check',
    });
  });

  it('removes a previous job panel when the newly selected job is dismissed', async () => {
    const stale = getOrCreateDetailsHost();
    stale.dataset.jobId = 'previous-job';
    document.body.appendChild(stale);
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ dismissed: true });

    processSelectedJobDetails(makeAdapter('dismissed-new-job'));

    await vi.waitFor(() => expect(detailsHost()).toBeNull());
  });
});
