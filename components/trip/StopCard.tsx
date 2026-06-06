'use client'
import { useState, useRef } from 'react'
import type { Stop } from '@/lib/types'

interface Props {
  stop: Stop
  index: number
  isFirst?: boolean
  isLast?: boolean
  onDelete?: () => void
  onUpdate?: (patch: Partial<Stop>) => void
  isOwner?: boolean
  tripId?: string
}

function dotClass(type: string, isFirst: boolean, isLast: boolean) {
  if (isFirst)                          return 'border-[#2d6a4f] bg-[#d8f3dc]'
  if (isLast || type === 'hotel')       return 'border-[#2563a8] bg-[#dbeafe]'
  if (type === 'fuel')                  return 'border-[#c9963a] bg-[#fef3d0]'
  if (['sightseeing','activity','viewpoint','castle','museum','distillery','town'].includes(type))
                                        return 'border-[#6b4f7a] bg-[#f3eef7]'
  if (['nature','beach'].includes(type))return 'border-[#2d6a4f] bg-[#d8f3dc]'
  if (['restaurant','cafe','pub'].includes(type)) return 'border-[#e07b39] bg-[#fff0e4]'
  return 'border-[#d1d9e6] bg-white'
}

const ICONS: Record<string, string> = {
  drive:'🚗', hotel:'🛏️', sightseeing:'🏛️', activity:'🎯', viewpoint:'📸',
  town:'🏘️', restaurant:'🍽️', cafe:'☕', pub:'🍺', beach:'🏖️', nature:'🌿',
  castle:'🏰', distillery:'🥃', museum:'🏛️', fuel:'⛽', other:'📍',
}

