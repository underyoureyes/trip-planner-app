'use client'
import { useEffect, useRef, useState } from 'react'
import type { Trip, TripData, Day, Stop } from '@/lib/types'
import { buildRouteStops } from '@/lib/trip-stops'
import { buildRouteDayUrl } from '@/lib/navigation'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  tripData: TripData
}

// Stop types shown in the per-day list (excludes drive segments and fuel)
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

const TYPE_COLORS: Record<string, string> = {
  hotel: '#2d6a4f', sightseeing: '#2563a8', activity: '#7c3aed',
  viewpoint: '#0891b2', town: '#c9963a', restaurant: '#dc2626',
  cafe: '#92400e', pub: '#b45309', beach: '#0369a1', nature: '#166534',
  castle: '#7c3aed', distillery: '#c2410c', museum: '#374151', other: '#6b7280',
}

// Module-level cache — avoids re-fetching across re-renders
const photoCache = new Map<string, string | null>()

async function fetchWikipediaPhoto(query: string): Promise<string | null> {
  if (photoCache.has(query)) return photoCache.get(query)!
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
    clearTimeout(t)
    if (!res.ok) { photoCache.set(query, null); return null }
    const data = await res.json() as { thumbnail?: { source: string } }
    const url = data.thumbnail?.source ?? null
    photoCache.set(query, url)
    return url
  } catch {
    photoCache.set(query, null)
    return null
  }
}

// For hotels use the area name (overnight_location) — gives much better Wikipedia hits
// than the specific property name ("Cozy Skye Cottage" → "Portree")
function photoQuery(stop: Stop, day: Day): string {
  return stop.type === 'hotel' ? (day.overnight_location || stop.name) : stop.name
}

// ── Stop photo row ─────────────────────────────────────────────────────────────

interface StopRowProps {
  stop: Stop
  day: Day
  onExpand: (url: string, name: string) => void
}

