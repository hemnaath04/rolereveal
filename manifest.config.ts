import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';
import { MATCH_PATTERNS } from './src/config/patterns';

// Auto-run sites come straight from src/config/job-sites.json (validated +
// de-duplicated in src/config/patterns.ts) — the single source of truth. There
// is no second copy of the patterns here. On every other site RoleReveal stays
// inert until the user clicks "Run Role Reveal on this job" (activeTab +
// scripting), so the extension never needs broad host access.
const JOB_SITE_MATCHES = MATCH_PATTERNS;

// The LLM endpoints the background service worker is allowed to call. Scoped to
// the built-in proxy + each supported provider (and localhost for Ollama) so we
// never need broad host access just to score a job. Custom/self-hosted base URLs
// are covered by optional_host_permissions, requested at runtime in Options.
const PROVIDER_HOSTS = [
  'https://ai-jobby-backend.vercel.app/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.groq.com/*',
  'https://openrouter.ai/*',
  'https://api.deepseek.com/*',
  'https://api.x.ai/*',
  'https://api.mistral.ai/*',
  'https://api.together.xyz/*',
  'https://api.fireworks.ai/*',
  'https://api.perplexity.ai/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
];

/**
 * MV3 manifest for RoleReveal.
 *
 * - The background service worker makes all LLM calls; the API key never enters
 *   page/content-script context. host_permissions is limited to the provider
 *   endpoints so those fetches aren't blocked by CORS.
 * - Auto content-script injection is limited to JOB_SITE_MATCHES. For any other
 *   site, the popup injects the content script on demand using activeTab +
 *   scripting (a user gesture), so the user can still score any page.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'RoleReveal — AI Job Fit & Resume Match Score',
  version: pkg.version,
  description: pkg.description,
  permissions: ['storage', 'activeTab', 'contextMenus', 'scripting'],
  // Scoped to the LLM provider endpoints only (built-in proxy + supported
  // providers + localhost for Ollama). No broad host access — this keeps the
  // extension off the Web Store's "in-depth review" path.
  host_permissions: PROVIDER_HOSTS,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'RoleReveal',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
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
      // pdf.js worker chunk, lazy-loaded assets, the logo, and the content
      // bundle (so on-demand injection can load its chunks on any site).
      resources: ['assets/*', '*.js', '*.css', 'icons/*'],
      matches: ['<all_urls>'],
    },
  ],
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
});