function policyStyle(policy: string): { icon: string; bg: string; color: string; border: string } {
  const p = policy.toLowerCase()
  if (p.includes('free') || (p.includes('cancel') && !p.includes('non'))) {
    return { icon: '🔓', bg: '#d8f3dc', color: '#1a4731', border: '#b7e4c7' }
  }
  if (p.includes('non-refund') || p.includes('nonrefund') || p.includes('no refund') || p.includes('non refund')) {
    return { icon: '🔒', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
  }
  return { icon: '📋', bg: '#e8edf5', color: '#334155', border: '#d1d9e6' }
}

function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX_W = 1200
        const scale = Math.min(1, MAX_W / img.width)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function StopCard({ stop, isFirst=false, isLast=false, onDelete, onUpdate, isOwner=false, tripId }: Props) {
  const [dragX,          setDragX]          = useState(0)
  const [isDragging,     setIsDragging]     = useState(false)
  const [swipeOpen,      setSwipeOpen]      = useState(false)
  const [editingPolicy,  setEditingPolicy]  = useState(false)
  const [draftPolicy,    setDraftPolicy]    = useState(stop.cancellation_policy || '')
  const [draftPayAt,     setDraftPayAt]     = useState(stop.pay_at_hotel ?? false)
  const [scanningPolicy, setScanningPolicy] = useState(false)

  const pointerRef    = useRef<{ active: boolean; startX: number; startY: number; locked: boolean }>({
    active: false, startX: 0, startY: 0, locked: false,
  })
  const policyFileRef = useRef<HTMLInputElement>(null)

  const isDrive      = stop.type === 'drive'
  const isHotel      = stop.type === 'hotel'
  const canSwipe     = isOwner && !isDrive
  const icon         = ICONS[stop.type] || '📍'
  const websiteLabel = stop.website_label || 'Website'
  const navigateUrl  = !isDrive
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address || stop.name)}`
    : null

  const translateX = swipeOpen ? -100 : dragX

  function closeSwipe() { setSwipeOpen(false); setDragX(0) }

  function openEditPolicy() {
    setDraftPolicy(stop.cancellation_policy || '')
    setDraftPayAt(stop.pay_at_hotel ?? false)
    setEditingPolicy(true)
  }

  function savePolicy() {
    onUpdate?.({
      cancellation_policy: draftPolicy.trim() || undefined,
      pay_at_hotel: draftPayAt || undefined,
    })
    setEditingPolicy(false)
  }

  async function handleScanPolicy(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tripId) return
    e.target.value = ''
    setScanningPolicy(true)
    try {
      const dataUrl = await compressImage(file)
      const res = await fetch(`/api/trips/${tripId}/scan-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl, stopType: 'hotel' }),
      })
      const { updates } = await res.json() as { updates: Record<string, unknown> }
      if (updates?.cancellation_policy) setDraftPolicy(String(updates.cancellation_policy))
      if (updates?.pay_at_hotel !== undefined) setDraftPayAt(Boolean(updates.pay_at_hotel))
    } catch { /* silent */ } finally {
      setScanningPolicy(false)
    }
  }

  // ── Pointer / swipe handlers ─────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    if (swipeOpen) closeSwipe()
    pointerRef.current = { active: true, startX: e.clientX, startY: e.clientY, locked: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = pointerRef.current
    if (!p.active) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY

    if (!p.locked) {
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) return
      if (dx > 0) { p.active = false; return }
      p.locked = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    setIsDragging(true)
    setDragX(Math.max(-100, Math.min(0, dx)))
  }

  function onPointerUp() {
    if (!pointerRef.current.active) return
    pointerRef.current.active = false
    setIsDragging(false)
    if (dragX < -50) {
      setSwipeOpen(true)
      setDragX(0)
    } else {
      setDragX(0)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden">

      {/* Delete panel — only rendered while dragging or snapped open */}
      {canSwipe && (swipeOpen || dragX < 0) && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-red-500 flex items-center justify-center"
          style={{ width: swipeOpen ? 100 : Math.min(100, -dragX) }}
        >
          {swipeOpen ? (
            <button
              className="flex flex-col items-center gap-1 text-white font-bold py-3 px-4 active:opacity-75"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { closeSwipe(); onDelete?.() }}
            >
              <span className="text-[22px]">🗑</span>
              <span className="text-[13px]">Delete</span>
            </button>
          ) : (
            -dragX > 50 && <span className="text-white text-[13px] font-bold">Delete →</span>
          )}
        </div>
      )}

      {/* Transparent overlay — tapping the card when panel is open closes it */}
      {swipeOpen && (
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ right: 100, zIndex: 15 }}
          onClick={closeSwipe}
        />
      )}

      {/* Sliding card */}
      <div
        className="relative bg-white"
        style={{
          transform:  translateX !== 0 ? `translateX(${translateX}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
          touchAction: canSwipe ? 'pan-y' : undefined,
        }}
        onPointerDown={canSwipe ? onPointerDown : undefined}
        onPointerMove={canSwipe ? onPointerMove : undefined}
        onPointerUp={canSwipe ? onPointerUp : undefined}
        onPointerCancel={canSwipe ? onPointerUp : undefined}
      >
        <div className="flex items-stretch">
          {/* Timeline dot + connector */}
          <div className="w-[60px] flex-shrink-0 flex flex-col items-center pt-[14px]">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[15px] flex-shrink-0 relative z-10 ${dotClass(stop.type, isFirst, isLast)}`}>
              {icon}
            </div>
            {!isLast && <div className="flex-1 w-0.5 bg-line mt-1" style={{ minHeight: 24 }} />}
          </div>

          {/* Content */}
          <div className={`flex-1 py-3 pr-4 ${!isLast ? 'border-b border-line' : ''}`}>

            {/* Name + × button */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {(stop.suggested || stop.dog_friendly) && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {stop.suggested    && <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold">✨ Optional</span>}
                    {stop.dog_friendly && <span className="inline-block text-[10px] bg-[#d8f3dc] text-[#2d6a4f] px-2 py-0.5 rounded-full font-semibold border border-[#b7e4c7]">🐾 Dog friendly</span>}
                  </div>
                )}
                <p className="font-semibold text-[15px] text-ink leading-snug">{stop.name}</p>
              </div>
              {canSwipe && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setSwipeOpen(true) }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs bg-gray-100 text-gray-400 active:bg-red-100 active:text-red-500 flex-shrink-0 mt-0.5"
                >×</button>
              )}
            </div>

            {/* Drive stats */}
            {isDrive && stop.drive_time_mins != null && (
              <p className="text-[13px] text-soft mt-0.5">
                {Math.floor(stop.drive_time_mins/60)}h {stop.drive_time_mins%60}m
                {stop.distance_km ? ` · ${stop.distance_km} km` : ''}
              </p>
            )}
            {/* Duration */}
            {!isDrive && stop.duration_mins != null && (
              <p className="text-[13px] text-soft mt-0.5">
                ⏱ {stop.duration_mins < 60
                  ? `${stop.duration_mins}m`
                  : `${Math.floor(stop.duration_mins/60)}h ${stop.duration_mins%60}m`}
              </p>
            )}
            {/* Hotel check-in/out */}
            {isHotel && stop.check_in && (
              <p className="text-[12px] text-soft mt-0.5">Check-in {stop.check_in} · Out {stop.check_out}</p>
            )}

            {/* Cancellation / payment policy badges */}
            {isHotel && (stop.cancellation_policy || stop.pay_at_hotel) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {stop.pay_at_hotel && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef9ec', color: '#92400e', border: '1px solid #f6d860' }}>
                    💳 Pay at hotel
                  </span>
                )}
                {stop.cancellation_policy && (() => {
                  const s = policyStyle(stop.cancellation_policy)
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {s.icon} {stop.cancellation_policy}
                    </span>
                  )
                })()}
              </div>
            )}

            {/* Description */}
            {stop.description && (
              <p className="text-[13px] text-soft leading-snug mt-1.5">{stop.description}</p>
            )}

            {/* Address */}
            {stop.address && (
              <p className="text-[12px] text-soft mt-1">📍 {stop.address}</p>
            )}

            {/* Booking ref — hotel refs are masked for non-owners; other stop refs are always shown */}
            {stop.booking_ref && (isOwner || !isHotel) && (
              <p className="text-[12px] font-mono text-ink mt-1">🎟️ {stop.booking_ref}</p>
            )}
            {stop.booking_ref && !isOwner && isHotel && (
              <p className="text-[12px] text-soft mt-1">🎟️ <span className="font-mono tracking-widest" style={{ letterSpacing: '0.15em' }}>••••••••</span> <span className="italic">(owner only)</span></p>
            )}

            {/* Action pills */}
            {!isDrive && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {navigateUrl && (
                  <a href={navigateUrl} className="stop-nav-btn" onPointerDown={e => e.stopPropagation()}>📍 Navigate</a>
                )}
                {stop.website && (
                  <a href={stop.website} target="_blank" rel="noopener noreferrer" className="stop-link-green" onPointerDown={e => e.stopPropagation()}>
                    🌐 {websiteLabel}
                  </a>
                )}
                {stop.phone && (
                  <a href={`tel:${stop.phone}`} className="stop-nav-btn" onPointerDown={e => e.stopPropagation()}>📞 Call</a>
                )}
              </div>
            )}

            {/* Notes gold box — hotel notes hidden from shared viewers (may contain access codes) */}
            {stop.notes && (isOwner || !isHotel) && (
              <div className="bg-gold-pale border border-[#f0c040] rounded-lg p-2.5 mt-2">
                <p className="text-[12px]" style={{ color: '#5a3e00' }}>{stop.notes}</p>
              </div>
            )}
            {stop.notes && !isOwner && isHotel && (
              <div className="rounded-lg p-2.5 mt-2" style={{ background: '#f1f5f9', border: '1px solid #d1d9e6' }}>
                <p className="text-[12px] text-soft italic">🔒 Access details — visible to trip owner only</p>
              </div>
            )}

            {/* Hotel policy edit (owner only) */}
            {isHotel && isOwner && onUpdate && (
              <div onPointerDown={e => e.stopPropagation()}>
                {!editingPolicy ? (
                  <button
                    onClick={() => openEditPolicy()}
                    className="mt-2 text-[11px] font-semibold active:opacity-60"
                    style={{ color: '#94a3b8' }}
                  >
                    📋 {stop.cancellation_policy || stop.pay_at_hotel ? 'Edit' : 'Add'} booking policy
                  </button>
                ) : (
                  <div className="mt-2 rounded-xl p-3 space-y-2.5" style={{ background: '#f1f5f9' }}>
                    {/* Pay at hotel toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDraftPayAt(v => !v)}
                        className="relative flex-shrink-0 rounded-full transition-colors"
                        style={{ width: 40, height: 22, background: draftPayAt ? '#d97706' : '#cbd5e1' }}
                      >
                        <span
                          className="absolute top-[2px] rounded-full bg-white shadow transition-all"
                          style={{ width: 18, height: 18, left: draftPayAt ? 20 : 2 }}
                        />
                      </button>
                      <span className="text-[12px] font-medium text-ink">💳 Pay at hotel</span>
                    </div>

                    {/* Cancellation policy */}
                    <input
                      type="text"
                      placeholder="Cancellation policy — e.g. Free until 14 Jun"
                      value={draftPolicy}
                      onChange={e => setDraftPolicy(e.target.value)}
                      className="input-field text-[13px] w-full"
                      style={{ padding: '8px 12px' }}
                    />

                    {/* Scan button */}
                    {tripId && (
                      <button
                        onClick={() => policyFileRef.current?.click()}
                        disabled={scanningPolicy}
                        className="flex items-center gap-1.5 text-[11px] font-semibold active:opacity-70 disabled:opacity-40"
                        style={{ color: '#2563a8' }}
                      >
                        <span>{scanningPolicy ? '⏳' : '📷'}</span>
                        {scanningPolicy ? 'Scanning…' : 'Scan booking screenshot'}
                      </button>
                    )}
                    <input
                      ref={policyFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScanPolicy}
                    />

                    {/* Save / Cancel */}
                    <div className="flex gap-2">
                      <button
                        onClick={savePolicy}
                        className="flex-1 py-2 rounded-lg text-[13px] font-semibold text-white active:opacity-80"
                        style={{ background: '#2563a8' }}
                      >Save</button>
                      <button
                        onClick={() => setEditingPolicy(false)}
                        className="flex-1 py-2 rounded-lg text-[13px] font-semibold border border-line text-soft active:bg-mist"
                      >Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
