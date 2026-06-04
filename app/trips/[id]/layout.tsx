import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const supabase = await createServerSupabaseClient()
  const { data: trip } = await supabase
    .from('trips')
    .select('title, start_date, end_date, is_shared, intake_form')
    .eq('id', params.id)
    .single()

  if (!trip?.is_shared) return { title: 'Trip Planner' }

  const dest = (trip.intake_form as { destination?: string } | null)?.destination
  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const dates = [fmt(trip.start_date), fmt(trip.end_date)].filter(Boolean).join(' – ')
  const description = [dest, dates].filter(Boolean).join(' · ') || 'Road trip itinerary'

  return {
    title: trip.title,
    description,
    openGraph: {
      title: trip.title,
      description,
      siteName: 'Trip Planner',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: trip.title,
      description,
    },
  }
}

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
