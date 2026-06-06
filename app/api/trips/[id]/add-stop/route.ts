import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'
import { recordUsage } from '@/lib/usage'
import type { TripData, Stop } from '@/lib/types'

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trip } = await supabase
    .from('trips')
    .select('id, owner_id, title, intake_form')
    .eq('id', params.id)
    .single()

  if (!trip || trip.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.claude_api_key) {
    return NextResponse.json({ error: 'No Claude API key configured. Add one in Settings.' }, { status: 403 })
  }

  let body: { dayIndex: number; command: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { dayIndex, command } = body
  if (!command?.trim()) {
    return NextResponse.json({ error: 'Command is required' }, { status: 400 })
  }

  // Load trip data for day context
  const { data: tripDataRow } = await supabase
    .from('trip_data')
    .select('data')
    .eq('trip_id', params.id)
    .single()

  const tripData = tripDataRow?.data as TripData | null
  const day = tripData?.days?.[dayIndex]
  const existingStops = day?.stops
    .filter(s => s.type !== 'drive')
    .map(s => s.name)
    .join(', ') || 'none'

  const intake = trip.intake_form as Record<string, unknown> | null

  const prompt = `You are a road trip planner assistant. Generate a single stop based on this command.

Trip: ${trip.title}
Day ${dayIndex + 1}${day?.title ? `: ${day.title}` : ''}
Overnight at: ${day?.overnight_location || (intake?.destination as string) || 'unknown'}
Existing stops today: ${existingStops}
${intake?.pets ? `Pets travelling: ${intake.pets}` : ''}

Command: "${command.trim()}"

Return ONLY a valid JSON object for a single Stop, no other text:
{
  "name": "<place name>",
  "type": "<sightseeing|activity|viewpoint|restaurant|cafe|pub|beach|nature|castle|distillery|museum|hotel|fuel|other>",
  "description": "<1-2 sentences about this place>",
  "address": "<full address or Town, Region, Postcode>",
  "phone": <phone string or null>,
  "website": <real https:// URL or null>,
  "website_label": <"Book"|"Reserve"|"Website" or null>,
  "duration_mins": <integer 30-240>,
  "suggested": false,
  "dog_friendly": <true if dogs explicitly welcome, false otherwise>,
  "notes": <practical tip string or null>
}`

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract the JSON object robustly
    const firstBrace = raw.indexOf('{')
    const lastBrace  = raw.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1) {
      return NextResponse.json({ error: 'Could not parse Claude response' }, { status: 500 })
    }

    const stop = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Stop
    recordUsage(supabase, {
      userId: user.id, tripId: params.id, endpoint: 'add-stop',
      inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
    }).catch(() => { /* non-fatal */ })
    return NextResponse.json({ stop })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate stop'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
