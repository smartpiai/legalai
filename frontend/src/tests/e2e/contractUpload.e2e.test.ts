/**
 * E2E Tests for Contract Upload Workflow
 * Following TDD - RED phase: Writing comprehensive E2E tests first
 * Tests the complete user journey from login to successful contract upload
 */

import { test, expect, Page } from '@playwright/test';
import { setupMockServer } from '../utils/mockServer';
import { createTestContract, createTestUser } from '../fixtures/testData';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';

// Helper functions
async function loginUser(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function navigateToContractUpload(page: Page) {
  await page.click('button[aria-label="Upload Document"]');
  await page.waitForSelector('[data-testid="upload-modal"]');
}

describe('Contract Upload E2E Workflow', () => {
  let mockServer: any;

  test.beforeAll(async () => {
    // Setup mock server for API responses
    mockServer = await setupMockServer();
  });

  test.afterAll(async () => {
    await mockServer.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clear cookies and local storage
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Complete Upload Workflow', () => {
    test('should successfully upload a valid contract document', async ({ page }) => {
      // Arrange
      const testUser = createTestUser({
        email: 'test@legalai.com',
        role: 'contract_manager',
        permissions: ['contracts.create', 'contracts.upload']
      });
      const testFile = 'test-contract.pdf';

      // Act & Assert

      // Step 1: Login
      await loginUser(page, testUser.email, 'TestPassword123!');
      expect(await page.locator('[data-testid="user-name"]').textContent()).toBe(testUser.name);

      // Step 2: Navigate to upload
      await navigateToContractUpload(page);
      expect(await page.locator('[data-testid="upload-modal"]').isVisible()).toBeTruthy();

      // Step 3: Select file
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: testFile,
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF content')
      });

      // Step 4: Fill metadata
      await page.fill('input[name="title"]', 'Service Agreement 2024');
      await page.selectOption('select[name="contract_type"]', 'service_agreement');
      await page.fill('input[name="parties"]', 'Acme Corp, Legal AI Inc');
      await page.fill('input[name="start_date"]', '2024-01-01');
      await page.fill('input[name="end_date"]', '2024-12-31');
      await page.fill('input[name="value"]', '100000');

      // Step 5: Submit upload
      await page.click('button[data-testid="upload-submit"]');

      // Step 6: Wait for processing
      await page.waitForSelector('[data-testid="upload-progress"]');
      expect(await page.locator('[data-testid="upload-status"]').textContent()).toContain('Uploading');

      // Step 7: Verify success
      await page.waitForSelector('[data-testid="upload-success"]', { timeout: 10000 });
      expect(await page.locator('[data-testid="success-message"]').textContent()).toContain(
        'Contract uploaded successfully'
      );

      // Step 8: Verify redirect to contract view
      await page.waitForURL(/\/contracts\/[a-zA-Z0-9-]+/, { timeout: 5000 });
      expect(await page.locator('h1').textContent()).toBe('Service Agreement 2024');
    });

    test('should validate file type and show error for invalid files', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('Executable content')
      });

      // Assert
      await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-error"]')).toContainText(
        'Invalid file type. Please upload PDF or DOCX files only.'
      );
      await expect(page.locator('button[data-testid="upload-submit"]')).toBeDisabled();
    });

    test('should validate file size and reject large files', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act - Upload file larger than 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-contract.pdf',
        mimeType: 'application/pdf',
        buffer: largeBuffer
      });

      // Assert
      await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-error"]')).toContainText(
        'File size exceeds 10MB limit'
      );
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Simulate network failure
      await page.route('**/api/v1/contracts/upload', route => {
        route.abort('failed');
      });

      // Act
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });

      await page.fill('input[name="title"]', 'Test Contract');
      await page.click('button[data-testid="upload-submit"]');

      // Assert
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText(
        'Failed to upload contract. Please try again.'
      );
      await expect(page.locator('button[data-testid="retry-upload"]')).toBeVisible();
    });

    test('should enforce multi-tenant isolation', async ({ page, context }) => {
      // Arrange - Login as Tenant A
      const tenantAUser = createTestUser({ 
        tenant_id: 'tenant-a',
        email: 'user@tenanta.com' 
      });
      await loginUser(page, tenantAUser.email, 'TestPassword123!');

      // Upload contract for Tenant A
      await navigateToContractUpload(page);
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'tenant-a-contract.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Tenant A contract')
      });
      await page.fill('input[name="title"]', 'Tenant A Contract');
      await page.click('button[data-testid="upload-submit"]');
      await page.waitForSelector('[data-testid="upload-success"]');

      // Get contract ID from URL
      const contractUrl = page.url();
      const contractId = contractUrl.split('/').pop();

      // Logout
      await page.click('button[aria-label="logout"]');

      // Login as Tenant B
      const tenantBUser = createTestUser({ 
        tenant_id: 'tenant-b',
        email: 'user@tenantb.com' 
      });
      await loginUser(page, tenantBUser.email, 'TestPassword123!');

      // Try to access Tenant A's contract
      await page.goto(`${BASE_URL}/contracts/${contractId}`);

      // Assert - Should show access denied
      await expect(page.locator('[data-testid="error-403"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        'Access denied'
      );
    });

    test('should show upload progress and allow cancellation', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Slow down upload to test progress
      await page.route('**/api/v1/contracts/upload', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        route.continue();
      });

      // Act
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });
      await page.fill('input[name="title"]', 'Test Contract');
      await page.click('button[data-testid="upload-submit"]');

      // Assert - Progress bar should be visible
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute(
        'aria-valuenow',
        /[0-9]+/
      );

      // Cancel upload
      await page.click('button[data-testid="cancel-upload"]');
      await expect(page.locator('[data-testid="upload-cancelled"]')).toBeVisible();
    });

    test('should validate required fields before upload', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act - Try to submit without required fields
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });
      await page.click('button[data-testid="upload-submit"]');

      // Assert - Should show validation errors
      await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="title-error"]')).toContainText(
        'Title is required'
      );
      await expect(page.locator('[data-testid="contract-type-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="parties-error"]')).toBeVisible();
    });

    test('should support drag and drop file upload', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act - Simulate drag and drop
      const dropZone = await page.locator('[data-testid="drop-zone"]');
      
      // Create a data transfer object
      await page.evaluate(() => {
        const dt = new DataTransfer();
        const file = new File(['PDF content'], 'test.pdf', { type: 'application/pdf' });
        dt.items.add(file);
        
        const dropEvent = new DragEvent('drop', {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true
        });
        
        document.querySelector('[data-testid="drop-zone"]')?.dispatchEvent(dropEvent);
      });

      // Assert
      await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-name"]')).toContainText('test.pdf');
    });

    test('should extract and display metadata after upload', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Mock extraction API
      await page.route('**/api/v1/extraction/extract', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            entities: {
              parties: ['Acme Corp', 'Legal AI Inc'],
              dates: {
                start_date: '2024-01-01',
                end_date: '2024-12-31'
              },
              value: 100000,
              clauses: ['Confidentiality', 'Termination', 'Payment Terms']
            }
          })
        });
      });

      // Act
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });
      await page.fill('input[name="title"]', 'Test Contract');
      await page.click('button[data-testid="extract-metadata"]');

      // Assert
      await expect(page.locator('[data-testid="extraction-loading"]')).toBeVisible();
      await page.waitForSelector('[data-testid="extraction-complete"]');
      
      // Verify extracted data is populated
      await expect(page.locator('input[name="parties"]')).toHaveValue('Acme Corp, Legal AI Inc');
      await expect(page.locator('input[name="start_date"]')).toHaveValue('2024-01-01');
      await expect(page.locator('input[name="end_date"]')).toHaveValue('2024-12-31');
      await expect(page.locator('input[name="value"]')).toHaveValue('100000');
    });

    test('should track upload analytics', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');

      // Intercept analytics calls
      const analyticsRequests: any[] = [];
      await page.route('**/api/v1/analytics/track', route => {
        analyticsRequests.push(route.request().postDataJSON());
        route.fulfill({ status: 200 });
      });

      // Act
      await navigateToContractUpload(page);
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });
      await page.fill('input[name="title"]', 'Test Contract');
      await page.click('button[data-testid="upload-submit"]');
      await page.waitForSelector('[data-testid="upload-success"]');

      // Assert
      expect(analyticsRequests).toHaveLength(2);
      expect(analyticsRequests[0].event).toBe('contract_upload_started');
      expect(analyticsRequests[1].event).toBe('contract_upload_completed');
      expect(analyticsRequests[1].properties).toHaveProperty('file_size');
      expect(analyticsRequests[1].properties).toHaveProperty('file_type', 'application/pdf');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act - Navigate using keyboard
      await page.keyboard.press('Tab'); // Focus on file input
      await page.keyboard.press('Enter'); // Open file dialog (simulated)
      
      // Set file programmatically since we can't interact with native dialog
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });

      await page.keyboard.press('Tab'); // Focus on title
      await page.keyboard.type('Test Contract');
      await page.keyboard.press('Tab'); // Focus on contract type
      await page.keyboard.press('ArrowDown'); // Open dropdown
      await page.keyboard.press('Enter'); // Select first option

      // Continue tabbing through fields
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }

      // Assert - Submit button should be focused
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedElement).toBe('upload-submit');
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Assert
      await expect(page.locator('input[type="file"]')).toHaveAttribute('aria-label', 'Choose contract file');
      await expect(page.locator('input[name="title"]')).toHaveAttribute('aria-required', 'true');
      await expect(page.locator('[data-testid="drop-zone"]')).toHaveAttribute('role', 'button');
      await expect(page.locator('[data-testid="drop-zone"]')).toHaveAttribute('aria-label', 'Drop files here or click to browse');
    });
  });

  test.describe('Performance', () => {
    test('should upload large files efficiently', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToContractUpload(page);

      // Act - Upload 9MB file (just under limit)
      const largeBuffer = Buffer.alloc(9 * 1024 * 1024);
      const startTime = Date.now();
      
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-contract.pdf',
        mimeType: 'application/pdf',
        buffer: largeBuffer
      });
      
      await page.fill('input[name="title"]', 'Large Contract');
      await page.click('button[data-testid="upload-submit"]');
      await page.waitForSelector('[data-testid="upload-success"]', { timeout: 30000 });
      
      const uploadTime = Date.now() - startTime;

      // Assert - Should complete within reasonable time
      expect(uploadTime).toBeLessThan(10000); // Less than 10 seconds
    });
  });
});