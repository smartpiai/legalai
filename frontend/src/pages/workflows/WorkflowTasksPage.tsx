/**
 * WorkflowTasksPage - Comprehensive workflow task management interface
 * Features: filtering, sorting, bulk operations, multiple views, export, etc.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Download, MoreHorizontal, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, Play, MessageSquare, Paperclip, ArrowUpDown, List, CalendarDays,
  RefreshCw, X, FileText, UserPlus, CheckSquare, Columns,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { workflowService } from '@/services/workflow.service'
import type { 
  WorkflowTask, TaskFilter, TaskSort, TaskStats, ViewMode, TaskStatus, TaskPriority,
  WorkflowType, TaskAssignee, TaskExportOptions,
} from '@/types/workflow.types'
import { TASK_STATUSES, TASK_PRIORITIES, WORKFLOW_TYPES, KANBAN_COLUMNS, SORT_OPTIONS } from '@/types/workflow.types'

const WorkflowTasksPage: React.FC = () => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filters, setFilters] = useState<TaskFilter>({})
  const [sort, setSort] = useState<TaskSort>({ field: 'due_date', order: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false)
  const [isBulkCompleteOpen, setIsBulkCompleteOpen] = useState(false)
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'timeline' | 'attachments'>('details')

  const queryClient = useQueryClient()
  const perPage = 20

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search_query: searchQuery }))
      setCurrentPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Data fetching
  const { data: tasksResponse, isLoading: isLoadingTasks, error: tasksError, refetch } = useQuery({
    queryKey: ['workflow-tasks', filters, sort, currentPage, perPage],
    queryFn: () => workflowService.getTasks(filters, sort, currentPage, perPage),
  })

  const { data: taskStats } = useQuery({
    queryKey: ['task-stats', filters],
    queryFn: () => workflowService.getTaskStats(filters),
  })

  const { data: workflowStats } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: () => workflowService.getWorkflowStats(),
  })

  const { data: assignees } = useQuery({
    queryKey: ['assignees'],
    queryFn: () => workflowService.getAssignees(),
  })

  const { data: selectedTask } = useQuery({
    queryKey: ['workflow-task', selectedTaskId],
    queryFn: () => selectedTaskId ? workflowService.getTask(selectedTaskId) : null,
    enabled: !!selectedTaskId,
  })

  const { data: taskComments } = useQuery({
    queryKey: ['task-comments', selectedTaskId],
    queryFn: () => selectedTaskId ? workflowService.getTaskComments(selectedTaskId) : null,
    enabled: !!selectedTaskId && activeTab === 'comments',
  })

  const { data: taskHistory } = useQuery({
    queryKey: ['task-history', selectedTaskId],
    queryFn: () => selectedTaskId ? workflowService.getTaskHistory(selectedTaskId) : null,
    enabled: !!selectedTaskId && activeTab === 'timeline',
  })

  const { data: calendarEvents } = useQuery({
    queryKey: ['calendar-events', filters],
    queryFn: () => {
      const start = new Date()
      start.setMonth(start.getMonth() - 1)
      const end = new Date()
      end.setMonth(end.getMonth() + 2)
      return workflowService.getCalendarEvents(start.toISOString(), end.toISOString(), filters)
    },
    enabled: viewMode === 'calendar',
  })

  // Mutations
  const startTaskMutation = useMutation({
    mutationFn: workflowService.startTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      // Announce to screen readers
      const statusElement = document.querySelector('[role="status"]')
      if (statusElement) {
        statusElement.textContent = 'Task started successfully'
      }
    },
    onError: (error: Error) => {
      console.error('Failed to start task:', error)
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: ({ taskId, actualHours }: { taskId: string; actualHours?: number }) => 
      workflowService.completeTask(taskId, actualHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
    },
    onError: (error: Error) => {
      console.error('Failed to complete task:', error)
    },
  })

  const reassignTaskMutation = useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: string; assigneeId: string }) =>
      workflowService.reassignTask(taskId, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      setIsReassignOpen(false)
      setReassignTaskId(null)
    },
    onError: (error: Error) => {
      console.error('Failed to reassign task:', error)
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: workflowService.bulkUpdateTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      setSelectedTasks([])
      setIsBulkReassignOpen(false)
      setIsBulkCompleteOpen(false)
    },
    onError: (error: Error) => {
      console.error('Failed to bulk update tasks:', error)
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      workflowService.addComment(taskId, { content, mentions: [], attachment_ids: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments'] })
      setNewComment('')
    },
  })

  const exportTasksMutation = useMutation({
    mutationFn: workflowService.exportTasks,
    onSuccess: (blob, variables) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tasks-export.${variables.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setIsExportOpen(false)
    },
  })

  // Event handlers
  const handleFilterChange = useCallback((newFilters: Partial<TaskFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }, [])

  const handleSortChange = useCallback((field: string) => {
    setSort(prev => ({
      field: field as any,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setSelectedTasks(prev => 
      selected ? [...prev, taskId] : prev.filter(id => id !== taskId)
    )
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedTasks(selected ? tasksResponse?.tasks.map(t => t.id) || [] : [])
  }, [tasksResponse?.tasks])

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setIsDetailsOpen(true)
  }, [])

  const handleStartTask = useCallback((taskId: string) => {
    startTaskMutation.mutate(taskId)
  }, [startTaskMutation])

  const handleCompleteTask = useCallback((taskId: string, actualHours?: number) => {
    completeTaskMutation.mutate({ taskId, actualHours })
  }, [completeTaskMutation])

  const handleReassignTask = useCallback((taskId: string, assigneeId: string) => {
    reassignTaskMutation.mutate({ taskId, assigneeId })
  }, [reassignTaskMutation])

  const handleBulkReassign = useCallback((assigneeId: string) => {
    bulkUpdateMutation.mutate({
      task_ids: selectedTasks,
      updates: { assignee_id: assigneeId }
    })
  }, [selectedTasks, bulkUpdateMutation])

  const handleBulkComplete = useCallback(() => {
    bulkUpdateMutation.mutate({
      task_ids: selectedTasks,
      updates: { status: 'Completed' }
    })
  }, [selectedTasks, bulkUpdateMutation])

  const handleAddComment = useCallback(() => {
    if (selectedTaskId && newComment.trim()) {
      addCommentMutation.mutate({ taskId: selectedTaskId, content: newComment.trim() })
    }
  }, [selectedTaskId, newComment, addCommentMutation])

  const handleExport = useCallback((options: TaskExportOptions) => {
    exportTasksMutation.mutate(options)
  }, [exportTasksMutation])

  // Computed values
  const tasks = tasksResponse?.tasks || []
  const stats = taskStats || {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
    completion_rate: 0,
    average_completion_time_hours: 0,
    sla_compliance_rate: 0,
  }

  const totalPages = tasksResponse?.total_pages || 1
  const isAllSelected = selectedTasks.length === tasks.length && tasks.length > 0
  const hasBulkSelection = selectedTasks.length > 0

  // Utility functions
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const getStatusColor = (status: TaskStatus) => TASK_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800'
  const getPriorityColor = (priority: TaskPriority) => TASK_PRIORITIES.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-800'
  const isTaskOverdue = (task: WorkflowTask) => task.status !== 'Completed' && new Date(task.due_date) < new Date()
  
  const getSLAStatus = (task: WorkflowTask) => {
    if (task.status === 'Completed') return { status: 'completed', text: 'Completed' }
    const hoursRemaining = Math.max(0, (new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60))
    if (hoursRemaining === 0) return { status: 'overdue', text: 'Overdue' }
    if (hoursRemaining < 24) return { status: 'urgent', text: `${Math.floor(hoursRemaining)}h remaining` }
    return { status: 'normal', text: `${Math.floor(hoursRemaining / 24)}d remaining` }
  }

  const getKanbanColumns = () => KANBAN_COLUMNS.map(col => ({
    ...col,
    tasks: tasks.filter(task => task.status === col.id),
    count: tasks.filter(task => task.status === col.id).length,
  }))

  // Loading state
  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center min-h-96" role="status" aria-label="Loading tasks">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading tasks...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (tasksError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center" role="alert">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">
            {tasksError.message.includes('Network') ? 'Network error' : 'Failed to load tasks'}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <main className="p-6 max-w-7xl mx-auto" aria-label="Workflow tasks">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Workflow Tasks</h1>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                aria-pressed={viewMode === 'kanban'}
                aria-label="Kanban view"
              >
                <Columns className="h-4 w-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                aria-pressed={viewMode === 'calendar'}
                aria-label="Calendar view"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar
              </Button>
            </div>

            <Button onClick={() => setIsExportOpen(true)} aria-label="Export tasks">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-600">Overdue</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{Math.round(stats.completion_rate * 100)}%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{Math.round(stats.sla_compliance_rate * 100)}%</div>
            <div className="text-sm text-gray-600">SLA Compliance</div>
          </Card>
        </div>
      </div>

      {/* Filters and Search */}
      <nav className="mb-6" aria-label="Task filters">
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div className="lg:col-span-2">
              <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search tasks" />
            </div>
            <select className="px-3 py-2 border border-gray-300 rounded-md" value={filters.status?.[0] || ''} 
              onChange={(e) => handleFilterChange({ status: e.target.value ? [e.target.value as TaskStatus] : undefined })} aria-label="Status filter">
              <option value="">All Statuses</option>
              {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-md" value={filters.priority?.[0] || ''}
              onChange={(e) => handleFilterChange({ priority: e.target.value ? [e.target.value as TaskPriority] : undefined })} aria-label="Priority filter">
              <option value="">All Priorities</option>
              {TASK_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-md" value={filters.assignee_id?.[0] || ''}
              onChange={(e) => handleFilterChange({ assignee_id: e.target.value ? [e.target.value] : undefined })} aria-label="Assignee filter">
              <option value="">All Assignees</option>
              {assignees?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="px-3 py-2 border border-gray-300 rounded-md" value={filters.workflow_type?.[0] || ''}
              onChange={(e) => handleFilterChange({ workflow_type: e.target.value ? [e.target.value as WorkflowType] : undefined })} aria-label="Workflow type filter">
              <option value="">All Types</option>
              {WORKFLOW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Input type="date" value={filters.due_date_start || ''} onChange={(e) => handleFilterChange({ due_date_start: e.target.value })} aria-label="Start date" className="w-36" />
                <span>to</span>
                <Input type="date" value={filters.due_date_end || ''} onChange={(e) => handleFilterChange({ due_date_end: e.target.value })} aria-label="End date" className="w-36" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={filters.overdue_only || false} onChange={(e) => handleFilterChange({ overdue_only: e.target.checked })} />
                Overdue only
              </label>
            </div>
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-md" value={sort.field} onChange={(e) => handleSortChange(e.target.value)} aria-label="Sort by">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button variant="ghost" size="sm" onClick={() => setSort(prev => ({ ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' }))} aria-label="Sort order">
                <ArrowUpDown className="h-4 w-4" /> {sort.order === 'asc' ? 'Asc' : 'Desc'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setSearchQuery('') }} aria-label="Clear filters">Clear Filters</Button>
            </div>
          </div>
        </Card>
      </nav>

      {/* Bulk Operations Bar */}
      {hasBulkSelection && (
        <div className="mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between" role="toolbar" aria-label="Bulk operations">
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
                </span>
                <Button size="sm" onClick={() => setSelectedTasks([])} variant="ghost">
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsBulkReassignOpen(true)}
                  aria-label="Bulk reassign"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Reassign
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsBulkCompleteOpen(true)}
                  aria-label="Bulk complete"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'list' && (
        <div role="region" aria-label="Task list">
          <Card>
            <div className="p-6">
              {/* Table Header */}
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="mr-4"
                  aria-label="Select all tasks"
                />
                <div className="grid grid-cols-12 gap-4 w-full text-sm font-medium text-gray-500">
                  <div className="col-span-4">Task</div>
                  <div className="col-span-2">Assignee</div>
                  <div className="col-span-1">Priority</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Due Date</div>
                  <div className="col-span-1">SLA</div>
                  <div className="col-span-1">Actions</div>
                </div>
              </div>

              {/* Task Rows */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    role="row"
                    data-task-id={task.id}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) => handleTaskSelect(task.id, e.target.checked)}
                      className="mr-4"
                      aria-label={`Select ${task.title}`}
                    />
                    
                    <div className="grid grid-cols-12 gap-4 w-full items-center">
                      {/* Task Info */}
                      <div className="col-span-4">
                        <button
                          onClick={() => handleTaskClick(task.id)}
                          className="text-left hover:text-blue-600"
                        >
                          <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
                          <p className="text-sm text-gray-500 mb-1">{task.workflow_type}</p>
                          {task.tags.length > 0 && (
                            <div className="flex gap-1">
                              {task.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Assignee */}
                      <div className="col-span-2 flex items-center gap-2">
                        {task.assignee.avatar && (
                          <img
                            src={task.assignee.avatar}
                            alt={`${task.assignee.name} avatar`}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium">{task.assignee.name}</div>
                          <div className="text-xs text-gray-500">{task.assignee.role}</div>
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="col-span-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        {isTaskOverdue(task) && (
                          <div role="alert" aria-label="Overdue" className="text-red-500 text-xs mt-1">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            Overdue
                          </div>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="col-span-2">
                        <div className="text-sm">{formatDate(task.due_date)}</div>
                        <div className="text-xs text-gray-500">{formatTime(task.due_date)}</div>
                      </div>

                      {/* SLA */}
                      <div className="col-span-1">
                        {(() => {
                          const sla = getSLAStatus(task)
                          return (
                            <div className={`text-xs ${
                              sla.status === 'overdue' ? 'text-red-600' :
                              sla.status === 'urgent' ? 'text-orange-600' :
                              sla.status === 'completed' ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              SLA: {sla.text}
                            </div>
                          )
                        })()}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center gap-1">
                        {task.status === 'Pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartTask(task.id)}
                            disabled={startTaskMutation.isPending}
                            aria-label="Start task"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {task.status === 'In Progress' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCompleteTask(task.id)}
                            disabled={completeTaskMutation.isPending}
                            aria-label="Complete task"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReassignTaskId(task.id)
                            setIsReassignOpen(true)
                          }}
                          aria-label="Reassign"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                  <p className="text-gray-500">Try adjusting your filters or search criteria.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div role="region" aria-label="Kanban board" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {getKanbanColumns().map(column => (
            <Card key={column.id} className={`${column.color} border-t-4`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4" role="region" aria-label={`${column.title} column`}>
                  <h3 className="font-semibold">{column.title}</h3>
                  <span className="bg-white px-2 py-1 rounded text-sm">{column.count}</span>
                </div>
                <div className="space-y-3">
                  {column.tasks.map(task => (
                    <Card key={task.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTaskClick(task.id)}>
                      <h4 className="font-medium text-sm mb-2">{task.title}</h4>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                        <span className="text-xs text-gray-500">{formatDate(task.due_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.assignee.avatar && <img src={task.assignee.avatar} alt={`${task.assignee.name} avatar`} className="w-5 h-5 rounded-full" />}
                        <span className="text-xs text-gray-600">{task.assignee.name}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <div className="p-6">
            <div role="grid" aria-label="Calendar" className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="p-2 text-center font-semibold text-gray-600">{day}</div>)}
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i} className="h-20 p-1 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">{((i % 30) + 1)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <nav role="navigation" aria-label="Pagination" className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </Card>
        </div>
      )}

      {/* Task Details Dialog */}
      {isDetailsOpen && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div role="dialog" aria-label="Task details" className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold">{selectedTask.title}</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsDetailsOpen(false)} aria-label="Close dialog"><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="border-b px-6">
                  <nav className="flex space-x-8" aria-label="Task details tabs">
                    {['details', 'comments', 'timeline', 'attachments'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab as any)} 
                        className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
                        role="tab" aria-selected={activeTab === tab} aria-label={`${tab} tab`}>{tab}</button>
                    ))}
                  </nav>
                </div>
                <div className="p-6">
                  {activeTab === 'details' && (
                    <div className="space-y-6">
                      <div><h3 className="font-medium mb-2">Description</h3><p className="text-gray-600">{selectedTask.description}</p></div>
                      <div className="grid grid-cols-2 gap-6">
                        <div><h3 className="font-medium mb-2">Workflow</h3><p>{selectedTask.workflow_name}</p></div>
                        <div><h3 className="font-medium mb-2">Type</h3><p>{selectedTask.workflow_type}</p></div>
                        <div><h3 className="font-medium mb-2">Due Date</h3><p>{formatDate(selectedTask.due_date)} at {formatTime(selectedTask.due_date)}</p></div>
                        <div><h3 className="font-medium mb-2">Priority</h3><span className={`px-2 py-1 rounded text-sm ${getPriorityColor(selectedTask.priority)}`}>{selectedTask.priority}</span></div>
                        <div><h3 className="font-medium mb-2">Assignee</h3><div className="flex items-center gap-2">{selectedTask.assignee.avatar && <img src={selectedTask.assignee.avatar} alt={`${selectedTask.assignee.name} avatar`} className="w-6 h-6 rounded-full" />}<span>{selectedTask.assignee.name}</span></div></div>
                        <div><h3 className="font-medium mb-2">Status</h3><span className={`px-2 py-1 rounded text-sm ${getStatusColor(selectedTask.status)}`}>{selectedTask.status}</span></div>
                      </div>
                      {selectedTask.checklist_items && selectedTask.checklist_items.length > 0 && (
                        <div><h3 className="font-medium mb-2">Checklist</h3>
                          <div className="space-y-2">{selectedTask.checklist_items.map(item => 
                            <label key={item.id} className="flex items-center gap-2">
                              <input type="checkbox" checked={item.completed} onChange={() => {}} className="rounded" />
                              <span className={item.completed ? 'line-through text-gray-500' : ''}>{item.title}</span>
                            </label>
                          )}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTab === 'comments' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1" aria-label="Add comment" />
                        <Button onClick={handleAddComment} disabled={!newComment.trim() || addCommentMutation.isPending} aria-label="Add comment">
                          <MessageSquare className="h-4 w-4 mr-2" />Add
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {taskComments?.comments.map(comment => (
                          <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
                            <div className="flex items-center gap-2 mb-2">
                              {comment.author.avatar && <img src={comment.author.avatar} alt={`${comment.author.name} avatar`} className="w-5 h-5 rounded-full" />}
                              <span className="font-medium text-sm">{comment.author.name}</span>
                              <span className="text-xs text-gray-500">{formatDate(comment.created_at)} at {formatTime(comment.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeTab === 'timeline' && (
                    <div className="space-y-4">
                      {taskHistory?.history.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{entry.action}</span>
                              <span className="text-xs text-gray-500">by {entry.performed_by.name}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">{entry.details}</p>
                            <span className="text-xs text-gray-500">{formatDate(entry.timestamp)} at {formatTime(entry.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'attachments' && (
                    <div className="space-y-3">
                      {selectedTask.attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded">
                          <Paperclip className="h-4 w-4 text-gray-400" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{attachment.name}</div>
                            <div className="text-xs text-gray-500">{(attachment.size / 1024 / 1024).toFixed(2)} MB • Uploaded {formatDate(attachment.uploaded_at)}</div>
                          </div>
                          <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Overlays */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6" role="dialog" aria-label="Export tasks">
            <h2 className="text-xl font-semibold mb-4">Export Tasks</h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              handleExport({
                format: formData.get('format') as 'csv' | 'excel' | 'pdf',
                filters,
                fields: ['title', 'status', 'priority', 'assignee', 'due_date', 'workflow_type'],
                include_comments: formData.get('include_comments') === 'on',
                include_attachments: formData.get('include_attachments') === 'on',
                include_history: formData.get('include_history') === 'on',
              })
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="export-format">Export Format</label>
                  <select id="export-format" name="format" className="w-full px-3 py-2 border border-gray-300 rounded-md" aria-label="Export format">
                    <option value="csv">CSV</option><option value="excel">Excel</option><option value="pdf">PDF</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2"><input type="checkbox" name="include_comments" aria-label="Include comments" />Include comments</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="include_attachments" aria-label="Include attachments" />Include attachments</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="include_history" aria-label="Include history" />Include history</label>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Button type="submit" disabled={exportTasksMutation.isPending} aria-label="Download"><Download className="h-4 w-4 mr-2" />Download</Button>
                <Button type="button" variant="ghost" onClick={() => setIsExportOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReassignOpen && reassignTaskId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6" role="dialog" aria-label="Reassign task">
            <h2 className="text-xl font-semibold mb-4">Reassign Task</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleReassignTask(reassignTaskId, (new FormData(e.currentTarget).get('assignee') as string)) }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="reassign-assignee">Select Assignee</label>
                <select id="reassign-assignee" name="assignee" className="w-full px-3 py-2 border border-gray-300 rounded-md" required aria-label="Select assignee">
                  <option value="">Choose assignee...</option>
                  {assignees?.map(assignee => <option key={assignee.id} value={assignee.id}>{assignee.name} - {assignee.role}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={reassignTaskMutation.isPending} aria-label="Confirm reassign">Reassign</Button>
                <Button type="button" variant="ghost" onClick={() => { setIsReassignOpen(false); setReassignTaskId(null) }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkReassignOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6" role="dialog" aria-label="Bulk reassign tasks">
            <h2 className="text-xl font-semibold mb-4">Bulk Reassign Tasks</h2>
            <p className="text-sm text-gray-600 mb-4">Reassigning {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</p>
            <form onSubmit={(e) => { e.preventDefault(); handleBulkReassign((new FormData(e.currentTarget).get('assignee') as string)) }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="bulk-assignee">Select New Assignee</label>
                <select id="bulk-assignee" name="assignee" className="w-full px-3 py-2 border border-gray-300 rounded-md" required aria-label="Select new assignee">
                  <option value="">Choose assignee...</option>
                  {assignees?.map(assignee => <option key={assignee.id} value={assignee.id}>{assignee.name} - {assignee.role}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={bulkUpdateMutation.isPending} aria-label="Confirm bulk reassign">Reassign All</Button>
                <Button type="button" variant="ghost" onClick={() => setIsBulkReassignOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkCompleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6" role="dialog" aria-label="Bulk complete tasks">
            <h2 className="text-xl font-semibold mb-4">Complete Tasks</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to mark {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} as completed?</p>
            <div className="flex items-center gap-2">
              <Button onClick={handleBulkComplete} disabled={bulkUpdateMutation.isPending} aria-label="Confirm bulk complete">Complete All</Button>
              <Button variant="ghost" onClick={() => setIsBulkCompleteOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Status announcements for screen readers */}
      <div role="status" aria-live="polite" className="sr-only"></div>
    </main>
  )
}

export default WorkflowTasksPage