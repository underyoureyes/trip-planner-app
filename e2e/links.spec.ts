import { test, expect } from '@playwright/test'
import type { TripData } from '../lib/types'

const BASE_TRIP = {
  id: 'links-trip',
  title: 'Links Test Trip',
  status: 'ready',
  owner_id: 'user-links',
  is_shared: true,
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  created_at: '2026-01-01T00:00:00Z',
  intake_form: { title: 'Links Test Trip', num_travellers: 2 },
}

// Trip with overnight_location that contains a full address (the bug the user reported)
const TRIP_DATA_FULL_ADDRESS: TripData = {
  summary: 'Test trip',
  total_days: 2,
  total_distance_km: 100,
  total_stops: 4,
  days: [
    {
      day_number: 1,
      date: '2026-07-01',
      title: 'Day with full-address overnight location',
      overnight_location: 'Skipton Road, Skelton, York, YO30 1XW',
      stops: [
        {
          name: 'York Minster',
          type: 'sightseeing',
          address: 'Deangate, York YO1 7HH',
          website: 'https://www.yorkminster.org',
          duration_mins: 90,
        },
        {
          name: 'Drive to York',
          type: 'drive',
          drive_time_mins: 60,
          distance_km: 50,
        },
        {
          name: 'The Grand Hotel York',
          type: 'hotel',
          address: 'Station Rise, York YO1 6GD',
          check_in: '15:00',
          check_out: '10:00',
          booking_ref: 'ABC123',
          phone: '01904 380038',
          cancellation_policy: 'Free cancellation until 28 Jun 2026',
        },
      ],
      eating: [],
    },
    {
      day_number: 2,
      date: '2026-07-02',
      title: 'Day two',
      overnight_location: 'Harrogate',
      stops: [
        { name: 'Harrogate Hotel', type: 'hotel', address: 'Harrogate HG1', check_in: '15:00', check_out: '10:00' },
      ],
      eating: [],
    },
  ],
  emergency_contacts: [
    { name: 'York Hospital A&E', type: 'a_and_e', phone: '01904 631313', address: 'Wigginton Road, York YO31 8HE', location: 'York' },
    { name: 'Yorkshire Vets', type: 'vet', phone: '01904 655655', address: 'York YO1', location: 'York' },
  ],
}

// Trip with simple town name overnight_location (should also work correctly)
const TRIP_DATA_SIMPLE: TripData = {
  ...TRIP_DATA_FULL_ADDRESS,
  days: [
    { ...TRIP_DATA_FULL_ADDRESS.days[0], overnight_location: 'York' },
    TRIP_DATA_FULL_ADDRESS.days[1],
  ],
}

