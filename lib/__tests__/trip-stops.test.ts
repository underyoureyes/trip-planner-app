import { describe, it, expect } from 'vitest'
import { getAccommodationEntries, buildRouteStops, getCountryHint } from '../trip-stops'
import type { Trip, TripData, Day, Stop } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTrip(origin = 'Glasgow, Scotland'): Trip {
  return {
    id: 'trip-1',
    owner_id: 'user-1',
    title: 'Scotland 2026',
    status: 'ready',
    is_shared: false,
    created_at: '2026-01-01T00:00:00Z',
    intake_form: {
      title: 'Scotland 2026',
      origin,
      destination: 'Scottish Highlands',
      start_date: '2026-06-14',
      end_date: '2026-06-21',
      num_travellers: 2,
      interests: [],
      accommodation_style: 'mid',
      budget_per_day_gbp: 150,
      driving_max_hours: 4,
    },
  }
}

function hotelStop(name: string, address?: string): Stop {
  return { name, type: 'hotel', address, check_in: '15:00', check_out: '10:00' }
}

function makeDay(n: number, hotel: Stop, overnight?: string): Day {
  return {
    day_number: n,
    date: `2026-06-${String(13 + n).padStart(2, '0')}`,
    overnight_location: overnight ?? hotel.name.split(',')[0],
    stops: [{ name: `Drive to ${hotel.name}`, type: 'drive', drive_time_mins: 90, distance_km: 80 }, hotel],
  }
}

function makeData(days: Day[]): TripData {
  return { days, total_days: days.length, days_count: days.length } as unknown as TripData
}

// ── Core invariant ─────────────────────────────────────────────────────────────

describe('route map and stays tab count invariant', () => {
  it('route map non-origin stops === accommodation entries for a simple trip', () => {
    const trip = makeTrip()
    const data = makeData([
      makeDay(1, hotelStop('Loch Lomond Lodge', 'Balloch, Loch Lomond')),
      makeDay(2, hotelStop('Glencoe Bunkhouse', 'Glencoe, Highlands')),
      makeDay(3, hotelStop('Portree Airbnb', 'Portree, Isle of Skye')),
      makeDay(4, hotelStop('Inverness Hotel', 'Inverness')),
    ])

    const routeStops = buildRouteStops(trip, data)
    const accomEntries = getAccommodationEntries(data)

    // Route map: origin + 4 hotel locations = 5 total
    expect(routeStops).toHaveLength(5)
    // Stays tab: 4 entries
    expect(accomEntries).toHaveLength(4)
    // Invariant: non-origin route stops === accommodation entries
    expect(routeStops.length - 1).toBe(accomEntries.length)
  })

  it('multi-night stay is collapsed to one entry in both', () => {
    const trip = makeTrip()
    const skye = hotelStop('Portree Airbnb', 'Portree, Isle of Skye')
    const data = makeData([
      makeDay(1, hotelStop('Inverness Hotel', 'Inverness')),
      makeDay(2, skye),
      makeDay(3, skye), // same address — second night on Skye
      makeDay(4, hotelStop('Edinburgh Flat', 'Edinburgh')),
    ])

    const routeStops = buildRouteStops(trip, data)
    const accomEntries = getAccommodationEntries(data)

    // Stays tab: Inverness, Portree (x1 collapsed), Edinburgh = 3
    expect(accomEntries).toHaveLength(3)
    // Route map: origin + 3 = 4
    expect(routeStops).toHaveLength(4)
    expect(routeStops.length - 1).toBe(accomEntries.length)
  })

  it('returning to a previous location is NOT deduplicated (round trip)', () => {
    const trip = makeTrip('Glasgow, Scotland')
    const data = makeData([
      makeDay(1, hotelStop('Inverness Hotel', 'Inverness')),
      makeDay(2, hotelStop('Glasgow Flat', 'Glasgow')), // returning home
    ])

    const routeStops = buildRouteStops(trip, data)
    const accomEntries = getAccommodationEntries(data)

    // Glasgow appears as origin AND as a return hotel — both should count separately
    expect(accomEntries).toHaveLength(2)
    expect(routeStops.length - 1).toBe(accomEntries.length)
  })

  it('day with no hotel stop is skipped in both', () => {
    const trip = makeTrip()
    const data = makeData([
      makeDay(1, hotelStop('Loch Lomond Lodge', 'Balloch')),
      // Day 2 has no hotel stop
      {
        day_number: 2,
        date: '2026-06-16',
        overnight_location: 'Glencoe',
        stops: [{ name: 'Glencoe Valley', type: 'nature' as const }],
      },
      makeDay(3, hotelStop('Fort William B&B', 'Fort William')),
    ])

    const routeStops = buildRouteStops(trip, data)
    const accomEntries = getAccommodationEntries(data)

    expect(accomEntries).toHaveLength(2) // only days 1 and 3
    expect(routeStops.length - 1).toBe(accomEntries.length)
  })

  it('empty trip produces zero entries and only origin in route', () => {
    const trip = makeTrip()
    const data = makeData([])

    expect(getAccommodationEntries(data)).toHaveLength(0)
    const routeStops = buildRouteStops(trip, data)
    expect(routeStops).toHaveLength(1) // just origin
    expect(routeStops[0].isFirst).toBe(true)
  })
})

