'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Trip, TripData, Day, Eating, DaySection, Stop } from '@/lib/types'
import { buildRouteDayUrl } from '@/lib/navigation'
import DayTabs from '@/components/trip/DayTabs'
import StopCard from '@/components/trip/StopCard'
import AddStopSheet from '@/components/trip/AddStopSheet'
import DeletedStopsSheet, { type DeletedEntry } from '@/components/trip/DeletedStopsSheet'

// ── Sub-components ─────────────────────────────────────────────────────────────

function OverviewSection({ days, onSelectDay }: { days: Day[]; onSelectDay: (i: number) => void }) {
  return (
    <div className="px-4 pt-4 pb-32" style={{ maxWidth: 560, margin: '0 auto' }}>
      <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-3">Your Itinerary</p>
      <div className="space-y-2">
        {days.map((day, i) => {
          const driveKm   = day.stops.filter(s => s.type === 'drive').reduce((a, s) => a + (s.distance_km || 0), 0)
          const stopCount = day.stops.filter(s => s.type !== 'drive').length
          const isHighlight = day.highlight === true
          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className="w-full flex items-center gap-3 bg-white rounded-card px-3 py-3 text-left transition-transform active:scale-[0.98]"
              style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}
            >
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center"
                style={{ width: 44, height: 44, minWidth: 44, background: isHighlight ? '#c9963a' : '#2563a8', borderRadius: 8 }}
              >
                <span className="text-white font-bold text-[18px] leading-none">{day.day_number}</span>
                <span className="text-white text-[10px] font-bold leading-none mt-0.5">DAY</span>
              </div>
              <div className="flex-1 min-w-0">
                {day.date && (
                  <p className="text-[11px] text-soft">
                    {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                )}
                <p className="text-[14px] font-semibold text-ink leading-snug truncate">{day.title || `Day ${day.day_number}`}</p>
                <p className="text-[12px] text-soft">
                  {[driveKm > 0 && `~${Math.round(driveKm)} km`, stopCount > 0 && `${stopCount} stops`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="flex-shrink-0 text-[18px]" style={{ color: '#d1d9e6' }}>›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function InfoPanel({
  eating, sections, isOwner, onDeleteEating,
}: {
  eating?: Eating[]
  sections?: DaySection[]
  isOwner: boolean
  onDeleteEating?: (idx: number) => void
}) {
  const [open, setOpen] = useState(false)
  const hasContent = (eating && eating.length > 0) || (sections && sections.length > 0)
  if (!hasContent) return null

  return (
    <div className="rounded-card overflow-hidden border border-line mb-3.5" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-card-bg active:bg-gray-100"
        style={{ borderBottom: open ? '1px solid #d1d9e6' : 'none' }}
      >
        <span className="text-[14px] font-semibold text-ink">🗒 Activities, Eating &amp; Tips</span>
        <span className={`text-line text-[10px] inline-block transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="bg-white">
          {/* Eating section */}
          {eating && eating.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-soft px-4 pt-3 pb-1.5 border-b border-[#f0f4fa]">🍽 Eating</p>
              {eating.map((place, i) => (
                <div key={i} className={`px-4 py-3 ${i < eating.length - 1 ? 'border-b border-[#f0f4fa]' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {place.suggested && <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold mb-1">✨ Optional</span>}
                      <p className="font-semibold text-[14px] text-ink leading-snug">
                        {place.name}
                        {place.description && <span className="font-normal text-soft"> — {place.description}</span>}
                      </p>
                      <p className="text-[12px] text-soft capitalize mb-1.5">{place.meal_type}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {place.cost && (
                          <span className="inline-flex items-center bg-[#d8f3dc] text-[#2d6a4f] text-[11px] font-semibold px-2 py-0.5 rounded">{place.cost}</span>
                        )}
                        {place.website && (
                          <a href={place.website} target="_blank" rel="noopener noreferrer" className="stop-nav-btn">🌐 Open</a>
                        )}
                        {place.address && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`} className="stop-nav-btn">📍 Map</a>
                        )}
                        {place.booking_required && (
                          <span className="text-[11px] font-semibold" style={{ color: '#e07b39' }}>⚠️ Booking recommended</span>
                        )}
                      </div>
                    </div>
                    {isOwner && onDeleteEating && (
                      <button
                        onClick={() => onDeleteEating(i)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center active:bg-red-100 active:text-red-500 text-xs flex-shrink-0"
                      >×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Day sections */}
          {sections && sections.length > 0 && (
            <div className={eating && eating.length > 0 ? 'border-t border-line' : ''}>
              {sections.map((section, i) => (
                <div key={i} className={`px-4 py-3 ${i < sections.length - 1 ? 'border-b border-[#f0f4fa]' : ''}`}>
                  <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-soft mb-2">{section.emoji} {section.title}</p>
                  {section.content.split('\n').filter(Boolean).map((line, j) => {
                    const isAmber = line.startsWith('⚠️') || line.startsWith('⚠')
                    const isGreen = line.startsWith('✅') || line.startsWith('✓')
                    if (isAmber) return (
                      <div key={j} className="text-[13px] px-3 py-2 rounded mb-1.5 leading-snug" style={{ background: '#fff0e4', borderLeft: '3px solid #e07b39', color: '#7a3800' }}>{line}</div>
                    )
                    if (isGreen) return (
                      <div key={j} className="text-[13px] px-3 py-2 rounded mb-1.5 leading-snug" style={{ background: '#d8f3dc', borderLeft: '3px solid #2d6a4f', color: '#1a4731' }}>{line}</div>
                    )
                    return <p key={j} className="text-[13px] text-soft leading-relaxed py-1.5 border-b border-[#f0f4fa] last:border-none">{line}</p>
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HERO_GRADIENT = 'linear-gradient(160deg, #0d0d1f 0%, #1a1a2e 55%, #1e3a5f 100%)'
const DAY_GRADIENT  = 'linear-gradient(135deg, #0f1e35 0%, #1e3a5f 100%)'
const HERO_TEXTURE  = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`

// ── Main component ─────────────────────────────────────────────────────────────

export default function TripViewPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [trip,       setTrip]       = useState<Trip | null>(null)
  const [tripData,   setTripData]   = useState<TripData | null>(null)
  const [isOwner,    setIsOwner]    = useState(false)
  const [profile,    setProfile]    = useState<{ vehicle_name?: string; vehicle_type?: string } | null>(null)
  const [activeDay,    setActiveDay]    = useState<number>(-1)   // -1 = overview
  const [sosOpen,      setSosOpen]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [generateLog,  setGenerateLog]  = useState('')
  const [error,        setError]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [addSheetOpen,     setAddSheetOpen]     = useState(false)
  const [showDeletedSheet, setShowDeletedSheet] = useState(false)
  const [deletedHistory,   setDeletedHistory]   = useState<DeletedEntry[]>([])
  const [lastDeleted,      setLastDeleted]       = useState<{ stop: Stop; dayIdx: number; stopIdx: number } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef   = useRef(false)

  async function loadTrip() {
    const res = await fetch(`/api/trips/${id}`)
    if (!res.ok) { if (res.status === 404) router.push('/trips'); return null }
    const data = await res.json()
    setTrip(data.trip)
    setTripData(data.tripData)
    setLoading(false)

    // Auto-navigate to today's day if the trip is active
    const today = new Date().toISOString().split('T')[0]
    const todayIdx = (data.tripData?.days || []).findIndex((d: Day) => d.date === today)
    if (todayIdx >= 0) setActiveDay(todayIdx)
    // else stays at -1 (overview)

    const meRes = await fetch('/api/me')
    if (meRes.ok) {
      const me = await meRes.json()
      setIsOwner(me.id === data.trip.owner_id)
      if (me.profile) setProfile(me.profile)
    }
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

  const saveData = useCallback(async (data: TripData) => {
    setSaving(true)
    try { await fetch(`/api/trips/${id}/data`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) }
    finally { setSaving(false) }
  }, [id])

  const handleDeleteStop = useCallback(async (dayIndex: number, stopIndex: number) => {
    if (!tripData) return
    const deletedStop = tripData.days[dayIndex].stops[stopIndex]
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : { ...day, stops: day.stops.filter((_, si) => si !== stopIndex) }
      ),
      total_stops: Math.max(0, (tripData.total_stops || 0) - 1),
    }
    setTripData(updated)
    await saveData(updated)
    // Persist to deleted history
    const entry: DeletedEntry = { stop: deletedStop, dayIdx: dayIndex, stopIdx: stopIndex, deletedAt: Date.now() }
    setDeletedHistory(prev => {
      const next = [entry, ...prev]
      try { localStorage.setItem(`trip-deleted-${id}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    // Set undo window
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setLastDeleted({ stop: deletedStop, dayIdx: dayIndex, stopIdx: stopIndex })
    undoTimerRef.current = setTimeout(() => setLastDeleted(null), 5000)
  }, [tripData, saveData, id])

  const handleUndo = useCallback(async () => {
    if (!lastDeleted || !tripData) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    const { stop, dayIdx, stopIdx } = lastDeleted
    setLastDeleted(null)
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) => {
        if (di !== dayIdx) return day
        const stops = [...day.stops]
        stops.splice(Math.min(stopIdx, stops.length), 0, stop)
        return { ...day, stops }
      }),
      total_stops: (tripData.total_stops || 0) + 1,
    }
    setTripData(updated)
    await saveData(updated)
    // Remove the most-recent matching entry from history
    setDeletedHistory(prev => {
      const idx = prev.findIndex(e => e.stop.name === stop.name && e.dayIdx === dayIdx)
      if (idx === -1) return prev
      const next = prev.filter((_, i) => i !== idx)
      try { localStorage.setItem(`trip-deleted-${id}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [lastDeleted, tripData, saveData, id])

  const handleAddStop = useCallback(async (stop: Stop) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) => {
        if (di !== activeDay) return day
        const stops = [...day.stops]
        // Insert before the hotel stop, or at the end
        let insertAt = stops.length
        for (let i = stops.length - 1; i >= 0; i--) {
          if (stops[i].type === 'hotel') { insertAt = i; break }
        }
        stops.splice(insertAt, 0, stop)
        return { ...day, stops }
      }),
      total_stops: (tripData.total_stops || 0) + 1,
    }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, activeDay, saveData])

  const handleDeleteEating = useCallback(async (dayIndex: number, eatIndex: number) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : { ...day, eating: (day.eating || []).filter((_, ei) => ei !== eatIndex) }
      ),
    }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, saveData])

  const handleRestore = useCallback(async (entry: DeletedEntry) => {
    if (!tripData) return
    const { stop, dayIdx, stopIdx } = entry
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) => {
        if (di !== dayIdx) return day
        const stops = [...day.stops]
        stops.splice(Math.min(stopIdx, stops.length), 0, stop)
        return { ...day, stops }
      }),
      total_stops: (tripData.total_stops || 0) + 1,
    }
    setTripData(updated)
    await saveData(updated)
    // Remove from history
    setDeletedHistory(prev => {
      const next = prev.filter(e => e !== entry)
      try { localStorage.setItem(`trip-deleted-${id}`, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setShowDeletedSheet(false)
    setActiveDay(dayIdx)
  }, [tripData, saveData, id])

  const handleClearDeletedHistory = useCallback(() => {
    setDeletedHistory([])
    try { localStorage.removeItem(`trip-deleted-${id}`) } catch { /* ignore */ }
  }, [id])

  const [scanState, setScanState] = useState<null | 'scanning' | { fields: string[] }>(null)

  const handlePhotoScan = useCallback(async (dayIndex: number, stopIndex: number, dataUrl: string) => {
    if (!tripData) return
    setScanState('scanning')
    try {
      const stop = tripData.days[dayIndex].stops[stopIndex]
      const res = await fetch(`/api/trips/${id}/scan-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl, stopType: stop.type }),
      })
      if (!res.ok) { setScanState(null); return }
      const { updates } = await res.json() as { updates: Record<string, string> }
      const fields = Object.keys(updates || {}).filter(k => updates[k])
      if (fields.length === 0) { setScanState(null); return }
      const updated: TripData = {
        ...tripData,
        days: tripData.days.map((day, di) =>
          di !== dayIndex ? day : {
            ...day,
            stops: day.stops.map((s, si) => si !== stopIndex ? s : { ...s, ...updates }),
          }
        ),
      }
      setTripData(updated)
      await saveData(updated)
      setScanState({ fields })
      setTimeout(() => setScanState(null), 5000)
    } catch {
      setScanState(null)
    }
  }, [tripData, id, saveData])

  function buildDayRouteUrl(day: Day, startLocation?: string) {
    const stops = day.stops
      .filter(s => s.type !== 'drive' && (s.address || s.name))
      .map(s => (s.address || s.name) as string)

    if (stops.length === 0) {
      // Fall back to navigating to the overnight location only
      if (!day.overnight_location) return null
      const enc = encodeURIComponent(day.overnight_location)
      return { google: `comgooglemaps://?daddr=${enc}&directionsmode=driving`, apple: `maps://maps.apple.com/?daddr=${enc}&dirflg=d`, web: `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving` }
    }

    // Prepend the day's starting location so Google Maps knows the origin
    const wpts = startLocation ? [startLocation, ...stops] : stops
    return buildRouteDayUrl(wpts)
  }

  useEffect(() => {
    loadTrip().then(t => { if (t?.status === 'draft' && !startedRef.current) { startedRef.current = true; startGeneration() } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trip-deleted-${id}`)
      if (raw) setDeletedHistory(JSON.parse(raw) as DeletedEntry[])
    } catch { /* ignore */ }
  }, [id])

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-mist flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🗺️</div><p className="text-soft text-sm">Loading trip…</p></div>
    </div>
  )
  if (!trip) return null

  const days: Day[] = tripData?.days || []

  // ── Generating ────────────────────────────────────────────────────────────────
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
        <div>
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-ink mb-2">Generation failed</h2>
          <p className="text-soft text-sm mb-6">Something went wrong. Please try again.</p>
          <button onClick={() => { startedRef.current = false; startGeneration() }} className="btn-primary">Retry</button>
        </div>
      </div>
    </div>
  )

  // ── Main view ─────────────────────────────────────────────────────────────────
  const currentDay    = activeDay >= 0 ? days[activeDay] : undefined
  // Day starts where the previous night ended; Day 1 starts at the trip origin
  const startLocation = activeDay === 0
    ? (trip.intake_form?.origin || undefined)
    : (days[activeDay - 1]?.overnight_location || undefined)
  const dayRouteUrls  = currentDay ? buildDayRouteUrl(currentDay, startLocation) : null
  const nonDriveCount = currentDay?.stops.filter(s => s.type !== 'drive').length || 0
  const driveMinutes  = currentDay?.stops.filter(s => s.type === 'drive').reduce((a, s) => a + (s.drive_time_mins || 0), 0) || 0
  const driveKm       = currentDay?.stops.filter(s => s.type === 'drive').reduce((a, s) => a + (s.distance_km || 0), 0) || 0

  return (
    <div className="min-h-screen bg-mist">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden text-center" style={{ background: `${HERO_TEXTURE}, ${HERO_GRADIENT}`, paddingTop: 52 }}>
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
          <p className="text-[13px] font-light tracking-[1.5px] uppercase mb-5 px-5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.70)' }}>{tripData.summary}</p>
        )}

        <div className="flex flex-wrap justify-center gap-2 px-5 pb-5">
          {trip.start_date && trip.end_date && (
            <span className="hero-chip">🗓 {new Date(trip.start_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(trip.end_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
          )}
          {tripData?.total_days      && <span className="hero-chip">{tripData.total_days} days</span>}
          {tripData?.total_distance_km && <span className="hero-chip">~{tripData.total_distance_km} km</span>}
          {tripData?.total_stops     && <span className="hero-chip">{tripData.total_stops} stops</span>}
          {trip.intake_form?.num_travellers && <span className="hero-chip">👥 {trip.intake_form.num_travellers} {trip.intake_form.num_travellers === 1 ? 'traveller' : 'travellers'}</span>}
          {profile?.vehicle_name     && <span className="hero-chip">🚗 {profile.vehicle_name}</span>}
          {trip.intake_form?.pets    && <span className="hero-chip">🐾 {trip.intake_form.pets}</span>}
          {saving && <span className="hero-chip opacity-60 text-[11px]">Saving…</span>}
        </div>
      </div>

      {/* ── Sticky day tabs ──────────────────────────────────────────────────── */}
      {days.length > 0 && (
        <div className="bg-white border-b border-line sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <DayTabs days={days} activeIndex={activeDay} onSelect={setActiveDay} />
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {activeDay === -1 && days.length > 0 && (
        <OverviewSection days={days} onSelectDay={setActiveDay} />
      )}
      {activeDay === -1 && days.length === 0 && (
        <div className="px-4 pt-12 text-center text-soft"><p>No days planned yet</p></div>
      )}

      {/* ── Day content ──────────────────────────────────────────────────────── */}
      {activeDay >= 0 && currentDay && (
        <div className="px-4 pt-4 pb-32" style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Day header card */}
          <div className="rounded-card p-5 mb-3.5 relative overflow-hidden" style={{ background: DAY_GRADIENT, boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
            <div className="absolute right-[-20px] top-[-20px] w-[120px] h-[120px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <p className="text-[11px] font-semibold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Day {currentDay.day_number}{currentDay.date ? ` · ${new Date(currentDay.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}` : ''}
            </p>
            <h2 className="font-serif text-[20px] text-white leading-snug mb-3">{currentDay.title || `Day ${currentDay.day_number}`}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {currentDay.overnight_location && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">🌙 <span className="text-white font-semibold">{currentDay.overnight_location}</span></div>
              )}
              {driveMinutes > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">🚗 <span className="text-white font-semibold">{Math.floor(driveMinutes/60)}h {driveMinutes%60}m{driveKm > 0 ? ` · ${Math.round(driveKm)} km` : ''}</span></div>
              )}
              {currentDay.walking_km != null && currentDay.walking_km > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">🚶 <span className="text-white font-semibold">{currentDay.walking_km} km walking</span></div>
              )}
              {currentDay.steps != null && currentDay.steps > 0 && (() => {
                const s  = currentDay.steps!
                const bg = s > 10000 ? 'rgba(22,163,74,0.85)' : s > 5000 ? 'rgba(202,138,4,0.90)' : 'rgba(220,38,38,0.90)'
                const lb = s > 10000 ? 'Active' : s > 5000 ? 'Moderate' : 'Easy'
                return (
                  <div className="flex items-center gap-1.5 text-[13px] text-[#bfdbfe]">
                    👟 <span className="text-white font-semibold">~{s.toLocaleString()} steps</span>
                    <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: bg }}>{lb}</span>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Route button */}
          {dayRouteUrls && (
            <a
              href={dayRouteUrls.web}
              className="flex items-center justify-center gap-2.5 w-full rounded-card py-4 px-5 mb-3.5 no-underline"
              style={{ background: '#2d6a4f', color: '#fff', fontWeight: 600, fontSize: 16, boxShadow: '0 3px 12px rgba(45,106,79,0.35)' }}
            >
              <span className="text-[22px]">🗺️</span>
              <div className="text-left leading-snug">
                <span className="block">Open Route in Maps</span>
                <span className="block text-[12px] font-normal opacity-85">
                  {startLocation ? `From ${startLocation.split(',')[0]} · ` : ''}{nonDriveCount} stops · opens Google Maps
                </span>
              </div>
            </a>
          )}

          {/* BBC Weather button */}
          {currentDay.overnight_location && (
            <a
              href={`https://www.bbc.co.uk/weather/search?q=${encodeURIComponent(currentDay.overnight_location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-card py-3 px-5 mb-3.5 no-underline text-[13px] font-semibold"
              style={{ background: '#dbeafe', color: '#2563a8', border: '1px solid rgba(37,99,168,0.2)' }}
            >
              <span>🌤</span>
              <span>Check BBC Weather for {currentDay.overnight_location}</span>
            </a>
          )}

          {/* Map tip banner */}
          {nonDriveCount > 1 && (
            <div className="map-tip text-soft">
              💡 Missed or skipping a stop? Tap <strong className="text-ink">📍 Navigate</strong> on any stop below — no need to restart the full route.
            </div>
          )}

          {/* Stops */}
          {currentDay.stops.length > 0 && (
            <div className="bg-white rounded-card mb-3.5" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
              <div className="bg-card-bg border-b border-line px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[1.5px] uppercase text-soft">Stops &amp; Places of Interest</span>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    {deletedHistory.length > 0 && (
                      <button
                        onClick={() => setShowDeletedSheet(true)}
                        className="flex items-center gap-1 h-7 rounded-full px-2 text-[11px] font-semibold active:opacity-80"
                        style={{ background: '#fee2e2', color: '#b91c1c' }}
                        title="View removed stops"
                      >
                        🗑 {deletedHistory.length}
                      </button>
                    )}
                    <button
                      onClick={() => setAddSheetOpen(true)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xl leading-none font-bold active:opacity-80"
                      style={{ background: '#2563a8', lineHeight: 1 }}
                      title="Add a stop"
                    >+</button>
                  </div>
                )}
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
                    onScanPhoto={isOwner ? (url) => handlePhotoScan(activeDay, i, url) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes gold box */}
          {currentDay.notes && (
            <div className="rounded-card p-4 mb-3.5 border" style={{ background: '#fef3d0', borderColor: '#f0c040' }}>
              <p className="text-[12px] font-semibold tracking-[1px] uppercase mb-2" style={{ color: '#c9963a' }}>📌 Notes</p>
              {currentDay.notes.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className="text-[13px] leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:font-bold" style={{ color: '#5a3e00' }}>{line}</p>
              ))}
            </div>
          )}

          {/* Activities, Eating & Tips panel */}
          <InfoPanel
            eating={currentDay.eating}
            sections={currentDay.sections}
            isOwner={isOwner}
            onDeleteEating={(eatIndex) => handleDeleteEating(activeDay, eatIndex)}
          />

          {/* Emergency / SOS contacts */}
          {tripData?.emergency_contacts && tripData.emergency_contacts.length > 0 && (
            <div className="rounded-card mb-3.5 overflow-hidden border border-red-200">
              <button
                onClick={() => setSosOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-red-50 active:bg-red-100"
              >
                <span className="text-[13px] font-semibold text-red-700">🆘 Emergency &amp; SOS contacts</span>
                <span className={`text-line text-[10px] transition-transform ${sosOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {sosOpen && (
                <div>
                  {tripData.emergency_contacts.map((c, i) => {
                    const href = c.phone
                      ? `tel:${c.phone}`
                      : c.address
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`
                        : undefined
                    const typeIcon = c.type === 'vet' ? '🐾' : c.type === 'hospital' ? '🏥' : c.type === 'police' ? '🚨' : c.type === 'breakdown' ? '🔧' : '📞'
                    return href ? (
                      <a
                        key={i}
                        href={href}
                        className="flex items-center gap-3 px-4 py-3 bg-white no-underline border-b border-red-100 last:border-none active:bg-red-50"
                      >
                        <span className="text-[20px] w-7 text-center flex-shrink-0">{typeIcon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] text-ink">{c.name}</p>
                          <p className="text-[13px] text-sky">{c.phone || (c.address ? 'Tap for map →' : '')}</p>
                          {c.notes && <p className="text-[11px] text-soft italic">{c.notes}</p>}
                        </div>
                      </a>
                    ) : (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white border-b border-red-100 last:border-none">
                        <span className="text-[20px] w-7 text-center flex-shrink-0">{typeIcon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] text-ink">{c.name}</p>
                          <p className="text-[11px] text-soft uppercase tracking-wide">{c.type}</p>
                          {c.notes && <p className="text-[11px] text-soft italic">{c.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Prev / Next */}
          <div className="flex gap-3 pt-2">
            {activeDay > 0           && <button onClick={() => setActiveDay(activeDay-1)} className="btn-secondary flex-1">← Day {activeDay}</button>}
            {activeDay < days.length-1 && <button onClick={() => setActiveDay(activeDay+1)} className="btn-primary flex-1">Day {activeDay+2} →</button>}
          </div>
        </div>
      )}

      {/* ── Scan photo toast ─────────────────────────────────────────────────── */}
      {scanState && (
        <div
          className="fixed left-4 right-4 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl"
          style={{ bottom: 88, background: '#1e3a5f' }}
        >
          {scanState === 'scanning' ? (
            <>
              <div className="w-4 h-4 border-2 rounded-full flex-shrink-0 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} />
              <p className="text-[13px] text-white">Analysing photo…</p>
            </>
          ) : (
            <>
              <span className="text-lg flex-shrink-0">✅</span>
              <p className="text-[13px] text-white">
                Found: {(scanState as { fields: string[] }).fields
                  .map(f => ({ check_in:'check-in', check_out:'check-out', booking_ref:'booking ref', address:'address', name:'name', phone:'phone', website:'website', notes:'notes' }[f] || f))
                  .join(', ')}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Undo toast ───────────────────────────────────────────────────────── */}
      {lastDeleted && (
        <div
          className="fixed left-4 right-4 z-[60] flex items-center justify-between rounded-xl px-4 py-3 shadow-2xl"
          style={{ bottom: 88, background: '#1a1a2e' }}
        >
          <p className="text-[13px] text-white truncate">🗑 &ldquo;{lastDeleted.stop.name}&rdquo; removed</p>
          <button
            onClick={handleUndo}
            className="text-[13px] font-bold ml-4 flex-shrink-0 active:opacity-70"
            style={{ color: '#93c5fd' }}
          >Undo</button>
        </div>
      )}

      {/* ── Add stop sheet ───────────────────────────────────────────────────── */}
      {trip && activeDay >= 0 && currentDay && (
        <AddStopSheet
          tripId={id}
          dayIndex={activeDay}
          dayTitle={currentDay.title || ''}
          isOpen={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          onAdd={handleAddStop}
        />
      )}

      {/* ── Deleted stops sheet ──────────────────────────────────────────────── */}
      <DeletedStopsSheet
        isOpen={showDeletedSheet}
        onClose={() => setShowDeletedSheet(false)}
        entries={deletedHistory}
        days={days}
        onRestore={handleRestore}
        onClearAll={handleClearDeletedHistory}
      />
    </div>
  )
}
