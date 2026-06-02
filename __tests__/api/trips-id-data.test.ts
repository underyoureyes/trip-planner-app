import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { PATCH } from '@/app/api/trips/[id]/data/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { makeSupabaseMock } from '../helpers/supabase'

const PARAMS  = { params: { id: 'trip-123' } }
const OWNER   = { id: 'user-1' }
const OTHER   = { id: 'user-2' }
const TRIP    = { id: 'trip-123', owner_id: 'user-1' }
const PAYLOAD = { days: [{ day_number: 1, stops: [] }], total_days: 1 }

const patchReq = (body: unknown) =>
  new NextRequest('http://localhost/api/trips/trip-123/data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/trips/[id]/data', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(makeSupabaseMock() as any)
    const res = await PATCH(patchReq(PAYLOAD), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not the trip owner', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: TRIP }) as any
    )
    const res = await PATCH(patchReq(PAYLOAD), PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 when trip does not exist', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER }) as any
    )
    const res = await PATCH(patchReq(PAYLOAD), PARAMS)
    expect(res.status).toBe(403)
  })

  it('saves trip data and returns ok', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP }) as any
    )
    const res = await PATCH(patchReq(PAYLOAD), PARAMS)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('returns 500 when update fails', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP, updateError: { message: 'DB error' } }) as any
    )
    const res = await PATCH(patchReq(PAYLOAD), PARAMS)
    expect(res.status).toBe(500)
  })
})
