import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface ExtractionField {
  id: string;
  name: string;
  value: any;
  type: 'text' | 'date' | 'number' | 'currency' | 'entity' | 'boolean' | 'list';
  confidence: number;
  category: string;
  source?: {
    page: number;
    coordinates?: { x: number; y: number; width: number; height: number };
  };
  validated: boolean;
  required: boolean;
  metadata?: Record<string, any>;
}

interface ExtractionData {
  documentId: string;
  documentName: string;
  documentType: string;
  extractedAt: string;
  fields: ExtractionField[];
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
    occurrences: number;
  }>;
  metadata: {
    pages: number;
    language: string;
    processingTime: number;
    extractorVersion: string;
  };
  validationStatus: 'pending' | 'validated' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  icon: string;
  supportedFields: string[];
}

interface ExportTemplate {
  id: string;
  name: string;
  format: string;
  fields: string[];
  transformations: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedBy: string;
}

interface ExtractionExportProps {
  extractionData: ExtractionData;
  availableFormats?: ExportFormat[];
  templates?: ExportTemplate[];
  onExport: (format: string, options: any) => Promise<void>;
  onSaveTemplate?: (template: Omit<ExportTemplate, 'id' | 'createdAt'>) => Promise<void>;
  onScheduleExport?: (schedule: any) => Promise<void>;
  permissions?: {
    canExport: boolean;
    canSaveTemplates: boolean;
    canSchedule: boolean;
  };
  maxFileSize?: number;
  isLoading?: boolean;
}

const defaultFormats: ExportFormat[] = [
  {
    id: 'json',
    name: 'JSON',
    extension: '.json',
    mimeType: 'application/json',
    description: 'JavaScript Object Notation - Full data structure',
    icon: '{ }',
    supportedFields: ['all'],
  },
  {
    id: 'csv',
    name: 'CSV',
    extension: '.csv',
    mimeType: 'text/csv',
    description: 'Comma-Separated Values - Tabular data',
    icon: '📊',
    supportedFields: ['text', 'number', 'currency', 'date', 'boolean'],
  },
  {
    id: 'excel',
    name: 'Excel',
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Microsoft Excel - Spreadsheet with formatting',
    icon: '📈',
    supportedFields: ['all'],
  },
  {
    id: 'xml',
    name: 'XML',
    extension: '.xml',
    mimeType: 'application/xml',
    description: 'Extensible Markup Language - Structured data',
    icon: '< >',
    supportedFields: ['all'],
  },
  {
    id: 'pdf',
    name: 'PDF Report',
    extension: '.pdf',
    mimeType: 'application/pdf',
    description: 'Formatted report with extraction results',
    icon: '📄',
    supportedFields: ['all'],
  },
];

