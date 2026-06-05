import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'
import { recordUsage } from '@/lib/usage'
import type { EmergencyContact, IntakeForm } from '@/lib/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trip } = await supabase
    .from('trips')
    .select('id, owner_id, intake_form')
    .eq('id', params.id)
    .single()

  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (trip.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: settings } = await supabase
    .from('user_settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.claude_api_key) {
    return NextResponse.json({ error: 'No Claude API key configured' }, { status: 403 })
  }

  // Load trip data to get overnight locations
  const { data: tripDataRow } = await supabase
    .from('trip_data')
    .select('data')
    .eq('trip_id', params.id)
    .single()

  if (!tripDataRow?.data) return NextResponse.json({ error: 'No trip data' }, { status: 404 })

  const days = (tripDataRow.data as { days?: { overnight_location?: string }[] }).days || []
  const locations = Array.from(new Set(days.map(d => d.overnight_location).filter(Boolean))) as string[]

  if (locations.length === 0) {
    return NextResponse.json({ error: 'No overnight locations found in trip data' }, { status: 400 })
  }

  const intake = (trip.intake_form || {}) as Partial<IntakeForm>
  const prefs = intake.emergency_prefs?.length
    ? intake.emergency_prefs
    : ['a_and_e', 'walk_in', 'pharmacy']
  const hasPets = Boolean(intake.pets?.trim())
  if (hasPets && !prefs.includes('vet')) prefs.push('vet')

  const typeDescriptions: Record<string, string> = {
    a_and_e:   'A&E (accident & emergency department)',
    walk_in:   'NHS walk-in centre or urgent treatment centre',
    vet:       'emergency or 24hr veterinary clinic',
    pharmacy:  'pharmacy (chemist)',
    breakdown: 'breakdown / roadside assistance number',
    police:    'local police non-emergency number',
  }
  const typeList = ['police', ...prefs].map(t => typeDescriptions[t] || t).join(', ')

  const prompt = `You are generating emergency contact information for a UK road trip.

For each of these overnight locations, find the nearest real services and return accurate contact details.

Overnight locations: ${locations.join(', ')}

For each location include: ${typeList}

Return a JSON array only — no markdown, no explanation:
[
  {
    "name": "<name of the place e.g. York Hospital A&E, Vets4Pets Edinburgh>",
    "type": "<a_and_e|walk_in|vet|hospital|pharmacy|police|breakdown|other>",
    "phone": "<phone number with country/area code>",
    "address": "<full address>",
    "location": "<overnight town this contact serves — must match one of: ${locations.join(', ')}>",
    "notes": "<opening hours, 24hr status, or key note — or null>"
  }
]

Important:
- Use REAL, accurate phone numbers and addresses from your knowledge
- If you are not confident a number is correct, omit the phone field rather than guess
- 999 is UK emergency, 111 is NHS non-emergency — include these as notes where relevant
- For breakdown include the AA (0800 887766) and RAC (0330 159 0740) as general contacts under the first location
- Return the raw JSON array with no surrounding text`

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const start = raw.indexOf('[')
    const end   = raw.lastIndexOf(']')
    if (start === -1 || end === -1) throw new Error('No JSON array in response')

    const contacts = JSON.parse(raw.slice(start, end + 1)) as EmergencyContact[]

    // Merge with existing contacts (keep manually added ones, replace Claude-generated)
    const existing = ((tripDataRow.data as { emergency_contacts?: EmergencyContact[] }).emergency_contacts || [])
      .filter(c => !locations.includes(c.location || ''))  // remove old generated ones for these locations
    const merged = [...existing, ...contacts]

    // Save back to trip_data
    const updated = { ...(tripDataRow.data as object), emergency_contacts: merged }
    await supabase.from('trip_data').update({ data: updated }).eq('trip_id', params.id)

    recordUsage(supabase, {
      userId: user.id, tripId: params.id, endpoint: 'generate-contacts',
      inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
    }).catch(() => {})

    return NextResponse.json({ contacts: merged })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate contacts'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
