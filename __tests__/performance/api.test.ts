/**
 * API handler performance tests.
 *
 * Each test runs a route handler 30 times (after a 3-call warm-up) with
 * mocked Supabase, then asserts p50/p95 against HANDLER_SLA_MS.
 *
 * These run as part of the normal test suite (`npm test`) and fail CI
 * if any SLA is breached. They guard against handler-level regressions —
 * blocking loops, missing awaits, heavy in-process computation — not
 * network latency (that's covered by k6 / Lighthouse CI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { HANDLER_SLA_MS } from './sla'

vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { makeSupabaseMock } from '../helpers/supabase'

// Route handlers — imported once (vi.mock hoisting ensures mocks are in place)
import { GET as getMeHandler }                                                    from '@/app/api/me/route'
import { GET as getSettingsHandler, PUT as putSettingsHandler }                   from '@/app/api/settings/route'
import { GET as getTripsHandler, POST as postTripsHandler }                       from '@/app/api/trips/route'
import { GET as getTripHandler, PATCH as patchTripHandler, DELETE as deleteTripHandler } from '@/app/api/trips/[id]/route'
import { PATCH as patchTripDataHandler }                                          from '@/app/api/trips/[id]/data/route'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER    = { id: 'perf-user-1', email: 'perf@test.com' }
const TRIP    = { id: 'perf-trip-1', owner_id: USER.id, status: 'ready', title: 'Scotland', created_at: new Date().toISOString(), intake_form: { title: 'Scotland', num_travellers: 2 } }
const PROFILE = { user_id: USER.id, full_name: 'Perf Tester', home_town: 'London', vehicle_name: 'Car', vehicle_type: 'car' }
const SETTINGS_ROW = { distance_unit: 'metric', currency: 'GBP', claude_api_key: null }
const TRIP_DATA_ROW = { data: { days: [{ day_number: 1, title: 'Day 1', date: '2026-06-01', stops: [] }] } }

const PARAMS = { params: { id: TRIP.id } }

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(Math.ceil((p / 100) * sorted.length), sorted.length) - 1]
}

async function bench(fn: () => Promise<unknown>, iterations = 30) {
  for (let i = 0; i < 3; i++) await fn()          // warm-up
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(performance.now() - t0)
  }
  return { p50: pct(samples, 50), p95: pct(samples, 95), samples }
}

function assertSLA(route: string, result: { p50: number; p95: number }) {
  const sla = HANDLER_SLA_MS[route]
  if (!sla) throw new Error(`No SLA defined for route "${route}"`)
  expect(
    result.p50,
    `[PERF SLA] ${route} p50=${result.p50.toFixed(2)}ms exceeds ${sla.p50}ms limit`
  ).toBeLessThan(sla.p50)
  expect(
    result.p95,
    `[PERF SLA] ${route} p95=${result.p95.toFixed(2)}ms exceeds ${sla.p95}ms limit`
  ).toBeLessThan(sla.p95)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('API handler performance SLAs', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── /api/me ──────────────────────────────────────────────────────────────────

  it('GET /api/me', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, profileRow: PROFILE }) as any
    )
    const result = await bench(() => getMeHandler())
    assertSLA('GET /api/me', result)
  })

  // ── /api/settings ─────────────────────────────────────────────────────────────

  it('GET /api/settings', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, settingsRow: SETTINGS_ROW }) as any
    )
    const result = await bench(() => getSettingsHandler())
    assertSLA('GET /api/settings', result)
  })

  it('PUT /api/settings', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER }) as any
    )
    const result = await bench(() =>
      putSettingsHandler(new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance_unit: 'metric', currency: 'GBP' }),
      }))
    )
    assertSLA('PUT /api/settings', result)
  })

  // ── /api/trips ────────────────────────────────────────────────────────────────

  it('GET /api/trips', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, listRows: [TRIP] }) as any
    )
    const result = await bench(() => getTripsHandler())
    assertSLA('GET /api/trips', result)
  })

  it('POST /api/trips', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, insertedRow: TRIP }) as any
    )
    const body = JSON.stringify({ title: 'Scotland', start_date: '2026-08-01', end_date: '2026-08-07', num_travellers: 2, interests: [] })
    const result = await bench(() =>
      postTripsHandler(new NextRequest('http://localhost/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }))
    )
    assertSLA('POST /api/trips', result)
  })

  // ── /api/trips/[id] ───────────────────────────────────────────────────────────

  it('GET /api/trips/[id]', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, tripRow: TRIP, tripDataRow: TRIP_DATA_ROW }) as any
    )
    const result = await bench(() =>
      getTripHandler(new NextRequest(`http://localhost/api/trips/${TRIP.id}`), PARAMS)
    )
    assertSLA('GET /api/trips/[id]', result)
  })

  it('PATCH /api/trips/[id]', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, tripRow: TRIP }) as any
    )
    const result = await bench(() =>
      patchTripHandler(
        new NextRequest(`http://localhost/api/trips/${TRIP.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Scotland' }),
        }),
        PARAMS
      )
    )
    assertSLA('PATCH /api/trips/[id]', result)
  })

  it('DELETE /api/trips/[id]', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, tripRow: TRIP }) as any
    )
    const result = await bench(() =>
      deleteTripHandler(new NextRequest(`http://localhost/api/trips/${TRIP.id}`, { method: 'DELETE' }), PARAMS)
    )
    assertSLA('DELETE /api/trips/[id]', result)
  })

  // ── /api/trips/[id]/data ──────────────────────────────────────────────────────

  it('PATCH /api/trips/[id]/data', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: USER, tripRow: TRIP }) as any
    )
    const body = JSON.stringify({ days: [{ day_number: 1, title: 'Day 1', date: '2026-08-01', stops: [] }] })
    const result = await bench(() =>
      patchTripDataHandler(
        new NextRequest(`http://localhost/api/trips/${TRIP.id}/data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        PARAMS
      )
    )
    assertSLA('PATCH /api/trips/[id]/data', result)
  })
})
