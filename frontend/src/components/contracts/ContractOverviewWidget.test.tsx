/**
 * Tests for ContractOverviewWidget component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractOverviewWidget } from './ContractOverviewWidget'

// Mock contract data for testing
const mockContractData = {
  totalContracts: 125,
  activeContracts: 98,
  pendingReview: 12,
  expiringThisMonth: 8,
  draftContracts: 15,
  approvedContracts: 83,
  renewalsNeeded: 5,
  recentlyModified: 23
}

describe('ContractOverviewWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render widget title', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      expect(screen.getByText('Contract Overview')).toBeInTheDocument()
    })

    it('should display total contracts count', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      expect(screen.getByTestId('total-contracts')).toHaveTextContent('125')
      expect(screen.getByText('Total Contracts')).toBeInTheDocument()
    })

    it('should display active contracts count', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      expect(screen.getByTestId('active-contracts')).toHaveTextContent('98')
      expect(screen.getByText('Active Contracts')).toBeInTheDocument()
    })

    it('should display pending review count', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      expect(screen.getByTestId('pending-review')).toHaveTextContent('12')
      expect(screen.getByText('Pending Review')).toBeInTheDocument()
    })

    it('should display expiring contracts count', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      expect(screen.getByTestId('expiring-contracts')).toHaveTextContent('8')
      expect(screen.getByText('Expiring This Month')).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    it('should show loading skeleton when data is loading', () => {
      render(<ContractOverviewWidget isLoading={true} />)
      expect(screen.getByTestId('widget-skeleton')).toBeInTheDocument()
      expect(screen.queryByText('Contract Overview')).not.toBeInTheDocument()
    })

    it('should not show data when loading', () => {
      render(<ContractOverviewWidget data={mockContractData} isLoading={true} />)
      expect(screen.queryByTestId('total-contracts')).not.toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('should display error message when there is an error', () => {
      const error = 'Failed to load contract data'
      render(<ContractOverviewWidget error={error} />)
      expect(screen.getByText(error)).toBeInTheDocument()
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
    })

    it('should not show data when there is an error', () => {
      render(<ContractOverviewWidget data={mockContractData} error="Error occurred" />)
      expect(screen.queryByTestId('total-contracts')).not.toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('should show empty state when no data provided', () => {
      render(<ContractOverviewWidget />)
      expect(screen.getByText('No contract data available')).toBeInTheDocument()
      expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument()
    })

    it('should show zero values when data has zero counts', () => {
      const emptyData = {
        totalContracts: 0,
        activeContracts: 0,
        pendingReview: 0,
        expiringThisMonth: 0,
        draftContracts: 0,
        approvedContracts: 0,
        renewalsNeeded: 0,
        recentlyModified: 0
      }
      
      render(<ContractOverviewWidget data={emptyData} />)
      expect(screen.getByTestId('total-contracts')).toHaveTextContent('0')
      expect(screen.getByTestId('active-contracts')).toHaveTextContent('0')
    })
  })

  describe('Interactive features', () => {
    it('should call onMetricClick when a metric is clicked', () => {
      const onMetricClick = vi.fn()
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          onMetricClick={onMetricClick} 
        />
      )

      const totalContractsMetric = screen.getByTestId('total-contracts').closest('button')
      totalContractsMetric?.click()

      expect(onMetricClick).toHaveBeenCalledWith('totalContracts', 125)
    })

    it('should show hover effects on clickable metrics', () => {
      const onMetricClick = vi.fn()
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          onMetricClick={onMetricClick} 
        />
      )

      const metric = screen.getByTestId('total-contracts').closest('button')
      expect(metric).toHaveClass('hover:bg-gray-50')
      expect(metric).toHaveClass('cursor-pointer')
    })

    it('should not show hover effects when not clickable', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      
      const metric = screen.getByTestId('total-contracts').closest('div')
      expect(metric).not.toHaveClass('hover:bg-gray-50')
      expect(metric).not.toHaveClass('cursor-pointer')
    })
  })

  describe('Custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ContractOverviewWidget 
          data={mockContractData} 
          className="custom-widget" 
        />
      )
      
      expect(container.firstChild).toHaveClass('custom-widget')
    })

    it('should use compact variant when specified', () => {
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          variant="compact" 
        />
      )
      
      const metricsGrid = screen.getByTestId('metrics-grid')
      expect(metricsGrid).toHaveClass('grid-cols-4') // More compact grid
    })

    it('should use detailed variant by default', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      
      const metricsGrid = screen.getByTestId('metrics-grid')
      expect(metricsGrid).toHaveClass('grid-cols-2') // Default grid
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      
      const widget = screen.getByRole('region')
      expect(widget).toHaveAttribute('aria-label', 'Contract overview statistics')
    })

    it('should have proper heading structure', () => {
      render(<ContractOverviewWidget data={mockContractData} />)
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Contract Overview')
    })

    it('should support keyboard navigation for interactive elements', () => {
      const onMetricClick = vi.fn()
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          onMetricClick={onMetricClick} 
        />
      )

      const metric = screen.getByTestId('total-contracts').closest('button')
      expect(metric).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Data formatting', () => {
    it('should format large numbers with commas', () => {
      const largeNumberData = {
        ...mockContractData,
        totalContracts: 1234567
      }
      
      render(<ContractOverviewWidget data={largeNumberData} />)
      expect(screen.getByTestId('total-contracts')).toHaveTextContent('1,234,567')
    })

    it('should show percentage indicators where relevant', () => {
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          showPercentages={true} 
        />
      )
      
      // Should show percentage of active contracts vs total
      expect(screen.getByText('78.4%')).toBeInTheDocument() // 98/125 * 100
    })

    it('should show trend indicators when trend data is provided', () => {
      const dataWithTrends = {
        ...mockContractData,
        trends: {
          totalContracts: { change: 5, direction: 'up' },
          pendingReview: { change: -2, direction: 'down' }
        }
      }
      
      render(<ContractOverviewWidget data={dataWithTrends} showTrends={true} />)
      
      expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument()
      expect(screen.getByTestId('trend-down-icon')).toBeInTheDocument()
      expect(screen.getByText('+5')).toBeInTheDocument()
      expect(screen.getByText('-2')).toBeInTheDocument()
    })
  })

  describe('Refresh functionality', () => {
    it('should call onRefresh when refresh button is clicked', () => {
      const onRefresh = vi.fn()
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          onRefresh={onRefresh}
          showRefresh={true}
        />
      )

      const refreshButton = screen.getByTestId('refresh-button')
      refreshButton.click()

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should show last updated timestamp when provided', () => {
      const lastUpdated = new Date('2024-01-15T10:30:00Z')
      render(
        <ContractOverviewWidget 
          data={mockContractData} 
          lastUpdated={lastUpdated}
        />
      )

      expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    })
  })
})