// ── buildRouteStops ────────────────────────────────────────────────────────────

describe('buildRouteStops', () => {
  it('first stop is marked isFirst, last is marked isLast', () => {
    const trip = makeTrip()
    const data = makeData([
      makeDay(1, hotelStop('Hotel A', 'Town A')),
      makeDay(2, hotelStop('Hotel B', 'Town B')),
    ])
    const stops = buildRouteStops(trip, data)
    expect(stops[0].isFirst).toBe(true)
    expect(stops[0].isLast).toBe(false)
    expect(stops[stops.length - 1].isLast).toBe(true)
    expect(stops[stops.length - 1].isFirst).toBe(false)
  })

  it('prefers hotel address over hotel name over overnight_location', () => {
    const trip = makeTrip()
    const data = makeData([
      {
        day_number: 1,
        overnight_location: 'Portree',
        stops: [{ name: 'Cozy Skye Cottage', type: 'hotel' as const, address: 'Portree, Isle of Skye, IV51 9AB' }],
      },
    ])
    const stops = buildRouteStops(trip, data)
    // Should use address (most geocodable)
    expect(stops[1].name).toBe('Portree, Isle of Skye, IV51 9AB')
  })

  it('skips a day with no hotel stop (keeps count in sync with stays tab)', () => {
    const trip = makeTrip()
    const data = makeData([
      { day_number: 1, overnight_location: 'Inverness', stops: [] },
    ])
    const stops = buildRouteStops(trip, data)
    // No hotel stop → no route pin; only the origin remains
    expect(stops).toHaveLength(1)
    expect(getAccommodationEntries(data)).toHaveLength(0)
  })

  it('highlight flag is preserved from the day', () => {
    const trip = makeTrip()
    const data = makeData([
      { ...makeDay(1, hotelStop('Hotel A', 'Town A')), highlight: true },
      makeDay(2, hotelStop('Hotel B', 'Town B')),
    ])
    const stops = buildRouteStops(trip, data)
    expect(stops[1].highlight).toBe(true)
    expect(stops[2].highlight).toBe(false)
  })
})

// ── getCountryHint ─────────────────────────────────────────────────────────────

describe('getCountryHint', () => {
  it('extracts country from "City, Country" origin', () => {
    expect(getCountryHint(makeTrip('Glasgow, Scotland'))).toBe('Scotland')
  })

  it('extracts all parts after first comma', () => {
    expect(getCountryHint(makeTrip('London, England, UK'))).toBe('England, UK')
  })

  it('returns empty string when origin has no comma', () => {
    expect(getCountryHint(makeTrip('Glasgow'))).toBe('')
  })

  it('returns empty string when intake_form is missing', () => {
    const trip = makeTrip()
    trip.intake_form = undefined
    expect(getCountryHint(trip)).toBe('')
  })
})
