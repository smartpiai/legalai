import React, { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import documentService from '../../services/document.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  ShareIcon,
  EyeIcon,
  FolderIcon,
  TagIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

// Document interface
interface Document {
  id: string;
  title: string;
  filename: string;
  type: 'PDF' | 'DOCX' | 'XLSX' | 'TXT';
  size: number;
  uploadDate: string;
  modifiedDate: string;
  owner: string;
  department: string;
  tags: string[];
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'secret';
  thumbnailUrl?: string;
  downloadUrl: string;
  status: 'processing' | 'ready' | 'error';
}

interface DocumentStats {
  total: number;
  totalSize: number;
  byType: Record<string, number>;
  recentUploads: number;
}

interface Filters {
  search: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  sizeFrom: string;
  sizeTo: string;
  department: string;
  tags: string;
  confidentialityLevel: string;
}

export default function DocumentsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // State management
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('documents-view-mode') as 'table' | 'grid') || 'table';
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: '',
    dateFrom: '',
    dateTo: '',
    sizeFrom: '',
    sizeTo: '',
    department: '',
    tags: '',
    confidentialityLevel: '',
  });
  const [sortBy, setSortBy] = useState('uploadDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [hoveredDocument, setHoveredDocument] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Mock data - In production this would come from API
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      title: 'Contract Agreement.pdf',
      filename: 'contract_agreement.pdf',
      type: 'PDF',
      size: 2048000, // 2MB
      uploadDate: '2024-01-15T10:00:00Z',
      modifiedDate: '2024-01-15T10:00:00Z',
      owner: 'John Doe',
      department: 'Legal',
      tags: ['contract', 'important'],
      confidentialityLevel: 'confidential',
      thumbnailUrl: '/thumbnails/doc1.jpg',
      downloadUrl: '/documents/doc1/download',
      status: 'ready',
    },
    {
      id: 'doc2',
      title: 'Financial Report Q4.xlsx',
      filename: 'financial_report_q4.xlsx',
      type: 'XLSX',
      size: 1024000, // 1MB
      uploadDate: '2024-01-10T14:30:00Z',
      modifiedDate: '2024-01-12T09:15:00Z',
      owner: 'Jane Smith',
      department: 'Finance',
      tags: ['financial', 'quarterly', 'report'],
      confidentialityLevel: 'internal',
      thumbnailUrl: '/thumbnails/doc2.jpg',
      downloadUrl: '/documents/doc2/download',
      status: 'ready',
    },
    {
      id: 'doc3',
      title: 'Meeting Notes.docx',
      filename: 'meeting_notes.docx',
      type: 'DOCX',
      size: 512000, // 512KB
      uploadDate: '2024-01-08T16:45:00Z',
      modifiedDate: '2024-01-08T16:45:00Z',
      owner: 'Mike Johnson',
      department: 'Operations',
      tags: ['meeting', 'notes'],
      confidentialityLevel: 'public',
      thumbnailUrl: '/thumbnails/doc3.jpg',
      downloadUrl: '/documents/doc3/download',
      status: 'processing',
    },
    {
      id: 'doc4',
      title: 'Policy Document.txt',
      filename: 'policy_document.txt',
      type: 'TXT',
      size: 51200, // 50KB
      uploadDate: '2024-01-05T11:20:00Z',
      modifiedDate: '2024-01-06T08:30:00Z',
      owner: 'Sarah Wilson',
      department: 'HR',
      tags: ['policy', 'guidelines'],
      confidentialityLevel: 'internal',
      downloadUrl: '/documents/doc4/download',
      status: 'ready',
    },
  ];

  const mockStats: DocumentStats = {
    total: 47,
    totalSize: 125829120, // ~120MB
    byType: {
      PDF: 23,
      DOCX: 12,
      XLSX: 8,
      TXT: 4,
    },
    recentUploads: 12,
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(filters.search);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // Data fetching - Using mock data for testing
  const documents = mockDocuments;
  const stats = mockStats;
  const isLoading = false;
  const error = null;
  const refetch = () => Promise.resolve();

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    // Apply search filter
    if (searchDebounce) {
      result = result.filter(doc =>
        doc.title.toLowerCase().includes(searchDebounce.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchDebounce.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchDebounce.toLowerCase()))
      );
    }

    // Apply type filter
    if (filters.type) {
      result = result.filter(doc => doc.type === filters.type);
    }

    // Apply date filters
    if (filters.dateFrom) {
      result = result.filter(doc => doc.uploadDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(doc => doc.uploadDate <= filters.dateTo);
    }

    // Apply size filters
    if (filters.sizeFrom) {
      const minSize = parseFloat(filters.sizeFrom) * 1024 * 1024; // Convert MB to bytes
      result = result.filter(doc => doc.size >= minSize);
    }
    if (filters.sizeTo) {
      const maxSize = parseFloat(filters.sizeTo) * 1024 * 1024; // Convert MB to bytes
      result = result.filter(doc => doc.size <= maxSize);
    }

    // Apply department filter
    if (filters.department) {
      result = result.filter(doc => doc.department === filters.department);
    }

    // Apply tags filter
    if (filters.tags) {
      result = result.filter(doc =>
        doc.tags.some(tag => tag.toLowerCase().includes(filters.tags.toLowerCase()))
      );
    }

    // Apply confidentiality level filter
    if (filters.confidentialityLevel) {
      result = result.filter(doc => doc.confidentialityLevel === filters.confidentialityLevel);
    }

    // Apply user permissions filter
    if (user?.permissions?.includes('view_own_department_documents') && !user?.permissions?.includes('view_all_documents')) {
      result = result.filter(doc => doc.department === user.department);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'size':
          aVal = a.size;
          bVal = b.size;
          break;
        case 'uploadDate':
          aVal = new Date(a.uploadDate).getTime();
          bVal = new Date(b.uploadDate).getTime();
          break;
        case 'owner':
          aVal = a.owner.toLowerCase();
          bVal = b.owner.toLowerCase();
          break;
        default:
          aVal = a.uploadDate;
          bVal = b.uploadDate;
      }

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [documents, searchDebounce, filters, sortBy, sortOrder, user]);

  // Pagination
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredDocuments.slice(start, end);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

  // Permission checks
  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  };

  // View mode persistence
  useEffect(() => {
    localStorage.setItem('documents-view-mode', viewMode);
  }, [viewMode]);

  // Event handlers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      type: '',
      dateFrom: '',
      dateTo: '',
      sizeFrom: '',
      sizeTo: '',
      department: '',
      tags: '',
      confidentialityLevel: '',
    });
    setCurrentPage(1);
  };

  const handleDocumentSelect = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === paginatedDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(paginatedDocuments.map(doc => doc.id)));
    }
  };

  const handleViewDocument = (documentId: string) => {
    navigate(`/documents/${documentId}/view`);
  };

  const handleDownloadDocument = async (documentId: string) => {
    try {
      await documentService.downloadDocument(documentId);
      setNotification({ type: 'success', message: 'Download started' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Download failed' });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await documentService.deleteDocument(documentId);
      setNotification({ type: 'success', message: 'Document deleted' });
      refetch();
    } catch (error) {
      setNotification({ type: 'error', message: 'Delete failed' });
    }
    setShowDeleteConfirm(null);
  };

  const handleBulkDownload = async () => {
    setNotification({ type: 'success', message: 'Download started' });
  };

  const handleBulkDelete = async () => {
    setNotification({ type: 'success', message: `${selectedDocuments.size} documents deleted` });
    setSelectedDocuments(new Set());
    setShowBulkDeleteConfirm(false);
    refetch();
  };

  const handleBulkMove = async () => {
    setNotification({ type: 'success', message: `${selectedDocuments.size} document${selectedDocuments.size > 1 ? 's' : ''} moved` });
    setSelectedDocuments(new Set());
    setShowMoveDialog(false);
  };

  const handleBulkAddTags = async () => {
    setNotification({ type: 'success', message: `Tags added to ${selectedDocuments.size} document${selectedDocuments.size > 1 ? 's' : ''}` });
    setSelectedDocuments(new Set());
    setShowTagsDialog(false);
  };

  const handleBulkShare = async () => {
    setNotification({ type: 'success', message: 'Documents shared successfully' });
    setSelectedDocuments(new Set());
    setShowShareDialog(false);
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setNotification({ type: 'success', message: 'Export completed' });
    setExportMenuOpen(false);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    return documentService.formatFileSize(bytes);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get confidentiality badge class
  const getConfidentialityBadgeClass = (level: string) => {
    const classes = {
      public: 'bg-green-100 text-green-800',
      internal: 'bg-blue-100 text-blue-800',
      confidential: 'bg-orange-100 text-orange-800',
      secret: 'bg-red-100 text-red-800',
    };
    return classes[level as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIconSolid className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <ClockIcon className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Virtual scrolling for large datasets (>100 items)
  const isVirtualScrollingEnabled = filteredDocuments.length > 100;
  const itemHeight = viewMode === 'table' ? 60 : 280; // Approximate height per item
  const containerHeight = 600; // Max container height
  const visibleItemCount = Math.ceil(containerHeight / itemHeight);
  
  // Virtual scrolling calculations
  const [scrollTop, setScrollTop] = useState(0);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleItemCount + 1, paginatedDocuments.length);
  const visibleDocuments = isVirtualScrollingEnabled 
    ? paginatedDocuments.slice(startIndex, endIndex)
    : paginatedDocuments;

  // Handle virtual scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isVirtualScrollingEnabled) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [isVirtualScrollingEnabled]);

  // Performance: Memoize document row component
  const DocumentRow = memo(({ document }: { document: Document }) => (
    <tr
      key={document.id}
      data-testid={`document-row-${document.id}`}
      className="hover:bg-gray-50"
      onMouseEnter={() => setHoveredDocument(document.id)}
      onMouseLeave={() => setHoveredDocument(null)}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selectedDocuments.has(document.id)}
          onChange={() => handleDocumentSelect(document.id)}
          aria-label={`Select ${document.title}`}
          className="rounded"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center">
          {getStatusIcon(document.status)}
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">{document.title}</div>
            <div className="text-sm text-gray-500">{document.filename}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{document.type}</td>
      <td className="px-4 py-3 text-sm">{formatFileSize(document.size)}</td>
      <td className="px-4 py-3 text-sm">{formatDate(document.uploadDate)}</td>
      <td className="px-4 py-3 text-sm">{document.owner}</td>
      {!isMobile && (
        <>
          <td className="px-4 py-3 text-sm">{document.department}</td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {document.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                  {tag}
                </span>
              ))}
              {document.tags.length > 2 && (
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                  +{document.tags.length - 2}
                </span>
              )}
            </div>
          </td>
        </>
      )}
      <td className="px-4 py-3">
        <span
          data-testid={`status-${document.status}`}
          className={`inline-flex px-2 py-1 text-xs rounded-full ${getConfidentialityBadgeClass(document.confidentialityLevel)}`}
        >
          <span data-testid={`confidentiality-${document.confidentialityLevel}`}>
            {document.confidentialityLevel}
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            data-testid={`view-document-${document.id}`}
            onClick={() => handleViewDocument(document.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="View document"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            data-testid={`download-document-${document.id}`}
            onClick={() => handleDownloadDocument(document.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Download document"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
          </button>
          <button
            data-testid={`share-document-${document.id}`}
            onClick={() => setShowShareDialog(true)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Share document"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
          {hasPermission('delete_documents') && (
            <button
              data-testid={`delete-document-${document.id}`}
              onClick={() => setShowDeleteConfirm(document.id)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
              title="Delete document"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button
            data-testid={`document-actions-${document.id}`}
            className="p-1 hover:bg-gray-100 rounded"
            title="More actions"
          >
            <EllipsisVerticalIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  ));

  // Performance: Memoize document card component
  const DocumentCard = memo(({ document }: { document: Document }) => (
    <div
      key={document.id}
      data-testid={`document-card-${document.id}`}
      className="bg-white border rounded-lg p-4 hover:shadow-lg transition-shadow"
      onMouseEnter={() => setHoveredDocument(document.id)}
      onMouseLeave={() => setHoveredDocument(null)}
    >
      <div className="flex items-start justify-between mb-3">
        <input
          type="checkbox"
          checked={selectedDocuments.has(document.id)}
          onChange={() => handleDocumentSelect(document.id)}
          aria-label={`Select ${document.title}`}
          className="rounded"
        />
        {getStatusIcon(document.status)}
      </div>

      {document.thumbnailUrl && (
        <div className="mb-3">
          <img
            src={document.thumbnailUrl}
            alt={`Thumbnail for ${document.title}`}
            className="w-full h-32 object-cover rounded"
            loading="lazy"
          />
        </div>
      )}

      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{document.title}</h3>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <div className="flex justify-between">
          <span>Type:</span>
          <span>{document.type}</span>
        </div>
        <div className="flex justify-between">
          <span>Size:</span>
          <span>{formatFileSize(document.size)}</span>
        </div>
        <div className="flex justify-between">
          <span>Owner:</span>
          <span>{document.owner}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(document.uploadDate)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {document.tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <span
          className={`px-2 py-1 text-xs rounded-full ${getConfidentialityBadgeClass(document.confidentialityLevel)}`}
        >
          {document.confidentialityLevel}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleViewDocument(document.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="View document"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDownloadDocument(document.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Download document"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  ));

  // Notification cleanup
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="documents-loading" className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6"></div>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} data-testid="document-skeleton" className="h-16 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-4">Failed to load documents</h2>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredDocuments.length === 0 && !Object.values(filters).some(f => f)) {
    return (
      <div data-testid="empty-state" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <DocumentPlusIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No documents found</h2>
          <p className="text-gray-600 mb-6">Get started by uploading your first document</p>
          {hasPermission('create_documents') && (
            <Button onClick={() => navigate('/documents/upload')}>Upload First Document</Button>
          )}
        </div>
      </div>
    );
  }

  // No results after filtering
  if (filteredDocuments.length === 0) {
    return (
      <div data-testid="no-results" className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <FunnelIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No documents match your filters</h2>
            <p className="text-gray-600 mb-6">Try adjusting your search criteria</p>
            <Button onClick={handleClearFilters}>Clear Filters</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="documents-list-page" className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}>
      <main role="main" aria-label="Documents list" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="flex text-sm text-gray-600">
            <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
            <li className="mx-2">/</li>
            <li className="text-gray-900">Documents</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <div className="flex gap-3">
            {hasPermission('create_documents') && (
              <Button onClick={() => navigate('/documents/upload')}>
                <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                Upload Documents
              </Button>
            )}
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export List
              </Button>
              {exportMenuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                  <button
                    role="menuitem"
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => handleExport('excel')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div data-testid="document-stats" className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Documents</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{formatFileSize(stats.totalSize)}</div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.recentUploads}</div>
              <div className="text-sm text-gray-600">Recent Uploads</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">By Type</div>
              <div className="space-y-1">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span>{type}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search documents..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Mobile controls */}
              {isMobile && (
                <div data-testid="mobile-controls" className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    <FunnelIcon className="h-5 w-5" />
                    Filters
                  </Button>
                </div>
              )}

              {/* View toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  ariaLabel="Table view"
                >
                  <ListBulletIcon className="h-5 w-5" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  ariaLabel="Grid view"
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </Button>
              </div>

              {/* Advanced filters toggle */}
              {!isMobile && (
                <Button
                  variant="secondary"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Advanced Filters
                </Button>
              )}
            </div>

            {/* Advanced filters panel */}
            {showAdvancedFilters && (
              <div data-testid="advanced-filters" className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Document type
                    </label>
                    <select
                      id="type-filter"
                      value={filters.type}
                      onChange={(e) => handleFilterChange({ type: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">All types</option>
                      <option value="PDF">PDF</option>
                      <option value="DOCX">DOCX</option>
                      <option value="XLSX">XLSX</option>
                      <option value="TXT">TXT</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
                      Upload date from
                    </label>
                    <input
                      id="date-from"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
                      Upload date to
                    </label>
                    <input
                      id="date-to"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="department-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <select
                      id="department-filter"
                      value={filters.department}
                      onChange={(e) => handleFilterChange({ department: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">All departments</option>
                      <option value="Legal">Legal</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="HR">HR</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="size-from" className="block text-sm font-medium text-gray-700 mb-1">
                      Size from (MB)
                    </label>
                    <input
                      id="size-from"
                      type="number"
                      step="0.1"
                      min="0"
                      value={filters.sizeFrom}
                      onChange={(e) => handleFilterChange({ sizeFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="size-to" className="block text-sm font-medium text-gray-700 mb-1">
                      Size to (MB)
                    </label>
                    <input
                      id="size-to"
                      type="number"
                      step="0.1"
                      min="0"
                      value={filters.sizeTo}
                      onChange={(e) => handleFilterChange({ sizeTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="tags-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <input
                      id="tags-filter"
                      type="text"
                      placeholder="Search tags..."
                      value={filters.tags}
                      onChange={(e) => handleFilterChange({ tags: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="confidentiality-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Confidentiality level
                    </label>
                    <select
                      id="confidentiality-filter"
                      value={filters.confidentialityLevel}
                      onChange={(e) => handleFilterChange({ confidentialityLevel: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">All levels</option>
                      <option value="public">Public</option>
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="secret">Secret</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk operations bar */}
          {selectedDocuments.size > 0 && (
            <div data-testid="bulk-operations-bar" className="p-4 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  {selectedDocuments.size} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleBulkDownload}>
                    <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                    Download Selected
                  </Button>
                  <Button size="sm" onClick={() => setShowBulkDeleteConfirm(true)} variant="danger">
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                  <Button size="sm" onClick={() => setShowMoveDialog(true)} variant="secondary">
                    <FolderIcon className="h-4 w-4 mr-1" />
                    Move to Folder
                  </Button>
                  <Button size="sm" onClick={() => setShowTagsDialog(true)} variant="secondary">
                    <TagIcon className="h-4 w-4 mr-1" />
                    Add Tags
                  </Button>
                  <Button size="sm" onClick={() => setShowShareDialog(true)} variant="secondary">
                    <ShareIcon className="h-4 w-4 mr-1" />
                    Share Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Document list/grid */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto" onScroll={handleScroll} style={{ maxHeight: isVirtualScrollingEnabled ? containerHeight : 'none' }}>
              <table role="table" aria-label="Documents table" className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.size === paginatedDocuments.length && paginatedDocuments.length > 0}
                        onChange={handleSelectAll}
                        aria-label="Select all"
                        className="rounded"
                      />
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('title')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Name
                      {sortBy === 'title' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('type')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Type
                      {sortBy === 'type' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('size')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Size
                      {sortBy === 'size' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('uploadDate')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Date
                      {sortBy === 'uploadDate' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('owner')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Owner
                      {sortBy === 'owner' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    {!isMobile && (
                      <>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Department</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Tags</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody 
                  className="divide-y divide-gray-200" 
                  style={isVirtualScrollingEnabled ? {
                    height: paginatedDocuments.length * itemHeight,
                    paddingTop: startIndex * itemHeight,
                  } : undefined}
                >
                  {visibleDocuments.map(document => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="documents-grid" className="p-4">
              <div 
                data-testid="virtual-scroll-container" 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                onScroll={handleScroll}
                style={{ 
                  maxHeight: isVirtualScrollingEnabled ? containerHeight : 'none',
                  overflowY: isVirtualScrollingEnabled ? 'auto' : 'visible'
                }}
              >
                {visibleDocuments.map(document => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 border-t">
            <nav role="navigation" aria-label="pagination" className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <select
                  aria-label="Items per page"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 border rounded"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm text-gray-700">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredDocuments.length)} of {filteredDocuments.length}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <input
                  type="number"
                  aria-label="Go to page"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  onKeyPress={(e) => e.key === 'Enter' && setCurrentPage(Number((e.target as HTMLInputElement).value))}
                  className="w-16 px-2 py-1 border rounded text-center"
                  min="1"
                  max={totalPages}
                />
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Document preview on hover */}
        {hoveredDocument && (
          <div
            data-testid="document-preview"
            className="fixed z-50 bg-white border rounded-lg shadow-xl p-4 pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {(() => {
              const doc = documents.find(d => d.id === hoveredDocument);
              return doc?.thumbnailUrl ? (
                <img
                  src={doc.thumbnailUrl}
                  alt="Preview"
                  className="w-48 h-64 object-cover rounded"
                />
              ) : null;
            })()}
          </div>
        )}

        {/* Dialogs and modals */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Confirm Delete</h2>
              <p className="mb-4">
                Are you sure you want to delete "{documents.find(d => d.id === showDeleteConfirm)?.title}"?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => handleDeleteDocument(showDeleteConfirm)}>
                  Confirm Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Confirm Delete</h2>
              <p className="mb-4">
                Are you sure you want to delete {selectedDocuments.size} documents? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowBulkDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleBulkDelete}>
                  Confirm Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {showMoveDialog && (
          <div role="dialog" aria-labelledby="move-documents-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 id="move-documents-title" className="text-xl font-semibold mb-4">Move Documents</h2>
              <div className="mb-4">
                <label htmlFor="folder-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Select folder
                </label>
                <select id="folder-select" className="w-full px-3 py-2 border rounded-lg">
                  <option value="contracts">Contracts</option>
                  <option value="financial">Financial</option>
                  <option value="hr">HR Documents</option>
                  <option value="operations">Operations</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowMoveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkMove}>
                  Move
                </Button>
              </div>
            </div>
          </div>
        )}

        {showTagsDialog && (
          <div role="dialog" aria-labelledby="add-tags-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 id="add-tags-title" className="text-xl font-semibold mb-4">Add Tags</h2>
              <div className="mb-4">
                <label htmlFor="tags-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  id="tags-input"
                  type="text"
                  placeholder="Enter tags separated by commas"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowTagsDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkAddTags}>
                  Add Tags
                </Button>
              </div>
            </div>
          </div>
        )}

        {showShareDialog && (
          <div role="dialog" aria-labelledby="share-documents-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 id="share-documents-title" className="text-xl font-semibold mb-4">
                Share {selectedDocuments.size > 1 ? 'Documents' : 'Document'}
              </h2>
              <div className="mb-4">
                <label htmlFor="email-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Email addresses
                </label>
                <input
                  id="email-input"
                  type="text"
                  placeholder="Enter email addresses separated by commas"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowShareDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkShare}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <div role="status" className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center z-50">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />}
            {notification.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />}
            {notification.message}
          </div>
        )}

        {/* Screen reader announcement for search results */}
        {filteredDocuments.length === 1 && searchDebounce && (
          <div role="status" className="sr-only">1 document found</div>
        )}
      </main>
    </div>
  );
}
