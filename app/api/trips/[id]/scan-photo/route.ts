import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'
import { recordUsage } from '@/lib/usage'

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
    .select('owner_id')
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
    return NextResponse.json({ updates: {} })
  }

  let body: { photo: string; stopType: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { photo, stopType } = body
  if (!photo) return NextResponse.json({ updates: {} })

  // Strip data URL prefix to get raw base64
  const match = photo.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return NextResponse.json({ updates: {} })
  const [, mediaType, base64Data] = match

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Extract booking and location details visible in this image. This is for a "${stopType}" stop on a road trip.

Return ONLY a JSON object containing fields you can clearly read from the image. Use these exact field names:
- "name": business or place name
- "address": full address
- "phone": phone number
- "check_in": check-in time in "HH:MM" 24h format (hotels only)
- "check_out": check-out time in "HH:MM" 24h format (hotels only)
- "booking_ref": booking or confirmation reference/number
- "website": website URL if visible
- "cancellation_policy": cancellation terms as a short human-readable string, e.g. "Free cancellation until 14 Jun 2026", "Non-refundable", "Free cancellation until 3 days before arrival" (hotels only)
- "pay_at_hotel": true if the booking states "pay at hotel", "pay on arrival", or similar; false if prepaid or deposit paid (hotels only, boolean)
- "notes": any other important detail (max one sentence)

Only include fields you can clearly read. Omit fields that are not visible. Return {} if the image contains no booking or location information. Output valid JSON only, no markdown.`,
          },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1) return NextResponse.json({ updates: {} })

    const updates = JSON.parse(raw.slice(start, end + 1))
    recordUsage(supabase, {
      userId: user.id, tripId: params.id, endpoint: 'scan-photo',
      inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
    }).catch(() => { /* non-fatal */ })
    return NextResponse.json({ updates })
  } catch {
    return NextResponse.json({ updates: {} })
  }
}
