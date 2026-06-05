import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/claude', () => ({
  createTripStream: vi.fn(),
  parseTripJson: vi.fn(),
}))
vi.mock('@/lib/usage', () => ({ recordUsage: vi.fn().mockResolvedValue(undefined) }))

import { POST } from '@/app/api/trips/[id]/generate/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTripStream, parseTripJson } from '@/lib/claude'
import { makeSupabaseMock, readSSEEvents } from '../helpers/supabase'

function makeStream(textChunks: string[], throwErr?: Error) {
  const events = throwErr
    ? (async function*() { throw throwErr })()
    : (async function*() {
        for (const text of textChunks) {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
        }
      })()
  return Object.assign(events, {
    finalMessage: () => Promise.resolve({ usage: { input_tokens: 100, output_tokens: 200 } }),
  })
}

const PARAMS = { params: { id: 'trip-123' } }
const OWNER  = { id: 'user-1' }
const OTHER  = { id: 'user-2' }
const TRIP   = { id: 'trip-123', owner_id: 'user-1', status: 'draft', intake_form: { title: 'Scotland', num_travellers: 2 } }
const TRIP_DATA = { days: [{ day_number: 1, stops: [], title: 'Day 1', date: '2026-06-01' }] }

const postReq = () => new NextRequest('http://localhost/api/trips/trip-123/generate', { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(parseTripJson).mockReturnValue(TRIP_DATA as any)
})

describe('POST /api/trips/[id]/generate', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(makeSupabaseMock() as any)
    const res = await POST(postReq(), PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 when trip does not exist', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER }) as any
    )
    const res = await POST(postReq(), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 403 when not the owner', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OTHER, tripRow: TRIP }) as any
    )
    const res = await POST(postReq(), PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 when no Claude API key is configured', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({ user: OWNER, tripRow: TRIP, settingsRow: null }) as any
    )
    const res = await POST(postReq(), PARAMS)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/No Claude API key/)
  })

  it('streams SSE events and completes with [DONE]', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({
        user: OWNER, tripRow: TRIP,
        settingsRow: { claude_api_key: 'sk-test' },
      }) as any
    )
    vi.mocked(createTripStream).mockReturnValue(makeStream(['{"days":[{"day_number":1,"stops":[],"date":"2026-06-01","title":"Day 1"}]}']) as any)

    const res = await POST(postReq(), PARAMS)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const events = await readSSEEvents(res)
    const types = events.map(e => e.type)
    expect(types).toContain('progress')
  })

  it('sends error event and sets status to error when JSON parse fails', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({
        user: OWNER, tripRow: TRIP,
        settingsRow: { claude_api_key: 'sk-test' },
      }) as any
    )
    vi.mocked(createTripStream).mockReturnValue(makeStream(['not valid json']) as any)
    vi.mocked(parseTripJson).mockImplementation(() => { throw new Error('bad json') })

    const res = await POST(postReq(), PARAMS)
    const events = await readSSEEvents(res)
    const errorEvt = events.find(e => e.type === 'error')
    expect(errorEvt).toBeDefined()
    expect(String(errorEvt!.message)).toMatch(/parse/)
  })

  it('sends error event when stream throws', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabaseMock({
        user: OWNER, tripRow: TRIP,
        settingsRow: { claude_api_key: 'sk-test' },
      }) as any
    )
    vi.mocked(createTripStream).mockReturnValue(makeStream([], new Error('Claude API down')) as any)

    const res = await POST(postReq(), PARAMS)
    const events = await readSSEEvents(res)
    const errorEvt = events.find(e => e.type === 'error')
    expect(errorEvt).toBeDefined()
    expect(String(errorEvt!.message)).toBe('Claude API down')
  })
})
