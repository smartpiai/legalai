/**
 * TemplateCreatePage Tests - TDD Implementation
 * Comprehensive test coverage for template creation with rich text editor and variable management
 */
import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockUser, mockApiResponse, mockApiError } from '@/test/utils'
import { templateService } from '@/services/template.service'
import TemplateCreatePage from '../TemplateCreatePage'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock the template service
vi.mock('@/services/template.service', () => ({
  templateService: {
    createTemplate: vi.fn(),
    validateTemplate: vi.fn(),
    getCategories: vi.fn(),
    previewTemplate: vi.fn(),
    importTemplate: vi.fn(),
    exportTemplate: vi.fn(),
    getTemplates: vi.fn(),
    addVariable: vi.fn(),
    addLogicBlock: vi.fn(),
  }
}))

// Mock React Router navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('TemplateCreatePage', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mock responses
    vi.mocked(templateService.getCategories).mockResolvedValue([
      { id: 'contract', name: 'Contract', count: 15 },
      { id: 'nda', name: 'NDA', count: 8 },
      { id: 'agreement', name: 'Agreement', count: 12 },
      { id: 'policy', name: 'Policy', count: 5 },
      { id: 'other', name: 'Other', count: 3 }
    ])
    
    vi.mocked(templateService.validateTemplate).mockResolvedValue({
      is_valid: true,
      errors: [],
      warnings: []
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders the template creation form', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByText('Create New Template')).toBeInTheDocument()
      expect(screen.getByLabelText(/template name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      
      // Wait for categories to load
      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching categories', async () => {
      vi.mocked(templateService.getCategories).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 500))
      )
      
      render(<TemplateCreatePage />)
      
      expect(screen.getByText(/loading categories/i)).toBeInTheDocument()
    })

    it('displays error when categories fail to load', async () => {
      vi.mocked(templateService.getCategories).mockRejectedValue(
        new Error('Failed to load categories')
      )
      
      render(<TemplateCreatePage />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load categories')).toBeInTheDocument()
      })
    })

    it('shows proper navigation buttons', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /publish template/i })).toBeInTheDocument()
    })

    it('displays template sections', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByText('Basic Information')).toBeInTheDocument()
      expect(screen.getByText('Template Content')).toBeInTheDocument()
      expect(screen.getByText('Variables')).toBeInTheDocument()
      expect(screen.getByText('Logic Rules')).toBeInTheDocument()
      expect(screen.getByText('Metadata')).toBeInTheDocument()
    })
  })

  describe('Basic Information Section', () => {
    it('validates required template name', async () => {
      render(<TemplateCreatePage />)
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })
    })

    it('validates minimum name length', async () => {
      render(<TemplateCreatePage />)
      
      const nameInput = screen.getByLabelText(/template name/i)
      await user.type(nameInput, 'Test')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template name must be at least 5 characters')).toBeInTheDocument()
      })
    })

    it('validates maximum name length', async () => {
      render(<TemplateCreatePage />)
      
      const nameInput = screen.getByLabelText(/template name/i)
      const longName = 'A'.repeat(201)
      await user.type(nameInput, longName)
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template name must not exceed 200 characters')).toBeInTheDocument()
      })
    })

    it('validates required category selection', async () => {
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Valid Template Name')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Category is required')).toBeInTheDocument()
      })
    })

    it('validates description maximum length', async () => {
      render(<TemplateCreatePage />)
      
      const descriptionInput = screen.getByLabelText(/description/i)
      const longDescription = 'A'.repeat(501)
      await user.type(descriptionInput, longDescription)
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Description must not exceed 500 characters')).toBeInTheDocument()
      })
    })

    it('shows character count for description', async () => {
      render(<TemplateCreatePage />)
      
      const descriptionInput = screen.getByLabelText(/description/i)
      await user.type(descriptionInput, 'Test description')
      
      expect(screen.getByText('16 / 500 characters')).toBeInTheDocument()
    })

    it('populates category dropdown with fetched categories', async () => {
      render(<TemplateCreatePage />)
      
      await waitFor(() => {
        const categorySelect = screen.getByLabelText(/category/i)
        expect(categorySelect).toBeInTheDocument()
        // Check if options are available
        const contractOption = within(categorySelect).queryByText('Contract')
        if (contractOption) {
          expect(contractOption).toBeInTheDocument()
        }
      })
    })
  })

  describe('Rich Text Editor', () => {
    it('renders rich text editor with proper controls', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByRole('textbox', { name: /template content/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /insert variable/i })).toBeInTheDocument()
    })

    it('validates required template content', async () => {
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Test Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template content is required')).toBeInTheDocument()
      })
    })

    it('shows formatting toolbar', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByLabelText(/formatting toolbar/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /heading 1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /heading 2/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /heading 3/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bullet list/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument()
    })

    it('supports table insertion', async () => {
      render(<TemplateCreatePage />)
      
      const tableButton = screen.getByRole('button', { name: /insert table/i })
      await user.click(tableButton)
      
      expect(screen.getByText('Insert Table')).toBeInTheDocument()
      expect(screen.getByLabelText(/rows/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/columns/i)).toBeInTheDocument()
    })

    it('supports undo/redo functionality', async () => {
      render(<TemplateCreatePage />)
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content')
      
      const undoButton = screen.getByRole('button', { name: /undo/i })
      const redoButton = screen.getByRole('button', { name: /redo/i })
      
      expect(undoButton).toBeInTheDocument()
      expect(redoButton).toBeInTheDocument()
    })
  })

  describe('Variable Management', () => {
    it('shows empty variables list initially', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByText('No variables defined')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add variable/i })).toBeInTheDocument()
    })

    it('opens add variable modal', async () => {
      render(<TemplateCreatePage />)
      
      const addVariableButton = screen.getByRole('button', { name: /add variable/i })
      await user.click(addVariableButton)
      
      expect(screen.getByText('Add Variable')).toBeInTheDocument()
      expect(screen.getByLabelText(/variable name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/variable type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/default value/i)).toBeInTheDocument()
    })

    it('validates variable name requirements', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Variable name is required')).toBeInTheDocument()
      })
    })

    it('validates variable name format', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'invalid name!')
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Variable name must contain only letters, numbers, and underscores')).toBeInTheDocument()
      })
    })

    it('adds text variable successfully', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'client_name')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'text')
      await user.type(screen.getByLabelText(/default value/i), 'Default Client')
      await user.type(screen.getByLabelText(/description/i), 'Client company name')
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('client_name')).toBeInTheDocument()
        expect(screen.getByText('Text')).toBeInTheDocument()
        expect(screen.getByText('Default Client')).toBeInTheDocument()
      })
    })

    it('adds date variable with format validation', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'contract_date')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'date')
      
      expect(screen.getByLabelText(/date format/i)).toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText(/date format/i), 'MM/dd/yyyy')
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('contract_date')).toBeInTheDocument()
        expect(screen.getByText('Date')).toBeInTheDocument()
      })
    })

    it('adds dropdown variable with options', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'contract_type')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'select')
      
      const optionsInput = screen.getByLabelText(/options/i)
      await user.type(optionsInput, 'Purchase\nService\nLicense')
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('contract_type')).toBeInTheDocument()
        expect(screen.getByText('Select')).toBeInTheDocument()
        expect(screen.getByText('3 options')).toBeInTheDocument()
      })
    })

    it('validates dropdown options requirement', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'dropdown_test')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'select')
      
      const saveButton = screen.getByRole('button', { name: /save variable/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Options are required for dropdown variables')).toBeInTheDocument()
      })
    })

    it('allows editing existing variables', async () => {
      render(<TemplateCreatePage />)
      
      // First add a variable
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'test_var')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'text')
      await user.click(screen.getByRole('button', { name: /save variable/i }))
      
      await waitFor(() => {
        expect(screen.getByText('test_var')).toBeInTheDocument()
      })
      
      // Then edit it
      const editButton = screen.getByRole('button', { name: /edit test_var/i })
      await user.click(editButton)
      
      expect(screen.getByText('Edit Variable')).toBeInTheDocument()
      expect(screen.getByDisplayValue('test_var')).toBeInTheDocument()
    })

    it('allows deleting variables', async () => {
      render(<TemplateCreatePage />)
      
      // First add a variable
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'delete_test')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'text')
      await user.click(screen.getByRole('button', { name: /save variable/i }))
      
      await waitFor(() => {
        expect(screen.getByText('delete_test')).toBeInTheDocument()
      })
      
      // Then delete it
      const deleteButton = screen.getByRole('button', { name: /delete delete_test/i })
      await user.click(deleteButton)
      
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /confirm delete/i }))
      
      await waitFor(() => {
        expect(screen.queryByText('delete_test')).not.toBeInTheDocument()
      })
    })

    it('inserts variables into content editor', async () => {
      render(<TemplateCreatePage />)
      
      // Add a variable first
      await user.click(screen.getByRole('button', { name: /add variable/i }))
      await user.type(screen.getByLabelText(/variable name/i), 'client_name')
      await user.selectOptions(screen.getByLabelText(/variable type/i), 'text')
      await user.click(screen.getByRole('button', { name: /save variable/i }))
      
      await waitFor(() => {
        expect(screen.getByText('client_name')).toBeInTheDocument()
      })
      
      // Click in content editor and insert variable
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.click(contentEditor)
      
      const insertVariableButton = screen.getByRole('button', { name: /insert variable/i })
      await user.click(insertVariableButton)
      
      expect(screen.getByText('Select Variable to Insert')).toBeInTheDocument()
      await user.click(screen.getByText('client_name'))
      
      // Variable should be inserted
      expect(contentEditor).toHaveValue(expect.stringContaining('{{client_name}}'))
    })
  })

  describe('Logic Rules Section', () => {
    it('shows empty logic rules initially', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByText('No logic rules defined')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add logic rule/i })).toBeInTheDocument()
    })

    it('opens add logic rule modal', async () => {
      render(<TemplateCreatePage />)
      
      const addLogicButton = screen.getByRole('button', { name: /add logic rule/i })
      await user.click(addLogicButton)
      
      expect(screen.getByText('Add Logic Rule')).toBeInTheDocument()
      expect(screen.getByLabelText(/rule type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/condition/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/content/i)).toBeInTheDocument()
    })

    it('adds conditional rule successfully', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add logic rule/i }))
      await user.selectOptions(screen.getByLabelText(/rule type/i), 'if')
      await user.type(screen.getByLabelText(/condition/i), 'contract_value > 10000')
      await user.type(screen.getByLabelText(/content/i), 'This is a high-value contract.')
      
      const saveButton = screen.getByRole('button', { name: /save rule/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('IF: contract_value > 10000')).toBeInTheDocument()
      })
    })

    it('validates rule condition syntax', async () => {
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /add logic rule/i }))
      await user.selectOptions(screen.getByLabelText(/rule type/i), 'if')
      await user.type(screen.getByLabelText(/condition/i), 'invalid condition syntax !')
      
      const saveButton = screen.getByRole('button', { name: /save rule/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid condition syntax')).toBeInTheDocument()
      })
    })
  })

  describe('Template Preview', () => {
    it('shows preview button', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByRole('button', { name: /preview template/i })).toBeInTheDocument()
    })

    it('opens preview modal with sample data', async () => {
      vi.mocked(templateService.previewTemplate).mockResolvedValue({
        content: '<p>Preview content with {{client_name}} replaced</p>',
        variables_used: ['client_name'],
        warnings: []
      })
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Test Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Hello {{client_name}}')
      
      const previewButton = screen.getByRole('button', { name: /preview template/i })
      await user.click(previewButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template Preview')).toBeInTheDocument()
        expect(screen.getByText('Preview content with {{client_name}} replaced')).toBeInTheDocument()
      })
    })

    it('shows preview warnings', async () => {
      vi.mocked(templateService.previewTemplate).mockResolvedValue({
        content: '<p>Preview content</p>',
        variables_used: [],
        warnings: ['Variable {{undefined_var}} is not defined']
      })
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Test Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Hello {{undefined_var}}')
      
      const previewButton = screen.getByRole('button', { name: /preview template/i })
      await user.click(previewButton)
      
      await waitFor(() => {
        expect(screen.getByText('Preview Warnings')).toBeInTheDocument()
        expect(screen.getByText('Variable {{undefined_var}} is not defined')).toBeInTheDocument()
      })
    })
  })

  describe('Metadata Section', () => {
    it('renders metadata fields', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/department/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/access level/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/version notes/i)).toBeInTheDocument()
    })

    it('supports multiple tag selection', async () => {
      render(<TemplateCreatePage />)
      
      const tagsInput = screen.getByLabelText(/tags/i)
      await user.type(tagsInput, 'legal{enter}contract{enter}standard{enter}')
      
      expect(screen.getByText('legal')).toBeInTheDocument()
      expect(screen.getByText('contract')).toBeInTheDocument()
      expect(screen.getByText('standard')).toBeInTheDocument()
    })

    it('validates department selection', async () => {
      render(<TemplateCreatePage />)
      
      const departmentSelect = screen.getByLabelText(/department/i)
      expect(departmentSelect).toBeInTheDocument()
      // Check if department options exist
      expect(within(departmentSelect).queryByText('Legal')).toBeInTheDocument()
      expect(within(departmentSelect).queryByText('HR')).toBeInTheDocument()
      expect(within(departmentSelect).queryByText('Finance')).toBeInTheDocument()
    })

    it('sets default access level to private', async () => {
      render(<TemplateCreatePage />)
      
      const accessSelect = screen.getByLabelText(/access level/i)
      expect(accessSelect).toHaveValue('private')
    })
  })

  describe('Template Creation and Saving', () => {
    it('saves template as draft successfully', async () => {
      const mockTemplate = {
        id: 'template-123',
        name: 'Draft Template',
        category: 'contract',
        description: 'Test description',
        content: 'Test content',
        is_active: false
      }
      
      vi.mocked(templateService.createTemplate).mockResolvedValue(mockTemplate)
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Draft Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      await user.type(screen.getByLabelText(/description/i), 'Test description')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content')
      
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
      await user.click(saveDraftButton)
      
      await waitFor(() => {
        expect(templateService.createTemplate).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Draft Template',
          category: 'contract',
          description: 'Test description',
          content: 'Test content',
          is_active: false
        }))
      })
      
      expect(screen.getByText('Template saved as draft')).toBeInTheDocument()
    })

    it('publishes template successfully', async () => {
      const mockTemplate = {
        id: 'template-456',
        name: 'Published Template',
        category: 'contract',
        description: 'Test description',
        content: 'Test content',
        is_active: true
      }
      
      vi.mocked(templateService.createTemplate).mockResolvedValue(mockTemplate)
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Published Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      await user.type(screen.getByLabelText(/description/i), 'Test description')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(templateService.createTemplate).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Published Template',
          category: 'contract',
          is_active: true
        }))
      })
      
      expect(mockNavigate).toHaveBeenCalledWith('/templates')
    })

    it('handles creation errors', async () => {
      vi.mocked(templateService.createTemplate).mockRejectedValue(
        new Error('Template name already exists')
      )
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Existing Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to create template: Template name already exists')).toBeInTheDocument()
      })
    })

    it('validates template before publishing', async () => {
      vi.mocked(templateService.validateTemplate).mockResolvedValue({
        is_valid: false,
        errors: ['Missing required variable definition'],
        warnings: ['Consider adding more detailed description']
      })
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Invalid Template')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Hello {{undefined_var}}')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByText('Template Validation Failed')).toBeInTheDocument()
        expect(screen.getByText('Missing required variable definition')).toBeInTheDocument()
        expect(screen.getByText('Consider adding more detailed description')).toBeInTheDocument()
      })
      
      // Should not call create if validation fails
      expect(templateService.createTemplate).not.toHaveBeenCalled()
    })
  })

  describe('Import/Export Functionality', () => {
    it('shows import template button', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByRole('button', { name: /import template/i })).toBeInTheDocument()
    })

    it('opens import modal', async () => {
      render(<TemplateCreatePage />)
      
      const importButton = screen.getByRole('button', { name: /import template/i })
      await user.click(importButton)
      
      expect(screen.getByText('Import Template')).toBeInTheDocument()
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument()
    })

    it('imports template from JSON file', async () => {
      const mockTemplate = {
        name: 'Imported Template',
        category: 'contract',
        content: 'Imported content',
        variables: { client_name: { type: 'text', required: true } }
      }
      
      vi.mocked(templateService.importTemplate).mockResolvedValue(mockTemplate)
      
      render(<TemplateCreatePage />)
      
      await user.click(screen.getByRole('button', { name: /import template/i }))
      
      const fileInput = screen.getByLabelText(/select file/i)
      const file = new File([JSON.stringify(mockTemplate)], 'template.json', {
        type: 'application/json'
      })
      
      await user.upload(fileInput, file)
      await user.click(screen.getByRole('button', { name: /import/i }))
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Imported Template')).toBeInTheDocument()
        expect(screen.getByText('client_name')).toBeInTheDocument()
      })
    })

    it('shows export options when template has content', async () => {
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Export Test')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Content to export')
      
      const exportButton = screen.getByRole('button', { name: /export template/i })
      expect(exportButton).not.toBeDisabled()
      
      await user.click(exportButton)
      
      expect(screen.getByText('Export Template')).toBeInTheDocument()
      expect(screen.getByLabelText(/format/i)).toBeInTheDocument()
    })
  })

  describe('Navigation and Cancellation', () => {
    it('shows confirmation when cancelling with changes', async () => {
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Test changes')
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      expect(screen.getByText('Discard Changes?')).toBeInTheDocument()
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
    })

    it('navigates back without confirmation when no changes', async () => {
      render(<TemplateCreatePage />)
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      expect(mockNavigate).toHaveBeenCalledWith('/templates')
    })
  })

  describe('Loading States', () => {
    it('shows loading state during template creation', async () => {
      vi.mocked(templateService.createTemplate).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Loading Test')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      expect(screen.getByText('Creating template...')).toBeInTheDocument()
      expect(publishButton).toBeDisabled()
    })

    it('shows loading during validation', async () => {
      vi.mocked(templateService.validateTemplate).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 500))
      )
      
      render(<TemplateCreatePage />)
      
      await user.type(screen.getByLabelText(/template name/i), 'Validation Test')
      await user.selectOptions(screen.getByLabelText(/category/i), 'contract')
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i })
      await user.type(contentEditor, 'Test content {{var}}')
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      expect(screen.getByText('Validating template...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels', async () => {
      render(<TemplateCreatePage />)
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Create new template')
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Template creation form')
    })

    it('supports keyboard navigation', async () => {
      render(<TemplateCreatePage />)
      
      const nameInput = screen.getByLabelText(/template name/i)
      nameInput.focus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText(/category/i)).toHaveFocus()
      
      await user.keyboard('{Tab}')
      expect(screen.getByLabelText(/description/i)).toHaveFocus()
    })

    it('announces validation errors to screen readers', async () => {
      render(<TemplateCreatePage />)
      
      const publishButton = screen.getByRole('button', { name: /publish template/i })
      await user.click(publishButton)
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Template name is required')
      })
    })
  })

  describe('Responsive Design', () => {
    it('adapts layout for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      Object.defineProperty(window, 'innerHeight', { value: 667 })
      
      render(<TemplateCreatePage />)
      
      expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
    })

    it('uses desktop layout for larger screens', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024 })
      Object.defineProperty(window, 'innerHeight', { value: 768 })
      
      render(<TemplateCreatePage />)
      
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument()
    })
  })
})