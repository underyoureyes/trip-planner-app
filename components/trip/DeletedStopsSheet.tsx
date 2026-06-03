'use client'
import { useState, useEffect } from 'react'
import type { Stop, Day } from '@/lib/types'

export interface DeletedEntry {
  stop: Stop
  dayIdx: number
  stopIdx: number
  deletedAt: number
}

const STOP_ICONS: Record<string, string> = {
  drive:'🚗', hotel:'🛏️', sightseeing:'🏛️', activity:'🎯', viewpoint:'📸',
  town:'🏘️', restaurant:'🍽️', cafe:'☕', pub:'🍺', beach:'🏖️', nature:'🌿',
  castle:'🏰', distillery:'🥃', museum:'🏛️', fuel:'⛽', other:'📍',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  entries: DeletedEntry[]
  days: Day[]
  onRestore: (entry: DeletedEntry) => void
  onClearAll: () => void
}

export default function DeletedStopsSheet({ isOpen, onClose, entries, days, onRestore, onClearAll }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) setTimeout(() => setVisible(true), 10)
    else setVisible(false)
  }, [isOpen])

  if (!isOpen) return null

  function timeAgo(ts: number) {
    const mins = Math.round((Date.now() - ts) / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        style={{
          maxHeight: '80vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        <div className="px-5 pb-10 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 24px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between mt-2 mb-4">
            <div>
              <h2 className="font-serif text-[20px] text-ink">Removed stops</h2>
              <p className="text-[12px] text-soft">
                {entries.length === 0
                  ? 'Nothing removed'
                  : `${entries.length} ${entries.length === 1 ? 'stop' : 'stops'} — tap to restore`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-mist text-soft flex items-center justify-center text-lg leading-none active:bg-line"
            >×</button>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-4xl mb-3">🗑</p>
              <p className="text-soft text-[14px]">No removed stops</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, i) => {
                const dayTitle = days[entry.dayIdx]?.title || `Day ${entry.dayIdx + 1}`
                const icon = STOP_ICONS[entry.stop.type] || '📍'
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white rounded-card px-4 py-3 border border-line"
                    style={{ boxShadow: '0 1px 8px rgba(26,26,46,0.07)' }}
                  >
                    <span className="text-[22px] flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] text-ink leading-snug">{entry.stop.name}</p>
                      <p className="text-[12px] text-soft truncate">
                        Day {entry.dayIdx + 1} · {dayTitle} · {timeAgo(entry.deletedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => onRestore(entry)}
                      className="flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg active:opacity-80"
                      style={{ background: '#d8f3dc', color: '#2d6a4f' }}
                    >↩ Restore</button>
                  </div>
                )
              })}
            </div>
          )}

          {entries.length > 0 && (
            <button
              onClick={onClearAll}
              className="w-full mt-5 py-3 text-[13px] text-soft border border-line rounded-card active:bg-mist"
            >Clear all removed stops</button>
          )}
        </div>
      </div>
    </div>
  )
}
