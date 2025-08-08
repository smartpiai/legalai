/**
 * Tests for RecentActivityFeed component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecentActivityFeed } from './RecentActivityFeed'

// Mock activity data for testing
const mockActivityData = [
  {
    id: '1',
    type: 'contract_created',
    title: 'New contract created',
    description: 'Service Agreement with ABC Corp',
    user: { name: 'John Doe', avatar: '/avatars/john.jpg' },
    timestamp: new Date('2024-01-15T10:30:00Z'),
    metadata: { contractId: 'c-123', status: 'draft' }
  },
  {
    id: '2',
    type: 'contract_approved',
    title: 'Contract approved',
    description: 'Master Service Agreement approved by legal team',
    user: { name: 'Jane Smith', avatar: '/avatars/jane.jpg' },
    timestamp: new Date('2024-01-15T09:15:00Z'),
    metadata: { contractId: 'c-124', approver: 'Legal Team' }
  },
  {
    id: '3',
    type: 'document_uploaded',
    title: 'Document uploaded',
    description: 'Contract amendment uploaded to system',
    user: { name: 'Bob Wilson', avatar: null },
    timestamp: new Date('2024-01-15T08:45:00Z'),
    metadata: { documentId: 'd-456', fileType: 'PDF' }
  },
  {
    id: '4',
    type: 'workflow_started',
    title: 'Workflow started',
    description: 'Contract review workflow initiated',
    user: { name: 'System', avatar: null },
    timestamp: new Date('2024-01-14T16:20:00Z'),
    metadata: { workflowId: 'w-789', contractId: 'c-125' }
  }
]

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render feed title', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    it('should display all activity items', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      expect(screen.getByText('New contract created')).toBeInTheDocument()
      expect(screen.getByText('Contract approved')).toBeInTheDocument()
      expect(screen.getByText('Document uploaded')).toBeInTheDocument()
      expect(screen.getByText('Workflow started')).toBeInTheDocument()
    })

    it('should show activity descriptions', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      expect(screen.getByText('Service Agreement with ABC Corp')).toBeInTheDocument()
      expect(screen.getByText('Master Service Agreement approved by legal team')).toBeInTheDocument()
    })

    it('should display user names', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    it('should format timestamps correctly', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      // Should show relative time like "2 hours ago"
      expect(screen.getAllByText(/ago/)).toHaveLength(4) // All 4 activities show timestamps
    })
  })

  describe('Loading state', () => {
    it('should show loading skeleton when isLoading is true', () => {
      render(<RecentActivityFeed isLoading={true} />)
      expect(screen.getByTestId('activity-feed-skeleton')).toBeInTheDocument()
      expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument()
    })

    it('should show loading for individual items when loadingItemIds provided', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          loadingItemIds={['1', '3']} 
        />
      )
      
      const skeletons = screen.getAllByTestId('activity-item-skeleton')
      expect(skeletons).toHaveLength(2)
    })
  })

  describe('Error state', () => {
    it('should display error message when there is an error', () => {
      const error = 'Failed to load recent activities'
      render(<RecentActivityFeed error={error} />)
      expect(screen.getByText(error)).toBeInTheDocument()
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
    })

    it('should not show activities when there is an error', () => {
      render(<RecentActivityFeed activities={mockActivityData} error="Error" />)
      expect(screen.queryByText('New contract created')).not.toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('should show empty state when no activities provided', () => {
      render(<RecentActivityFeed activities={[]} />)
      expect(screen.getByText('No recent activity')).toBeInTheDocument()
      expect(screen.getByTestId('empty-activity-icon')).toBeInTheDocument()
    })

    it('should show custom empty message when provided', () => {
      render(
        <RecentActivityFeed 
          activities={[]} 
          emptyMessage="No activities found for this contract" 
        />
      )
      expect(screen.getByText('No activities found for this contract')).toBeInTheDocument()
    })
  })

  describe('Activity types and icons', () => {
    it('should display correct icons for different activity types', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      expect(screen.getByTestId('activity-icon-contract_created')).toBeInTheDocument()
      expect(screen.getByTestId('activity-icon-contract_approved')).toBeInTheDocument()
      expect(screen.getByTestId('activity-icon-document_uploaded')).toBeInTheDocument()
      expect(screen.getByTestId('activity-icon-workflow_started')).toBeInTheDocument()
    })

    it('should use correct colors for activity types', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const createdIcon = screen.getByTestId('activity-icon-contract_created').querySelector('svg')
      expect(createdIcon).toHaveClass('text-blue-600')
      
      const approvedIcon = screen.getByTestId('activity-icon-contract_approved').querySelector('svg')
      expect(approvedIcon).toHaveClass('text-green-600')
    })
  })

  describe('User avatars', () => {
    it('should display user avatar when available', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const avatar = screen.getByTestId('user-avatar-1')
      expect(avatar).toHaveAttribute('src', '/avatars/john.jpg')
      expect(avatar).toHaveAttribute('alt', 'John Doe')
    })

    it('should show initials when avatar is not available', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const initialsAvatar = screen.getByTestId('user-initials-3')
      expect(initialsAvatar).toHaveTextContent('BW') // Bob Wilson initials
    })

    it('should handle system user without avatar', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const systemInitials = screen.getByTestId('user-initials-4')
      expect(systemInitials).toHaveTextContent('S') // System initial
    })
  })

  describe('Interactive features', () => {
    it('should call onActivityClick when activity item is clicked', async () => {
      const user = userEvent.setup()
      const onActivityClick = vi.fn()
      
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          onActivityClick={onActivityClick} 
        />
      )

      await user.click(screen.getByTestId('activity-item-1'))
      expect(onActivityClick).toHaveBeenCalledWith(mockActivityData[0])
    })

    it('should show hover effects on clickable activities', () => {
      const onActivityClick = vi.fn()
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          onActivityClick={onActivityClick} 
        />
      )

      const activityItem = screen.getByTestId('activity-item-1')
      expect(activityItem).toHaveClass('hover:bg-gray-50')
      expect(activityItem).toHaveClass('cursor-pointer')
    })

    it('should not show hover effects when not clickable', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const activityItem = screen.getByTestId('activity-item-1')
      expect(activityItem).not.toHaveClass('hover:bg-gray-50')
      expect(activityItem).not.toHaveClass('cursor-pointer')
    })
  })

  describe('Filtering', () => {
    it('should filter activities by type when filter is provided', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          filterType="contract_created" 
        />
      )

      expect(screen.getByText('New contract created')).toBeInTheDocument()
      expect(screen.queryByText('Contract approved')).not.toBeInTheDocument()
    })

    it('should show filter controls when showFilters is true', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          showFilters={true} 
        />
      )

      expect(screen.getByTestId('activity-filters')).toBeInTheDocument()
      expect(screen.getByText('All Activities')).toBeInTheDocument()
    })

    it('should update filter when filter option is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          showFilters={true}
          onFilterChange={onFilterChange}
        />
      )

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'contract')
      expect(onFilterChange).toHaveBeenCalledWith('contract')
    })
  })

  describe('Pagination', () => {
    it('should limit activities to maxItems when specified', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          maxItems={2} 
        />
      )

      const activityItems = screen.getAllByTestId(/^activity-item-/)
      expect(activityItems).toHaveLength(2)
    })

    it('should show "View All" button when activities exceed maxItems', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData} 
          maxItems={2}
          showViewAll={true}
        />
      )

      expect(screen.getByText('View All Activities')).toBeInTheDocument()
    })

    it('should call onViewAll when "View All" is clicked', async () => {
      const user = userEvent.setup()
      const onViewAll = vi.fn()
      
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          maxItems={2}
          showViewAll={true}
          onViewAll={onViewAll}
        />
      )

      await user.click(screen.getByText('View All Activities'))
      expect(onViewAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('Refresh functionality', () => {
    it('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup()
      const onRefresh = vi.fn()
      
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          showRefresh={true}
          onRefresh={onRefresh}
        />
      )

      await user.click(screen.getByTestId('refresh-button'))
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should show refreshing state when isRefreshing is true', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          showRefresh={true}
          isRefreshing={true}
        />
      )

      const refreshButton = screen.getByTestId('refresh-button')
      expect(refreshButton).toBeDisabled()
      expect(screen.getByTestId('refresh-spinner')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const feed = screen.getByRole('region')
      expect(feed).toHaveAttribute('aria-label', 'Recent activity feed')
    })

    it('should have proper heading structure', () => {
      render(<RecentActivityFeed activities={mockActivityData} />)
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Recent Activity')
    })

    it('should support keyboard navigation for interactive elements', () => {
      const onActivityClick = vi.fn()
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          onActivityClick={onActivityClick}
        />
      )

      const activityItem = screen.getByTestId('activity-item-1')
      expect(activityItem).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <RecentActivityFeed 
          activities={mockActivityData}
          className="custom-feed" 
        />
      )
      
      expect(container.firstChild).toHaveClass('custom-feed')
    })

    it('should use compact variant when specified', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          variant="compact" 
        />
      )
      
      const feed = screen.getByTestId('activity-feed')
      expect(feed).toHaveClass('space-y-2') // More compact spacing
    })
  })

  describe('Real-time updates', () => {
    it('should highlight new activities when newActivityIds provided', () => {
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          newActivityIds={['1', '2']}
        />
      )

      const newActivity = screen.getByTestId('activity-item-1')
      expect(newActivity).toHaveClass('ring-2')
      expect(newActivity).toHaveClass('ring-blue-500')
    })

    it('should auto-refresh when enableAutoRefresh is true', async () => {
      const onRefresh = vi.fn()
      
      render(
        <RecentActivityFeed 
          activities={mockActivityData}
          enableAutoRefresh={true}
          autoRefreshInterval={1000}
          onRefresh={onRefresh}
        />
      )

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled()
      }, { timeout: 1500 })
    })
  })
})