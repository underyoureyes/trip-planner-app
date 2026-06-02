import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import { GET } from '@/app/api/me/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const sampleProfile = { name: 'David', vehicle_name: 'BMW 530e', vehicle_type: 'car' }

function mockSupabase(user: object | null, profile: object | null = sampleProfile) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile }),
        }),
      }),
    }),
  } as any)
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/me', () => {
  it('returns user id, email and profile when authenticated', async () => {
    mockSupabase({ id: 'user-1', email: 'test@example.com' })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('user-1')
    expect(body.email).toBe('test@example.com')
    expect(body.profile).toEqual(sampleProfile)
  })

  it('returns profile: null when profile query returns nothing', async () => {
    mockSupabase({ id: 'user-1', email: 'test@example.com' }, null)
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).profile).toBeNull()
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })
})
