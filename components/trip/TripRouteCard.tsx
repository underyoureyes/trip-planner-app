'use client'
import { useEffect, useState } from 'react'
import type { Trip, TripData } from '@/lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  tripData: TripData
}

// All stop types that represent navigable destinations
const NAV_TYPES = new Set([
  'hotel', 'sightseeing', 'activity', 'viewpoint', 'town',
  'restaurant', 'cafe', 'pub', 'beach', 'nature',
  'castle', 'distillery', 'museum', 'other',
])

const TYPE_ICON: Record<string, string> = {
  hotel: '🛏️', sightseeing: '🏛️', activity: '🎯', viewpoint: '📸',
  town: '🏘️', restaurant: '🍽️', cafe: '☕', pub: '🍺',
  beach: '🏖️', nature: '🌿', castle: '🏰', distillery: '🥃',
  museum: '🏛️', other: '📍',
}

interface DayGroup {
  dayNum: number
  dayTitle: string
  dayDate?: string
  stops: Array<{ name: string; address?: string; type: string }>
}

function buildRouteData(trip: Trip, tripData: TripData): { waypoints: string[]; groups: DayGroup[] } {
  const waypoints: string[] = []
  const groups: DayGroup[] = []

  const origin = trip.intake_form?.origin?.trim()
  if (origin) waypoints.push(origin)

  for (const day of tripData.days || []) {
    const relevant = day.stops.filter(s => NAV_TYPES.has(s.type))
    if (relevant.length > 0) {
      groups.push({
        dayNum: day.day_number,
        dayTitle: day.title || `Day ${day.day_number}`,
        dayDate: day.date,
        stops: relevant.map(s => ({ name: s.name, address: s.address, type: s.type })),
      })
    }
    for (const stop of relevant) {
      const loc = stop.address || stop.name
      if (loc) waypoints.push(loc)
    }
  }

  return { waypoints, groups }
}

export default function TripRouteCard({ isOpen, onClose, trip, tripData }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isOpen) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [isOpen])

  if (!isOpen) return null

  const { waypoints, groups } = buildRouteData(trip, tripData)
  const origin = trip.intake_form?.origin?.trim()

  const googleUrl = waypoints.length === 0 ? '' :
    waypoints.length === 1
      ? `https://www.google.com/maps/search/?q=${encodeURIComponent(waypoints[0])}`
      : `https://www.google.com/maps/dir/${waypoints.map(w => encodeURIComponent(w)).join('/')}`

  const appleUrl = waypoints.length < 2 ? '' :
    `maps://maps.apple.com/?saddr=${encodeURIComponent(waypoints[0])}&daddr=${encodeURIComponent(waypoints[waypoints.length - 1])}&dirflg=d`

  const totalStops = waypoints.length

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: visible ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          maxHeight: '88vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {/* Header + buttons */}
        <div className="px-5 pt-1 pb-4 border-b border-line flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-serif text-[20px] text-ink">Full route</h2>
              <p className="text-[12px] text-soft">{totalStops} stops · tap a stop to navigate individually</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line mt-1"
            >×</button>
          </div>

          <div className="flex gap-3">
            {googleUrl ? (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold no-underline active:opacity-80"
                style={{ background: '#2d6a4f', color: '#fff' }}
              >
                <span>🗺️</span> Google Maps
              </a>
            ) : (
              <div className="flex-1 py-3.5 rounded-xl text-[14px] font-semibold text-center bg-mist text-soft">No stops yet</div>
            )}
            {appleUrl && (
              <a
                href={appleUrl}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold no-underline active:opacity-80"
                style={{ background: '#dbeafe', color: '#2563a8' }}
              >
                <span>🍎</span> Apple Maps
              </a>
            )}
          </div>
        </div>

        {/* Stop list */}
        <div className="flex-1 overflow-y-auto pb-8">
          {/* Origin pin */}
          {origin && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f4fa]">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                style={{ background: '#2d6a4f' }}
              >S</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{origin}</p>
                <p className="text-[11px] text-soft">Starting point</p>
              </div>
            </div>
          )}

          {groups.map(({ dayNum, dayTitle, dayDate, stops }) => (
            <div key={dayNum}>
              {/* Day header */}
              <div className="px-5 py-2.5 bg-mist border-b border-[#e8edf5]">
                <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-soft">
                  Day {dayNum}{dayDate ? ` · ${new Date(dayDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
                </p>
                <p className="text-[12px] text-ink font-medium truncate">{dayTitle}</p>
              </div>

              {stops.map((stop, i) => {
                const loc = stop.address || stop.name
                const navUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
                return (
                  <a
                    key={i}
                    href={navUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f4fa] no-underline active:bg-mist"
                  >
                    <span className="text-[18px] w-7 text-center flex-shrink-0">{TYPE_ICON[stop.type] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{stop.name}</p>
                      {stop.address && stop.address !== stop.name && (
                        <p className="text-[11px] text-soft truncate">{stop.address}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-soft flex-shrink-0">Nav →</span>
                  </a>
                )
              })}
            </div>
          ))}

          {waypoints.length === 0 && (
            <div className="px-5 py-12 text-center text-soft">
              <p className="text-3xl mb-3">📍</p>
              <p>No stops found in this trip</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
