import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getClaudeClient } from '@/lib/claude'
import { recordUsage } from '@/lib/usage'

const MAX_ROWS = 200
const MAX_CHARS = 8000

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

  let csvContent: string
  let description: string
  try {
    const body = await request.json() as { csv?: string; description?: string }
    csvContent = (body.csv || '').trim()
    description = (body.description || '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!csvContent) return NextResponse.json({ error: 'No spreadsheet data provided' }, { status: 400 })

  // Truncate very large spreadsheets
  const truncated = csvContent.length > MAX_CHARS ? csvContent.slice(0, MAX_CHARS) + '\n[... truncated]' : csvContent

  try {
    const client = getClaudeClient(settings.claude_api_key)
    const today = new Date().toISOString().split('T')[0]
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are analysing a spreadsheet that a user has uploaded to help plan a trip.

${description ? `User says: "${description}"\n` : ''}
Spreadsheet content (CSV):
${truncated}

Today's date is ${today}.

Extract trip planning details and return ONLY a JSON object with any fields you can confidently infer:
- "title": short descriptive trip name
- "origin": departure city or location
- "destination": main destination or region
- "start_date": start date in YYYY-MM-DD format. IMPORTANT: if the dates in the spreadsheet are in the past, preserve the same trip duration and seasonal timing but move the dates to the future (same time of year next year, or the nearest upcoming equivalent). Prioritise keeping the structure of the trip intact.
- "end_date": end date in YYYY-MM-DD format (same rule — shift to future if past)
- "num_travellers": number of people as an integer
- "interests": array from ["history","nature","food","adventure","beaches","cities","photography","wildlife","relaxation","nightlife"]
- "accommodation_style": one of "budget", "mid", "luxury", "mix"
- "budget_per_day_gbp": daily budget in GBP as a number
- "driving_max_hours": max daily driving hours as a number
- "must_include": specific places, bookings or stops from the spreadsheet worth keeping (comma-separated, max one sentence)
- "notes": mention if dates were shifted from the original; include any other relevant detail (max one sentence)
- "pets": pets travelling if mentioned (e.g. "2 dogs")

Only include fields you can confidently extract. Return {} if nothing relevant. Output valid JSON only, no markdown.`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1) return NextResponse.json({ fields: {} })

    const fields = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    recordUsage(supabase, {
      userId: user.id, tripId: null, endpoint: 'parse-spreadsheet',
      inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
    }).catch(() => { /* non-fatal */ })
    return NextResponse.json({ fields, rows: csvContent.split('\n').length - 1 })
  } catch {
    return NextResponse.json({ fields: {} })
  }
}
