import { test, expect } from '@playwright/test'

test.describe('New trip form', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth so the page can render (it checks /api/me via server component)
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-e2e', email: 'test@example.com', profile: null }),
    }))
  })

  test('renders all required form fields', async ({ page }) => {
    await page.goto('/trips/new')
    await expect(page.getByPlaceholder(/Scotland/i)).toBeVisible()      // trip name
    await expect(page.getByPlaceholder(/Manchester/i)).toBeVisible()    // from
    await expect(page.getByPlaceholder(/Edinburgh/i)).toBeVisible()     // to
    await expect(page.getByText(/Generate itinerary/i)).toBeVisible()   // submit
  })

  test('renders pets field', async ({ page }) => {
    await page.goto('/trips/new')
    await expect(page.getByPlaceholder(/2 dogs/i)).toBeVisible()
  })

  test('renders interest toggles', async ({ page }) => {
    await page.goto('/trips/new')
    await expect(page.getByText('🏰 History')).toBeVisible()
    await expect(page.getByText('🌿 Nature')).toBeVisible()
    await expect(page.getByText('🍽️ Food & Drink')).toBeVisible()
  })

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.goto('/trips/new')
    await page.getByText(/Generate itinerary/i).click()
    await expect(page.getByText(/title/i)).toBeVisible()
  })

  test('shows validation error when end date is before start date', async ({ page }) => {
    await page.goto('/trips/new')
    await page.getByPlaceholder(/Scotland/i).fill('Test Trip')
    await page.getByPlaceholder(/Manchester/i).fill('London')
    await page.getByPlaceholder(/Edinburgh/i).fill('Bath')
    const inputs = page.locator('input[type="date"]')
    await inputs.nth(0).fill('2026-07-10')
    await inputs.nth(1).fill('2026-07-05')
    await page.getByText(/Generate itinerary/i).click()
    await expect(page.getByText(/end date/i)).toBeVisible()
  })

  test('interest buttons toggle active state', async ({ page }) => {
    await page.goto('/trips/new')
    const historyBtn = page.getByText('🏰 History')
    await historyBtn.click()
    await expect(historyBtn).toHaveClass(/border-brand-500/)
    await historyBtn.click()
    await expect(historyBtn).not.toHaveClass(/border-brand-500/)
  })
})
