import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetricsCalculationEngine } from '../MetricsCalculationEngine';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock API calls
const mockApi = {
  getMetrics: vi.fn(),
  calculateMetrics: vi.fn(),
  getContractVolume: vi.fn(),
  getCycleTime: vi.fn(),
  getValueAnalytics: vi.fn(),
  getRiskScores: vi.fn(),
  getCompliance: vi.fn(),
  getUserActivity: vi.fn(),
  getCostSavings: vi.fn(),
  getEfficiency: vi.fn(),
  getTrends: vi.fn(),
  getPredictions: vi.fn(),
  scheduleCalculation: vi.fn(),
  exportMetrics: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('MetricsCalculationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: (perm: string) => true
    });
  });

  describe('Dashboard Overview', () => {
    it('should render metrics dashboard', () => {
      render(<MetricsCalculationEngine />, { wrapper });
      expect(screen.getByText('Metrics Calculation Engine')).toBeInTheDocument();
      expect(screen.getByText(/calculate and analyze contract metrics/i)).toBeInTheDocument();
    });

    it('should display calculation status', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('calculation-status')).toBeInTheDocument();
        expect(screen.getByText(/last calculated/i)).toBeInTheDocument();
      });
    });

    it('should show metric summary cards', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Total Metrics')).toBeInTheDocument();
        expect(screen.getByText('Active Calculations')).toBeInTheDocument();
        expect(screen.getByText('Data Points')).toBeInTheDocument();
        expect(screen.getByText('Update Frequency')).toBeInTheDocument();
      });
    });
  });

  describe('Contract Volume Metrics', () => {
    it('should display volume metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /volume/i }));
      await waitFor(() => {
        expect(screen.getByText('Total Contracts')).toBeInTheDocument();
        expect(screen.getByText('Active Contracts')).toBeInTheDocument();
        expect(screen.getByText('New This Month')).toBeInTheDocument();
      });
    });

    it('should show volume trends', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /volume/i }));
      await waitFor(() => {
        expect(screen.getByTestId('volume-chart')).toBeInTheDocument();
        expect(screen.getByText(/growth rate/i)).toBeInTheDocument();
      });
    });

    it('should display volume by category', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /volume/i }));
      await waitFor(() => {
        expect(screen.getByText('By Category')).toBeInTheDocument();
        expect(screen.getByText('By Department')).toBeInTheDocument();
        expect(screen.getByText('By Status')).toBeInTheDocument();
      });
    });

    it('should calculate volume metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /volume/i }));
      fireEvent.click(screen.getByText('Calculate Volume'));
      await waitFor(() => {
        expect(screen.getByText(/calculating/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cycle Time Calculations', () => {
    it('should display cycle time metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cycle time/i }));
      await waitFor(() => {
        expect(screen.getByText('Average Cycle Time')).toBeInTheDocument();
        expect(screen.getByText('Approval Time')).toBeInTheDocument();
        expect(screen.getByText('Negotiation Time')).toBeInTheDocument();
      });
    });

    it('should show cycle time by stage', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cycle time/i }));
      await waitFor(() => {
        expect(screen.getByText('Draft Stage')).toBeInTheDocument();
        expect(screen.getByText('Review Stage')).toBeInTheDocument();
        expect(screen.getByText('Approval Stage')).toBeInTheDocument();
        expect(screen.getByText('Execution Stage')).toBeInTheDocument();
      });
    });

    it('should display bottleneck analysis', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cycle time/i }));
      await waitFor(() => {
        expect(screen.getByText('Bottlenecks')).toBeInTheDocument();
        expect(screen.getByTestId('bottleneck-analysis')).toBeInTheDocument();
      });
    });

    it('should show time distribution', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cycle time/i }));
      await waitFor(() => {
        expect(screen.getByTestId('time-distribution')).toBeInTheDocument();
        expect(screen.getByText(/median time/i)).toBeInTheDocument();
      });
    });
  });

  describe('Value Analytics', () => {
    it('should display value metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /value/i }));
      await waitFor(() => {
        expect(screen.getByText('Total Contract Value')).toBeInTheDocument();
        expect(screen.getByText('Average Value')).toBeInTheDocument();
        expect(screen.getByText('Value at Risk')).toBeInTheDocument();
      });
    });

    it('should show value distribution', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /value/i }));
      await waitFor(() => {
        expect(screen.getByTestId('value-distribution')).toBeInTheDocument();
        expect(screen.getByText(/value ranges/i)).toBeInTheDocument();
      });
    });

    it('should display value by vendor', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /value/i }));
      await waitFor(() => {
        expect(screen.getByText('Top Vendors by Value')).toBeInTheDocument();
        expect(screen.getByTestId('vendor-value-table')).toBeInTheDocument();
      });
    });

    it('should calculate ROI metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /value/i }));
      await waitFor(() => {
        expect(screen.getByText('ROI')).toBeInTheDocument();
        expect(screen.getByText('Cost Avoidance')).toBeInTheDocument();
      });
    });
  });

  describe('Risk Scoring Aggregation', () => {
    it('should display risk scores', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /risk/i }));
      await waitFor(() => {
        expect(screen.getByText('Average Risk Score')).toBeInTheDocument();
        expect(screen.getByText('High Risk Contracts')).toBeInTheDocument();
        expect(screen.getByText('Risk Mitigation Rate')).toBeInTheDocument();
      });
    });

    it('should show risk distribution', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /risk/i }));
      await waitFor(() => {
        expect(screen.getByTestId('risk-heatmap')).toBeInTheDocument();
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
        expect(screen.getByText('Low')).toBeInTheDocument();
      });
    });

    it('should display risk factors', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /risk/i }));
      await waitFor(() => {
        expect(screen.getByText('Risk Factors')).toBeInTheDocument();
        expect(screen.getByText('Financial Risk')).toBeInTheDocument();
        expect(screen.getByText('Compliance Risk')).toBeInTheDocument();
        expect(screen.getByText('Operational Risk')).toBeInTheDocument();
      });
    });

    it('should calculate risk trends', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /risk/i }));
      await waitFor(() => {
        expect(screen.getByTestId('risk-trend-chart')).toBeInTheDocument();
        expect(screen.getByText(/risk trajectory/i)).toBeInTheDocument();
      });
    });
  });

  describe('Compliance Percentages', () => {
    it('should display compliance metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByText('Overall Compliance')).toBeInTheDocument();
        expect(screen.getByText('Regulatory Compliance')).toBeInTheDocument();
        expect(screen.getByText('Policy Compliance')).toBeInTheDocument();
      });
    });

    it('should show compliance by category', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByText('GDPR Compliance')).toBeInTheDocument();
        expect(screen.getByText('SOC 2 Compliance')).toBeInTheDocument();
        expect(screen.getByText('ISO Compliance')).toBeInTheDocument();
      });
    });

    it('should display non-compliant items', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByText('Non-Compliant Contracts')).toBeInTheDocument();
        expect(screen.getByTestId('compliance-issues')).toBeInTheDocument();
      });
    });

    it('should show compliance trends', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByTestId('compliance-trend')).toBeInTheDocument();
        expect(screen.getByText(/improvement rate/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Activity Metrics', () => {
    it('should display user activity', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
      await waitFor(() => {
        expect(screen.getByText('Active Users')).toBeInTheDocument();
        expect(screen.getByText('Daily Actions')).toBeInTheDocument();
        expect(screen.getByText('Average Session Time')).toBeInTheDocument();
      });
    });

    it('should show activity by user role', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
      await waitFor(() => {
        expect(screen.getByText('Admin Activity')).toBeInTheDocument();
        expect(screen.getByText('Manager Activity')).toBeInTheDocument();
        expect(screen.getByText('Viewer Activity')).toBeInTheDocument();
      });
    });

    it('should display top users', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
      await waitFor(() => {
        expect(screen.getByText('Most Active Users')).toBeInTheDocument();
        expect(screen.getByTestId('user-leaderboard')).toBeInTheDocument();
      });
    });

    it('should show activity heatmap', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
      await waitFor(() => {
        expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument();
        expect(screen.getByText(/peak hours/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cost Savings Calculations', () => {
    it('should display cost savings', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /savings/i }));
      await waitFor(() => {
        expect(screen.getByText('Total Savings')).toBeInTheDocument();
        expect(screen.getByText('Negotiation Savings')).toBeInTheDocument();
        expect(screen.getByText('Process Savings')).toBeInTheDocument();
      });
    });

    it('should show savings breakdown', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /savings/i }));
      await waitFor(() => {
        expect(screen.getByText('By Department')).toBeInTheDocument();
        expect(screen.getByText('By Contract Type')).toBeInTheDocument();
        expect(screen.getByText('By Quarter')).toBeInTheDocument();
      });
    });

    it('should display savings opportunities', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /savings/i }));
      await waitFor(() => {
        expect(screen.getByText('Potential Savings')).toBeInTheDocument();
        expect(screen.getByTestId('opportunities-list')).toBeInTheDocument();
      });
    });

    it('should calculate projected savings', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /savings/i }));
      await waitFor(() => {
        expect(screen.getByText('Projected Annual Savings')).toBeInTheDocument();
        expect(screen.getByTestId('savings-projection')).toBeInTheDocument();
      });
    });
  });

  describe('Efficiency Measurements', () => {
    it('should display efficiency metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /efficiency/i }));
      await waitFor(() => {
        expect(screen.getByText('Process Efficiency')).toBeInTheDocument();
        expect(screen.getByText('Automation Rate')).toBeInTheDocument();
        expect(screen.getByText('Error Rate')).toBeInTheDocument();
      });
    });

    it('should show efficiency by process', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /efficiency/i }));
      await waitFor(() => {
        expect(screen.getByText('Contract Creation')).toBeInTheDocument();
        expect(screen.getByText('Review Process')).toBeInTheDocument();
        expect(screen.getByText('Approval Workflow')).toBeInTheDocument();
      });
    });

    it('should display productivity metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /efficiency/i }));
      await waitFor(() => {
        expect(screen.getByText('Contracts per User')).toBeInTheDocument();
        expect(screen.getByText('Tasks Completed')).toBeInTheDocument();
      });
    });

    it('should show efficiency trends', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /efficiency/i }));
      await waitFor(() => {
        expect(screen.getByTestId('efficiency-trend')).toBeInTheDocument();
        expect(screen.getByText(/improvement areas/i)).toBeInTheDocument();
      });
    });
  });

  describe('Trending Algorithms', () => {
    it('should display trend analysis', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));
      await waitFor(() => {
        expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
        expect(screen.getByText('Seasonal Patterns')).toBeInTheDocument();
        expect(screen.getByText('Growth Trends')).toBeInTheDocument();
      });
    });

    it('should show moving averages', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));
      await waitFor(() => {
        expect(screen.getByText('7-Day Moving Average')).toBeInTheDocument();
        expect(screen.getByText('30-Day Moving Average')).toBeInTheDocument();
        expect(screen.getByText('90-Day Moving Average')).toBeInTheDocument();
      });
    });

    it('should display trend indicators', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));
      await waitFor(() => {
        expect(screen.getByTestId('trend-indicators')).toBeInTheDocument();
        expect(screen.getByText(/trend direction/i)).toBeInTheDocument();
      });
    });

    it('should show anomaly detection', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));
      await waitFor(() => {
        expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
        expect(screen.getByTestId('anomaly-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Predictive Analytics', () => {
    it('should display predictions', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /predictive/i }));
      await waitFor(() => {
        expect(screen.getByText('Contract Volume Forecast')).toBeInTheDocument();
        expect(screen.getByText('Value Predictions')).toBeInTheDocument();
        expect(screen.getByText('Risk Forecast')).toBeInTheDocument();
      });
    });

    it('should show confidence intervals', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /predictive/i }));
      await waitFor(() => {
        expect(screen.getByText('Confidence Level')).toBeInTheDocument();
        expect(screen.getByTestId('confidence-bands')).toBeInTheDocument();
      });
    });

    it('should display model accuracy', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /predictive/i }));
      await waitFor(() => {
        expect(screen.getByText('Model Accuracy')).toBeInTheDocument();
        expect(screen.getByText('MAPE')).toBeInTheDocument();
        expect(screen.getByText('R-squared')).toBeInTheDocument();
      });
    });

    it('should show scenario analysis', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /predictive/i }));
      await waitFor(() => {
        expect(screen.getByText('Best Case')).toBeInTheDocument();
        expect(screen.getByText('Expected Case')).toBeInTheDocument();
        expect(screen.getByText('Worst Case')).toBeInTheDocument();
      });
    });
  });

  describe('Calculation Actions', () => {
    it('should trigger manual calculation', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Calculate Now'));
      await waitFor(() => {
        expect(screen.getByText(/calculating metrics/i)).toBeInTheDocument();
      });
    });

    it('should schedule calculations', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Schedule Calculation'));
      await waitFor(() => {
        expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
        expect(screen.getByLabelText('Time')).toBeInTheDocument();
      });
    });

    it('should export metrics', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Export Metrics'));
      await waitFor(() => {
        expect(screen.getByText('CSV')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
        expect(screen.getByText('JSON')).toBeInTheDocument();
      });
    });

    it('should refresh data', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Refresh Data'));
      await waitFor(() => {
        expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filters and Settings', () => {
    it('should filter by date range', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByLabelText('Date Range'));
      await waitFor(() => {
        expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
        expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
        expect(screen.getByText('Custom Range')).toBeInTheDocument();
      });
    });

    it('should filter by department', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      const departmentSelect = screen.getByLabelText('Department');
      fireEvent.change(departmentSelect, { target: { value: 'legal' } });
      await waitFor(() => {
        expect(screen.getByText(/filtered by legal/i)).toBeInTheDocument();
      });
    });

    it('should configure calculation settings', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Settings'));
      await waitFor(() => {
        expect(screen.getByText('Calculation Settings')).toBeInTheDocument();
        expect(screen.getByLabelText('Precision')).toBeInTheDocument();
        expect(screen.getByLabelText('Rounding')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should show real-time calculation progress', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Calculate Now'));
      await waitFor(() => {
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });
    });

    it('should update metrics automatically', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('auto-update-indicator')).toBeInTheDocument();
        expect(screen.getByText(/auto-updating/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<MetricsCalculationEngine />, { wrapper });
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Metrics Calculation Engine');
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      await waitFor(() => {
        expect(tabs[1]).toHaveFocus();
      });
    });

    it('should announce calculation status', async () => {
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Calculate Now'));
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/calculating/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle calculation errors', async () => {
      mockApi.calculateMetrics.mockRejectedValue(new Error('Calculation failed'));
      render(<MetricsCalculationEngine />, { wrapper });
      fireEvent.click(screen.getByText('Calculate Now'));
      await waitFor(() => {
        expect(screen.getByText(/calculation failed/i)).toBeInTheDocument();
      });
    });

    it('should show data loading errors', async () => {
      mockApi.getMetrics.mockRejectedValue(new Error('Failed to load metrics'));
      render(<MetricsCalculationEngine />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should hide calculation actions for viewers', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'analytics:view'
      });
      render(<MetricsCalculationEngine />, { wrapper });
      expect(screen.queryByText('Calculate Now')).not.toBeInTheDocument();
      expect(screen.queryByText('Schedule Calculation')).not.toBeInTheDocument();
    });

    it('should show read-only metrics for non-admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'analytics:view'
      });
      render(<MetricsCalculationEngine />, { wrapper });
      expect(screen.getByText('Metrics Calculation Engine')).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });
});