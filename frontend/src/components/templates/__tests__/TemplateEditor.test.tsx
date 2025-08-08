import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TemplateEditor } from '../TemplateEditor';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Variable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'list' | 'currency';
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

interface Template {
  id?: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: Variable[];
  version?: string;
  status?: 'draft' | 'review' | 'approved' | 'deprecated';
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateEditorProps {
  template?: Template;
  isNew?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onSave?: (template: Template) => Promise<void>;
  onCancel?: () => void;
  onPreview?: (content: string, variables: Variable[]) => void;
  onVersionSave?: (template: Template, comment: string) => Promise<void>;
  onSubmitForReview?: (template: Template) => Promise<void>;
  onAutoSave?: (template: Template) => void;
  collaborators?: Array<{
    id: string;
    name: string;
    avatar?: string;
    isOnline: boolean;
    cursor?: { line: number; column: number };
  }>;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('TemplateEditor', () => {
  let queryClient: QueryClient;
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnPreview = vi.fn();
  const mockOnVersionSave = vi.fn();
  const mockOnSubmitForReview = vi.fn();
  const mockOnAutoSave = vi.fn();

  const existingTemplate: Template = {
    id: 't1',
    name: 'Software License Agreement',
    description: 'Standard software licensing template for SaaS products',
    category: 'Technology',
    content: `# SOFTWARE LICENSE AGREEMENT

This Agreement is entered into as of {{effective_date}} between {{company_name}} ("Licensor") and {{client_name}} ("Licensee").

## 1. LICENSE GRANT
Subject to the terms of this Agreement, Licensor grants Licensee a {{license_type}} license to use the Software.

## 2. PAYMENT TERMS
Licensee shall pay {{license_fee}} as the license fee.

{% if support_included %}
## 3. SUPPORT AND MAINTENANCE
Licensor will provide support and maintenance services as described in Schedule A.
{% endif %}`,
    variables: [
      {
        id: 'v1',
        name: 'effective_date',
        type: 'date',
        required: true,
        description: 'Agreement effective date',
      },
      {
        id: 'v2',
        name: 'company_name',
        type: 'text',
        required: true,
        description: 'Licensor company name',
      },
      {
        id: 'v3',
        name: 'client_name',
        type: 'text',
        required: true,
        description: 'Licensee company name',
      },
      {
        id: 'v4',
        name: 'license_type',
        type: 'list',
        required: true,
        description: 'Type of license',
        validation: {
          options: ['perpetual', 'subscription', 'trial'],
        },
      },
      {
        id: 'v5',
        name: 'license_fee',
        type: 'currency',
        required: true,
        description: 'License fee amount',
        validation: {
          min: 0,
        },
      },
      {
        id: 'v6',
        name: 'support_included',
        type: 'boolean',
        required: false,
        defaultValue: false,
        description: 'Include support section',
      },
    ],
    version: '1.0',
    status: 'draft',
    tags: ['software', 'saas', 'licensing'],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
  };

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'legal',
    permissions: ['create_templates', 'edit_templates', 'submit_for_review'],
  };

  const collaborators = [
    {
      id: 'user2',
      name: 'Jane Smith',
      avatar: '/avatars/jane.jpg',
      isOnline: true,
      cursor: { line: 5, column: 10 },
    },
    {
      id: 'user3',
      name: 'Bob Johnson',
      avatar: '/avatars/bob.jpg',
      isOnline: false,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      template: existingTemplate,
      currentUser,
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      onPreview: mockOnPreview,
      onVersionSave: mockOnVersionSave,
      onSubmitForReview: mockOnSubmitForReview,
      onAutoSave: mockOnAutoSave,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <TemplateEditor {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render template editor with all sections', () => {
      renderComponent();
      
      expect(screen.getByText('Template Editor')).toBeInTheDocument();
      expect(screen.getByLabelText('Template name')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /template content/i })).toBeInTheDocument();
    });

    it('should load existing template data', () => {
      renderComponent();
      
      expect(screen.getByDisplayValue('Software License Agreement')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Standard software licensing template for SaaS products')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Technology')).toBeInTheDocument();
    });

    it('should show empty form for new template', () => {
      renderComponent({ template: undefined, isNew: true });
      
      expect(screen.getByLabelText('Template name')).toHaveValue('');
      expect(screen.getByLabelText('Description')).toHaveValue('');
      expect(screen.getByLabelText('Category')).toHaveValue('');
    });

