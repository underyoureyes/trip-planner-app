'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Trip, TripData, Day } from '@/lib/types'
import { buildRouteDayUrl } from '@/lib/navigation'
import DayTabs from '@/components/trip/DayTabs'
import StopCard from '@/components/trip/StopCard'

const HERO_GRADIENT = 'linear-gradient(160deg, #1a1a2e 0%, #1e3a5f 55%, #2563a8 100%)'
const DAY_GRADIENT  = 'linear-gradient(135deg, #1e3a5f 0%, #2563a8 100%)'
const HERO_TEXTURE  = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`

export default function TripViewPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [trip,        setTrip]        = useState<Trip | null>(null)
  const [tripData,    setTripData]    = useState<TripData | null>(null)
  const [isOwner,     setIsOwner]     = useState(false)
  const [activeDay,   setActiveDay]   = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [generateLog, setGenerateLog] = useState('')
  const [error,       setError]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const startedRef = useRef(false)

  async function loadTrip() {
    const res = await fetch(`/api/trips/${id}`)
    if (!res.ok) { if (res.status === 404) router.push('/trips'); return null }
    const data = await res.json()
    setTrip(data.trip); setTripData(data.tripData); setLoading(false)
    const meRes = await fetch('/api/me')
    if (meRes.ok) { const me = await meRes.json(); setIsOwner(me.id === data.trip.owner_id) }
    return data.trip
  }

  async function startGeneration() {
    setGenerating(true); setGenerateLog('Starting…'); setError('')
    const res = await fetch(`/api/trips/${id}/generate`, { method: 'POST' })
    if (!res.ok || !res.body) { setError('Failed to start generation'); setGenerating(false); return }
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { setGenerating(false); loadTrip(); return }
        try {
          const evt = JSON.parse(payload)
          if (evt.type === 'progress') setGenerateLog(evt.message)
          if (evt.type === 'error')    { setError(evt.message); setGenerating(false); return }
        } catch { /* partial chunk */ }
      }
    }
    setGenerating(false); loadTrip()
  }

  const handleDeleteStop = useCallback(async (dayIndex: number, stopIndex: number) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : { ...day, stops: day.stops.filter((_, si) => si !== stopIndex) }
      ),
      total_stops: Math.max(0, (tripData.total_stops || 0) - 1),
    }
    setTripData(updated); setSaving(true)
    try { await fetch(`/api/trips/${id}/data`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }) }
    finally { setSaving(false) }
  }, [tripData, id])

  const handleDeleteEating = useCallback(async (dayIndex: number, eatIndex: number) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : { ...day, eating: (day.eating || []).filter((_, ei) => ei !== eatIndex) }
      ),
    }
    setTripData(updated); setSaving(true)
    try { await fetch(`/api/trips/${id}/data`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }) }
    finally { setSaving(false) }
  }, [tripData, id])

  function buildDayRouteUrl(day: Day) {
    const wpts = day.stops.filter(s => s.type !== 'drive' && (s.address || s.name)).map(s => s.address || s.name)
    if (wpts.length === 0) {
      if (!day.overnight_location) return null
      const enc = encodeURIComponent(day.overnight_location)
      return { google: `comgooglemaps://?daddr=${enc}&directionsmode=driving`, apple: `maps://maps.apple.com/?daddr=${enc}&dirflg=d`, web: `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving` }
    }
    return buildRouteDayUrl(wpts as string[])
  }

  useEffect(() => {
    loadTrip().then(t => { if (t?.status === 'draft' && !startedRef.current) { startedRef.current = true; startGeneration() } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-mist flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🗺️</div><p className="text-soft text-sm">Loading trip…</p></div>
    </div>
  )
  if (!trip) return null

  const days: Day[] = tripData?.days || []
  const currentDay  = days[activeDay]

  // ── Generating ───────────────────────────────────────────────────────────────
  if (generating || trip.status === 'generating') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: HERO_GRADIENT }}>
      <div className="text-center">
        <div className="text-6xl mb-6 animate-bounce">✨</div>
        <h2 className="font-serif text-2xl text-white mb-2">Building your trip…</h2>
        <p className="text-[#93c5fd] text-sm mb-6">Claude is crafting your itinerary</p>
        {generateLog && <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-sm text-[#e0f2fe] max-w-xs mx-auto">{generateLog}</div>}
        {error      && <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4 text-sm text-red-200 mt-3 max-w-xs mx-auto">{error}</div>}
      </div>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (trip.status === 'error') return (
    <div className="min-h-screen bg-mist flex flex-col">
      <div className="px-5 pt-14 pb-5" style={{ background: DAY_GRADIENT }}>
        <Link href="/trips" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <div><div className="text-6xl mb-4">❌</div>
        <h2 className="text-xl font-semibold text-ink mb-2">Generation failed</h2>
        <p className="text-soft text-sm mb-6">Something went wrong. Please try again.</p>
        <button onClick={() => { startedRef.current = false; startGeneration() }} className="btn-primary">Retry</button></div>
      </div>
    </div>
  )

  // ── Main view ────────────────────────────────────────────────────────────────
  const dayRouteUrls  = currentDay ? buildDayRouteUrl(currentDay) : null
  const nonDriveCount = currentDay?.stops.filter(s => s.type !== 'drive').length || 0
  const driveMinutes  = currentDay?.stops.filter(s => s.type === 'drive').reduce((a, s) => a + (s.drive_time_mins || 0), 0) || 0

  return (
    <div className="min-h-screen bg-mist">

      {/* Hero */}
      <div className="relative overflow-hidden text-center" style={{ background: HERO_GRADIENT, backgroundImage: HERO_TEXTURE, paddingTop: 52 }}>
        {/* back / settings row */}
        <div className="flex items-center justify-between px-5 mb-4">
          <Link href="/trips" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          {isOwner && (
            <Link href={`/trips/${id}/settings`} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}
        </div>

        <h1 className="font-serif text-[28px] text-white leading-tight px-5 mb-1.5">{trip.title}</h1>
        {tripData?.summary && (
          <p className="text-[#93c5fd] text-[13px] font-light tracking-[1.5px] uppercase mb-5 px-5 line-clamp-1">{tripData.summary}</p>
        )}

        {/* chips */}
        <div className="flex flex-wrap justify-center gap-2 px-5 pb-5">
          {trip.start_date && trip.end_date && (
            <span className="hero-chip">🗓 {new Date(trip.start_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(trip.end_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
          )}
          {tripData?.total_days     && <span className="hero-chip">{tripData.total_days} days</span>}
          {tripData?.total_distance_km && <span className="hero-chip">~{tripData.total_distance_km} km</span>}
          {tripData?.total_stops    && <span className="hero-chip">{tripData.total_stops} stops</span>}
          {saving && <span className="hero-chip opacity-60 text-[11px]">Saving…</span>}
        </div>
      </div>

      {/* Sticky day tabs */}
      {days.length > 0 && (
        <div className="bg-white border-b border-line sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <DayTabs days={days} activeIndex={activeDay} onSelect={setActiveDay} />
        </div>
      )}

      {/* Day content */}
      {currentDay ? (
        <div className="px-4 pt-4 pb-32" style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Day header card */}
          <div className="rounded-card p-5 mb-3.5 relative overflow-hidden" style={{ background: DAY_GRADIENT, boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
            <div className="absolute right-[-20px] top-[-20px] w-[120px] h-[120px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#93c5fd] mb-1">
              Day {currentDay.day_number}{currentDay.date ? ` · ${new Date(currentDay.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}` : ''}
            </p>
            <h2 className="font-serif text-[20px] text-white leading-snug mb-3">{currentDay.title || `Day ${currentDay.day_number}`}</h2>
            <div className="flex flex-wrap gap-4">
              {currentDay.overnight_location && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">🌙 <span className="text-white font-semibold">{currentDay.overnight_location}</span></div>
              )}
              {driveMinutes > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">🚗 <span className="text-white font-semibold">{Math.floor(driveMinutes/60)}h {driveMinutes%60}m driving</span></div>
              )}
            </div>
          </div>

          {/* Navigate route button */}
          {dayRouteUrls && (
            <a
              href={dayRouteUrls.web}
              className="flex items-center justify-center gap-2.5 w-full rounded-card py-4 px-5 mb-3.5 no-underline"
              style={{ background: '#2d6a4f', color: '#fff', fontWeight: 600, fontSize: 16, boxShadow: '0 3px 12px rgba(45,106,79,0.35)' }}
            >
              <span className="text-[22px]">🗺️</span>
              <div className="text-left leading-snug">
                <span className="block">Open Route in Maps</span>
                <span className="block text-[12px] font-normal opacity-85">{nonDriveCount} stops · opens Google Maps</span>
              </div>
            </a>
          )}

          {/* Stops */}
          {currentDay.stops.length > 0 && (
            <div className="bg-white rounded-card mb-3.5" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
              <div className="bg-card-bg border-b border-line px-4 py-2.5">
                <span className="text-[11px] font-semibold tracking-[1.5px] uppercase text-soft">Route &amp; Stops</span>
              </div>
              <div className="pt-1 pb-1">
                {currentDay.stops.map((stop, i) => (
                  <StopCard
                    key={`${activeDay}-${i}`}
                    stop={stop}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === currentDay.stops.length - 1}
                    isOwner={isOwner}
                    onDelete={() => handleDeleteStop(activeDay, i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Eating */}
          {currentDay.eating && currentDay.eating.length > 0 && (
            <div className="bg-white rounded-card mb-3.5" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
              <div className="bg-card-bg border-b border-line px-4 py-2.5">
                <span className="text-[11px] font-semibold tracking-[1.5px] uppercase text-soft">🍽️ Food &amp; Drink</span>
              </div>
              {currentDay.eating.map((place, i) => (
                <div key={i} className={`px-4 py-3 ${i < currentDay.eating!.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {place.suggested && <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold mb-1">✨ Optional</span>}
                      <p className="font-semibold text-[15px] text-ink">{place.name}</p>
                      <p className="text-[12px] text-soft capitalize">{place.meal_type}</p>
                      {place.description && <p className="text-[13px] text-soft mt-1">{place.description}</p>}
                      {place.booking_required && <p className="text-[12px] font-semibold mt-1" style={{ color: '#e07b39' }}>⚠️ Booking recommended</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                      {place.address && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}&travelmode=driving`} className="stop-nav-btn">🗺️ Nav</a>
                      )}
                      {isOwner && (
                        <button onClick={() => handleDeleteEating(activeDay, i)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center active:bg-red-100 active:text-red-500 text-xs">×</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {currentDay.notes && (
            <div className="rounded-card p-4 mb-3.5 border" style={{ background: '#fef3d0', borderColor: '#f0c040' }}>
              <p className="text-[12px] font-semibold tracking-[1px] uppercase mb-2" style={{ color: '#c9963a' }}>💡 Tips for Today</p>
              <p className="text-[13px] leading-relaxed" style={{ color: '#5a3e00' }}>{currentDay.notes}</p>
            </div>
          )}

          {/* Prev / Next */}
          <div className="flex gap-3 pt-2">
            {activeDay > 0 && <button onClick={() => setActiveDay(activeDay-1)} className="btn-secondary flex-1">← Day {activeDay}</button>}
            {activeDay < days.length-1 && <button onClick={() => setActiveDay(activeDay+1)} className="btn-primary flex-1">Day {activeDay+2} →</button>}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-12 text-center text-soft"><p>No days planned yet</p></div>
      )}
    </div>
  )
}
