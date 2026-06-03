import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'

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
      max_tokens: 500,
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
    return NextResponse.json({ updates })
  } catch {
    return NextResponse.json({ updates: {} })
  }
}
