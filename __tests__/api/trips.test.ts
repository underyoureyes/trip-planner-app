import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { GET, POST } from '@/app/api/trips/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const mockUser = { id: 'user-1', email: 'test@example.com' }

function makeQueryBuilder(result: object) {
  const qb: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
  }
  return qb
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/trips', () => {
  it('returns trips list for authenticated user', async () => {
    const trips = [{ id: 'trip-1', title: 'Highlands', status: 'ready' }]
    const qb = makeQueryBuilder({ data: trips, error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue(qb),
    } as any)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(trips)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 on database error', async () => {
    const qb = makeQueryBuilder({ data: null, error: { message: 'DB error' } })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue(qb),
    } as any)
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/trips', () => {
  const validForm = {
    title: 'Highlands Trip',
    origin: 'Edinburgh',
    destination: 'Inverness',
    start_date: '2026-07-01',
    end_date: '2026-07-05',
    num_travellers: 2,
    interests: ['castles'],
    accommodation_style: 'mid',
    budget_per_day_gbp: 150,
    driving_max_hours: 4,
  }

  function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  function mockSupabaseWithSettings(hasKey: boolean, insertResult: object) {
    const settingsQb = makeQueryBuilder({
      data: hasKey ? { claude_api_key: 'sk-test' } : null,
      error: null,
    })
    const tripsQb = makeQueryBuilder(insertResult)
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn()
        .mockReturnValueOnce(settingsQb)
        .mockReturnValueOnce(tripsQb),
    } as any)
    return tripsQb
  }

  it('creates a trip and returns its id', async () => {
    mockSupabaseWithSettings(true, { data: { id: 'new-trip-id' }, error: null })
    const res = await POST(makeRequest(validForm))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('new-trip-id')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const res = await POST(makeRequest(validForm))
    expect(res.status).toBe(401)
  })

  it('returns 403 when no Claude API key configured', async () => {
    mockSupabaseWithSettings(false, {})
    const res = await POST(makeRequest(validForm))
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing title', async () => {
    mockSupabaseWithSettings(true, {})
    const res = await POST(makeRequest({ ...validForm, title: '' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Title')
  })

  it('returns 400 for missing origin', async () => {
    mockSupabaseWithSettings(true, {})
    const res = await POST(makeRequest({ ...validForm, origin: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing destination', async () => {
    mockSupabaseWithSettings(true, {})
    const res = await POST(makeRequest({ ...validForm, destination: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const qb = makeQueryBuilder({ data: { claude_api_key: 'sk-test' }, error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue(qb),
    } as any)
    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    mockSupabaseWithSettings(true, { data: null, error: { message: 'Insert failed' } })
    const res = await POST(makeRequest(validForm))
    expect(res.status).toBe(500)
  })
})
