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

  let description: string
  try {
    const body = await request.json() as { description?: string }
    description = (body.description || '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!description) return NextResponse.json({ error: 'No description provided' }, { status: 400 })

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Parse this trip description and extract planning details.

Description: "${description}"

Return ONLY a JSON object with any fields you can confidently extract:
- "title": short descriptive trip name (e.g. "Scotland Highlands Road Trip")
- "origin": departure city or location
- "destination": main destination or region
- "start_date": start date in YYYY-MM-DD format
- "end_date": end date in YYYY-MM-DD format
- "num_travellers": number of people as an integer
- "interests": array of strings from: ["history","nature","food","adventure","beaches","cities","photography","wildlife","relaxation","nightlife"]
- "accommodation_style": one of "budget", "mid", "luxury", "mix"
- "budget_per_day_gbp": daily budget in GBP as a number
- "driving_max_hours": max daily driving hours as a number
- "must_include": specific places or experiences to include (one sentence)
- "notes": any other relevant detail (one sentence)
- "pets": description of pets travelling (e.g. "2 dogs") if mentioned

Today's date is ${new Date().toISOString().split('T')[0]}. Only include fields clearly inferable from the description. Return {} if nothing can be extracted. Output valid JSON only, no markdown.`,
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
