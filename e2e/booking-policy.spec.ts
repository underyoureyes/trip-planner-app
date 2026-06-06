import { test, expect } from '@playwright/test'
import type { TripData } from '../lib/types'

const OWNER_TRIP = {
  id: 'policy-trip',
  title: 'Policy Test Trip',
  status: 'ready',
  owner_id: 'user-policy',
  is_shared: true,
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  created_at: '2026-01-01T00:00:00Z',
  intake_form: { title: 'Policy Test Trip', num_travellers: 2 },
}

const TRIP_DATA: TripData = {
  summary: 'Test trip',
  total_days: 1,
  total_distance_km: 50,
  total_stops: 3,
  days: [
    {
      day_number: 1,
      date: '2026-07-01',
      title: 'Day one',
      overnight_location: 'York',
      stops: [
        { name: 'York Minster', type: 'sightseeing', address: 'York YO1', duration_mins: 60 },
        {
          name: 'The Grand Hotel York',
          type: 'hotel',
          address: 'Station Rise, York YO1 6GD',
          check_in: '15:00',
          check_out: '10:00',
          booking_ref: 'BOOKING-XYZ-789',
          notes: 'Key safe code: 4821. Check-in is self-service after 17:00.',
          cancellation_policy: 'Free cancellation until 28 Jun 2026',
          pay_at_hotel: false,
        },
        {
          name: 'Harrogate Arms',
          type: 'hotel',
          address: 'Harrogate HG1 2SY',
          check_in: '16:00',
          check_out: '11:00',
          booking_ref: 'HAR-001',
          notes: 'Non-refundable prepaid booking.',
          cancellation_policy: 'Non-refundable',
          pay_at_hotel: true,
        },
      ],
      eating: [],
    },
  ],
  emergency_contacts: [],
}

function mockOwner(page: import('@playwright/test').Page) {
  return page.route('**/api/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'user-policy', email: 'owner@example.com', profile: {} }),
  }))
}

function mockNonOwner(page: import('@playwright/test').Page) {
  return page.route('**/api/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'different-user', email: 'guest@example.com', profile: {} }),
  }))
}

function mockTrip(page: import('@playwright/test').Page) {
  return page.route('**/api/trips/policy-trip', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ trip: OWNER_TRIP, tripData: TRIP_DATA }),
  }))
}

test.describe('Booking policy display', () => {
  test('shows free cancellation badge (green) on hotel stop', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Day 1').click()
    await expect(page.getByText(/Free cancellation until 28 Jun/)).toBeVisible()
  })

  test('shows non-refundable badge (red) on hotel stop', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Day 1').click()
    await expect(page.getByText('Non-refundable')).toBeVisible()
  })

  test('shows pay-at-hotel badge on relevant stop', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Day 1').click()
    await expect(page.getByText('Pay at hotel')).toBeVisible()
  })

  test('policy badges also appear in Accommodation tab', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Stays').click()
    await expect(page.getByText(/Free cancellation until 28 Jun/)).toBeVisible()
    await expect(page.getByText('Non-refundable')).toBeVisible()
  })
})

test.describe('Booking policy editing (owner)', () => {
  test('shows Edit booking policy button on hotel stops for owner', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Day 1').click()
    await expect(page.getByText(/Edit booking policy/i)).toBeVisible()
  })

  test('edit policy form expands with toggle and text field', async ({ page }) => {
    await mockOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip')
    await page.getByText('Day 1').click()
    await page.getByText(/Edit booking policy/i).first().click()
    await expect(page.getByPlaceholder(/Cancellation policy/i)).toBeVisible()
    await expect(page.getByText('Pay at hotel')).toBeVisible()
    await expect(page.getByText(/Scan booking screenshot/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})

test.describe('Sensitive info masking for non-owners', () => {
  test.beforeEach(async ({ page }) => {
    await mockNonOwner(page)
    await mockTrip(page)
    await page.goto('/trips/policy-trip?from_about=1')
    await page.getByText('Day 1').click()
  })

  test('booking reference is masked for non-owner', async ({ page }) => {
    // Should NOT see the actual booking ref
    await expect(page.getByText('BOOKING-XYZ-789')).not.toBeVisible()
    // Should see the masked version
    await expect(page.getByText(/owner only/i)).toBeVisible()
  })

  test('hotel notes (access codes) are hidden for non-owner', async ({ page }) => {
    // Should NOT see the key safe code
    await expect(page.getByText(/4821/)).not.toBeVisible()
    await expect(page.getByText(/Key safe/)).not.toBeVisible()
    // Should see the placeholder message
    await expect(page.getByText(/Access details.*owner only/i)).toBeVisible()
  })

  test('cancellation policy badge remains visible for non-owner', async ({ page }) => {
    // Policy info is not sensitive — guests can see it
    await expect(page.getByText(/Free cancellation until 28 Jun/)).toBeVisible()
  })

  test('Edit booking policy button is not shown for non-owner', async ({ page }) => {
    await expect(page.getByText(/Edit booking policy/i)).not.toBeVisible()
    await expect(page.getByText(/Add booking policy/i)).not.toBeVisible()
  })
})
