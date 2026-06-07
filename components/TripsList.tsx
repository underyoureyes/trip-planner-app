'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { Trip } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const startDate = trip.start_date ? formatDate(trip.start_date) : null
  const endDate   = trip.end_date   ? formatDate(trip.end_date)   : null

  async function doDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' }).catch(() => {})
    onDelete(trip.id)
  }

  function handleDeleteTap(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirmDelete(true)
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirmDelete(false)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ boxShadow: '0 1px 8px rgba(26,26,46,0.08)' }}>
      <Link
        href={`/trips/${trip.id}`}
        className="card flex items-start gap-4 active:bg-gray-50 no-underline rounded-2xl"
        style={{ borderRadius: confirmDelete ? '16px 16px 0 0' : undefined }}
      >
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
            {trip.status === 'ready'      && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready</span>}
            {trip.status === 'error'      && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Failed</span>}
            {trip.is_shared               && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Shared</span>}
          </div>
        </div>
        <button
          onClick={handleDeleteTap}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 active:bg-gray-100 active:text-red-400 transition-colors mt-0.5"
          aria-label="Delete trip"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </Link>

      {/* Confirm delete panel */}
      {confirmDelete && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-t border-red-100">
          <p className="text-sm font-medium text-red-700">Delete "{trip.title}"?</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 active:bg-gray-50"
            >Cancel</button>
            <button
              onClick={doDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 active:bg-red-700 disabled:opacity-50"
            >{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  ownTrips: Trip[]
  sharedTrips: Trip[]
  hasApiKey: boolean
}

export default function TripsList({ ownTrips: initial, sharedTrips, hasApiKey }: Props) {
  const [ownTrips, setOwnTrips] = useState(initial)

  function removeTrip(id: string) {
    setOwnTrips(prev => prev.filter(t => t.id !== id))
  }

  return (
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
          <div className="space-y-3">
            {ownTrips.map(t => <TripCard key={t.id} trip={t} onDelete={removeTrip} />)}
          </div>
        </section>
      )}

      {sharedTrips.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">Shared with you</h2>
          <div className="space-y-3">
            {sharedTrips.map(t => (
              <Link key={t.id} href={`/trips/${t.id}`} className="card flex items-start gap-4 active:bg-gray-50 no-underline">
                <div className="text-3xl mt-0.5">🗺️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                  {(t.start_date || t.end_date) && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {t.start_date ? formatDate(t.start_date) : ''}
                      {t.start_date && t.end_date ? ' → ' : ''}
                      {t.end_date ? formatDate(t.end_date) : ''}
                    </p>
                  )}
                  <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium mt-1.5">Shared</span>
                </div>
                <svg className="w-5 h-5 text-gray-300 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      )}

      {ownTrips.length === 0 && sharedTrips.length === 0 && (
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

      <div className="text-center pt-4 pb-2">
        <Link href="/about" className="text-[12px] text-soft hover:text-sky transition-colors">About this app</Link>
      </div>
    </div>
  )
}
