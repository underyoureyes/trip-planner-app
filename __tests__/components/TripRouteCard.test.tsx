import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TripRouteCard from '@/components/trip/TripRouteCard'
import type { Trip, TripData } from '@/lib/types'

// Mock IntersectionObserver (not available in jsdom)
beforeEach(() => {
  vi.resetAllMocks()
  global.IntersectionObserver = class MockIntersectionObserver {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
    constructor() {}
  } as unknown as typeof IntersectionObserver
  global.fetch = vi.fn().mockResolvedValue({ ok: false })
})

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-1',
  owner_id: 'user-1',
  title: 'Highland Loop',
  status: 'ready',
  is_shared: false,
  created_at: '2026-01-01T00:00:00Z',
  intake_form: {
    title: 'Highland Loop',
    origin: 'Edinburgh',
    destination: 'Inverness',
    start_date: '2026-07-01',
    end_date: '2026-07-07',
    num_travellers: 2,
    interests: [],
    accommodation_style: 'mid',
    budget_per_day_gbp: 150,
    driving_max_hours: 4,
  },
  ...overrides,
})

const makeTripData = (overrides: Partial<TripData> = {}): TripData => ({
  days: [
    {
      day_number: 1,
      title: 'Edinburgh to Pitlochry',
      overnight_location: 'Pitlochry',
      stops: [
        { name: 'Edinburgh Castle', type: 'sightseeing', address: 'Castlehill, Edinburgh' },
        { name: 'The Pitlochry Hotel', type: 'hotel', address: 'Pitlochry, PH16 5BX' },
      ],
    },
    {
      day_number: 2,
      title: 'Pitlochry to Inverness',
      overnight_location: 'Inverness',
      stops: [
        { name: 'Drive to Inverness', type: 'drive', drive_time_mins: 120 },
        { name: 'Inverness Hotel', type: 'hotel', address: 'Inverness, IV1 1NJ' },
      ],
    },
  ],
  ...overrides,
})

describe('TripRouteCard', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <TripRouteCard
        isOpen={false}
        onClose={vi.fn()}
        trip={makeTrip()}
        tripData={makeTripData()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Route overview" heading when open', () => {
    render(
      <TripRouteCard
        isOpen
        onClose={vi.fn()}
        trip={makeTrip()}
        tripData={makeTripData()}
      />
    )
    expect(screen.getByText('Route overview')).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<TripRouteCard isOpen onClose={onClose} trip={makeTrip()} tripData={makeTripData()} />)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TripRouteCard isOpen onClose={onClose} trip={makeTrip()} tripData={makeTripData()} />
    )
    const backdrop = container.querySelector('.absolute.inset-0')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows overnight stops count in header', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    // header paragraph contains "overnight stops · N points of interest"
    const header = screen.getByText(/points of interest/)
    expect(header.textContent).toContain('overnight stops')
  })

  it('shows points of interest count in header', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    expect(screen.getByText(/points of interest/)).toBeInTheDocument()
  })

  it('shows Full trip Google Maps button when hotel stops exist', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    expect(screen.getByText(/Full trip · Google Maps/)).toBeInTheDocument()
  })

  it('shows "No stops yet" when there are no hotel stops and no origin', () => {
    const tripNoOrigin = makeTrip({ intake_form: { ...makeTrip().intake_form!, origin: '' } })
    const emptyData = makeTripData({
      days: [{ day_number: 1, title: 'Day 1', stops: [{ name: 'Drive', type: 'drive', drive_time_mins: 60 }] }],
    })
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={tripNoOrigin} tripData={emptyData} />
    )
    expect(screen.getByText('No stops yet')).toBeInTheDocument()
  })

  it('shows day number headers for each day', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText(/Day 2/)).toBeInTheDocument()
  })

  it('shows day titles', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    expect(screen.getByText('Edinburgh to Pitlochry')).toBeInTheDocument()
    expect(screen.getByText('Pitlochry to Inverness')).toBeInTheDocument()
  })

  it('shows stop names for navigable stops', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    expect(screen.getByText('Edinburgh Castle')).toBeInTheDocument()
  })

  it('shows "No stops this day" for days with only drive stops', () => {
    const data = makeTripData({
      days: [
        { day_number: 1, title: 'Drive Day', stops: [{ name: 'Long drive', type: 'drive', drive_time_mins: 300 }] },
      ],
    })
    render(<TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={data} />)
    expect(screen.getByText('No stops this day')).toBeInTheDocument()
  })

  it('shows "No itinerary yet" when days array is empty', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={{ days: [] }} />
    )
    expect(screen.getByText('No itinerary yet')).toBeInTheDocument()
  })

  it('shows Nav links for each navigable stop', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    const navLinks = screen.getAllByText('Nav →')
    expect(navLinks.length).toBeGreaterThan(0)
  })

  it('shows Day route button when start location is available', () => {
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={makeTrip()} tripData={makeTripData()} />
    )
    // Day 1 has origin (Edinburgh) + navStops → should have "Day route" link
    const dayRouteLinks = screen.getAllByText(/Day route/)
    expect(dayRouteLinks.length).toBeGreaterThan(0)
  })

  it('renders with trip without intake_form (no origin)', () => {
    const tripNoIntake = makeTrip({ intake_form: undefined })
    render(
      <TripRouteCard isOpen onClose={vi.fn()} trip={tripNoIntake} tripData={makeTripData()} />
    )
    expect(screen.getByText('Route overview')).toBeInTheDocument()
  })
})
