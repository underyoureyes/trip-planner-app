import { test, expect } from '@playwright/test'
import type { TripData } from '../lib/types'

const TRIP = {
  id: 'ec-trip',
  title: 'Emergency Contacts Test Trip',
  status: 'ready',
  owner_id: 'user-ec',
  is_shared: true,
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  created_at: '2026-01-01T00:00:00Z',
  intake_form: { title: 'Test', num_travellers: 2 },
}

const TRIP_DATA: TripData = {
  summary: 'Test trip',
  total_days: 2,
  total_distance_km: 100,
  total_stops: 3,
  days: [
    {
      day_number: 1,
      date: '2026-07-01',
      title: 'York day',
      overnight_location: 'York',
      stops: [
        { name: 'York Minster', type: 'sightseeing', address: 'York YO1', duration_mins: 90 },
        { name: 'York Hotel', type: 'hotel', address: 'York YO1', check_in: '15:00', check_out: '10:00' },
      ],
      eating: [],
    },
    {
      day_number: 2,
      date: '2026-07-02',
      title: 'Harrogate day',
      overnight_location: 'Harrogate',
      stops: [
        { name: 'Harrogate Hotel', type: 'hotel', address: 'Harrogate HG1', check_in: '15:00', check_out: '10:00' },
      ],
      eating: [],
    },
  ],
  emergency_contacts: [
    { name: 'York Hospital A&E', type: 'a_and_e', phone: '01904 631313', address: 'Wigginton Road, York', location: 'York', notes: '24hr A&E' },
    { name: 'York Vets', type: 'vet', phone: '01904 111111', address: 'York YO1', location: 'York' },
    { name: 'Harrogate Hospital', type: 'a_and_e', phone: '01423 885959', address: 'Lancaster Park Road, Harrogate', location: 'Harrogate' },
  ],
}

function mockOwner(page: import('@playwright/test').Page) {
  return page.route('**/api/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'user-ec', email: 'owner@example.com', profile: {} }),
  }))
}

function mockGuest(page: import('@playwright/test').Page) {
  return page.route('**/api/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'other-user', email: 'guest@example.com', profile: {} }),
  }))
}

function mockTrip(page: import('@playwright/test').Page) {
  return page.route('**/api/trips/ec-trip', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ trip: TRIP, tripData: TRIP_DATA }),
  }))
}

test.describe('Emergency contacts', () => {
  test.describe('Overview section', () => {
    test('shows Emergency & Useful Contacts section on overview', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      await page.getByRole('button', { name: 'Overview' }).click()
      await expect(page.getByText(/Emergency.*Useful Contacts/i)).toBeVisible()
    })

    test('shows all contacts on the overview, grouped by location', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      await page.getByRole('button', { name: 'Overview' }).click()
      await expect(page.getByText('York Hospital A&E')).toBeVisible()
      await expect(page.getByText('York Vets')).toBeVisible()
      await expect(page.getByText('Harrogate Hospital')).toBeVisible()
      // Location dividers
      await expect(page.getByText('📍 York')).toBeVisible()
      await expect(page.getByText('📍 Harrogate')).toBeVisible()
    })

    test('shows Generate button for owner when contacts exist', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      await page.getByRole('button', { name: 'Overview' }).click()
      await expect(page.getByRole('button', { name: /Generate/i })).toBeVisible()
    })

    test('does not show Generate button for non-owner', async ({ page }) => {
      await mockGuest(page)
      await page.route('**/api/me', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'other-user', email: 'guest@example.com', profile: {} }),
      }))
      await page.goto('/trips/ec-trip?from_about=1')
      await page.route('**/api/trips/ec-trip', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: TRIP, tripData: TRIP_DATA }),
      }))
      await page.goto('/trips/ec-trip?from_about=1')
      await expect(page.getByRole('button', { name: /Generate/i })).not.toBeVisible()
    })

    test('phone numbers are tappable call links', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      await page.getByRole('button', { name: 'Overview' }).click()
      const phoneLink = page.locator('a[href="tel:01904631313"]')
      await expect(phoneLink).toBeVisible()
    })
  })

  test.describe('Per-day view', () => {
    test('day 1 shows only York contacts', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      // Page defaults to Day 1 — no click needed

      const sosBtn = page.locator('button', { hasText: /Emergency contacts.*York/i }).first()
      await expect(sosBtn).toBeVisible()
      await sosBtn.click()

      await expect(page.getByText('York Hospital A&E')).toBeVisible()
      await expect(page.getByText('York Vets')).toBeVisible()
      // Harrogate contact should NOT appear on day 1
      await expect(page.getByText('Harrogate Hospital')).not.toBeVisible()
    })

    test('day 2 shows only Harrogate contacts', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      await page.locator('.overflow-x-auto').getByRole('button', { name: /Day 2/ }).click()

      const sosBtn = page.locator('button', { hasText: /Emergency contacts.*Harrogate/i }).first()
      await expect(sosBtn).toBeVisible()
      await sosBtn.click()

      await expect(page.getByText('Harrogate Hospital')).toBeVisible()
      // York contacts should NOT appear on day 2
      await expect(page.getByText('York Hospital A&E')).not.toBeVisible()
      await expect(page.getByText('York Vets')).not.toBeVisible()
    })

    test('per-day emergency contact section is collapsible', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      // Page defaults to Day 1 — no click needed

      const sosBtn = page.locator('button', { hasText: /Emergency contacts/i }).first()
      await expect(sosBtn).toBeVisible()

      // Initially collapsed
      await expect(page.getByText('York Hospital A&E')).not.toBeVisible()

      // Click to expand
      await sosBtn.click()
      await expect(page.getByText('York Hospital A&E')).toBeVisible()

      // Click to collapse
      await sosBtn.click()
      await expect(page.getByText('York Hospital A&E')).not.toBeVisible()
    })

    test('emergency contact header includes the overnight town name', async ({ page }) => {
      await mockOwner(page)
      await mockTrip(page)
      await page.goto('/trips/ec-trip')
      // Page defaults to Day 1 — no click needed
      await expect(page.locator('button', { hasText: /Emergency contacts.*York/i })).toBeVisible()
    })
  })
})
