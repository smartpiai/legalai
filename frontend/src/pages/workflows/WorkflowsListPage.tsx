/**
 * WorkflowsListPage - Comprehensive workflow management interface
 * Supports search, filtering, sorting, bulk operations, and multiple view modes
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { workflowService } from '../../services/workflow.service'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '../../components/ui'
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  TagIcon,
  ChartBarIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'

// Types
interface Workflow {
  id: string
  name: string
  description: string
  status: 'Active' | 'Draft' | 'Inactive'
  category: 'Legal' | 'Approval' | 'Risk' | 'Compliance' | 'HR'
  version: string
  lastModified: string
  createdBy: { id: string; name: string; email: string }
  createdAt: string
  tags: string[]
  usageCount: number
  isTemplate: boolean
  templateId: string | null
  steps: number
  avgCompletionTime: number
  successRate: number
}

interface WorkflowFilters {
  status?: string[]
  category?: string[]
  createdAfter?: string
  createdBefore?: string
  modifiedAfter?: string
  modifiedBefore?: string
  ownerId?: string[]
  tags?: string[]
  searchQuery?: string
}

interface WorkflowSort {
  field: 'name' | 'createdAt' | 'lastModified' | 'usageCount' | 'status'
  order: 'asc' | 'desc'
}

export default function WorkflowsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  
  // State management
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<WorkflowFilters>({})
  const [sort, setSort] = useState<WorkflowSort>({ field: 'lastModified', order: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showTemplatesGallery, setShowTemplatesGallery] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showHistoryDialog, setShowHistoryDialog] = useState<string | null>(null)
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState<string | null>(null)
  const [showVersionComparison, setShowVersionComparison] = useState(false)
  const [previewWorkflow, setPreviewWorkflow] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, searchQuery }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Data fetching
  const { data: workflowsData, isLoading, error, refetch } = useQuery({
    queryKey: ['workflows', filters, sort, currentPage, itemsPerPage],
    queryFn: () => workflowService.getWorkflows(filters, sort, currentPage, itemsPerPage),
  })

  const { data: stats } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: () => workflowService.getWorkflowStats(),
  })

  const { data: templates } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => workflowService.getWorkflowTemplates(),
  })

  const { data: assignees } = useQuery({
    queryKey: ['assignees'],
    queryFn: () => workflowService.getAssignees(),
  })

  // Mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: workflowService.bulkUpdateWorkflows,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setSelectedWorkflows(new Set())
      setNotification({ type: 'success', message: 'Workflows updated successfully' })
    },
    onError: (error: Error) => {
      setNotification({ type: 'error', message: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: workflowService.deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setNotification({ type: 'success', message: 'Workflow deleted successfully' })
    },
  })

  const cloneMutation = useMutation({
    mutationFn: workflowService.cloneWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setNotification({ type: 'success', message: 'Workflow cloned successfully' })
    },
  })

  const exportMutation = useMutation({
    mutationFn: workflowService.exportWorkflows,
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workflows-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const importMutation = useMutation({
    mutationFn: workflowService.importWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setNotification({ type: 'success', message: 'Workflow imported successfully' })
      setShowImportDialog(false)
      setImportFile(null)
    },
  })

  // Helper functions
  const workflows = workflowsData?.workflows || []
  const totalPages = Math.ceil((workflowsData?.total || 0) / itemsPerPage)

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) ?? false
  }

  const handleSelectWorkflow = (workflowId: string) => {
    const newSelected = new Set(selectedWorkflows)
    if (newSelected.has(workflowId)) {
      newSelected.delete(workflowId)
    } else {
      newSelected.add(workflowId)
    }
    setSelectedWorkflows(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedWorkflows.size === workflows.length) {
      setSelectedWorkflows(new Set())
    } else {
      setSelectedWorkflows(new Set(workflows.map(w => w.id)))
    }
  }

  const handleSort = (field: WorkflowSort['field']) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleBulkAction = (action: string) => {
    const workflowIds = Array.from(selectedWorkflows)
    switch (action) {
      case 'delete':
        setShowDeleteConfirm('bulk')
        break
      case 'export':
        exportMutation.mutate({ workflowIds, format: 'json' })
        break
      case 'activate':
        bulkUpdateMutation.mutate({ workflowIds, action: 'updateStatus', status: 'Active' })
        break
      case 'deactivate':
        bulkUpdateMutation.mutate({ workflowIds, action: 'updateStatus', status: 'Inactive' })
        break
    }
  }

  const handleImport = () => {
    if (importFile) {
      const isValidFormat = importFile.type === 'application/json' || 
                           importFile.name.endsWith('.bpmn') || 
                           importFile.type === 'application/xml'
      
      if (!isValidFormat) {
        setNotification({ type: 'error', message: 'Invalid file format. Please select a JSON or BPMN file.' })
        return
      }
      
      importMutation.mutate(importFile)
    }
  }

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="workflows-loading" className="flex items-center justify-center min-h-screen">
        <div role="progressbar" className="animate-spin h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg mb-2">Failed to load workflows</p>
        <p className="text-sm text-gray-600 mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main role="main" aria-label="Workflows list" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav role="navigation" aria-label="Breadcrumb" className="mb-4">
          <ol className="flex text-sm text-gray-600">
            <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
            <li className="mx-2">/</li>
            <li className="text-gray-900">Workflows</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600">Manage and monitor your workflow processes</p>
          </div>
          <div className="flex gap-3">
            {hasPermission('create_workflows') && (
              <Button onClick={() => setShowCreateDialog(true)} icon={<PlusIcon className="h-5 w-5" />}>
                Create New
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowImportDialog(true)} icon={<ArrowUpTrayIcon className="h-5 w-5" />}>
              Import
            </Button>
            <Button variant="secondary" onClick={() => setShowTemplatesGallery(true)}>
              Templates
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportMutation.mutate({ format: 'json' })}
              icon={<ArrowDownTrayIcon className="h-5 w-5" />}
            >
              Export All
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold" data-testid="total-workflows">{stats?.total || 0}</div>
              <div className="text-sm text-gray-600">Total Workflows</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600" data-testid="active-workflows">{stats?.active || 0}</div>
              <div className="text-sm text-gray-600">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-yellow-600" data-testid="draft-workflows">{stats?.draft || 0}</div>
              <div className="text-sm text-gray-600">Draft</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600" data-testid="template-workflows">{stats?.templates || 0}</div>
              <div className="text-sm text-gray-600">Templates</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                <select
                  aria-label="Status filter"
                  value={filters.status?.[0] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value ? [e.target.value] : undefined }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Inactive">Inactive</option>
                </select>
                
                <select
                  aria-label="Category filter"
                  value={filters.category?.[0] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value ? [e.target.value] : undefined }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">All Categories</option>
                  <option value="Legal">Legal</option>
                  <option value="Approval">Approval</option>
                  <option value="Risk">Risk</option>
                  <option value="Compliance">Compliance</option>
                  <option value="HR">HR</option>
                </select>
                
                <input
                  type="date"
                  aria-label="Created after"
                  value={filters.createdAfter || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, createdAfter: e.target.value || undefined }))}
                  className="px-3 py-2 border rounded-lg"
                />
                
                <input
                  type="date"
                  aria-label="Created before"
                  value={filters.createdBefore || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, createdBefore: e.target.value || undefined }))}
                  className="px-3 py-2 border rounded-lg"
                />
                
                <input
                  type="date"
                  aria-label="Modified after"
                  value={filters.modifiedAfter || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, modifiedAfter: e.target.value || undefined }))}
                  className="px-3 py-2 border rounded-lg"
                />
                
                <input
                  type="date"
                  aria-label="Modified before"
                  value={filters.modifiedBefore || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, modifiedBefore: e.target.value || undefined }))}
                  className="px-3 py-2 border rounded-lg"
                />
                
                <select
                  aria-label="Owner filter"
                  value={filters.ownerId?.[0] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, ownerId: e.target.value ? [e.target.value] : undefined }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">All Owners</option>
                  {assignees?.map(assignee => (
                    <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
                  ))}
                </select>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilters({})
                    setSearchQuery('')
                  }}
                >
                  Clear filters
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                  aria-label={viewMode === 'table' ? 'Grid view' : 'Table view'}
                >
                  {viewMode === 'table' ? <Squares2X2Icon className="h-5 w-5" /> : <ListBulletIcon className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Operations Bar */}
        {selectedWorkflows.size > 0 && (
          <div data-testid="bulk-operations-bar" className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-blue-800">{selectedWorkflows.size} workflows selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleBulkAction('export')}>
                  Export Selected
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleBulkAction('activate')}>
                  Set to Active
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleBulkAction('deactivate')}>
                  Set to Inactive
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleBulkAction('delete')}>
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <Card>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table data-testid="workflows-table" role="table" aria-label="Workflows table" className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        data-testid="select-all-workflows"
                        aria-label="Select all"
                        checked={selectedWorkflows.size === workflows.length && workflows.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th role="columnheader" onClick={() => handleSort('name')} className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Version</th>
                    <th role="columnheader" onClick={() => handleSort('lastModified')} className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100">
                      Last Modified
                    </th>
                    <th role="columnheader" onClick={() => handleSort('createdAt')} className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100">
                      Created
                    </th>
                    <th role="columnheader" onClick={() => handleSort('usageCount')} className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100">
                      Usage
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workflows.map(workflow => (
                    <tr
                      key={workflow.id}
                      data-testid={`workflow-row-${workflow.id}`}
                      className="hover:bg-gray-50"
                      onMouseEnter={() => {
                        setTimeout(() => setPreviewWorkflow(workflow.id), 500)
                      }}
                      onMouseLeave={() => setPreviewWorkflow(null)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/workflows/${workflow.id}`)
                        if (e.key === ' ') {
                          e.preventDefault()
                          handleSelectWorkflow(workflow.id)
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          data-testid={`select-workflow-${workflow.id}`}
                          aria-label={`Select ${workflow.name}`}
                          checked={selectedWorkflows.has(workflow.id)}
                          onChange={() => handleSelectWorkflow(workflow.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{workflow.name}</div>
                        <div className="text-sm text-gray-600 truncate max-w-xs">{workflow.description}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {workflow.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              data-testid={`tag-${tag}`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded cursor-pointer hover:bg-gray-200"
                              onClick={() => setFilters(prev => ({ ...prev, tags: [tag] }))}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          workflow.status === 'Active' ? 'bg-green-100 text-green-800' :
                          workflow.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {workflow.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{workflow.category}</td>
                      <td className="px-4 py-3 text-sm">{workflow.version}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(workflow.lastModified).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{new Date(workflow.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">by {workflow.createdBy.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{workflow.usageCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`edit-workflow-${workflow.id}`}
                            onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`clone-workflow-${workflow.id}`}
                            onClick={() => cloneMutation.mutate(workflow.id)}
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </Button>
                          {workflow.status === 'Active' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`deactivate-workflow-${workflow.id}`}
                              onClick={() => bulkUpdateMutation.mutate({ 
                                workflowIds: [workflow.id], 
                                action: 'updateStatus', 
                                status: 'Inactive' 
                              })}
                            >
                              <PauseIcon className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`activate-workflow-${workflow.id}`}
                              onClick={() => bulkUpdateMutation.mutate({ 
                                workflowIds: [workflow.id], 
                                action: 'updateStatus', 
                                status: 'Active' 
                              })}
                            >
                              <PlayIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`export-workflow-${workflow.id}`}
                            onClick={() => exportMutation.mutate({ workflowIds: [workflow.id], format: 'json' })}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`history-workflow-${workflow.id}`}
                            onClick={() => setShowHistoryDialog(workflow.id)}
                          >
                            <ClockIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`analytics-workflow-${workflow.id}`}
                            onClick={() => setShowAnalyticsDialog(workflow.id)}
                          >
                            <ChartBarIcon className="h-4 w-4" />
                          </Button>
                          {hasPermission('delete_workflows') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`delete-workflow-${workflow.id}`}
                              onClick={() => setShowDeleteConfirm(workflow.id)}
                            >
                              <TrashIcon className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`add-tag-${workflow.id}`}
                            onClick={() => {/* Add tag functionality */}}
                          >
                            <TagIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="workflows-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {workflows.map(workflow => (
                <Card 
                  key={workflow.id}
                  data-testid={`workflow-card-${workflow.id}`}
                  className="hover:shadow-lg cursor-pointer"
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span className="truncate">{workflow.name}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        workflow.status === 'Active' ? 'bg-green-100 text-green-800' :
                        workflow.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {workflow.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">{workflow.description}</p>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{workflow.category}</span>
                      <span>v{workflow.version}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Used {workflow.usageCount} times</span>
                      <span>{new Date(workflow.lastModified).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 border-t">
            <nav role="navigation" aria-label="Pagination" className="flex justify-between items-center">
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
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, workflowsData?.total || 0)} of {workflowsData?.total || 0}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          </div>
        </Card>

        {/* Preview Tooltip */}
        {previewWorkflow && (
          <div 
            data-testid={`workflow-preview-${previewWorkflow}`}
            className="fixed z-50 bg-white border rounded-lg shadow-lg p-4 pointer-events-none"
            style={{ 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)'
            }}
          >
            {(() => {
              const workflow = workflows.find(w => w.id === previewWorkflow)
              return workflow ? (
                <div className="min-w-64">
                  <h4 className="font-medium">{workflow.name}</h4>
                  <div className="text-sm text-gray-600 mt-2">
                    <div>{workflow.steps} steps</div>
                    <div>{workflow.avgCompletionTime} hours avg</div>
                    <div>{workflow.successRate}% success</div>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )}

        {/* Dialogs and Modals would go here */}
        {/* For brevity, I'm including only the essential ones */}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="max-w-md w-full">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete {showDeleteConfirm === 'bulk' ? 'these workflows' : 'this workflow'}? 
                  This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (showDeleteConfirm === 'bulk') {
                        bulkUpdateMutation.mutate({ 
                          workflowIds: Array.from(selectedWorkflows), 
                          action: 'delete' 
                        })
                      } else {
                        deleteMutation.mutate(showDeleteConfirm)
                      }
                      setShowDeleteConfirm(null)
                    }}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>Import Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="mb-4">Select a JSON or BPMN file to import</p>
                  <input
                    type="file"
                    accept=".json,.bpmn,.xml"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="secondary" aria-label="Choose file">
                      Choose File
                    </Button>
                  </label>
                  {importFile && <p className="mt-4 text-sm">Selected: {importFile.name}</p>}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowImportDialog(false)
                      setImportFile(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!importFile}
                  >
                    Import Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div role="status" className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center z-50">
            {notification.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
            )}
            {notification.message}
          </div>
        )}

        {/* Search status for screen readers */}
        {searchQuery && (
          <div role="status" className="sr-only">
            Searching workflows...
          </div>
        )}
      </main>
    </div>
  )
}