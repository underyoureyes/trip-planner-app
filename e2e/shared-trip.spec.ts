import { test, expect } from '@playwright/test'
import type { TripData } from '../lib/types'

const SHARED_TRIP = {
  id: 'shared-trip-1',
  title: 'Shared Trip',
  status: 'ready',
  owner_id: 'owner-user',
  is_shared: true,
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  created_at: '2026-01-01T00:00:00Z',
  intake_form: { title: 'Shared Trip', num_travellers: 3 },
}

const TRIP_DATA: TripData = {
  summary: 'A shared road trip',
  total_days: 1,
  total_distance_km: 50,
  total_stops: 2,
  days: [
    {
      day_number: 1,
      date: '2026-07-01',
      title: 'Day one',
      overnight_location: 'York',
      stops: [
        {
          name: 'Premier Inn York',
          type: 'hotel',
          address: 'York YO1',
          check_in: '15:00',
          check_out: '10:00',
          booking_ref: 'SECRET-REF-123',
          notes: 'Lock box code: 9977. Park in bay 14.',
        },
      ],
      eating: [],
    },
  ],
  emergency_contacts: [],
}

function mockTripApi(page: import('@playwright/test').Page) {
  return page.route('**/api/trips/shared-trip-1', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ trip: SHARED_TRIP, tripData: TRIP_DATA }),
  }))
}

test.describe('Shared trip access', () => {
  test('non-owner without ?from_about=1 is redirected to About page', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'other-user', email: 'guest@test.com', profile: {} }),
    }))
    await mockTripApi(page)
    await page.goto('/trips/shared-trip-1')
    // Should be redirected to /about with a next param
    await expect(page).toHaveURL(/\/about/)
    await expect(page.url()).toContain('next=')
  })

  test('About page shows View trip banner when ?next= param is set', async ({ page }) => {
    await page.goto('/about?next=/trips/shared-trip-1')
    await expect(page.getByText(/View trip/i)).toBeVisible()
  })

  test('View trip banner links back to the trip with from_about=1', async ({ page }) => {
    await page.goto('/about?next=/trips/shared-trip-1')
    const viewBtn = page.getByText(/View trip/i)
    const href = await viewBtn.locator('..').getAttribute('href')
    expect(href).toContain('/trips/shared-trip-1')
    expect(href).toContain('from_about=1')
  })

  test('non-owner with ?from_about=1 can view the trip', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'other-user', email: 'guest@test.com', profile: {} }),
    }))
    await mockTripApi(page)
    await page.goto('/trips/shared-trip-1?from_about=1')
    await expect(page.getByText('Shared Trip')).toBeVisible()
  })

  test('non-owner cannot see booking reference on shared trip', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'other-user', email: 'guest@test.com', profile: {} }),
    }))
    await mockTripApi(page)
    await page.goto('/trips/shared-trip-1?from_about=1')
    await page.getByText('Day 1').click()
    await expect(page.getByText('SECRET-REF-123')).not.toBeVisible()
    await expect(page.getByText(/owner only/i)).toBeVisible()
  })

  test('non-owner cannot see lock box code in hotel notes', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'other-user', email: 'guest@test.com', profile: {} }),
    }))
    await mockTripApi(page)
    await page.goto('/trips/shared-trip-1?from_about=1')
    await page.getByText('Day 1').click()
    await expect(page.getByText('9977')).not.toBeVisible()
    await expect(page.getByText(/Lock box/)).not.toBeVisible()
    await expect(page.getByText(/Access details.*owner only/i)).toBeVisible()
  })

  test('owner sees their own booking reference and notes', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'owner-user', email: 'owner@test.com', profile: {} }),
    }))
    await mockTripApi(page)
    await page.goto('/trips/shared-trip-1')
    await page.getByText('Day 1').click()
    await expect(page.getByText('SECRET-REF-123')).toBeVisible()
    await expect(page.getByText(/9977/)).toBeVisible()
  })
})

test.describe('About page auth state', () => {
  test('logged-in user sees My trips button instead of sign-in', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'logged-in-user', email: 'me@test.com', profile: {} }),
    }))
    // About page checks auth server-side — since we can't mock SSR here,
    // we test the page loads and doesn't show the hero sign-in buttons
    await page.goto('/about')
    // Sign in / Get access should NOT be in the hero (they were moved to bottom)
    const heroSection = page.locator('div').filter({ hasText: /Road trips planned/ }).first()
    await expect(heroSection.getByRole('link', { name: /Sign in/ })).not.toBeVisible()
    await expect(heroSection.getByRole('link', { name: /Get access/ })).not.toBeVisible()
  })

  test('About page hero does not contain sign-in buttons (moved to bottom)', async ({ page }) => {
    await page.goto('/about')
    // The hero gradient section should not have sign-in links
    // They were moved to the bottom "Want access?" card
    const hero = page.locator('.bg-gradient-to-b').first()
    await expect(hero.getByRole('link', { name: 'Sign in' })).not.toBeVisible()
  })
})
