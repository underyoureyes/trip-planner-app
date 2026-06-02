import { vi } from 'vitest'

export interface MockConfig {
  user?: object | null
  tripRow?: object | null
  tripError?: object | null
  tripDataRow?: object | null
  settingsRow?: object | null
  profileRow?: object | null
  insertedRow?: object | null
  updateError?: object | null
  deleteError?: object | null
  upsertError?: object | null
  listRows?: object[] | null
  listError?: object | null
}

export function makeSupabaseMock(cfg: MockConfig = {}) {
  const {
    user = null,
    tripRow = null,
    tripError = null,
    tripDataRow = null,
    settingsRow = null,
    profileRow = null,
    insertedRow = null,
    updateError = null,
    deleteError = null,
    upsertError = null,
    listRows = [],
    listError = null,
  } = cfg

  const updateChain = () => ({
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  })

  const deleteChain = () => ({
    eq: vi.fn().mockResolvedValue({ error: deleteError }),
  })

  const fromImpl = (table: string) => {
    const selectImpl = (_cols?: string) => ({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() => {
          if (table === 'trips')         return Promise.resolve({ data: tripRow, error: tripError ?? (tripRow ? null : { message: 'not found' }) })
          if (table === 'trip_data')     return Promise.resolve({ data: tripDataRow, error: null })
          if (table === 'user_settings') return Promise.resolve({ data: settingsRow, error: null })
          if (table === 'profiles')      return Promise.resolve({ data: profileRow, error: null })
          return Promise.resolve({ data: null, error: null })
        }),
        order: vi.fn().mockResolvedValue({ data: listRows, error: listError }),
      }),
      order: vi.fn().mockResolvedValue({ data: listRows, error: listError }),
      single: vi.fn().mockImplementation(() => {
        if (table === 'trips')         return Promise.resolve({ data: tripRow, error: tripError ?? (tripRow ? null : { message: 'not found' }) })
        if (table === 'trip_data')     return Promise.resolve({ data: tripDataRow, error: null })
        if (table === 'user_settings') return Promise.resolve({ data: settingsRow, error: null })
        if (table === 'profiles')      return Promise.resolve({ data: profileRow, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
    })

    return {
      select:  vi.fn().mockImplementation(selectImpl),
      update:  vi.fn().mockReturnValue(updateChain()),
      delete:  vi.fn().mockReturnValue(deleteChain()),
      insert:  vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedRow, error: insertedRow ? null : { message: 'insert failed' } }),
        }),
      }),
      upsert:  vi.fn().mockResolvedValue({ error: upsertError }),
    }
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from:  vi.fn().mockImplementation(fromImpl),
  }
}

/** Read all text from an SSE Response body and return parsed event payloads */
export async function readSSEEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = []
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        try { events.push(JSON.parse(payload)) } catch { /* partial */ }
      }
    }
    buffer = ''
  }
  return events
}
