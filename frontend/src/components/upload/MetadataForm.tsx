import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface MetadataFormData {
  title: string;
  documentType: string;
  description: string;
  party1: string;
  party2: string;
  effectiveDate: string;
  expirationDate: string;
  contractValue: number | null;
  currency: string;
  department: string;
  tags: string[];
  confidentialityLevel: string;
  autoExtract: boolean;
  notificationEmails: string[];
  customFields: Record<string, string>;
}

interface CustomField {
  id: string;
  name: string;
  value: string;
}

interface MetadataFormProps {
  fileName: string;
  fileSize: number;
  initialValues?: Partial<MetadataFormData>;
  extractedData?: Partial<MetadataFormData>;
  isExtracting?: boolean;
  extractionError?: string;
  onSubmit: (data: MetadataFormData) => void;
  onCancel: () => void;
  onAutoExtract?: (enabled: boolean) => void;
}

const DOCUMENT_TYPES = [
  { value: '', label: 'Select a type' },
  { value: 'purchase_agreement', label: 'Purchase Agreement' },
  { value: 'service_agreement', label: 'Service Agreement' },
  { value: 'nda', label: 'Non-Disclosure Agreement' },
  { value: 'employment_contract', label: 'Employment Contract' },
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'license_agreement', label: 'License Agreement' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF'];

const DEPARTMENTS = [
  'Legal', 'Finance', 'HR', 'IT', 'Sales', 'Marketing', 'Operations', 'Procurement'
];

const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'highly_confidential', label: 'Highly Confidential' },
];

