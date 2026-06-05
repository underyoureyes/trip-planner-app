import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { aggregateUsage } from '@/lib/usage'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = request.nextUrl.searchParams.get('trip_id')

  let query = supabase
    .from('api_usage')
    .select('endpoint, input_tokens, output_tokens, cost_usd, created_at, trip_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (tripId) query = query.eq('trip_id', tripId)

  const { data: rows, error } = await query.limit(1000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = aggregateUsage(rows || [])
  return NextResponse.json({ summary, rows })
}
