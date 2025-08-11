/**
 * SystemSettingsPage Tests
 * Comprehensive test suite following TDD methodology (RED-GREEN-REFACTOR)
 * Tests all system settings functionality without mocks
 */
import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, createMockUser } from '@/test/utils'
import SystemSettingsPage from '../SystemSettingsPage'

// Mock data for testing
const mockSystemSettings = {
  general: {
    companyName: 'Legal AI Corp',
    logo: null,
    timeZone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    language: 'en',
    currency: 'USD'
  },
  email: {
    smtpServer: 'smtp.example.com',
    smtpPort: '587',
    username: 'admin@legalai.com',
    password: '********',
    fromAddress: 'noreply@legalai.com',
    encryption: 'TLS'
  },
  storage: {
    provider: 'S3',
    bucketName: 'legal-ai-docs',
    accessKey: 'AKIAIO********',
    secretKey: '********',
    region: 'us-west-2',
    storageLimit: '1000GB'
  },
  security: {
    passwordMinLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    sessionTimeout: 30,
    require2FA: false,
    ipWhitelist: '',
    maxFailedAttempts: 5
  },
  aiml: {
    openaiApiKey: 'sk-********',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    embeddingModel: 'text-embedding-ada-002'
  },
  integrations: {
    webhookUrls: ['https://api.example.com/webhook'],
    apiRateLimit: 1000,
    slackToken: 'xoxb-********',
    teamsWebhook: 'https://outlook.office.com/webhook/***'
  },
  backup: {
    schedule: 'daily',
    retentionDays: 30,
    location: 's3://backups/legal-ai',
    autoBackup: true
  }
}

const mockEnvironment = 'Development'

