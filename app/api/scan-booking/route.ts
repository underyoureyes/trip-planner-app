import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('user_settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.claude_api_key) {
    return NextResponse.json({ error: 'No Claude API key configured. Add one in Settings.' }, { status: 403 })
  }

  let photo: string
  try {
    const body = await request.json() as { photo?: string }
    photo = body.photo || ''
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!photo) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })

  const match = photo.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  const [, mediaType, base64Data] = match

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
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
            text: `Extract trip planning details from this booking confirmation image.

Return ONLY a JSON object with any fields you can clearly read:
- "title": short descriptive trip name (e.g. "Scotland Road Trip 2026")
- "destination": destination city or region
- "origin": departure city or location if visible
- "start_date": check-in or arrival date in YYYY-MM-DD format
- "end_date": check-out or departure date in YYYY-MM-DD format
- "num_travellers": number of guests/travellers as an integer
- "notes": any other relevant detail (one sentence max)

Only include fields clearly visible in the image. Return {} if no booking information is found. Output valid JSON only, no markdown.`,
          },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1) return NextResponse.json({ fields: {} })

    const fields = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    return NextResponse.json({ fields })
  } catch {
    return NextResponse.json({ fields: {} })
  }
}
