/**
 * RolesPermissionsPage Test Suite - TDD Implementation
 * Following Red-Green-Refactor methodology
 * 
 * Tests for all roles and permissions requirements:
 * - Role CRUD operations (Create, Read, Update, Delete)
 * - Permissions matrix with category grouping
 * - Bulk permission assignment (Select all/none per category)
 * - Role hierarchy visualization with inheritance
 * - Users assigned to role list with removal capability
 * - Search and filter roles by name, status, permission
 * - Clone role functionality
 * - Export/Import roles as JSON
 * - Audit log of role changes
 * - Default system roles protection (Admin, Manager, User, Viewer)
 * - Permission dependencies validation (e.g., "edit" requires "view")
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import RolesPermissionsPage from '../RolesPermissionsPage'

// Types
interface Role {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive'
  isSystemRole: boolean
  permissionIds: string[]
  userCount: number
  parentRoleId?: string
  createdAt: string
  updatedAt: string
}

interface Permission {
  id: string
  name: string
  description: string
  category: 'Documents' | 'Contracts' | 'Templates' | 'Workflows' | 'Admin'
  dependencies: string[]
}

interface User {
  id: string
  name: string
  email: string
  roleIds: string[]
}

interface AuditLog {
  id: string
  action: string
  roleId: string
  roleName: string
  changedBy: string
  timestamp: string
  changes: Record<string, any>
}

// Mock data for testing
const mockPermissions: Permission[] = [
  // Documents permissions
  { id: 'doc_view', name: 'View Documents', description: 'Can view documents', category: 'Documents', dependencies: [] },
  { id: 'doc_upload', name: 'Upload Documents', description: 'Can upload documents', category: 'Documents', dependencies: ['doc_view'] },
  { id: 'doc_edit', name: 'Edit Documents', description: 'Can edit document metadata', category: 'Documents', dependencies: ['doc_view'] },
  { id: 'doc_delete', name: 'Delete Documents', description: 'Can delete documents', category: 'Documents', dependencies: ['doc_view'] },
  
  // Contracts permissions
  { id: 'contract_view', name: 'View Contracts', description: 'Can view contracts', category: 'Contracts', dependencies: [] },
  { id: 'contract_create', name: 'Create Contracts', description: 'Can create new contracts', category: 'Contracts', dependencies: ['contract_view'] },
  { id: 'contract_edit', name: 'Edit Contracts', description: 'Can edit contract details', category: 'Contracts', dependencies: ['contract_view'] },
  { id: 'contract_delete', name: 'Delete Contracts', description: 'Can delete contracts', category: 'Contracts', dependencies: ['contract_view'] },
  
  // Templates permissions
  { id: 'template_view', name: 'View Templates', description: 'Can view templates', category: 'Templates', dependencies: [] },
  { id: 'template_create', name: 'Create Templates', description: 'Can create new templates', category: 'Templates', dependencies: ['template_view'] },
  { id: 'template_edit', name: 'Edit Templates', description: 'Can edit template content', category: 'Templates', dependencies: ['template_view'] },
  
  // Workflows permissions
  { id: 'workflow_view', name: 'View Workflows', description: 'Can view workflows', category: 'Workflows', dependencies: [] },
  { id: 'workflow_create', name: 'Create Workflows', description: 'Can create new workflows', category: 'Workflows', dependencies: ['workflow_view'] },
  
  // Admin permissions
  { id: 'admin_users', name: 'Manage Users', description: 'Can manage user accounts', category: 'Admin', dependencies: [] },
  { id: 'admin_roles', name: 'Manage Roles', description: 'Can manage roles and permissions', category: 'Admin', dependencies: [] },
  { id: 'admin_system', name: 'System Administration', description: 'Full system administration access', category: 'Admin', dependencies: ['admin_users', 'admin_roles'] }
]

const mockRoles: Role[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full system administrator with all permissions',
    status: 'active',
    isSystemRole: true,
    permissionIds: mockPermissions.map(p => p.id),
    userCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Management role with elevated permissions',
    status: 'active',
    isSystemRole: true,
    permissionIds: ['doc_view', 'doc_upload', 'doc_edit', 'contract_view', 'contract_create', 'contract_edit', 'template_view', 'workflow_view'],
    userCount: 5,
    parentRoleId: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user',
    name: 'User',
    description: 'Standard user with basic permissions',
    status: 'active',
    isSystemRole: true,
    permissionIds: ['doc_view', 'doc_upload', 'contract_view', 'template_view', 'workflow_view'],
    userCount: 15,
    parentRoleId: 'manager',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to system',
    status: 'active',
    isSystemRole: true,
    permissionIds: ['doc_view', 'contract_view', 'template_view', 'workflow_view'],
    userCount: 8,
    parentRoleId: 'user',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'custom_role_1',
    name: 'Contract Specialist',
    description: 'Specialized role for contract management',
    status: 'active',
    isSystemRole: false,
    permissionIds: ['contract_view', 'contract_create', 'contract_edit', 'doc_view', 'template_view'],
    userCount: 3,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'inactive_role',
    name: 'Inactive Role',
    description: 'An inactive role for testing',
    status: 'inactive',
    isSystemRole: false,
    permissionIds: ['doc_view'],
    userCount: 0,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  }
]

const mockUsers: User[] = [
  { id: 'user1', name: 'John Admin', email: 'john@admin.com', roleIds: ['admin'] },
  { id: 'user2', name: 'Jane Manager', email: 'jane@manager.com', roleIds: ['manager'] },
  { id: 'user3', name: 'Bob User', email: 'bob@user.com', roleIds: ['user'] },
  { id: 'user4', name: 'Alice Specialist', email: 'alice@specialist.com', roleIds: ['custom_role_1'] }
]

const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit1',
    action: 'CREATE_ROLE',
    roleId: 'custom_role_1',
    roleName: 'Contract Specialist',
    changedBy: 'admin@example.com',
    timestamp: '2024-01-15T10:00:00Z',
    changes: { name: 'Contract Specialist', description: 'Specialized role for contract management' }
  },
  {
    id: 'audit2',
    action: 'UPDATE_PERMISSIONS',
    roleId: 'custom_role_1',
    roleName: 'Contract Specialist',
    changedBy: 'admin@example.com',
    timestamp: '2024-01-15T11:00:00Z',
    changes: { added_permissions: ['template_view'], removed_permissions: [] }
  }
]

// Mock API functions
const mockFetchRoles = vi.fn(() => Promise.resolve(mockRoles))
const mockFetchPermissions = vi.fn(() => Promise.resolve(mockPermissions))
const mockFetchUsers = vi.fn(() => Promise.resolve(mockUsers))
const mockFetchAuditLogs = vi.fn(() => Promise.resolve(mockAuditLogs))
const mockCreateRole = vi.fn(() => Promise.resolve({ id: 'new_role', success: true }))
const mockUpdateRole = vi.fn(() => Promise.resolve({ success: true }))
const mockDeleteRole = vi.fn(() => Promise.resolve({ success: true }))
const mockCloneRole = vi.fn(() => Promise.resolve({ id: 'cloned_role', success: true }))
const mockExportRoles = vi.fn(() => Promise.resolve({ data: JSON.stringify(mockRoles) }))
const mockImportRoles = vi.fn(() => Promise.resolve({ success: true, imported: 1 }))
const mockRemoveUserFromRole = vi.fn(() => Promise.resolve({ success: true }))
const mockUpdateRolePermissions = vi.fn(() => Promise.resolve({ success: true }))

// Helper function to create test query client
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

describe('RolesPermissionsPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    vi.clearAllMocks()
  })

  describe('Initial Page Load', () => {
    it('should render page title and main sections', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Roles & Permissions')).toBeInTheDocument()
        expect(screen.getByTestId('roles-list-section')).toBeInTheDocument()
        expect(screen.getByTestId('permissions-matrix-section')).toBeInTheDocument()
      })
    })

    it('should display loading state initially', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      expect(screen.getByTestId('roles-loading-spinner')).toBeInTheDocument()
    })

    it('should load and display roles data', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument()
        expect(screen.getByText('Manager')).toBeInTheDocument()
        expect(screen.getByText('User')).toBeInTheDocument()
        expect(screen.getByText('Viewer')).toBeInTheDocument()
        expect(screen.getByText('Contract Specialist')).toBeInTheDocument()
      })
    })
  })

  describe('Roles Table Display', () => {
    it('should display roles table with all columns', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const rolesTable = screen.getByTestId('roles-table')
        expect(rolesTable).toBeInTheDocument()
        
        // Check table headers
        expect(within(rolesTable).getByText('Name')).toBeInTheDocument()
        expect(within(rolesTable).getByText('Description')).toBeInTheDocument()
        expect(within(rolesTable).getByText('Users Count')).toBeInTheDocument()
        expect(within(rolesTable).getByText('Permissions Count')).toBeInTheDocument()
        expect(within(rolesTable).getByText('Status')).toBeInTheDocument()
        expect(within(rolesTable).getByText('Actions')).toBeInTheDocument()
      })
    })

    it('should display role data correctly in table rows', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const adminRow = screen.getByTestId('role-row-admin')
        expect(within(adminRow).getByText('Admin')).toBeInTheDocument()
        expect(within(adminRow).getByText('Full system administrator with all permissions')).toBeInTheDocument()
        expect(within(adminRow).getByText('2 users')).toBeInTheDocument()
        expect(within(adminRow).getByText('13 permissions')).toBeInTheDocument()
        expect(within(adminRow).getByTestId('role-status-active')).toBeInTheDocument()
      })
    })

    it('should show system role badges', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('system-role-badge-admin')).toBeInTheDocument()
        expect(screen.getByTestId('system-role-badge-manager')).toBeInTheDocument()
        expect(screen.getByTestId('system-role-badge-user')).toBeInTheDocument()
        expect(screen.getByTestId('system-role-badge-viewer')).toBeInTheDocument()
      })
    })

    it('should display inactive roles with different styling', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const inactiveRow = screen.getByTestId('role-row-inactive_role')
        expect(within(inactiveRow).getByTestId('role-status-inactive')).toBeInTheDocument()
        expect(inactiveRow).toHaveClass('opacity-60')
      })
    })
  })

  describe('Search and Filter Functionality', () => {
    it('should have search input for roles', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('roles-search-input')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search roles by name...')).toBeInTheDocument()
      })
    })

    it('should filter roles by name search', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('roles-search-input')
        await user.type(searchInput, 'Admin')
        
        expect(screen.getByTestId('role-row-admin')).toBeInTheDocument()
        expect(screen.queryByTestId('role-row-user')).not.toBeInTheDocument()
        expect(screen.queryByTestId('role-row-custom_role_1')).not.toBeInTheDocument()
      })
    })

    it('should have status filter dropdown', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('status-filter-dropdown')).toBeInTheDocument()
      })
    })

    it('should filter roles by status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const statusFilter = screen.getByTestId('status-filter-dropdown')
        await user.selectOptions(statusFilter, 'inactive')
        
        expect(screen.getByTestId('role-row-inactive_role')).toBeInTheDocument()
        expect(screen.queryByTestId('role-row-admin')).not.toBeInTheDocument()
      })
    })

    it('should have permission filter dropdown', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('permission-filter-dropdown')).toBeInTheDocument()
      })
    })

    it('should filter roles by permission', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const permissionFilter = screen.getByTestId('permission-filter-dropdown')
        await user.selectOptions(permissionFilter, 'admin_system')
        
        expect(screen.getByTestId('role-row-admin')).toBeInTheDocument()
        expect(screen.queryByTestId('role-row-user')).not.toBeInTheDocument()
      })
    })

    it('should clear all filters', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        // Apply filters first
        const searchInput = screen.getByTestId('roles-search-input')
        await user.type(searchInput, 'Admin')
        
        // Clear filters
        const clearFiltersButton = screen.getByTestId('clear-filters-button')
        await user.click(clearFiltersButton)
        
        expect(searchInput).toHaveValue('')
        expect(screen.getByTestId('role-row-admin')).toBeInTheDocument()
        expect(screen.getByTestId('role-row-user')).toBeInTheDocument()
      })
    })
  })

  describe('Create New Role', () => {
    it('should have create role button', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('create-role-button')).toBeInTheDocument()
        expect(screen.getByText('Create New Role')).toBeInTheDocument()
      })
    })

    it('should open create role modal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('create-role-modal')).toBeInTheDocument()
        expect(screen.getByText('Create New Role')).toBeInTheDocument()
      })
    })

    it('should have create role form fields', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        expect(screen.getByTestId('role-name-input')).toBeInTheDocument()
        expect(screen.getByTestId('role-description-input')).toBeInTheDocument()
        expect(screen.getByTestId('copy-permissions-dropdown')).toBeInTheDocument()
      })
    })

    it('should validate required fields', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        const submitButton = screen.getByTestId('create-role-submit')
        await user.click(submitButton)
        
        expect(screen.getByText('Role name is required')).toBeInTheDocument()
        expect(screen.getByText('Description is required')).toBeInTheDocument()
      })
    })

    it('should create new role successfully', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        const descriptionInput = screen.getByTestId('role-description-input')
        
        await user.type(nameInput, 'New Role')
        await user.type(descriptionInput, 'A new test role')
        
        const submitButton = screen.getByTestId('create-role-submit')
        await user.click(submitButton)
        
        expect(mockCreateRole).toHaveBeenCalledWith({
          name: 'New Role',
          description: 'A new test role',
          permissionIds: []
        })
      })
    })

    it('should copy permissions from existing role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        const descriptionInput = screen.getByTestId('role-description-input')
        const copyDropdown = screen.getByTestId('copy-permissions-dropdown')
        
        await user.type(nameInput, 'New Role')
        await user.type(descriptionInput, 'A new test role')
        await user.selectOptions(copyDropdown, 'user')
        
        const submitButton = screen.getByTestId('create-role-submit')
        await user.click(submitButton)
        
        expect(mockCreateRole).toHaveBeenCalledWith({
          name: 'New Role',
          description: 'A new test role',
          permissionIds: mockRoles.find(r => r.id === 'user')?.permissionIds
        })
      })
    })
  })

  describe('Edit Role', () => {
    it('should have edit buttons for non-system roles', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-role-custom_role_1')).toBeInTheDocument()
        expect(screen.queryByTestId('edit-role-admin')).not.toBeInTheDocument()
      })
    })

    it('should open edit role modal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-role-custom_role_1')
        await user.click(editButton)
        
        expect(screen.getByTestId('edit-role-modal')).toBeInTheDocument()
        expect(screen.getByText('Edit Role')).toBeInTheDocument()
      })
    })

    it('should pre-populate form with role data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-role-custom_role_1')
        await user.click(editButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        const descriptionInput = screen.getByTestId('role-description-input')
        
        expect(nameInput).toHaveValue('Contract Specialist')
        expect(descriptionInput).toHaveValue('Specialized role for contract management')
      })
    })

    it('should update role successfully', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-role-custom_role_1')
        await user.click(editButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        await user.clear(nameInput)
        await user.type(nameInput, 'Updated Role Name')
        
        const submitButton = screen.getByTestId('edit-role-submit')
        await user.click(submitButton)
        
        expect(mockUpdateRole).toHaveBeenCalledWith('custom_role_1', {
          name: 'Updated Role Name',
          description: 'Specialized role for contract management'
        })
      })
    })

    it('should toggle role status', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const editButton = screen.getByTestId('edit-role-custom_role_1')
        await user.click(editButton)
        
        const statusToggle = screen.getByTestId('role-status-toggle')
        await user.click(statusToggle)
        
        const submitButton = screen.getByTestId('edit-role-submit')
        await user.click(submitButton)
        
        expect(mockUpdateRole).toHaveBeenCalledWith('custom_role_1', expect.objectContaining({
          status: 'inactive'
        }))
      })
    })
  })

  describe('Delete Role', () => {
    it('should have delete buttons for non-system roles', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-role-custom_role_1')).toBeInTheDocument()
        expect(screen.queryByTestId('delete-role-admin')).not.toBeInTheDocument()
      })
    })

    it('should show confirmation dialog for role deletion', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-role-custom_role_1')
        await user.click(deleteButton)
        
        expect(screen.getByTestId('delete-confirmation-modal')).toBeInTheDocument()
        expect(screen.getByText('Are you sure you want to delete this role?')).toBeInTheDocument()
      })
    })

    it('should prevent deletion of roles with assigned users', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-role-custom_role_1')
        await user.click(deleteButton)
        
        expect(screen.getByText('This role has 3 users assigned and cannot be deleted')).toBeInTheDocument()
        expect(screen.getByTestId('confirm-delete-button')).toBeDisabled()
      })
    })

    it('should delete role successfully when no users assigned', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const deleteButton = screen.getByTestId('delete-role-inactive_role')
        await user.click(deleteButton)
        
        const confirmButton = screen.getByTestId('confirm-delete-button')
        await user.click(confirmButton)
        
        expect(mockDeleteRole).toHaveBeenCalledWith('inactive_role')
      })
    })
  })

  describe('Permissions Matrix', () => {
    it('should display permissions matrix', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('permissions-matrix')).toBeInTheDocument()
        expect(screen.getByText('Permissions Matrix')).toBeInTheDocument()
      })
    })

    it('should group permissions by category', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('category-Documents')).toBeInTheDocument()
        expect(screen.getByTestId('category-Contracts')).toBeInTheDocument()
        expect(screen.getByTestId('category-Templates')).toBeInTheDocument()
        expect(screen.getByTestId('category-Workflows')).toBeInTheDocument()
        expect(screen.getByTestId('category-Admin')).toBeInTheDocument()
      })
    })

    it('should display permission checkboxes for each role', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('permission-checkbox-admin-doc_view')).toBeInTheDocument()
        expect(screen.getByTestId('permission-checkbox-admin-doc_view')).toBeChecked()
        expect(screen.getByTestId('permission-checkbox-viewer-doc_edit')).toBeInTheDocument()
        expect(screen.getByTestId('permission-checkbox-viewer-doc_edit')).not.toBeChecked()
      })
    })

    it('should toggle individual permissions', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const checkbox = screen.getByTestId('permission-checkbox-custom_role_1-doc_edit')
        await user.click(checkbox)
        
        expect(mockUpdateRolePermissions).toHaveBeenCalledWith('custom_role_1', {
          permissionIds: expect.arrayContaining(['doc_edit'])
        })
      })
    })

    it('should have select all/none buttons for categories', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('select-all-Documents-custom_role_1')).toBeInTheDocument()
        expect(screen.getByTestId('select-none-Documents-custom_role_1')).toBeInTheDocument()
      })
    })

    it('should select all permissions in category', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const selectAllButton = screen.getByTestId('select-all-Documents-custom_role_1')
        await user.click(selectAllButton)
        
        const documentsPermissions = mockPermissions
          .filter(p => p.category === 'Documents')
          .map(p => p.id)
        
        expect(mockUpdateRolePermissions).toHaveBeenCalledWith('custom_role_1', {
          permissionIds: expect.arrayContaining(documentsPermissions)
        })
      })
    })

    it('should enforce permission dependencies', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        // Try to uncheck 'doc_view' when 'doc_edit' depends on it
        const docViewCheckbox = screen.getByTestId('permission-checkbox-custom_role_1-doc_view')
        await user.click(docViewCheckbox)
        
        expect(screen.getByText('Cannot remove this permission as it is required by: Edit Documents')).toBeInTheDocument()
      })
    })

    it('should automatically add dependencies when selecting permission', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const docEditCheckbox = screen.getByTestId('permission-checkbox-viewer-doc_edit')
        await user.click(docEditCheckbox)
        
        expect(mockUpdateRolePermissions).toHaveBeenCalledWith('viewer', {
          permissionIds: expect.arrayContaining(['doc_view', 'doc_edit'])
        })
      })
    })
  })

  describe('Role Hierarchy Visualization', () => {
    it('should display role hierarchy section', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('role-hierarchy-section')).toBeInTheDocument()
        expect(screen.getByText('Role Hierarchy')).toBeInTheDocument()
      })
    })

    it('should show parent-child relationships', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('hierarchy-admin')).toBeInTheDocument()
        expect(screen.getByTestId('hierarchy-manager')).toBeInTheDocument()
        expect(screen.getByTestId('hierarchy-user')).toBeInTheDocument()
        expect(screen.getByTestId('hierarchy-viewer')).toBeInTheDocument()
      })
    })

    it('should display inheritance indicators', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const managerNode = screen.getByTestId('hierarchy-manager')
        expect(within(managerNode).getByText('Inherits from Admin')).toBeInTheDocument()
      })
    })
  })

  describe('Users Assigned to Role', () => {
    it('should show users assigned to selected role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const adminRow = screen.getByTestId('role-row-admin')
        await user.click(adminRow)
        
        expect(screen.getByTestId('role-users-section')).toBeInTheDocument()
        expect(screen.getByText('Users with Admin role')).toBeInTheDocument()
        expect(screen.getByText('John Admin')).toBeInTheDocument()
      })
    })

    it('should allow removing users from role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const adminRow = screen.getByTestId('role-row-admin')
        await user.click(adminRow)
        
        const removeButton = screen.getByTestId('remove-user-user1')
        await user.click(removeButton)
        
        expect(screen.getByTestId('remove-user-confirmation')).toBeInTheDocument()
      })
    })

    it('should confirm user removal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const adminRow = screen.getByTestId('role-row-admin')
        await user.click(adminRow)
        
        const removeButton = screen.getByTestId('remove-user-user1')
        await user.click(removeButton)
        
        const confirmButton = screen.getByTestId('confirm-remove-user')
        await user.click(confirmButton)
        
        expect(mockRemoveUserFromRole).toHaveBeenCalledWith('user1', 'admin')
      })
    })
  })

  describe('Clone Role Functionality', () => {
    it('should have clone buttons for all roles', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('clone-role-admin')).toBeInTheDocument()
        expect(screen.getByTestId('clone-role-custom_role_1')).toBeInTheDocument()
      })
    })

    it('should open clone role modal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const cloneButton = screen.getByTestId('clone-role-admin')
        await user.click(cloneButton)
        
        expect(screen.getByTestId('clone-role-modal')).toBeInTheDocument()
        expect(screen.getByText('Clone Role')).toBeInTheDocument()
      })
    })

    it('should pre-fill form with cloned role data', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const cloneButton = screen.getByTestId('clone-role-admin')
        await user.click(cloneButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        const descriptionInput = screen.getByTestId('role-description-input')
        
        expect(nameInput).toHaveValue('Copy of Admin')
        expect(descriptionInput).toHaveValue('Full system administrator with all permissions')
      })
    })

    it('should clone role successfully', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const cloneButton = screen.getByTestId('clone-role-admin')
        await user.click(cloneButton)
        
        const submitButton = screen.getByTestId('clone-role-submit')
        await user.click(submitButton)
        
        expect(mockCloneRole).toHaveBeenCalledWith('admin', {
          name: 'Copy of Admin',
          description: 'Full system administrator with all permissions'
        })
      })
    })
  })

  describe('Export/Import Roles', () => {
    it('should have export roles button', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('export-roles-button')).toBeInTheDocument()
        expect(screen.getByText('Export Roles')).toBeInTheDocument()
      })
    })

    it('should export roles as JSON', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const exportButton = screen.getByTestId('export-roles-button')
        await user.click(exportButton)
        
        expect(mockExportRoles).toHaveBeenCalled()
      })
    })

    it('should have import roles button', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('import-roles-button')).toBeInTheDocument()
        expect(screen.getByText('Import Roles')).toBeInTheDocument()
      })
    })

    it('should open import modal', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-roles-button')
        await user.click(importButton)
        
        expect(screen.getByTestId('import-roles-modal')).toBeInTheDocument()
        expect(screen.getByText('Import Roles from JSON')).toBeInTheDocument()
      })
    })

    it('should validate JSON file upload', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-roles-button')
        await user.click(importButton)
        
        const fileInput = screen.getByTestId('json-file-input')
        const invalidFile = new File(['invalid json'], 'roles.txt', { type: 'text/plain' })
        
        await user.upload(fileInput, invalidFile)
        
        expect(screen.getByText('Please select a valid JSON file')).toBeInTheDocument()
      })
    })

    it('should import roles successfully', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const importButton = screen.getByTestId('import-roles-button')
        await user.click(importButton)
        
        const fileInput = screen.getByTestId('json-file-input')
        const validFile = new File([JSON.stringify(mockRoles)], 'roles.json', { type: 'application/json' })
        
        await user.upload(fileInput, validFile)
        
        const submitButton = screen.getByTestId('import-roles-submit')
        await user.click(submitButton)
        
        expect(mockImportRoles).toHaveBeenCalled()
      })
    })
  })

  describe('Audit Log', () => {
    it('should display audit log section', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('audit-log-section')).toBeInTheDocument()
        expect(screen.getByText('Role Changes Audit Log')).toBeInTheDocument()
      })
    })

    it('should display audit log entries', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('CREATE_ROLE')).toBeInTheDocument()
        expect(screen.getByText('Contract Specialist')).toBeInTheDocument()
        expect(screen.getByText('admin@example.com')).toBeInTheDocument()
        expect(screen.getByText('UPDATE_PERMISSIONS')).toBeInTheDocument()
      })
    })

    it('should filter audit log by role', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const roleFilter = screen.getByTestId('audit-role-filter')
        await user.selectOptions(roleFilter, 'custom_role_1')
        
        expect(screen.getByText('CREATE_ROLE')).toBeInTheDocument()
        expect(screen.getByText('UPDATE_PERMISSIONS')).toBeInTheDocument()
      })
    })

    it('should expand audit log details', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const expandButton = screen.getByTestId('expand-audit-audit1')
        await user.click(expandButton)
        
        expect(screen.getByText('Added permissions: template_view')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetchRoles.mockRejectedValueOnce(new Error('API Error'))
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('Failed to load roles')).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      mockFetchRoles.mockRejectedValueOnce(new Error('API Error'))
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })
    })

    it('should handle form validation errors', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const createButton = screen.getByTestId('create-role-button')
        await user.click(createButton)
        
        const nameInput = screen.getByTestId('role-name-input')
        await user.type(nameInput, 'A')  // Too short
        
        const submitButton = screen.getByTestId('create-role-submit')
        await user.click(submitButton)
        
        expect(screen.getByText('Role name must be at least 3 characters')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Search roles')).toBeInTheDocument()
        expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
        expect(screen.getByLabelText('Roles table')).toBeInTheDocument()
        expect(screen.getByLabelText('Permissions matrix')).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        await user.tab()
        expect(document.activeElement).toHaveAttribute('data-testid', 'roles-search-input')
      })
    })

    it('should have proper table headers and row relationships', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const table = screen.getByTestId('roles-table')
        expect(table).toHaveAttribute('role', 'table')
        
        const headers = within(table).getAllByRole('columnheader')
        expect(headers).toHaveLength(6)
      })
    })
  })

  describe('Responsive Design', () => {
    it('should stack sections vertically on mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
      })
    })

    it('should hide less important columns on small screens', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        const table = screen.getByTestId('roles-table')
        expect(table).toHaveClass('responsive-table')
      })
    })
  })

  describe('Performance', () => {
    it('should virtualize large role lists', async () => {
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(() => {
        expect(screen.getByTestId('virtualized-table')).toBeInTheDocument()
      })
    })

    it('should debounce search input', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<RolesPermissionsPage />)
      
      await waitFor(async () => {
        const searchInput = screen.getByTestId('roles-search-input')
        await user.type(searchInput, 'Admin')
        
        // Should not trigger immediate search
        expect(mockFetchRoles).toHaveBeenCalledTimes(1) // Initial load only
      })
    })
  })
})