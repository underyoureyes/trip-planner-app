'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Trip, TripData, Day, Eating, DaySection, Stop, EmergencyContact } from '@/lib/types'
import { buildRouteDayUrl, buildDayRouteUrl } from '@/lib/navigation'
import { getAccommodationEntries } from '@/lib/trip-stops'
import DayTabs from '@/components/trip/DayTabs'
import StopCard from '@/components/trip/StopCard'
import AddStopSheet from '@/components/trip/AddStopSheet'
import DeletedStopsSheet, { type DeletedEntry } from '@/components/trip/DeletedStopsSheet'
import TripRouteCard from '@/components/trip/TripRouteCard'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Sub-components ─────────────────────────────────────────────────────────────

const CONTACT_TYPES: EmergencyContact['type'][] = ['a_and_e', 'walk_in', 'vet', 'hospital', 'pharmacy', 'police', 'breakdown', 'other']
const CONTACT_ICON: Record<EmergencyContact['type'], string> = {
  a_and_e: '🏥', walk_in: '🚶', vet: '🐾', hospital: '🏥', pharmacy: '💊', police: '🚨', breakdown: '🔧', other: '📞',
}
const CONTACT_LABEL: Record<EmergencyContact['type'], string> = {
  a_and_e: 'A&E', walk_in: 'Walk-in', vet: 'Vet', hospital: 'Hospital', pharmacy: 'Pharmacy', police: 'Police', breakdown: 'Breakdown', other: 'Other',
}

