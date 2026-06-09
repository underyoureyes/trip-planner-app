import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows address without needing to click', () => {
    render(<StopCard stop={sightseeing} index={0} />)
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

  it('shows website link when stop has a website', () => {
    const stop: Stop = { ...sightseeing, website: 'https://www.edinburghcastle.scot' }
    render(<StopCard stop={stop} index={0} />)
    const link = screen.getByRole('link', { name: /Website/i })
    expect(link).toHaveAttribute('href', 'https://www.edinburghcastle.scot')
  })

  it('shows phone call link when stop has a phone number', () => {
    const stop: Stop = { ...sightseeing, phone: '0131 225 9846' }
    render(<StopCard stop={stop} index={0} />)
    const link = screen.getByRole('link', { name: /Call/i })
    expect(link).toHaveAttribute('href', 'tel:0131 225 9846')
  })

  it('shows booking ref', () => {
    const stop: Stop = { ...sightseeing, booking_ref: 'REF-12345' }
    render(<StopCard stop={stop} index={0} />)
    expect(screen.getByText(/REF-12345/)).toBeInTheDocument()
  })

  it('shows notes', () => {
    const stop: Stop = { ...sightseeing, notes: 'Book in advance' }
    render(<StopCard stop={stop} index={0} />)
    expect(screen.getByText('Book in advance')).toBeInTheDocument()
  })

  describe('delete button', () => {
    it('shows × button for owner when onDelete provided', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner onDelete={vi.fn()} />)
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    it('shows × button for owner on drive stop when onDelete provided', () => {
      render(<StopCard stop={driveStop} index={0} isOwner onDelete={vi.fn()} />)
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    it('does not show × button when not owner', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner={false} onDelete={vi.fn()} />)
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })

    it('does not show × button when onDelete not provided', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner />)
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })

    it('opens delete panel when × is clicked', () => {
      render(<StopCard stop={sightseeing} index={0} isOwner onDelete={vi.fn()} />)
      fireEvent.click(screen.getByText('×'))
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onDelete when Delete button in panel is clicked', () => {
      const onDelete = vi.fn()
      render(<StopCard stop={sightseeing} index={0} isOwner onDelete={onDelete} />)
      fireEvent.click(screen.getByText('×'))
      fireEvent.click(screen.getByText('Delete'))
      expect(onDelete).toHaveBeenCalledOnce()
    })
  })

  describe('hotel stop — booking ref visibility', () => {
    const hotel: Stop = {
      name: 'The Balmoral',
      type: 'hotel',
      address: '1 Princes St, Edinburgh',
      booking_ref: 'HOTEL-REF-999',
    }

    it('shows booking ref for owner on hotel stop', () => {
      render(<StopCard stop={hotel} index={0} isOwner />)
      expect(screen.getByText(/HOTEL-REF-999/)).toBeInTheDocument()
    })

    it('masks booking ref for non-owner on hotel stop', () => {
      render(<StopCard stop={hotel} index={0} isOwner={false} />)
      expect(screen.queryByText(/HOTEL-REF-999/)).not.toBeInTheDocument()
      expect(screen.getByText(/owner only/)).toBeInTheDocument()
    })
  })

  describe('hotel notes visibility', () => {
    const hotel: Stop = {
      name: 'Cozy Cottage',
      type: 'hotel',
      notes: 'Key code: 1234',
    }

    it('shows notes for owner on hotel stop', () => {
      render(<StopCard stop={hotel} index={0} isOwner />)
      expect(screen.getByText('Key code: 1234')).toBeInTheDocument()
    })

    it('hides notes for non-owner on hotel stop', () => {
      render(<StopCard stop={hotel} index={0} isOwner={false} />)
      expect(screen.queryByText('Key code: 1234')).not.toBeInTheDocument()
      expect(screen.getByText(/visible to trip owner only/)).toBeInTheDocument()
    })
  })

  describe('hotel cancellation policy', () => {
    it('shows pay_at_hotel badge', () => {
      const stop: Stop = { ...hotelStop, pay_at_hotel: true }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/Pay at hotel/)).toBeInTheDocument()
    })

    it('shows cancellation policy badge', () => {
      const stop: Stop = { ...hotelStop, cancellation_policy: 'Free cancellation until 14 Jun' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/Free cancellation until 14 Jun/)).toBeInTheDocument()
    })

    it('shows non-refundable policy with lock icon', () => {
      const stop: Stop = { ...hotelStop, cancellation_policy: 'Non-refundable' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/Non-refundable/)).toBeInTheDocument()
    })

    it('shows "Add booking policy" button for hotel owner with onUpdate', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={vi.fn()} />)
      expect(screen.getByText(/Add booking policy/)).toBeInTheDocument()
    })

    it('shows "Edit" instead of "Add" when policy already set', () => {
      const stop: Stop = { ...hotelStop, cancellation_policy: 'Free until 14 Jun' }
      render(<StopCard stop={stop} index={0} isOwner onUpdate={vi.fn()} />)
      expect(screen.getByText(/Edit booking policy/)).toBeInTheDocument()
    })

    it('opens policy editor when "Add booking policy" is clicked', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={vi.fn()} />)
      fireEvent.click(screen.getByText(/Add booking policy/))
      expect(screen.getByPlaceholderText(/Cancellation policy/)).toBeInTheDocument()
    })

    it('shows Save and Cancel buttons in policy editor', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={vi.fn()} />)
      fireEvent.click(screen.getByText(/Add booking policy/))
      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('closes policy editor when Cancel is clicked', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={vi.fn()} />)
      fireEvent.click(screen.getByText(/Add booking policy/))
      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByPlaceholderText(/Cancellation policy/)).not.toBeInTheDocument()
    })

    it('calls onUpdate when Save is clicked', () => {
      const onUpdate = vi.fn()
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={onUpdate} />)
      fireEvent.click(screen.getByText(/Add booking policy/))
      const input = screen.getByPlaceholderText(/Cancellation policy/)
      fireEvent.change(input, { target: { value: 'Free until 30 Jun' } })
      fireEvent.click(screen.getByText('Save'))
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ cancellation_policy: 'Free until 30 Jun' }),
      )
    })

    it('toggles Pay at hotel in editor', () => {
      const onUpdate = vi.fn()
      render(<StopCard stop={hotelStop} index={0} isOwner onUpdate={onUpdate} />)
      fireEvent.click(screen.getByText(/Add booking policy/))
      // Click the toggle button
      const toggleBtn = screen.getByRole('button', { name: '' })
      // find the toggle (the first button inside the editor that isn't Save/Cancel)
      const allButtons = screen.getAllByRole('button')
      // Toggle is the round button — find by its type=button inside the editor
      // Save & Cancel + the toggle; click the toggle
      const toggles = allButtons.filter(b => b.className.includes('rounded-full') && !b.className.includes('bg-mist'))
      if (toggles.length > 0) fireEvent.click(toggles[0])
      fireEvent.click(screen.getByText('Save'))
      expect(onUpdate).toHaveBeenCalled()
    })

    it('does not show policy editor for non-owners', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner={false} onUpdate={vi.fn()} />)
      expect(screen.queryByText(/booking policy/)).not.toBeInTheDocument()
    })

    it('does not show policy editor without onUpdate', () => {
      render(<StopCard stop={hotelStop} index={0} isOwner />)
      expect(screen.queryByText(/booking policy/)).not.toBeInTheDocument()
    })
  })

  describe('duration formatting', () => {
    it('shows minutes for stops under 60 mins', () => {
      const stop: Stop = { ...sightseeing, duration_mins: 45 }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/45m/)).toBeInTheDocument()
    })

    it('shows hours and minutes for stops over 60 mins', () => {
      const stop: Stop = { ...sightseeing, duration_mins: 90 }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/1h 30m/)).toBeInTheDocument()
    })
  })

  describe('drive time formatting', () => {
    it('shows distance alongside drive time', () => {
      const stop: Stop = { name: 'Drive', type: 'drive', drive_time_mins: 60, distance_km: 50 }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/50 km/)).toBeInTheDocument()
    })

    it('shows just hours and minutes when no distance set', () => {
      const stop: Stop = { name: 'Drive', type: 'drive', drive_time_mins: 90 }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/1h 30m/)).toBeInTheDocument()
    })
  })

  describe('website label', () => {
    it('uses custom website_label when provided', () => {
      const stop: Stop = { ...sightseeing, website: 'https://example.com', website_label: 'Book now' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/Book now/)).toBeInTheDocument()
    })

    it('falls back to "Website" when website_label is not set', () => {
      const stop: Stop = { ...sightseeing, website: 'https://example.com' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText(/🌐 Website/)).toBeInTheDocument()
    })
  })

  describe('stop icons', () => {
    it('shows correct icon for restaurant stop', () => {
      const stop: Stop = { name: 'Canteen', type: 'restaurant' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText('🍽️')).toBeInTheDocument()
    })

    it('shows correct icon for castle stop', () => {
      const stop: Stop = { name: 'Urquhart Castle', type: 'castle' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText('🏰')).toBeInTheDocument()
    })

    it('shows fallback icon for unknown stop type', () => {
      const stop: Stop = { name: 'Mystery', type: 'other' }
      render(<StopCard stop={stop} index={0} />)
      expect(screen.getByText('📍')).toBeInTheDocument()
    })
  })
})
