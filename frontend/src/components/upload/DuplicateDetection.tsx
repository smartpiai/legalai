import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  EyeIcon,
  ArrowsPointingOutIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface DuplicateFile {
  id: number;
  name: string;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  checksum: string;
  matchScore: number;
  matchType: 'exact' | 'similar' | 'name';
}

interface DuplicateDetectionProps {
  file: File;
  onResolve: (resolution: { action: string; parentId?: number }) => void;
  onIgnore: () => void;
  onReplace: (documentId: number) => void;
  autoProceed?: boolean;
  similarityThreshold?: number;
  calculateChecksum?: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
}

export const DuplicateDetection: React.FC<DuplicateDetectionProps> = ({
  file,
  onResolve,
  onIgnore,
  onReplace,
  autoProceed = false,
  similarityThreshold = 0.0,
  calculateChecksum,
}) => {
  const [checksum, setChecksum] = useState<string>('');
  const [calculatingChecksum, setCalculatingChecksum] = useState(true);
  const [checksumProgress, setChecksumProgress] = useState(0);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DuplicateFile | null>(null);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'similar'>('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'date_desc'>('score_desc');

  // Default checksum calculation if not provided
  const defaultCalculateChecksum = async (file: File, onProgress?: (progress: number) => void) => {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    let hash = '';

    const reader = new FileReader();
    
    const readNextChunk = () => {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);
      reader.readAsArrayBuffer(blob);
    };

    return new Promise<string>((resolve) => {
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        hash += hashHex;
        
        currentChunk++;
        const progress = Math.round((currentChunk / chunks) * 100);
        if (onProgress) onProgress(progress);
        
        if (currentChunk < chunks) {
          readNextChunk();
        } else {
          resolve(hash);
        }
      };
      
      readNextChunk();
    });
  };

  // Calculate file checksum
  useEffect(() => {
    const calculateFileChecksum = async () => {
      setCalculatingChecksum(true);
      setChecksumProgress(0);
      
      try {
        const checksumFn = calculateChecksum || defaultCalculateChecksum;
        const calculatedChecksum = await checksumFn(file, setChecksumProgress);
        setChecksum(calculatedChecksum);
      } catch (error) {
        console.error('Error calculating checksum:', error);
        setChecksum('error');
      } finally {
        setCalculatingChecksum(false);
      }
    };
    
    calculateFileChecksum();
  }, [file, calculateChecksum]);

  // Check for duplicates
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['duplicates', checksum],
    queryFn: async () => {
      if (!checksum || checksum === 'error') return { duplicates: [] };
      
      const response = await api.post('/api/v1/documents/check-duplicates', {
        checksum,
        filename: file.name,
        size: file.size,
      });
      return response.data;
    },
    enabled: !!checksum && checksum !== 'error',
  });

  // Filter duplicates by similarity threshold and type
  const filteredDuplicates = useMemo(() => {
    if (!data?.duplicates) return [];
    
    let filtered = data.duplicates.filter(
      (dup: DuplicateFile) => dup.matchScore >= similarityThreshold
    );
    
    if (filterType !== 'all') {
      filtered = filtered.filter((dup: DuplicateFile) => dup.matchType === filterType);
    }
    
    // Sort duplicates
    filtered.sort((a: DuplicateFile, b: DuplicateFile) => {
      if (sortBy === 'score_desc') {
        return b.matchScore - a.matchScore;
      } else {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
    
    return filtered;
  }, [data?.duplicates, similarityThreshold, filterType, sortBy]);

  // Auto-proceed if no duplicates and autoProceed is enabled
  useEffect(() => {
    if (autoProceed && !calculatingChecksum && !isLoading && filteredDuplicates.length === 0) {
      onIgnore();
    }
  }, [autoProceed, calculatingChecksum, isLoading, filteredDuplicates, onIgnore]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleReplace = (documentId: number) => {
    setSelectedDocumentId(documentId);
    setShowReplaceDialog(true);
  };

  const confirmReplace = () => {
    if (selectedDocumentId) {
      onReplace(selectedDocumentId);
      setShowReplaceDialog(false);
    }
  };

  const handleViewDetails = (duplicate: DuplicateFile) => {
    setSelectedDocument(duplicate);
    setShowDetailsDialog(true);
  };

  const handleCompare = (duplicate: DuplicateFile) => {
    setSelectedDocument(duplicate);
    setShowCompareDialog(true);
  };

  const handleCreateVersion = () => {
    const exactMatch = filteredDuplicates.find(d => d.matchType === 'exact');
    if (exactMatch) {
      onResolve({ action: 'version', parentId: exactMatch.id });
    }
  };

  const handleKeyNavigation = (e: React.KeyboardEvent, index: number) => {
    const items = document.querySelectorAll('[data-testid="duplicate-item"]');
    
    if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      (items[index + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      (items[index - 1] as HTMLElement).focus();
    }
  };

  if (calculatingChecksum) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {checksumProgress > 0 ? 'Calculating file signature' : 'Checking for duplicates'}
          </h3>
          {checksumProgress > 0 && (
            <div className="mb-2">
              <div className="text-sm text-gray-600">{checksumProgress}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${checksumProgress}%` }}
                />
              </div>
            </div>
          )}
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Checking for duplicates</h3>
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error checking for duplicates</h3>
          <p className="text-sm text-gray-600 mb-4">Unable to check for duplicate files</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (filteredDuplicates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No duplicates found</h3>
          <p className="text-sm text-gray-600 mb-4">This file appears to be unique</p>
          <button
            onClick={onIgnore}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Proceed with Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div role="region" aria-label="Duplicate detection results">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">Duplicate Detection</h3>
          <div role="alert" className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {filteredDuplicates.length} potential duplicate{filteredDuplicates.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex space-x-4">
          <div>
            <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700">
              Filter by match type
            </label>
            <select
              id="filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="exact">Exact matches</option>
              <option value="similar">Similar files</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">
              Sort by
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="score_desc">Match score</option>
              <option value="date_desc">Upload date</option>
            </select>
          </div>
        </div>

        {/* Duplicate List */}
        <div role="list" aria-label="Duplicate files" className="space-y-3 mb-4">
          {filteredDuplicates.map((duplicate, index) => (
            <div
              key={duplicate.id}
              data-testid="duplicate-item"
              tabIndex={0}
              onKeyDown={(e) => handleKeyNavigation(e, index)}
              className="border rounded-lg p-4 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <h4 className="text-sm font-medium text-gray-900">{duplicate.name}</h4>
                    {duplicate.matchType === 'exact' ? (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                        Exact match
                      </span>
                    ) : (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        {Math.round(duplicate.matchScore * 100)}% similar
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Uploaded by {duplicate.uploadedBy} on {formatDate(duplicate.uploadedAt)}</p>
                    <p>Size: {formatFileSize(duplicate.size)}</p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewDetails(duplicate)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="View details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleCompare(duplicate)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Compare"
                  >
                    <ArrowsPointingOutIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleReplace(duplicate.id)}
                    className="px-3 py-1 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={onIgnore}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Ignore and Proceed
          </button>
          
          <button
            onClick={handleCreateVersion}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
            Create New Version
          </button>
        </div>
      </div>

      {/* Replace Confirmation Dialog */}
      {showReplaceDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Replacement</h3>
            <p className="mb-4">This will replace the existing file. Are you sure?</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowReplaceDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReplace}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                Confirm Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {showDetailsDialog && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Document Details</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">{selectedDocument.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Checksum</dt>
                <dd className="text-sm text-gray-900 font-mono">{selectedDocument.checksum}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
                <dd className="text-sm text-gray-900">{selectedDocument.uploadedBy}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Upload Date</dt>
                <dd className="text-sm text-gray-900">{formatDate(selectedDocument.uploadedAt)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">File Size</dt>
                <dd className="text-sm text-gray-900">{formatFileSize(selectedDocument.size)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Dialog */}
      {showCompareDialog && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
            <h3 className="text-lg font-semibold mb-4">File Comparison</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">New File</h4>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="text-sm text-gray-900">{file.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Size</dt>
                    <dd className="text-sm text-gray-900">{formatFileSize(file.size)}</dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Existing File</h4>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="text-sm text-gray-900">{selectedDocument.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Size</dt>
                    <dd className="text-sm text-gray-900">{formatFileSize(selectedDocument.size)}</dd>
                  </div>
                </dl>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Differences</h4>
              {file.size !== selectedDocument.size && (
                <p className="text-sm text-orange-600">File size is different</p>
              )}
              {file.name !== selectedDocument.name && (
                <p className="text-sm text-orange-600">File name is different</p>
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowCompareDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};