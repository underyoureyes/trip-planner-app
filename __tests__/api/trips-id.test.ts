import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { GET, PATCH, DELETE } from '@/app/api/trips/[id]/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { makeSupabaseMock } from '../helpers/supabase'

const PARAMS = { params: { id: 'trip-123' } }
const OWNER  = { id: 'user-1', email: 'owner@example.com' }
const OTHER  = { id: 'user-2', email: 'other@example.com' }

const TRIP = {
  id: 'trip-123', title: 'Scotland 2026', status: 'ready',
  owner_id: 'user-1', is_shared: false,
  start_date: '2026-05-23', end_date: '2026-06-07', created_at: '2026-01-01',
  intake_form: { title: 'Scotland 2026', num_travellers: 2 },
}
const TRIP_DATA = { data: { days: [{ day_number: 1, stops: [] }] } }

const patchReq = (body: object) =>
  new NextRequest('http://localhost/api/trips/trip-123', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/trips/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(makeSupabaseMock({ tripRow: TRIP }) as any)
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 when trip does not exist', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER }) as any
    )
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 403 when trip belongs to another user and is not shared', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: TRIP }) as any
    )
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(403)
  })

  it('allows a non-owner to view a shared trip', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: { ...TRIP, is_shared: true }, tripDataRow: TRIP_DATA }) as any
    )
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns trip and tripData for the owner', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP, tripDataRow: TRIP_DATA }) as any
    )
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.trip.title).toBe('Scotland 2026')
    expect(body.tripData.days).toHaveLength(1)
  })

  it('returns tripData: null when no trip data exists yet', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP, tripDataRow: null }) as any
    )
    const res = await GET(new NextRequest('http://localhost'), PARAMS)
    expect((await res.json()).tripData).toBeNull()
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/trips/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(makeSupabaseMock() as any)
    const res = await PATCH(patchReq({ title: 'New' }), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not the owner', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: TRIP }) as any
    )
    const res = await PATCH(patchReq({ title: 'Hijacked' }), PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 when trip does not exist', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: null }) as any
    )
    const res = await PATCH(patchReq({ title: 'Anything' }), PARAMS)
    expect(res.status).toBe(403)
  })

  it('updates allowed fields and returns ok', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP }) as any
    )
    const res = await PATCH(patchReq({ title: 'Updated Title', is_shared: true }), PARAMS)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('returns 500 when the update fails', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP, updateError: { message: 'DB error' } }) as any
    )
    const res = await PATCH(patchReq({ title: 'Fail' }), PARAMS)
    expect(res.status).toBe(500)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/trips/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(makeSupabaseMock() as any)
    const res = await DELETE(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not the owner', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: TRIP }) as any
    )
    const res = await DELETE(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(403)
  })

  it('deletes the trip and returns ok', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP }) as any
    )
    const res = await DELETE(new NextRequest('http://localhost'), PARAMS)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
