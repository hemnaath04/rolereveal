import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// RoleReveal runs on every site so it can detect a job posting anywhere. It does
// NOT score random pages: the content script only injects when an adapter
// confirms a real job posting (site-specific selectors, or the generic
// JSON-LD/heading/heuristic gate). That's why GitHub/Gmail stay untouched.
const JOB_SITE_MATCHES = ['<all_urls>'];

/**
 * MV3 manifest for RoleReveal.
 *
 * Key choices:
 * - The background service worker (type: module) makes all LLM network calls.
 *   The API key therefore never enters page/content-script context.
 * - `host_permissions: <all_urls>` lets the *service worker* fetch the chosen
 *   LLM endpoint (Anthropic / OpenAI / custom) without CORS issues. Extension
 *   service workers with host permissions are not blocked by page CORS.
 * - The content script runs on all sites so the overlay can appear on any job
 *   board or generic careers page.
 * - pdf.js worker + overlay assets are exposed as web_accessible_resources.
 */
export default defineManifest({
  manifest_version: 3,
  // Keyword-rich store title (the name field is the top Web Store SEO lever);
  // "RoleReveal" alone is the short brand used in the UI.
  name: 'RoleReveal — AI Job Fit & Resume Match Score',
  version: pkg.version,
  description: pkg.description,
  permissions: ['storage', 'activeTab', 'contextMenus'],
  host_permissions: ['<all_urls>'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'RoleReveal',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: JOB_SITE_MATCHES,
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      // pdf.js worker chunk, lazy-loaded assets, and the logo used in the panel.
      resources: ['assets/*', '*.js', '*.css', 'icons/*'],
      matches: JOB_SITE_MATCHES,
    },
  ],
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
});
