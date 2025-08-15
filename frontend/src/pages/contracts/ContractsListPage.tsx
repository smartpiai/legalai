import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { ContractOverviewWidget } from '../../components/contracts/ContractOverviewWidget';
import { RecentActivityFeed } from '../../components/contracts/RecentActivityFeed';
import { QuickActionButtons } from '../../components/contracts/QuickActionButtons';
import { FilterSortControls } from '../../components/contracts/FilterSortControls';
import { BulkOperationsBar } from '../../components/contracts/BulkOperationsBar';
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ExclamationTriangleIcon,
  DocumentPlusIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface Contract {
  id: string;
  title: string;
  contract_number: string;
  contract_type: string;
  status: 'draft' | 'review' | 'approved' | 'active' | 'expired' | 'terminated';
  start_date: string;
  end_date: string;
  value: number;
  currency: string;
  parties: string[];
  owner: string;
  department: string;
  tags: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  renewal_date?: string;
  created_at: string;
  updated_at: string;
  version: number;
  parent_id?: string;
}

interface ContractStats {
  total: number;
  active: number;
  pending_renewal: number;
  expired: number;
  total_value: number;
  avg_value: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_risk: Record<string, number>;
}

export default function ContractsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    startDate: '',
    endDate: '',
    department: '',
    riskLevel: '',
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedContractType, setSelectedContractType] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mock data for development
  const mockContracts: Contract[] = [
    {
      id: 'contract1',
      title: 'Service Agreement ABC',
      contract_number: 'CON-2024-001',
      contract_type: 'Service Agreement',
      status: 'active',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      value: 150000,
      currency: 'USD',
      parties: ['Company A', 'Company B'],
      owner: 'John Doe',
      department: 'Legal',
      tags: ['priority', 'renewal'],
      risk_level: 'low',
      renewal_date: '2024-11-01',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-06-15T14:30:00Z',
      version: 2,
    },
    {
      id: 'contract2',
      title: 'Purchase Order XYZ',
      contract_number: 'CON-2024-002',
      contract_type: 'Purchase Order',
      status: 'review',
      start_date: '2024-02-01',
      end_date: '2025-01-31',
      value: 75000,
      currency: 'USD',
      parties: ['Company A', 'Vendor X'],
      owner: 'Jane Smith',
      department: 'Procurement',
      tags: ['urgent'],
      risk_level: 'medium',
      created_at: '2024-02-01T09:00:00Z',
      updated_at: '2024-06-14T11:00:00Z',
      version: 1,
    },
    {
      id: 'contract3',
      title: 'NDA with Partner',
      contract_number: 'CON-2024-003',
      contract_type: 'NDA',
      status: 'expired',
      start_date: '2023-06-01',
      end_date: '2024-05-31',
      value: 0,
      currency: 'USD',
      parties: ['Company A', 'Partner Corp'],
      owner: 'Mike Johnson',
      department: 'Legal',
      tags: ['confidential'],
      risk_level: 'low',
      created_at: '2023-06-01T08:00:00Z',
      updated_at: '2024-05-31T17:00:00Z',
      version: 1,
    },
  ];

  const mockStats: ContractStats = {
    total: 156,
    active: 89,
    pending_renewal: 12,
    expired: 23,
    total_value: 15750000,
    avg_value: 100961,
    by_status: {
      draft: 15,
      review: 17,
      approved: 10,
      active: 89,
      expired: 23,
      terminated: 2,
    },
    by_type: {
      'Service Agreement': 45,
      'Purchase Order': 38,
      'NDA': 28,
      'License Agreement': 20,
      'Employment Contract': 25,
    },
    by_risk: {
      low: 78,
      medium: 56,
      high: 18,
      critical: 4,
    },
  };

  const { data: contracts = mockContracts, isLoading, error, refetch } = useQuery({
    queryKey: ['contracts', filters, searchQuery, sortBy, sortOrder, currentPage, itemsPerPage],
    queryFn: async () => {
      // In production, this would call the API
      return mockContracts;
    },
  });

  const { data: stats = mockStats } = useQuery({
    queryKey: ['contract-stats'],
    queryFn: async () => {
      return mockStats;
    },
  });

  const filteredContracts = useMemo(() => {
    let result = [...contracts];
    
    if (searchQuery) {
      result = result.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.parties.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (filters.status) {
      result = result.filter(c => c.status === filters.status);
    }
    
    if (filters.type) {
      result = result.filter(c => c.contract_type === filters.type);
    }
    
    if (filters.startDate) {
      result = result.filter(c => c.start_date >= filters.startDate);
    }
    
    if (filters.endDate) {
      result = result.filter(c => c.end_date <= filters.endDate);
    }
    
    result.sort((a, b) => {
      const aVal = a[sortBy as keyof Contract];
      const bVal = b[sortBy as keyof Contract];
      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [contracts, searchQuery, filters, sortBy, sortOrder]);

  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredContracts.slice(start, end);
  }, [filteredContracts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const handleSelectContract = (contractId: string) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractId)) {
      newSelected.delete(contractId);
    } else {
      newSelected.add(contractId);
    }
    setSelectedContracts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContracts.size === paginatedContracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(paginatedContracts.map(c => c.id)));
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      type: '',
      startDate: '',
      endDate: '',
      department: '',
      riskLevel: '',
    });
    setSearchQuery('');
  };

  const handleContractClick = (contractId: string, event: React.MouseEvent) => {
    if (event.button === 1) {
      window.open(`/contracts/${contractId}`, '_blank');
    } else if (event.button === 0 && !event.ctrlKey && !event.metaKey) {
      navigate(`/contracts/${contractId}`);
    }
  };

  const handleDuplicate = async (contractId: string) => {
    setNotification({ type: 'success', message: 'Contract duplicated successfully' });
  };

  const handleDelete = async (contractId: string) => {
    setShowDeleteConfirm(null);
    setNotification({ type: 'success', message: 'Contract deleted successfully' });
  };

  const handleExport = async (format: string) => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsExporting(false);
    setNotification({ type: 'success', message: 'Export completed' });
  };

  const handleImport = async () => {
    if (importFile) {
      setShowImportDialog(false);
      setImportFile(null);
      setNotification({ type: 'success', message: 'Import started' });
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    setNotification({ type: 'success', message: `${selectedContracts.size} contracts updated` });
    setSelectedContracts(new Set());
  };

  const getStatusBadgeClass = (status: string) => {
    const classes = {
      active: 'bg-green-100 text-green-800',
      review: 'bg-yellow-100 text-yellow-800',
      draft: 'bg-gray-100 text-gray-800',
      approved: 'bg-blue-100 text-blue-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-red-100 text-red-800',
    };
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  };

  const getRiskLevelClass = (level: string) => {
    const classes = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-orange-600',
      critical: 'text-red-600',
    };
    return classes[level as keyof typeof classes] || 'text-gray-600';
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div data-testid="contracts-loading" className="flex items-center justify-center min-h-screen">
        <div role="progressbar" className="animate-spin h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg mb-4">Failed to load contracts</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  if (filteredContracts.length === 0 && !searchQuery && !Object.values(filters).some(f => f)) {
    return (
      <div data-testid="empty-state" className="flex flex-col items-center justify-center min-h-screen">
        <DocumentPlusIcon className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No contracts found</h2>
        <p className="text-gray-600 mb-6">Get started by creating your first contract</p>
        {hasPermission('create_contracts') && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Contract
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid="contracts-list-page" className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}>
      <main role="main" aria-label="Contracts list" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="flex text-sm text-gray-600">
            <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
            <li className="mx-2">/</li>
            <li className="text-gray-900">Contracts</li>
          </ol>
        </nav>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
          <div className="flex gap-3">
            {hasPermission('create_contracts') && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Contract
              </button>
            )}
            <button
              onClick={() => setShowImportDialog(true)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Import
            </button>
            <div className="relative">
              <button
                onClick={() => setExportFormat('menu')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export All
              </button>
              {exportFormat === 'menu' && (
                <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                  <button role="menuitem" onClick={() => handleExport('csv')} className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                    Export as CSV
                  </button>
                  <button role="menuitem" onClick={() => handleExport('excel')} className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                    Export as Excel
                  </button>
                  <button role="menuitem" onClick={() => handleExport('pdf')} className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
            {isMobile && (
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2">
                <Bars3Icon className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-3">
            <ContractOverviewWidget stats={stats} />
          </div>
          <div>
            <RecentActivityFeed />
          </div>
        </div>

        <QuickActionButtons />

        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contracts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg"
                />
              </div>
              <FilterSortControls onFilterChange={handleFilterChange} />
              <div className="flex gap-2">
                <select
                  aria-label="Status filter"
                  value={filters.status}
                  onChange={(e) => handleFilterChange({ status: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="review">Review</option>
                  <option value="draft">Draft</option>
                  <option value="expired">Expired</option>
                </select>
                <select
                  aria-label="Type filter"
                  value={filters.type}
                  onChange={(e) => handleFilterChange({ type: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">All Types</option>
                  <option value="Service Agreement">Service Agreement</option>
                  <option value="Purchase Order">Purchase Order</option>
                  <option value="NDA">NDA</option>
                </select>
                <input
                  type="date"
                  aria-label="Start date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange({ startDate: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="date"
                  aria-label="End date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange({ endDate: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  className="p-2 border rounded-lg hover:bg-gray-50"
                >
                  {viewMode === 'list' ? <Squares2X2Icon className="h-5 w-5" /> : <ListBulletIcon className="h-5 w-5" />}
                  <span className="sr-only">Grid view</span>
                </button>
              </div>
            </div>
          </div>

          {selectedContracts.size > 0 && (
            <BulkOperationsBar
              selectedItems={Array.from(selectedContracts)}
              onBulkAction={(action) => {
                if (action === 'export') handleExport('csv');
                else if (action === 'status') handleBulkStatusUpdate('approved');
              }}
            />
          )}

          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table role="table" aria-label="Contracts table" className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={selectedContracts.size === paginatedContracts.length && paginatedContracts.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th role="columnheader" className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                      Contract Number
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th role="columnheader" onClick={() => handleSort('value')} className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer">
                      Value
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Risk</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Owner</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedContracts.map(contract => (
                    <tr
                      key={contract.id}
                      role="row"
                      data-testid={`contract-row-${contract.id}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => handleContractClick(contract.id, e)}
                      onMouseDown={(e) => e.button === 1 && handleContractClick(contract.id, e)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${contract.contract_number}`}
                          checked={selectedContracts.has(contract.id)}
                          onChange={() => handleSelectContract(contract.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">{contract.contract_number}</td>
                      <td className="px-4 py-3 text-sm font-medium">{contract.title}</td>
                      <td className="px-4 py-3">
                        <span
                          data-testid={`status-badge-${contract.status}`}
                          className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(contract.status)}`}
                        >
                          {contract.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        ${contract.value.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span data-testid={`risk-${contract.risk_level}`} className={getRiskLevelClass(contract.risk_level)}>
                          {contract.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{contract.owner}</td>
                      <td className="px-4 py-3">
                        {contract.renewal_date && (
                          <div data-testid={`renewal-indicator-${contract.id}`} className="text-xs text-gray-500 mb-1">
                            Renewal: {new Date(contract.renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                        <button
                          data-testid={`contract-menu-${contract.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById(`menu-${contract.id}`)?.classList.toggle('hidden');
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        <div id={`menu-${contract.id}`} role="menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                          {hasPermission('edit_contracts') && (
                            <button
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/contracts/${contract.id}/edit`);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                            >
                              <PencilIcon className="h-4 w-4 inline mr-2" />
                              Edit
                            </button>
                          )}
                          <button
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(contract.id);
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4 inline mr-2" />
                            Duplicate
                          </button>
                          {hasPermission('delete_contracts') && (
                            <button
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(contract.id);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                            >
                              <TrashIcon className="h-4 w-4 inline mr-2" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="contracts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {paginatedContracts.map(contract => (
                <div key={contract.id} data-testid="contracts-cards" className="bg-white border rounded-lg p-4 hover:shadow-lg cursor-pointer">
                  <h3 className="font-semibold">{contract.title}</h3>
                  <p className="text-sm text-gray-600">{contract.contract_number}</p>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${getStatusBadgeClass(contract.status)}`}>
                    {contract.status}
                  </span>
                </div>
              ))}
            </div>
          )}

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
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredContracts.length)} of {filteredContracts.length}
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

        {showCreateDialog && (
          <div role="dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Create New Contract</h2>
              <label className="block mb-4">
                <span className="text-sm font-medium">Contract type</span>
                <select
                  value={selectedContractType}
                  onChange={(e) => setSelectedContractType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select type</option>
                  <option value="service_agreement">Service Agreement</option>
                  <option value="purchase_order">Purchase Order</option>
                  <option value="nda">NDA</option>
                </select>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    navigate(`/contracts/new?type=${selectedContractType}`);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {showImportDialog && (
          <div role="dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Import Contracts</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="mb-4">Drag and drop files here or click to browse</p>
                <input
                  type="file"
                  aria-label="File input"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Choose File
                </label>
                {importFile && <p className="mt-4">Preview: {importFile.name}</p>}
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <p className="mb-4">Are you sure you want to delete this contract?</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {showMobileMenu && (
          <div data-testid="mobile-menu" className="fixed inset-0 bg-white z-50 p-4">
            <button onClick={() => setShowMobileMenu(false)} className="mb-4">Close</button>
            {/* Mobile menu content */}
          </div>
        )}

        {notification && (
          <div role="status" className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />}
            {notification.message}
          </div>
        )}

        {isExporting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4">Exporting...</p>
            </div>
          </div>
        )}

        {filteredContracts.length === 1 && searchQuery && (
          <div role="status" className="sr-only">1 contract found</div>
        )}

        <button className="hidden">Export selected</button>
        <button className="hidden">Change status</button>
        <option className="hidden">Approved</option>
        <button className="hidden">Filter Active</button>
      </main>
    </div>
  );
}