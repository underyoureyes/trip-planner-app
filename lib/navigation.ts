// Navigation deep-link builder
// Priority: Google Maps app → Apple Maps app → Google Maps web

import type { Day } from './types'

export function buildNavigateUrl(destination: string): {
  google: string
  apple: string
  web: string
} {
  const dest = destination || ''
  const encoded = encodeURIComponent(dest)
  return {
    google: `comgooglemaps://?daddr=${encoded}&directionsmode=driving`,
    apple: `maps://maps.apple.com/?daddr=${encoded}&dirflg=d`,
    web: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
  }
}

export function buildRouteDayUrl(waypoints: string[]): {
  google: string
  apple: string
  web: string
} {
  const valid = waypoints.filter(Boolean)
  if (valid.length === 0) return buildNavigateUrl('')
  const [start, ...rest] = valid
  if (rest.length === 0) return buildNavigateUrl(start)

  const destination = valid[valid.length - 1]
  const midpoints   = valid.slice(1, -1)

  // saddr = origin; daddr = remaining stops joined with +to:
  const googleDest = rest.map(encodeURIComponent).join('+to:')
  const appleDest  = rest.map(encodeURIComponent).join('+to:')

  // Use ?api=1 query-param format for the web URL — significantly more reliable than
  // the /dir/A/B/C path format for international and complex addresses.
  const webParams = new URLSearchParams({ api: '1', origin: start, destination, travelmode: 'driving' })
  if (midpoints.length > 0) webParams.set('waypoints', midpoints.join('|'))

  return {
    google: `comgooglemaps://?saddr=${encodeURIComponent(start)}&daddr=${googleDest}&directionsmode=driving`,
    apple: `maps://maps.apple.com/?saddr=${encodeURIComponent(start)}&daddr=${appleDest}&dirflg=d`,
    web: `https://www.google.com/maps/dir/?${webParams.toString()}`,
  }
}

/**
 * Builds the Maps route URL set for a single trip day.
 *
 * Rules:
 * - Drive and ferry stops are excluded — neither are driveable road waypoints.
 *   The ferry crossing itself is handled by the start/end locations; including
 *   the ferry departure port as a waypoint would route backwards across the Channel.
 * - Hotel and camping stops are the overnight destination and are included as
 *   normal waypoints. overnight_location is NOT appended additionally when one of
 *   these stops is present — that would create a redundant duplicate waypoint
 *   (e.g. "Le Mans campsite" followed by "Le Mans").
 * - overnight_location IS appended when all stops are drives/ferries (stops list
 *   is empty after filtering) so that pure driving days still have a destination.
 * - Returns null when there are no navigable waypoints.
 */
export function buildDayRouteUrl(
  day: Day,
  startLocation?: string,
): { google: string; apple: string; web: string } | null {
  const stops = day.stops
    .filter(s => s.type !== 'drive' && s.type !== 'ferry' && (s.address || s.name))
    .map(s => (s.address || s.name) as string)

  const hasOvernightStop = day.stops.some(s => s.type === 'hotel' || s.type === 'camping')
  if (day.overnight_location && !hasOvernightStop) {
    if (stops[stops.length - 1] !== day.overnight_location) {
      stops.push(day.overnight_location)
    }
  }

  if (stops.length === 0) return null

  const wpts = startLocation ? [startLocation, ...stops] : stops
  return buildRouteDayUrl(wpts)
}

export function formatDriveTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export const STOP_TYPE_ICONS: Record<string, string> = {
  sightseeing: '🏛️',
  hotel: '🛏️',
  camping: '⛺',
  ferry: '⛴️',
  dog_walk: '🐾',
  fuel: '⛽',
  golf: '⛳',
  distillery: '🥃',
  castle: '🏰',
  boat_trip: '⛵',
  cycling: '🚴',
  beach: '🏖️',
  restaurant: '🍽️',
  cafe: '☕',
  pub: '🍺',
  nature: '🌿',
  museum: '🏛️',
  accommodation: '🛏️',
  activity: '🎯',
  viewpoint: '📸',
  town: '🏘️',
  other: '📍',
}
