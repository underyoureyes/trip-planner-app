'use client'
import { useState, useRef } from 'react'
import type { Stop } from '@/lib/types'

interface Props {
  stop: Stop
  index: number
  isFirst?: boolean
  isLast?: boolean
  onDelete?: () => void
  isOwner?: boolean
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

export default function StopCard({ stop, isFirst=false, isLast=false, onDelete, isOwner=false }: Props) {
  const [confirming,  setConfirming]  = useState(false)
  const [dragX,       setDragX]       = useState(0)
  const [isDragging,  setIsDragging]  = useState(false)

  const pointerRef = useRef<{ active: boolean; startX: number; startY: number; locked: boolean }>({
    active: false, startX: 0, startY: 0, locked: false,
  })

  const isDrive   = stop.type === 'drive'
  const canSwipe  = isOwner && !isDrive
  const icon      = ICONS[stop.type] || '📍'
  const websiteLabel = stop.website_label || 'Website'
  const navigateUrl  = !isDrive
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address || stop.name)}`
    : null

  // Tap-to-confirm delete (× button); swipe triggers immediate delete
  function triggerDelete(immediate = false) {
    if (immediate) { onDelete?.(); return }
    if (confirming) { onDelete?.() }
    else { setConfirming(true); setTimeout(() => setConfirming(false), 3000) }
  }

  // ── Swipe-to-delete pointer events ───────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    pointerRef.current = { active: true, startX: e.clientX, startY: e.clientY, locked: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = pointerRef.current
    if (!p.active) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY

    if (!p.locked) {
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) return // wait for clear direction
      if (dx > 0) { p.active = false; return }                    // right swipe — ignore
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
    if (dragX < -70) triggerDelete(true)
    setDragX(0)
  }

  return (
    <div className="relative overflow-hidden">
      {/* Red delete background revealed on swipe */}
      {canSwipe && dragX < 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-red-500 flex items-center justify-end pr-4"
          style={{ width: `${-dragX}px` }}
        >
          {-dragX > 50 && (
            <span className="text-white text-[13px] font-bold whitespace-nowrap">Delete</span>
          )}
        </div>
      )}

      {/* Sliding card content */}
      <div
        className="flex items-stretch"
        style={{
          transform:  dragX !== 0 ? `translateX(${dragX}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
          touchAction: canSwipe ? 'pan-y' : undefined,
        }}
        onPointerDown={canSwipe ? onPointerDown : undefined}
        onPointerMove={canSwipe ? onPointerMove : undefined}
        onPointerUp={canSwipe ? onPointerUp : undefined}
        onPointerCancel={canSwipe ? onPointerUp : undefined}
      >
        {/* Timeline dot + connector */}
        <div className="w-[60px] flex-shrink-0 flex flex-col items-center pt-[14px]">
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[15px] flex-shrink-0 relative z-10 ${dotClass(stop.type, isFirst, isLast)}`}>
            {icon}
          </div>
          {!isLast && <div className="flex-1 w-0.5 bg-line mt-1" style={{ minHeight: 24 }} />}
        </div>

        {/* Content */}
        <div className={`flex-1 py-3 pr-4 ${!isLast ? 'border-b border-line' : ''}`}>

          {/* Name + delete button */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {(stop.suggested || stop.dog_friendly) && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {stop.suggested   && <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold">✨ Optional</span>}
                  {stop.dog_friendly && <span className="inline-block text-[10px] bg-[#d8f3dc] text-[#2d6a4f] px-2 py-0.5 rounded-full font-semibold border border-[#b7e4c7]">🐾 Dog friendly</span>}
                </div>
              )}
              <p className="font-semibold text-[15px] text-ink leading-snug">{stop.name}</p>
            </div>
            {isOwner && !isDrive && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); triggerDelete() }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors flex-shrink-0 mt-0.5 ${
                  confirming ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 active:bg-red-100 active:text-red-500'
                }`}
              >{confirming ? '✓' : '×'}</button>
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
          {stop.type === 'hotel' && stop.check_in && (
            <p className="text-[12px] text-soft mt-0.5">Check-in {stop.check_in} · Out {stop.check_out}</p>
          )}

          {/* Description */}
          {stop.description && (
            <p className="text-[13px] text-soft leading-snug mt-1.5">{stop.description}</p>
          )}

          {/* Address */}
          {stop.address && (
            <p className="text-[12px] text-soft mt-1">📍 {stop.address}</p>
          )}

          {/* Booking ref */}
          {stop.booking_ref && (
            <p className="text-[12px] font-mono text-ink mt-1">🎟️ {stop.booking_ref}</p>
          )}

          {/* Action pills */}
          {!isDrive && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {navigateUrl && (
                <a href={navigateUrl} className="stop-nav-btn">📍 Navigate</a>
              )}
              {stop.website && (
                <a href={stop.website} target="_blank" rel="noopener noreferrer" className="stop-link-green">
                  🌐 {websiteLabel}
                </a>
              )}
              {stop.phone && (
                <a href={`tel:${stop.phone}`} className="stop-nav-btn">📞 Call</a>
              )}
            </div>
          )}

          {/* Notes gold box */}
          {stop.notes && (
            <div className="bg-gold-pale border border-[#f0c040] rounded-lg p-2.5 mt-2">
              <p className="text-[12px]" style={{ color: '#5a3e00' }}>{stop.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
