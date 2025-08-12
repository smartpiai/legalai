/**
 * UsersManagementPage Test Suite - TDD Implementation
 * Following Red-Green-Refactor methodology
 * 
 * Tests for all user management requirements:
 * 1. Display users table with all columns
 * 2. Create new user form
 * 3. Edit user functionality
 * 4. Delete user with confirmation
 * 5. Reset user password
 * 6. Search users by name, email, department
 * 7. Filter by role, department, status, last login date range
 * 8. Sort by name, email, last login, created date
 * 9. Bulk operations
 * 10. User details modal
 * 11. Force logout user sessions
 * 12. Export users list
 * 13. Import users from CSV
 * 14. User activity timeline
 * 15. Send broadcast message
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import UsersManagementPage from '../UsersManagementPage'

// Mock user data for testing
const mockUsers = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@acme.com',
    role: 'Admin',
    department: 'Legal',
    status: 'Active',
    lastLogin: '2024-02-01T10:30:00Z',
    createdAt: '2024-01-15T09:00:00Z',
    avatar: '/avatars/john.jpg',
    phone: '+1-555-0101',
    position: 'Legal Director',
    sessions: [
      {
        id: 'sess_1',
        device: 'Chrome on Windows',
        location: 'New York, US',
        lastActivity: '2024-02-01T10:30:00Z',
        ipAddress: '192.168.1.100'
      }
    ]
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@acme.com',
    role: 'Manager',
    department: 'Contracts',
    status: 'Active',
    lastLogin: '2024-01-31T14:15:00Z',
    createdAt: '2024-01-10T11:30:00Z',
    avatar: '/avatars/jane.jpg',
    phone: '+1-555-0102',
    position: 'Contract Manager',
    sessions: []
  },
  {
    id: '3',
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob.wilson@acme.com',
    role: 'User',
    department: 'Finance',
    status: 'Inactive',
    lastLogin: '2024-01-20T16:45:00Z',
    createdAt: '2024-01-01T08:00:00Z',
    avatar: null,
    phone: '+1-555-0103',
    position: 'Financial Analyst',
    sessions: []
  }
]

const mockActivityLog = [
  {
    id: '1',
    userId: '1',
    action: 'Created contract',
    details: 'Purchase Agreement for Acme Corp',
    timestamp: '2024-02-01T09:30:00Z',
    ipAddress: '192.168.1.100'
  },
  {
    id: '2',
    userId: '1',
    action: 'Updated profile',
    details: 'Changed phone number',
    timestamp: '2024-01-30T15:20:00Z',
    ipAddress: '192.168.1.100'
  }
]

const mockDepartments = ['Legal', 'Contracts', 'Finance', 'IT', 'HR']
const mockRoles = ['Admin', 'Manager', 'User', 'Viewer']

// Mock API calls
const mockFetchUsers = vi.fn(() => Promise.resolve(mockUsers))
const mockCreateUser = vi.fn(() => Promise.resolve({ id: '4', ...mockUsers[0] }))
const mockUpdateUser = vi.fn(() => Promise.resolve({ success: true }))
const mockDeleteUser = vi.fn(() => Promise.resolve({ success: true }))
const mockResetPassword = vi.fn(() => Promise.resolve({ success: true }))
const mockSearchUsers = vi.fn(() => Promise.resolve(mockUsers))
const mockBulkUpdateUsers = vi.fn(() => Promise.resolve({ success: true }))
const mockExportUsers = vi.fn(() => Promise.resolve(new Blob(['export data'], { type: 'text/csv' })))
const mockImportUsers = vi.fn(() => Promise.resolve({ success: true, imported: 5 }))
const mockFetchUserActivity = vi.fn(() => Promise.resolve(mockActivityLog))
const mockForceLogout = vi.fn(() => Promise.resolve({ success: true }))
const mockSendBroadcastMessage = vi.fn(() => Promise.resolve({ success: true }))
const mockFetchDepartments = vi.fn(() => Promise.resolve(mockDepartments))
const mockFetchRoles = vi.fn(() => Promise.resolve(mockRoles))

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

describe('UsersManagementPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  describe('Users Table Display', () => {
    it('should display users table with all required columns', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('users-table')).toBeInTheDocument()
        
        // Check table headers
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
        expect(screen.getByText('Role')).toBeInTheDocument()
        expect(screen.getByText('Department')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Last Login')).toBeInTheDocument()
        expect(screen.getByText('Created Date')).toBeInTheDocument()
      })
    })

    it('should display user data in table rows', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('john.doe@acme.com')).toBeInTheDocument()
        // Be more specific - find Admin in the table cell, not the filter dropdown
        const tableRows = screen.getByTestId('users-table').querySelectorAll('tbody tr')
        expect(tableRows).toHaveLength(3)
        expect(screen.getByTestId('user-status-Active-1')).toBeInTheDocument()
      })
    })

    it('should display user avatars with fallback', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('user-avatar-1')).toBeInTheDocument()
        expect(screen.getByTestId('user-avatar-fallback-3')).toBeInTheDocument() // Bob has no avatar
      })
    })

    it('should show different status styling for inactive users', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        const inactiveStatus = screen.getByTestId('user-status-Inactive-3')
        expect(inactiveStatus).toBeInTheDocument()
        expect(inactiveStatus).toHaveClass('text-gray-500')
      })
    })
  })

  describe('Create New User Form', () => {
    it('should display create user button', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('create-user-button')).toBeInTheDocument()
        expect(screen.getByText('Add User')).toBeInTheDocument()
      })
    })

    it('should open create user modal when button clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-user-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('create-user-modal')).toBeInTheDocument()
        expect(screen.getByText('Create New User')).toBeInTheDocument()
      })
    })

    it('should display all required form fields', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-user-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('first-name-input')).toBeInTheDocument()
        expect(screen.getByTestId('last-name-input')).toBeInTheDocument()
        expect(screen.getByTestId('email-input')).toBeInTheDocument()
        expect(screen.getByTestId('password-input')).toBeInTheDocument()
        expect(screen.getByTestId('role-select')).toBeInTheDocument()
        expect(screen.getByTestId('department-select')).toBeInTheDocument()
        expect(screen.getByTestId('send-welcome-email-checkbox')).toBeInTheDocument()
      })
    })

    it('should validate form fields before submission', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-user-button')
        await user.click(createButton)
        
        const submitButton = screen.getByTestId('submit-create-user')
        await user.click(submitButton)
        
        expect(screen.getByText('First name is required')).toBeInTheDocument()
        expect(screen.getByText('Last name is required')).toBeInTheDocument()
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Password is required')).toBeInTheDocument()
      })
    })

    it('should create user with valid data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      // First check initial state
      await waitFor(() => {
        const tableRows = screen.getByTestId('users-table').querySelectorAll('tbody tr')
        expect(tableRows).toHaveLength(3)
      })
      
      // Open modal and fill form
      const createButton = screen.getByTestId('create-user-button')
      await user.click(createButton)
      
      await user.type(screen.getByTestId('first-name-input'), 'Alice')
      await user.type(screen.getByTestId('last-name-input'), 'Johnson')
      await user.type(screen.getByTestId('email-input'), 'alice@acme.com')
      await user.type(screen.getByTestId('password-input'), 'SecurePass123!')
      await user.selectOptions(screen.getByTestId('role-select'), 'Manager')
      await user.selectOptions(screen.getByTestId('department-select'), 'Legal')
      await user.click(screen.getByTestId('send-welcome-email-checkbox'))
      
      const submitButton = screen.getByTestId('submit-create-user')
      await user.click(submitButton)
      
      // Check that user was added to the table
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
        const tableRows = screen.getByTestId('users-table').querySelectorAll('tbody tr')
        expect(tableRows).toHaveLength(4)
      })
    })

    it('should validate email uniqueness', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-user-button')
        await user.click(createButton)
        
        await user.type(screen.getByTestId('email-input'), 'john.doe@acme.com') // Existing email
        await user.blur(screen.getByTestId('email-input'))
        
        expect(screen.getByText('Email already exists')).toBeInTheDocument()
      })
    })
  })

  describe('Edit User Functionality', () => {
    it('should open edit modal when edit button clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-user-1')
        await user.click(editButton)
        
        expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument()
        expect(screen.getByText('Edit User')).toBeInTheDocument()
      })
    })

    it('should pre-populate form with user data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-user-1')
        await user.click(editButton)
        
        expect(screen.getByDisplayValue('John')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
        expect(screen.getByDisplayValue('john.doe@acme.com')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Admin')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Legal')).toBeInTheDocument()
      })
    })

    it('should not show password field in edit mode', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-user-1')
        await user.click(editButton)
        
        expect(screen.queryByTestId('password-input')).not.toBeInTheDocument()
      })
    })

    it('should update user when form submitted', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-user-1')
        await user.click(editButton)
        
        await user.selectOptions(screen.getByTestId('edit-role-select'), 'Manager')
        
        const submitButton = screen.getByTestId('submit-edit-user')
        await user.click(submitButton)
        
        expect(mockUpdateUser).toHaveBeenCalledWith('1', expect.objectContaining({
          role: 'Manager'
        }))
      })
    })

    it('should toggle user status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-user-1')
        await user.click(editButton)
        
        const statusToggle = screen.getByTestId('status-toggle')
        await user.click(statusToggle)
        
        const submitButton = screen.getByTestId('submit-edit-user')
        await user.click(submitButton)
        
        expect(mockUpdateUser).toHaveBeenCalledWith('1', expect.objectContaining({
          status: 'Inactive'
        }))
      })
    })
  })

  describe('Delete User with Confirmation', () => {
    it('should show delete button for each user', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-user-1')).toBeInTheDocument()
        expect(screen.getByTestId('delete-user-2')).toBeInTheDocument()
        expect(screen.getByTestId('delete-user-3')).toBeInTheDocument()
      })
    })

    it('should show confirmation dialog when delete clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-user-1')
        await user.click(deleteButton)
        
        expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument()
        expect(screen.getByText('Delete User')).toBeInTheDocument()
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      })
    })

    it('should prevent self-deletion', async () => {
      // Mock current user as user 1
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-user-1')
        expect(deleteButton).toBeDisabled()
      })
    })

    it('should delete user when confirmed', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-user-2') // Not current user
        await user.click(deleteButton)
        
        const confirmButton = screen.getByTestId('confirm-delete-user')
        await user.click(confirmButton)
        
        expect(mockDeleteUser).toHaveBeenCalledWith('2')
      })
    })
  })

  describe('Reset User Password', () => {
    it('should show reset password button for each user', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('reset-password-1')).toBeInTheDocument()
        expect(screen.getByTestId('reset-password-2')).toBeInTheDocument()
      })
    })

    it('should show confirmation dialog for password reset', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const resetButton = screen.getByTestId('reset-password-1')
        await user.click(resetButton)
        
        expect(screen.getByTestId('reset-password-dialog')).toBeInTheDocument()
        expect(screen.getByText('Reset Password')).toBeInTheDocument()
        expect(screen.getByText(/email notification will be sent/)).toBeInTheDocument()
      })
    })

    it('should reset password when confirmed', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const resetButton = screen.getByTestId('reset-password-1')
        await user.click(resetButton)
        
        const confirmButton = screen.getByTestId('confirm-reset-password')
        await user.click(confirmButton)
        
        expect(mockResetPassword).toHaveBeenCalledWith('1')
      })
    })
  })

  describe('Search Functionality', () => {
    it('should display search input', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('user-search-input')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument()
      })
    })

    it('should search users by name', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      // Initial state should show all users
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByTestId('user-search-input')
      await user.type(searchInput, 'John')
      
      // After search, only John should be visible
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
      })
    })

    it('should search users by email', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('user-search-input')
        await user.type(searchInput, 'john.doe@acme.com')
        
        expect(mockSearchUsers).toHaveBeenCalledWith('john.doe@acme.com')
      })
    })

    it('should search users by department', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('user-search-input')
        await user.type(searchInput, 'Legal')
        
        expect(mockSearchUsers).toHaveBeenCalledWith('Legal')
      })
    })
  })

  describe('Filter Functionality', () => {
    it('should display filter controls', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('role-filter')).toBeInTheDocument()
        expect(screen.getByTestId('department-filter')).toBeInTheDocument()
        expect(screen.getByTestId('status-filter')).toBeInTheDocument()
        expect(screen.getByTestId('last-login-filter')).toBeInTheDocument()
      })
    })

    it('should filter by role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const roleFilter = screen.getByTestId('role-filter')
        await user.selectOptions(roleFilter, 'Admin')
        
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      })
    })

    it('should filter by department', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const departmentFilter = screen.getByTestId('department-filter')
        await user.selectOptions(departmentFilter, 'Legal')
        
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
      })
    })

    it('should filter by status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const statusFilter = screen.getByTestId('status-filter')
        await user.selectOptions(statusFilter, 'Active')
        
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
      })
    })

    it('should filter by last login date range', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const lastLoginFilter = screen.getByTestId('last-login-filter')
        await user.click(lastLoginFilter)
        
        expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
      })
    })
  })

  describe('Sort Functionality', () => {
    it('should display sort controls', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('sort-select')).toBeInTheDocument()
        expect(screen.getByTestId('sort-direction')).toBeInTheDocument()
      })
    })

    it('should sort by name', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-select')
        await user.selectOptions(sortSelect, 'name')
        
        expect(screen.getByTestId('sorted-table')).toBeInTheDocument()
      })
    })

    it('should sort by email', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const sortSelect = screen.getByTestId('sort-select')
        await user.selectOptions(sortSelect, 'email')
        
        expect(screen.getByTestId('sorted-table')).toBeInTheDocument()
      })
    })

    it('should toggle sort direction', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const sortDirection = screen.getByTestId('sort-direction')
        await user.click(sortDirection)
        
        expect(screen.getByTestId('sort-desc')).toBeInTheDocument()
      })
    })
  })

  describe('Bulk Operations', () => {
    it('should display bulk operations bar when users selected', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        await user.click(checkbox1)
        
        expect(screen.getByTestId('bulk-operations-bar')).toBeInTheDocument()
        expect(screen.getByText('1 user selected')).toBeInTheDocument()
      })
    })

    it('should select all users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const selectAllCheckbox = screen.getByTestId('select-all-users')
        await user.click(selectAllCheckbox)
        
        expect(screen.getByText('3 users selected')).toBeInTheDocument()
      })
    })

    it('should bulk activate users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox3 = screen.getByTestId('user-checkbox-3')
        await user.click(checkbox3)
        
        const activateButton = screen.getByTestId('bulk-activate')
        await user.click(activateButton)
        
        expect(mockBulkUpdateUsers).toHaveBeenCalledWith(['3'], { status: 'Active' })
      })
    })

    it('should bulk deactivate users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        await user.click(checkbox1)
        
        const deactivateButton = screen.getByTestId('bulk-deactivate')
        await user.click(deactivateButton)
        
        expect(mockBulkUpdateUsers).toHaveBeenCalledWith(['1'], { status: 'Inactive' })
      })
    })

    it('should bulk change role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox2 = screen.getByTestId('user-checkbox-2')
        await user.click(checkbox2)
        
        const changeRoleButton = screen.getByTestId('bulk-change-role')
        await user.click(changeRoleButton)
        
        expect(screen.getByTestId('bulk-role-dialog')).toBeInTheDocument()
      })
    })

    it('should bulk export selected users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        await user.click(checkbox1)
        
        const exportButton = screen.getByTestId('bulk-export')
        await user.click(exportButton)
        
        expect(mockExportUsers).toHaveBeenCalledWith(['1'])
      })
    })
  })

  describe('User Details Modal', () => {
    it('should open details modal when user name clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('user-details-modal')).toBeInTheDocument()
        expect(screen.getByText('User Details')).toBeInTheDocument()
      })
    })

    it('should display user profile info', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Legal Director')).toBeInTheDocument()
        expect(screen.getByText('+1-555-0101')).toBeInTheDocument()
      })
    })

    it('should display activity log', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('activity-log')).toBeInTheDocument()
        expect(screen.getByText('Created contract')).toBeInTheDocument()
        expect(screen.getByText('Updated profile')).toBeInTheDocument()
      })
    })

    it('should display user permissions', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('user-permissions')).toBeInTheDocument()
      })
    })

    it('should display active sessions', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('active-sessions')).toBeInTheDocument()
        expect(screen.getByText('Chrome on Windows')).toBeInTheDocument()
        expect(screen.getByText('New York, US')).toBeInTheDocument()
      })
    })
  })

  describe('Force Logout Sessions', () => {
    it('should show logout button for active sessions', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('logout-session-sess_1')).toBeInTheDocument()
      })
    })

    it('should force logout specific session', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        const logoutButton = screen.getByTestId('logout-session-sess_1')
        await user.click(logoutButton)
        
        expect(mockForceLogout).toHaveBeenCalledWith('1', 'sess_1')
      })
    })

    it('should logout all user sessions', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        const logoutAllButton = screen.getByTestId('logout-all-sessions')
        await user.click(logoutAllButton)
        
        expect(mockForceLogout).toHaveBeenCalledWith('1', 'all')
      })
    })
  })

  describe('Export Users List', () => {
    it('should display export button', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('export-users-button')).toBeInTheDocument()
      })
    })

    it('should show export format options', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const exportButton = screen.getByTestId('export-users-button')
        await user.click(exportButton)
        
        expect(screen.getByTestId('export-format-dialog')).toBeInTheDocument()
        expect(screen.getByText('CSV')).toBeInTheDocument()
        expect(screen.getByText('Excel')).toBeInTheDocument()
      })
    })

    it('should export users in CSV format', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const exportButton = screen.getByTestId('export-users-button')
        await user.click(exportButton)
        
        const csvOption = screen.getByTestId('export-csv')
        await user.click(csvOption)
        
        expect(mockExportUsers).toHaveBeenCalledWith('all', 'csv')
      })
    })
  })

  describe('Import Users from CSV', () => {
    it('should display import button', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('import-users-button')).toBeInTheDocument()
      })
    })

    it('should open import dialog when clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-users-button')
        await user.click(importButton)
        
        expect(screen.getByTestId('import-users-dialog')).toBeInTheDocument()
        expect(screen.getByText('Import Users')).toBeInTheDocument()
      })
    })

    it('should show file upload area', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-users-button')
        await user.click(importButton)
        
        expect(screen.getByTestId('csv-file-upload')).toBeInTheDocument()
        expect(screen.getByText('Upload CSV file')).toBeInTheDocument()
      })
    })

    it('should validate CSV file before import', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-users-button')
        await user.click(importButton)
        
        const file = new File(['invalid,csv,data'], 'users.csv', { type: 'text/csv' })
        const fileInput = screen.getByTestId('csv-file-input')
        await user.upload(fileInput, file)
        
        expect(screen.getByTestId('validation-errors')).toBeInTheDocument()
      })
    })

    it('should import valid CSV file', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-users-button')
        await user.click(importButton)
        
        const file = new File(['firstName,lastName,email,role,department\nTest,User,test@test.com,User,IT'], 'users.csv', { type: 'text/csv' })
        const fileInput = screen.getByTestId('csv-file-input')
        await user.upload(fileInput, file)
        
        const submitImportButton = screen.getByTestId('submit-import')
        await user.click(submitImportButton)
        
        expect(mockImportUsers).toHaveBeenCalled()
      })
    })
  })

  describe('User Activity Timeline', () => {
    it('should display activity timeline in details modal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByTestId('activity-timeline')).toBeInTheDocument()
        expect(screen.getByText('Recent Actions')).toBeInTheDocument()
      })
    })

    it('should show timeline entries with timestamps', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByText('Created contract')).toBeInTheDocument()
        expect(screen.getByText('Purchase Agreement for Acme Corp')).toBeInTheDocument()
        expect(screen.getByTestId('timeline-timestamp-1')).toBeInTheDocument()
      })
    })

    it('should show IP addresses in activity log', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const userName = screen.getByTestId('user-name-1')
        await user.click(userName)
        
        expect(screen.getByText('192.168.1.100')).toBeInTheDocument()
      })
    })
  })

  describe('Send Broadcast Message', () => {
    it('should show broadcast message button when users selected', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        await user.click(checkbox1)
        
        expect(screen.getByTestId('broadcast-message-button')).toBeInTheDocument()
      })
    })

    it('should open message compose dialog', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        await user.click(checkbox1)
        
        const broadcastButton = screen.getByTestId('broadcast-message-button')
        await user.click(broadcastButton)
        
        expect(screen.getByTestId('broadcast-dialog')).toBeInTheDocument()
        expect(screen.getByText('Send Message')).toBeInTheDocument()
      })
    })

    it('should send broadcast message to selected users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        const checkbox1 = screen.getByTestId('user-checkbox-1')
        const checkbox2 = screen.getByTestId('user-checkbox-2')
        await user.click(checkbox1)
        await user.click(checkbox2)
        
        const broadcastButton = screen.getByTestId('broadcast-message-button')
        await user.click(broadcastButton)
        
        await user.type(screen.getByTestId('message-subject'), 'Important Update')
        await user.type(screen.getByTestId('message-content'), 'Please review the new policy.')
        
        const sendButton = screen.getByTestId('send-message')
        await user.click(sendButton)
        
        expect(mockSendBroadcastMessage).toHaveBeenCalledWith({
          userIds: ['1', '2'],
          subject: 'Important Update',
          message: 'Please review the new policy.'
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetchUsers.mockRejectedValueOnce(new Error('API Error'))
      
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('Failed to load users')).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      mockFetchUsers.mockRejectedValueOnce(new Error('API Error'))
      
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })
    })

    it('should handle loading states', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Users list')
        expect(screen.getByLabelText('Search users')).toBeInTheDocument()
        expect(screen.getByLabelText('Filter by role')).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(async () => {
        await user.tab()
        expect(document.activeElement).toHaveAttribute('data-testid', 'user-search-input')
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
      
      renderWithQueryClient(<UsersManagementPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-users-layout')).toBeInTheDocument()
      })
    })
  })
})