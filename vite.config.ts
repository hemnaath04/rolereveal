import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

// @crxjs handles bundling the MV3 service worker, content script (as IIFE so it
// can be injected), and the React HTML pages, plus rewriting the manifest paths.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2021',
    // Keep chunk names stable-ish; crx manages content script output format.
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  // Required so crxjs HMR websocket works in `vite dev` for MV3.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
