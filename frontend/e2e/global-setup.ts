/**
 * Global setup for Playwright E2E tests
 * Sets up test environment, creates test data, and configures test users
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('Setting up E2E test environment...')

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Wait for backend to be available
    await waitForBackend(page)

    // Create test users if they don't exist
    await createTestUsers(page)

    // Set up test data
    await createTestData(page)

    console.log('E2E test environment setup complete')
  } catch (error) {
    console.error('Failed to set up E2E test environment:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function waitForBackend(page: any) {
  const maxRetries = 30
  const retryDelay = 2000

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.request.get('http://localhost:8000/health')
      if (response.ok()) {
        console.log('Backend is ready')
        return
      }
    } catch (error) {
      console.log(`Waiting for backend... attempt ${i + 1}/${maxRetries}`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error('Backend did not become available within timeout')
}

async function createTestUsers(page: any) {
  const testUsers = [
    {
      email: 'admin@legalai.com',
      password: 'admin123456',
      full_name: 'Admin User',
      is_superuser: true
    },
    {
      email: 'user1@tenant1.com',
      password: 'user123456',
      full_name: 'Test User 1',
      tenant_name: 'Tenant 1'
    },
    {
      email: 'user2@tenant2.com',
      password: 'user123456',
      full_name: 'Test User 2',
      tenant_name: 'Tenant 2'
    }
  ]

  for (const user of testUsers) {
    try {
      // Check if user exists
      const response = await page.request.post('http://localhost:8000/api/v1/auth/register', {
        data: user
      })
      
      if (response.ok()) {
        console.log(`Created test user: ${user.email}`)
      } else if (response.status() === 400) {
        console.log(`Test user already exists: ${user.email}`)
      } else {
        console.warn(`Failed to create user ${user.email}:`, await response.text())
      }
    } catch (error) {
      console.warn(`Error creating user ${user.email}:`, error)
    }
  }
}

async function createTestData(page: any) {
  // Create sample contracts, templates, etc.
  // This would make API calls to set up test data
  
  try {
    // Login as admin to create test data
    const loginResponse = await page.request.post('http://localhost:8000/api/v1/auth/login', {
      data: {
        username: 'admin@legalai.com',
        password: 'admin123456'
      }
    })

    if (loginResponse.ok()) {
      const authData = await loginResponse.json()
      const token = authData.access_token

      // Create test contracts
      await createTestContracts(page, token)
      
      // Create test templates
      await createTestTemplates(page, token)
      
      console.log('Test data created successfully')
    }
  } catch (error) {
    console.warn('Error creating test data:', error)
  }
}

async function createTestContracts(page: any, token: string) {
  const contracts = [
    {
      title: 'Sample Purchase Agreement',
      contract_type: 'purchase',
      description: 'Test contract for E2E testing',
      counterparty_name: 'Test Vendor Inc',
      value: 25000,
      status: 'active'
    },
    {
      title: 'NDA Template Contract',
      contract_type: 'nda',
      description: 'Non-disclosure agreement for testing',
      counterparty_name: 'Confidential Partner LLC',
      status: 'draft'
    }
  ]

  for (const contract of contracts) {
    try {
      const response = await page.request.post('http://localhost:8000/api/v1/contracts/', {
        data: contract,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok()) {
        console.log(`Created test contract: ${contract.title}`)
      } else {
        console.warn(`Failed to create contract ${contract.title}:`, await response.text())
      }
    } catch (error) {
      console.warn(`Error creating contract ${contract.title}:`, error)
    }
  }
}

async function createTestTemplates(page: any, token: string) {
  const templates = [
    {
      name: 'Basic Purchase Agreement Template',
      category: 'purchase',
      content: 'This agreement is between {{companyName}} and {{counterparty}} for the purchase of {{item}} valued at {{amount}}.',
      variables: ['companyName', 'counterparty', 'item', 'amount']
    },
    {
      name: 'Standard NDA Template',
      category: 'nda',
      content: 'Non-disclosure agreement between {{party1}} and {{party2}} effective {{startDate}}.',
      variables: ['party1', 'party2', 'startDate']
    }
  ]

  for (const template of templates) {
    try {
      const response = await page.request.post('http://localhost:8000/api/v1/templates/', {
        data: template,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok()) {
        console.log(`Created test template: ${template.name}`)
      } else {
        console.warn(`Failed to create template ${template.name}:`, await response.text())
      }
    } catch (error) {
      console.warn(`Error creating template ${template.name}:`, error)
    }
  }
}

export default globalSetup