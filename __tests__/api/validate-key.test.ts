import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockValidateClaudeKey = vi.hoisted(() => vi.fn())

vi.mock('@/lib/claude', () => ({
  validateClaudeKey: mockValidateClaudeKey,
}))

import { POST } from '@/app/api/settings/validate-key/route'

beforeEach(() => vi.clearAllMocks())

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/settings/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/settings/validate-key', () => {
  it('returns valid: true for a good key', async () => {
    mockValidateClaudeKey.mockResolvedValue(true)
    const res = await POST(makeRequest({ apiKey: 'sk-ant-valid' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ valid: true })
  })

  it('returns valid: false for a bad key', async () => {
    mockValidateClaudeKey.mockResolvedValue(false)
    const res = await POST(makeRequest({ apiKey: 'sk-bad' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ valid: false })
  })

  it('returns 400 when apiKey is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('apiKey required')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/settings/validate-key', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('trims whitespace from api key', async () => {
    mockValidateClaudeKey.mockResolvedValue(true)
    await POST(makeRequest({ apiKey: '  sk-ant-key  ' }))
    expect(mockValidateClaudeKey).toHaveBeenCalledWith('sk-ant-key')
  })
})