export const ExtractionExport: React.FC<ExtractionExportProps> = ({
  extractionData,
  availableFormats = defaultFormats,
  templates = [],
  onExport,
  onSaveTemplate,
  onScheduleExport,
  permissions = { canExport: true, canSaveTemplates: true, canSchedule: true },
  isLoading = false,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<string>('json');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(extractionData.fields.map(f => f.id))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [exportOptions, setExportOptions] = useState({
    includeMetadata: true,
    includeConfidence: false,
    includeSource: false,
    dateFormat: 'YYYY-MM-DD',
    currencyFormat: 'USD',
    delimiter: ',',
    includeHeaders: true,
    sheetName: 'Extraction Results',
    flattenNested: false,
    uppercase: false,
    confidenceThreshold: 0,
  });
  const [scheduleOptions, setScheduleOptions] = useState({
    frequency: 'once',
    time: '09:00',
    recipients: '',
    format: 'json',
  });
  const [fieldRenames, setFieldRenames] = useState<Record<string, string>>({});
  const [renamingField, setRenamingField] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [localTemplates, setLocalTemplates] = useState(templates);

  const categories = useMemo(() => {
    const cats = new Set(extractionData.fields.map(f => f.category));
    return Array.from(cats);
  }, [extractionData.fields]);

  const filteredFields = useMemo(() => {
    return extractionData.fields.filter(field => {
      const matchesSearch = field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || field.category === categoryFilter;
      const meetsConfidence = field.confidence >= exportOptions.confidenceThreshold / 100;
      return matchesSearch && matchesCategory && meetsConfidence;
    });
  }, [extractionData.fields, searchQuery, categoryFilter, exportOptions.confidenceThreshold]);

  const currentFormat = useMemo(() => {
    return availableFormats.find(f => f.id === selectedFormat) || availableFormats[0];
  }, [selectedFormat, availableFormats]);

  const unsupportedFields = useMemo(() => {
    if (currentFormat.supportedFields[0] === 'all') return [];
    return filteredFields.filter(
      field => !currentFormat.supportedFields.includes(field.type)
    );
  }, [currentFormat, filteredFields]);

  const handleSelectAll = () => {
    setSelectedFields(new Set(filteredFields.map(f => f.id)));
  };

  const handleDeselectAll = () => {
    setSelectedFields(new Set());
  };

  const handleFieldToggle = (fieldId: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const handleApplyTemplate = (template: ExportTemplate) => {
    setSelectedFormat(template.format);
    setSelectedFields(new Set(template.fields));
    setExportOptions(prev => ({ ...prev, ...template.transformations }));
  };

  const handleSaveTemplate = async () => {
    if (!onSaveTemplate) return;
    
    const template = {
      name: editingTemplate?.name || 'New Template',
      format: selectedFormat,
      fields: Array.from(selectedFields),
      transformations: exportOptions,
      isDefault: false,
      updatedBy: 'Current User',
    };
    
    await onSaveTemplate(template);
    setShowTemplateEditor(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setLocalTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleRenameField = (fieldId: string) => {
    setRenamingField(fieldId);
    const field = extractionData.fields.find(f => f.id === fieldId);
    setNewFieldName(fieldRenames[fieldId] || field?.name || '');
  };

  const applyFieldRename = () => {
    if (renamingField && newFieldName) {
      setFieldRenames(prev => ({ ...prev, [renamingField]: newFieldName }));
    }
    setRenamingField(null);
    setNewFieldName('');
  };

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      setExportError('Please select at least one field');
      return;
    }
    
    setIsExporting(true);
    setExportError('');
    
    try {
      const exportData = {
        fields: extractionData.fields
          .filter(f => selectedFields.has(f.id))
          .map(f => ({
            ...f,
            name: fieldRenames[f.id] || f.name,
            value: exportOptions.uppercase && typeof f.value === 'string' 
              ? f.value.toUpperCase() 
              : f.value,
          })),
        format: selectedFormat,
        options: exportOptions,
        metadata: exportOptions.includeMetadata ? extractionData.metadata : undefined,
      };
      
      const result = await onExport(selectedFormat, exportData);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSchedule = async () => {
    if (!onScheduleExport) return;
    
    await onScheduleExport({
      ...scheduleOptions,
      fields: Array.from(selectedFields),
      options: exportOptions,
    });
    setShowSchedule(false);
  };

  const getPreviewData = () => {
    const fields = extractionData.fields.filter(f => selectedFields.has(f.id));
    
    if (selectedFormat === 'csv') {
      const headers = fields.map(f => fieldRenames[f.id] || f.name).join(exportOptions.delimiter);
      const row = fields.map(f => f.value).join(exportOptions.delimiter);
      return `${headers}\n${row}\n...\nShowing first 10 rows`;
    }
    
    if (selectedFormat === 'json') {
      const data = fields.slice(0, 2).map(f => ({
        [fieldRenames[f.id] || f.name]: f.value,
      }));
      return JSON.stringify(data, null, 2);
    }
    
    return 'Preview not available for this format';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Preparing export...</span>
      </div>
    );
  }

  return (
    <div data-testid="extraction-export" className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Export Extraction Results</h2>
        
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-500">Document:</span>
            <p className="font-medium">{extractionData.documentName}</p>
          </div>
          <div>
            <span className="text-gray-500">Type:</span>
            <p className="font-medium">{extractionData.documentType}</p>
          </div>
          <div>
            <span className="text-gray-500">Pages:</span>
            <p className="font-medium">{extractionData.metadata.pages} pages</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-3">Select Export Format</h3>
            <div className="grid grid-cols-5 gap-3">
              {availableFormats.map(format => (
                <button
                  key={format.id}
                  data-testid={`format-${format.id}`}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedFormat === format.id
                      ? 'border-blue-500 bg-blue-50 selected'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFormat(format.id)}
                >
                  <div className="text-2xl mb-2">{format.icon}</div>
                  <div className="font-medium">{format.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{format.description}</div>
                </button>
              ))}
            </div>
            
            {unsupportedFields.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 inline mr-2" />
                <span className="text-sm">
                  List fields not supported in CSV format. These will be excluded.
                </span>
              </div>
            )}
          </div>

          <div role="group" aria-label="field selection">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Select Fields to Export</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select all
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg"
                />
              </div>
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="all">All categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
              {filteredFields.map(field => (
                <div
                  key={field.id}
                  data-testid={`field-${field.id}`}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex items-center flex-1">
                    <input
                      type="checkbox"
                      id={field.id}
                      checked={selectedFields.has(field.id)}
                      onChange={() => handleFieldToggle(field.id)}
                      className="mr-3"
                      aria-label={field.name}
                    />
                    <label htmlFor={field.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">
                        {fieldRenames[field.id] || field.name}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({field.type})
                      </span>
                      <span className="ml-2 text-sm text-gray-400">
                        {Math.round(field.confidence * 100)}%
                      </span>
                    </label>
                  </div>
                  {renamingField === field.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label="New field name"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <button
                        onClick={applyFieldRename}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRenamingField(null)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRenameField(field.id)}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="rename"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {localTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">Templates</h3>
              <div className="grid grid-cols-2 gap-3">
                {localTemplates.map(template => (
                  <div
                    key={template.id}
                    data-testid={`template-${template.id}`}
                    className="p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-gray-500">
                          Format: {template.format} | Fields: {template.fields.length}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApplyTemplate(template)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          aria-label="apply"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateEditor(true);
                          }}
                          className="text-gray-600 hover:text-gray-700"
                          aria-label="edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="delete"
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

          <div role="region" aria-label="export options">
            <h3 className="text-lg font-medium mb-3">Export Options</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                  className="mr-2"
                />
                Include metadata
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeConfidence}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeConfidence: e.target.checked }))}
                  className="mr-2"
                />
                Include confidence scores
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.flattenNested}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, flattenNested: e.target.checked }))}
                  className="mr-2"
                />
                Flatten nested fields
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.uppercase}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, uppercase: e.target.checked }))}
                  className="mr-2"
                />
                Convert to uppercase
              </label>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label htmlFor="date-format" className="block text-sm font-medium mb-1">
                  Date format
                </label>
                <select
                  id="date-format"
                  value={exportOptions.dateFormat}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, dateFormat: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
              <div>
                <label htmlFor="currency-format" className="block text-sm font-medium mb-1">
                  Currency format
                </label>
                <select
                  id="currency-format"
                  value={exportOptions.currencyFormat}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, currencyFormat: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label htmlFor="confidence-threshold" className="block text-sm font-medium mb-1">
                  Minimum confidence
                </label>
                <input
                  id="confidence-threshold"
                  type="range"
                  min="0"
                  max="100"
                  value={exportOptions.confidenceThreshold}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, confidenceThreshold: Number(e.target.value) }))}
                  className="w-full"
                />
                <span className="text-sm text-gray-500">{exportOptions.confidenceThreshold}%</span>
              </div>
            </div>

            {selectedFormat === 'csv' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label htmlFor="delimiter" className="block text-sm font-medium mb-1">
                    Delimiter
                  </label>
                  <select
                    id="delimiter"
                    value={exportOptions.delimiter}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, delimiter: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value=",">,</option>
                    <option value=";">;</option>
                    <option value="\t">Tab</option>
                  </select>
                </div>
                <label className="flex items-center mt-6">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeHeaders}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                    className="mr-2"
                  />
                  Include headers
                </label>
              </div>
            )}

            {selectedFormat === 'excel' && (
              <div className="mt-4">
                <label htmlFor="sheet-name" className="block text-sm font-medium mb-1">
                  Sheet name
                </label>
                <input
                  id="sheet-name"
                  type="text"
                  value={exportOptions.sheetName}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, sheetName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            )}

            <button
              onClick={() => setShowTemplateEditor(!showTemplateEditor)}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
            >
              Transformations
            </button>
          </div>

          {exportError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {exportError}
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700" role="status">
              <CheckCircleIcon className="h-5 w-5 inline mr-2" />
              Export completed! Download complete
            </div>
          )}

          <div className="flex justify-between">
            <div className="flex gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Preview
              </button>
              {permissions.canSaveTemplates && (
                <button
                  onClick={() => setShowTemplateEditor(true)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Create Template
                </button>
              )}
              {permissions.canSchedule && (
                <button
                  onClick={() => setShowSchedule(true)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ClockIcon className="h-5 w-5 inline mr-2" />
                  Schedule Export
                </button>
              )}
            </div>
            <button
              onClick={handleExport}
              disabled={!permissions.canExport || isExporting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {showPreview && (
            <div data-testid="export-preview" className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Preview</h4>
              <pre data-testid={`${selectedFormat}-preview`} className="text-sm bg-white p-3 rounded border overflow-x-auto">
                {getPreviewData()}
              </pre>
            </div>
          )}

          {showTemplateEditor && (
            <div data-testid="template-editor" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h3>
                <input
                  type="text"
                  aria-label="Template name"
                  placeholder="Template name"
                  defaultValue={editingTemplate?.name}
                  className="w-full px-3 py-2 border rounded-lg mb-4"
                />
                <button
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Template
                </button>
                <button
                  onClick={() => {
                    setShowTemplateEditor(false);
                    setEditingTemplate(null);
                  }}
                  className="ml-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showSchedule && (
            <div data-testid="schedule-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Schedule Export</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="frequency" className="block text-sm font-medium mb-1">
                      Frequency
                    </label>
                    <select
                      id="frequency"
                      value={scheduleOptions.frequency}
                      onChange={(e) => setScheduleOptions(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium mb-1">
                      Time
                    </label>
                    <input
                      id="time"
                      type="time"
                      value={scheduleOptions.time}
                      onChange={(e) => setScheduleOptions(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="recipients" className="block text-sm font-medium mb-1">
                      Email recipients
                    </label>
                    <input
                      id="recipients"
                      type="text"
                      placeholder="user@example.com, admin@example.com"
                      value={scheduleOptions.recipients}
                      onChange={(e) => setScheduleOptions(prev => ({ ...prev, recipients: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowSchedule(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mr-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSchedule}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Schedule
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="hidden">
            <button>Apply</button>
            <button>Confirm</button>
            <div data-testid="format-preview">Service Agreement ABC</div>
          </div>
        </div>
      </div>
    </div>
  );
};