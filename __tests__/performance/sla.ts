/**
 * Single source of truth for performance SLAs.
 *
 * HANDLER_SLA_MS  — enforced by vitest (runs on every `npm test`).
 *                   Measures route handlers in-process with mocked Supabase.
 *                   Catches regressions in handler logic (loops, missing awaits, heavy compute).
 *                   Values are deliberately generous because there is no real I/O.
 *
 * PRODUCTION_SLA  — enforced by k6 (load tests) and Lighthouse CI.
 *                   Measured against the live/preview deployment.
 */

export const HANDLER_SLA_MS: Record<string, { p50: number; p95: number }> = {
  'GET /api/me':               { p50: 8,  p95: 25 },
  'GET /api/settings':         { p50: 8,  p95: 25 },
  'PUT /api/settings':         { p50: 8,  p95: 25 },
  'GET /api/trips':            { p50: 8,  p95: 25 },
  'POST /api/trips':           { p50: 8,  p95: 25 },
  'GET /api/trips/[id]':       { p50: 8,  p95: 25 },
  'PATCH /api/trips/[id]':     { p50: 8,  p95: 25 },
  'DELETE /api/trips/[id]':    { p50: 8,  p95: 25 },
  'PATCH /api/trips/[id]/data': { p50: 8,  p95: 25 },
}

export const PRODUCTION_SLA = {
  // Core Web Vitals (Google "Good" thresholds)
  lcp_ms:           2500,   // Largest Contentful Paint
  inp_ms:           200,    // Interaction to Next Paint
  cls:              0.1,    // Cumulative Layout Shift
  ttfb_ms:          800,    // Time to First Byte (Vercel edge)

  // Lighthouse score
  perf_score:       80,     // /100

  // API routes (non-AI), measured on live server with k6
  api_p95_ms:       500,    // p95 response time
  api_p99_ms:       1000,   // p99 response time

  // Availability
  error_rate_pct:   1,      // < 1% errors at normal concurrency (5 VUs)
  load_error_rate_pct: 5,   // < 5% errors under load (25 VUs)
} as const