    it('should display version information', () => {
      renderComponent();
      
      expect(screen.getByText('Version 1.0')).toBeInTheDocument();
      expect(screen.getByText(/draft/i)).toBeInTheDocument();
    });

    it('should show toolbar with formatting options', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /heading/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();
    });

    it('should display tags input', () => {
      renderComponent();
      
      expect(screen.getByText('software')).toBeInTheDocument();
      expect(screen.getByText('saas')).toBeInTheDocument();
      expect(screen.getByText('licensing')).toBeInTheDocument();
    });
  });

  describe('Content Editing', () => {
    it('should allow editing template content', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.clear(contentEditor);
      await userEvent.type(contentEditor, '# New Template Content');
      
      expect(contentEditor).toHaveValue('# New Template Content');
    });

    it('should apply formatting to selected text', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, 'Some text');
      
      // Select text
      contentEditor.setSelectionRange(0, 4);
      
      const boldButton = screen.getByRole('button', { name: /bold/i });
      await userEvent.click(boldButton);
      
      expect(contentEditor.value).toContain('**Some**');
    });

    it('should support undo and redo', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      const originalContent = contentEditor.value;
      
      await userEvent.type(contentEditor, ' Additional text');
      
      const undoButton = screen.getByRole('button', { name: /undo/i });
      await userEvent.click(undoButton);
      
      expect(contentEditor).toHaveValue(originalContent);
      
      const redoButton = screen.getByRole('button', { name: /redo/i });
      await userEvent.click(redoButton);
      
      expect(contentEditor.value).toContain('Additional text');
    });

    it('should highlight syntax for variables', () => {
      renderComponent();
      
      const variableHighlights = screen.getAllByTestId(/variable-highlight/i);
      expect(variableHighlights.length).toBeGreaterThan(0);
    });

    it('should show line numbers', () => {
      renderComponent();
      
      const lineNumbers = screen.getByTestId('line-numbers');
      expect(lineNumbers).toBeInTheDocument();
    });
  });

  describe('Variable Management', () => {
    it('should display variables panel', () => {
      renderComponent();
      
      expect(screen.getByText('Variables')).toBeInTheDocument();
      expect(screen.getByText('effective_date')).toBeInTheDocument();
      expect(screen.getByText('company_name')).toBeInTheDocument();
      expect(screen.getByText('client_name')).toBeInTheDocument();
    });

    it('should allow adding new variable', async () => {
      renderComponent();
      
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await userEvent.click(addVariableButton);
      
      const variableNameInput = screen.getByLabelText('Variable name');
      await userEvent.type(variableNameInput, 'new_variable');
      
      const variableTypeSelect = screen.getByLabelText('Variable type');
      await userEvent.selectOptions(variableTypeSelect, 'text');
      
      const saveVariableButton = screen.getByRole('button', { name: /save variable/i });
      await userEvent.click(saveVariableButton);
      
      expect(screen.getByText('new_variable')).toBeInTheDocument();
    });

    it('should allow editing existing variable', async () => {
      renderComponent();
      
      const editButton = screen.getAllByRole('button', { name: /edit variable/i })[0];
      await userEvent.click(editButton);
      
      const descriptionInput = screen.getByLabelText('Description');
      await userEvent.clear(descriptionInput);
      await userEvent.type(descriptionInput, 'Updated description');
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText('Updated description')).toBeInTheDocument();
    });

    it('should allow deleting variable', async () => {
      renderComponent();
      
      const deleteButton = screen.getAllByRole('button', { name: /delete variable/i })[0];
      await userEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);
      
      expect(screen.queryByText('effective_date')).not.toBeInTheDocument();
    });

    it('should insert variable at cursor position', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      contentEditor.focus();
      contentEditor.setSelectionRange(10, 10);
      
      const insertButton = screen.getAllByRole('button', { name: /insert variable/i })[0];
      await userEvent.click(insertButton);
      
      expect(contentEditor.value).toContain('{{effective_date}}');
    });

    it('should validate variable names', async () => {
      renderComponent();
      
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await userEvent.click(addVariableButton);
      
      const variableNameInput = screen.getByLabelText('Variable name');
      await userEvent.type(variableNameInput, 'invalid name!');
      
      expect(screen.getByText(/invalid variable name/i)).toBeInTheDocument();
    });

    it('should show variable usage count', () => {
      renderComponent();
      
      const variableCard = screen.getByTestId('variable-effective_date');
      expect(variableCard).toHaveTextContent(/used: 1/i);
    });
  });

  describe('Logic Builder', () => {
    it('should display logic builder panel', () => {
      renderComponent();
      
      const logicTab = screen.getByRole('tab', { name: /logic/i });
      fireEvent.click(logicTab);
      
      expect(screen.getByText('Conditional Logic')).toBeInTheDocument();
    });

    it('should allow adding if condition', async () => {
      renderComponent();
      
      const addConditionButton = screen.getByRole('button', { name: /add condition/i });
      await userEvent.click(addConditionButton);
      
      const conditionSelect = screen.getByLabelText('If variable');
      await userEvent.selectOptions(conditionSelect, 'support_included');
      
      const insertConditionButton = screen.getByRole('button', { name: /insert condition/i });
      await userEvent.click(insertConditionButton);
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      expect(contentEditor.value).toContain('{% if support_included %}');
    });

    it('should allow adding for loop', async () => {
      renderComponent();
      
      const addLoopButton = screen.getByRole('button', { name: /add loop/i });
      await userEvent.click(addLoopButton);
      
      const loopVariableInput = screen.getByLabelText('Loop variable');
      await userEvent.type(loopVariableInput, 'items');
      
      const insertLoopButton = screen.getByRole('button', { name: /insert loop/i });
      await userEvent.click(insertLoopButton);
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      expect(contentEditor.value).toContain('{% for item in items %}');
    });

    it('should validate logic syntax', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, '{% if unclosed_condition');
      
      expect(screen.getByText(/unclosed conditional block/i)).toBeInTheDocument();
    });

    it('should show logic block visualization', () => {
      renderComponent();
      
      const logicVisualization = screen.getByTestId('logic-visualization');
      expect(logicVisualization).toBeInTheDocument();
      expect(logicVisualization).toHaveTextContent(/if support_included/i);
    });
  });

  describe('Preview Mode', () => {
    it('should toggle preview mode', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await userEvent.click(previewButton);
      
      expect(screen.getByTestId('template-preview')).toBeInTheDocument();
    });

    it('should show rendered template with sample data', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await userEvent.click(previewButton);
      
      expect(mockOnPreview).toHaveBeenCalledWith(
        expect.stringContaining('SOFTWARE LICENSE AGREEMENT'),
        expect.any(Array)
      );
    });

    it('should allow editing sample values', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await userEvent.click(previewButton);
      
      const sampleValueInput = screen.getByLabelText('Sample value for company_name');
      await userEvent.clear(sampleValueInput);
      await userEvent.type(sampleValueInput, 'Test Company');
      
      const refreshButton = screen.getByRole('button', { name: /refresh preview/i });
      await userEvent.click(refreshButton);
      
      expect(mockOnPreview).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ name: 'company_name' })
        ])
      );
    });

    it('should switch between preview and edit modes', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview/i });
      await userEvent.click(previewButton);
      
      expect(screen.getByTestId('template-preview')).toBeInTheDocument();
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await userEvent.click(editButton);
      
      expect(screen.getByRole('textbox', { name: /template content/i })).toBeInTheDocument();
    });
  });

  describe('Collaboration Features', () => {
    it('should display collaborators', () => {
      renderComponent({ collaborators });
      
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should show online status', () => {
      renderComponent({ collaborators });
      
      const janeStatus = screen.getByTestId('collaborator-user2-status');
      const bobStatus = screen.getByTestId('collaborator-user3-status');
      
      expect(janeStatus).toHaveClass('online');
      expect(bobStatus).toHaveClass('offline');
    });

    it('should display cursor positions', () => {
      renderComponent({ collaborators });
      
      const janeCursor = screen.getByTestId('cursor-user2');
      expect(janeCursor).toBeInTheDocument();
      expect(janeCursor).toHaveStyle({ top: expect.any(String) });
    });

    it('should show collaboration activity', () => {
      renderComponent({ collaborators });
      
      expect(screen.getByText(/jane smith is editing/i)).toBeInTheDocument();
    });

    it('should allow mentioning collaborators', async () => {
      renderComponent({ collaborators });
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, '@Jane');
      
      expect(screen.getByText(/mention jane smith/i)).toBeInTheDocument();
    });
  });

  describe('Save and Version Control', () => {
    it('should save template', async () => {
      renderComponent();
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Software License Agreement',
            content: expect.any(String),
          })
        );
      });
    });

    it('should validate before saving', async () => {
      renderComponent();
      
      const nameInput = screen.getByLabelText('Template name');
      await userEvent.clear(nameInput);
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should auto-save periodically', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, ' Auto-saved content');
      
      await waitFor(() => {
        expect(mockOnAutoSave).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should save new version with comment', async () => {
      renderComponent();
      
      const versionButton = screen.getByRole('button', { name: /save version/i });
      await userEvent.click(versionButton);
      
      const commentInput = screen.getByLabelText('Version comment');
      await userEvent.type(commentInput, 'Updated payment terms');
      
      const saveVersionButton = screen.getByRole('button', { name: /save new version/i });
      await userEvent.click(saveVersionButton);
      
      expect(mockOnVersionSave).toHaveBeenCalledWith(
        expect.any(Object),
        'Updated payment terms'
      );
    });

    it('should show unsaved changes warning', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, ' Unsaved changes');
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);
      
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });

    it('should submit for review', async () => {
      renderComponent();
      
      const submitButton = screen.getByRole('button', { name: /submit for review/i });
      await userEvent.click(submitButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm submission/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnSubmitForReview).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Software License Agreement',
        })
      );
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save with Ctrl+S', async () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should toggle preview with Ctrl+P', () => {
      renderComponent();
      
      fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
      
      expect(screen.getByTestId('template-preview')).toBeInTheDocument();
    });

    it('should undo with Ctrl+Z', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      const originalContent = contentEditor.value;
      
      await userEvent.type(contentEditor, ' New text');
      fireEvent.keyDown(contentEditor, { key: 'z', ctrlKey: true });
      
      expect(contentEditor).toHaveValue(originalContent);
    });

    it('should redo with Ctrl+Y', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, ' New text');
      
      fireEvent.keyDown(contentEditor, { key: 'z', ctrlKey: true });
      fireEvent.keyDown(contentEditor, { key: 'y', ctrlKey: true });
      
      expect(contentEditor.value).toContain('New text');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /template editor/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /template metadata/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /variables panel/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const nameInput = screen.getByLabelText('Template name');
      nameInput.focus();
      
      fireEvent.keyDown(nameInput, { key: 'Tab' });
      const descriptionInput = screen.getByLabelText('Description');
      expect(descriptionInput).toHaveFocus();
    });

    it('should announce save status', async () => {
      renderComponent();
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/template saved/i);
      });
    });

    it('should provide keyboard shortcut hints', () => {
      renderComponent();
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      expect(saveButton).toHaveAttribute('title', expect.stringContaining('Ctrl+S'));
    });
  });

  describe('Error Handling', () => {
    it('should display error message on save failure', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save template/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid template syntax', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, '{{invalid_variable');
      
      expect(screen.getByText(/invalid variable syntax/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      renderComponent({ template: undefined, isNew: true });
      
      const saveButton = screen.getByRole('button', { name: /save template/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
    });

    it('should recover from auto-save failure', async () => {
      mockOnAutoSave.mockRejectedValue(new Error('Auto-save failed'));
      
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      await userEvent.type(contentEditor, ' Auto-save test');
      
      await waitFor(() => {
        expect(screen.getByText(/auto-save failed/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Performance', () => {
    it('should handle large templates efficiently', async () => {
      const largeTemplate = {
        ...existingTemplate,
        content: 'x'.repeat(100000), // 100KB of content
      };
      
      renderComponent({ template: largeTemplate });
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      expect(contentEditor).toBeInTheDocument();
    });

    it('should debounce auto-save', async () => {
      renderComponent();
      
      const contentEditor = screen.getByRole('textbox', { name: /template content/i });
      
      // Type multiple times quickly
      for (let i = 0; i < 10; i++) {
        await userEvent.type(contentEditor, 'x');
      }
      
      await waitFor(() => {
        // Should only auto-save once after debounce period
        expect(mockOnAutoSave).toHaveBeenCalledTimes(1);
      }, { timeout: 3000 });
    });
  });
});