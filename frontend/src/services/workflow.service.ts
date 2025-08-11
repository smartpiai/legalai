/**
 * Workflow Service for API interactions
 * Handles all workflow task management operations
 */

import { apiClient } from './apiClient'
import type {
  WorkflowTask,
  GetTasksResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilter,
  TaskSort,
  TaskStats,
  WorkflowStats,
  BulkUpdateData,
  TaskExportOptions,
  CalendarEvent,
  TaskComment,
  TaskCommentsResponse,
  CreateCommentRequest,
  TaskActionHistory,
  TaskHistoryResponse,
  TaskDelegation,
  TaskAssignee,
  TaskTemplate,
  TaskNotification,
} from '@/types/workflow.types'

class WorkflowService {
  private baseUrl = '/workflow/tasks'
  private workflowsUrl = '/workflows'

  /**
   * Get tasks with filtering, sorting, and pagination
   */
  async getTasks(
    filters: TaskFilter = {},
    sort: TaskSort = { field: 'due_date', order: 'asc' },
    page: number = 1,
    perPage: number = 20
  ): Promise<GetTasksResponse> {
    const params = new URLSearchParams()
    
    // Add filters
    if (filters.status?.length) {
      filters.status.forEach(status => params.append('status', status))
    }
    if (filters.priority?.length) {
      filters.priority.forEach(priority => params.append('priority', priority))
    }
    if (filters.assignee_id?.length) {
      filters.assignee_id.forEach(id => params.append('assignee_id', id))
    }
    if (filters.workflow_type?.length) {
      filters.workflow_type.forEach(type => params.append('workflow_type', type))
    }
    if (filters.due_date_start) {
      params.append('due_date_start', filters.due_date_start)
    }
    if (filters.due_date_end) {
      params.append('due_date_end', filters.due_date_end)
    }
    if (filters.overdue_only) {
      params.append('overdue_only', 'true')
    }
    if (filters.search_query) {
      params.append('search', filters.search_query)
    }
    if (filters.tags?.length) {
      filters.tags.forEach(tag => params.append('tag', tag))
    }

    // Add sorting
    params.append('sort_by', sort.field)
    params.append('sort_order', sort.order)

    // Add pagination
    params.append('page', page.toString())
    params.append('per_page', perPage.toString())

    const response = await apiClient.get<GetTasksResponse>(`${this.baseUrl}?${params.toString()}`)
    return response.data
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<WorkflowTask> {
    const response = await apiClient.get<WorkflowTask>(`${this.baseUrl}/${taskId}`)
    return response.data
  }

  /**
   * Create a new task
   */
  async createTask(taskData: CreateTaskRequest): Promise<WorkflowTask> {
    const response = await apiClient.post<WorkflowTask>(this.baseUrl, taskData)
    return response.data
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<WorkflowTask> {
    const response = await apiClient.put<WorkflowTask>(`${this.baseUrl}/${taskId}`, updates)
    return response.data
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${taskId}`)
  }

  /**
   * Start a task (change status to In Progress)
   */
  async startTask(taskId: string): Promise<WorkflowTask> {
    const response = await apiClient.post<WorkflowTask>(`${this.baseUrl}/${taskId}/start`)
    return response.data
  }

  /**
   * Complete a task (change status to Completed)
   */
  async completeTask(taskId: string, actualHours?: number): Promise<WorkflowTask> {
    const response = await apiClient.post<WorkflowTask>(`${this.baseUrl}/${taskId}/complete`, {
      actual_hours: actualHours
    })
    return response.data
  }

  /**
   * Reassign a task to another user
   */
  async reassignTask(taskId: string, assigneeId: string): Promise<WorkflowTask> {
    const response = await apiClient.post<WorkflowTask>(`${this.baseUrl}/${taskId}/reassign`, {
      assignee_id: assigneeId
    })
    return response.data
  }

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdateTasks(bulkData: BulkUpdateData): Promise<WorkflowTask[]> {
    const response = await apiClient.post<WorkflowTask[]>(`${this.baseUrl}/bulk-update`, bulkData)
    return response.data
  }

  /**
   * Get task comments
   */
  async getTaskComments(taskId: string, page: number = 1): Promise<TaskCommentsResponse> {
    const response = await apiClient.get<TaskCommentsResponse>(
      `${this.baseUrl}/${taskId}/comments?page=${page}`
    )
    return response.data
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, commentData: CreateCommentRequest): Promise<TaskComment> {
    const response = await apiClient.post<TaskComment>(
      `${this.baseUrl}/${taskId}/comments`,
      commentData
    )
    return response.data
  }

  /**
   * Update a comment
   */
  async updateComment(taskId: string, commentId: string, content: string): Promise<TaskComment> {
    const response = await apiClient.put<TaskComment>(
      `${this.baseUrl}/${taskId}/comments/${commentId}`,
      { content }
    )
    return response.data
  }

  /**
   * Delete a comment
   */
  async deleteComment(taskId: string, commentId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${taskId}/comments/${commentId}`)
  }

  /**
   * Get task action history
   */
  async getTaskHistory(taskId: string, page: number = 1): Promise<TaskHistoryResponse> {
    const response = await apiClient.get<TaskHistoryResponse>(
      `${this.baseUrl}/${taskId}/history?page=${page}`
    )
    return response.data
  }

  /**
   * Upload attachment to task
   */
  async uploadAttachment(taskId: string, file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<{ id: string; url: string }>(
      `${this.baseUrl}/${taskId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  }

  /**
   * Delete attachment from task
   */
  async deleteAttachment(taskId: string, attachmentId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${taskId}/attachments/${attachmentId}`)
  }

  /**
   * Get task statistics
   */
  async getTaskStats(filters?: TaskFilter): Promise<TaskStats> {
    const params = new URLSearchParams()
    
    if (filters?.status?.length) {
      filters.status.forEach(status => params.append('status', status))
    }
    if (filters?.assignee_id?.length) {
      filters.assignee_id.forEach(id => params.append('assignee_id', id))
    }
    if (filters?.workflow_type?.length) {
      filters.workflow_type.forEach(type => params.append('workflow_type', type))
    }

    const response = await apiClient.get<TaskStats>(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<WorkflowStats> {
    const response = await apiClient.get<WorkflowStats>('/workflow/stats')
    return response.data
  }

  /**
   * Export tasks
   */
  async exportTasks(exportOptions: TaskExportOptions): Promise<Blob> {
    const response = await apiClient.post(`${this.baseUrl}/export`, exportOptions, {
      responseType: 'blob',
    })
    return response.data
  }

  /**
   * Get calendar events for tasks
   */
  async getCalendarEvents(startDate: string, endDate: string, filters?: TaskFilter): Promise<CalendarEvent[]> {
    const params = new URLSearchParams()
    params.append('start_date', startDate)
    params.append('end_date', endDate)

    if (filters?.assignee_id?.length) {
      filters.assignee_id.forEach(id => params.append('assignee_id', id))
    }
    if (filters?.workflow_type?.length) {
      filters.workflow_type.forEach(type => params.append('workflow_type', type))
    }

    const response = await apiClient.get<CalendarEvent[]>(`${this.baseUrl}/calendar?${params.toString()}`)
    return response.data
  }

  /**
   * Get available assignees
   */
  async getAssignees(): Promise<TaskAssignee[]> {
    const response = await apiClient.get<TaskAssignee[]>('/users/assignees')
    return response.data
  }

  /**
   * Get task templates
   */
  async getTaskTemplates(): Promise<TaskTemplate[]> {
    const response = await apiClient.get<TaskTemplate[]>('/workflow/templates')
    return response.data
  }

  /**
   * Create task from template
   */
  async createTaskFromTemplate(templateId: string, overrides: Partial<CreateTaskRequest>): Promise<WorkflowTask> {
    const response = await apiClient.post<WorkflowTask>(`/workflow/templates/${templateId}/create-task`, overrides)
    return response.data
  }

  /**
   * Delegate task
   */
  async delegateTask(taskId: string, toUserId: string, reason: string): Promise<TaskDelegation> {
    const response = await apiClient.post<TaskDelegation>(`${this.baseUrl}/${taskId}/delegate`, {
      to_user_id: toUserId,
      reason,
    })
    return response.data
  }

  /**
   * Get task notifications for current user
   */
  async getTaskNotifications(): Promise<TaskNotification[]> {
    const response = await apiClient.get<TaskNotification[]>('/notifications/tasks')
    return response.data
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    await apiClient.post(`/notifications/${notificationId}/read`)
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<WorkflowTask[]> {
    const response = await apiClient.get<WorkflowTask[]>(`${this.baseUrl}/overdue`)
    return response.data
  }

  /**
   * Get my tasks (assigned to current user)
   */
  async getMyTasks(status?: string[]): Promise<WorkflowTask[]> {
    const params = new URLSearchParams()
    if (status?.length) {
      status.forEach(s => params.append('status', s))
    }

    const response = await apiClient.get<WorkflowTask[]>(`${this.baseUrl}/my-tasks?${params.toString()}`)
    return response.data
  }

  /**
   * Search tasks by query
   */
  async searchTasks(query: string, filters?: TaskFilter): Promise<WorkflowTask[]> {
    const params = new URLSearchParams()
    params.append('q', query)

    if (filters?.status?.length) {
      filters.status.forEach(status => params.append('status', status))
    }
    if (filters?.priority?.length) {
      filters.priority.forEach(priority => params.append('priority', priority))
    }

    const response = await apiClient.get<WorkflowTask[]>(`${this.baseUrl}/search?${params.toString()}`)
    return response.data
  }

  // WORKFLOW MANAGEMENT METHODS

  /**
   * Get workflows with filtering, sorting, and pagination
   */
  async getWorkflows(
    filters: any = {},
    sort: any = { field: 'lastModified', order: 'desc' },
    page: number = 1,
    perPage: number = 25
  ): Promise<any> {
    const params = new URLSearchParams()

    // Add filters
    if (filters.status?.length) {
      filters.status.forEach((status: string) => params.append('status', status))
    }
    if (filters.category?.length) {
      filters.category.forEach((category: string) => params.append('category', category))
    }
    if (filters.ownerId?.length) {
      filters.ownerId.forEach((id: string) => params.append('owner_id', id))
    }
    if (filters.tags?.length) {
      filters.tags.forEach((tag: string) => params.append('tag', tag))
    }
    if (filters.createdAfter) {
      params.append('created_after', filters.createdAfter)
    }
    if (filters.createdBefore) {
      params.append('created_before', filters.createdBefore)
    }
    if (filters.modifiedAfter) {
      params.append('modified_after', filters.modifiedAfter)
    }
    if (filters.modifiedBefore) {
      params.append('modified_before', filters.modifiedBefore)
    }
    if (filters.searchQuery) {
      params.append('search', filters.searchQuery)
    }

    // Add sorting
    params.append('sort_by', sort.field)
    params.append('sort_order', sort.order)

    // Add pagination
    params.append('page', page.toString())
    params.append('per_page', perPage.toString())

    const response = await apiClient.get<any>(`${this.workflowsUrl}?${params.toString()}`)
    return response.data
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<any> {
    const response = await apiClient.get<any>(`${this.workflowsUrl}/stats`)
    return response.data
  }

  /**
   * Get workflow templates
   */
  async getWorkflowTemplates(): Promise<any[]> {
    const response = await apiClient.get<any[]>(`${this.workflowsUrl}/templates`)
    return response.data
  }

  /**
   * Clone workflow
   */
  async cloneWorkflow(workflowId: string, options?: any): Promise<any> {
    const response = await apiClient.post<any>(`${this.workflowsUrl}/${workflowId}/clone`, options)
    return response.data
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await apiClient.delete(`${this.workflowsUrl}/${workflowId}`)
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(workflowId: string): Promise<any> {
    const response = await apiClient.post<any>(`${this.workflowsUrl}/${workflowId}/activate`)
    return response.data
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<any> {
    const response = await apiClient.post<any>(`${this.workflowsUrl}/${workflowId}/deactivate`)
    return response.data
  }

  /**
   * Bulk update workflows
   */
  async bulkUpdateWorkflows(bulkData: any): Promise<any[]> {
    const response = await apiClient.post<any[]>(`${this.workflowsUrl}/bulk-update`, bulkData)
    return response.data
  }

  /**
   * Export workflows
   */
  async exportWorkflows(exportOptions: any): Promise<Blob> {
    const response = await apiClient.post(`${this.workflowsUrl}/export`, exportOptions, {
      responseType: 'blob',
    })
    return response.data
  }

  /**
   * Import workflow
   */
  async importWorkflow(file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<any>(`${this.workflowsUrl}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  /**
   * Get workflow versions/history
   */
  async getWorkflowVersions(workflowId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`${this.workflowsUrl}/${workflowId}/versions`)
    return response.data
  }

  /**
   * Compare workflow versions
   */
  async compareWorkflowVersions(workflowId: string, version1: string, version2: string): Promise<any> {
    const response = await apiClient.get<any>(`${this.workflowsUrl}/${workflowId}/compare?v1=${version1}&v2=${version2}`)
    return response.data
  }

  /**
   * Get workflow usage analytics
   */
  async getWorkflowUsageAnalytics(workflowId: string): Promise<any> {
    const response = await apiClient.get<any>(`${this.workflowsUrl}/${workflowId}/analytics`)
    return response.data
  }
}

export const workflowService = new WorkflowService()