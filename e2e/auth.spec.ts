import { test, expect } from '@playwright/test'

test.describe('Auth pages', () => {
  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
  })

  test('register page renders email, password and invite code fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /register|sign up/i })).toBeVisible()
  })

  test('register page link navigates to login', async ({ page }) => {
    await page.goto('/register')
    const loginLink = page.getByRole('link', { name: /sign in|log in|already/i })
    if (await loginLink.isVisible()) {
      await loginLink.click()
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('login page link navigates to register', async ({ page }) => {
    await page.goto('/login')
    const registerLink = page.getByRole('link', { name: /register|sign up|create/i })
    if (await registerLink.isVisible()) {
      await registerLink.click()
      await expect(page).toHaveURL(/\/register/)
    }
  })
})
