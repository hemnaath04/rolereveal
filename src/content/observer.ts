function debounce(fn: () => void, ms: number): () => void {
  let t: number | undefined;
  return () => {
    if (t) clearTimeout(t);
    t = window.setTimeout(fn, ms);
  };
}

/**
 * Observe the results container (not document.body) and call `process`,
 * debounced. The callback must be lightweight — it schedules work, it doesn't do
 * expensive analysis inline. Re-target via the returned `reconnect` when the
 * SPA swaps the container on navigation.
 */
export function createObserver(process: () => void, ms = 150) {
  const run = debounce(process, ms);
  const mo = new MutationObserver(run);
  let current: HTMLElement | null = null;

  return {
    reconnect(container: HTMLElement | null) {
      if (container === current) return;
      mo.disconnect();
      current = container;
      // childList+subtree catches SPA re-renders (right-pane swaps). The filtered
      // attribute watch catches split-pane selection changes that update the
      // detail IN PLACE — clicking another job toggles data-selected/aria-selected
      // /data-jobid on the cards without adding/removing nodes, which would
      // otherwise leave the panel keyed to the previously-selected job (stale).
      // Deliberately NOT watching `class` (hover/animation churn) or characterData.
      const opts: MutationObserverInit = {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'aria-selected',
          'data-selected',
          'data-jobid',
          'data-job-id',
          'data-jk',
          'href',
        ],
      };
      mo.observe(container ?? document.body, opts);
      run();
    },
    stop() {
      mo.disconnect();
    },
  };
}
