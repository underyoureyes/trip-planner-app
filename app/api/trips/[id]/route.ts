import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, title, status, start_date, end_date, is_shared, owner_id, created_at, intake_form')
    .eq('id', params.id)
    .single()

  if (error || !trip) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Allow access if: owner, or trip is shared (even for unauthenticated users)
  if (!trip.is_shared && (!user || trip.owner_id !== user.id)) {
    return NextResponse.json({ error: user ? 'Forbidden' : 'Unauthorized' }, { status: user ? 403 : 401 })
  }

  const { data: tripDataRow } = await supabase
    .from('trip_data')
    .select('data')
    .eq('trip_id', params.id)
    .single()

  return NextResponse.json({
    trip,
    tripData: tripDataRow?.data || null,
  })
}

export async function PATCH(
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

  const body = await request.json()
  const allowedFields: Record<string, unknown> = {}
  if (typeof body.is_shared === 'boolean') allowedFields.is_shared = body.is_shared
  if (typeof body.title === 'string') allowedFields.title = body.title.trim()

  const { error } = await supabase
    .from('trips')
    .update(allowedFields)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
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

  await supabase.from('trips').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
