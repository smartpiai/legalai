/**
 * TypeScript interfaces for User Management
 * Defines all types used in the user management system
 */

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  department: string
  status: 'Active' | 'Inactive'
  lastLogin?: string
  createdAt: string
  avatar?: string
  phone?: string
  position?: string
  sessions: UserSession[]
}

export interface UserSession {
  id: string
  device: string
  location: string
  lastActivity: string
  ipAddress: string
}

export interface ActivityLogEntry {
  id: string
  userId: string
  action: string
  details: string
  timestamp: string
  ipAddress: string
}

export interface CreateUserRequest {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
  department: string
  sendWelcomeEmail: boolean
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  department?: string
  status?: 'Active' | 'Inactive'
  phone?: string
  position?: string
}

export interface BulkUpdateRequest {
  userIds: string[]
  updates: {
    status?: 'Active' | 'Inactive'
    role?: string
    department?: string
  }
}

export interface BroadcastMessageRequest {
  userIds: string[]
  subject: string
  message: string
}

export interface UserFilters {
  role?: string
  department?: string
  status?: 'Active' | 'Inactive'
  lastLoginStart?: string
  lastLoginEnd?: string
}

export interface UserSortOptions {
  field: 'name' | 'email' | 'lastLogin' | 'createdAt'
  direction: 'asc' | 'desc'
}

export interface ImportUsersResult {
  success: boolean
  imported: number
  errors?: string[]
}

export interface ExportUsersOptions {
  userIds: string[] | 'all'
  format: 'csv' | 'excel'
}

export const USER_ROLES = [
  'Admin',
  'Manager', 
  'User',
  'Viewer'
] as const

export const USER_DEPARTMENTS = [
  'Legal',
  'Contracts',
  'Finance',
  'IT',
  'HR'
] as const

export type UserRole = typeof USER_ROLES[number]
export type UserDepartment = typeof USER_DEPARTMENTS[number]