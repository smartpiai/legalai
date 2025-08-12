/**
 * TenantsManagementPage Test Suite - TDD Implementation
 * Following Red-Green-Refactor methodology
 * 
 * Tests for all tenant management requirements:
 * - Display list of tenants in a table
 * - Create new tenant form
 * - Edit tenant functionality
 * - Delete tenant with confirmation
 * - Tenant details view
 * - Search, filter, and sort functionality
 * - Bulk operations
 * - Storage usage visualization
 * - Billing/subscription management
 * - Tenant-specific settings
 * - Export tenant data
 * - Audit log of tenant changes
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import TenantsManagementPage from '../TenantsManagementPage'

// Mock tenant data for testing
const mockTenants = [
  {
    id: '1',
    name: 'Acme Corporation',
    subdomain: 'acme',
    adminEmail: 'admin@acme.com',
    plan: 'Enterprise',
    status: 'Active',
    usersCount: 250,
    storageUsed: 15.7, // GB
    storageLimit: 50, // GB
    createdAt: '2024-01-15T10:00:00Z',
    nextBillingDate: '2024-02-15T00:00:00Z',
    customBranding: true,
    apiLimitsPerHour: 10000,
    features: {
      aiAnalysis: true,
      bulkOperations: true,
      customIntegrations: true,
      advancedReporting: true
    }
  },
  {
    id: '2',
    name: 'TechStart Inc',
    subdomain: 'techstart',
    adminEmail: 'admin@techstart.com',
    plan: 'Professional',
    status: 'Active',
    usersCount: 89,
    storageUsed: 8.2,
    storageLimit: 25,
    createdAt: '2024-01-20T14:30:00Z',
    nextBillingDate: '2024-02-20T00:00:00Z',
    customBranding: false,
    apiLimitsPerHour: 5000,
    features: {
      aiAnalysis: true,
      bulkOperations: false,
      customIntegrations: false,
      advancedReporting: true
    }
  },
  {
    id: '3',
    name: 'Legal Firm LLC',
    subdomain: 'legalfirm',
    adminEmail: 'admin@legalfirm.com',
    plan: 'Starter',
    status: 'Suspended',
    usersCount: 25,
    storageUsed: 2.1,
    storageLimit: 10,
    createdAt: '2024-02-01T09:15:00Z',
    nextBillingDate: '2024-03-01T00:00:00Z',
    customBranding: false,
    apiLimitsPerHour: 1000,
    features: {
      aiAnalysis: false,
      bulkOperations: false,
      customIntegrations: false,
      advancedReporting: false
    }
  }
]

const mockAuditLog = [
  {
    id: '1',
    tenantId: '1',
    action: 'Plan upgraded',
    adminUser: 'superadmin@platform.com',
    timestamp: '2024-01-20T15:30:00Z',
    details: 'Upgraded from Professional to Enterprise plan'
  },
  {
    id: '2',
    tenantId: '2',
    action: 'Storage limit increased',
    adminUser: 'admin@platform.com',
    timestamp: '2024-01-22T10:45:00Z',
    details: 'Storage limit increased from 20GB to 25GB'
  }
]

const mockPaymentHistory = [
  {
    id: '1',
    tenantId: '1',
    amount: 299.99,
    date: '2024-01-15T00:00:00Z',
    status: 'Paid',
    invoiceNumber: 'INV-2024-001'
  },
  {
    id: '2',
    tenantId: '2',
    amount: 99.99,
    date: '2024-01-20T00:00:00Z',
    status: 'Paid',
    invoiceNumber: 'INV-2024-002'
  }
]

// Mock API calls
const mockFetchTenants = vi.fn(() => Promise.resolve(mockTenants))
const mockCreateTenant = vi.fn(() => Promise.resolve({ id: '4', ...mockTenants[0] }))
const mockUpdateTenant = vi.fn(() => Promise.resolve({ success: true }))
const mockDeleteTenant = vi.fn(() => Promise.resolve({ success: true }))
const mockFetchTenantDetails = vi.fn((id) => Promise.resolve(mockTenants.find(t => t.id === id)))
const mockSearchTenants = vi.fn(() => Promise.resolve(mockTenants))
const mockExportTenantData = vi.fn(() => Promise.resolve(new Blob(['export data'], { type: 'application/json' })))
const mockFetchAuditLog = vi.fn(() => Promise.resolve(mockAuditLog))
const mockFetchPaymentHistory = vi.fn(() => Promise.resolve(mockPaymentHistory))

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
}

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('TenantsManagementPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  describe('Tenant List Display', () => {
    it('should display tenants table with all columns', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('tenants-table')).toBeInTheDocument()
        
        // Check table headers
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('Subdomain')).toBeInTheDocument()
        expect(screen.getByText('Plan')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Users')).toBeInTheDocument()
        expect(screen.getByText('Storage')).toBeInTheDocument()
        expect(screen.getByText('Created')).toBeInTheDocument()
      })
    })

    it('should display tenant data in table rows', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
        expect(screen.getByText('acme.platform.com')).toBeInTheDocument()
        expect(screen.getByText('Enterprise')).toBeInTheDocument()
        expect(screen.getByTestId('tenant-status-Active-1')).toBeInTheDocument()
        expect(screen.getByText('250')).toBeInTheDocument()
        expect(screen.getByText('15.7 GB / 50 GB')).toBeInTheDocument()
      })
    })

    it('should display storage usage bar for each tenant', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-bar-1')).toBeInTheDocument()
        expect(screen.getByTestId('storage-bar-2')).toBeInTheDocument()
        
        // Check storage percentage calculation
        const storageBar1 = screen.getByTestId('storage-bar-1').querySelector('.bg-blue-600')
        expect(storageBar1).toHaveStyle('width: 31.4%') // 15.7/50 * 100
      })
    })

    it('should show suspended status with different styling', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        const suspendedStatus = screen.getByTestId('tenant-status-Suspended-3')
        expect(suspendedStatus).toBeInTheDocument()
        expect(suspendedStatus).toHaveClass('text-red-700')
      })
    })
  })

  describe('Create New Tenant Form', () => {
    it('should display create tenant button', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('create-tenant-button')).toBeInTheDocument()
        expect(screen.getByText('Create Tenant')).toBeInTheDocument()
      })
    })

    it('should open create tenant modal when button clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('create-tenant-modal')).toBeInTheDocument()
        expect(screen.getByText('Create New Tenant')).toBeInTheDocument()
      })
    })

    it('should display all required form fields', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('company-name-input')).toBeInTheDocument()
        expect(screen.getByTestId('subdomain-input')).toBeInTheDocument()
        expect(screen.getByTestId('admin-email-input')).toBeInTheDocument()
        expect(screen.getByTestId('plan-select')).toBeInTheDocument()
        expect(screen.getByTestId('storage-limit-input')).toBeInTheDocument()
      })
    })

    it('should validate form fields before submission', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        const submitButton = screen.getByTestId('submit-create-tenant')
        await user.click(submitButton)
        
        // Should show validation errors
        expect(screen.getByText('Company name is required')).toBeInTheDocument()
        expect(screen.getByText('Subdomain is required')).toBeInTheDocument()
        expect(screen.getByText('Admin email is required')).toBeInTheDocument()
      })
    })

    it('should create tenant with valid data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        // Fill form
        await user.type(screen.getByTestId('company-name-input'), 'New Company')
        await user.type(screen.getByTestId('subdomain-input'), 'newcompany')
        await user.type(screen.getByTestId('admin-email-input'), 'admin@newcompany.com')
        await user.selectOptions(screen.getByTestId('plan-select'), 'Professional')
        await user.type(screen.getByTestId('storage-limit-input'), '25')
        
        const submitButton = screen.getByTestId('submit-create-tenant')
        await user.click(submitButton)
        
        expect(mockCreateTenant).toHaveBeenCalledWith({
          name: 'New Company',
          subdomain: 'newcompany',
          adminEmail: 'admin@newcompany.com',
          plan: 'Professional',
          storageLimit: 25
        })
      })
    })

    it('should validate subdomain uniqueness', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        await user.type(screen.getByTestId('subdomain-input'), 'acme') // Existing subdomain
        
        expect(screen.getByText('Subdomain already exists')).toBeInTheDocument()
      })
    })
  })

  describe('Edit Tenant Functionality', () => {
    it('should open edit modal when edit button clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-tenant-1')
        await user.click(editButton)
        
        expect(screen.getByTestId('edit-tenant-modal')).toBeInTheDocument()
        expect(screen.getByText('Edit Tenant')).toBeInTheDocument()
      })
    })

    it('should pre-populate form with tenant data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-tenant-1')
        await user.click(editButton)
        
        expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Enterprise')).toBeInTheDocument()
        expect(screen.getByDisplayValue('50')).toBeInTheDocument() // Storage limit
      })
    })

    it('should update tenant when form submitted', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-tenant-1')
        await user.click(editButton)
        
        // Change plan
        await user.selectOptions(screen.getByTestId('edit-plan-select'), 'Professional')
        
        const submitButton = screen.getByTestId('submit-edit-tenant')
        await user.click(submitButton)
        
        expect(mockUpdateTenant).toHaveBeenCalledWith('1', expect.objectContaining({
          plan: 'Professional'
        }))
      })
    })

    it('should allow changing tenant status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-tenant-1')
        await user.click(editButton)
        
        await user.selectOptions(screen.getByTestId('edit-status-select'), 'Suspended')
        
        const submitButton = screen.getByTestId('submit-edit-tenant')
        await user.click(submitButton)
        
        expect(mockUpdateTenant).toHaveBeenCalledWith('1', expect.objectContaining({
          status: 'Suspended'
        }))
      })
    })
  })

  describe('Delete Tenant with Confirmation', () => {
    it('should show delete button for each tenant', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-tenant-1')).toBeInTheDocument()
        expect(screen.getByTestId('delete-tenant-2')).toBeInTheDocument()
        expect(screen.getByTestId('delete-tenant-3')).toBeInTheDocument()
      })
    })

    it('should show confirmation dialog when delete clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-tenant-1')
        await user.click(deleteButton)
        
        expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument()
        expect(screen.getByText('Delete Tenant')).toBeInTheDocument()
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      })
    })

    it('should show data retention warning in confirmation', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-tenant-1')
        await user.click(deleteButton)
        
        expect(screen.getByText(/data will be retained for 30 days/)).toBeInTheDocument()
      })
    })

    it('should delete tenant when confirmed', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-tenant-1')
        await user.click(deleteButton)
        
        const confirmButton = screen.getByTestId('confirm-delete-tenant')
        await user.click(confirmButton)
        
        expect(mockDeleteTenant).toHaveBeenCalledWith('1')
      })
    })

    it('should cancel deletion when cancel clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-tenant-1')
        await user.click(deleteButton)
        
        const cancelButton = screen.getByTestId('cancel-delete-tenant')
        await user.click(cancelButton)
        
        expect(screen.queryByTestId('delete-confirmation-dialog')).not.toBeInTheDocument()
        expect(mockDeleteTenant).not.toHaveBeenCalled()
      })
    })
  })

  describe('Tenant Details View', () => {
    it('should open details view when tenant name clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('tenant-details-modal')).toBeInTheDocument()
        expect(screen.getByText('Tenant Details')).toBeInTheDocument()
      })
    })

    it('should display tenant statistics in details view', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('tenant-stats')).toBeInTheDocument()
        expect(screen.getByText('250')).toBeInTheDocument() // Users count
        expect(screen.getByText('15.7 GB')).toBeInTheDocument() // Storage used
      })
    })

    it('should display billing information', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('billing-info')).toBeInTheDocument()
        expect(screen.getByText('Enterprise')).toBeInTheDocument()
        expect(screen.getByText('Next billing: Feb 15, 2024')).toBeInTheDocument()
      })
    })

    it('should display payment history', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('payment-history')).toBeInTheDocument()
        expect(screen.getByText('$299.99')).toBeInTheDocument()
        expect(screen.getByText('INV-2024-001')).toBeInTheDocument()
      })
    })

    it('should display storage usage chart', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('usage-chart')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should display search input', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('tenant-search-input')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search tenants...')).toBeInTheDocument()
      })
    })

    it('should search tenants by name', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('tenant-search-input')
        await user.type(searchInput, 'Acme')
        
        expect(mockSearchTenants).toHaveBeenCalledWith('Acme')
      })
    })

    it('should search tenants by subdomain', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('tenant-search-input')
        await user.type(searchInput, 'acme.platform.com')
        
        expect(mockSearchTenants).toHaveBeenCalledWith('acme.platform.com')
      })
    })

    it('should search tenants by admin email', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('tenant-search-input')
        await user.type(searchInput, 'admin@acme.com')
        
        expect(mockSearchTenants).toHaveBeenCalledWith('admin@acme.com')
      })
    })

    it('should clear search results', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('tenant-search-input')
        await user.type(searchInput, 'test')
        await user.clear(searchInput)
        
        expect(mockFetchTenants).toHaveBeenCalled()
      })
    })
  })

  describe('Filter Functionality', () => {
    it('should display filter controls', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument()
        expect(screen.getByTestId('plan-filter')).toBeInTheDocument()
        expect(screen.getByTestId('date-range-filter')).toBeInTheDocument()
        expect(screen.getByTestId('storage-usage-filter')).toBeInTheDocument()
      })
    })

    it('should filter by status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const statusFilter = screen.getByTestId('status-filter')
        await user.selectOptions(statusFilter, 'Active')
        
        // Should show only active tenants
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
        expect(screen.getByText('TechStart Inc')).toBeInTheDocument()
        expect(screen.queryByText('Legal Firm LLC')).not.toBeInTheDocument()
      })
    })

    it('should filter by plan type', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const planFilter = screen.getByTestId('plan-filter')
        await user.selectOptions(planFilter, 'Enterprise')
        
        // Should show only enterprise tenants
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
        expect(screen.queryByText('TechStart Inc')).not.toBeInTheDocument()
      })
    })

    it('should filter by creation date range', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const dateRangeFilter = screen.getByTestId('date-range-filter')
        await user.click(dateRangeFilter)
        
        expect(screen.getByTestId('date-picker-start')).toBeInTheDocument()
        expect(screen.getByTestId('date-picker-end')).toBeInTheDocument()
      })
    })

    it('should filter by storage usage', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const storageFilter = screen.getByTestId('storage-usage-filter')
        await user.selectOptions(storageFilter, 'high') // >80% usage
        
        // Should filter based on storage usage percentage
        expect(screen.getByTestId('filtered-results')).toBeInTheDocument()
      })
    })

    it('should clear all filters', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const clearFiltersButton = screen.getByTestId('clear-filters')
        await user.click(clearFiltersButton)
        
        // Should reset all filters to default
        expect(screen.getByTestId('status-filter')).toHaveValue('')
        expect(screen.getByTestId('plan-filter')).toHaveValue('')
      })
    })
  })

  describe('Sort Functionality', () => {
    it('should display sort controls', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('sort-by-select')).toBeInTheDocument()
        expect(screen.getByTestId('sort-direction-toggle')).toBeInTheDocument()
      })
    })

    it('should sort by name', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-by-select')
        await user.selectOptions(sortSelect, 'name')
        
        expect(screen.getByTestId('sorted-results')).toBeInTheDocument()
      })
    })

    it('should sort by created date', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-by-select')
        await user.selectOptions(sortSelect, 'createdAt')
        
        expect(screen.getByTestId('sorted-results')).toBeInTheDocument()
      })
    })

    it('should sort by users count', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-by-select')
        await user.selectOptions(sortSelect, 'usersCount')
        
        expect(screen.getByTestId('sorted-results')).toBeInTheDocument()
      })
    })

    it('should sort by storage usage', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-by-select')
        await user.selectOptions(sortSelect, 'storageUsed')
        
        expect(screen.getByTestId('sorted-results')).toBeInTheDocument()
      })
    })

    it('should toggle sort direction', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const sortDirection = screen.getByTestId('sort-direction-toggle')
        await user.click(sortDirection)
        
        expect(screen.getByTestId('sort-desc')).toBeInTheDocument()
      })
    })
  })

  describe('Bulk Operations', () => {
    it('should display bulk operations bar when tenants selected', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('tenant-checkbox-1')
        await user.click(checkbox1)
        
        expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument()
        expect(screen.getByText('1 tenant selected')).toBeInTheDocument()
      })
    })

    it('should select multiple tenants', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('tenant-checkbox-1')
        const checkbox2 = screen.getByTestId('tenant-checkbox-2')
        
        await user.click(checkbox1)
        await user.click(checkbox2)
        
        expect(screen.getByText('2 tenants selected')).toBeInTheDocument()
      })
    })

    it('should select all tenants', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const selectAllCheckbox = screen.getByTestId('select-all-tenants')
        await user.click(selectAllCheckbox)
        
        expect(screen.getByText('3 tenants selected')).toBeInTheDocument()
      })
    })

    it('should suspend multiple tenants', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('tenant-checkbox-1')
        await user.click(checkbox1)
        
        const suspendButton = screen.getByTestId('bulk-suspend')
        await user.click(suspendButton)
        
        expect(screen.getByTestId('bulk-confirm-dialog')).toBeInTheDocument()
      })
    })

    it('should change plan for multiple tenants', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('tenant-checkbox-1')
        const checkbox2 = screen.getByTestId('tenant-checkbox-2')
        await user.click(checkbox1)
        await user.click(checkbox2)
        
        const changePlanButton = screen.getByTestId('bulk-change-plan')
        await user.click(changePlanButton)
        
        expect(screen.getByTestId('bulk-plan-change-dialog')).toBeInTheDocument()
      })
    })

    it('should export data for multiple tenants', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('tenant-checkbox-1')
        await user.click(checkbox1)
        
        const exportButton = screen.getByTestId('bulk-export')
        await user.click(exportButton)
        
        expect(mockExportTenantData).toHaveBeenCalledWith(['1'])
      })
    })
  })

  describe('Billing and Subscription Management', () => {
    it('should display billing information for each tenant', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Enterprise')).toBeInTheDocument()
        expect(screen.getByText('Professional')).toBeInTheDocument()
        expect(screen.getByText('Starter')).toBeInTheDocument()
      })
    })

    it('should show next billing date', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByText('Next billing: Feb 15, 2024')).toBeInTheDocument()
      })
    })

    it('should display payment history in details view', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        const paymentHistory = screen.getByTestId('payment-history')
        expect(within(paymentHistory).getByText('$299.99')).toBeInTheDocument()
        expect(within(paymentHistory).getByText('Paid')).toBeInTheDocument()
      })
    })
  })

  describe('Tenant-Specific Settings', () => {
    it('should display feature toggles in details view', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('feature-toggles')).toBeInTheDocument()
        expect(screen.getByTestId('toggle-ai-analysis')).toBeInTheDocument()
        expect(screen.getByTestId('toggle-bulk-operations')).toBeInTheDocument()
      })
    })

    it('should display API limits', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByText('10,000 / hour')).toBeInTheDocument()
        expect(screen.getByText('API Limits')).toBeInTheDocument()
      })
    })

    it('should display custom branding status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const tenantName = screen.getByTestId('tenant-name-1')
        await user.click(tenantName)
        
        expect(screen.getByTestId('custom-branding-enabled')).toBeInTheDocument()
      })
    })
  })

  describe('Export Tenant Data', () => {
    it('should display export button', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('export-tenants-data')).toBeInTheDocument()
      })
    })

    it('should export all tenant data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const exportButton = screen.getByTestId('export-tenants-data')
        await user.click(exportButton)
        
        expect(mockExportTenantData).toHaveBeenCalledWith('all')
      })
    })

    it('should show export format options', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const exportButton = screen.getByTestId('export-tenants-data')
        await user.click(exportButton)
        
        expect(screen.getByTestId('export-format-dialog')).toBeInTheDocument()
        expect(screen.getByText('Export Format')).toBeInTheDocument()
        expect(screen.getByText('CSV')).toBeInTheDocument()
        expect(screen.getByText('JSON')).toBeInTheDocument()
        expect(screen.getByText('Excel')).toBeInTheDocument()
      })
    })
  })

  describe('Audit Log', () => {
    it('should display audit log section', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('audit-log-section')).toBeInTheDocument()
        expect(screen.getByText('Recent Changes')).toBeInTheDocument()
      })
    })

    it('should display audit entries', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Plan upgraded')).toBeInTheDocument()
        expect(screen.getByText('Storage limit increased')).toBeInTheDocument()
        expect(screen.getByText('superadmin@platform.com')).toBeInTheDocument()
      })
    })

    it('should filter audit log by tenant', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const auditFilter = screen.getByTestId('audit-tenant-filter')
        await user.selectOptions(auditFilter, '1')
        
        expect(screen.getByText('Plan upgraded')).toBeInTheDocument()
        expect(screen.queryByText('Storage limit increased')).not.toBeInTheDocument()
      })
    })

    it('should show detailed audit entry when clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const auditEntry = screen.getByTestId('audit-entry-1')
        await user.click(auditEntry)
        
        expect(screen.getByTestId('audit-details-modal')).toBeInTheDocument()
        expect(screen.getByText('Audit Details')).toBeInTheDocument()
      })
    })
  })

  describe('User Limit Enforcement', () => {
    it('should display user limits per plan', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        // Enterprise plan should show unlimited or high limit
        expect(screen.getByTestId('user-limit-display')).toBeInTheDocument()
      })
    })

    it('should warn when approaching user limits', async () => {
      // Mock tenant approaching user limit
      const nearLimitTenant = { ...mockTenants[0], usersCount: 490, userLimit: 500 }
      mockFetchTenants.mockResolvedValueOnce([nearLimitTenant])
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('user-limit-warning')).toBeInTheDocument()
        expect(screen.getByText(/approaching user limit/)).toBeInTheDocument()
      })
    })

    it('should prevent adding users when limit reached', async () => {
      const user = userEvent.setup()
      const atLimitTenant = { ...mockTenants[0], usersCount: 500, userLimit: 500 }
      mockFetchTenants.mockResolvedValueOnce([atLimitTenant])
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const addUserButton = screen.getByTestId('add-user-1')
        expect(addUserButton).toBeDisabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetchTenants.mockRejectedValueOnce(new Error('API Error'))
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('Failed to load tenants')).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      mockFetchTenants.mockRejectedValueOnce(new Error('API Error'))
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })
    })

    it('should handle loading states', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should handle create tenant errors', async () => {
      const user = userEvent.setup()
      mockCreateTenant.mockRejectedValueOnce(new Error('Create failed'))
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-tenant-button')
        await user.click(createButton)
        
        // Fill and submit form
        await user.type(screen.getByTestId('company-name-input'), 'Test Company')
        await user.type(screen.getByTestId('subdomain-input'), 'testcompany')
        await user.type(screen.getByTestId('admin-email-input'), 'admin@test.com')
        
        const submitButton = screen.getByTestId('submit-create-tenant')
        await user.click(submitButton)
        
        expect(screen.getByText('Failed to create tenant')).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
      })
    })

    it('should show mobile-friendly table on small screens', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('responsive-table')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Tenants list')
        expect(screen.getByLabelText('Search tenants')).toBeInTheDocument()
        expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        await user.tab()
        expect(document.activeElement).toHaveAttribute('data-testid', 'tenant-search-input')
      })
    })

    it('should have proper color contrast for status indicators', async () => {
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(() => {
        const activeStatus = screen.getByTestId('tenant-status-Active-1')
        expect(activeStatus).toHaveClass('text-green-700')
        
        const suspendedStatus = screen.getByTestId('tenant-status-Suspended-3')
        expect(suspendedStatus).toHaveClass('text-red-700')
      })
    })

    it('should announce status changes to screen readers', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<TenantsManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-tenant-1')
        await user.click(editButton)
        
        await user.selectOptions(screen.getByTestId('edit-status-select'), 'Suspended')
        
        const submitButton = screen.getByTestId('submit-edit-tenant')
        await user.click(submitButton)
        
        expect(screen.getByRole('status')).toHaveTextContent('Tenant status updated successfully')
      })
    })
  })
})