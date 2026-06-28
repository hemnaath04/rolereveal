import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// RoleReveal auto-runs only on major job boards / ATS platforms. On every other
// site it stays completely inert until the user clicks "Evaluate current tab"
// in the popup, which injects on demand via activeTab + scripting. This keeps
// the extension narrowly scoped (faster Web Store review, no broad host access)
// and prevents false positives on non-job pages (courses, docs, dashboards).
const JOB_SITE_MATCHES = [
  '*://*.linkedin.com/*',
  '*://*.indeed.com/*',
  '*://*.glassdoor.com/*',
  '*://*.ziprecruiter.com/*',
  '*://*.monster.com/*',
  '*://*.dice.com/*',
  '*://*.simplyhired.com/*',
  '*://*.wellfound.com/*',
  '*://*.builtin.com/*',
  '*://*.greenhouse.io/*',
  '*://*.lever.co/*',
  '*://*.myworkdayjobs.com/*',
  '*://*.ashbyhq.com/*',
  '*://*.smartrecruiters.com/*',
  '*://*.icims.com/*',
  '*://*.workable.com/*',
  '*://*.breezy.hr/*',
  '*://*.teamtailor.com/*',
  '*://*.recruitee.com/*',
  '*://*.jobvite.com/*',
  '*://*.bamboohr.com/*',
  '*://*.symplicity.com/*',
];

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
  host_permissions: PROVIDER_HOSTS,
  // For user-supplied custom / self-hosted LLM endpoints — requested at runtime
  // in Options, never at install, so it doesn't widen the review scope.
  optional_host_permissions: ['https://*/*', 'http://*/*'],
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
