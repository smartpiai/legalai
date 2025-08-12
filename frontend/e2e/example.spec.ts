/**
 * Example E2E test to validate setup
 * This is a simple test to ensure Playwright is working correctly
 */

import { test, expect } from '@playwright/test'

test.describe('Basic Setup Validation', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login')
    
    // Should have the correct title
    await expect(page).toHaveTitle(/Legal AI Platform/i)
    
    // Should show login form
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Should have proper form labels for accessibility
    await expect(page.locator('label')).toHaveCount.greaterThan(0)
    
    // Should not have any console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // Wait a bit to catch any async errors
    await page.waitForTimeout(1000)
    
    // Verify no critical errors (some warnings might be acceptable)
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('favicon')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })
  
  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/login')
    
    // Form should be visible and properly sized on mobile
    const loginForm = page.locator('form')
    await expect(loginForm).toBeVisible()
    
    // Input fields should be properly sized
    const emailInput = page.locator('input[name="email"]')
    const inputBox = await emailInput.boundingBox()
    
    expect(inputBox!.width).toBeLessThan(375) // Should fit within viewport
    expect(inputBox!.width).toBeGreaterThan(250) // Should be reasonably sized
  })
  
  test('should handle navigation', async ({ page }) => {
    await page.goto('/login')
    
    // Should be able to navigate to register page
    await page.click('text="Create Account"')
    await expect(page).toHaveURL('/register')
    
    // Should be able to navigate back to login
    await page.click('text="Sign In"')
    await expect(page).toHaveURL('/login')
    
    // Should be able to navigate to forgot password
    await page.click('text="Forgot Password"')
    await expect(page).toHaveURL('/forgot-password')
  })
  
  test('should validate form inputs', async ({ page }) => {
    await page.goto('/login')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should show HTML5 validation or custom validation messages
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    
    // Check for validation state (HTML5 or custom)
    const emailValid = await emailInput.evaluate((input: HTMLInputElement) => input.validity.valid)
    const passwordValid = await passwordInput.evaluate((input: HTMLInputElement) => input.validity.valid)
    
    expect(emailValid || passwordValid).toBe(false) // At least one should be invalid
    
    // Fill with invalid email
    await page.fill('input[name="email"]', 'invalid-email')
    await page.click('button[type="submit"]')
    
    const emailValidAfterInvalid = await emailInput.evaluate((input: HTMLInputElement) => input.validity.valid)
    expect(emailValidAfterInvalid).toBe(false)
  })
})