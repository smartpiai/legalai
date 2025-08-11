/**
 * TemplateEditorPage - Rich template editor with full feature set
 * Following TDD methodology - implements all test requirements
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Bold, Italic, List, ListOrdered, Save, Eye, EyeOff, History, 
  Download, Upload, Plus, Edit2, Trash2, Copy, Settings,
  ChevronLeft, ChevronRight, RefreshCw, AlertCircle, CheckCircle,
  X, Tag, Undo, Redo
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { templateService } from '../../services/template.service';

// Types from template service and creation types
interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables?: Record<string, TemplateVariable>;
  version?: string;
  is_active?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface TemplateVariable {
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  default_value?: any;
  options?: string[];
  validation?: string;
  description?: string;
}

interface TemplateVersion {
  id: string;
  version: string;
  created_at: string;
  created_by: string;
  changes: string;
}

interface TemplateClause {
  id: string;
  name: string;
  content: string;
  category: string;
  risk_level: 'low' | 'medium' | 'high';
  is_optional?: boolean;
}

interface LogicRule {
  id: string;
  type: 'if' | 'for' | 'switch';
  condition: string;
  content: string;
}

interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PreviewResult {
  content: string;
  variables_used: string[];
  warnings: string[];
}

// Editor state interface
interface EditorState {
  template: Partial<Template>;
  variables: Record<string, TemplateVariable>;
  logicRules: LogicRule[];
  clauses: TemplateClause[];
  versions: TemplateVersion[];
  validation: ValidationResult | null;
  preview: PreviewResult | null;
  previewVariables: Record<string, any>;
  tags: string[];
  isLoading: boolean;
  isSaving: boolean;
  isValidating: boolean;
  isPreviewing: boolean;
  hasChanges: boolean;
  showPreview: boolean;
  showMobileMenu: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  errors: Record<string, string>;
}

// Modal states
interface ModalStates {
  variableModal: boolean;
  logicRuleModal: boolean;
  versionHistoryModal: boolean;
  exportModal: boolean;
  confirmDeleteVariable: string | null;
  confirmDeleteRule: string | null;
  confirmRevert: string | null;
  editingVariable: { name: string; data: TemplateVariable } | null;
  editingRule: LogicRule | null;
}

// Form data interfaces
interface VariableFormData {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  default_value?: any;
  options?: string[];
  description?: string;
}

interface LogicRuleFormData {
  type: 'if' | 'for' | 'switch';
  condition: string;
  content: string;
}

export const TemplateEditorPage: React.FC = () => {
  const { id: templateId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(templateId);

  // Editor content ref for rich text editing
  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // Main state
  const [state, setState] = useState<EditorState>({
    template: {
      name: '',
      category: '',
      description: '',
      content: '',
      is_active: false,
      metadata: { tags: [] }
    },
    variables: {},
    logicRules: [],
    clauses: [],
    versions: [],
    validation: null,
    preview: null,
    previewVariables: {},
    tags: [],
    isLoading: isEditMode,
    isSaving: false,
    isValidating: false,
    isPreviewing: false,
    hasChanges: false,
    showPreview: true,
    showMobileMenu: false,
    autoSaveStatus: 'idle',
    errors: {}
  });

  // Modal states
  const [modals, setModals] = useState<ModalStates>({
    variableModal: false,
    logicRuleModal: false,
    versionHistoryModal: false,
    exportModal: false,
    confirmDeleteVariable: null,
    confirmDeleteRule: null,
    confirmRevert: null,
    editingVariable: null,
    editingRule: null
  });

  // Form state for variable creation/editing
  const [variableForm, setVariableForm] = useState<VariableFormData>({
    name: '',
    type: 'text',
    required: false,
    description: ''
  });

  // Form state for logic rule creation/editing
  const [ruleForm, setRuleForm] = useState<LogicRuleFormData>({
    type: 'if',
    condition: '',
    content: ''
  });

  // History for undo/redo
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Load template data in edit mode
  useEffect(() => {
    if (isEditMode && templateId) {
      loadTemplate(templateId);
    }
  }, [templateId, isEditMode]);

  // Auto-save timer
  useEffect(() => {
    if (state.hasChanges && !isEditMode) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleAutoSave();
      }, 30000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.hasChanges, isEditMode]);

  // Validation debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.template.content) {
        validateTemplate();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [state.template.content, state.variables]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave(false);
            break;
          case 'z':
            e.preventDefault();
            handleUndo();
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 'b':
            e.preventDefault();
            if (document.activeElement === editorRef.current) {
              formatText('bold');
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Window resize handler for responsive design
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setState(prev => ({
        ...prev,
        showMobileMenu: window.innerWidth < 768 ? false : prev.showMobileMenu
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load template data
  const loadTemplate = async (id: string) => {
    try {
      const [template, versions, clauses] = await Promise.all([
        templateService.getTemplate(id),
        templateService.getVersions(id),
        templateService.getClauses(id)
      ]);

      setState(prev => ({
        ...prev,
        template,
        variables: template.variables || {},
        tags: template.metadata?.tags || [],
        versions,
        clauses,
        isLoading: false
      }));

      // Set editor content
      if (editorRef.current && template.content) {
        editorRef.current.innerHTML = template.content;
        setHistory([template.content]);
        setHistoryIndex(0);
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        errors: { general: error instanceof Error ? error.message : 'Failed to load template' }
      }));
    }
  };

  // Auto-save functionality
  const handleAutoSave = async () => {
    if (!state.template.name || !state.template.content) return;

    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));

    try {
      if (isEditMode && templateId) {
        await templateService.updateTemplate(templateId, {
          ...state.template,
          variables: state.variables,
          metadata: { ...state.template.metadata, tags: state.tags }
        });
      } else {
        const result = await templateService.createTemplate({
          ...state.template,
          variables: state.variables,
          is_active: false,
          metadata: { ...state.template.metadata, tags: state.tags }
        });
        if (result.id) {
          navigate(`/templates/editor/${result.id}`);
        }
      }

      setState(prev => ({
        ...prev,
        autoSaveStatus: 'saved',
        hasChanges: false
      }));
    } catch (error) {
      setState(prev => ({ ...prev, autoSaveStatus: 'error' }));
    }
  };

  // Validate template
  const validateTemplate = async () => {
    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await templateService.validateTemplate({
        content: state.template.content || '',
        variables: state.variables
      });

      setState(prev => ({
        ...prev,
        validation: result,
        isValidating: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        validation: {
          is_valid: false,
          errors: ['Validation unavailable'],
          warnings: []
        },
        isValidating: false
      }));
    }
  };

  // Save template
  const handleSave = async (publish = false) => {
    if (!validateForm()) return;

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const templateData = {
        ...state.template,
        variables: state.variables,
        is_active: publish,
        metadata: { ...state.template.metadata, tags: state.tags }
      };

      if (isEditMode && templateId) {
        await templateService.updateTemplate(templateId, templateData);
      } else {
        const result = await templateService.createTemplate(templateData);
        if (result.id) {
          navigate(`/templates/editor/${result.id}`);
        }
      }

      setState(prev => ({
        ...prev,
        isSaving: false,
        hasChanges: false,
        autoSaveStatus: 'saved'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        errors: { general: error instanceof Error ? error.message : 'Failed to save template' }
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!state.template.name?.trim()) {
      errors.name = 'Template name is required';
    }

    if (!state.template.category?.trim()) {
      errors.category = 'Category is required';
    }

    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // Create new version
  const handleCreateVersion = async (changes: string) => {
    if (!templateId) return;

    try {
      await templateService.createVersion(templateId, {
        changes,
        content: state.template.content || ''
      });

      const versions = await templateService.getVersions(templateId);
      setState(prev => ({ ...prev, versions }));
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  };

  // Revert to version
  const handleRevertToVersion = async (versionId: string) => {
    if (!templateId) return;

    try {
      await templateService.revertToVersion(templateId, versionId);
      await loadTemplate(templateId);
      setModals(prev => ({ ...prev, confirmRevert: null, versionHistoryModal: false }));
    } catch (error) {
      console.error('Failed to revert to version:', error);
    }
  };

  // Export template
  const handleExport = async (format: 'json' | 'yaml' | 'xml') => {
    if (!templateId) return;

    try {
      const result = await templateService.exportTemplate(templateId, format);
      
      // Create download
      const blob = new Blob([JSON.stringify(result.template, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.template.name || 'template'}.${format}`;
      a.click();
      
      URL.revokeObjectURL(url);
      setModals(prev => ({ ...prev, exportModal: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: { general: 'Export failed' }
      }));
    }
  };

  // Rich text editor functions
  const formatText = (command: string) => {
    document.execCommand(command, false);
    handleContentChange();
  };

  const insertVariable = (variableName: string) => {
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const variableNode = document.createTextNode(`{{${variableName}}}`);
        range.insertNode(variableNode);
        handleContentChange();
      }
    }
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      
      setState(prev => ({
        ...prev,
        template: { ...prev.template, content },
        hasChanges: true
      }));

      // Update history
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(content);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    }
  };

  // Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const content = history[newIndex];
      
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
        setState(prev => ({
          ...prev,
          template: { ...prev.template, content }
        }));
        setHistoryIndex(newIndex);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const content = history[newIndex];
      
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
        setState(prev => ({
          ...prev,
          template: { ...prev.template, content }
        }));
        setHistoryIndex(newIndex);
      }
    }
  };

  // Variable management
  const handleAddVariable = () => {
    setVariableForm({
      name: '',
      type: 'text',
      required: false,
      description: ''
    });
    setModals(prev => ({ ...prev, variableModal: true, editingVariable: null }));
  };

  const handleEditVariable = (name: string, variable: TemplateVariable) => {
    setVariableForm({
      name,
      type: variable.type,
      required: variable.required || false,
      default_value: variable.default_value,
      options: variable.options,
      description: variable.description || ''
    });
    setModals(prev => ({ 
      ...prev, 
      variableModal: true, 
      editingVariable: { name, data: variable } 
    }));
  };

  const handleSaveVariable = () => {
    if (!variableForm.name.trim()) return;

    // Validate variable name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableForm.name)) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, variableName: 'Invalid variable name' }
      }));
      return;
    }

    const variable: TemplateVariable = {
      type: variableForm.type,
      required: variableForm.required,
      default_value: variableForm.default_value,
      options: variableForm.options,
      description: variableForm.description
    };

    setState(prev => ({
      ...prev,
      variables: { ...prev.variables, [variableForm.name]: variable },
      hasChanges: true,
      errors: { ...prev.errors, variableName: '' }
    }));

    setModals(prev => ({ ...prev, variableModal: false, editingVariable: null }));
  };

  const handleDeleteVariable = (name: string) => {
    setState(prev => {
      const newVariables = { ...prev.variables };
      delete newVariables[name];
      return {
        ...prev,
        variables: newVariables,
        hasChanges: true
      };
    });
    setModals(prev => ({ ...prev, confirmDeleteVariable: null }));
  };

  // Logic rule management
  const handleAddLogicRule = () => {
    setRuleForm({
      type: 'if',
      condition: '',
      content: ''
    });
    setModals(prev => ({ ...prev, logicRuleModal: true, editingRule: null }));
  };

  const handleEditLogicRule = (rule: LogicRule) => {
    setRuleForm({
      type: rule.type,
      condition: rule.condition,
      content: rule.content
    });
    setModals(prev => ({ ...prev, logicRuleModal: true, editingRule: rule }));
  };

  const handleSaveLogicRule = () => {
    if (!ruleForm.condition.trim() || !ruleForm.content.trim()) return;

    const rule: LogicRule = {
      id: modals.editingRule?.id || `rule-${Date.now()}`,
      type: ruleForm.type,
      condition: ruleForm.condition,
      content: ruleForm.content
    };

    setState(prev => ({
      ...prev,
      logicRules: modals.editingRule 
        ? prev.logicRules.map(r => r.id === modals.editingRule?.id ? rule : r)
        : [...prev.logicRules, rule],
      hasChanges: true
    }));

    setModals(prev => ({ ...prev, logicRuleModal: false, editingRule: null }));
  };

  const handleDeleteLogicRule = (id: string) => {
    setState(prev => ({
      ...prev,
      logicRules: prev.logicRules.filter(r => r.id !== id),
      hasChanges: true
    }));
    setModals(prev => ({ ...prev, confirmDeleteRule: null }));
  };

  // Clause management
  const handleAddClause = async (clause: TemplateClause) => {
    if (!templateId) return;

    try {
      await templateService.addClause(templateId, {
        clause_id: clause.id,
        is_optional: clause.is_optional || false
      });

      // Add clause content to editor
      if (editorRef.current) {
        editorRef.current.innerHTML += `<p>${clause.content}</p>`;
        handleContentChange();
      }
    } catch (error) {
      console.error('Failed to add clause:', error);
    }
  };

  const handleDragClause = (clause: TemplateClause) => {
    return {
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', clause.content);
      }
    };
  };

  const handleDropInEditor = (e: React.DragEvent) => {
    e.preventDefault();
    const content = e.dataTransfer.getData('text/plain');
    if (content && editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const contentNode = document.createElement('p');
        contentNode.textContent = content;
        range.insertNode(contentNode);
        handleContentChange();
      }
    }
  };

  // Preview management
  const handleRefreshPreview = async () => {
    if (!templateId) return;

    setState(prev => ({ ...prev, isPreviewing: true }));

    try {
      const result = await templateService.previewTemplate(templateId, {
        use_sample_data: Object.keys(state.previewVariables).length === 0,
        variables: Object.keys(state.previewVariables).length > 0 
          ? state.previewVariables 
          : undefined
      });

      setState(prev => ({
        ...prev,
        preview: result,
        isPreviewing: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isPreviewing: false,
        errors: { ...prev.errors, preview: 'Preview failed' }
      }));
    }
  };

  // Tag management
  const handleAddTag = (tag: string) => {
    if (tag.trim() && !state.tags.includes(tag.trim())) {
      setState(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()],
        hasChanges: true
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setState(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
      hasChanges: true
    }));
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/templates')}
                icon={<ChevronLeft className="h-4 w-4" />}
              >
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Edit Template' : 'Create New Template'}
                </h1>
                {state.autoSaveStatus === 'saved' && (
                  <p className="text-sm text-green-600">Auto-saved</p>
                )}
                {state.autoSaveStatus === 'saving' && (
                  <p className="text-sm text-blue-600">Saving...</p>
                )}
                {state.autoSaveStatus === 'error' && (
                  <p className="text-sm text-red-600">Save failed</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Validation indicator */}
              {state.validation && (
                <div className="flex items-center space-x-1">
                  {state.validation.is_valid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">
                    {state.validation.is_valid ? 'Template is valid' : 'Has errors'}
                  </span>
                </div>
              )}

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setState(prev => ({ 
                  ...prev, 
                  showMobileMenu: !prev.showMobileMenu 
                }))}
                aria-label="Toggle panels"
              >
                {state.showMobileMenu ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              </Button>

              {/* Preview toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState(prev => ({ 
                  ...prev, 
                  showPreview: !prev.showPreview 
                }))}
                icon={state.showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                aria-label="Toggle preview"
              >
                {state.showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>

              {/* Action buttons */}
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSave(false)}
                  loading={state.isSaving}
                  disabled={!state.template.name}
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  loading={state.isSaving}
                  disabled={!validateForm()}
                >
                  Publish
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error display */}
      {(state.errors.general || state.validation?.errors.length) && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4" role="alert">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <div>
              {state.errors.general && (
                <p className="text-red-700">{state.errors.general}</p>
              )}
              {state.validation?.errors.map((error, index) => (
                <p key={index} className="text-red-700">{error}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {state.validation?.warnings.length && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
            <div>
              {state.validation.warnings.map((warning, index) => (
                <p key={index} className="text-yellow-700">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar - Template settings */}
          <div className={`lg:col-span-3 space-y-6 ${windowWidth < 768 && !state.showMobileMenu ? 'hidden' : ''}`}>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">Template Settings</h3>
              
              <div className="space-y-4">
                <Input
                  label="Template Name"
                  value={state.template.name || ''}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    template: { ...prev.template, name: e.target.value },
                    hasChanges: true
                  }))}
                  error={state.errors.name}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={state.template.category || ''}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      template: { ...prev.template, category: e.target.value },
                      hasChanges: true
                    }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Category"
                  >
                    <option value="">Select category</option>
                    <option value="Legal">Legal</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="IT">IT</option>
                  </select>
                  {state.errors.category && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={state.template.description || ''}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      template: { ...prev.template, description: e.target.value },
                      hasChanges: true
                    }))}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Description"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {state.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="h-2 w-2" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      placeholder="Add tag"
                      className="flex-1 rounded-l-md border border-gray-300 px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      aria-label="New tag"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-l-none"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        handleAddTag(input.value);
                        input.value = '';
                      }}
                      aria-label="Add tag"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Variables Panel */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Variables</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddVariable}
                  icon={<Plus className="h-4 w-4" />}
                  aria-label="Add variable"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(state.variables).map(([name, variable]) => (
                  <div key={name} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-gray-500">
                        {variable.type.charAt(0).toUpperCase() + variable.type.slice(1)}
                        {variable.required && ' (Required)'}
                      </div>
                      {variable.description && (
                        <div className="text-xs text-gray-400">{variable.description}</div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEditVariable(name, variable)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        aria-label="Edit variable"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setModals(prev => ({ 
                          ...prev, 
                          confirmDeleteVariable: name 
                        }))}
                        className="p-1 text-gray-400 hover:text-red-600"
                        aria-label="Delete variable"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logic Rules Panel */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Logic Rules</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddLogicRule}
                  icon={<Plus className="h-4 w-4" />}
                  aria-label="Add logic rule"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {state.logicRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {rule.type === 'if' && 'If/Then'}: {rule.condition}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{rule.content}</div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEditLogicRule(rule)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        aria-label="Edit rule"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setModals(prev => ({ 
                          ...prev, 
                          confirmDeleteRule: rule.id 
                        }))}
                        className="p-1 text-gray-400 hover:text-red-600"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main editor */}
          <div className={`${state.showPreview ? 'lg:col-span-6' : 'lg:col-span-9'} space-y-6`}>
            <div className="bg-white rounded-lg shadow">
              {/* Editor toolbar */}
              <div className="border-b border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex === 0}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      aria-label="Undo"
                    >
                      <Undo className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex === history.length - 1}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      aria-label="Redo"
                    >
                      <Redo className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                    <button
                      onClick={() => formatText('bold')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      aria-label="Bold"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => formatText('italic')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      aria-label="Italic"
                    >
                      <Italic className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                    <button
                      onClick={() => formatText('insertUnorderedList')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      aria-label="Bullet list"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => formatText('insertOrderedList')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      aria-label="Numbered list"
                    >
                      <ListOrdered className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      onChange={(e) => insertVariable(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      value=""
                      aria-label="Select variable"
                    >
                      <option value="">Insert variable</option>
                      {Object.keys(state.variables).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      aria-label="Insert variable"
                    >
                      Insert Variable
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editor content */}
              <div className="p-4">
                <label htmlFor="template-editor" className="sr-only">Template Content</label>
                <div
                  ref={editorRef}
                  contentEditable
                  className="min-h-96 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 prose max-w-none"
                  style={{ minHeight: '400px' }}
                  onInput={handleContentChange}
                  onDrop={handleDropInEditor}
                  onDragOver={(e) => e.preventDefault()}
                  role="textbox"
                  aria-label="Content"
                  aria-multiline="true"
                />
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                {isEditMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModals(prev => ({ 
                        ...prev, 
                        versionHistoryModal: true 
                      }))}
                      icon={<History className="h-4 w-4" />}
                      aria-label="Version history"
                    >
                      History
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModals(prev => ({ ...prev, exportModal: true }))}
                      icon={<Download className="h-4 w-4" />}
                      aria-label="Export"
                    >
                      Export
                    </Button>
                  </>
                )}
              </div>

              <div className="text-sm text-gray-500">
                {state.hasChanges && 'Unsaved changes'}
              </div>
            </div>
          </div>

          {/* Right sidebar - Preview and Clauses */}
          {state.showPreview && (
            <div className="lg:col-span-3 space-y-6">
              {/* Preview Panel */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Preview</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshPreview}
                    loading={state.isPreviewing}
                    icon={<RefreshCw className="h-4 w-4" />}
                    aria-label="Refresh preview"
                  >
                    Refresh
                  </Button>
                </div>

                {/* Preview variable inputs */}
                {Object.entries(state.variables).length > 0 && (
                  <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                    {Object.entries(state.variables).map(([name, variable]) => (
                      <Input
                        key={name}
                        label={name}
                        placeholder={variable.description || `Enter ${name}`}
                        value={state.previewVariables[name] || ''}
                        onChange={(e) => setState(prev => ({
                          ...prev,
                          previewVariables: {
                            ...prev.previewVariables,
                            [name]: e.target.value
                          }
                        }))}
                      />
                    ))}
                  </div>
                )}

                {/* Preview content */}
                <div className="border border-gray-200 rounded p-4 min-h-64 max-h-96 overflow-y-auto">
                  {state.preview ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: state.preview.content }}
                    />
                  ) : (
                    <p className="text-gray-500 text-sm">Preview will appear here</p>
                  )}
                </div>
              </div>

              {/* Clause Library */}
              {isEditMode && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium mb-4">Clause Library</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {state.clauses.map(clause => (
                      <div
                        key={clause.id}
                        draggable
                        {...handleDragClause(clause)}
                        className="p-3 border border-gray-200 rounded cursor-move hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{clause.name}</div>
                            <div className="text-xs text-gray-500">{clause.category}</div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                              {clause.content}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddClause(clause)}
                            className="ml-2"
                            aria-label="Add clause"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variable Modal */}
      {modals.variableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label={modals.editingVariable ? 'Edit Variable' : 'Add Variable'}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">
                {modals.editingVariable ? 'Edit Variable' : 'Add Variable'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <Input
                label="Variable Name"
                value={variableForm.name}
                onChange={(e) => setVariableForm(prev => ({ ...prev, name: e.target.value }))}
                error={state.errors.variableName}
                disabled={!!modals.editingVariable}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={variableForm.type}
                  onChange={(e) => setVariableForm(prev => ({ 
                    ...prev, 
                    type: e.target.value as TemplateVariable['type'] 
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Type"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>

              {variableForm.type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  <textarea
                    value={variableForm.options?.join('\n') || ''}
                    onChange={(e) => setVariableForm(prev => ({ 
                      ...prev, 
                      options: e.target.value.split('\n').filter(Boolean) 
                    }))}
                    placeholder="Enter each option on a new line"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Options"
                  />
                </div>
              )}

              <Input
                label="Description"
                value={variableForm.description}
                onChange={(e) => setVariableForm(prev => ({ ...prev, description: e.target.value }))}
              />

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="required"
                  checked={variableForm.required}
                  onChange={(e) => setVariableForm(prev => ({ ...prev, required: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="required" className="ml-2 block text-sm text-gray-700">
                  Required
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, variableModal: false }))}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveVariable}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Logic Rule Modal */}
      {modals.logicRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label={modals.editingRule ? 'Edit Logic Rule' : 'Add Logic Rule'}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">
                {modals.editingRule ? 'Edit Logic Rule' : 'Add Logic Rule'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type</label>
                <select
                  value={ruleForm.type}
                  onChange={(e) => setRuleForm(prev => ({ 
                    ...prev, 
                    type: e.target.value as LogicRule['type'] 
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Rule type"
                >
                  <option value="if">If/Then Condition</option>
                  <option value="for">Loop/Repeat</option>
                  <option value="switch">Multiple Conditions</option>
                </select>
              </div>

              <Input
                label="Condition"
                value={ruleForm.condition}
                onChange={(e) => setRuleForm(prev => ({ ...prev, condition: e.target.value }))}
                placeholder="e.g., status == 'active'"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  value={ruleForm.content}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Content to display when condition is met"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Content"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, logicRuleModal: false }))}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveLogicRule}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {modals.versionHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4" role="dialog" aria-label="Version History">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Version History</h3>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {state.versions.map(version => (
                  <div key={version.id} className="flex justify-between items-start p-4 border border-gray-200 rounded">
                    <div className="flex-1">
                      <div className="font-medium">Version {version.version}</div>
                      <div className="text-sm text-gray-500">{version.created_by}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(version.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm mt-1">{version.changes}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setModals(prev => ({ 
                        ...prev, 
                        confirmRevert: version.id 
                      }))}
                      aria-label="Revert"
                    >
                      Revert
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, versionHistoryModal: false }))}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {modals.exportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label="Export Template">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Export Template</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="radio" name="format" value="json" defaultChecked className="mr-2" />
                    JSON
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="format" value="yaml" className="mr-2" />
                    YAML
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="format" value="xml" className="mr-2" />
                    XML
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, exportModal: false }))}
              >
                Cancel
              </Button>
              <Button onClick={() => {
                const format = (document.querySelector('input[name="format"]:checked') as HTMLInputElement)?.value || 'json';
                handleExport(format as 'json' | 'yaml' | 'xml');
              }}>
                Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Variable Confirmation */}
      {modals.confirmDeleteVariable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label="Confirm Delete">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Confirm Delete</h3>
            </div>
            <div className="px-6 py-4">
              <p>Are you sure you want to delete the variable "{modals.confirmDeleteVariable}"?</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, confirmDeleteVariable: null }))}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDeleteVariable(modals.confirmDeleteVariable!)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation */}
      {modals.confirmDeleteRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label="Confirm Delete">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Confirm Delete</h3>
            </div>
            <div className="px-6 py-4">
              <p>Are you sure you want to delete this logic rule?</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, confirmDeleteRule: null }))}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDeleteLogicRule(modals.confirmDeleteRule!)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Confirmation */}
      {modals.confirmRevert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label="Confirm Revert">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Confirm Revert</h3>
            </div>
            <div className="px-6 py-4">
              <p>Are you sure you want to revert to this version? All current changes will be lost.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setModals(prev => ({ ...prev, confirmRevert: null }))}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRevertToVersion(modals.confirmRevert!)}
              >
                Revert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal (for creating versions) */}
      {state.isSaving && isEditMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-label="Save Template">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Save Template</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <Input
                label="Version Notes"
                placeholder="Describe what changed in this version"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateVersion(e.currentTarget.value);
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => setState(prev => ({ ...prev, isSaving: false }))}
              >
                Cancel
              </Button>
              <Button onClick={() => {
                const input = document.querySelector('input[placeholder*="Describe what changed"]') as HTMLInputElement;
                handleCreateVersion(input?.value || 'Template updated');
              }}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateEditorPage;
