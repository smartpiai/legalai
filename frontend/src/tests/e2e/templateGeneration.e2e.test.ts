/**
 * E2E Tests for Template Generation Workflow
 * Following TDD - RED phase: Writing comprehensive E2E tests first
 * Tests the complete user journey for creating and generating contracts from templates
 */

import { test, expect, Page } from '@playwright/test';
import { setupMockServer } from '../utils/mockServer';
import { createTestTemplate, createTestUser, SAMPLE_CONTRACT_TEXT } from '../fixtures/testData';

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

async function navigateToTemplates(page: Page) {
  await page.click('nav >> text=Templates');
  await page.waitForURL(`${BASE_URL}/templates`);
}

describe('Template Generation E2E Workflow', () => {
  let mockServer: any;

  test.beforeAll(async () => {
    mockServer = await setupMockServer();
  });

  test.afterAll(async () => {
    await mockServer.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Template Creation and Management', () => {
    test('should create a new template from scratch', async ({ page }) => {
      // Arrange
      const testUser = createTestUser({
        permissions: ['templates.create', 'templates.write']
      });
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      // Step 1: Click create new template
      await page.click('button[data-testid="create-template"]');
      await page.waitForSelector('[data-testid="template-editor"]');

      // Step 2: Fill template metadata
      await page.fill('input[name="template_name"]', 'Service Level Agreement');
      await page.selectOption('select[name="category"]', 'service_agreements');
      await page.fill('textarea[name="description"]', 'Standard SLA template for service providers');
      
      // Step 3: Add template variables
      await page.click('button[data-testid="add-variable"]');
      await page.fill('input[name="variable_name"]', 'client_name');
      await page.selectOption('select[name="variable_type"]', 'text');
      await page.fill('input[name="variable_default"]', '');
      await page.click('button[data-testid="save-variable"]');

      await page.click('button[data-testid="add-variable"]');
      await page.fill('input[name="variable_name"]', 'service_level');
      await page.selectOption('select[name="variable_type"]', 'select');
      await page.fill('input[name="variable_options"]', 'Gold,Silver,Bronze');
      await page.click('button[data-testid="save-variable"]');

      // Step 4: Add template content with variables
      const templateContent = `
SERVICE LEVEL AGREEMENT

This Agreement is entered into between {{client_name}} ("Client") and {{company_name}} ("Provider").

Service Level: {{service_level}}

1. SERVICE AVAILABILITY
Provider guarantees {{availability_percentage}}% uptime for {{service_level}} tier services.

2. RESPONSE TIMES
- Critical Issues: {{critical_response_time}} hours
- Major Issues: {{major_response_time}} hours
- Minor Issues: {{minor_response_time}} hours
      `;
      
      await page.fill('[data-testid="template-content"]', templateContent);

      // Step 5: Add conditional clauses
      await page.click('button[data-testid="add-clause"]');
      await page.fill('input[name="clause_name"]', 'Premium Support');
      await page.fill('textarea[name="clause_content"]', 'Premium 24/7 support included');
      await page.fill('input[name="clause_condition"]', 'service_level == "Gold"');
      await page.click('button[data-testid="save-clause"]');

      // Step 6: Save template
      await page.click('button[data-testid="save-template"]');
      
      // Assert
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        'Template created successfully'
      );
      
      // Verify template appears in list
      await page.waitForURL(`${BASE_URL}/templates`);
      await expect(page.locator('text=Service Level Agreement')).toBeVisible();
    });

    test('should generate contract from template', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      const testTemplate = createTestTemplate({
        name: 'NDA Template',
        variables: {
          party_a: '',
          party_b: '',
          confidentiality_period: '2 years',
          governing_law: 'California'
        }
      });

      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      // Step 1: Select template
      await page.click(`[data-testid="template-${testTemplate.id}"]`);
      await page.click('button[data-testid="use-template"]');
      
      // Step 2: Fill variable values
      await page.waitForSelector('[data-testid="template-variables-form"]');
      await page.fill('input[name="party_a"]', 'Acme Corporation');
      await page.fill('input[name="party_b"]', 'Tech Solutions Inc');
      await page.fill('input[name="confidentiality_period"]', '3 years');
      await page.selectOption('select[name="governing_law"]', 'New York');

      // Step 3: Preview generated document
      await page.click('button[data-testid="preview-document"]');
      await page.waitForSelector('[data-testid="document-preview"]');
      
      // Assert preview shows correct values
      const previewContent = await page.locator('[data-testid="document-preview"]').textContent();
      expect(previewContent).toContain('Acme Corporation');
      expect(previewContent).toContain('Tech Solutions Inc');
      expect(previewContent).toContain('3 years');
      expect(previewContent).toContain('New York');

      // Step 4: Generate final document
      await page.click('button[data-testid="generate-contract"]');
      
      // Assert
      await page.waitForSelector('[data-testid="generation-success"]');
      await expect(page.locator('[data-testid="download-link"]')).toBeVisible();
      
      // Verify contract is created
      await page.click('[data-testid="view-contract"]');
      await page.waitForURL(/\/contracts\/[a-zA-Z0-9-]+/);
      await expect(page.locator('h1')).toContainText('NDA');
    });

    test('should validate template variables before generation', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Select a template with required variables
      await page.click('[data-testid="template-with-required-vars"]');
      await page.click('button[data-testid="use-template"]');

      // Act - Try to generate without filling required fields
      await page.click('button[data-testid="generate-contract"]');

      // Assert
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="party_a-error"]')).toContainText('Party A is required');
      await expect(page.locator('[data-testid="party_b-error"]')).toContainText('Party B is required');
      await expect(page.locator('button[data-testid="generate-contract"]')).toBeDisabled();

      // Fill required fields
      await page.fill('input[name="party_a"]', 'Company A');
      await page.fill('input[name="party_b"]', 'Company B');
      
      // Should now be able to generate
      await expect(page.locator('button[data-testid="generate-contract"]')).toBeEnabled();
    });

    test('should support template versioning', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      // Select existing template
      await page.click('[data-testid="template-with-versions"]');
      await page.click('button[data-testid="edit-template"]');

      // Make changes
      await page.fill('[data-testid="template-content"]', SAMPLE_CONTRACT_TEXT);
      
      // Save as new version
      await page.click('button[data-testid="save-as-version"]');
      await page.fill('input[name="version_notes"]', 'Updated payment terms and added arbitration clause');
      await page.click('button[data-testid="confirm-save-version"]');

      // Assert
      await expect(page.locator('[data-testid="version-saved"]')).toBeVisible();
      
      // Check version history
      await page.click('button[data-testid="view-versions"]');
      await expect(page.locator('[data-testid="version-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="version-2.0.0"]')).toBeVisible();
      await expect(page.locator('text=Updated payment terms')).toBeVisible();

      // Can switch between versions
      await page.click('[data-testid="version-1.0.0"]');
      await page.click('button[data-testid="use-this-version"]');
      await expect(page.locator('[data-testid="active-version"]')).toContainText('1.0.0');
    });

    test('should support template cloning', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      await page.click('[data-testid="template-to-clone"]');
      await page.click('button[data-testid="clone-template"]');
      
      // Modify cloned template
      await page.fill('input[name="template_name"]', 'Cloned Service Agreement');
      await page.fill('textarea[name="description"]', 'Customized version of standard agreement');
      await page.click('button[data-testid="save-template"]');

      // Assert
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Template cloned successfully');
      await page.waitForURL(`${BASE_URL}/templates`);
      await expect(page.locator('text=Cloned Service Agreement')).toBeVisible();
    });
  });

  test.describe('Clause Library Integration', () => {
    test('should insert clauses from library', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);
      
      // Create new template
      await page.click('button[data-testid="create-template"]');

      // Act
      // Open clause library
      await page.click('button[data-testid="insert-from-library"]');
      await page.waitForSelector('[data-testid="clause-library-modal"]');

      // Search for clause
      await page.fill('input[data-testid="search-clauses"]', 'confidentiality');
      await page.waitForSelector('[data-testid="clause-search-results"]');

      // Select clauses
      await page.click('[data-testid="clause-checkbox-1"]');
      await page.click('[data-testid="clause-checkbox-2"]');
      await page.click('button[data-testid="insert-selected-clauses"]');

      // Assert
      const editorContent = await page.locator('[data-testid="template-content"]').inputValue();
      expect(editorContent).toContain('CONFIDENTIALITY');
      expect(editorContent).toContain('proprietary information');
    });

    test('should support custom clause creation', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      await page.click('button[data-testid="manage-clauses"]');
      await page.click('button[data-testid="create-custom-clause"]');
      
      await page.fill('input[name="clause_title"]', 'Data Protection Clause');
      await page.selectOption('select[name="clause_category"]', 'compliance');
      await page.fill('textarea[name="clause_text"]', 
        'The parties shall comply with all applicable data protection laws including GDPR.');
      
      await page.click('button[data-testid="add-clause-variable"]');
      await page.fill('input[name="var_name"]', 'jurisdiction');
      await page.fill('input[name="var_default"]', 'European Union');
      
      await page.click('button[data-testid="save-clause"]');

      // Assert
      await expect(page.locator('[data-testid="clause-saved"]')).toBeVisible();
      await expect(page.locator('text=Data Protection Clause')).toBeVisible();
    });
  });

  test.describe('AI-Powered Features', () => {
    test('should suggest improvements to template content', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);
      
      await page.click('button[data-testid="create-template"]');
      await page.fill('[data-testid="template-content"]', 'This agreement is between party A and party B.');

      // Act
      await page.click('button[data-testid="ai-suggestions"]');
      await page.waitForSelector('[data-testid="suggestions-panel"]');

      // Assert
      await expect(page.locator('[data-testid="suggestion-1"]')).toContainText('Add specific party definitions');
      await expect(page.locator('[data-testid="suggestion-2"]')).toContainText('Include effective date');
      await expect(page.locator('[data-testid="suggestion-3"]')).toContainText('Add governing law clause');

      // Apply suggestion
      await page.click('[data-testid="apply-suggestion-1"]');
      const updatedContent = await page.locator('[data-testid="template-content"]').inputValue();
      expect(updatedContent).toContain('("Party A")');
      expect(updatedContent).toContain('("Party B")');
    });

    test('should auto-detect and extract variables from pasted content', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);
      
      await page.click('button[data-testid="create-template"]');

      // Act - Paste content with obvious variables
      const contentWithVariables = `
        This Agreement is between [COMPANY_NAME] and [CLIENT_NAME].
        The service fee is $[MONTHLY_FEE] per month.
        The contract term is [CONTRACT_DURATION] months.
      `;
      await page.fill('[data-testid="template-content"]', contentWithVariables);
      await page.click('button[data-testid="detect-variables"]');

      // Assert
      await page.waitForSelector('[data-testid="detected-variables"]');
      await expect(page.locator('[data-testid="var-COMPANY_NAME"]')).toBeVisible();
      await expect(page.locator('[data-testid="var-CLIENT_NAME"]')).toBeVisible();
      await expect(page.locator('[data-testid="var-MONTHLY_FEE"]')).toBeVisible();
      await expect(page.locator('[data-testid="var-CONTRACT_DURATION"]')).toBeVisible();

      // Confirm variable extraction
      await page.click('button[data-testid="confirm-variables"]');
      await expect(page.locator('[data-testid="variables-list"] >> text=COMPANY_NAME')).toBeVisible();
    });
  });

  test.describe('Multi-language Support', () => {
    test('should generate contracts in multiple languages', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Select multi-language template
      await page.click('[data-testid="template-multilang"]');
      await page.click('button[data-testid="use-template"]');

      // Act
      // Fill variables
      await page.fill('input[name="party_a"]', 'Global Corp');
      await page.fill('input[name="party_b"]', 'International Services');
      
      // Select language
      await page.selectOption('select[data-testid="output-language"]', 'spanish');
      
      // Generate preview
      await page.click('button[data-testid="preview-document"]');

      // Assert
      await page.waitForSelector('[data-testid="document-preview"]');
      const previewContent = await page.locator('[data-testid="document-preview"]').textContent();
      expect(previewContent).toContain('ACUERDO DE SERVICIO'); // Spanish for "Service Agreement"
      expect(previewContent).toContain('entre'); // Spanish for "between"
      
      // Switch to French
      await page.selectOption('select[data-testid="output-language"]', 'french');
      await page.click('button[data-testid="preview-document"]');
      
      const frenchContent = await page.locator('[data-testid="document-preview"]').textContent();
      expect(frenchContent).toContain('ACCORD DE SERVICE');
      expect(frenchContent).toContain('entre');
    });
  });

  test.describe('Collaboration Features', () => {
    test('should allow template sharing with team members', async ({ page }) => {
      // Arrange
      const testUser = createTestUser({ role: 'template_admin' });
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      await page.click('[data-testid="template-to-share"]');
      await page.click('button[data-testid="share-template"]');
      
      // Add team members
      await page.fill('input[data-testid="search-users"]', 'john');
      await page.click('[data-testid="user-john-doe"]');
      await page.selectOption('select[data-testid="permission-level"]', 'edit');
      
      await page.fill('input[data-testid="search-users"]', 'jane');
      await page.click('[data-testid="user-jane-smith"]');
      await page.selectOption('select[data-testid="permission-level"]', 'view');
      
      await page.click('button[data-testid="save-sharing"]');

      // Assert
      await expect(page.locator('[data-testid="sharing-saved"]')).toBeVisible();
      await expect(page.locator('[data-testid="shared-with-count"]')).toContainText('2');
    });

    test('should track template usage analytics', async ({ page }) => {
      // Arrange
      const testUser = createTestUser({ role: 'template_admin' });
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act
      await page.click('[data-testid="template-with-usage"]');
      await page.click('button[data-testid="view-analytics"]');

      // Assert
      await page.waitForSelector('[data-testid="template-analytics"]');
      await expect(page.locator('[data-testid="usage-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="popular-variables"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-generation-time"]')).toBeVisible();
    });
  });

  test.describe('Performance and Error Handling', () => {
    test('should handle large templates efficiently', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Create large template (50+ pages)
      await page.click('button[data-testid="create-template"]');
      const largeContent = SAMPLE_CONTRACT_TEXT.repeat(20); // ~50 pages
      
      // Act
      const startTime = Date.now();
      await page.fill('[data-testid="template-content"]', largeContent);
      await page.click('button[data-testid="save-template"]');
      
      // Assert
      const saveTime = Date.now() - startTime;
      expect(saveTime).toBeLessThan(5000); // Should save within 5 seconds
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('should handle template generation errors gracefully', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Simulate API error
      await page.route('**/api/v1/templates/generate', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Template generation failed' })
        });
      });

      // Act
      await page.click('[data-testid="template-any"]');
      await page.click('button[data-testid="use-template"]');
      await page.fill('input[name="party_a"]', 'Test Company');
      await page.click('button[data-testid="generate-contract"]');

      // Assert
      await expect(page.locator('[data-testid="generation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        'Failed to generate contract. Please try again.'
      );
      await expect(page.locator('button[data-testid="retry-generation"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Act - Navigate template creation with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Click create template
      
      await page.waitForSelector('[data-testid="template-editor"]');
      
      // Tab through form fields
      await page.keyboard.press('Tab');
      await page.keyboard.type('Keyboard Template');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown'); // Select category
      await page.keyboard.press('Enter');
      
      // Assert - Check focus management
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']).toContain(focusedElement);
    });

    test('should have proper ARIA labels for screen readers', async ({ page }) => {
      // Arrange
      const testUser = createTestUser();
      await loginUser(page, testUser.email, 'TestPassword123!');
      await navigateToTemplates(page);

      // Assert
      await expect(page.locator('button[data-testid="create-template"]')).toHaveAttribute(
        'aria-label',
        'Create new template'
      );
      await expect(page.locator('[data-testid="template-list"]')).toHaveAttribute(
        'role',
        'list'
      );
      await expect(page.locator('[data-testid="template-item"]').first()).toHaveAttribute(
        'role',
        'listitem'
      );
    });
  });
});