function StopRow({ stop, day, onExpand }: StopRowProps) {
  // undefined = not yet fetched, null = fetch returned no image
  const [photo, setPhoto] = useState<string | null | undefined>(undefined)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        obs.disconnect()
        fetchWikipediaPhoto(photoQuery(stop, day)).then(setPhoto)
      },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [stop, day])

  const color  = TYPE_COLORS[stop.type] || '#6b7280'
  const icon   = TYPE_ICON[stop.type]   || '📍'
  const navUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address || stop.name)}`

  return (
    <div ref={rowRef} className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f4fa]">
      {/* Photo — tap to expand lightbox */}
      <button
        onClick={() => photo && onExpand(photo, stop.name)}
        className="w-[68px] h-[68px] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: photo ? undefined : color, cursor: photo ? 'zoom-in' : 'default' }}
      >
        {photo
          ? <img src={photo} alt={stop.name} className="w-full h-full object-cover" loading="lazy" />
          : <span className="text-[28px]">{icon}</span>
        }
      </button>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink truncate">{stop.name}</p>
        {stop.address && stop.address !== stop.name && (
          <p className="text-[11px] text-soft truncate">{stop.address}</p>
        )}
        <p className="text-[11px] capitalize mt-0.5" style={{ color }}>{stop.type}</p>
      </div>

      {/* Navigate */}
      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg no-underline active:opacity-70"
        style={{ background: '#dbeafe', color: '#2563a8' }}
      >Nav →</a>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TripRouteCard({ isOpen, onClose, trip, tripData }: Props) {
  const [visible,  setVisible]  = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    if (!isOpen) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [isOpen])

  if (!isOpen) return null

  // Hotels-only route — Google Maps handles 4–10 stops reliably
  const hotelStops    = buildRouteStops(trip, tripData)
  const hotelWaypoints = hotelStops.map(s => s.name)
  const googleHotelsUrl = hotelWaypoints.length < 1 ? '' :
    hotelWaypoints.length === 1
      ? `https://www.google.com/maps/search/?q=${encodeURIComponent(hotelWaypoints[0])}`
      : `https://www.google.com/maps/dir/${hotelWaypoints.map(w => encodeURIComponent(w)).join('/')}`
  const appleHotelsUrl = hotelWaypoints.length < 2 ? '' :
    `maps://maps.apple.com/?saddr=${encodeURIComponent(hotelWaypoints[0])}&daddr=${encodeURIComponent(hotelWaypoints[hotelWaypoints.length - 1])}&dirflg=d`

  // Per-day data with start locations and Maps URLs
  const days   = tripData.days || []
  const origin = trip.intake_form?.origin?.trim()
  const totalPOI = days.reduce((n, d) => n + d.stops.filter(s => NAV_TYPES.has(s.type)).length, 0)

  const dayRows = days.map((day, i) => {
    const startLoc = i === 0 ? origin : days[i - 1]?.overnight_location
    const navStops = day.stops
      .filter(s => NAV_TYPES.has(s.type))
      .map(s => s.address || s.name)
    const wpts   = startLoc ? [startLoc, ...navStops] : navStops
    const dayUrl = wpts.length >= 2 ? buildRouteDayUrl(wpts) : null
    return { day, dayUrl }
  })

  return (
    <>
      {/* ── Photo lightbox ──────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.93)' }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-w-full max-h-[80vh] rounded-2xl object-contain"
          />
          <p className="text-white text-[13px] mt-3 font-medium">{lightbox.name}</p>
          <p className="text-white/40 text-[11px] mt-1">Tap anywhere to close</p>
        </div>
      )}

      {/* ── Route sheet ─────────────────────────────────────────────────────── */}
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
            maxHeight: '92vh',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-line" />
          </div>

          {/* Header */}
          <div className="px-5 pt-1 pb-4 border-b border-line flex-shrink-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-serif text-[20px] text-ink">Route overview</h2>
                <p className="text-[12px] text-soft">
                  {hotelStops.length} overnight stops · {totalPOI} points of interest · tap a photo to expand
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line mt-1"
              >×</button>
            </div>

            {/* Full-trip hotels route buttons */}
            <div className="flex gap-3">
              {googleHotelsUrl ? (
                <a
                  href={googleHotelsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-2.5 py-3.5 px-4 rounded-xl text-[14px] font-semibold no-underline active:opacity-80"
                  style={{ background: '#2d6a4f', color: '#fff' }}
                >
                  <span className="text-[20px]">🗺️</span>
                  <div>
                    <span className="block leading-snug">Full trip · Google Maps</span>
                    <span className="block text-[11px] font-normal opacity-80">{hotelStops.length} overnight stops</span>
                  </div>
                </a>
              ) : (
                <div className="flex-1 py-3.5 rounded-xl text-[14px] text-center bg-mist text-soft">No stops yet</div>
              )}
              {appleHotelsUrl && (
                <a
                  href={appleHotelsUrl}
                  className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-xl text-[14px] font-semibold no-underline active:opacity-80 flex-shrink-0"
                  style={{ background: '#dbeafe', color: '#2563a8' }}
                >
                  <span>🍎</span>
                </a>
              )}
            </div>
          </div>

          {/* Day-by-day stop list with photos */}
          <div className="flex-1 overflow-y-auto pb-10">
            {dayRows.map(({ day, dayUrl }) => {
              const navStops = day.stops.filter(s => NAV_TYPES.has(s.type))
              return (
                <div key={day.day_number}>
                  {/* Sticky day header */}
                  <div
                    className="flex items-center justify-between px-5 py-2.5 border-b border-[#e8edf5] sticky top-0 z-10"
                    style={{ background: '#f0f4fa' }}
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-soft">
                        Day {day.day_number}{day.date ? ` · ${new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
                      </p>
                      <p className="text-[13px] text-ink font-semibold truncate">{day.title || `Day ${day.day_number}`}</p>
                    </div>
                    {dayUrl && (
                      <a
                        href={dayUrl.web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold no-underline active:opacity-80 flex-shrink-0"
                        style={{ background: '#2563a8', color: '#fff' }}
                      >
                        <span>🗺️</span> Day route
                      </a>
                    )}
                  </div>

                  {navStops.length > 0
                    ? navStops.map((stop, i) => (
                        <StopRow
                          key={i}
                          stop={stop}
                          day={day}
                          onExpand={(url, name) => setLightbox({ url, name })}
                        />
                      ))
                    : <p className="px-5 py-4 text-[12px] text-soft italic">No stops this day</p>
                  }
                </div>
              )
            })}

            {days.length === 0 && (
              <div className="px-5 py-12 text-center text-soft">
                <p className="text-3xl mb-3">🗺️</p>
                <p>No itinerary yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
