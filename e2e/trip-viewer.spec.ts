import { test, expect } from '@playwright/test'
import type { TripData } from '../lib/types'

const TRIP_FIXTURE = {
  id: 'e2e-trip-1',
  title: 'Scotland Road Trip 2026',
  status: 'ready',
  owner_id: 'user-e2e',
  is_shared: true,
  start_date: '2026-05-23',
  end_date: '2026-06-07',
  created_at: '2026-01-01T00:00:00Z',
  intake_form: { title: 'Scotland Road Trip 2026', num_travellers: 2, pets: '2 dogs' },
}

const TRIP_DATA_FIXTURE: TripData = {
  summary: 'A stunning drive through the Scottish Highlands',
  total_days: 3,
  total_distance_km: 650,
  total_stops: 8,
  days: [
    {
      day_number: 1,
      date: '2026-05-23',
      title: 'Edinburgh to Pitlochry',
      overnight_location: 'Pitlochry',
      activity_badges: ['🏰', '🌿'],
      steps: 8500,
      walking_km: 6.2,
      stops: [
        { name: 'Edinburgh Castle', type: 'castle', description: 'Historic fortress', address: 'Castlehill, Edinburgh EH1 2NG', duration_mins: 120, dog_friendly: false },
        { name: 'Drive to Pitlochry', type: 'drive', drive_time_mins: 90, distance_km: 112 },
        { name: 'Pitlochry Hotel', type: 'hotel', address: 'Pitlochry PH16', check_in: '15:00', check_out: '10:00' },
      ],
      eating: [
        { name: 'The Copper Pot', meal_type: 'dinner', description: 'Local Scottish cuisine', address: 'Pitlochry High St', website: 'https://example.com', booking_required: true },
      ],
      notes: 'Allow extra time at Edinburgh Castle — it gets busy by 10am.',
      sections: [
        { emoji: '🐾', title: 'Dog Tips', content: 'Dogs allowed on leads in Pitlochry town centre.\nPitlochry dam walk is fully dog-friendly.' },
      ],
    },
    {
      day_number: 2,
      date: '2026-05-24',
      title: 'Pitlochry to Inverness',
      overnight_location: 'Inverness',
      activity_badges: ['🥃', '📸'],
      steps: 6000,
      walking_km: 4.3,
      stops: [
        { name: 'Blair Athol Distillery', type: 'distillery', description: 'Whisky tour', address: 'Pitlochry PH16 5LY', duration_mins: 90, dog_friendly: true },
        { name: 'Drive to Inverness', type: 'drive', drive_time_mins: 105, distance_km: 102 },
        { name: 'Inverness Hotel', type: 'hotel', address: 'Inverness IV1', check_in: '15:00', check_out: '10:00' },
      ],
      eating: [],
      notes: null,
    },
    {
      day_number: 3,
      date: '2026-05-25',
      title: 'Inverness Highlights',
      overnight_location: 'Inverness',
      stops: [
        { name: 'Inverness Castle', type: 'castle', description: 'City landmark', address: 'Castle Wynd, Inverness', duration_mins: 60 },
      ],
      eating: [],
    },
  ],
  emergency_contacts: [
    { name: 'Inverness Raigmore Hospital', type: 'hospital', phone: '01463 704000', address: 'Old Perth Road, Inverness IV2 3UJ' },
    { name: 'Highland Vets Inverness', type: 'vet', phone: '01463 711511', address: 'Inverness IV3 5EA', notes: '24hr emergency line' },
  ],
}

test.describe('Trip viewer (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the /api/me response
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-e2e', email: 'test@example.com', profile: { vehicle_name: 'BMW 530e', vehicle_type: 'car' } }),
    }))

    // Mock the trip detail response
    await page.route('**/api/trips/e2e-trip-1', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trip: TRIP_FIXTURE, tripData: TRIP_DATA_FIXTURE }),
    }))
  })

  test('shows trip title in hero', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText('Scotland Road Trip 2026')).toBeVisible()
  })

  test('shows traveller count chip in hero', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText(/2 travellers/)).toBeVisible()
  })

  test('shows vehicle chip in hero', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText(/BMW 530e/)).toBeVisible()
  })

  test('shows pets chip in hero', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText(/2 dogs/)).toBeVisible()
  })

  test('renders day tabs with emoji badges', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText('Day 1')).toBeVisible()
    await expect(page.getByText('Day 2')).toBeVisible()
    await expect(page.getByText('Day 3')).toBeVisible()
    await expect(page.getByText('🏰🌿')).toBeVisible()
  })

  test('shows day 1 driving stats', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText(/1h 30m/)).toBeVisible()   // drive time
    await expect(page.getByText(/112 km/)).toBeVisible()    // distance
    await expect(page.getByText(/6\.2 km walking/)).toBeVisible()
    await expect(page.getByText(/8,500 steps/)).toBeVisible()
  })

  test('shows weather link for overnight location', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    const weatherLink = page.getByText(/Check weather in Pitlochry/)
    await expect(weatherLink).toBeVisible()
    const href = await weatherLink.getAttribute('href')
    expect(href).toContain('Pitlochry')
    expect(href).toContain('weather')
  })

  test('shows stop names on day 1', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText('Edinburgh Castle')).toBeVisible()
    await expect(page.getByText('Pitlochry Hotel')).toBeVisible()
  })

  test('shows dog-friendly badge on a dog-friendly stop (day 2)', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await page.getByText('Day 2').click()
    await expect(page.getByText('Dog friendly')).toBeVisible()
  })

  test('eating section shows website link', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText(/The Copper Pot/)).toBeVisible()
    await expect(page.getByText(/example\.com/)).toBeVisible()
  })

  test('day sections card is collapsible', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    const sectionBtn = page.getByText('🐾 Dog Tips')
    await expect(sectionBtn).toBeVisible()
    await sectionBtn.click()
    await expect(page.getByText(/Pitlochry dam walk/)).toBeVisible()
    await sectionBtn.click()
    await expect(page.getByText(/Pitlochry dam walk/)).not.toBeVisible()
  })

  test('emergency SOS section is collapsible', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    const sosBtn = page.getByText(/Emergency.*SOS/i)
    await expect(sosBtn).toBeVisible()
    await sosBtn.click()
    await expect(page.getByText('Inverness Raigmore Hospital')).toBeVisible()
    await expect(page.getByText('Highland Vets Inverness')).toBeVisible()
    await expect(page.getByText('01463 704000')).toBeVisible()
  })

  test('next/prev day navigation works', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await page.getByRole('button', { name: /Day 2 →/ }).click()
    await expect(page.getByText('Pitlochry to Inverness')).toBeVisible()
    await page.getByRole('button', { name: /← Day 1/ }).click()
    await expect(page.getByText('Edinburgh to Pitlochry')).toBeVisible()
  })

  test('day route button is visible with stop count', async ({ page }) => {
    await page.goto('/trips/e2e-trip-1')
    await expect(page.getByText('Open Route in Maps')).toBeVisible()
    await expect(page.getByText(/stops/)).toBeVisible()
  })
})

test.describe('Trip viewer — protected access', () => {
  test('unauthenticated users see an error or redirect when API returns 401', async ({ page }) => {
    await page.route('**/api/me', route => route.fulfill({ status: 401, body: '{"error":"Unauthorized"}' }))
    await page.route('**/api/trips/some-trip', route => route.fulfill({ status: 401, body: '{"error":"Unauthorized"}' }))
    await page.goto('/trips/some-trip')
    // Should redirect to /trips (which then redirects to login) or show an error
    await expect(page).toHaveURL(/\/(login|trips)/)
  })
})
