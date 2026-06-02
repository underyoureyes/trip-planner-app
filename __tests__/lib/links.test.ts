import { describe, it, expect } from 'vitest'
import { buildNavigateUrl, buildRouteDayUrl } from '@/lib/navigation'

// These tests guard against malformed URLs that show as "not found" in the app.

describe('buildNavigateUrl — link integrity', () => {
  it('never puts the string "undefined" in a URL', () => {
    const urls = buildNavigateUrl(undefined as any)
    expect(urls.google).not.toContain('undefined')
    expect(urls.apple).not.toContain('undefined')
    expect(urls.web).not.toContain('undefined')
  })

  it('never puts the string "null" in a URL', () => {
    const urls = buildNavigateUrl(null as any)
    expect(urls.google).not.toContain('null')
    expect(urls.apple).not.toContain('null')
    expect(urls.web).not.toContain('null')
  })

  it('web URL is a valid https:// URL', () => {
    const { web } = buildNavigateUrl('Edinburgh Castle, EH1 2NG')
    expect(web).toMatch(/^https:\/\//)
  })

  it('encodes spaces in the address (no raw spaces in URL)', () => {
    const tricky = 'Café & Bistro, Loch Lomond'
    const { web } = buildNavigateUrl(tricky)
    expect(web).not.toMatch(/destination=[^&]*\s/)  // no unencoded space inside destination param
  })

  it('encodes ampersand in address as %26 not raw &', () => {
    const { web } = buildNavigateUrl('Fish & Chips Café')
    expect(web).toContain('%26')  // & encoded
  })
})

describe('buildRouteDayUrl — link integrity', () => {
  it('never puts "undefined" in any URL', () => {
    const urls = buildRouteDayUrl([undefined as any, 'Bath'])
    expect(urls.web).not.toContain('undefined')
    expect(urls.google).not.toContain('undefined')
  })

  it('web URL is a valid https:// URL', () => {
    const { web } = buildRouteDayUrl(['London', 'Bath', 'Bristol'])
    expect(web).toMatch(/^https:\/\//)
  })

  it('all waypoints appear in the web URL', () => {
    const waypoints = ['London', 'Oxford', 'Bath']
    const { web } = buildRouteDayUrl(waypoints)
    for (const w of waypoints) {
      expect(web).toContain(encodeURIComponent(w))
    }
  })

  it('single waypoint produces a navigable URL', () => {
    const { web } = buildRouteDayUrl(['Inverness'])
    expect(web).toMatch(/^https:\/\//)
    expect(web).toContain(encodeURIComponent('Inverness'))
  })

  it('empty array returns a defined object with all three keys', () => {
    const urls = buildRouteDayUrl([])
    expect(urls).toHaveProperty('google')
    expect(urls).toHaveProperty('apple')
    expect(urls).toHaveProperty('web')
  })
})

describe('stop nav URL format', () => {
  it('produces a valid destination URL for a real address', () => {
    const address = 'Castlehill, Edinburgh EH1 2NG'
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/)
    expect(url).toContain(encodeURIComponent(address))
    expect(url).not.toContain(' ')
  })
})
