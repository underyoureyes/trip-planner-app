// Navigation deep-link builder
// Priority: Google Maps app → Apple Maps app → Google Maps web

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

  // saddr = origin; daddr = remaining stops joined with +to: (NOT including start again)
  const googleDest = rest.map(encodeURIComponent).join('+to:')
  const appleDest  = rest.map(encodeURIComponent).join('+to:')

  return {
    google: `comgooglemaps://?saddr=${encodeURIComponent(start)}&daddr=${googleDest}&directionsmode=driving`,
    apple: `maps://maps.apple.com/?saddr=${encodeURIComponent(start)}&daddr=${appleDest}&dirflg=d`,
    web: `https://www.google.com/maps/dir/${valid.map(encodeURIComponent).join('/')}`,
  }
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