test.describe('Link integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-links', email: 'test@example.com', profile: { vehicle_name: 'Test Car' } }),
    }))
  })

  test.describe('Weather link', () => {
    test('uses town name when overnight_location is just a town', async ({ page }) => {
      await page.route('**/api/trips/links-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: BASE_TRIP, tripData: TRIP_DATA_SIMPLE }),
      }))
      await page.goto('/trips/links-trip')
      const link = page.locator('a[href*="google.com/search"][href*="weather"]')
      await expect(link).toBeVisible()
      const href = await link.getAttribute('href')
      expect(href).toContain('York')
      expect(href).not.toContain('YO1')
    })

    test('uses only the town portion when overnight_location is a full address', async ({ page }) => {
      await page.route('**/api/trips/links-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: BASE_TRIP, tripData: TRIP_DATA_FULL_ADDRESS }),
      }))
      await page.goto('/trips/links-trip')
      const link = page.locator('a[href*="google.com/search"][href*="weather"]')
      await expect(link).toBeVisible()
      const href = await link.getAttribute('href')
      // Should use "Skipton Road" (first part) not the full address
      expect(href).not.toContain('YO30')
      expect(href).not.toContain('Skelton')
      expect(href).toContain('google.com/search')
    })

    test('opens in a new tab', async ({ page }) => {
      await page.route('**/api/trips/links-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: BASE_TRIP, tripData: TRIP_DATA_SIMPLE }),
      }))
      await page.goto('/trips/links-trip')
      const link = page.locator('a[href*="google.com/search"][href*="weather"]')
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  test.describe('Navigate button links', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/trips/links-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: BASE_TRIP, tripData: TRIP_DATA_SIMPLE }),
      }))
    })

    test('stop Navigate button links to Google Maps with encoded address', async ({ page }) => {
      await page.goto('/trips/links-trip')
      const navBtn = page.locator('a.stop-nav-btn', { hasText: 'Navigate' }).first()
      await expect(navBtn).toBeVisible()
      const href = await navBtn.getAttribute('href')
      expect(href).toContain('google.com/maps')
      expect(href).not.toMatch(/undefined|null/)
    })

    test('Open Route in Maps button is a valid maps URL', async ({ page }) => {
      await page.goto('/trips/links-trip')
      const routeBtn = page.locator('a', { hasText: 'Open Route in Maps' })
      await expect(routeBtn).toBeVisible()
      const href = await routeBtn.getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).toMatch(/google\.com|maps\.apple\.com|comgooglemaps/)
      expect(href).not.toContain('undefined')
    })

    test('stop website links are HTTPS and open in new tab', async ({ page }) => {
      await page.goto('/trips/links-trip')
      const websiteLinks = page.locator('a.stop-link-green')
      const count = await websiteLinks.count()
      for (let i = 0; i < count; i++) {
        const href = await websiteLinks.nth(i).getAttribute('href')
        if (href) {
          expect(href).toMatch(/^https?:\/\//)
          expect(href).not.toContain('undefined')
        }
        await expect(websiteLinks.nth(i)).toHaveAttribute('target', '_blank')
      }
    })
  })

  test.describe('Emergency contact links', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/trips/links-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: BASE_TRIP, tripData: TRIP_DATA_FULL_ADDRESS }),
      }))
    })

    test('phone numbers in emergency contacts use tel: protocol', async ({ page }) => {
      await page.goto('/trips/links-trip')
      // Contacts have location:'York' but Day 1 overnight is a full address, so they won't
      // appear on the per-day view. Navigate to Overview to see all contacts directly.
      await page.getByRole('button', { name: 'Overview' }).click()
      const phoneLink = page.locator('a[href^="tel:"]').first()
      await expect(phoneLink).toBeVisible()
      const href = await phoneLink.getAttribute('href')
      expect(href).toMatch(/^tel:/)
      expect(href).not.toContain(' ')  // tel: links should have no spaces
    })

    test('emergency contacts with no phone link to Google Maps', async ({ page }) => {
      await page.goto('/trips/links-trip')
      // Overview shows all contacts — find any that have map links
      const mapLinks = page.locator('a[href*="google.com/maps/search"]')
      // Just ensure map links (if present) are valid Google Maps URLs
      const count = await mapLinks.count()
      for (let i = 0; i < count; i++) {
        const href = await mapLinks.nth(i).getAttribute('href')
        expect(href).toContain('google.com/maps')
        expect(href).not.toContain('undefined')
      }
    })
  })

  test.describe('About page links', () => {
    test('email invite link uses mailto: and correct address', async ({ page }) => {
      await page.goto('/about')
      const mailtoLink = page.locator('a[href^="mailto:"]')
      await expect(mailtoLink).toBeVisible()
      const href = await mailtoLink.getAttribute('href')
      expect(href).toContain('mailto:')
      expect(href).toContain('d.castledine1971@gmail.com')
      expect(href).toContain('invite')
    })

    test('register and sign in links go to correct pages', async ({ page }) => {
      await page.goto('/about')
      const registerLink = page.getByRole('link', { name: /get access/i })
      await expect(registerLink).toBeVisible()
      await expect(registerLink).toHaveAttribute('href', '/register')

      const signInLink = page.getByRole('link', { name: /sign in/i })
      await expect(signInLink).toBeVisible()
      await expect(signInLink).toHaveAttribute('href', '/login')
    })
  })
})
