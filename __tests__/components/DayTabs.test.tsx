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
    fireEvent.click(screen.getByText('Day 2'))
    expect(onSelect).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByText('Day 3'))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('applies active background to the selected tab', () => {
    render(<DayTabs days={days} activeIndex={1} onSelect={vi.fn()} />)
    const activeBtn = screen.getByText('Day 2')
    expect(activeBtn).toHaveStyle({ background: '#2563a8' })
  })

  it('applies inactive background to non-selected tabs', () => {
    render(<DayTabs days={days} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Day 2')).toHaveStyle({ background: '#e8edf5' })
    expect(screen.getByText('Day 3')).toHaveStyle({ background: '#e8edf5' })
  })

  it('renders empty list without crashing', () => {
    render(<DayTabs days={[]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
