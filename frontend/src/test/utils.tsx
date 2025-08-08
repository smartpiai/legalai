/**
 * Testing utilities and custom render function
 * Provides wrapped components with providers for testing
 */
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Create a test query client with shorter defaults for testing
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Provider wrapper for tests
interface AllProvidersProps {
  children: React.ReactNode
}

export const AllProviders: React.FC<AllProvidersProps> = ({ children }) => {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  tenant_id: 1,
  is_active: true,
  is_superuser: false,
  roles: ['viewer'],
  ...overrides,
})

export const createMockContract = (overrides = {}) => ({
  id: 1,
  name: 'Test Contract',
  status: 'draft',
  value: 10000,
  tenant_id: 1,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockDocument = (overrides = {}) => ({
  id: 1,
  name: 'test-document.pdf',
  file_type: 'application/pdf',
  file_size: 1024000,
  tenant_id: 1,
  uploaded_by: 1,
  created_at: new Date().toISOString(),
  ...overrides,
})

// API mock utilities
export const mockApiResponse = <T,>(data: T, delay = 0) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

export const mockApiError = (message: string, status = 400, delay = 0) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject({
        response: {
          status,
          data: { detail: message },
        },
      })
    }, delay)
  })
}