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

export default function StopCard({ stop, index, isFirst=false, isLast=false, onDelete, isOwner=false }: Props) {
  const [expanded, setExpanded]   = useState(false)
  const [confirming, setConfirming] = useState(false)

  const icon      = ICONS[stop.type] || '📍'
  const isDrive   = stop.type === 'drive'
  const isSuggested = stop.suggested === true
  const hasDetail = !!(stop.description || stop.booking_ref || stop.address || stop.phone || stop.website || stop.notes)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirming) { onDelete?.() }
    else { setConfirming(true); setTimeout(() => setConfirming(false), 3000) }
  }

  return (
    <div className="flex items-stretch">
      {/* Timeline */}
      <div className="w-[60px] flex-shrink-0 flex flex-col items-center pt-[14px]">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[15px] flex-shrink-0 relative z-10 ${dotClass(stop.type, isFirst, isLast)}`}>
          {icon}
        </div>
        {!isLast && <div className="flex-1 w-0.5 bg-line mt-1" style={{ minHeight: 24 }} />}
      </div>

      {/* Content */}
      <div
        className={`flex-1 py-3 pr-4 ${!isLast ? 'border-b border-line' : ''} ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isSuggested && (
              <span className="inline-block text-[10px] bg-sky-light text-sky px-2 py-0.5 rounded-full font-semibold mb-1">✨ Optional</span>
            )}
            <p className="font-semibold text-[15px] text-ink leading-snug mb-0.5">{stop.name}</p>
            {isDrive && stop.drive_time_mins != null && (
              <p className="text-[13px] text-soft">
                {Math.floor(stop.drive_time_mins/60)}h {stop.drive_time_mins%60}m
                {stop.distance_km ? ` · ${stop.distance_km} km` : ''}
              </p>
            )}
            {!isDrive && stop.duration_mins != null && (
              <p className="text-[13px] text-soft">
                ⏱ {stop.duration_mins < 60 ? `${stop.duration_mins}m` : `${Math.floor(stop.duration_mins/60)}h ${stop.duration_mins%60}m`}
              </p>
            )}
            {stop.type === 'hotel' && stop.check_in && (
              <p className="text-[12px] text-soft">Check-in {stop.check_in} · Out {stop.check_out}</p>
            )}
            {stop.description && !expanded && (
              <p className="text-[13px] text-soft mt-1 line-clamp-2 leading-snug">{stop.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
            {!isDrive && stop.address && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}&travelmode=driving`}
                className="stop-nav-btn"
                onClick={e => e.stopPropagation()}
              >🗺️ Nav</a>
            )}
            {isOwner && !isDrive && (
              <button
                onClick={handleDelete}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  confirming ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 active:bg-red-100 active:text-red-500'
                }`}
              >{confirming ? '✓' : '×'}</button>
            )}
            {hasDetail && (
              <span className={`text-line text-[10px] inline-block select-none transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
            )}
          </div>
        </div>

        {expanded && hasDetail && (
          <div className="mt-2 space-y-1.5">
            {stop.description && <p className="text-[13px] text-soft leading-snug">{stop.description}</p>}
            {stop.address    && <p className="text-[12px] text-soft">📍 {stop.address}</p>}
            {stop.phone      && <a href={`tel:${stop.phone}`} className="text-[12px] text-sky block">📞 {stop.phone}</a>}
            {stop.website    && (
              <a href={stop.website} target="_blank" rel="noopener noreferrer" className="text-[12px] text-sky block truncate">
                🔗 {stop.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {stop.booking_ref && <p className="text-[12px] font-mono text-ink">🎟️ {stop.booking_ref}</p>}
            {stop.notes && (
              <div className="bg-gold-pale border border-[#f0c040] rounded-lg p-2.5 mt-1">
                <p className="text-[12px]" style={{ color: '#5a3e00' }}>{stop.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