export const MetadataForm: React.FC<MetadataFormProps> = ({
  fileName,
  fileSize,
  initialValues = {},
  extractedData = {},
  isExtracting = false,
  extractionError,
  onSubmit,
  onCancel,
  onAutoExtract,
}) => {
  const [formData, setFormData] = useState<MetadataFormData>({
    title: '',
    documentType: '',
    description: '',
    party1: '',
    party2: '',
    effectiveDate: '',
    expirationDate: '',
    contractValue: null,
    currency: 'USD',
    department: '',
    tags: [],
    confidentialityLevel: 'internal',
    autoExtract: false,
    notificationEmails: [],
    customFields: {},
    ...initialValues,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Apply extracted data when it changes
  useEffect(() => {
    if (extractedData && Object.keys(extractedData).length > 0) {
      setFormData(prev => ({ ...prev, ...extractedData }));
      setHasChanges(true);
    }
  }, [extractedData]);

  // Convert tags array to string for display
  useEffect(() => {
    if (formData.tags.length > 0) {
      setTagInput(formData.tags.join(', '));
    }
  }, [formData.tags]);

  // Convert emails array to string for display
  useEffect(() => {
    if (formData.notificationEmails.length > 0) {
      setEmailInput(formData.notificationEmails.join(', '));
    }
  }, [formData.notificationEmails]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setHasChanges(true);
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      
      if (name === 'autoExtract' && onAutoExtract) {
        onAutoExtract(checked);
      }
    } else if (name === 'contractValue') {
      const numValue = value ? parseFloat(value) : null;
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setHasChanges(true);
  };

  const handleTagInputBlur = () => {
    const tags = tagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    setFormData(prev => ({ ...prev, tags }));
  };

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
    setHasChanges(true);
  };

  const handleEmailInputBlur = () => {
    const emails = emailInput
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      setErrors(prev => ({ ...prev, notificationEmails: 'Invalid email format' }));
    } else {
      setFormData(prev => ({ ...prev, notificationEmails: emails }));
      setErrors(prev => ({ ...prev, notificationEmails: '' }));
    }
  };

  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      name: '',
      value: '',
    };
    setCustomFields(prev => [...prev, newField]);
    setHasChanges(true);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(field => field.id !== id));
    setHasChanges(true);
  };

  const handleCustomFieldChange = (id: string, field: 'name' | 'value', value: string) => {
    setCustomFields(prev =>
      prev.map(f => (f.id === id ? { ...f, [field]: value } : f))
    );
    setHasChanges(true);
  };

  const validateCustomFieldName = (name: string, currentId: string) => {
    const duplicate = customFields.find(
      field => field.name === name && field.id !== currentId
    );
    if (duplicate) {
      setErrors(prev => ({ ...prev, [`custom_${currentId}`]: 'Field name must be unique' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`custom_${currentId}`];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.documentType) {
      newErrors.documentType = 'Document type is required';
    }
    
    if (formData.effectiveDate && formData.expirationDate) {
      const effective = new Date(formData.effectiveDate);
      const expiration = new Date(formData.expirationDate);
      if (expiration <= effective) {
        newErrors.expirationDate = 'Expiration date must be after effective date';
      }
    }
    
    if (formData.contractValue !== null && formData.contractValue < 0) {
      newErrors.contractValue = 'Contract value must be positive';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Prepare custom fields
    const customFieldsData: Record<string, string> = {};
    customFields.forEach(field => {
      if (field.name && field.value) {
        customFieldsData[field.name] = field.value;
      }
    });
    
    // Parse tags from input
    const tags = tagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Parse emails from input
    const emails = emailInput
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    const submitData: MetadataFormData = {
      ...formData,
      tags,
      notificationEmails: emails,
      customFields: customFieldsData,
    };
    
    onSubmit(submitData);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    onCancel();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Document Metadata</h2>
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">{fileName}</span>
          <span className="ml-2">({formatFileSize(fileSize)})</span>
        </div>
      </div>

      {extractionError && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {extractionError}
        </div>
      )}

      {isExtracting && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-600 text-sm">
          Extracting metadata...
        </div>
      )}

      {showSuccessMessage && (
        <div role="status" className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-600 text-sm">
          Metadata saved successfully
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        aria-label="Document metadata form"
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.title ? 'title-error' : undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.title && (
              <p id="title-error" className="mt-1 text-sm text-red-600">
                {errors.title}
              </p>
            )}
          </div>

          {/* Document Type */}
          <div>
            <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              id="documentType"
              name="documentType"
              value={formData.documentType}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.documentType ? 'type-error' : undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.documentType && (
              <p id="type-error" className="mt-1 text-sm text-red-600">
                {errors.documentType}
              </p>
            )}
          </div>

          {/* Party 1 */}
          <div>
            <label htmlFor="party1" className="block text-sm font-medium text-gray-700">
              Contract Party 1
            </label>
            <input
              type="text"
              id="party1"
              name="party1"
              value={formData.party1}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Party 2 */}
          <div>
            <label htmlFor="party2" className="block text-sm font-medium text-gray-700">
              Contract Party 2
            </label>
            <input
              type="text"
              id="party2"
              name="party2"
              value={formData.party2}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Effective Date */}
          <div>
            <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700">
              Effective Date
            </label>
            <input
              type="date"
              id="effectiveDate"
              name="effectiveDate"
              value={formData.effectiveDate}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Expiration Date */}
          <div>
            <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
              Expiration Date
            </label>
            <input
              type="date"
              id="expirationDate"
              name="expirationDate"
              value={formData.expirationDate}
              onChange={handleInputChange}
              aria-describedby={errors.expirationDate ? 'expiration-error' : undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.expirationDate && (
              <p id="expiration-error" className="mt-1 text-sm text-red-600">
                {errors.expirationDate}
              </p>
            )}
          </div>

          {/* Contract Value */}
          <div>
            <label htmlFor="contractValue" className="block text-sm font-medium text-gray-700">
              Contract Value
            </label>
            <input
              type="number"
              id="contractValue"
              name="contractValue"
              value={formData.contractValue || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              aria-describedby={errors.contractValue ? 'value-error' : undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.contractValue && (
              <p id="value-error" className="mt-1 text-sm text-red-600">
                {errors.contractValue}
              </p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {CURRENCIES.map(currency => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Confidentiality Level */}
          <div>
            <label htmlFor="confidentialityLevel" className="block text-sm font-medium text-gray-700">
              Confidentiality Level
            </label>
            <select
              id="confidentialityLevel"
              name="confidentialityLevel"
              value={formData.confidentialityLevel}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {CONFIDENTIALITY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags
          </label>
          <input
            type="text"
            id="tags"
            value={tagInput}
            onChange={handleTagInputChange}
            onBlur={handleTagInputBlur}
            placeholder="Enter tags separated by commas"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Notification Emails */}
        <div>
          <label htmlFor="notificationEmails" className="block text-sm font-medium text-gray-700">
            Notification Emails
          </label>
          <input
            type="text"
            id="notificationEmails"
            value={emailInput}
            onChange={handleEmailInputChange}
            onBlur={handleEmailInputBlur}
            placeholder="Enter email addresses separated by commas"
            aria-describedby={errors.notificationEmails ? 'email-error' : undefined}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.notificationEmails && (
            <p id="email-error" className="mt-1 text-sm text-red-600">
              {errors.notificationEmails}
            </p>
          )}
        </div>

        {/* Auto-Extract Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="autoExtract"
            name="autoExtract"
            checked={formData.autoExtract}
            onChange={handleInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="autoExtract" className="ml-2 block text-sm text-gray-700">
            Auto-extract metadata from document
          </label>
        </div>

        {/* Custom Fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Custom Fields</h3>
            <button
              type="button"
              onClick={addCustomField}
              className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Custom Field
            </button>
          </div>
          
          {customFields.map(field => (
            <div key={field.id} className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                placeholder="Field name"
                value={field.name}
                onChange={(e) => handleCustomFieldChange(field.id, 'name', e.target.value)}
                onBlur={() => validateCustomFieldName(field.name, field.id)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Field value"
                value={field.value}
                onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => removeCustomField(field.id)}
                className="p-1 text-red-600 hover:text-red-700"
                aria-label="Remove field"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              {errors[`custom_${field.id}`] && (
                <p className="text-sm text-red-600">{errors[`custom_${field.id}`]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isExtracting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Metadata
          </button>
        </div>
      </form>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">You have unsaved changes</h3>
            <p className="mb-4">Are you sure you want to cancel? Your changes will be lost.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};