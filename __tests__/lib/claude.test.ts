import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IntakeForm } from '@/lib/types'

const mockCreate = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockStreamChunks = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: mockCreate,
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: mockStreamChunks,
        }),
      },
    }
  }),
}))

import { buildTripPrompt, parseTripJson, getClaudeClient, streamTripGeneration, validateClaudeKey } from '@/lib/claude'

const sampleForm: IntakeForm = {
  title: 'Scottish Highlands',
  origin: 'Edinburgh',
  destination: 'Inverness',
  start_date: '2026-07-01',
  end_date: '2026-07-05',
  num_travellers: 2,
  interests: ['castles', 'whisky'],
  accommodation_style: 'mid',
  budget_per_day_gbp: 150,
  driving_max_hours: 4,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({})
})

describe('buildTripPrompt', () => {
  it('includes trip details', () => {
    const prompt = buildTripPrompt(sampleForm)
    expect(prompt).toContain('Scottish Highlands')
    expect(prompt).toContain('Edinburgh')
    expect(prompt).toContain('Inverness')
    expect(prompt).toContain('5-day')
  })

  it('uses default check-in/out times', () => {
    const prompt = buildTripPrompt(sampleForm)
    expect(prompt).toContain('15:00')
    expect(prompt).toContain('10:00')
  })

  it('uses provided check-in/out times', () => {
    const prompt = buildTripPrompt({ ...sampleForm, preferred_check_in: '14:00', preferred_check_out: '11:00' })
    expect(prompt).toContain('14:00')
    expect(prompt).toContain('11:00')
  })

  it('lists interests', () => {
    const prompt = buildTripPrompt(sampleForm)
    expect(prompt).toContain('castles, whisky')
  })

  it('uses none and no-sightseeing instruction when no interests selected', () => {
    const prompt = buildTripPrompt({ ...sampleForm, interests: [] })
    expect(prompt).toContain('none — do NOT add')
  })

  it('includes must_include when provided', () => {
    const prompt = buildTripPrompt({ ...sampleForm, must_include: 'Loch Ness' })
    expect(prompt).toContain('Loch Ness')
  })

  it('includes notes when provided', () => {
    const prompt = buildTripPrompt({ ...sampleForm, notes: 'Dog-friendly stops' })
    expect(prompt).toContain('Dog-friendly stops')
  })

  it('includes pets when provided', () => {
    const prompt = buildTripPrompt({ ...sampleForm, pets: '2 dogs' })
    expect(prompt).toContain('2 dogs')
  })

  it('omits pets line when not provided', () => {
    const prompt = buildTripPrompt({ ...sampleForm, pets: undefined })
    expect(prompt).not.toContain('PETS:')
  })

  it('calculates days from dates', () => {
    const form = { ...sampleForm, start_date: '2026-07-01', end_date: '2026-07-03' }
    const prompt = buildTripPrompt(form)
    expect(prompt).toContain('3-day')
  })
})

describe('parseTripJson', () => {
  it('parses plain JSON', () => {
    const result = parseTripJson('{"days":[{"day_number":1,"stops":[]}]}')
    expect(result.days).toHaveLength(1)
  })

  it('strips ```json fences', () => {
    const result = parseTripJson('```json\n{"days":[]}\n```')
    expect(result.days).toHaveLength(0)
  })

  it('strips plain ``` fences', () => {
    const result = parseTripJson('```\n{"days":[]}\n```')
    expect(result.days).toHaveLength(0)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseTripJson('not json')).toThrow()
  })
})

describe('getClaudeClient', () => {
  it('returns a client instance', () => {
    const client = getClaudeClient('sk-test-key')
    expect(client).toBeDefined()
    expect(client.messages).toBeDefined()
  })
})

describe('streamTripGeneration', () => {
  it('yields text chunks from the stream', async () => {
    mockStreamChunks.mockImplementation(async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '{"days"' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ':[]}' } }
      yield { type: 'message_stop' }
    })

    const chunks: string[] = []
    for await (const chunk of streamTripGeneration('sk-test', sampleForm)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['{"days"', ':[]}'])
  })

  it('skips non-text-delta events', async () => {
    mockStreamChunks.mockImplementation(async function* () {
      yield { type: 'message_start' }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } }
      yield { type: 'content_block_stop' }
    })

    const chunks: string[] = []
    for await (const chunk of streamTripGeneration('sk-test', sampleForm)) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['hello'])
  })
})

describe('validateClaudeKey', () => {
  it('returns true when API call succeeds', async () => {
    expect(await validateClaudeKey('valid-key')).toBe(true)
  })

  it('returns false when API call throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Invalid API key'))
    expect(await validateClaudeKey('bad-key')).toBe(false)
  })
})
