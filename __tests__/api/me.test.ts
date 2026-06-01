import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { GET } from '@/app/api/me/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function mockSupabase(user: object | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as any)
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/me', () => {
  it('returns user id and email when authenticated', async () => {
    mockSupabase({ id: 'user-1', email: 'test@example.com' })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'user-1', email: 'test@example.com' })
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })
})
