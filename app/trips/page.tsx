import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Trip } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TripCard({ trip }: { trip: Trip }) {
  const startDate = trip.start_date ? formatDate(trip.start_date) : null
  const endDate = trip.end_date ? formatDate(trip.end_date) : null
  return (
    <Link href={`/trips/${trip.id}`} className="card flex items-start gap-4 active:bg-gray-50 no-underline">
      <div className="text-3xl mt-0.5">
        {trip.status === 'generating' ? '⏳' : trip.status === 'error' ? '❌' : '🗺️'}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{trip.title}</h3>
        {(startDate || endDate) && (
          <p className="text-sm text-gray-500 mt-0.5">{startDate}{startDate && endDate ? ' → ' : ''}{endDate}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {trip.status === 'generating' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Generating…</span>}
          {trip.status === 'ready' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready</span>}
          {trip.status === 'error' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Error</span>}
          {trip.is_shared && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Shared</span>}
        </div>
      </div>
      <svg className="w-5 h-5 text-gray-300 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export default async function TripsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('setup_complete').eq('id', user.id).single()
  if (!profile?.setup_complete) redirect('/setup')

  const { data: settings } = await supabase.from('user_settings').select('claude_api_key').eq('user_id', user.id).single()
  const hasApiKey = !!(settings?.claude_api_key)

  const { data: myTrips } = await supabase
    .from('trips').select('id, title, status, start_date, end_date, is_shared, owner_id, created_at')
    .eq('owner_id', user.id).order('created_at', { ascending: false })

  const { data: sharedTrips } = await supabase
    .from('trips').select('id, title, status, start_date, end_date, is_shared, owner_id, created_at')
    .eq('is_shared', true).neq('owner_id', user.id).order('created_at', { ascending: false })

  const ownTrips: Trip[] = (myTrips || []) as Trip[]
  const otherTrips: Trip[] = (sharedTrips || []) as Trip[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-brand-900 to-brand-700 px-6 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">My Trips</h1>
            {!hasApiKey && (
              <p className="text-brand-300 text-xs mt-1">
                👁️ Read-only — add an API key in{' '}
                <Link href="/settings" className="underline text-brand-200">settings</Link>{' '}to create trips
              </p>
            )}
          </div>
          <Link href="/settings" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-6 pb-32 space-y-6">
        {hasApiKey && (
          <Link href="/trips/new" className="flex items-center gap-4 p-4 bg-brand-600 rounded-2xl shadow-sm active:bg-brand-700 no-underline">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold">Plan a new trip</p>
              <p className="text-brand-200 text-sm">Let Claude build your itinerary</p>
            </div>
          </Link>
        )}

        {ownTrips.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">Your trips</h2>
            <div className="space-y-3">{ownTrips.map(t => <TripCard key={t.id} trip={t} />)}</div>
          </section>
        )}

        {otherTrips.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">Shared with you</h2>
            <div className="space-y-3">{otherTrips.map(t => <TripCard key={t.id} trip={t} />)}</div>
          </section>
        )}

        {ownTrips.length === 0 && otherTrips.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No trips yet</h3>
            {hasApiKey ? (
              <p className="text-gray-500 text-sm">Tap <strong>Plan a new trip</strong> above to get started</p>
            ) : (
              <p className="text-gray-500 text-sm">No trips shared with you yet. Add a Claude API key in <Link href="/settings" className="text-brand-600">settings</Link> to create your own.</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-2">
          <Link href="/about" className="text-[12px] text-soft hover:text-sky transition-colors">
            About this app
          </Link>
        </div>
      </div>
    </div>
  )
}
