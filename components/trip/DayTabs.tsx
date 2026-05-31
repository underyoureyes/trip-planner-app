'use client'
import { useRef, useEffect } from 'react'
import type { Day } from '@/lib/types'

interface Props {
  days: Day[]
  activeIndex: number
  onSelect: (index: number) => void
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
        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(i)}
            className="flex-shrink-0 rounded-[20px] text-[13px] font-semibold whitespace-nowrap transition-all"
            style={isActive
              ? { background: '#2563a8', color: '#fff', padding: '7px 15px', boxShadow: '0 2px 8px rgba(37,99,168,0.30)' }
              : { background: '#e8edf5', color: '#475569', padding: '7px 15px' }
            }
          >
            Day {day.day_number}
          </button>
        )
      })}
    </div>
  )
}