function OverviewSection({
  days,
  emergencyContacts,
  isOwner,
  onSelectDay,
  onUpdateContacts,
  onGenerate,
  generatingContacts,
}: {
  days: Day[]
  emergencyContacts?: EmergencyContact[]
  isOwner: boolean
  onSelectDay: (i: number) => void
  onUpdateContacts: (contacts: EmergencyContact[]) => void
  onGenerate?: () => void
  generatingContacts?: boolean
}) {
  const contacts = emergencyContacts || []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<{ name: string; type: EmergencyContact['type']; phone: string; location: string; notes: string }>({
    name: '', type: 'a_and_e', phone: '', location: '', notes: '',
  })

  function commitAdd() {
    if (!draft.name.trim()) return
    const c: EmergencyContact = { name: draft.name.trim(), type: draft.type, phone: draft.phone.trim() || undefined, location: draft.location.trim() || undefined, notes: draft.notes.trim() || undefined }
    onUpdateContacts([...contacts, c])
    setDraft({ name: '', type: 'a_and_e', phone: '', location: '', notes: '' })
    setAdding(false)
  }

  function removeContact(idx: number) {
    onUpdateContacts(contacts.filter((_, i) => i !== idx))
  }

  return (
    <div className="px-4 pt-4 pb-32" style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Emergency & useful contacts ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft">Emergency &amp; Useful Contacts</p>
          {isOwner && !adding && (
            <div className="flex items-center gap-2">
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  disabled={generatingContacts}
                  className="text-[12px] font-semibold active:opacity-70 disabled:opacity-40"
                  style={{ color: '#c9963a' }}
                >
                  {generatingContacts ? '✨ …' : '✨ Generate'}
                </button>
              )}
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-[12px] font-semibold text-sky active:opacity-70"
              >
                <span className="text-[18px] leading-none font-bold">+</span> Add
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-card overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.08)', border: '1px solid rgba(220,38,38,0.12)' }}>
          {contacts.length === 0 && !adding && (
            <div className="px-4 py-5 text-center">
              <p className="text-[13px] text-soft">No emergency contacts yet</p>
              {isOwner && !generatingContacts && (
                <p className="text-[12px] text-soft mt-1">Tap <strong className="text-ink">✨ Generate</strong> to auto-fill from Claude, or <strong className="text-ink">+ Add</strong> manually</p>
              )}
              {isOwner && generatingContacts && (
                <p className="text-[12px] text-soft mt-1 animate-pulse">✨ Claude is finding contacts for your overnight stops…</p>
              )}
            </div>
          )}

          {(() => {
            // Group by location; contacts with no location go under 'General'
            const groups: Record<string, { contact: EmergencyContact; idx: number }[]> = {}
            contacts.forEach((c, idx) => {
              const key = c.location || 'General'
              if (!groups[key]) groups[key] = []
              groups[key].push({ contact: c, idx })
            })
            const locationKeys = Object.keys(groups)
            return locationKeys.map((loc, gi) => (
              <div key={loc}>
                {locationKeys.length > 1 && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-red-100">
                    <p className="text-[11px] font-bold tracking-[1px] uppercase text-soft">📍 {loc}</p>
                  </div>
                )}
                {groups[loc].map(({ contact: c, idx: i }, li) => {
                  const icon = CONTACT_ICON[c.type] || '📞'
                  const label = CONTACT_LABEL[c.type] || c.type
                  const href = c.phone
                    ? `tel:${c.phone.replace(/\s/g, '')}`
                    : c.address
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`
                      : undefined
                  const isLast = gi === locationKeys.length - 1 && li === groups[loc].length - 1
                  const inner = (
                    <>
                      <span className="text-[22px] w-8 text-center flex-shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[14px] text-ink leading-snug">{c.name}</p>
                        <p className="text-[12px] text-soft">{label}</p>
                        {c.phone && <p className="text-[13px] text-sky">{c.phone}</p>}
                        {!c.phone && c.address && <p className="text-[12px] text-soft truncate">{c.address}</p>}
                        {c.notes && <p className="text-[11px] text-soft italic mt-0.5">{c.notes}</p>}
                      </div>
                      {c.phone && <span className="text-[12px] font-semibold text-sky flex-shrink-0 mr-1">Call</span>}
                      {!c.phone && c.address && <span className="text-[12px] font-semibold text-sky flex-shrink-0 mr-1">Map →</span>}
                      {isOwner && (
                        <button
                          onClick={e => { e.preventDefault(); removeContact(i) }}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-[14px] active:bg-red-100 flex-shrink-0"
                          style={{ color: '#ef4444' }}
                        >×</button>
                      )}
                    </>
                  )
                  const cls = `flex items-center gap-3 px-4 py-3.5 no-underline w-full ${!isLast || adding ? 'border-b border-red-100' : ''}`
                  return href ? (
                    <a key={i} href={href} className={cls} style={{ background: 'white' }}>{inner}</a>
                  ) : (
                    <div key={i} className={cls}>{inner}</div>
                  )
                })}
              </div>
            ))
          })()}

          {/* Add form */}
          {adding && (
            <div className="px-4 py-4 space-y-3 bg-red-50">
              <div className="flex gap-2">
                <select
                  value={draft.type}
                  onChange={e => setDraft(d => ({ ...d, type: e.target.value as EmergencyContact['type'] }))}
                  className="input-field bg-white text-[14px] flex-shrink-0"
                  style={{ width: 120 }}
                >
                  {CONTACT_TYPES.map(t => (
                    <option key={t} value={t}>{CONTACT_ICON[t]} {CONTACT_LABEL[t]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Name / place"
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="input-field bg-white text-[14px] flex-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={draft.phone}
                  onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                  className="input-field bg-white text-[14px] flex-1"
                />
                <input
                  type="text"
                  placeholder="Town / area"
                  value={draft.location}
                  onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                  className="input-field bg-white text-[14px] flex-1"
                />
              </div>
              <input
                type="text"
                placeholder="Notes e.g. 24hr, open weekends (optional)"
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                className="input-field bg-white text-[14px]"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={commitAdd} disabled={!draft.name.trim()} className="btn-primary flex-1 disabled:opacity-40">Save</button>
                <button onClick={() => setAdding(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-3">Your Itinerary</p>
      <div className="space-y-2">
        {days.map((day, i) => {
          const driveKm   = day.stops.filter(s => s.type === 'drive').reduce((a, s) => a + (s.distance_km || 0), 0)
          const stopCount = day.stops.filter(s => s.type !== 'drive').length
          const isHighlight = day.highlight === true

          const meta: string[] = []
          if (driveKm > 0)  meta.push(`~${Math.round(driveKm)} km`)
          if (stopCount > 1) meta.push(`${stopCount} stops`)
          if (meta.length === 0 && day.overnight_location) meta.push(`🌙 ${day.overnight_location}`)

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
                {day.overnight_location && stopCount > 0 && (
                  <p className="text-[12px] text-soft truncate">🌙 {day.overnight_location}</p>
                )}
                {meta.length > 0 && (
                  <p className="text-[12px] text-soft">{meta.join(' · ')}</p>
                )}
              </div>
              <span className="flex-shrink-0 text-[18px]" style={{ color: '#d1d9e6' }}>›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AccommodationSection({ days, onSelectDay }: { days: Day[]; onSelectDay: (i: number) => void }) {
  const entries = getAccommodationEntries({ days })

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-12 text-center text-soft">
        <p className="text-3xl mb-3">🛏️</p>
        <p>No accommodation stops found</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-32" style={{ maxWidth: 560, margin: '0 auto' }}>
      <p className="text-[11px] font-bold tracking-[2px] uppercase text-soft mb-3">
        {entries.length} {entries.length === 1 ? 'stay' : 'stays'}
      </p>
      <div className="space-y-3">
        {entries.map(({ day, dayIdx, stop }, i) => {
          const dateStr = day.date
            ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            : null

          return (
            <button
              key={i}
              onClick={() => onSelectDay(dayIdx)}
              className="w-full text-left bg-white rounded-card overflow-hidden"
              style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}
            >
              {/* Header bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                <div
                  className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg"
                  style={{ width: 44, height: 44, minWidth: 44, background: '#2d6a4f' }}
                >
                  <span className="text-white text-[18px] leading-none">🛏️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-ink leading-snug truncate">{stop.name}</p>
                  {(dateStr || day.overnight_location) && (
                    <p className="text-[12px] text-soft truncate">
                      {[dateStr, day.overnight_location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-blue-600 flex-shrink-0">Day {day.day_number} ›</span>
              </div>

              {/* Details */}
              <div className="px-4 py-3 space-y-1.5">
                {stop.check_in && stop.check_out && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-soft w-20 flex-shrink-0">Check-in</span>
                    <span className="font-semibold text-ink">{stop.check_in}</span>
                    <span className="text-soft mx-1">→</span>
                    <span className="text-soft w-20 flex-shrink-0">Check-out</span>
                    <span className="font-semibold text-ink">{stop.check_out}</span>
                  </div>
                )}
                {stop.address && (
                  <div className="flex items-start gap-2 text-[13px]">
                    <span className="text-soft flex-shrink-0 w-20">Address</span>
                    <span className="text-ink leading-snug">{stop.address}</span>
                  </div>
                )}
                {stop.booking_ref && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-soft flex-shrink-0 w-20">Ref</span>
                    <span className="font-mono font-semibold text-ink tracking-wide">{stop.booking_ref}</span>
                  </div>
                )}
                {stop.phone && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-soft flex-shrink-0 w-20">Phone</span>
                    <a href={`tel:${stop.phone}`} className="text-blue-600 font-semibold" onClick={e => e.stopPropagation()}>
                      {stop.phone}
                    </a>
                  </div>
                )}
                {(stop.pay_at_hotel || stop.cancellation_policy) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stop.pay_at_hotel && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef9ec', color: '#92400e', border: '1px solid #f6d860' }}>
                        💳 Pay at hotel
                      </span>
                    )}
                    {stop.cancellation_policy && (() => {
                      const p = stop.cancellation_policy.toLowerCase()
                      const isFree = p.includes('free') || (p.includes('cancel') && !p.includes('non'))
                      const isNonRefund = p.includes('non-refund') || p.includes('no refund')
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={
                          isFree ? { background: '#d8f3dc', color: '#1a4731', border: '1px solid #b7e4c7' } :
                          isNonRefund ? { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' } :
                          { background: '#e8edf5', color: '#334155', border: '1px solid #d1d9e6' }
                        }>
                          {isFree ? '🔓' : isNonRefund ? '🔒' : '📋'} {stop.cancellation_policy}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Action links */}
              {(stop.website || stop.address) && (
                <div className="px-4 pb-3 flex gap-2">
                  {stop.website && (
                    <a
                      href={stop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-center py-2 rounded-xl text-[13px] font-semibold"
                      style={{ background: '#dbeafe', color: '#2563a8' }}
                    >
                      {stop.website_label || 'Website'}
                    </a>
                  )}
                  {stop.address && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-center py-2 rounded-xl text-[13px] font-semibold"
                      style={{ background: '#dcfce7', color: '#2d6a4f' }}
                    >
                      Directions
                    </a>
                  )}
                </div>
              )}
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

// ── Sortable stop card ────────────────────────────────────────────────────────

function SortableStopCard({
  sortId, isOwner, stop, index, isFirst, isLast, tripId, onDelete, onUpdate,
}: {
  sortId: string
  isOwner: boolean
  stop: Stop
  index: number
  isFirst: boolean
  isLast: boolean
  tripId: string
  onDelete: () => void
  onUpdate: (patch: Partial<Stop>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' as const } : {}),
      }}
    >
      <StopCard
        stop={stop}
        index={index}
        isFirst={isFirst}
        isLast={isLast}
        isOwner={isOwner}
        tripId={tripId}
        onDelete={onDelete}
        onUpdate={onUpdate}
        dragHandleListeners={isOwner ? listeners as unknown as Record<string, unknown> : undefined}
        dragHandleAttributes={isOwner ? attributes as unknown as Record<string, unknown> : undefined}
      />
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
  const router       = useRouter()
  const searchParams = useSearchParams()

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
  const [deleting,     setDeleting]     = useState(false)
  const [addSheetOpen,     setAddSheetOpen]     = useState(false)
  const [showDeletedSheet, setShowDeletedSheet] = useState(false)
  const [showRouteCard,    setShowRouteCard]    = useState(false)
  const [showShareSheet,   setShowShareSheet]   = useState(false)
  const [shareLink,        setShareLink]        = useState('')
  const [copyDone,           setCopyDone]           = useState(false)
  const [deletedHistory,     setDeletedHistory]     = useState<DeletedEntry[]>([])
  const [lastDeleted,        setLastDeleted]         = useState<{ stop: Stop; dayIdx: number; stopIdx: number } | null>(null)
  const [generatingContacts, setGeneratingContacts] = useState(false)
  const [editingOvernight,   setEditingOvernight]   = useState(false)
  const [overnightDraft,     setOvernightDraft]     = useState('')
  const [editingStart,       setEditingStart]       = useState(false)
  const [startDraft,         setStartDraft]         = useState('')
  const [textZoom, setTextZoom] = useState<1 | 1.15 | 1.3>(() => {
    if (typeof window === 'undefined') return 1
    const s = localStorage.getItem('trip-text-zoom')
    return (s === '1.15' ? 1.15 : s === '1.3' ? 1.3 : 1) as 1 | 1.15 | 1.3
  })
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef   = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  async function loadTrip() {
    const res = await fetch(`/api/trips/${id}`)
    if (!res.ok) {
      setLoading(false)
      if (res.status === 404 || res.status === 403) router.push('/trips')
      return null
    }
    const data = await res.json()
    setTrip(data.trip)
    setTripData(data.tripData)
    setLoading(false)

    // Auto-navigate to today's day if the trip is active
    const today = new Date().toISOString().split('T')[0]
    const todayIdx = (data.tripData?.days || []).findIndex((d: Day) => d.date === today)
    if (todayIdx >= 0) setActiveDay(todayIdx)
    // else stays at -1 (overview)

    // /api/me only works when logged in — guests viewing a shared trip will get 401, that's fine
    const meRes = await fetch('/api/me')
    const fromAbout = searchParams.get('from_about') === '1'
    if (meRes.ok) {
      const me = await meRes.json()
      const owner = me.id === data.trip.owner_id
      setIsOwner(owner)
      if (!owner && !fromAbout) {
        router.replace(`/about?next=${encodeURIComponent(`/trips/${id}`)}`)
        return null
      }
      if (me.profile) setProfile(me.profile)
    } else {
      // Guest (not logged in) viewing a shared trip
      if (!fromAbout) {
        router.replace(`/about?next=${encodeURIComponent(`/trips/${id}`)}`)
        return null
      }
    }
    return data.trip
  }

  async function startGeneration() {
    setGenerating(true); setGenerateLog('Starting…'); setError('')
    let res: Response
    try {
      res = await fetch(`/api/trips/${id}/generate`, { method: 'POST' })
    } catch {
      setError('Connection failed — please check your internet and retry')
      setGenerating(false)
      return
    }
    if (!res.ok || !res.body) {
      const isTimeout = res.status === 504 || res.status === 524
      setError(isTimeout
        ? 'Generation timed out — the trip took too long to plan. Try a shorter trip or retry.'
        : 'Failed to start generation')
      setGenerating(false)
      return
    }
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    let receivedDone = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { receivedDone = true; setGenerating(false); loadTrip(); return }
        try {
          const evt = JSON.parse(payload)
          if (evt.type === 'progress') setGenerateLog(evt.message)
          if (evt.type === 'error')    { setError(evt.message); setGenerating(false); return }
        } catch { /* partial chunk */ }
      }
    }
    if (!receivedDone) {
      setError('Generation timed out — the server took too long. Try reducing the trip duration or retry.')
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error' }),
      }).catch(() => { /* non-fatal */ })
    }
    setGenerating(false)
    loadTrip()
  }

  async function handleDeleteTrip() {
    setDeleting(true)
    await fetch(`/api/trips/${id}`, { method: 'DELETE' }).catch(() => {})
    router.push('/trips')
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

  const handleUpdateStop = useCallback(async (dayIndex: number, stopIndex: number, patch: Partial<Stop>) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : {
          ...day,
          stops: day.stops.map((s, si) => si !== stopIndex ? s : { ...s, ...patch }),
        }
      ),
    }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, saveData])

  const handleUpdateContacts = useCallback(async (contacts: EmergencyContact[]) => {
    if (!tripData) return
    const updated: TripData = { ...tripData, emergency_contacts: contacts }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, saveData])

  const handleUpdateDayField = useCallback(async (dayIndex: number, patch: Partial<Day>) => {
    if (!tripData) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) => di !== dayIndex ? day : { ...day, ...patch }),
    }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, saveData])

  const handleReorderStops = useCallback(async (dayIndex: number, oldIndex: number, newIndex: number) => {
    if (!tripData || oldIndex === newIndex) return
    const updated: TripData = {
      ...tripData,
      days: tripData.days.map((day, di) =>
        di !== dayIndex ? day : { ...day, stops: arrayMove(day.stops, oldIndex, newIndex) }
      ),
    }
    setTripData(updated)
    await saveData(updated)
  }, [tripData, saveData])

  async function handleGenerateContacts() {
    setGeneratingContacts(true)
    try {
      const res = await fetch(`/api/trips/${id}/generate-contacts`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTripData(t => t ? { ...t, emergency_contacts: data.contacts } : t)
      }
    } finally {
      setGeneratingContacts(false)
    }
  }

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

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/trips/${id}`
    setShareLink(url)
    setShowShareSheet(true)
    // Enable sharing on the trip if not already
    if (trip && !trip.is_shared) {
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: true }),
      })
      setTrip(t => t ? { ...t, is_shared: true } : t)
    }
  }, [id, trip])

  useEffect(() => {
    loadTrip().then(t => {
      if ((t?.status === 'draft' || t?.status === 'generating') && !startedRef.current) {
        startedRef.current = true
        startGeneration()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trip-deleted-${id}`)
      if (raw) setDeletedHistory(JSON.parse(raw) as DeletedEntry[])
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => { setEditingOvernight(false); setEditingStart(false) }, [activeDay])

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-mist flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-5 animate-pulse">🗺️</div>
        <p className="text-soft text-base tracking-wide">Loading trip…</p>
      </div>
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
        {!generating && !error && (
          <button
            onClick={() => { startedRef.current = false; startGeneration() }}
            className="mt-6 text-sm font-semibold text-white/70 underline underline-offset-2 active:text-white"
          >Stuck? Tap to retry</button>
        )}
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
          <p className="text-soft text-sm mb-2">{error || 'Something went wrong. Please try again.'}</p>
          {error && <p className="text-[11px] text-soft mb-5">Check your Claude API key in Settings, then retry.</p>}
          <div className="flex flex-col gap-3">
            <button onClick={() => { startedRef.current = false; startGeneration() }} className="btn-primary">Retry</button>
            <button
              onClick={handleDeleteTrip}
              disabled={deleting}
              className="text-sm font-medium disabled:opacity-50"
              style={{ color: '#dc2626' }}
            >{deleting ? 'Deleting…' : 'Delete trip'}</button>
          </div>
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
          <Link href={isOwner ? "/trips" : "/about"} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
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
          {tripData?.emergency_contacts && tripData.emergency_contacts.length > 0 && (
            <span className="hero-chip">🆘 {tripData.emergency_contacts.length} emergency contact{tripData.emergency_contacts.length !== 1 ? 's' : ''}</span>
          )}
          {trip.intake_form?.num_travellers && <span className="hero-chip">👥 {trip.intake_form.num_travellers} {trip.intake_form.num_travellers === 1 ? 'traveller' : 'travellers'}</span>}
          {profile?.vehicle_name     && <span className="hero-chip">🚗 {profile.vehicle_name}</span>}
          {trip.intake_form?.pets    && <span className="hero-chip">🐾 {trip.intake_form.pets}</span>}
          {saving && <span className="hero-chip opacity-60 text-[11px]">Saving…</span>}
          {days.length > 0 && (
            <button onClick={() => setShowRouteCard(true)} className="hero-chip active:bg-white/20 cursor-pointer">📤 Route card</button>
          )}
          {isOwner && (
            <button onClick={handleShare} className="hero-chip active:bg-white/20 cursor-pointer">🔗 Share trip</button>
          )}
          <button
            onClick={() => setTextZoom(z => {
              const next = z === 1 ? 1.15 : z === 1.15 ? 1.3 : 1
              localStorage.setItem('trip-text-zoom', String(next))
              return next
            })}
            className="hero-chip active:bg-white/20 cursor-pointer font-bold"
            title="Change text size"
          >{textZoom === 1 ? 'Aa' : textZoom === 1.15 ? 'A+' : 'A++'}</button>
          {!isOwner && (
            <Link href="/about" className="hero-chip active:bg-white/20 cursor-pointer">ℹ️ About this app</Link>
          )}
        </div>
      </div>

      {/* ── Content (zoomed per text-size preference) ────────────────────────── */}
      <div style={textZoom !== 1 ? { zoom: textZoom } : undefined}>

      {/* ── Sticky day tabs ──────────────────────────────────────────────────── */}
      {days.length > 0 && (
        <div className="bg-white border-b border-line sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <DayTabs days={days} activeIndex={activeDay} onSelect={setActiveDay} />
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {activeDay === -1 && days.length > 0 && (
        <OverviewSection
          days={days}
          emergencyContacts={tripData?.emergency_contacts}
          isOwner={isOwner}
          onSelectDay={setActiveDay}
          onUpdateContacts={handleUpdateContacts}
          onGenerate={isOwner ? handleGenerateContacts : undefined}
          generatingContacts={generatingContacts}
        />
      )}
      {activeDay === -1 && days.length === 0 && (
        <div className="px-4 pt-12 text-center text-soft"><p>No days planned yet</p></div>
      )}

      {/* ── Accommodation ────────────────────────────────────────────────────── */}
      {activeDay === -2 && (
        <AccommodationSection days={days} onSelectDay={setActiveDay} />
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
              {/* Starting from — editable for Day 2+; edits previous day's overnight_location */}
              {activeDay > 0 && startLocation && (
                isOwner && editingStart ? (
                  <div className="flex items-center gap-2 w-full mb-1">
                    <span className="text-[#bfdbfe] flex-shrink-0">📍</span>
                    <input
                      type="text"
                      value={startDraft}
                      onChange={e => setStartDraft(e.target.value)}
                      onBlur={() => {
                        const trimmed = startDraft.trim()
                        if (trimmed) handleUpdateDayField(activeDay - 1, { overnight_location: trimmed })
                        setEditingStart(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { if (startDraft.trim()) handleUpdateDayField(activeDay - 1, { overnight_location: startDraft.trim() }); setEditingStart(false) }
                        if (e.key === 'Escape') setEditingStart(false)
                      }}
                      autoFocus
                      className="text-[13px] font-semibold rounded-lg px-2 py-0.5 outline-none"
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', width: 180 }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { if (!isOwner) return; setStartDraft(startLocation); setEditingStart(true) }}
                    className={`flex items-center gap-1.5 text-[13px] text-[#bfdbfe] w-full mb-1 ${isOwner ? 'active:opacity-70' : ''}`}
                  >
                    📍 <span className="text-white/60 text-[11px] mr-1">Starting from</span>
                    <span className="text-white font-semibold">{startLocation}</span>
                    {isOwner && <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>✏</span>}
                  </button>
                )
              )}
              {currentDay.overnight_location !== undefined && (
                isOwner && editingOvernight ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#bfdbfe] flex-shrink-0">🌙</span>
                    <input
                      type="text"
                      value={overnightDraft}
                      onChange={e => setOvernightDraft(e.target.value)}
                      onBlur={() => {
                        const trimmed = overnightDraft.trim()
                        if (trimmed !== currentDay.overnight_location) handleUpdateDayField(activeDay, { overnight_location: trimmed })
                        setEditingOvernight(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { handleUpdateDayField(activeDay, { overnight_location: overnightDraft.trim() }); setEditingOvernight(false) }
                        if (e.key === 'Escape') setEditingOvernight(false)
                      }}
                      autoFocus
                      className="text-[13px] font-semibold rounded-lg px-2 py-0.5 outline-none"
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', width: 180 }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { if (!isOwner) return; setOvernightDraft(currentDay.overnight_location || ''); setEditingOvernight(true) }}
                    className={`flex items-center gap-1.5 text-[13px] text-[#bfdbfe] ${isOwner ? 'active:opacity-70' : ''}`}
                  >
                    🌙 <span className="text-white font-semibold">{currentDay.overnight_location}</span>
                    {isOwner && <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>✏</span>}
                  </button>
                )
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

          {/* Weather button */}
          {currentDay.overnight_location && (() => {
            const weatherTown = currentDay.overnight_location.split(',')[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, '').trim()
            return (
            <a
              href={`https://www.google.com/search?q=weather+${encodeURIComponent(weatherTown)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-card py-3 px-5 mb-3.5 no-underline text-[13px] font-semibold"
              style={{ background: '#dbeafe', color: '#2563a8', border: '1px solid rgba(37,99,168,0.2)' }}
            >
              <span>🌤</span>
              <span>Weather forecast for {weatherTown}</span>
            </a>
            )
          })()}

          {/* Map tip banner */}
          {nonDriveCount > 1 && (
            <div className="map-tip text-soft">
              💡 Missed or skipping a stop? Tap <strong className="text-ink">📍 Navigate</strong> on any stop below — no need to restart the full route.
            </div>
          )}

          {/* Stops */}
          {isOwner && currentDay.stops.length === 0 && (
            <div className="bg-white rounded-card mb-3.5 flex flex-col items-center gap-3 py-8 px-4 text-center" style={{ boxShadow: '0 2px 16px rgba(26,26,46,0.10)' }}>
              <p className="text-[13px] text-soft">No stops on this day yet</p>
              <button
                onClick={() => setAddSheetOpen(true)}
                className="btn-primary"
                style={{ width: 'auto', paddingLeft: 28, paddingRight: 28 }}
              >+ Add a stop</button>
            </div>
          )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event
                  if (!over || active.id === over.id) return
                  handleReorderStops(activeDay, Number(active.id), Number(over.id))
                }}
              >
                <SortableContext
                  items={currentDay.stops.map((_, i) => String(i))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="pt-1 pb-1">
                    {currentDay.stops.map((stop, i) => (
                      <SortableStopCard
                        key={`${activeDay}-${i}-${stop.name}`}
                        sortId={String(i)}
                        stop={stop}
                        index={i}
                        isFirst={i === 0}
                        isLast={i === currentDay.stops.length - 1}
                        isOwner={isOwner}
                        tripId={id}
                        onDelete={() => handleDeleteStop(activeDay, i)}
                        onUpdate={(patch) => handleUpdateStop(activeDay, i, patch)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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

          {/* Day emergency contacts — filtered to this overnight location */}
          {(() => {
            const loc = currentDay.overnight_location || ''
            const allContacts = tripData?.emergency_contacts || []
            const dayContacts = allContacts.filter(c =>
              !c.location || c.location.toLowerCase() === loc.toLowerCase()
            )
            if (dayContacts.length === 0) return null
            return (
              <div className="rounded-card mb-3.5 overflow-hidden border border-red-200">
                <button
                  onClick={() => setSosOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-red-50 active:bg-red-100"
                >
                  <span className="text-[13px] font-semibold text-red-700">🆘 Emergency contacts{loc ? ` — ${loc}` : ''}</span>
                  <span className={`text-line text-[10px] transition-transform ${sosOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {sosOpen && (
                  <div>
                    {dayContacts.map((c, i) => {
                      const href = c.phone
                        ? `tel:${c.phone.replace(/\s/g, '')}`
                        : c.address
                          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`
                          : undefined
                      const icon = CONTACT_ICON[c.type] || '📞'
                      const label = CONTACT_LABEL[c.type] || c.type
                      const inner = (
                        <>
                          <span className="text-[20px] w-7 text-center flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[14px] text-ink">{c.name}</p>
                            <p className="text-[12px] text-soft">{label}</p>
                            {c.phone && <p className="text-[13px] text-sky">{c.phone}</p>}
                            {!c.phone && c.address && <p className="text-[12px] text-soft truncate">{c.address}</p>}
                            {c.notes && <p className="text-[11px] text-soft italic">{c.notes}</p>}
                          </div>
                          {c.phone && <span className="text-[12px] font-semibold text-sky flex-shrink-0 mr-1">Call</span>}
                          {!c.phone && c.address && <span className="text-[12px] font-semibold text-sky flex-shrink-0 mr-1">Map →</span>}
                        </>
                      )
                      const baseCls = 'flex items-center gap-3 px-4 py-3 bg-white border-b border-red-100 last:border-none'
                      return href ? (
                        <a key={i} href={href} className={`${baseCls} no-underline active:bg-red-50`}>{inner}</a>
                      ) : (
                        <div key={i} className={baseCls}>{inner}</div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Prev / Next */}
          <div className="flex gap-3 pt-2">
            {activeDay > 0           && <button onClick={() => setActiveDay(activeDay-1)} className="btn-secondary flex-1">← Day {activeDay}</button>}
            {activeDay < days.length-1 && <button onClick={() => setActiveDay(activeDay+1)} className="btn-primary flex-1">Day {activeDay+2} →</button>}
          </div>
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

      </div>{/* end zoom wrapper */}

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

      {/* ── Route card sheet ─────────────────────────────────────────────────── */}
      {trip && tripData && (
        <TripRouteCard
          isOpen={showRouteCard}
          onClose={() => setShowRouteCard(false)}
          trip={trip}
          tripData={tripData}
        />
      )}

      {/* ── Share sheet ──────────────────────────────────────────────────────── */}
      {showShareSheet && shareLink && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowShareSheet(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10"
            style={{ maxHeight: '60vh' }}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-line" />
            </div>
            <h2 className="font-serif text-[20px] text-ink mb-1">Share trip</h2>
            <p className="text-[12px] text-soft mb-4">Anyone with this link can view the trip (read-only).</p>

            {/* Link pill */}
            <div className="flex items-center gap-2 bg-mist rounded-card px-4 py-3 mb-3">
              <p className="flex-1 text-[13px] text-ink truncate">{shareLink}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink).catch(() => {}); setCopyDone(true); setTimeout(() => setCopyDone(false), 2500) }}
                className="flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg active:opacity-70"
                style={{ background: copyDone ? '#d8f3dc' : '#dbeafe', color: copyDone ? '#2d6a4f' : '#2563a8' }}
              >{copyDone ? '✓ Copied' : 'Copy'}</button>
            </div>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent([`🗺️ ${trip!.title}`, tripData?.summary, `Open itinerary 👉 ${shareLink}`].filter(Boolean).join('\n\n'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full rounded-card py-3.5 mb-3 no-underline font-semibold text-[15px] text-white active:opacity-90"
              style={{ background: '#25D366' }}
            >
              <span className="text-[20px]">💬</span> Share on WhatsApp
            </a>

            <button
              onClick={() => setShowShareSheet(false)}
              className="w-full py-3 text-[13px] text-soft border border-line rounded-card active:bg-mist"
            >Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
