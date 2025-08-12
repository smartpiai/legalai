/**
 * Global teardown for Playwright E2E tests
 * Cleans up test data and resets test environment
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('Cleaning up E2E test environment...')

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Clean up test data
    await cleanupTestData(page)

    // Reset test users (optional - might want to keep for next run)
    // await cleanupTestUsers(page)

    console.log('E2E test environment cleanup complete')
  } catch (error) {
    console.error('Failed to clean up E2E test environment:', error)
  } finally {
    await browser.close()
  }
}

async function cleanupTestData(page: any) {
  try {
    // Login as admin to clean up test data
    const loginResponse = await page.request.post('http://localhost:8000/api/v1/auth/login', {
      data: {
        username: 'admin@legalai.com',
        password: 'admin123456'
      }
    })

    if (loginResponse.ok()) {
      const authData = await loginResponse.json()
      const token = authData.access_token

      // Clean up test contracts
      await cleanupTestContracts(page, token)
      
      // Clean up test templates
      await cleanupTestTemplates(page, token)
      
      // Clean up test workflows
      await cleanupTestWorkflows(page, token)
      
      console.log('Test data cleanup completed')
    }
  } catch (error) {
    console.warn('Error during test data cleanup:', error)
  }
}

async function cleanupTestContracts(page: any, token: string) {
  try {
    // Get all contracts
    const response = await page.request.get('http://localhost:8000/api/v1/contracts/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok()) {
      const contracts = await response.json()
      
      // Delete test contracts (those with E2E in title or created for testing)
      for (const contract of contracts.data || contracts) {
        if (contract.title?.includes('E2E') || 
            contract.title?.includes('Test') || 
            contract.title?.includes('Sample')) {
          
          await page.request.delete(`http://localhost:8000/api/v1/contracts/${contract.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          console.log(`Deleted test contract: ${contract.title}`)
        }
      }
    }
  } catch (error) {
    console.warn('Error cleaning up test contracts:', error)
  }
}

async function cleanupTestTemplates(page: any, token: string) {
  try {
    // Get all templates
    const response = await page.request.get('http://localhost:8000/api/v1/templates/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok()) {
      const templates = await response.json()
      
      // Delete test templates
      for (const template of templates.data || templates) {
        if (template.name?.includes('E2E') || 
            template.name?.includes('Test') || 
            template.name?.includes('Basic') ||
            template.name?.includes('Standard')) {
          
          await page.request.delete(`http://localhost:8000/api/v1/templates/${template.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          console.log(`Deleted test template: ${template.name}`)
        }
      }
    }
  } catch (error) {
    console.warn('Error cleaning up test templates:', error)
  }
}

async function cleanupTestWorkflows(page: any, token: string) {
  try {
    // Get all workflows
    const response = await page.request.get('http://localhost:8000/api/v1/workflows/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok()) {
      const workflows = await response.json()
      
      // Delete test workflows
      for (const workflow of workflows.data || workflows) {
        if (workflow.name?.includes('E2E') || 
            workflow.name?.includes('Test')) {
          
          await page.request.delete(`http://localhost:8000/api/v1/workflows/${workflow.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          console.log(`Deleted test workflow: ${workflow.name}`)
        }
      }
    }
  } catch (error) {
    console.warn('Error cleaning up test workflows:', error)
  }
}

async function cleanupTestUsers(page: any) {
  // Optional: Clean up test users
  // Usually better to keep them for faster subsequent test runs
  console.log('Keeping test users for next run...')
}

export default globalTeardown