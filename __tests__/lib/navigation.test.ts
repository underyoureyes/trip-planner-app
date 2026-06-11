import { describe, it, expect } from 'vitest'
import { buildNavigateUrl, buildRouteDayUrl, buildDayRouteUrl, formatDriveTime, STOP_TYPE_ICONS } from '@/lib/navigation'
import type { Day } from '@/lib/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<Day> = {}): Day {
  return { day_number: 1, title: 'Test Day', stops: [], ...overrides }
}

/** Extract a decoded query-param value from the web URL (handles URLSearchParams + encoding) */
function webParam(urls: { web: string }, key: string): string | null {
  return new URL(urls.web).searchParams.get(key)
}


describe('buildNavigateUrl', () => {
  it('returns google, apple, and web URLs', () => {
    const urls = buildNavigateUrl('Edinburgh Castle')
    expect(urls.google).toContain('comgooglemaps://')
    expect(urls.apple).toContain('maps://maps.apple.com/')
    expect(urls.web).toContain('https://www.google.com/maps/dir/')
  })

  it('URL-encodes the destination', () => {
    const urls = buildNavigateUrl('St Andrews, Fife')
    const encoded = encodeURIComponent('St Andrews, Fife')
    expect(urls.google).toContain(encoded)
    expect(urls.apple).toContain(encoded)
    expect(urls.web).toContain(encoded)
  })

  it('sets driving mode on all URLs', () => {
    const urls = buildNavigateUrl('Inverness')
    expect(urls.google).toContain('directionsmode=driving')
    expect(urls.apple).toContain('dirflg=d')
    expect(urls.web).toContain('travelmode=driving')
  })

  it('handles empty destination', () => {
    const urls = buildNavigateUrl('')
    expect(urls.google).toBeDefined()
    expect(urls.apple).toBeDefined()
    expect(urls.web).toBeDefined()
  })
})

describe('buildRouteDayUrl', () => {
  it('falls back to buildNavigateUrl for empty array', () => {
    const urls = buildRouteDayUrl([])
    expect(urls.google).toContain('comgooglemaps://')
  })

  it('handles single waypoint', () => {
    const urls = buildRouteDayUrl(['London'])
    expect(urls.google).toContain('comgooglemaps://')
    expect(urls.web).toContain(encodeURIComponent('London'))
  })

  it('handles two waypoints', () => {
    const urls = buildRouteDayUrl(['London', 'Bath'])
    expect(urls.google).toContain(encodeURIComponent('London'))
    expect(urls.google).toContain(encodeURIComponent('Bath'))
  })

  it('handles multiple waypoints', () => {
    const urls = buildRouteDayUrl(['London', 'Oxford', 'Bath', 'Bristol'])
    expect(urls.web).toContain('Oxford')
    expect(urls.web).toContain('Bath')
  })

  it('web URL uses ?api=1 query-param format (not /dir/A/B/C path format)', () => {
    const urls = buildRouteDayUrl(['London', 'York'])
    expect(urls.web).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/)
    expect(urls.web).toContain('api=1')
    expect(urls.web).toContain('origin=')
    expect(urls.web).toContain('destination=')
    expect(urls.web).toContain('travelmode=driving')
  })

  it('sets origin and destination correctly for two-stop route', () => {
    const urls = buildRouteDayUrl(['London', 'Edinburgh'])
    expect(urls.web).toContain(`origin=${encodeURIComponent('London')}`)
    expect(urls.web).toContain(`destination=${encodeURIComponent('Edinburgh')}`)
    expect(urls.web).not.toContain('waypoints')
  })

  it('puts middle stops in waypoints param separated by |', () => {
    const urls = buildRouteDayUrl(['London', 'Oxford', 'Bath', 'Bristol'])
    expect(urls.web).toContain(`origin=${encodeURIComponent('London')}`)
    expect(urls.web).toContain(`destination=${encodeURIComponent('Bristol')}`)
    // Oxford and Bath are midpoints joined with |
    const waypointsMatch = urls.web.match(/waypoints=([^&]+)/)
    expect(waypointsMatch).not.toBeNull()
    const waypoints = decodeURIComponent(waypointsMatch![1])
    expect(waypoints).toBe('Oxford|Bath')
  })

  it('start is NOT duplicated in daddr (the old double-saddr bug)', () => {
    const urls = buildRouteDayUrl(['Glasgow', 'Edinburgh Castle', 'Pitlochry Hotel'])
    expect(urls.google).toContain(`saddr=${encodeURIComponent('Glasgow')}`)
    // Glasgow must not appear in daddr
    const daddr = urls.google.match(/daddr=([^&]+)/)?.[1] ?? ''
    expect(decodeURIComponent(daddr)).not.toContain('Glasgow')
  })
})

describe('formatDriveTime', () => {
  it('shows minutes for under 60', () => {
    expect(formatDriveTime(45)).toBe('45 min')
    expect(formatDriveTime(1)).toBe('1 min')
  })

  it('shows whole hours with no minutes', () => {
    expect(formatDriveTime(60)).toBe('1h')
    expect(formatDriveTime(120)).toBe('2h')
  })

  it('shows hours and minutes', () => {
    expect(formatDriveTime(90)).toBe('1h 30m')
    expect(formatDriveTime(75)).toBe('1h 15m')
    expect(formatDriveTime(130)).toBe('2h 10m')
  })
})

