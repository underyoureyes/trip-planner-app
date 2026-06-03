'use client'
import { useState } from 'react'
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
  const [confirming, setConfirming] = useState(false)

  const icon          = ICONS[stop.type] || '📍'
  const isDrive       = stop.type === 'drive'
  const isSuggested   = stop.suggested === true
  const isDogFriendly = stop.dog_friendly === true
  const websiteLabel  = stop.website_label || 'Website'

  const navigateUrl = !isDrive
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address || stop.name)}`
    : null

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirming) { onDelete?.() }
    else { setConfirming(true); setTimeout(() => setConfirming(false), 3000) }
  }

  return (
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

        {/* Name row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {(isSuggested || isDogFriendly) && (
              <div className="flex flex-wrap gap-1 mb-1">
                {isSuggested   && <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold">✨ Optional</span>}
                {isDogFriendly && <span className="inline-block text-[10px] bg-[#d8f3dc] text-[#2d6a4f] px-2 py-0.5 rounded-full font-semibold border border-[#b7e4c7]">🐾 Dog friendly</span>}
              </div>
            )}
            <p className="font-semibold text-[15px] text-ink leading-snug">{stop.name}</p>
          </div>
          {isOwner && !isDrive && (
            <button
              onClick={handleDelete}
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
            ⏱ {stop.duration_mins < 60 ? `${stop.duration_mins}m` : `${Math.floor(stop.duration_mins/60)}h ${stop.duration_mins%60}m`}
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
              <a href={navigateUrl} className="stop-nav-btn">
                📍 Navigate
              </a>
            )}
            {stop.website && (
              <a href={stop.website} target="_blank" rel="noopener noreferrer" className="stop-link-green">
                🌐 {websiteLabel}
              </a>
            )}
            {stop.phone && (
              <a href={`tel:${stop.phone}`} className="stop-nav-btn">
                📞 Call
              </a>
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
  )
}
