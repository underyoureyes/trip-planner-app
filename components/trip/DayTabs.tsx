'use client'
import { useRef, useEffect } from 'react'
import type { Day } from '@/lib/types'

interface Props {
  days: Day[]
  activeIndex: number
  onSelect: (index: number) => void
}

const TYPE_BADGE: Record<string, string> = {
  castle: '🏰', museum: '🏛️', sightseeing: '🏛️',
  distillery: '🥃', nature: '🌿', beach: '🏖️',
  viewpoint: '📸', activity: '🎯', town: '🏘️', fuel: '⛽',
}

function deriveBadges(day: Day): string[] {
  if (day.activity_badges?.length) return day.activity_badges.slice(0, 3)
  const seen: string[] = []
  for (const stop of day.stops) {
    const b = TYPE_BADGE[stop.type]
    if (b && !seen.includes(b)) seen.push(b)
    if (seen.length >= 3) break
  }
  return seen
}

export default function DayTabs({ days, activeIndex, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIndex])

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-3 py-2.5"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {days.map((day, i) => {
        const isActive = i === activeIndex
        const badges = deriveBadges(day)
        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(i)}
            className="flex-shrink-0 rounded-[20px] text-[13px] font-semibold whitespace-nowrap transition-all flex flex-col items-center"
            style={isActive
              ? { background: '#2563a8', color: '#fff', padding: '6px 15px 5px', boxShadow: '0 2px 8px rgba(37,99,168,0.30)' }
              : { background: '#e8edf5', color: '#475569', padding: '6px 15px 5px' }
            }
          >
            <span>Day {day.day_number}</span>
            {badges.length > 0 && (
              <span className="text-[10px] leading-none mt-0.5 opacity-80">{badges.join('')}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
