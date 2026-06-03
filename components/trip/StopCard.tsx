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
  onPhotoChange?: (url: string) => void
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

export default function StopCard({ stop, isFirst=false, isLast=false, onDelete, isOwner=false, onPhotoChange }: Props) {
  const [dragX,      setDragX]      = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swipeOpen,  setSwipeOpen]  = useState(false)
  const [lightbox,   setLightbox]   = useState(false)

  const fileRef    = useRef<HTMLInputElement>(null)
  const pointerRef = useRef<{ active: boolean; startX: number; startY: number; locked: boolean }>({
    active: false, startX: 0, startY: 0, locked: false,
  })

  const isDrive      = stop.type === 'drive'
  const canSwipe     = isOwner && !isDrive
  const icon         = ICONS[stop.type] || '📍'
  const websiteLabel = stop.website_label || 'Website'
  const navigateUrl  = !isDrive
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address || stop.name)}`
    : null

  // When swipeOpen the card is fixed at -100px; during drag dragX drives the offset
  const translateX = swipeOpen ? -100 : dragX

  function closeSwipe() { setSwipeOpen(false); setDragX(0) }

  // ── Pointer / swipe handlers ─────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    // New drag always cancels the open panel
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
      // Snap open → show the Delete button
      setSwipeOpen(true)
      setDragX(0)
    } else {
      setDragX(0)
    }
  }

  // ── Photo handlers ───────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await compressImage(file)
    onPhotoChange?.(url)
    e.target.value = ''
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden">

      {/* Delete panel (revealed behind the card when swiped) */}
      {canSwipe && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500"
          style={{ width: 100 }}
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
            dragX < -50 && <span className="text-white text-[13px] font-bold">Delete →</span>
          )}
        </div>
      )}

      {/* Transparent overlay — tapping the card when panel is open just closes it */}
      {swipeOpen && (
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ right: 100, zIndex: 15 }}
          onClick={closeSwipe}
        />
      )}

      {/* Sliding card */}
      <div
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

        {/* Photo thumbnail (full-width, tappable to lightbox) */}
        {stop.photo_url && (
          <button
            className="w-full block"
            style={{ lineHeight: 0 }}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setLightbox(true)}
          >
            <img
              src={stop.photo_url}
              alt={stop.name}
              className="w-full object-cover"
              style={{ maxHeight: 200 }}
            />
          </button>
        )}

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
              {/* × opens the delete panel (same as swiping) */}
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
                {isOwner && (
                  <button
                    className="stop-nav-btn"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => fileRef.current?.click()}
                  >
                    📷 {stop.photo_url ? 'Change photo' : 'Add photo'}
                  </button>
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

      {/* Hidden file input — no capture= so user can choose camera or library */}
      {isOwner && !isDrive && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      )}

      {/* Lightbox */}
      {lightbox && stop.photo_url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={stop.photo_url}
            alt={stop.name}
            className="max-w-full max-h-screen object-contain"
            style={{ padding: 16 }}
          />
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold active:opacity-70"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onClick={e => { e.stopPropagation(); setLightbox(false) }}
          >×</button>
        </div>
      )}
    </div>
  )
}
