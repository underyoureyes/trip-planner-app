import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import StopCard from '@/components/trip/StopCard'
import type { Stop } from '@/lib/types'

const sightseeing: Stop = {
  name: 'Edinburgh Castle',
  type: 'sightseeing',
  description: 'Historic fortress on volcanic rock',
  address: 'Castlehill, Edinburgh EH1 2NG',
  duration_mins: 120,
}

const driveStop: Stop = {
  name: 'Drive to Inverness',
  type: 'drive',
  drive_time_mins: 150,
  distance_km: 180,
}

const hotelStop: Stop = {
  name: 'The Balmoral',
  type: 'hotel',
  address: '1 Princes St, Edinburgh',
  check_in: '15:00',
  check_out: '11:00',
}

describe('StopCard', () => {
  it('renders stop name', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    expect(screen.getByText('Edinburgh Castle')).toBeInTheDocument()
  })

  it('shows drive time and distance for drive stop', () => {
    render(<StopCard stop={driveStop} index={0} />)
    expect(screen.getByText(/2h 30m/)).toBeInTheDocument()
    expect(screen.getByText(/180 km/)).toBeInTheDocument()
  })

  it('shows check-in and check-out for hotel', () => {
    render(<StopCard stop={hotelStop} index={0} />)
    expect(screen.getByText(/Check-in 15:00/)).toBeInTheDocument()
    expect(screen.getByText(/Out 11:00/)).toBeInTheDocument()
  })

  it('shows Optional badge for suggested stops', () => {
    render(<StopCard stop={{ ...sightseeing, suggested: true }} index={0} />)
    expect(screen.getByText(/Optional/)).toBeInTheDocument()
  })

  it('does not show Optional badge for non-suggested stops', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    expect(screen.queryByText(/Optional/)).not.toBeInTheDocument()
  })

  it('shows dog friendly badge for dog_friendly stops', () => {
    render(<StopCard stop={{ ...sightseeing, dog_friendly: true }} index={0} />)
    expect(screen.getByText(/Dog friendly/)).toBeInTheDocument()
  })

  it('does not show dog friendly badge when dog_friendly is false', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    expect(screen.queryByText(/Dog friendly/)).not.toBeInTheDocument()
  })

  it('shows duration for non-drive stops', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    expect(screen.getByText(/2h/)).toBeInTheDocument()
  })

  it('expands to show address when clicked', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    fireEvent.click(screen.getByText('Edinburgh Castle'))
    expect(screen.getByText(/Castlehill, Edinburgh EH1 2NG/)).toBeInTheDocument()
  })

  it('shows nav link for non-drive stops with address', () => {
    render(<StopCard stop={sightseeing} index={0} />)
    expect(screen.getByText('📍 Navigate')).toBeInTheDocument()
  })

  it('does not show nav link for drive stops', () => {
    render(<StopCard stop={driveStop} index={0} />)
    expect(screen.queryByText('📍 Navigate')).not.toBeInTheDocument()
  })

  it('shows website link when stop has website', () => {
    const stop: Stop = { ...sightseeing, website: 'https://www.edinburghcastle.scot' }
    render(<StopCard stop={stop} index={0} />)
    expect(screen.getByText('🌐 Website')).toBeInTheDocument()
  })

  it('shows phone link when stop has phone', () => {
    const stop: Stop = { ...sightseeing, phone: '0131 225 9846' }
    render(<StopCard stop={stop} index={0} />)
    expect(screen.getByText('📞 Call')).toBeInTheDocument()
  })

  it('shows booking ref when expanded', () => {
    const stop: Stop = { ...sightseeing, booking_ref: 'REF-12345' }
    render(<StopCard stop={stop} index={0} />)
    fireEvent.click(screen.getByText('Edinburgh Castle'))
    expect(screen.getByText(/REF-12345/)).toBeInTheDocument()
  })

  it('shows notes when expanded', () => {
    const stop: Stop = { ...sightseeing, notes: 'Book in advance' }
    render(<StopCard stop={stop} index={0} />)
    fireEvent.click(screen.getByText('Edinburgh Castle'))
    expect(screen.getByText('Book in advance')).toBeInTheDocument()
  })

  describe('delete button', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('shows delete button for owner on non-drive stop', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner />)
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    it('does not show delete button when not owner', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner={false} />)
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })

    it('opens delete panel after first click', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner />)
      fireEvent.click(screen.getByText('×'))
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onDelete after confirm click', () => {
      const onDelete = vi.fn()
      render(<StopCard stop={sightseeing} index={0} isOwner onDelete={onDelete} />)
      fireEvent.click(screen.getByText('×'))
      fireEvent.click(screen.getByText('Delete'))
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('delete panel stays open (no auto-close timeout)', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner />)
      fireEvent.click(screen.getByText('×'))
      act(() => { vi.advanceTimersByTime(3000) })
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })
})
