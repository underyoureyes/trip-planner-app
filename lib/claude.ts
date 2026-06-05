import Anthropic from '@anthropic-ai/sdk'
import type { IntakeForm, TripData } from './types'

export function getClaudeClient(apiKey: string) {
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are an expert road trip planner specialising in UK and European road trips.
Generate a detailed, day-by-day itinerary as a single JSON object.

CRITICAL RULES:
- Output ONLY valid JSON — no markdown, no explanations, no code fences
- Follow the schema exactly — every field matters
- Every stop must include a real address or at minimum a town/region
- Balance driving and activities sensibly — respect the max_driving_hours constraint
- Realistic drive times (not Google Maps "no traffic" estimates)
- All website URLs must be real https:// links or null — no invented URLs
- Hotel stops MUST include check_in and check_out times matching the traveller's preferences
- Mark genuinely optional bonus stops with "suggested": true — these are extras the user may skip
- Required stops (hotel, fuel, must-visit places) must have "suggested": false or omit the field
- Mark stops that explicitly welcome dogs with "dog_friendly": true (beaches, parks, pubs, dog-friendly cafes)
- For each day set "activity_badges" to 1-3 emoji that characterise the day (e.g. ["🏰","🌿"] for a heritage/nature day)
- Estimate "steps" (integer) and "walking_km" (number) per day based on planned activities
- Add "sections" for any day that warrants extra categorised notes (dog tips, cycling notes, tide times, etc.)
- Include "emergency_contacts" at trip level: always add local hospitals and police; add vets if pets are travelling
- Set "website_label" on stops to "Book" for accommodation/tours that need reservations, "Reserve" for restaurants, "Website" for general info, or omit for null
- Set "cost" on eating items to estimated cost per person e.g. "~£15pp", "Free", "€30-40pp"
- Mark 1-2 days as "highlight": true — the most special or scenic day(s) of the trip (shown in gold in the app)`

export function buildTripPrompt(form: IntakeForm): string {
  const startMs = new Date(form.start_date).getTime()
  const endMs = new Date(form.end_date).getTime()
  const days = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1)

  const checkIn = form.preferred_check_in || '15:00'
  const checkOut = form.preferred_check_out || '10:00'

  return `Plan a ${days}-day road trip:

TITLE: ${form.title}
FROM: ${form.origin}
TO: ${form.destination}
DATES: ${form.start_date} to ${form.end_date} (${days} days)
TRAVELLERS: ${form.num_travellers}
INTERESTS: ${form.interests.length ? form.interests.join(', ') : 'general sightseeing'}
ACCOMMODATION: ${form.accommodation_style}
BUDGET: £${form.budget_per_day_gbp}/day per person
MAX DRIVING: ${form.driving_max_hours}h/day
PREFERRED CHECK-IN: ${checkIn} (use this time for all hotel check_in fields)
PREFERRED CHECK-OUT: ${checkOut} (use this time for all hotel check_out fields)
${form.pets ? `PETS: ${form.pets} — mark dog-friendly stops, include vet emergency contacts` : ''}
${form.must_include ? `MUST INCLUDE: ${form.must_include}` : ''}
${form.notes ? `NOTES: ${form.notes}` : ''}

For each day include:
- All driving legs as stops with type "drive"
- The hotel/accommodation as a stop with type "hotel"
- 2-4 main activities (suggested: false)
- 1-2 optional bonus activities the user can skip (suggested: true)
- Eating suggestions for breakfast, lunch and dinner

Output exactly this JSON structure:
{
  "summary": "<one sentence trip summary>",
  "total_days": ${days},
  "total_distance_km": <estimated total km as number>,
  "total_stops": <number of non-drive stops>,
  "days": [
    {
      "day_number": 1,
      "date": "${form.start_date}",
      "title": "<catchy day title>",
      "overnight_location": "<town name>",
      "activity_badges": ["<emoji1>", "<emoji2>"],
      "highlight": <true for the 1-2 most special/scenic days, omit or false otherwise>,
      "steps": <estimated steps as integer e.g. 8000>,
      "walking_km": <estimated walking km e.g. 5.5>,
      "stops": [
        {
          "name": "<stop name>",
          "type": "<drive|hotel|sightseeing|activity|viewpoint|town|restaurant|cafe|pub|beach|nature|castle|distillery|museum|fuel|other>",
          "description": "<1-2 sentences>",
          "address": "<full address or town, region>",
          "phone": "<phone number or null>",
          "website": "<real https:// url or null>",
          "website_label": "<'Book'|'Reserve'|'Website' or omit if no website>",
          "duration_mins": <minutes at this stop, 0 for drives>,
          "suggested": <true for optional extras, false or omit for required stops>,
          "dog_friendly": <true if dogs explicitly welcome, omit otherwise>,
          "drive_time_mins": <only for type=drive>,
          "distance_km": <only for type=drive>,
          "check_in": "<only for type=hotel, e.g. ${checkIn}>",
          "check_out": "<only for type=hotel, e.g. ${checkOut}>",
          "booking_ref": null,
          "notes": "<practical tip or null>"
        }
      ],
      "eating": [
        {
          "name": "<place name>",
          "meal_type": "<breakfast|lunch|dinner|snack>",
          "description": "<brief description>",
          "address": "<address>",
          "website": "<https:// url or null>",
          "booking_required": <true|false>,
          "suggested": <true for optional, false for recommended>,
          "cost": "<estimated cost per person e.g. '~£15pp', 'Free', or null>"
        }
      ],
      "notes": "<general day tips or null>",
      "sections": [
        {
          "emoji": "<single emoji>",
          "title": "<section title e.g. Dog Tips, Cycling Notes, Tide Times>",
          "content": "<paragraph or newline-separated tips>"
        }
      ]
    }
  ],
  "emergency_contacts": [
    {
      "name": "<name of service e.g. Inverness Hospital>",
      "type": "<vet|hospital|police|pharmacy|breakdown|other>",
      "phone": "<phone number>",
      "address": "<address or null>",
      "notes": "<any relevant note or null>"
    }
  ]
}`
}

export async function* streamTripGeneration(
  apiKey: string,
  form: IntakeForm
): AsyncGenerator<string> {
  const client = getClaudeClient(apiKey)

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildTripPrompt(form) }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}

export function createTripStream(apiKey: string, form: IntakeForm) {
  const client = getClaudeClient(apiKey)
  return client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildTripPrompt(form) }],
  })
}

export function parseTripJson(raw: string): TripData {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned) as TripData
}

export async function validateClaudeKey(apiKey: string): Promise<boolean> {
  try {
    const client = getClaudeClient(apiKey)
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    return true
  } catch {
    return false
  }
}
