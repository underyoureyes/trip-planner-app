import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DayTabs from '@/components/trip/DayTabs'
import type { Day } from '@/lib/types'

const days: Day[] = [
  { day_number: 1, title: 'Edinburgh', stops: [] },
  { day_number: 2, title: 'Pitlochry', stops: [] },
  { day_number: 3, title: 'Inverness', stops: [] },
]

describe('DayTabs', () => {
  it('renders a button for each day', () => {
    render(<DayTabs days={days} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Day 2')).toBeInTheDocument()
    expect(screen.getByText('Day 3')).toBeInTheDocument()
  })

  it('calls onSelect with the correct index', () => {
    const onSelect = vi.fn()
    render(<DayTabs days={days} activeIndex={0} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Day 2').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByText('Day 3').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('applies active background to the selected tab', () => {
    render(<DayTabs days={days} activeIndex={1} onSelect={vi.fn()} />)
    const activeBtn = screen.getByText('Day 2').closest('button')!
    expect(activeBtn).toHaveStyle({ background: '#2563a8' })
  })

  it('applies inactive background to non-selected tabs', () => {
    render(<DayTabs days={days} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Day 2').closest('button')).toHaveStyle({ background: '#e8edf5' })
    expect(screen.getByText('Day 3').closest('button')).toHaveStyle({ background: '#e8edf5' })
  })

  it('renders empty list without crashing', () => {
    render(<DayTabs days={[]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows Claude-provided activity_badges on tab', () => {
    const daysWithBadges: Day[] = [{ day_number: 1, stops: [], activity_badges: ['🏰', '🌿'] }]
    render(<DayTabs days={daysWithBadges} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('🏰🌿')).toBeInTheDocument()
  })

  it('derives badges from stop types when activity_badges absent', () => {
    const daysWithStops: Day[] = [{
      day_number: 1, stops: [
        { name: 'A', type: 'castle' },
        { name: 'B', type: 'distillery' },
      ],
    }]
    render(<DayTabs days={daysWithStops} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('🏰🥃')).toBeInTheDocument()
  })

  it('shows no badges row when day has no interesting stops', () => {
    const plainDays: Day[] = [{ day_number: 1, stops: [{ name: 'Drive', type: 'drive' }] }]
    render(<DayTabs days={plainDays} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.queryByText(/🏰|🥃|🌿|📸|🎯/)).not.toBeInTheDocument()
  })
})
