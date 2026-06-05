/**
 * Lighthouse CI configuration — Core Web Vitals SLAs
 *
 * Runs automatically in CI via @lhci/cli.
 * Install: npm install --save-dev @lhci/cli
 *
 * Usage (local, against dev server):
 *   npx lhci autorun
 *
 * Usage (against deployed URL):
 *   LHCI_BUILD_CONTEXT__CURRENT_BRANCH=main \
 *   npx lhci autorun --config=lighthouserc.js
 *
 * Set LHCI_SERVER_BASE_URL / LHCI_TOKEN if you use an LHCI server for
 * storing historical results.
 */

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:3000'

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/about`,           // public — no auth
        `${BASE_URL}/login`,           // public
      ],
      numberOfRuns: 3,
      startServerCommand: process.env.LHCI_BASE_URL
        ? undefined                    // skip server start if using remote URL
        : 'npm run start',
      startServerReadyPattern: 'Ready on',
      settings: {
        preset: 'desktop',             // also add 'mobile' preset for mobile SLAs
        throttlingMethod: 'simulate',
        // Disable 3rd-party requests that can't be controlled
        blockedUrlPatterns: [],
      },
    },

    assert: {
      assertions: {
        // ── Core Web Vitals ────────────────────────────────────────────────────
        // Keep in sync with PRODUCTION_SLA in __tests__/performance/sla.ts
        'categories:performance':                    ['error', { minScore: 0.80 }],
        'first-contentful-paint':                    ['warn',  { maxNumericValue: 1800 }],
        'largest-contentful-paint':                  ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':                   ['error', { maxNumericValue: 0.1  }],
        'total-blocking-time':                       ['warn',  { maxNumericValue: 300  }],
        'interactive':                               ['warn',  { maxNumericValue: 3800 }],
        'server-response-time':                      ['error', { maxNumericValue: 800  }],

        // ── Best practices ─────────────────────────────────────────────────────
        'categories:best-practices':                 ['warn',  { minScore: 0.90 }],
        'uses-https':                                ['warn',  {}],

        // ── Accessibility ──────────────────────────────────────────────────────
        'categories:accessibility':                  ['warn',  { minScore: 0.85 }],

        // ── PWA ────────────────────────────────────────────────────────────────
        'installable-manifest':                      ['warn',  {}],
        'service-worker':                            ['warn',  {}],
      },
      // 'error' = fail CI, 'warn' = log but pass
      failOnError: true,
    },

    upload: {
      target: 'temporary-public-storage',
      // Or use an LHCI server:
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_BASE_URL,
      // token: process.env.LHCI_TOKEN,
    },
  },
}
