// Minimal chrome.* stub so modules that touch chrome at import time (ui.ts uses
// chrome.runtime.getURL; getOrCreateDetailsHost reads chrome.runtime.id) load in
// jsdom without a real extension runtime.
const chromeStub = {
  runtime: {
    id: 'test-extension-id',
    getURL: (p: string) => `chrome-extension://test-extension-id/${p}`,
    getManifest: () => ({ content_scripts: [{ js: ['src/content/index.ts'] }] }),
    sendMessage: () => Promise.resolve(undefined),
    onMessage: { addListener: () => {} },
  },
  storage: {
    onChanged: { addListener: () => {} },
    local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
    session: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
  },
  tabs: { onRemoved: { addListener: () => {} } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = chromeStub;
