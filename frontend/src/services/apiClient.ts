/**
 * API Client Configuration
 * Axios instance with interceptors for authentication
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth-token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const refreshToken = localStorage.getItem('refresh-token')
      
      if (refreshToken) {
        try {
          // Try to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          })
          
          const { access_token, refresh_token: newRefreshToken } = response.data
          
          // Update tokens
          localStorage.setItem('auth-token', access_token)
          localStorage.setItem('refresh-token', newRefreshToken)
          
          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`
          }
          
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, clear auth and redirect to login
          localStorage.removeItem('auth-token')
          localStorage.removeItem('refresh-token')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
    }
    
    // Handle other errors
    if (error.response?.data) {
      const errorData = error.response.data as any
      if (error.response.status === 422 && errorData.detail) {
        // Handle FastAPI validation errors
        const validationErrors = errorData.detail.map((err: any) => `${err.loc[1]}: ${err.msg}`).join(', ')
        return Promise.reject(new Error(validationErrors))
      }
      const message = errorData.detail || errorData.message || 'An error occurred'
      return Promise.reject(new Error(message))
    }
    
    return Promise.reject(error)
  }
)

// Export types for use in components
export type ApiError = AxiosError<{
  detail?: string
  message?: string
  errors?: Record<string, string[]>
}>

export default apiClient
