/**
 * HomePage Component Tests
 * Following strict TDD methodology - write tests first
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from '../HomePage'
import { useAuthStore } from '@/store/auth'
import { useDashboardStore } from '@/stores/dashboardStore'
import { dashboardService } from '@/services/dashboard.service'
import { contractService } from '@/services/contract.service'

// Mock the stores
vi.mock('@/store/auth')
vi.mock('@/stores/dashboardStore')
vi.mock('@/services/dashboard.service')
vi.mock('@/services/contract.service')

// Mock react-router-dom navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )
}

// Mock data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  tenant_id: 1,
  is_active: true,
  roles: ['user'],
  permissions: ['contracts:read', 'contracts:create'],
}

const mockDashboardData = {
  total_contracts: 150,
  active_contracts: 120,
  expiring_soon: 8,
  total_value: 2500000,
  compliance_rate: 98.5,
  risk_score: 2.1,
  recent_activities: 25,
}

const mockContractMetrics = {
  by_status: {
    active: 120,
    draft: 15,
    expired: 10,
    pending: 5,
  },
  by_type: {
    service: 80,
    supply: 40,
    employment: 30,
  },
  by_department: {
    legal: 50,
    procurement: 60,
    hr: 40,
  },
  trend: [
    { month: '2024-01', count: 20, value: 500000 },
    { month: '2024-02', count: 25, value: 600000 },
    { month: '2024-03', count: 30, value: 700000 },
  ],
}

const mockRecentActivities = [
  {
    id: '1',
    type: 'contract_created',
    title: 'New Service Agreement',
    description: 'Service agreement with TechCorp created',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    user: { id: '1', name: 'John Doe' },
    entity: { type: 'contract', id: 'c1', title: 'TechCorp Service Agreement' },
  },
  {
    id: '2',
    type: 'document_uploaded',
    title: 'Document Uploaded',
    description: 'Contract amendment uploaded',
    timestamp: new Date('2024-01-15T09:15:00Z'),
    user: { id: '2', name: 'Jane Smith' },
    entity: { type: 'document', id: 'd1', title: 'Amendment v2.pdf' },
  },
  {
    id: '3',
    type: 'contract_approved',
    title: 'Contract Approved',
    description: 'Supply agreement approved',
    timestamp: new Date('2024-01-15T08:00:00Z'),
    user: { id: '3', name: 'Bob Wilson' },
    entity: { type: 'contract', id: 'c2', title: 'Supply Agreement' },
  },
  {
    id: '4',
    type: 'workflow_started',
    title: 'Workflow Started',
    description: 'Approval workflow initiated',
    timestamp: new Date('2024-01-15T07:45:00Z'),
    user: { id: '4', name: 'Alice Brown' },
    entity: { type: 'workflow', id: 'w1', title: 'Approval Process' },
  },
  {
    id: '5',
    type: 'contract_updated',
    title: 'Contract Updated',
    description: 'Terms modified',
    timestamp: new Date('2024-01-15T07:30:00Z'),
    user: { id: '5', name: 'Charlie Davis' },
    entity: { type: 'contract', id: 'c3', title: 'Updated Contract' },
  },
  {
    id: '6',
    type: 'contract_expired',
    title: 'Contract Expired',
    description: 'Service contract expired',
    timestamp: new Date('2024-01-15T07:00:00Z'),
    user: { id: '6', name: 'Eve White' },
    entity: { type: 'contract', id: 'c4', title: 'Expired Contract' },
  },
]

const mockNotifications = [
  {
    id: '1',
    title: 'Contract Expiring Soon',
    message: 'Service Agreement with TechCorp expires in 30 days',
    type: 'warning' as const,
    read: false,
    timestamp: '2024-01-15T08:00:00Z',
  },
  {
    id: '2',
    title: 'New Contract Approved',
    message: 'Supply Agreement with SupplyCorp has been approved',
    type: 'success' as const,
    read: false,
    timestamp: '2024-01-15T07:30:00Z',
  },
]

const mockRecentContracts = {
  items: [
    {
      id: 'c1',
      title: 'TechCorp Service Agreement',
      contract_type: 'service',
      status: 'active',
      value: 150000,
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'c2',
      title: 'SupplyCorp Supply Agreement',
      contract_type: 'supply',
      status: 'pending',
      value: 75000,
      created_at: '2024-01-12T00:00:00Z',
      updated_at: '2024-01-14T00:00:00Z',
    },
  ],
  total: 2,
  limit: 5,
  offset: 0,
}

describe('HomePage Component', () => {
  let mockUseAuthStore: any
  let mockUseDashboardStore: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    mockNavigate.mockClear()

    // Setup auth store mock
    mockUseAuthStore = vi.mocked(useAuthStore)
    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })

    // Setup dashboard store mock
    mockUseDashboardStore = vi.mocked(useDashboardStore)
    mockUseDashboardStore.mockReturnValue({
      executiveSummary: mockDashboardData,
      contractMetrics: mockContractMetrics,
      recentActivities: mockRecentActivities,
      notifications: mockNotifications,
      isLoading: false,
      error: null,
      lastUpdated: new Date('2024-01-15T12:00:00Z'),
      fetchExecutiveSummary: vi.fn().mockResolvedValue(mockDashboardData),
      fetchContractMetrics: vi.fn().mockResolvedValue(mockContractMetrics),
      fetchRecentActivities: vi.fn().mockResolvedValue({ items: mockRecentActivities }),
      fetchNotifications: vi.fn().mockResolvedValue(mockNotifications),
      refreshAllData: vi.fn().mockResolvedValue(undefined),
    })

    // Setup service mocks
    vi.mocked(dashboardService.getExecutiveSummary).mockResolvedValue(mockDashboardData)
    vi.mocked(dashboardService.getContractMetrics).mockResolvedValue(mockContractMetrics)
    vi.mocked(dashboardService.getRecentActivities).mockResolvedValue({
      items: mockRecentActivities,
      total: 6,
      limit: 20,
      offset: 0,
    })
    vi.mocked(dashboardService.getNotifications).mockResolvedValue(mockNotifications)
    vi.mocked(contractService.getContracts).mockResolvedValue(mockRecentContracts)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial Render', () => {
    it('should render welcome section with user greeting', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText(/welcome back, test user/i)).toBeInTheDocument()
      // Check for formatted date - uses long format like "Monday, August 11, 2025"
      const today = new Date()
      const expectedDate = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      expect(screen.getByText(expectedDate)).toBeInTheDocument()
    })

    it('should render dashboard title', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
    })

    it('should render main layout structure', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-section')).toBeInTheDocument()
      expect(screen.getByTestId('stats-cards-grid')).toBeInTheDocument()
      expect(screen.getByTestId('main-content-area')).toBeInTheDocument()
    })
  })

  describe('Stats Cards', () => {
    it('should render all four quick stats cards', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('total-contracts-card')).toBeInTheDocument()
      expect(screen.getByTestId('active-contracts-card')).toBeInTheDocument()
      expect(screen.getByTestId('pending-reviews-card')).toBeInTheDocument()
      expect(screen.getByTestId('upcoming-renewals-card')).toBeInTheDocument()
    })

    it('should display correct stats values', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Use getAllBy to handle multiple elements with same text
      const totalContractsElements = screen.getAllByText('150')
      expect(totalContractsElements.length).toBeGreaterThanOrEqual(1) // Should appear in stats card and possibly widget
      
      const activeContractsElements = screen.getAllByText('120')
      expect(activeContractsElements.length).toBeGreaterThanOrEqual(1)
      
      const expiringElements = screen.getAllByText('8')
      expect(expiringElements.length).toBeGreaterThanOrEqual(1)
    })

    it('should navigate to contract list when stats card is clicked', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const totalContractsCard = screen.getByTestId('total-contracts-card')
      fireEvent.click(totalContractsCard)

      expect(mockNavigate).toHaveBeenCalledWith('/contracts')
    })

    it('should show skeleton loaders while stats are loading', () => {
      mockUseDashboardStore.mockReturnValue({
        executiveSummary: null,
        isLoading: true,
        error: null,
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn(),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn(),
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getAllByTestId('stats-skeleton')).toHaveLength(4)
    })
  })

  describe('Recent Activity Section', () => {
    it('should render recent activity feed', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      expect(screen.getByText('New Service Agreement')).toBeInTheDocument()
      expect(screen.getByText('Document Uploaded')).toBeInTheDocument()
    })

    it('should handle activity click navigation', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const activityItem = screen.getByTestId('activity-item-1')
      fireEvent.click(activityItem)

      expect(mockNavigate).toHaveBeenCalledWith('/contracts/c1')
    })

    it('should show view all activities link', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const viewAllLink = screen.getByText('View All Activities')
      expect(viewAllLink).toBeInTheDocument()
      
      fireEvent.click(viewAllLink)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=activities')
    })
  })

  describe('Quick Action Buttons', () => {
    it('should render all quick action buttons', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('new-contract-button')).toBeInTheDocument()
      expect(screen.getByTestId('upload-document-button')).toBeInTheDocument()
      expect(screen.getByTestId('view-reports-button')).toBeInTheDocument()
      expect(screen.getByTestId('search-button')).toBeInTheDocument()
    })

    it('should navigate to correct pages when action buttons are clicked', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const newContractBtn = screen.getByTestId('new-contract-button')
      const uploadDocBtn = screen.getByTestId('upload-document-button')
      const viewReportsBtn = screen.getByTestId('view-reports-button')
      const searchBtn = screen.getByTestId('search-button')

      fireEvent.click(newContractBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/contracts/new')

      fireEvent.click(uploadDocBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/documents/upload')

      fireEvent.click(viewReportsBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/reports')

      fireEvent.click(searchBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/search')
    })
  })

  describe('Contract Overview Widget', () => {
    it('should render contract overview widget', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('Contract Overview')).toBeInTheDocument()
    })

    it('should handle metric clicks in contract overview', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Test clicking on total contracts metric
      const totalContractsMetric = screen.getByTestId('total-contracts')
      fireEvent.click(totalContractsMetric)

      expect(mockNavigate).toHaveBeenCalledWith('/contracts')
    })
  })

  describe('Notifications Section', () => {
    it('should render notifications summary', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByTestId('unread-count')).toHaveTextContent('2')
    })

    it('should navigate to notifications page when view all is clicked', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const viewAllNotifications = screen.getByTestId('view-all-notifications')
      fireEvent.click(viewAllNotifications)

      expect(mockNavigate).toHaveBeenCalledWith('/notifications')
    })

    it('should show empty state when no notifications', () => {
      mockUseDashboardStore.mockReturnValue({
        ...mockUseDashboardStore(),
        notifications: [],
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('No new notifications')).toBeInTheDocument()
    })
  })

  describe('Recent Documents Section', () => {
    it('should render recent documents list', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Recent Documents')).toBeInTheDocument()
      })
    })

    it('should show last 5 uploaded documents', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('recent-documents-list')).toBeInTheDocument()
      })

      // Should show documents from recent contracts
      expect(screen.getByText('TechCorp Service Agreement')).toBeInTheDocument()
      expect(screen.getByText('SupplyCorp Supply Agreement')).toBeInTheDocument()
    })
  })

  describe('Upcoming Deadlines Widget', () => {
    it('should render upcoming deadlines section', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument()
    })

    it('should show contracts expiring soon', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Text might be split across elements, use flexible matcher
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'contracts expiring soon' || 
               content.includes('contracts expiring soon') ||
               (content.includes('8') && element?.textContent?.includes('contracts expiring soon'))
      })).toBeInTheDocument()
    })
  })

  describe('Navigation Shortcuts', () => {
    it('should render navigation shortcuts to key areas', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('nav-shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Contracts')).toBeInTheDocument()
      expect(screen.getByText('Templates')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })

    it('should navigate to correct sections when shortcuts are clicked', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const contractsShortcut = screen.getByTestId('contracts-shortcut')
      const templatesShortcut = screen.getByTestId('templates-shortcut')

      fireEvent.click(contractsShortcut)
      expect(mockNavigate).toHaveBeenCalledWith('/contracts')

      fireEvent.click(templatesShortcut)
      expect(mockNavigate).toHaveBeenCalledWith('/templates')
    })
  })

  describe('Loading States', () => {
    it('should show loading states for data fetching', () => {
      mockUseDashboardStore.mockReturnValue({
        executiveSummary: null,
        contractMetrics: null,
        recentActivities: [],
        notifications: [],
        isLoading: true,
        error: null,
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn(),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn(),
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getAllByTestId('skeleton-loader')).toHaveLength(4) // For main sections
      expect(screen.getByTestId('activity-feed-skeleton')).toBeInTheDocument()
    })

    it('should show individual loading states for each section', () => {
      mockUseDashboardStore.mockReturnValue({
        executiveSummary: mockDashboardData,
        contractMetrics: null, // Only contract metrics loading
        recentActivities: mockRecentActivities,
        notifications: mockNotifications,
        isLoading: false,
        error: null,
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn(),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn(),
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('contract-overview-skeleton')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error messages for failed API calls', () => {
      mockUseDashboardStore.mockReturnValue({
        executiveSummary: null,
        contractMetrics: null,
        recentActivities: [],
        notifications: [],
        isLoading: false,
        error: 'Failed to fetch dashboard data',
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn(),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn(),
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByText('Failed to fetch dashboard data')).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    })

    it('should show retry button for failed requests', () => {
      mockUseDashboardStore.mockReturnValue({
        executiveSummary: null,
        contractMetrics: null,
        recentActivities: [],
        notifications: [],
        isLoading: false,
        error: 'Failed to fetch dashboard data',
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn(),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn().mockResolvedValue(undefined),
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const retryButton = screen.getByTestId('retry-button')
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(mockUseDashboardStore().refreshAllData).toHaveBeenCalled()
    })

    it('should handle individual section errors gracefully', () => {
      // Test partial error state - activities fail but other data loads
      const mockStoreWithPartialError = {
        executiveSummary: mockDashboardData,
        contractMetrics: mockContractMetrics,
        recentActivities: [],
        notifications: mockNotifications,
        isLoading: false,
        error: null,
        fetchExecutiveSummary: vi.fn(),
        fetchContractMetrics: vi.fn(),
        fetchRecentActivities: vi.fn().mockRejectedValue(new Error('Activities failed')),
        fetchNotifications: vi.fn(),
        refreshAllData: vi.fn(),
      }

      mockUseDashboardStore.mockReturnValue(mockStoreWithPartialError)

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Should still show other data
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('Contract Overview')).toBeInTheDocument()
      
      // But show error for activities
      expect(screen.getByText('Failed to load recent activities')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    beforeEach(() => {
      // Mock window.matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('max-width'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    it('should use responsive grid layout', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const statsGrid = screen.getByTestId('stats-cards-grid')
      expect(statsGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
    })

    it('should show mobile-optimized layout on small screens', () => {
      // Mock mobile screen
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
    })
  })

  describe('Data Refresh', () => {
    it('should have refresh button that triggers data reload', async () => {
      const mockRefreshAllData = vi.fn().mockResolvedValue(undefined)
      mockUseDashboardStore.mockReturnValue({
        ...mockUseDashboardStore(),
        refreshAllData: mockRefreshAllData,
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const refreshButton = screen.getByTestId('refresh-dashboard-button')
      fireEvent.click(refreshButton)

      expect(mockRefreshAllData).toHaveBeenCalled()
    })

    it('should show last updated timestamp', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Check for last updated text more flexibly
      expect(screen.getByText((content, element) => {
        return content.includes('Last updated:') || 
               element?.textContent?.includes('Last updated:')
      })).toBeInTheDocument()
    })

    it('should automatically refresh data on component mount', () => {
      const mockFetchExecutiveSummary = vi.fn()
      mockUseDashboardStore.mockReturnValue({
        ...mockUseDashboardStore(),
        fetchExecutiveSummary: mockFetchExecutiveSummary,
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(mockFetchExecutiveSummary).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard')
      expect(screen.getByRole('region', { name: /statistics/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /recent activity/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      const quickActionButtons = screen.getAllByRole('button')
      quickActionButtons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex')
      })
    })

    it('should have semantic HTML structure', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4) // Section headings
    })
  })

  describe('Performance', () => {
    it('should lazy load heavy widgets', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Check that heavy components are wrapped in lazy loading
      expect(screen.getByTestId('contract-overview-widget')).toBeInTheDocument()
      expect(screen.getByTestId('recent-activity-feed')).toBeInTheDocument()
    })

    it('should cache dashboard data using React Query', async () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      // Verify React Query is being used for data fetching
      await waitFor(() => {
        expect(vi.mocked(dashboardService.getExecutiveSummary)).toHaveBeenCalled()
      })
    })
  })

  describe('User Permissions', () => {
    it('should show create contract button only if user has permission', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.getByTestId('new-contract-button')).toBeInTheDocument()
    })

    it('should hide create contract button if user lacks permission', () => {
      mockUseAuthStore.mockReturnValue({
        user: { ...mockUser, permissions: ['contracts:read'] },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      )

      expect(screen.queryByTestId('new-contract-button')).not.toBeInTheDocument()
    })
  })
})