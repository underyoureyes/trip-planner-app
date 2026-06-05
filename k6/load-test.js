/**
 * k6 load test — Trip Planner API
 *
 * Tests non-AI API routes against production SLAs.
 * Requires k6 installed: https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   BASE_URL=https://your-app.vercel.app k6 run k6/load-test.js
 *
 * Scenarios:
 *   smoke  — 1 VU × 1 min  (sanity check)
 *   normal — 5 VUs × 3 min (steady-state SLA check)
 *   load   — ramp to 25 VUs (peak load SLA check)
 *
 * The script exits non-zero if any threshold is breached, failing CI.
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── SLAs (keep in sync with __tests__/performance/sla.ts) ────────────────────

const SLA = {
  api_p95_ms:          500,
  api_p99_ms:          1000,
  error_rate_pct:      0.01,   // 1%
  load_error_rate_pct: 0.05,   // 5%
}

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Auth credentials for a test account (set as env vars — never hardcode)
// k6 run -e EMAIL=test@example.com -e PASSWORD=testpass k6/load-test.js
const EMAIL    = __ENV.EMAIL    || ''
const PASSWORD = __ENV.PASSWORD || ''

// ── Custom metrics ─────────────────────────────────────────────────────────────

const errorRate = new Rate('http_errors')
const apiTrend  = new Trend('api_response_ms', true)

// ── Thresholds (these cause non-zero exit if breached) ────────────────────────

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    normal: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      startTime: '35s',
      tags: { scenario: 'normal' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 25 },
        { duration: '2m', target: 25 },
        { duration: '1m', target: 0 },
      ],
      startTime: '4m15s',
      tags: { scenario: 'load' },
    },
  },

  thresholds: {
    // p95 under normal concurrency
    'api_response_ms{scenario:normal}': [
      { threshold: `p(95)<${SLA.api_p95_ms}`, abortOnFail: false },
      { threshold: `p(99)<${SLA.api_p99_ms}`, abortOnFail: false },
    ],
    // p95 under peak load (more lenient)
    'api_response_ms{scenario:load}': [
      { threshold: `p(95)<${SLA.api_p95_ms * 2}`, abortOnFail: false },
    ],
    // Error rates
    'http_errors{scenario:normal}': [`rate<${SLA.error_rate_pct}`],
    'http_errors{scenario:load}':   [`rate<${SLA.load_error_rate_pct}`],
    // Always: overall p95
    'http_req_duration': [`p(95)<${SLA.api_p95_ms * 2}`],
  },
}

// ── Auth helper ───────────────────────────────────────────────────────────────

let _token = null

function getAuthToken() {
  if (_token) return _token
  if (!EMAIL || !PASSWORD) return null

  const res = http.post(
    `${BASE_URL}/api/auth/token`,  // Supabase auth endpoint via your API
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  if (res.status === 200) {
    try { _token = JSON.parse(res.body).access_token } catch { /* ignore */ }
  }
  return _token
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const token = getAuthToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// ── Shared trip ID (created once, reused) ─────────────────────────────────────

let _sharedTripId = null

function ensureSharedTrip() {
  if (_sharedTripId) return _sharedTripId

  // Try to get existing trips first
  const listRes = http.get(`${BASE_URL}/api/trips`, { headers: headers() })
  if (listRes.status === 200) {
    try {
      const trips = JSON.parse(listRes.body)
      if (Array.isArray(trips) && trips.length > 0) {
        // Find a shared one or use first
        const shared = trips.find(t => t.is_shared) || trips[0]
        _sharedTripId = shared.id
        return _sharedTripId
      }
    } catch { /* ignore */ }
  }
  return null
}

// ── Main VU function ──────────────────────────────────────────────────────────

export default function () {
  const h = headers()

  // ── Public routes (no auth required) ──────────────────────────────────────

  group('public pages', () => {
    const aboutRes = http.get(`${BASE_URL}/about`, { tags: { route: 'about' } })
    record(aboutRes, 'GET /about')

    // Shared trip — if we know one
    const tripId = ensureSharedTrip()
    if (tripId) {
      const tripRes = http.get(`${BASE_URL}/trips/${tripId}?from_about=1`, { tags: { route: 'trip-viewer' } })
      record(tripRes, 'GET /trips/[id]')
    }
  })

  sleep(0.5)

  // ── Authenticated API routes ───────────────────────────────────────────────

  if (!EMAIL || !PASSWORD) {
    // No credentials supplied — only test unauthenticated public endpoints
    return
  }

  group('api: me + settings', () => {
    record(http.get(`${BASE_URL}/api/me`,       { headers: h }), 'GET /api/me')
    record(http.get(`${BASE_URL}/api/settings`, { headers: h }), 'GET /api/settings')
    record(http.get(`${BASE_URL}/api/usage`,    { headers: h }), 'GET /api/usage')
  })

  sleep(0.2)

  group('api: trips', () => {
    const listRes = http.get(`${BASE_URL}/api/trips`, { headers: h })
    record(listRes, 'GET /api/trips')

    // Read first trip
    let tripId
    try {
      const trips = JSON.parse(listRes.body)
      if (Array.isArray(trips) && trips.length > 0) tripId = trips[0].id
    } catch { /* ignore */ }

    if (tripId) {
      record(http.get(`${BASE_URL}/api/trips/${tripId}`,      { headers: h }), 'GET /api/trips/[id]')
      record(http.get(`${BASE_URL}/api/trips/${tripId}/data`, { headers: h }), 'GET /api/trips/[id]/data')
    }
  })

  sleep(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function record(res, label) {
  const ok = res.status >= 200 && res.status < 400
  errorRate.add(!ok)
  apiTrend.add(res.timings.duration)

  check(res, {
    [`${label} status 2xx/3xx`]: r => r.status >= 200 && r.status < 400,
    [`${label} response time < ${SLA.api_p95_ms * 2}ms`]: r => r.timings.duration < SLA.api_p95_ms * 2,
  })
}
