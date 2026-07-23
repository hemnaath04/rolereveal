import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createObserver } from './observer';

beforeEach(() => {
  document.body.innerHTML = '<main><h1>Loading</h1></main>';
});

describe('content observer', () => {
  it('reprocesses when a framework updates an existing text node in place', async () => {
    const process = vi.fn();
    const observer = createObserver(process, 0);
    observer.reconnect(document.body);
    await vi.waitFor(() => expect(process).toHaveBeenCalled());
    process.mockClear();

    const text = document.querySelector('h1')?.firstChild;
    expect(text).not.toBeNull();
    if (text) text.nodeValue = 'Senior Software Engineer';

    await vi.waitFor(() => expect(process).toHaveBeenCalled());
    observer.stop();
  });
});
