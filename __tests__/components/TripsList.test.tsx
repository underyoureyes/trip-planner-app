import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TripsList from '@/components/TripsList'
import type { Trip } from '@/lib/types'

// Mock next/link so it renders as a plain anchor in jsdom
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-1',
  owner_id: 'user-1',
  title: 'Highland Loop',
  status: 'ready',
  is_shared: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
})

// ── TripsList ──────────────────────────────────────────────────────────────────

describe('TripsList', () => {
  it('renders "No trips yet" when both lists are empty and user has API key', () => {
    render(<TripsList ownTrips={[]} sharedTrips={[]} hasApiKey />)
    expect(screen.getByText('No trips yet')).toBeInTheDocument()
    // The "No trips yet" message contains the text "Plan a new trip"
    expect(screen.getByText(/Tap/)).toBeInTheDocument()
  })

  it('renders message with settings link when no API key and no trips', () => {
    render(<TripsList ownTrips={[]} sharedTrips={[]} hasApiKey={false} />)
    expect(screen.getByText('No trips yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('shows "Plan a new trip" button when hasApiKey is true', () => {
    render(<TripsList ownTrips={[]} sharedTrips={[]} hasApiKey />)
    // There may be multiple matches (button text + description text), just confirm at least one exists
    expect(screen.getAllByText('Plan a new trip').length).toBeGreaterThan(0)
  })

  it('does not show "Plan a new trip" button when hasApiKey is false', () => {
    render(<TripsList ownTrips={[]} sharedTrips={[]} hasApiKey={false} />)
    expect(screen.queryByText('Plan a new trip')).not.toBeInTheDocument()
  })

  it('renders own trips', () => {
    const trips = [makeTrip({ title: 'Trip A' }), makeTrip({ id: 'trip-2', title: 'Trip B' })]
    render(<TripsList ownTrips={trips} sharedTrips={[]} hasApiKey />)
    expect(screen.getByText('Trip A')).toBeInTheDocument()
    expect(screen.getByText('Trip B')).toBeInTheDocument()
    expect(screen.getByText('Your trips')).toBeInTheDocument()
  })

  it('renders shared trips section', () => {
    const shared = [makeTrip({ id: 'shared-1', title: 'Shared Adventure', is_shared: true })]
    render(<TripsList ownTrips={[]} sharedTrips={shared} hasApiKey />)
    expect(screen.getByText('Shared Adventure')).toBeInTheDocument()
    expect(screen.getByText('Shared with you')).toBeInTheDocument()
  })

  it('shows status badges correctly', () => {
    const trips = [
      makeTrip({ id: 't1', title: 'Ready Trip', status: 'ready' }),
      makeTrip({ id: 't2', title: 'Generating Trip', status: 'generating' }),
      makeTrip({ id: 't3', title: 'Error Trip', status: 'error' }),
    ]
    render(<TripsList ownTrips={trips} sharedTrips={[]} hasApiKey />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Generating…')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows Shared badge on own trip that is_shared', () => {
    const trip = makeTrip({ is_shared: true })
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    // The trip card shows the Shared badge
    expect(screen.getByText('Shared')).toBeInTheDocument()
  })

  it('renders trip dates when present', () => {
    const trip = makeTrip({ start_date: '2026-07-01', end_date: '2026-07-07' })
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    // Date is formatted as e.g. "1 Jul 2026"
    expect(screen.getByText(/Jul 2026/)).toBeInTheDocument()
  })

  it('links each own trip to its page', () => {
    const trip = makeTrip({ id: 'trip-abc' })
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    const links = screen.getAllByRole('link').filter(l => l.getAttribute('href') === '/trips/trip-abc')
    expect(links.length).toBeGreaterThan(0)
  })

  it('links shared trips to their pages', () => {
    const shared = [makeTrip({ id: 'shared-xyz', title: 'Shared Trip', is_shared: true })]
    render(<TripsList ownTrips={[]} sharedTrips={shared} hasApiKey />)
    const link = screen.getByRole('link', { name: /Shared Trip/ })
    expect(link).toHaveAttribute('href', '/trips/shared-xyz')
  })
})

// ── TripCard (delete flow) ─────────────────────────────────────────────────────

describe('TripCard delete flow', () => {
  it('shows delete confirmation when delete icon is tapped', () => {
    const trip = makeTrip()
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    expect(screen.getByText(/Delete "Highland Loop"\?/)).toBeInTheDocument()
  })

  it('hides confirmation when Cancel is clicked', () => {
    const trip = makeTrip()
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/Delete "Highland Loop"\?/)).not.toBeInTheDocument()
  })

  it('calls DELETE /api/trips/:id and removes the trip on confirm', async () => {
    const trip = makeTrip({ id: 'trip-del' })
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/trips/trip-del', { method: 'DELETE' })
    })
    // Trip is removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Highland Loop')).not.toBeInTheDocument()
    })
  })

  it('shows "Deleting…" on confirm button while fetch is in progress', async () => {
    // Keep the fetch pending
    let resolveFetch!: () => void
    global.fetch = vi.fn().mockReturnValue(new Promise(res => { resolveFetch = () => res({ ok: true } as Response) }))
    const trip = makeTrip()
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Deleting…')).toBeInTheDocument()
    resolveFetch()
  })

  it('removes the trip even if fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const trip = makeTrip()
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(screen.queryByText('Highland Loop')).not.toBeInTheDocument()
    })
  })

  it('renders "No trips yet" state after deleting the last trip', async () => {
    const trip = makeTrip()
    render(<TripsList ownTrips={[trip]} sharedTrips={[]} hasApiKey />)
    fireEvent.click(screen.getByLabelText('Delete trip'))
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(screen.getByText('No trips yet')).toBeInTheDocument()
    })
  })
})
