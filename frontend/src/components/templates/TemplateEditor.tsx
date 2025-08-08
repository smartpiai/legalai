import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  ListNumberedIcon,
  Heading1Icon,
  CodeIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  EyeIcon,
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  VariableIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  UserGroupIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

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

type EditorTab = 'editor' | 'variables' | 'logic' | 'preview';

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  isNew = false,
  currentUser,
  onSave,
  onCancel,
  onPreview,
  onVersionSave,
  onSubmitForReview,
  onAutoSave,
  collaborators = [],
}) => {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || '');
  const [content, setContent] = useState(template?.content || '');
  const [variables, setVariables] = useState<Variable[]>(template?.variables || []);
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [activeTab, setActiveTab] = useState<EditorTab>('editor');
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [versionComment, setVersionComment] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [newVariable, setNewVariable] = useState<Partial<Variable>>({});
  const [tagInput, setTagInput] = useState('');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize preview values
  useEffect(() => {
    const initialValues: Record<string, any> = {};
    variables.forEach(v => {
      initialValues[v.name] = v.defaultValue || getSampleValue(v.type);
    });
    setPreviewValues(initialValues);
  }, [variables]);

  // Auto-save functionality
  useEffect(() => {
    if (isDirty && onAutoSave) {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
      
      autoSaveRef.current = setTimeout(() => {
        handleAutoSave();
      }, 2000); // 2 second debounce
    }
    
    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [content, isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'p':
            e.preventDefault();
            setActiveTab(activeTab === 'preview' ? 'editor' : 'preview');
            break;
          case 'z':
            if (!e.shiftKey) {
              e.preventDefault();
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, content]);

  const getSampleValue = (type: Variable['type']) => {
    switch (type) {
      case 'text': return 'Sample Text';
      case 'number': return 100;
      case 'date': return new Date().toISOString().split('T')[0];
      case 'boolean': return true;
      case 'currency': return 1000;
      case 'list': return 'Option 1';
      default: return '';
    }
  };

  const handleContentChange = (value: string) => {
    setUndoStack([...undoStack, content]);
    setRedoStack([]);
    setContent(value);
    setIsDirty(true);
    validateContent(value);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1];
      setRedoStack([...redoStack, content]);
      setContent(previousContent);
      setUndoStack(undoStack.slice(0, -1));
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[redoStack.length - 1];
      setUndoStack([...undoStack, content]);
      setContent(nextContent);
      setRedoStack(redoStack.slice(0, -1));
    }
  };

  const validateContent = (value: string) => {
    const newErrors: Record<string, string> = {};
    
    // Check for unclosed variables
    const openVars = (value.match(/{{/g) || []).length;
    const closeVars = (value.match(/}}/g) || []).length;
    if (openVars !== closeVars) {
      newErrors.content = 'Invalid variable syntax - unclosed brackets';
    }
    
    // Check for unclosed conditionals
    const ifBlocks = (value.match(/{%\s*if/g) || []).length;
    const endifBlocks = (value.match(/{%\s*endif/g) || []).length;
    if (ifBlocks !== endifBlocks) {
      newErrors.logic = 'Unclosed conditional block';
    }
    
    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!category.trim()) {
      newErrors.category = 'Category is required';
    }
    if (!content.trim()) {
      newErrors.content = 'Template content is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsSaving(true);
    setSaveStatus('');
    
    const templateData: Template = {
      ...template,
      name,
      description,
      category,
      content,
      variables,
      tags,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await onSave?.(templateData);
      setSaveStatus('Template saved successfully');
      setIsDirty(false);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setErrors({ save: 'Failed to save template' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoSave = async () => {
    const templateData: Template = {
      ...template,
      name,
      description,
      category,
      content,
      variables,
      tags,
    };
    
    try {
      await onAutoSave?.(templateData);
      setSaveStatus('Auto-saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      setSaveStatus('Auto-save failed');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleVersionSave = async () => {
    const templateData: Template = {
      ...template,
      name,
      description,
      category,
      content,
      variables,
      tags,
    };
    
    await onVersionSave?.(templateData, versionComment);
    setShowVersionDialog(false);
    setVersionComment('');
  };

  const handleSubmitForReview = async () => {
    const templateData: Template = {
      ...template,
      name,
      description,
      category,
      content,
      variables,
      tags,
      status: 'review',
    };
    
    await onSubmitForReview?.(templateData);
    setShowSubmitDialog(false);
  };

  const handlePreview = () => {
    if (activeTab === 'preview') {
      setActiveTab('editor');
    } else {
      setActiveTab('preview');
      onPreview?.(content, variables);
    }
  };

  const applyFormatting = (format: string) => {
    if (!contentRef.current) return;
    
    const start = contentRef.current.selectionStart;
    const end = contentRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'heading':
        formattedText = `# ${selectedText}`;
        break;
      case 'list':
        formattedText = `- ${selectedText}`;
        break;
      default:
        formattedText = selectedText;
    }
    
    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    handleContentChange(newContent);
  };

  const insertVariable = (variable: Variable) => {
    if (!contentRef.current) return;
    
    const position = contentRef.current.selectionStart;
    const newContent = 
      content.substring(0, position) + 
      `{{${variable.name}}}` + 
      content.substring(position);
    
    handleContentChange(newContent);
  };

  const insertCondition = (variable: string) => {
    if (!contentRef.current) return;
    
    const position = contentRef.current.selectionStart;
    const newContent = 
      content.substring(0, position) + 
      `{% if ${variable} %}\n\n{% endif %}` + 
      content.substring(position);
    
    handleContentChange(newContent);
  };

  const insertLoop = (variable: string) => {
    if (!contentRef.current) return;
    
    const position = contentRef.current.selectionStart;
    const newContent = 
      content.substring(0, position) + 
      `{% for item in ${variable} %}\n\n{% endfor %}` + 
      content.substring(position);
    
    handleContentChange(newContent);
  };

  const addVariable = () => {
    if (!newVariable.name || !newVariable.type) return;
    
    const variable: Variable = {
      id: `v${Date.now()}`,
      name: newVariable.name,
      type: newVariable.type as Variable['type'],
      required: newVariable.required || false,
      description: newVariable.description,
      defaultValue: newVariable.defaultValue,
      validation: newVariable.validation,
    };
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
      setErrors({ variableName: 'Invalid variable name' });
      return;
    }
    
    setVariables([...variables, variable]);
    setNewVariable({});
    setShowAddVariable(false);
    setIsDirty(true);
  };

  const updateVariable = (variable: Variable) => {
    setVariables(variables.map(v => v.id === variable.id ? variable : v));
    setEditingVariable(null);
    setIsDirty(true);
  };

  const deleteVariable = (variableId: string) => {
    setVariables(variables.filter(v => v.id !== variableId));
    setIsDirty(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setIsDirty(true);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    setIsDirty(true);
  };

  const getVariableUsageCount = (variableName: string) => {
    const regex = new RegExp(`{{\\s*${variableName}\\s*}}`, 'g');
    return (content.match(regex) || []).length;
  };

  const highlightSyntax = (text: string) => {
    // Simple syntax highlighting for variables and logic
    return text
      .replace(/{{([^}]+)}}/g, '<span data-testid="variable-highlight" class="text-blue-600">{{$1}}</span>')
      .replace(/{%([^%]+)%}/g, '<span class="text-purple-600">{%$1%}</span>');
  };

  const renderLineNumbers = () => {
    const lines = content.split('\n').length;
    return (
      <div data-testid="line-numbers" className="text-gray-400 text-sm pr-2 select-none">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i + 1}>{i + 1}</div>
        ))}
      </div>
    );
  };

  return (
    <div role="region" aria-label="Template editor" className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Template Editor</h1>
          <div className="flex items-center space-x-4">
            {template?.version && (
              <span className="text-sm text-gray-600">Version {template.version}</span>
            )}
            {template?.status && (
              <span className={`px-2 py-1 text-xs rounded ${
                template.status === 'approved' ? 'bg-green-100 text-green-800' :
                template.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                template.status === 'deprecated' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {template.status}
              </span>
            )}
            {saveStatus && (
              <span role="status" className="text-sm text-green-600">{saveStatus}</span>
            )}
            {isDirty && (
              <span className="text-sm text-orange-600">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div role="group" aria-label="Template metadata" className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
              Template name
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsDirty(true);
              }}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <label htmlFor="template-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              id="template-category"
              type="text"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setIsDirty(true);
              }}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>
          
          <div>
            <label htmlFor="template-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              id="template-description"
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag..."
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            <button
              onClick={addTag}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Add
            </button>
            {tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-50 border-b p-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => applyFormatting('bold')}
            className="p-2 hover:bg-gray-200 rounded"
            aria-label="Bold"
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => applyFormatting('italic')}
            className="p-2 hover:bg-gray-200 rounded"
            aria-label="Italic"
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => applyFormatting('underline')}
            className="p-2 hover:bg-gray-200 rounded"
            aria-label="Underline"
            title="Underline"
          >
            <u>U</u>
          </button>
          <button
            onClick={() => applyFormatting('heading')}
            className="p-2 hover:bg-gray-200 rounded"
            aria-label="Heading"
            title="Heading"
          >
            H
          </button>
          <button
            onClick={() => applyFormatting('list')}
            className="p-2 hover:bg-gray-200 rounded"
            aria-label="List"
            title="List"
          >
            •
          </button>
          <div className="border-l h-6 mx-2" />
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreview}
            className={`px-3 py-1 rounded ${
              activeTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
            aria-label={activeTab === 'preview' ? 'Edit' : 'Preview'}
            title="Preview (Ctrl+P)"
          >
            {activeTab === 'preview' ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          role="tab"
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 ${activeTab === 'editor' ? 'border-b-2 border-blue-600' : ''}`}
        >
          Editor
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab('variables')}
          className={`px-4 py-2 ${activeTab === 'variables' ? 'border-b-2 border-blue-600' : ''}`}
        >
          Variables
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab('logic')}
          className={`px-4 py-2 ${activeTab === 'logic' ? 'border-b-2 border-blue-600' : ''}`}
        >
          Logic
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor/Preview */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'preview' ? (
            <div data-testid="template-preview" className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Sample Values</h3>
                <div className="grid grid-cols-2 gap-2">
                  {variables.map(v => (
                    <div key={v.id} className="flex items-center space-x-2">
                      <label htmlFor={`sample-${v.name}`} className="text-sm">
                        Sample value for {v.name}:
                      </label>
                      <input
                        id={`sample-${v.name}`}
                        type={v.type === 'number' ? 'number' : v.type === 'date' ? 'date' : 'text'}
                        value={previewValues[v.name] || ''}
                        onChange={(e) => setPreviewValues({
                          ...previewValues,
                          [v.name]: e.target.value,
                        })}
                        className="px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onPreview?.(content, variables)}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  aria-label="Refresh preview"
                >
                  Refresh Preview
                </button>
              </div>
              <div className="border rounded p-4 bg-gray-50">
                <div dangerouslySetInnerHTML={{ __html: highlightSyntax(content) }} />
              </div>
            </div>
          ) : activeTab === 'logic' ? (
            <div className="p-4">
              <h3 className="font-semibold mb-4">Conditional Logic</h3>
              <div className="space-y-4">
                <div>
                  <button
                    onClick={() => setShowAddVariable(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    aria-label="Add condition"
                  >
                    Add Condition
                  </button>
                </div>
                <div>
                  <label htmlFor="if-variable" className="block text-sm mb-1">If variable</label>
                  <select
                    id="if-variable"
                    className="px-2 py-1 border rounded text-sm"
                    onChange={(e) => e.target.value && insertCondition(e.target.value)}
                  >
                    <option value="">Select variable...</option>
                    {variables.filter(v => v.type === 'boolean').map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const select = document.getElementById('if-variable') as HTMLSelectElement;
                      if (select?.value) insertCondition(select.value);
                    }}
                    className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-sm"
                    aria-label="Insert condition"
                  >
                    Insert Condition
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => setShowAddVariable(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    aria-label="Add loop"
                  >
                    Add Loop
                  </button>
                  <label htmlFor="loop-variable" className="block text-sm mb-1 mt-2">Loop variable</label>
                  <input
                    id="loop-variable"
                    type="text"
                    className="px-2 py-1 border rounded text-sm"
                    placeholder="items"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('loop-variable') as HTMLInputElement;
                      if (input?.value) insertLoop(input.value);
                    }}
                    className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-sm"
                    aria-label="Insert loop"
                  >
                    Insert Loop
                  </button>
                </div>
                <div data-testid="logic-visualization" className="mt-4 p-3 bg-gray-100 rounded">
                  <h4 className="font-medium mb-2">Logic Blocks</h4>
                  {content.includes('{% if support_included %}') && (
                    <div className="text-sm text-gray-600">• if support_included</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex">
              {renderLineNumbers()}
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                aria-label="Template content"
                className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
                style={{ minHeight: '400px' }}
              />
            </div>
          )}
        </div>

        {/* Variables Panel */}
        {activeTab === 'variables' && (
          <div role="group" aria-label="Variables panel" className="w-80 border-l overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Variables</h3>
              <button
                onClick={() => setShowAddVariable(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                aria-label="Add variable"
              >
                <PlusIcon className="h-4 w-4 inline mr-1" />
                Add Variable
              </button>
            </div>
            
            <div className="space-y-3">
              {variables.map(variable => (
                <div
                  key={variable.id}
                  data-testid={`variable-${variable.name}`}
                  className="border rounded p-3 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{variable.name}</div>
                      <div className="text-xs text-gray-500">{variable.type}</div>
                      {variable.description && (
                        <div className="text-sm text-gray-600 mt-1">{variable.description}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Used: {getVariableUsageCount(variable.name)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => insertVariable(variable)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        aria-label={`Insert variable ${variable.name}`}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingVariable(variable)}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        aria-label={`Edit variable ${variable.name}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this variable?')) {
                            deleteVariable(variable.id);
                          }
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        aria-label={`Delete variable ${variable.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div className="w-64 border-l p-4">
            <h3 className="font-semibold mb-4">Collaborators</h3>
            <div className="space-y-3">
              {collaborators.map(collaborator => (
                <div key={collaborator.id} className="flex items-center space-x-3">
                  {collaborator.avatar && (
                    <img
                      src={collaborator.avatar}
                      alt={collaborator.name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{collaborator.name}</div>
                    <div
                      data-testid={`collaborator-${collaborator.id}-status`}
                      className={`text-xs ${collaborator.isOnline ? 'online text-green-600' : 'offline text-gray-500'}`}
                    >
                      {collaborator.isOnline ? 'Online' : 'Offline'}
                    </div>
                    {collaborator.isOnline && collaborator.cursor && (
                      <div className="text-xs text-gray-500">
                        {collaborator.name} is editing
                      </div>
                    )}
                  </div>
                  {collaborator.cursor && (
                    <div
                      data-testid={`cursor-${collaborator.id}`}
                      style={{ position: 'absolute', top: `${collaborator.cursor.line * 20}px` }}
                      className="w-0.5 h-4 bg-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-gray-50 border-t p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowVersionDialog(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            aria-label="Save version"
          >
            Save Version
          </button>
          {currentUser.permissions.includes('submit_for_review') && (
            <button
              onClick={() => setShowSubmitDialog(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              aria-label="Submit for review"
            >
              Submit for Review
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            aria-label="Save template"
            title="Save (Ctrl+S)"
          >
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {errors.content && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded">
          {errors.content}
        </div>
      )}
      {errors.logic && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded">
          {errors.logic}
        </div>
      )}
      {errors.save && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded">
          {errors.save}
        </div>
      )}
      {errors.variableName && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded">
          {errors.variableName}
        </div>
      )}

      {/* Dialogs */}
      {showAddVariable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Variable</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-var-name" className="block text-sm font-medium mb-1">
                  Variable name
                </label>
                <input
                  id="new-var-name"
                  type="text"
                  value={newVariable.name || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label htmlFor="new-var-type" className="block text-sm font-medium mb-1">
                  Variable type
                </label>
                <select
                  id="new-var-type"
                  value={newVariable.type || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, type: e.target.value as Variable['type'] })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select type...</option>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                  <option value="list">List</option>
                  <option value="currency">Currency</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-var-desc" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <input
                  id="new-var-desc"
                  type="text"
                  value={newVariable.description || ''}
                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAddVariable(false);
                  setNewVariable({});
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addVariable}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Save variable"
              >
                Save Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVariable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Variable</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-var-desc" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <input
                  id="edit-var-desc"
                  type="text"
                  value={editingVariable.description || ''}
                  onChange={(e) => setEditingVariable({ ...editingVariable, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditingVariable(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => updateVariable(editingVariable)}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Save changes"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save New Version</h3>
            <div>
              <label htmlFor="version-comment" className="block text-sm font-medium mb-1">
                Version comment
              </label>
              <textarea
                id="version-comment"
                value={versionComment}
                onChange={(e) => setVersionComment(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowVersionDialog(false);
                  setVersionComment('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleVersionSave}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Save new version"
              >
                Save New Version
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Submit for Review</h3>
            <p className="mb-4">Submit this template for review and approval?</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSubmitDialog(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 text-white bg-purple-600 rounded hover:bg-purple-700"
                aria-label="Confirm submission"
              >
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {isDirty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ display: 'none' }}>
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
            <p className="mb-4">You have unsaved changes. Do you want to save before leaving?</p>
            <div className="flex justify-end space-x-2">
              <button className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300">
                Don't Save
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};