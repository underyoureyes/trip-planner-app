import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export interface GeocodedPoint {
  query: string
  lat: number | null
  lon: number | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check trip is accessible (owner or shared)
  const { data: trip } = await supabase
    .from('trips')
    .select('owner_id, is_shared')
    .eq('id', params.id)
    .single()

  if (!trip || (trip.owner_id !== user.id && !trip.is_shared)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { locations } = await request.json() as { locations: string[] }
  if (!Array.isArray(locations) || locations.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const results: GeocodedPoint[] = []

  for (let i = 0; i < locations.length; i++) {
    const q = locations[i]
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TripPlannerApp/1.0 (road trip planner)' },
      })
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data[0]) {
        results.push({ query: q, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
      } else {
        results.push({ query: q, lat: null, lon: null })
      }
    } catch {
      results.push({ query: q, lat: null, lon: null })
    }
    // Nominatim policy: max 1 request/second
    if (i < locations.length - 1) await new Promise(r => setTimeout(r, 1100))
  }

  return NextResponse.json({ results })
}
