import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TripsList from '@/components/TripsList'
import type { Trip } from '@/lib/types'

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
      <TripsList ownTrips={ownTrips} sharedTrips={otherTrips} hasApiKey={hasApiKey} />
    </div>
  )
}