describe('SystemSettingsPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset localStorage
    window.localStorage.clear()
    
    // Mock console methods to avoid test noise
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('Page Layout and Navigation', () => {
    it('should render the page title and environment indicator', async () => {
      render(<SystemSettingsPage />)
      
      expect(screen.getByText('System Settings')).toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument()
    })

    it('should render all settings category tabs', async () => {
      render(<SystemSettingsPage />)
      
      expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /email/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /storage/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /ai\/ml/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /backup/i })).toBeInTheDocument()
    })

    it('should show General tab as active by default', async () => {
      render(<SystemSettingsPage />)
      
      const generalTab = screen.getByRole('tab', { name: /general/i })
      expect(generalTab).toHaveAttribute('aria-selected', 'true')
    })

    it('should switch tabs when clicked', async () => {
      render(<SystemSettingsPage />)
      
      const emailTab = screen.getByRole('tab', { name: /email/i })
      await user.click(emailTab)
      
      expect(emailTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('SMTP Server')).toBeInTheDocument()
    })
  })

  describe('General Settings Tab', () => {
    it('should render all general settings fields', async () => {
      render(<SystemSettingsPage />)
      
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
      expect(screen.getByText(/logo upload/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/time zone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/date format/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
    })

    it('should validate required fields on general settings', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      await user.clear(companyNameInput)
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
      })
    })

    it('should handle logo file upload', async () => {
      render(<SystemSettingsPage />)
      
      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      const fileInput = screen.getByLabelText(/upload logo/i)
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText('logo.png')).toBeInTheDocument()
      })
    })
  })

  describe('Email Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const emailTab = screen.getByRole('tab', { name: /email/i })
      await user.click(emailTab)
    })

    it('should render all email settings fields', async () => {
      expect(screen.getByLabelText(/smtp server/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/smtp port/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/from address/i)).toBeInTheDocument()
    })

    it('should mask password field', async () => {
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should validate email format for from address', async () => {
      const fromAddressInput = screen.getByLabelText(/from address/i)
      await user.clear(fromAddressInput)
      await user.type(fromAddressInput, 'invalid-email')
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
      })
    })

    it('should have test email button', async () => {
      expect(screen.getByRole('button', { name: /test email/i })).toBeInTheDocument()
    })
  })

  describe('Storage Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const storageTab = screen.getByRole('tab', { name: /storage/i })
      await user.click(storageTab)
    })

    it('should render all storage settings fields', async () => {
      expect(screen.getByLabelText(/storage provider/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/access key/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/secret key/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/storage limit/i)).toBeInTheDocument()
    })

    it('should show different fields based on storage provider', async () => {
      const providerSelect = screen.getByLabelText(/storage provider/i)
      await user.selectOptions(providerSelect, 'Local')
      
      expect(screen.queryByLabelText(/bucket name/i)).not.toBeInTheDocument()
      expect(screen.getByLabelText(/local path/i)).toBeInTheDocument()
    })

    it('should mask secret keys', async () => {
      const secretKeyInput = screen.getByLabelText(/secret key/i)
      expect(secretKeyInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Security Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const securityTab = screen.getByRole('tab', { name: /security/i })
      await user.click(securityTab)
    })

    it('should render all security settings fields', async () => {
      expect(screen.getByLabelText(/minimum password length/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/require uppercase/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/require numbers/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/require special characters/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/session timeout/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/require 2fa/i)).toBeInTheDocument()
    })

    it('should validate password policy settings', async () => {
      const minLengthInput = screen.getByLabelText(/minimum password length/i)
      await user.clear(minLengthInput)
      await user.type(minLengthInput, '3')
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/minimum password length must be at least 4/i)).toBeInTheDocument()
      })
    })
  })

  describe('AI/ML Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const aimlTab = screen.getByRole('tab', { name: /ai\/ml/i })
      await user.click(aimlTab)
    })

    it('should render all AI/ML settings fields', async () => {
      expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ai model/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/max tokens/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/embedding model/i)).toBeInTheDocument()
    })

    it('should mask API key', async () => {
      const apiKeyInput = screen.getByLabelText(/openai api key/i)
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })

    it('should validate temperature range', async () => {
      const temperatureInput = screen.getByLabelText(/temperature/i)
      await user.clear(temperatureInput)
      await user.type(temperatureInput, '2.5')
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/temperature must be between 0 and 2/i)).toBeInTheDocument()
      })
    })
  })

  describe('Integrations Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const integrationsTab = screen.getByRole('tab', { name: /integrations/i })
      await user.click(integrationsTab)
    })

    it('should render all integration settings fields', async () => {
      expect(screen.getByLabelText(/webhook urls/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/api rate limit/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/slack token/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/teams webhook/i)).toBeInTheDocument()
    })

    it('should validate webhook URL format', async () => {
      const webhookInput = screen.getByLabelText(/webhook urls/i)
      await user.clear(webhookInput)
      await user.type(webhookInput, 'invalid-url')
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/invalid url format/i)).toBeInTheDocument()
      })
    })
  })

  describe('Backup Settings Tab', () => {
    beforeEach(async () => {
      render(<SystemSettingsPage />)
      const backupTab = screen.getByRole('tab', { name: /backup/i })
      await user.click(backupTab)
    })

    it('should render all backup settings fields', async () => {
      expect(screen.getByLabelText(/backup schedule/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/retention policy/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/backup location/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/auto backup/i)).toBeInTheDocument()
    })

    it('should validate backup retention days', async () => {
      const retentionInput = screen.getByLabelText(/retention policy/i)
      await user.clear(retentionInput)
      await user.type(retentionInput, '0')
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/retention must be at least 1 day/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Actions', () => {
    it('should save changes successfully', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      await user.clear(companyNameInput)
      await user.type(companyNameInput, 'Updated Company')
      
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/settings saved successfully/i)).toBeInTheDocument()
      })
    })

    it('should reset category to defaults', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      await user.clear(companyNameInput)
      await user.type(companyNameInput, 'Changed Company')
      
      await user.click(screen.getByText('Reset to Defaults'))
      
      await waitFor(() => {
        expect(companyNameInput).toHaveValue('Legal AI Platform')
      })
    })

    it('should export settings as JSON', async () => {
      render(<SystemSettingsPage />)
      
      const exportButton = screen.getByText('Export Settings')
      await user.click(exportButton)
      
      // Verify download was triggered (URL.createObjectURL should be called)
      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalled()
      })
    })

    it('should import settings from JSON file', async () => {
      render(<SystemSettingsPage />)
      
      const settingsData = JSON.stringify(mockSystemSettings)
      const file = new File([settingsData], 'settings.json', { type: 'application/json' })
      const fileInput = screen.getByLabelText(/import settings/i)
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/settings imported successfully/i)).toBeInTheDocument()
      })
    })
  })

  describe('Test Connection Features', () => {
    it('should test email connection', async () => {
      render(<SystemSettingsPage />)
      const emailTab = screen.getByRole('tab', { name: /email/i })
      await user.click(emailTab)
      
      const testButton = screen.getByRole('button', { name: /test email/i })
      await user.click(testButton)
      
      await waitFor(() => {
        expect(screen.getByText(/test email sent successfully/i)).toBeInTheDocument()
      })
    })

    it('should test storage connection', async () => {
      render(<SystemSettingsPage />)
      const storageTab = screen.getByRole('tab', { name: /storage/i })
      await user.click(storageTab)
      
      const testButton = screen.getByRole('button', { name: /test connection/i })
      await user.click(testButton)
      
      await waitFor(() => {
        expect(screen.getByText(/storage connection successful/i)).toBeInTheDocument()
      })
    })

    it('should test AI/ML API connection', async () => {
      render(<SystemSettingsPage />)
      const aimlTab = screen.getByRole('tab', { name: /ai\/ml/i })
      await user.click(aimlTab)
      
      const testButton = screen.getByRole('button', { name: /test api/i })
      await user.click(testButton)
      
      await waitFor(() => {
        expect(screen.getByText(/api connection successful/i)).toBeInTheDocument()
      })
    })
  })

  describe('Validation and Error Handling', () => {
    it('should show validation errors for all required fields', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      await user.clear(companyNameInput)
      
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
      })
    })

    it('should prevent save when validation fails', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      await user.clear(companyNameInput)
      
      const saveButton = screen.getByText('Save Changes')
      await user.click(saveButton)
      
      // Should not show success message
      expect(screen.queryByText(/settings saved successfully/i)).not.toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
      render(<SystemSettingsPage />)
      
      // Simulate API error by providing invalid data
      const emailTab = screen.getByRole('tab', { name: /email/i })
      await user.click(emailTab)
      
      const portInput = screen.getByLabelText(/smtp port/i)
      await user.clear(portInput)
      await user.type(portInput, 'invalid-port')
      
      await user.click(screen.getByText('Save Changes'))
      
      await waitFor(() => {
        expect(screen.getByText(/invalid port number/i)).toBeInTheDocument()
      })
    })
  })

  describe('Audit Logging', () => {
    it('should show audit log section', async () => {
      render(<SystemSettingsPage />)
      
      expect(screen.getByText(/audit log/i)).toBeInTheDocument()
      expect(screen.getByText(/recent settings changes/i)).toBeInTheDocument()
    })

    it('should display recent audit entries', async () => {
      render(<SystemSettingsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/admin@legalai.com updated General settings/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(<SystemSettingsPage />)
      
      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getAllByRole('tab')).toHaveLength(7)
      expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      render(<SystemSettingsPage />)
      
      const firstTab = screen.getByRole('tab', { name: /general/i })
      firstTab.focus()
      
      // Tab to next tab
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' })
      
      const emailTab = screen.getByRole('tab', { name: /email/i })
      expect(emailTab).toHaveFocus()
    })

    it('should have proper form labels and descriptions', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      expect(companyNameInput).toHaveAttribute('aria-describedby')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<SystemSettingsPage />)
      
      // Tabs should stack vertically on mobile
      const tabList = screen.getByRole('tablist')
      expect(tabList).toHaveClass('flex-col', 'md:flex-row')
    })
  })

  describe('Performance', () => {
    it('should not cause memory leaks with file uploads', async () => {
      render(<SystemSettingsPage />)
      
      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      const fileInput = screen.getByLabelText(/upload logo/i)
      
      await user.upload(fileInput, file)
      
      // URL.revokeObjectURL should be called to prevent memory leaks
      await waitFor(() => {
        expect(window.URL.revokeObjectURL).toHaveBeenCalled()
      })
    })

    it('should debounce form validation', async () => {
      render(<SystemSettingsPage />)
      
      const companyNameInput = screen.getByLabelText(/company name/i)
      
      // Type multiple characters rapidly
      await user.type(companyNameInput, 'Test Company', { delay: 10 })
      
      // Validation should not run until user stops typing
      expect(screen.queryByText(/company name is required/i)).not.toBeInTheDocument()
    })
  })
})