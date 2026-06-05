import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createTripStream, parseTripJson } from '@/lib/claude'
import { recordUsage } from '@/lib/usage'
import type { IntakeForm } from '@/lib/types'

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, owner_id, status, intake_form')
    .eq('id', params.id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  if (trip.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.claude_api_key) {
    return NextResponse.json({ error: 'No Claude API key configured' }, { status: 403 })
  }

  await supabase.from('trips').update({ status: 'generating' }).eq('id', params.id)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEvent(data)))
      }

      try {
        send({ type: 'progress', message: 'Connecting to Claude…' })

        let rawJson = ''
        let chunkCount = 0

        const claudeStream = createTripStream(settings.claude_api_key, trip.intake_form as IntakeForm)
        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            rawJson += chunk.delta.text
            chunkCount++
            if (chunkCount % 50 === 0) {
              send({ type: 'progress', message: `Generating… (${Math.round(rawJson.length / 1000)}k chars)` })
            }
          }
        }
        const finalMsg = await claudeStream.finalMessage()
        recordUsage(supabase, {
          userId: user.id,
          tripId: params.id,
          endpoint: 'generate',
          inputTokens:  finalMsg.usage.input_tokens,
          outputTokens: finalMsg.usage.output_tokens,
        }).catch(() => { /* non-fatal */ })

        send({ type: 'progress', message: 'Parsing itinerary…' })

        let tripData
        try {
          tripData = parseTripJson(rawJson)
        } catch (parseErr) {
          await supabase.from('trips').update({ status: 'error' }).eq('id', params.id)
          send({ type: 'error', message: 'Failed to parse Claude response. Please retry.' })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const { error: saveError } = await supabase
          .from('trip_data')
          .upsert({ trip_id: params.id, data: tripData, version: 1 })

        if (saveError) {
          await supabase.from('trips').update({ status: 'error' }).eq('id', params.id)
          send({ type: 'error', message: 'Failed to save trip data: ' + saveError.message })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const firstDay = tripData.days?.[0]
        const lastDay = tripData.days?.[tripData.days.length - 1]

        await supabase.from('trips').update({
          status: 'ready',
          start_date: firstDay?.date || trip.intake_form?.start_date || null,
          end_date: lastDay?.date || trip.intake_form?.end_date || null,
        }).eq('id', params.id)

        send({ type: 'progress', message: 'Done!' })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        await supabase.from('trips').update({ status: 'error' }).eq('id', params.id)
        send({ type: 'error', message })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
