/**
 * TemplateEditorPage Test Suite
 * Following strict TDD methodology with comprehensive coverage
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateEditorPage } from '../TemplateEditorPage';
import { templateService } from '../../../services/template.service';

// Mock the template service
vi.mock('../../../services/template.service');
const mockTemplateService = vi.mocked(templateService);

// Mock data
const mockTemplate = {
  id: 'template-1',
  name: 'Sample Contract',
  category: 'Legal',
  description: 'A sample contract template',
  content: '<p>This is a sample contract with {{company_name}} and {{client_name}}.</p>',
  variables: {
    company_name: {
      type: 'text' as const,
      required: true,
      description: 'Company name'
    },
    client_name: {
      type: 'text' as const,
      required: true,
      description: 'Client name'
    }
  },
  version: '1.0',
  is_active: true,
  usage_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  metadata: { tags: ['contract', 'legal'] }
};

const mockVersions = [
  {
    id: 'version-1',
    version: '1.0',
    created_at: '2024-01-01T00:00:00Z',
    created_by: 'user@example.com',
    changes: 'Initial version'
  },
  {
    id: 'version-2',
    version: '1.1',
    created_at: '2024-01-02T00:00:00Z',
    created_by: 'user@example.com',
    changes: 'Added client_name variable'
  }
];

const mockClauses = [
  {
    id: 'clause-1',
    name: 'Liability Clause',
    content: 'The company shall not be liable...',
    category: 'Liability',
    risk_level: 'medium' as const
  },
  {
    id: 'clause-2',
    name: 'Termination Clause',
    content: 'This agreement may be terminated...',
    category: 'Termination',
    risk_level: 'low' as const
  }
];

const mockValidationResult = {
  is_valid: true,
  errors: [],
  warnings: []
};

const mockPreview = {
  content: '<p>This is a sample contract with ACME Corp and John Doe.</p>',
  variables_used: ['company_name', 'client_name'],
  warnings: []
};

// Helper function to render component with router
const renderWithRouter = (initialEntries: string[] = ['/templates/editor']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/templates/editor" element={<TemplateEditorPage />} />
        <Route path="/templates/editor/:id" element={<TemplateEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TemplateEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
    mockTemplateService.createTemplate.mockResolvedValue(mockTemplate);
    mockTemplateService.updateTemplate.mockResolvedValue(mockTemplate);
    mockTemplateService.validateTemplate.mockResolvedValue(mockValidationResult);
    mockTemplateService.previewTemplate.mockResolvedValue(mockPreview);
    mockTemplateService.getVersions.mockResolvedValue(mockVersions);
    mockTemplateService.getClauses.mockResolvedValue(mockClauses);
    mockTemplateService.exportTemplate.mockResolvedValue({
      template: mockTemplate,
      format: 'json'
    });
    
    // Mock auto-save timer
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Component Initialization', () => {
    it('should render create mode when no ID provided', () => {
      renderWithRouter(['/templates/editor']);
      
      expect(screen.getByText('Create New Template')).toBeInTheDocument();
      expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument();
    });

    it('should render edit mode when ID provided', async () => {
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('template-1');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Edit Template')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Sample Contract')).toBeInTheDocument();
      });
    });

    it('should show loading state during template fetch', () => {
      mockTemplateService.getTemplate.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      
      renderWithRouter(['/templates/editor/template-1']);
      
      expect(screen.getByText('Loading template...')).toBeInTheDocument();
    });

    it('should handle template fetch error', async () => {
      mockTemplateService.getTemplate.mockRejectedValue(new Error('Template not found'));
      
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load template/i)).toBeInTheDocument();
      });
    });
  });

  describe('Rich Text Editor', () => {
    it('should display rich text editor with toolbar', () => {
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      expect(editor).toBeInTheDocument();
      
      // Toolbar buttons
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bullet list/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /insert variable/i })).toBeInTheDocument();
    });

    it('should handle text formatting', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      const boldButton = screen.getByRole('button', { name: /bold/i });
      
      await user.type(editor, 'Sample text');
      await user.selectAll();
      await user.click(boldButton);
      
      expect(editor.innerHTML).toContain('<b>Sample text</b>');
    });

    it('should insert variables into content', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      // First add a variable
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addVariableButton);
      
      const variableModal = screen.getByRole('dialog', { name: /add variable/i });
      await user.type(within(variableModal).getByLabelText(/variable name/i), 'test_var');
      await user.selectOptions(within(variableModal).getByLabelText(/type/i), 'text');
      await user.click(within(variableModal).getByRole('button', { name: /save/i }));
      
      // Then insert it into editor
      const insertVariableButton = screen.getByRole('button', { name: /insert variable/i });
      await user.click(insertVariableButton);
      
      const dropdown = screen.getByRole('combobox', { name: /select variable/i });
      await user.selectOptions(dropdown, 'test_var');
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      expect(editor.innerHTML).toContain('{{test_var}}');
    });

    it('should support undo/redo functionality', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      const undoButton = screen.getByRole('button', { name: /undo/i });
      const redoButton = screen.getByRole('button', { name: /redo/i });
      
      await user.type(editor, 'Original text');
      await user.type(editor, ' Additional text');
      
      await user.click(undoButton);
      expect(editor.innerHTML).toBe('Original text');
      
      await user.click(redoButton);
      expect(editor.innerHTML).toBe('Original text Additional text');
    });
  });

  describe('Variable Management', () => {
    it('should display variable management panel', () => {
      renderWithRouter();
      
      expect(screen.getByText('Variables')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add variable/i })).toBeInTheDocument();
    });

    it('should add new variable', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const addButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addButton);
      
      const modal = screen.getByRole('dialog', { name: /add variable/i });
      expect(modal).toBeInTheDocument();
      
      await user.type(within(modal).getByLabelText(/variable name/i), 'new_variable');
      await user.selectOptions(within(modal).getByLabelText(/type/i), 'text');
      await user.type(within(modal).getByLabelText(/description/i), 'Test variable');
      await user.click(within(modal).getByRole('checkbox', { name: /required/i }));
      
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      await waitFor(() => {
        expect(screen.getByText('new_variable')).toBeInTheDocument();
        expect(screen.getByText('Text (Required)')).toBeInTheDocument();
      });
    });

    it('should validate variable names', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const addButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addButton);
      
      const modal = screen.getByRole('dialog', { name: /add variable/i });
      
      // Try invalid name
      await user.type(within(modal).getByLabelText(/variable name/i), '123invalid');
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      expect(within(modal).getByText(/invalid variable name/i)).toBeInTheDocument();
    });

    it('should edit existing variable', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText('company_name')).toBeInTheDocument();
      });
      
      const editButton = screen.getAllByRole('button', { name: /edit variable/i })[0];
      await user.click(editButton);
      
      const modal = screen.getByRole('dialog', { name: /edit variable/i });
      const descriptionInput = within(modal).getByLabelText(/description/i);
      
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Updated company name');
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Updated company name')).toBeInTheDocument();
      });
    });

    it('should delete variable with confirmation', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText('company_name')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getAllByRole('button', { name: /delete variable/i })[0];
      await user.click(deleteButton);
      
      const confirmDialog = screen.getByRole('dialog', { name: /confirm delete/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /delete/i }));
      
      await waitFor(() => {
        expect(screen.queryByText('company_name')).not.toBeInTheDocument();
      });
    });

    it('should handle select variable with options', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const addButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addButton);
      
      const modal = screen.getByRole('dialog', { name: /add variable/i });
      
      await user.type(within(modal).getByLabelText(/variable name/i), 'status');
      await user.selectOptions(within(modal).getByLabelText(/type/i), 'select');
      
      // Options field should appear
      const optionsTextarea = within(modal).getByLabelText(/options/i);
      await user.type(optionsTextarea, 'Active\nInactive\nPending');
      
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      await waitFor(() => {
        expect(screen.getByText('status')).toBeInTheDocument();
        expect(screen.getByText('Dropdown')).toBeInTheDocument();
      });
    });
  });

  describe('Conditional Logic', () => {
    it('should display logic rules panel', () => {
      renderWithRouter();
      
      expect(screen.getByText('Logic Rules')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add logic rule/i })).toBeInTheDocument();
    });

    it('should add conditional logic block', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const addButton = screen.getByRole('button', { name: /add logic rule/i });
      await user.click(addButton);
      
      const modal = screen.getByRole('dialog', { name: /add logic rule/i });
      
      await user.selectOptions(within(modal).getByLabelText(/rule type/i), 'if');
      await user.type(within(modal).getByLabelText(/condition/i), 'status == "Active"');
      await user.type(within(modal).getByLabelText(/content/i), 'This contract is active');
      
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      await waitFor(() => {
        expect(screen.getByText('If/Then: status == "Active"')).toBeInTheDocument();
      });
    });

    it('should support different logic rule types', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const addButton = screen.getByRole('button', { name: /add logic rule/i });
      await user.click(addButton);
      
      const modal = screen.getByRole('dialog', { name: /add logic rule/i });
      const typeSelect = within(modal).getByLabelText(/rule type/i);
      
      expect(within(typeSelect).getByText('If/Then Condition')).toBeInTheDocument();
      expect(within(typeSelect).getByText('Loop/Repeat')).toBeInTheDocument();
      expect(within(typeSelect).getByText('Multiple Conditions')).toBeInTheDocument();
    });
  });

  describe('Clause Library', () => {
    it('should display clause library panel', async () => {
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(mockTemplateService.getClauses).toHaveBeenCalledWith('template-1');
      });
      
      expect(screen.getByText('Clause Library')).toBeInTheDocument();
      expect(screen.getByText('Liability Clause')).toBeInTheDocument();
      expect(screen.getByText('Termination Clause')).toBeInTheDocument();
    });

    it('should support drag and drop for clauses', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText('Liability Clause')).toBeInTheDocument();
      });
      
      const clauseItem = screen.getByText('Liability Clause').closest('[draggable="true"]');
      const editor = screen.getByRole('textbox', { name: /content/i });
      
      expect(clauseItem).toHaveAttribute('draggable', 'true');
      
      // Simulate drag and drop
      fireEvent.dragStart(clauseItem!);
      fireEvent.dragOver(editor);
      fireEvent.drop(editor);
      
      expect(editor.innerHTML).toContain('The company shall not be liable...');
    });

    it('should add clause to template', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText('Liability Clause')).toBeInTheDocument();
      });
      
      const addButton = screen.getAllByRole('button', { name: /add clause/i })[0];
      await user.click(addButton);
      
      expect(mockTemplateService.addClause).toHaveBeenCalledWith('template-1', {
        clause_id: 'clause-1',
        position: undefined,
        is_optional: false
      });
    });
  });

  describe('Live Preview', () => {
    it('should display preview panel', () => {
      renderWithRouter();
      
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh preview/i })).toBeInTheDocument();
    });

    it('should toggle preview panel', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const toggleButton = screen.getByRole('button', { name: /toggle preview/i });
      
      // Preview should be visible by default
      expect(screen.getByText('Preview')).toBeInTheDocument();
      
      await user.click(toggleButton);
      
      expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    });

    it('should refresh preview with sample data', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh preview/i })).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByRole('button', { name: /refresh preview/i });
      await user.click(refreshButton);
      
      expect(mockTemplateService.previewTemplate).toHaveBeenCalledWith('template-1', {
        use_sample_data: true
      });
      
      await waitFor(() => {
        expect(screen.getByText(/ACME Corp/)).toBeInTheDocument();
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });
    });

    it('should show preview with custom variable values', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/company_name/i)).toBeInTheDocument();
      });
      
      // Set custom values in preview inputs
      const companyInput = screen.getByLabelText(/company_name/i);
      const clientInput = screen.getByLabelText(/client_name/i);
      
      await user.clear(companyInput);
      await user.type(companyInput, 'Custom Corp');
      await user.clear(clientInput);
      await user.type(clientInput, 'Jane Smith');
      
      const refreshButton = screen.getByRole('button', { name: /refresh preview/i });
      await user.click(refreshButton);
      
      expect(mockTemplateService.previewTemplate).toHaveBeenCalledWith('template-1', {
        variables: {
          company_name: 'Custom Corp',
          client_name: 'Jane Smith'
        }
      });
    });
  });

  describe('Version Control', () => {
    it('should display version history', async () => {
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(mockTemplateService.getVersions).toHaveBeenCalledWith('template-1');
      });
      
      const versionsButton = screen.getByRole('button', { name: /version history/i });
      await userEvent.setup().click(versionsButton);
      
      const modal = screen.getByRole('dialog', { name: /version history/i });
      expect(within(modal).getByText('1.0')).toBeInTheDocument();
      expect(within(modal).getByText('1.1')).toBeInTheDocument();
      expect(within(modal).getByText('Initial version')).toBeInTheDocument();
    });

    it('should create new version', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await user.click(saveButton);
      
      const modal = screen.getByRole('dialog', { name: /save template/i });
      const versionNotesInput = within(modal).getByLabelText(/version notes/i);
      
      await user.type(versionNotesInput, 'Updated content and variables');
      await user.click(within(modal).getByRole('button', { name: /save/i }));
      
      expect(mockTemplateService.createVersion).toHaveBeenCalledWith('template-1', {
        changes: 'Updated content and variables',
        content: expect.any(String)
      });
    });

    it('should revert to previous version', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      const versionsButton = screen.getByRole('button', { name: /version history/i });
      await user.click(versionsButton);
      
      const modal = screen.getByRole('dialog', { name: /version history/i });
      const revertButton = within(modal).getAllByRole('button', { name: /revert/i })[0];
      
      await user.click(revertButton);
      
      const confirmDialog = screen.getByRole('dialog', { name: /confirm revert/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /revert/i }));
      
      expect(mockTemplateService.revertToVersion).toHaveBeenCalledWith('template-1', 'version-1');
    });
  });

  describe('Template Metadata', () => {
    it('should edit template metadata', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Sample Contract')).toBeInTheDocument();
      });
      
      const nameInput = screen.getByLabelText(/template name/i);
      const categorySelect = screen.getByLabelText(/category/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Contract Template');
      
      await user.selectOptions(categorySelect, 'HR');
      
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Updated description');
      
      expect(nameInput).toHaveValue('Updated Contract Template');
      expect(categorySelect).toHaveValue('HR');
      expect(descriptionInput).toHaveValue('Updated description');
    });

    it('should manage template tags', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText('contract')).toBeInTheDocument();
        expect(screen.getByText('legal')).toBeInTheDocument();
      });
      
      const addTagButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addTagButton);
      
      const tagInput = screen.getByLabelText(/new tag/i);
      await user.type(tagInput, 'important');
      await user.press(tagInput, 'Enter');
      
      expect(screen.getByText('important')).toBeInTheDocument();
      
      // Remove tag
      const removeTagButton = screen.getByRole('button', { name: /remove tag important/i });
      await user.click(removeTagButton);
      
      expect(screen.queryByText('important')).not.toBeInTheDocument();
    });
  });

  describe('Real-time Validation', () => {
    it('should validate template content', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Invalid template {{unknown_var}}');
      
      // Wait for validation
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith({
          content: 'Invalid template {{unknown_var}}',
          variables: {}
        });
      });
    });

    it('should show validation errors', async () => {
      mockTemplateService.validateTemplate.mockResolvedValue({
        is_valid: false,
        errors: ['Unknown variable: unknown_var'],
        warnings: ['Consider adding description']
      });
      
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Invalid template {{unknown_var}}');
      
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByText(/unknown variable: unknown_var/i)).toBeInTheDocument();
        expect(screen.getByText(/consider adding description/i)).toBeInTheDocument();
      });
    });

    it('should show validation success indicator', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Valid template content');
      
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByText(/template is valid/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save/Publish Workflow', () => {
    it('should handle draft save', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      // Fill form
      await user.type(screen.getByLabelText(/template name/i), 'New Template');
      await user.type(screen.getByRole('textbox', { name: /content/i }), 'Template content');
      
      const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
      await user.click(saveDraftButton);
      
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith({
        name: 'New Template',
        category: '',
        content: 'Template content',
        variables: {},
        is_active: false,
        metadata: expect.any(Object)
      });
    });

    it('should handle publish', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      // Fill required fields
      await user.type(screen.getByLabelText(/template name/i), 'New Template');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Legal');
      await user.type(screen.getByRole('textbox', { name: /content/i }), 'Template content');
      
      const publishButton = screen.getByRole('button', { name: /publish/i });
      await user.click(publishButton);
      
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith({
        name: 'New Template',
        category: 'Legal',
        content: 'Template content',
        variables: {},
        is_active: true,
        metadata: expect.any(Object)
      });
    });

    it('should validate required fields before publish', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const publishButton = screen.getByRole('button', { name: /publish/i });
      await user.click(publishButton);
      
      expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
      expect(mockTemplateService.createTemplate).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+S for save', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await user.type(screen.getByLabelText(/template name/i), 'Test Template');
      await user.keyboard('{Control>}s{/Control}');
      
      expect(mockTemplateService.createTemplate).toHaveBeenCalled();
    });

    it('should handle Ctrl+Z for undo', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Some text');
      await user.keyboard('{Control>}z{/Control}');
      
      expect(editor.innerHTML).toBe('');
    });

    it('should handle Ctrl+Y for redo', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Some text');
      await user.keyboard('{Control>}z{/Control}');
      await user.keyboard('{Control>}y{/Control}');
      
      expect(editor.innerHTML).toBe('Some text');
    });

    it('should handle Ctrl+B for bold', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Bold text');
      await user.selectAll();
      await user.keyboard('{Control>}b{/Control}');
      
      expect(editor.innerHTML).toContain('<b>Bold text</b>');
    });
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save every 30 seconds', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await user.type(screen.getByLabelText(/template name/i), 'Auto Save Test');
      await user.type(screen.getByRole('textbox', { name: /content/i }), 'Content');
      
      // Advance timer by 30 seconds
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Auto Save Test',
            content: 'Content'
          })
        );
      });
    });

    it('should show auto-save indicator', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      await user.type(screen.getByLabelText(/template name/i), 'Auto Save Test');
      
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(screen.getByText(/auto-saved/i)).toBeInTheDocument();
      });
    });

    it('should not auto-save empty templates', () => {
      renderWithRouter();
      
      vi.advanceTimersByTime(30000);
      
      expect(mockTemplateService.createTemplate).not.toHaveBeenCalled();
    });
  });

  describe('Export Template', () => {
    it('should export template as JSON', async () => {
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);
      
      const modal = screen.getByRole('dialog', { name: /export template/i });
      const jsonOption = within(modal).getByLabelText(/json/i);
      
      await user.click(jsonOption);
      await user.click(within(modal).getByRole('button', { name: /export/i }));
      
      expect(mockTemplateService.exportTemplate).toHaveBeenCalledWith('template-1', 'json');
    });

    it('should handle export error', async () => {
      mockTemplateService.exportTemplate.mockRejectedValue(new Error('Export failed'));
      
      const user = userEvent.setup();
      renderWithRouter(['/templates/editor/template-1']);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);
      
      const modal = screen.getByRole('dialog', { name: /export template/i });
      await user.click(within(modal).getByRole('button', { name: /export/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      renderWithRouter();
      
      // Check for mobile-specific elements or behaviors
      expect(screen.getByRole('button', { name: /toggle panels/i })).toBeInTheDocument();
    });

    it('should collapse panels on small screens', async () => {
      const user = userEvent.setup();
      
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });
      
      renderWithRouter();
      
      const toggleButton = screen.getByRole('button', { name: /toggle panels/i });
      await user.click(toggleButton);
      
      expect(screen.queryByText('Variables')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      
      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/template name/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/category/i)).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();
    });

    it('should have proper ARIA labels', () => {
      renderWithRouter();
      
      expect(screen.getByRole('textbox', { name: /template name/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument();
    });

    it('should announce validation errors', async () => {
      mockTemplateService.validateTemplate.mockResolvedValue({
        is_valid: false,
        errors: ['Template name is required'],
        warnings: []
      });
      
      const user = userEvent.setup();
      renderWithRouter();
      
      const publishButton = screen.getByRole('button', { name: /publish/i });
      await user.click(publishButton);
      
      const errorRegion = screen.getByRole('alert');
      expect(errorRegion).toHaveTextContent(/template name is required/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      mockTemplateService.createTemplate.mockRejectedValue(new Error('Save failed'));
      
      const user = userEvent.setup();
      renderWithRouter();
      
      await user.type(screen.getByLabelText(/template name/i), 'Test Template');
      await user.click(screen.getByRole('button', { name: /save draft/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save template/i)).toBeInTheDocument();
      });
    });

    it('should handle validation errors', async () => {
      mockTemplateService.validateTemplate.mockRejectedValue(new Error('Validation service unavailable'));
      
      const user = userEvent.setup();
      renderWithRouter();
      
      const editor = screen.getByRole('textbox', { name: /content/i });
      await user.type(editor, 'Template content');
      
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByText(/validation unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      mockTemplateService.getTemplate.mockRejectedValue(new Error('Network error'));
      
      renderWithRouter(['/templates/editor/template-1']);
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });
});