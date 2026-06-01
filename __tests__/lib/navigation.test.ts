import { describe, it, expect } from 'vitest'
import { buildNavigateUrl, buildRouteDayUrl, formatDriveTime, STOP_TYPE_ICONS } from '@/lib/navigation'

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
    expect(urls.web).toContain(encodeURIComponent('Oxford'))
    expect(urls.web).toContain(encodeURIComponent('Bath'))
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
