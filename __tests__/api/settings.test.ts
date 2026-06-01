import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { GET, PUT } from '@/app/api/settings/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const mockUser = { id: 'user-1', email: 'test@example.com' }

function makeQueryBuilder(result: object) {
  const qb: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
  return qb
}

function mockSupabase(user: object | null, queryResult: object) {
  const qb = makeQueryBuilder(queryResult)
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue(qb),
  } as any)
  return qb
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/settings', () => {
  it('returns settings for authenticated user', async () => {
    mockSupabase(mockUser, { data: { distance_unit: 'metric', currency: 'GBP', claude_api_key: 'sk-ant-xxxx' }, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.has_api_key).toBe(true)
    expect(body.distance_unit).toBe('metric')
  })

  it('returns defaults when no settings row exists', async () => {
    mockSupabase(mockUser, { data: null, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.distance_unit).toBe('metric')
    expect(body.currency).toBe('GBP')
    expect(body.has_api_key).toBe(false)
  })

  it('masks the API key hint', async () => {
    mockSupabase(mockUser, { data: { distance_unit: 'metric', currency: 'GBP', claude_api_key: 'sk-ant-api03-abcdef' }, error: null })
    const res = await GET()
    const body = await res.json()
    expect(body.api_key_hint).toContain('…')
    expect(body.api_key_hint).not.toContain('abcdef')
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null, {})
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

describe('PUT /api/settings', () => {
  function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('updates settings successfully', async () => {
    const qb = mockSupabase(mockUser, { data: null, error: null })
    const res = await PUT(makeRequest({ distance_unit: 'imperial', currency: 'USD' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects invalid distance_unit', async () => {
    mockSupabase(mockUser, {})
    const res = await PUT(makeRequest({ distance_unit: 'furlongs' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('distance_unit')
  })

  it('uppercases currency', async () => {
    const qb = mockSupabase(mockUser, { data: null, error: null })
    await PUT(makeRequest({ currency: 'eur' }))
    expect(qb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'EUR' }),
      expect.anything()
    )
  })

  it('trims claude_api_key and stores null for empty string', async () => {
    const qb = mockSupabase(mockUser, { data: null, error: null })
    await PUT(makeRequest({ claude_api_key: '   ' }))
    expect(qb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ claude_api_key: null }),
      expect.anything()
    )
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null, {})
    const res = await PUT(makeRequest({ distance_unit: 'metric' }))
    expect(res.status).toBe(401)
  })

  it('returns 500 on upsert error', async () => {
    const qb = makeQueryBuilder({})
    qb.upsert = vi.fn().mockResolvedValue({ error: { message: 'DB error' } })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue(qb),
    } as any)
    const res = await PUT(makeRequest({ distance_unit: 'metric' }))
    expect(res.status).toBe(500)
  })
})
