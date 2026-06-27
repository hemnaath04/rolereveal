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
      if (container) {
        mo.observe(container, { childList: true, subtree: true });
      } else {
        // No specific container yet — watch the body shallowly until it appears.
        mo.observe(document.body, { childList: true, subtree: true });
      }
      run();
    },
    stop() {
      mo.disconnect();
    },
  };
}