describe('STOP_TYPE_ICONS', () => {
  it('has icons for expected stop types', () => {
    expect(STOP_TYPE_ICONS.sightseeing).toBe('🏛️')
    expect(STOP_TYPE_ICONS.fuel).toBe('⛽')
    expect(STOP_TYPE_ICONS.castle).toBe('🏰')
    expect(STOP_TYPE_ICONS.beach).toBe('🏖️')
    expect(STOP_TYPE_ICONS.other).toBe('📍')
  })

  it('covers all documented types', () => {
    const types = ['sightseeing', 'dog_walk', 'fuel', 'golf', 'distillery', 'castle', 'boat_trip', 'cycling', 'beach', 'restaurant', 'accommodation', 'activity', 'viewpoint', 'town', 'other']
    for (const t of types) {
      expect(STOP_TYPE_ICONS[t], `missing icon for ${t}`).toBeDefined()
    }
  })
})

// ── buildDayRouteUrl ──────────────────────────────────────────────────────────

describe('buildDayRouteUrl', () => {
  it('returns null when day has no stops and no overnight_location', () => {
    expect(buildDayRouteUrl(makeDay())).toBeNull()
  })

  it('returns null when all stops are drive type with no overnight_location', () => {
    const day = makeDay({ stops: [{ name: 'Drive', type: 'drive', drive_time_mins: 120 }] })
    expect(buildDayRouteUrl(day)).toBeNull()
  })

  it('returns null when all stops are ferry type with no overnight_location', () => {
    const day = makeDay({ stops: [{ name: 'Portsmouth to Caen', type: 'ferry' }] })
    expect(buildDayRouteUrl(day)).toBeNull()
  })

  // ── Normal hotel day ────────────────────────────────────────────────────────

  it('routes start → hotel when day has hotel stop', () => {
    const day = makeDay({
      overnight_location: 'York',
      stops: [{ name: 'York Hotel', type: 'hotel', address: '1 High St, York' }],
    })
    const urls = buildDayRouteUrl(day, 'London')!
    expect(urls).not.toBeNull()
    // Hotel address should be the destination, overnight "York" must NOT be appended
    expect(webParam(urls, 'destination')).toBe('1 High St, York')
    // No extra midpoint — only origin + destination
    expect(webParam(urls, 'origin')).toBe('London')
    expect(webParam(urls, 'waypoints')).toBeNull()
  })

  it('falls back to hotel name when hotel has no address', () => {
    const day = makeDay({
      overnight_location: 'York',
      stops: [{ name: 'York Marriott', type: 'hotel' }],
    })
    const urls = buildDayRouteUrl(day, 'London')!
    expect(webParam(urls, 'destination')).toBe('York Marriott')
  })

  it('routes start → sightseeing → hotel (no extra overnight waypoint)', () => {
    const day = makeDay({
      overnight_location: 'Pitlochry',
      stops: [
        { name: 'Glencoe', type: 'sightseeing', address: 'Glencoe, PH49 4HX' },
        { name: 'Pitlochry Hotel', type: 'hotel', address: 'Atholl Road, Pitlochry, PH16 5BX' },
      ],
    })
    const urls = buildDayRouteUrl(day, 'Edinburgh')!
    // origin=Edinburgh, destination=Pitlochry Hotel, waypoints=Glencoe — NOT a 4th "Pitlochry" segment
    expect(webParam(urls, 'origin')).toBe('Edinburgh')
    expect(webParam(urls, 'destination')).toBe('Atholl Road, Pitlochry, PH16 5BX')
    // only one midpoint (Glencoe), no extra "Pitlochry" segment
    const waypoints = webParam(urls, 'waypoints') ?? ''
    expect(waypoints).toBe('Glencoe, PH49 4HX')
    expect(waypoints).not.toContain('|')
  })

  // ── Camping day ─────────────────────────────────────────────────────────────

  it('routes correctly for a camping day (no overnight_location appended)', () => {
    const day = makeDay({
      overnight_location: 'Le Mans',
      stops: [{ name: 'Le Mans Circuit Camping', type: 'camping', address: 'Circuit de la Sarthe, 72100 Le Mans' }],
    })
    const urls = buildDayRouteUrl(day, 'Caen')!
    expect(webParam(urls, 'origin')).toBe('Caen')
    expect(webParam(urls, 'destination')).toBe('Circuit de la Sarthe, 72100 Le Mans')
    // "Le Mans" must NOT appear as a separate waypoint on top of the campsite address
    expect(webParam(urls, 'waypoints')).toBeNull()
  })

  // ── Ferry day (the Le Mans use-case) ────────────────────────────────────────

  it('excludes ferry stop from route waypoints', () => {
    const day = makeDay({
      overnight_location: 'Le Mans',
      stops: [
        { name: 'Brittany Ferries Portsmouth to Caen', type: 'ferry', address: 'Portsmouth Harbour' },
        { name: 'Le Mans Circuit Camping', type: 'camping', address: 'Circuit de la Sarthe, 72100 Le Mans' },
      ],
    })
    const urls = buildDayRouteUrl(day, 'Caen ferry terminal')!
    expect(urls).not.toBeNull()
    // Portsmouth must NOT appear — it's the ferry departure, not a road waypoint
    expect(urls.web).not.toContain('Portsmouth')
    // Caen start and Le Mans campsite should be origin/destination, no waypoints
    expect(webParam(urls, 'origin')).toBe('Caen ferry terminal')
    expect(webParam(urls, 'destination')).toBe('Circuit de la Sarthe, 72100 Le Mans')
    expect(webParam(urls, 'waypoints')).toBeNull()
  })

  it('excludes drive stops as well as ferry stops', () => {
    const day = makeDay({
      overnight_location: 'Le Mans',
      stops: [
        { name: 'Brittany Ferries', type: 'ferry', address: 'Portsmouth Harbour' },
        { name: 'Drive to Le Mans', type: 'drive', drive_time_mins: 120, distance_km: 200 },
        { name: 'Le Mans Camping', type: 'camping', address: 'Circuit de la Sarthe, Le Mans' },
      ],
    })
    const urls = buildDayRouteUrl(day, 'Caen')!
    expect(urls.web).not.toContain('Portsmouth')
    expect(webParam(urls, 'waypoints')).toBeNull()
    expect(webParam(urls, 'origin')).toBe('Caen')
    expect(webParam(urls, 'destination')).toBe('Circuit de la Sarthe, Le Mans')
  })

  it('ferry-only day with overnight_location still produces a route', () => {
    // Day 1 of a ferry trip — just the ferry, no road stops
    const day = makeDay({
      overnight_location: 'Portsmouth',
      stops: [{ name: 'Eurotunnel Le Shuttle', type: 'ferry' }],
    })
    const urls = buildDayRouteUrl(day, 'London')!
    expect(urls).not.toBeNull()
    // ferry excluded, overnight appended (no hotel/camping)
    expect(webParam(urls, 'origin')).toBe('London')
    expect(webParam(urls, 'destination')).toBe('Portsmouth')
    expect(webParam(urls, 'waypoints')).toBeNull()
  })

  // ── Drive-only day ──────────────────────────────────────────────────────────

  it('drive-only day routes to overnight_location', () => {
    const day = makeDay({
      overnight_location: 'Bromley',
      stops: [
        { name: 'Drive home', type: 'drive', drive_time_mins: 90 },
      ],
    })
    const urls = buildDayRouteUrl(day, 'Le Mans')!
    expect(urls).not.toBeNull()
    expect(webParam(urls, 'origin')).toBe('Le Mans')
    expect(webParam(urls, 'destination')).toBe('Bromley')
    expect(webParam(urls, 'waypoints')).toBeNull()
  })

  // ── No startLocation ────────────────────────────────────────────────────────

  it('works without a startLocation (Day 1 with no origin)', () => {
    const day = makeDay({
      stops: [{ name: 'Pitlochry Hotel', type: 'hotel', address: 'Atholl Road, Pitlochry' }],
    })
    const urls = buildDayRouteUrl(day)!
    // Single waypoint → navigate URL
    expect(urls).not.toBeNull()
    expect(urls.web).toContain(encodeURIComponent('Atholl Road, Pitlochry'))
  })

  // ── URL format checks ───────────────────────────────────────────────────────

  it('google URL uses saddr/daddr format for multi-stop routes', () => {
    const day = makeDay({
      stops: [{ name: 'Edinburgh Castle', type: 'sightseeing', address: 'Castlehill, Edinburgh EH1 2NG' }],
    })
    const urls = buildDayRouteUrl(day, 'Glasgow')!
    expect(urls.google).toMatch(/^comgooglemaps:\/\/\?saddr=/)
    expect(urls.google).toContain('daddr=')
    expect(urls.google).toContain('directionsmode=driving')
    // Start must NOT appear in daddr (was the double-saddr bug)
    expect(urls.google).toContain(`saddr=${encodeURIComponent('Glasgow')}`)
    expect(urls.google).not.toMatch(/daddr=.*Glasgow/)
  })

  it('web URL uses google.com/maps/dir/ path format', () => {
    const day = makeDay({
      stops: [{ name: 'York Hotel', type: 'hotel', address: '1 High St, York' }],
    })
    const urls = buildDayRouteUrl(day, 'London')!
    expect(urls.web).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//)
  })

  it('apple URL uses maps://maps.apple.com/ with dirflg=d', () => {
    const day = makeDay({
      stops: [{ name: 'York Hotel', type: 'hotel', address: '1 High St, York' }],
    })
    const urls = buildDayRouteUrl(day, 'London')!
    expect(urls.apple).toMatch(/^maps:\/\/maps\.apple\.com\//)
    expect(urls.apple).toContain('dirflg=d')
  })
})
