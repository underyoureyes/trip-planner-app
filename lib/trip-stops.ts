import type { Trip, TripData, Day, Stop } from './types'

export interface AccommodationEntry {
  day: Day
  dayIdx: number
  stop: Stop
}

export interface RouteStop {
  name: string
  isFirst: boolean
  isLast: boolean
  highlight: boolean
  date?: string
}

/**
 * Returns one AccommodationEntry per unique consecutive accommodation location.
 * Consecutive nights at the same address/name are collapsed to a single entry
 * (multi-night stay). This is the canonical list used by both the Stays tab
 * and the route map so their counts always agree.
 */
export function getAccommodationEntries(tripData: TripData): AccommodationEntry[] {
  const entries: AccommodationEntry[] = []
  const days = tripData.days || []

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx]
    const hotel = day.stops.find(s => s.type === 'hotel')
    if (!hotel) continue

    // Skip if the same location as the immediately preceding entry (multi-night stay)
    const key = (hotel.address || hotel.name || '').toLowerCase()
    if (key && entries.length > 0) {
      const prev = entries[entries.length - 1]
      const prevKey = (prev.stop.address || prev.stop.name || '').toLowerCase()
      if (prevKey === key) continue
    }

    entries.push({ day, dayIdx, stop: hotel })
  }

  return entries
}

/**
 * Builds the ordered geocodable stop list for the route map.
 * = [origin] + one entry per unique consecutive accommodation location.
 * The non-origin count always equals getAccommodationEntries().length.
 */
export function buildRouteStops(trip: Trip, tripData: TripData): RouteStop[] {
  const days = tripData.days || []
  const stops: RouteStop[] = []

  const origin = trip.intake_form?.origin?.split(',')[0]?.trim()
  if (origin) {
    stops.push({ name: origin, isFirst: true, isLast: false, highlight: false })
  }

  for (const day of days) {
    const hotel = day.stops.find(s => s.type === 'hotel')
    // Only use hotel stops — keeps count identical to getAccommodationEntries
    const location = hotel?.address || hotel?.name
    if (!location) continue

    // Consecutive deduplication — same logic as getAccommodationEntries
    const prev = stops[stops.length - 1]
    if (prev && prev.name.toLowerCase() === location.toLowerCase()) continue

    stops.push({
      name: location,
      isFirst: false,
      isLast: false,
      highlight: day.highlight === true,
      date: day.date,
    })
  }

  if (stops.length > 1) stops[stops.length - 1].isLast = true

  return stops
}

/** Extracts country context for Nominatim geocoding e.g. "Glasgow, Scotland" → "Scotland" */
export function getCountryHint(trip: Trip): string {
  const origin = trip.intake_form?.origin || ''
  const parts = origin.split(',').map(p => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts.slice(1).join(', ') : ''
}
