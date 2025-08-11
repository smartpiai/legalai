import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'critical';
  field?: string;
  details?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  checksum?: string;
  pages?: number;
  encrypted?: boolean;
  hasSignatures?: boolean;
  language?: string;
  encoding?: string;
}

export interface ValidationProgress {
  currentStep: number;
  totalSteps: number;
  currentStepName: string;
  completedSteps: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fileInfo: FileInfo;
  suggestions: string[];
  validationProgress?: ValidationProgress;
}

interface UploadValidationFeedbackProps {
  validationResult: ValidationResult | null;
  isValidating: boolean;
  validationProgress?: number;
  onProceed: (result: ValidationResult) => void;
  onCancel: () => void;
  onRetry?: () => void;
  onFixAndRetry?: (errors: ValidationError[]) => void;
  onExportReport?: (result: ValidationResult) => void;
  allowForceUpload?: boolean;
  autoProceedOnSuccess?: boolean;
  autoRetryOnErrors?: string[];
}

export const UploadValidationFeedback: React.FC<UploadValidationFeedbackProps> = ({
  validationResult,
  isValidating,
  validationProgress,
  onProceed,
  onCancel,
  onRetry,
  onFixAndRetry,
  onExportReport,
  allowForceUpload = false,
  autoProceedOnSuccess = false,
  autoRetryOnErrors = [],
}) => {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showForceUploadDialog, setShowForceUploadDialog] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Auto-proceed on success
  useEffect(() => {
    if (autoProceedOnSuccess && validationResult?.isValid && !isValidating) {
      const timer = setTimeout(() => {
        onProceed(validationResult);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoProceedOnSuccess, validationResult, isValidating, onProceed]);

  // Auto-retry on specific errors
  useEffect(() => {
    if (!isValidating && validationResult && onRetry && autoRetryOnErrors.length > 0) {
      const hasRetryableError = validationResult.errors.some(
        error => autoRetryOnErrors.includes(error.code)
      );
      if (hasRetryableError) {
        const timer = setTimeout(() => {
          onRetry();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [validationResult, isValidating, onRetry, autoRetryOnErrors]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatFileType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/msword': 'Word Document',
      'text/plain': 'Text File',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    };
    return typeMap[type] || type;
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-700 bg-red-100';
      case 'error':
        return 'text-orange-700 bg-orange-100';
      case 'warning':
        return 'text-yellow-700 bg-yellow-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const toggleErrorExpansion = (code: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const dismissWarning = (code: string) => {
    setDismissedWarnings(prev => new Set(prev).add(code));
  };

  const handleCopyToClipboard = async () => {
    if (!validationResult) return;

    const text = `
Validation Report
================
File: ${validationResult.fileInfo.name}
Status: ${validationResult.isValid ? 'Valid' : 'Invalid'}

Errors (${validationResult.errors.length}):
${validationResult.errors.map(e => `- [${e.severity.toUpperCase()}] ${e.message}`).join('\n')}

Warnings (${validationResult.warnings.length}):
${validationResult.warnings.map(w => `- ${w.message}`).join('\n')}

Suggestions:
${validationResult.suggestions.map(s => `- ${s}`).join('\n')}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const handleForceUpload = () => {
    if (validationResult) {
      onProceed(validationResult);
      setShowForceUploadDialog(false);
    }
  };

  const handleKeyNavigation = (e: React.KeyboardEvent, index: number, type: 'error' | 'warning') => {
    const items = document.querySelectorAll(`[data-${type}-item]`);
    
    if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      (items[index + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      (items[index - 1] as HTMLElement).focus();
    }
  };

  // Validation in progress
  if (isValidating && !validationResult) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <DocumentTextIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Validating Document</h3>
          <p className="text-sm text-gray-600 mb-4">Please wait while we validate your document...</p>
          
          {validationProgress !== undefined && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">{validationProgress}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  role="progressbar"
                  aria-valuenow={validationProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${validationProgress}%` }}
                />
              </div>
            </div>
          )}
          
          {!validationProgress && (
            <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto" />
          )}
        </div>
      </div>
    );
  }

  // Validation with progress steps
  if (isValidating && validationResult?.validationProgress) {
    const { currentStep, totalSteps, currentStepName, completedSteps } = validationResult.validationProgress;
    const progressPercentage = Math.round((currentStep / totalSteps) * 100);

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <DocumentTextIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Validating Document</h3>
          <p className="text-sm text-gray-600 mb-2">Step {currentStep} of {totalSteps}</p>
          <p className="text-sm font-medium text-gray-900 mb-4">{currentStepName}</p>
          
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="text-left">
            <p className="text-xs text-gray-500 mb-1">Completed steps:</p>
            <ul className="text-xs text-gray-600">
              {completedSteps.map((step, idx) => (
                <li key={idx} className="line-through">{step}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!validationResult) return null;

  const { isValid, errors, warnings, fileInfo, suggestions } = validationResult;
  const visibleWarnings = warnings.filter(w => !dismissedWarnings.has(w.code));
  const hasErrors = errors.length > 0;
  const hasWarnings = visibleWarnings.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div role="region" aria-label="Validation results">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {isValid ? (
              <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
            ) : (
              <XCircleIcon className="h-8 w-8 text-red-500 mr-3" />
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {isValid ? 'Validation Successful' : 'Validation Failed'}
              </h3>
              {isValid && !hasWarnings && (
                <p className="text-sm text-gray-600">Document passed all validation checks</p>
              )}
              {!isValid && (
                <div role="alert" className="text-sm text-gray-600">
                  {errors.length} error{errors.length !== 1 ? 's' : ''} found
                  {hasWarnings && `, ${visibleWarnings.length} warning${visibleWarnings.length !== 1 ? 's' : ''} found`}
                </div>
              )}
            </div>
          </div>
          
          {/* Action Icons */}
          <div className="flex space-x-2">
            {onExportReport && (
              <button
                onClick={() => onExportReport(validationResult)}
                className="p-2 text-gray-400 hover:text-gray-600"
                aria-label="Export report"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={handleCopyToClipboard}
              className="p-2 text-gray-400 hover:text-gray-600"
              aria-label="Copy details"
            >
              <ClipboardDocumentIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {copiedToClipboard && (
          <div className="mb-4 p-2 bg-green-50 text-green-600 text-sm rounded">
            Copied to clipboard
          </div>
        )}

        {/* File Information */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">File Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <span className="ml-2 text-gray-900">{fileInfo.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Size:</span>
              <span className="ml-2 text-gray-900">{formatFileSize(fileInfo.size)}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 text-gray-900">{formatFileType(fileInfo.type)}</span>
            </div>
            {fileInfo.pages && (
              <div>
                <span className="text-gray-500">Pages:</span>
                <span className="ml-2 text-gray-900">{fileInfo.pages} pages</span>
              </div>
            )}
            {fileInfo.encrypted !== undefined && (
              <div className="flex items-center">
                {fileInfo.encrypted && <LockClosedIcon data-testid="lock-icon" className="h-4 w-4 text-gray-500 mr-1" />}
                <span className="text-gray-500">Security:</span>
                <span className="ml-2 text-gray-900">{fileInfo.encrypted ? 'Encrypted' : 'Not encrypted'}</span>
              </div>
            )}
            {fileInfo.hasSignatures !== undefined && (
              <div className="flex items-center">
                {fileInfo.hasSignatures && <ShieldCheckIcon data-testid="signature-icon" className="h-4 w-4 text-gray-500 mr-1" />}
                <span className="text-gray-500">Signatures:</span>
                <span className="ml-2 text-gray-900">{fileInfo.hasSignatures ? 'Contains signatures' : 'No signatures'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Errors */}
        {hasErrors && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Validation Errors</h4>
            <ul role="list" aria-label="Validation errors" className="space-y-2">
              {errors.map((error, index) => (
                <li
                  key={error.code}
                  data-error-item
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyNavigation(e, index, 'error')}
                  className="border border-red-200 rounded-lg p-3 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(error.severity)}`}>
                          {error.severity === 'critical' ? 'Critical' : 'Error'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-900">{error.message}</p>
                      {error.details && (
                        <p className="mt-1 text-xs text-gray-600">{error.details}</p>
                      )}
                      
                      {expandedErrors.has(error.code) && (
                        <div className="mt-2 pt-2 border-t border-red-200 text-xs text-gray-600">
                          <p>Field: {error.field || 'N/A'}</p>
                          <p>Code: {error.code}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleErrorExpansion(error.code)}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                      aria-label={expandedErrors.has(error.code) ? 'Hide details' : 'Show details'}
                    >
                      {expandedErrors.has(error.code) ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Warnings</h4>
            <ul role="list" aria-label="Validation warnings" className="space-y-2">
              {visibleWarnings.map((warning, index) => (
                <li
                  key={warning.code}
                  data-warning-item
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyNavigation(e, index, 'warning')}
                  className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                        <p className="text-sm text-gray-900">{warning.message}</p>
                      </div>
                      {warning.suggestion && (
                        <p className="mt-1 text-xs text-gray-600">{warning.suggestion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => dismissWarning(warning.code)}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Dismiss warning"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
              aria-label="View suggestions"
            >
              <InformationCircleIcon className="h-5 w-5 mr-2" />
              Suggestions for improvement
              <ChevronDownIcon className={`h-4 w-4 ml-1 transform ${showSuggestions ? 'rotate-180' : ''}`} />
            </button>
            
            {showSuggestions && (
              <ul className="mt-2 space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600 pl-7">
                    • {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            aria-label="Cancel upload"
          >
            Cancel
          </button>
          
          <div className="flex space-x-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                aria-label="Retry validation"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Retry Validation
              </button>
            )}
            
            {onFixAndRetry && hasErrors && (
              <button
                onClick={() => onFixAndRetry(errors)}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
                aria-label="Fix and retry"
              >
                Fix and Retry
              </button>
            )}
            
            {isValid && !hasWarnings && (
              <button
                onClick={() => onProceed(validationResult)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                aria-label="Proceed with upload"
              >
                Proceed with Upload
              </button>
            )}
            
            {isValid && hasWarnings && (
              <button
                onClick={() => onProceed(validationResult)}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                aria-label="Proceed anyway"
              >
                Proceed Anyway
              </button>
            )}
            
            {!isValid && allowForceUpload && (
              <button
                onClick={() => setShowForceUploadDialog(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                aria-label="Upload anyway"
              >
                Upload Anyway
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Force Upload Confirmation Dialog */}
      {showForceUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Are you sure?</h3>
            <p className="mb-4">This document has validation errors. Uploading it may cause issues.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowForceUploadDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForceUpload}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                aria-label="Confirm upload"
              >
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};