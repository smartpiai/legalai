/**
 * TypeScript interfaces for Workflow Task Management
 * Defines all types used in the workflow task system
 */

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue'
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type WorkflowType = 
  | 'Contract Review' 
  | 'Document Approval' 
  | 'Legal Analysis' 
  | 'Compliance Check' 
  | 'Amendment Process'
  | 'Renewal Process'
  | 'Negotiation'
  | 'Risk Assessment'

export type ViewMode = 'list' | 'kanban' | 'calendar'
export type SortField = 'due_date' | 'priority' | 'created_date' | 'status' | 'title'
export type SortOrder = 'asc' | 'desc'

export interface WorkflowTask {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  workflow_name: string
  workflow_type: WorkflowType
  assignee: TaskAssignee
  creator: TaskAssignee
  due_date: string
  created_date: string
  completed_date?: string
  estimated_hours?: number
  actual_hours?: number
  sla_hours?: number
  tags: string[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  checklist_items?: ChecklistItem[]
  dependencies?: string[]
  contract_id?: string
  document_id?: string
}

export interface TaskAssignee {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
  department: string
}

export interface TaskComment {
  id: string
  content: string
  author: TaskAssignee
  created_at: string
  edited_at?: string
  mentions?: string[]
  attachments?: TaskAttachment[]
}

export interface TaskAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploaded_by: string
  uploaded_at: string
}

export interface ChecklistItem {
  id: string
  title: string
  completed: boolean
  completed_at?: string
  completed_by?: string
}

export interface TaskFilter {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  assignee_id?: string[]
  workflow_type?: WorkflowType[]
  due_date_start?: string
  due_date_end?: string
  overdue_only?: boolean
  search_query?: string
  tags?: string[]
}

export interface TaskSort {
  field: SortField
  order: SortOrder
}

export interface TaskStats {
  total: number
  pending: number
  in_progress: number
  completed: number
  overdue: number
  completion_rate: number
  average_completion_time_hours: number
  sla_compliance_rate: number
}

export interface WorkflowStats {
  [key: string]: {
    total_tasks: number
    completed_tasks: number
    average_completion_time_hours: number
    overdue_count: number
  }
}

export interface TaskActionHistory {
  id: string
  action: string
  details: string
  performed_by: TaskAssignee
  timestamp: string
  old_value?: string
  new_value?: string
}

export interface TaskFormData {
  title: string
  description: string
  priority: TaskPriority
  workflow_type: WorkflowType
  assignee_id: string
  due_date: string
  estimated_hours?: number
  tags: string[]
  checklist_items: Omit<ChecklistItem, 'id' | 'completed' | 'completed_at' | 'completed_by'>[]
  dependencies: string[]
}

export interface BulkUpdateData {
  task_ids: string[]
  updates: {
    status?: TaskStatus
    priority?: TaskPriority
    assignee_id?: string
    due_date?: string
    tags?: string[]
  }
}

export interface TaskExportOptions {
  format: 'csv' | 'excel' | 'pdf'
  filters: TaskFilter
  fields: string[]
  include_comments?: boolean
  include_attachments?: boolean
  include_history?: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  workflow_type: WorkflowType
}

export interface KanbanColumn {
  id: TaskStatus
  title: string
  tasks: WorkflowTask[]
  count: number
  color: string
}

export interface TaskDelegation {
  task_id: string
  from_user_id: string
  to_user_id: string
  reason: string
  requires_approval: boolean
  approved: boolean
  approved_by?: string
  approved_at?: string
  delegated_at: string
}

export interface TaskNotification {
  id: string
  task_id: string
  type: 'reminder' | 'overdue' | 'assigned' | 'completed' | 'comment' | 'due_soon'
  message: string
  recipient_id: string
  sent_at: string
  read: boolean
}

export interface TaskTemplate {
  id: string
  name: string
  description: string
  workflow_type: WorkflowType
  default_priority: TaskPriority
  estimated_hours: number
  checklist_template: string[]
  tags: string[]
  sla_hours: number
}

// API Response interfaces
export interface GetTasksResponse {
  tasks: WorkflowTask[]
  total: number
  page: number
  per_page: number
  total_pages: number
  stats: TaskStats
}

export interface CreateTaskRequest {
  title: string
  description: string
  priority: TaskPriority
  workflow_type: WorkflowType
  assignee_id: string
  due_date: string
  estimated_hours?: number
  tags?: string[]
  contract_id?: string
  document_id?: string
  checklist_items?: string[]
  dependencies?: string[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  tags?: string[]
}

export interface TaskCommentsResponse {
  comments: TaskComment[]
  total: number
}

export interface CreateCommentRequest {
  content: string
  mentions?: string[]
  attachment_ids?: string[]
}

export interface TaskHistoryResponse {
  history: TaskActionHistory[]
  total: number
}

// Constants
export const TASK_STATUSES: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'Pending', label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  { value: 'In Progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'Completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'Overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
]

export const TASK_PRIORITIES: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 'Low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'High', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'Urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
]

export const WORKFLOW_TYPES: Array<{ value: WorkflowType; label: string }> = [
  { value: 'Contract Review', label: 'Contract Review' },
  { value: 'Document Approval', label: 'Document Approval' },
  { value: 'Legal Analysis', label: 'Legal Analysis' },
  { value: 'Compliance Check', label: 'Compliance Check' },
  { value: 'Amendment Process', label: 'Amendment Process' },
  { value: 'Renewal Process', label: 'Renewal Process' },
  { value: 'Negotiation', label: 'Negotiation' },
  { value: 'Risk Assessment', label: 'Risk Assessment' },
]

export const KANBAN_COLUMNS: Array<{ id: TaskStatus; title: string; color: string }> = [
  { id: 'Pending', title: 'Pending', color: 'bg-gray-100' },
  { id: 'In Progress', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'Completed', title: 'Completed', color: 'bg-green-100' },
  { id: 'Overdue', title: 'Overdue', color: 'bg-red-100' },
]

export const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created_date', label: 'Created Date' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
]