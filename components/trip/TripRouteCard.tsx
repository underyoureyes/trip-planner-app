'use client'
import { useEffect, useRef, useState } from 'react'
import type { Trip, TripData } from '@/lib/types'
import type { GeocodedPoint } from '@/app/api/trips/[id]/geocode/route'
import { buildRouteStops, getCountryHint } from '@/lib/trip-stops'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  tripData: TripData
}

// Marker HTML for custom Leaflet divIcons
function markerHtml(label: string, color: string, border: string) {
  return `<div style="
    background:${color};color:#fff;
    width:30px;height:30px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-weight:700;font-size:12px;font-family:-apple-system,sans-serif;
    border:2.5px solid ${border};
    box-shadow:0 2px 6px rgba(0,0,0,0.40);
  ">${label}</div>`
}

export default function TripRouteCard({ isOpen, onClose, trip, tripData }: Props) {
  const [visible,  setVisible]  = useState(false)
  const [status,   setStatus]   = useState<'idle' | 'geocoding' | 'ready' | 'error'>('idle')
  const [coords,   setCoords]   = useState<GeocodedPoint[]>([])
  const mapDivRef   = useRef<HTMLDivElement>(null)
  const leafletRef  = useRef<ReturnType<typeof import('leaflet')['map']> | null>(null)
  const tripId = trip.id

  // Geocode stops every time the card opens — no caching
  useEffect(() => {
    if (!isOpen) { setVisible(false); setCoords([]); setStatus('idle'); return }
    setTimeout(() => setVisible(true), 10)

    const stopList = buildRouteStops(trip, tripData)
    if (stopList.length === 0) { setStatus('error'); return }

    setStatus('geocoding')
    fetch(`/api/trips/${tripId}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: stopList.map(s => s.name),
        country_hint: getCountryHint(trip),
      }),
    })
      .then(r => r.json())
      .then(({ results }: { results: GeocodedPoint[] }) => {
        setCoords(results)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [isOpen, tripId, trip, tripData])

  // Init Leaflet map once coords are ready and sheet is visible
  useEffect(() => {
    if (status !== 'ready' || !mapDivRef.current || coords.length === 0) return

    // Keep the full coords array (including nulls) so indices stay aligned with stops[]
    if (!coords.some(c => c.lat !== null)) return

    // Destroy previous map instance if it exists
    if (leafletRef.current) {
      leafletRef.current.remove()
      leafletRef.current = null
    }

    // stops[i] must align 1:1 with coords[i] — both built from the same buildRouteStops call
    const stops = buildRouteStops(trip, tripData)

    import('leaflet').then(L => {
      if (!mapDivRef.current) return

      // Fix default icon paths broken by Next.js bundler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        attributionControl: true,
      })
      leafletRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      const latlngs: [number, number][] = []
      let markerNum = 1 // visible numbering for mid-trip stops

      // Iterate over full coords array — use index i to align with stops[i]
      coords.forEach((pt, i) => {
        if (pt.lat === null || pt.lon === null) return // skip failed geocodes, keep index intact

        const stop = stops[i] || { isFirst: false, isLast: false, highlight: false, name: pt.query }

        let color = '#2563a8'
        let border = '#bfdbfe'
        if (stop.isFirst)   { color = '#2d6a4f'; border = '#6ee7b7' }
        if (stop.isLast)    { color = '#b45309'; border = '#fde68a' }
        if (stop.highlight && !stop.isFirst && !stop.isLast) { color = '#7c3aed'; border = '#c4b5fd' }

        const label = stop.isFirst ? 'S' : stop.isLast ? 'F' : String(markerNum++)

        const icon = L.divIcon({
          html: markerHtml(label, color, border),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
          className: '',
        })

        const dateStr = stop.date
          ? new Date(stop.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          : ''

        L.marker([pt.lat, pt.lon], { icon })
          .bindPopup(`<strong>${pt.query}</strong>${dateStr ? `<br/><span style="color:#6b7280;font-size:12px">${dateStr}</span>` : ''}`)
          .addTo(map)

        latlngs.push([pt.lat, pt.lon])
      })

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#2563a8',
          weight: 3.5,
          opacity: 0.85,
          dashArray: '10 7',
        }).addTo(map)

        map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 12 })
      } else if (latlngs.length === 1) {
        map.setView(latlngs[0], 9)
      }
    })

    return () => {
      leafletRef.current?.remove()
      leafletRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, coords])

  if (!isOpen) return null

  const stopCount = coords.filter(c => c.lat !== null).length

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />

      <div className="fixed inset-0 z-[70]">
        {/* Backdrop */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: visible ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)' }}
          onClick={onClose}
        />

        {/* Sheet — nearly full screen so the map has room */}
        <div
          className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{
            height: '92vh',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-line" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-line flex-shrink-0">
            <div>
              <h2 className="font-serif text-[20px] text-ink">Route map</h2>
              {status === 'ready' && stopCount > 0 && (
                <p className="text-[12px] text-soft">{stopCount} stops plotted · tap any pin for details</p>
              )}
              {status === 'geocoding' && (
                <p className="text-[12px] text-soft">Locating stops… this may take a moment</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line"
            >×</button>
          </div>

          {/* Map area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Loading overlay */}
            {(status === 'idle' || status === 'geocoding') && (
              <div className="absolute inset-0 z-10 bg-mist flex flex-col items-center justify-center gap-3">
                <div
                  className="w-9 h-9 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#d1d9e6', borderTopColor: '#2563a8' }}
                />
                <p className="text-soft text-[14px]">
                  {status === 'geocoding'
                    ? `Looking up ${buildRouteStops(trip, tripData).length} stops…`
                    : 'Preparing map…'}
                </p>
                {status === 'geocoding' && (
                  <p className="text-[12px] text-soft px-8 text-center">
                    Each stop is geocoded individually — takes ~{buildRouteStops(trip, tripData).length}s
                  </p>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="absolute inset-0 z-10 bg-mist flex flex-col items-center justify-center gap-3 px-8 text-center">
                <p className="text-3xl">⚠️</p>
                <p className="text-ink font-semibold">Could not load map</p>
                <p className="text-soft text-[13px]">Check your internet connection and try again.</p>
              </div>
            )}

            {/* Leaflet map div */}
            <div
              ref={mapDivRef}
              className="w-full h-full"
              style={{ background: '#e8edf5' }}
            />
          </div>

          {/* Legend */}
          {status === 'ready' && stopCount > 0 && (
            <div className="flex-shrink-0 px-5 py-3 border-t border-line flex items-center gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {[
                { color: '#2d6a4f', label: 'Start' },
                { color: '#2563a8', label: 'Overnight' },
                { color: '#7c3aed', label: 'Highlight' },
                { color: '#b45309', label: 'End' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[12px] text-soft">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <div className="w-5 border-t-2 border-dashed" style={{ borderColor: '#2563a8' }} />
                <span className="text-[12px] text-soft">Route</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
