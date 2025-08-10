/**
 * Performance Tracking Tests
 * Following TDD - RED phase: Comprehensive test suite for performance metrics display and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformanceTracking } from '../PerformanceTracking';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock chart library
vi.mock('recharts', () => ({
  LineChart: vi.fn(({ children }) => <div data-testid="line-chart">{children}</div>),
  Line: vi.fn(() => null),
  BarChart: vi.fn(({ children }) => <div data-testid="bar-chart">{children}</div>),
  Bar: vi.fn(() => null),
  PieChart: vi.fn(({ children }) => <div data-testid="pie-chart">{children}</div>),
  Pie: vi.fn(() => null),
  AreaChart: vi.fn(({ children }) => <div data-testid="area-chart">{children}</div>),
  Area: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  Legend: vi.fn(() => null),
  ResponsiveContainer: vi.fn(({ children }) => <div>{children}</div>),
  Cell: vi.fn(() => null),
}));

// Mock API service
vi.mock('../../../services/analytics.service', () => ({
  analyticsService: {
    getKPIMetrics: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getContractMetrics: vi.fn(),
    getUserActivityMetrics: vi.fn(),
    getComplianceMetrics: vi.fn(),
    getRevenueMetrics: vi.fn(),
    getTrendData: vi.fn(),
    getBenchmarks: vi.fn(),
    exportMetrics: vi.fn(),
    getAlerts: vi.fn(),
    updateAlertThreshold: vi.fn(),
    getComparativeAnalysis: vi.fn(),
  },
}));

const mockKPIData = {
  summary: {
    totalContracts: 1542,
    activeContracts: 892,
    contractValue: 15420000,
    complianceRate: 98.5,
    avgProcessingTime: 2.3,
    userSatisfaction: 4.7,
  },
  trends: {
    daily: [
      { date: '2024-01-01', contracts: 45, value: 520000, time: 2.1 },
      { date: '2024-01-02', contracts: 52, value: 680000, time: 2.3 },
      { date: '2024-01-03', contracts: 48, value: 590000, time: 2.2 },
    ],
    weekly: [
      { week: 'W1', contracts: 320, value: 4200000, compliance: 99.1 },
      { week: 'W2', contracts: 335, value: 4450000, compliance: 98.8 },
      { week: 'W3', contracts: 342, value: 4520000, compliance: 98.5 },
    ],
    monthly: [
      { month: 'Jan', contracts: 1250, value: 13200000, satisfaction: 4.6 },
      { month: 'Feb', contracts: 1320, value: 14100000, satisfaction: 4.7 },
      { month: 'Mar', contracts: 1542, value: 15420000, satisfaction: 4.7 },
    ],
  },
  targets: {
    contractsTarget: 1500,
    valueTarget: 15000000,
    complianceTarget: 99.0,
    processingTarget: 2.0,
    satisfactionTarget: 4.5,
  },
};

const mockPerformanceData = {
  systemMetrics: {
    uptime: 99.95,
    responseTime: 145,
    throughput: 1250,
    errorRate: 0.12,
    cpu: 42,
    memory: 68,
    storage: 55,
  },
  apiMetrics: {
    totalRequests: 125000,
    avgLatency: 85,
    p95Latency: 210,
    p99Latency: 450,
    successRate: 99.88,
  },
  userMetrics: {
    activeUsers: 342,
    sessionsPerDay: 1250,
    avgSessionDuration: 28.5,
    bounceRate: 12.3,
    pageViews: 45200,
  },
};

describe('PerformanceTracking', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();
  const mockOnKPISelect = vi.fn();
  const mockOnAlertTriggered = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin', tenant_id: 'tenant-1' },
      hasPermission: () => true,
    } as any);
    
    const { analyticsService } = require('../../../services/analytics.service');
    analyticsService.getKPIMetrics.mockResolvedValue(mockKPIData);
    analyticsService.getPerformanceMetrics.mockResolvedValue(mockPerformanceData);
    analyticsService.getContractMetrics.mockResolvedValue({
      byStatus: [
        { status: 'Active', count: 892, percentage: 57.8 },
        { status: 'Draft', count: 234, percentage: 15.2 },
        { status: 'Expired', count: 416, percentage: 27.0 },
      ],
      byType: [
        { type: 'Service', count: 620, value: 7200000 },
        { type: 'NDA', count: 450, value: 0 },
        { type: 'Purchase', count: 472, value: 8220000 },
      ],
    });
    analyticsService.getAlerts.mockResolvedValue([
      { id: '1', metric: 'complianceRate', current: 98.5, threshold: 99, severity: 'warning' },
      { id: '2', metric: 'responseTime', current: 145, threshold: 100, severity: 'critical' },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PerformanceTracking
          onKPISelect={mockOnKPISelect}
          onAlertTriggered={mockOnAlertTriggered}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('KPI Dashboard', () => {
    it('should render KPI dashboard container', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-tracking')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /performance tracking/i })).toBeInTheDocument();
      });
    });

    it('should display summary KPI cards', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-summary')).toBeInTheDocument();
        expect(screen.getByText('1,542')).toBeInTheDocument(); // Total contracts
        expect(screen.getByText('$15.42M')).toBeInTheDocument(); // Contract value
        expect(screen.getByText('98.5%')).toBeInTheDocument(); // Compliance rate
        expect(screen.getByText('2.3 days')).toBeInTheDocument(); // Avg processing
        expect(screen.getByText('4.7/5.0')).toBeInTheDocument(); // Satisfaction
      });
    });

    it('should show KPI trends with charts', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-trends')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should handle KPI card clicks', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-contracts')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('kpi-card-contracts'));
      
      expect(mockOnKPISelect).toHaveBeenCalledWith({
        metric: 'totalContracts',
        value: 1542,
        trend: expect.any(Object),
      });
    });

    it('should show target achievement indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const contractsCard = screen.getByTestId('kpi-card-contracts');
        expect(within(contractsCard).getByText(/Target: 1,500/i)).toBeInTheDocument();
        expect(within(contractsCard).getByTestId('achievement-indicator')).toHaveClass('achieved');
      });
    });
  });

  describe('Time Range Selection', () => {
    it('should provide time range options', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /1 year/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
    });

    it('should update metrics on time range change', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /30 days/i }));
      
      await waitFor(() => {
        expect(analyticsService.getKPIMetrics).toHaveBeenCalledWith({
          timeRange: '30d',
          tenantId: 'tenant-1',
        });
      });
    });

    it('should show custom date range picker', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /custom/i }));
      
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply range/i })).toBeInTheDocument();
    });
  });

  describe('Metric Categories', () => {
    it('should display contract metrics', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('tab', { name: /contracts/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('contract-metrics')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument(); // Status distribution
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument(); // Type distribution
      });
    });

    it('should display user activity metrics', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('tab', { name: /user activity/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('user-metrics')).toBeInTheDocument();
        expect(screen.getByText('342')).toBeInTheDocument(); // Active users
        expect(screen.getByText('28.5 min')).toBeInTheDocument(); // Avg session
      });
    });

    it('should display system performance metrics', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('tab', { name: /system/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('system-metrics')).toBeInTheDocument();
        expect(screen.getByText('99.95%')).toBeInTheDocument(); // Uptime
        expect(screen.getByText('145ms')).toBeInTheDocument(); // Response time
      });
    });

    it('should display compliance metrics', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getComplianceMetrics.mockResolvedValue({
        overallCompliance: 98.5,
        byCategory: [
          { category: 'Data Privacy', rate: 99.2 },
          { category: 'Contract Terms', rate: 97.8 },
          { category: 'Regulatory', rate: 98.5 },
        ],
        violations: 12,
        resolved: 10,
      });

      renderComponent();
      
      await user.click(screen.getByRole('tab', { name: /compliance/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('compliance-metrics')).toBeInTheDocument();
        expect(screen.getByText('98.5%')).toBeInTheDocument();
        expect(screen.getByText('12 violations')).toBeInTheDocument();
      });
    });

    it('should display revenue metrics', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getRevenueMetrics.mockResolvedValue({
        totalRevenue: 15420000,
        recurring: 8200000,
        oneTime: 7220000,
        growth: 12.5,
        churn: 2.3,
      });

      renderComponent();
      
      await user.click(screen.getByRole('tab', { name: /revenue/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('revenue-metrics')).toBeInTheDocument();
        expect(screen.getByText('$15.42M')).toBeInTheDocument();
        expect(screen.getByText('+12.5%')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should auto-refresh metrics', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      vi.useFakeTimers();
      
      renderComponent({ autoRefresh: true, refreshInterval: 30000 });
      
      await waitFor(() => {
        expect(analyticsService.getKPIMetrics).toHaveBeenCalledTimes(1);
      });
      
      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(analyticsService.getKPIMetrics).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });

    it('should show last updated timestamp', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
        expect(screen.getByTestId('last-updated')).toHaveTextContent(/just now/i);
      });
    });

    it('should toggle auto-refresh', async () => {
      renderComponent();
      
      const toggleButton = screen.getByRole('switch', { name: /auto-refresh/i });
      expect(toggleButton).toBeChecked();
      
      await user.click(toggleButton);
      expect(toggleButton).not.toBeChecked();
    });
  });

  describe('Comparative Analysis', () => {
    it('should compare with previous period', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /compare/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('comparison-view')).toBeInTheDocument();
        expect(screen.getByText(/vs previous period/i)).toBeInTheDocument();
      });
    });

    it('should show year-over-year comparison', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getComparativeAnalysis.mockResolvedValue({
        current: mockKPIData.summary,
        previous: {
          totalContracts: 1320,
          contractValue: 13200000,
          complianceRate: 97.8,
        },
        change: {
          contracts: '+16.8%',
          value: '+16.8%',
          compliance: '+0.7%',
        },
      });

      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /yoy comparison/i }));
      
      await waitFor(() => {
        expect(screen.getByText('+16.8%')).toBeInTheDocument();
        expect(screen.getByTestId('comparison-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Alerts and Thresholds', () => {
    it('should display active alerts', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
        expect(screen.getByText(/compliance rate below threshold/i)).toBeInTheDocument();
        expect(screen.getByText(/response time exceeded/i)).toBeInTheDocument();
      });
    });

    it('should show alert severity indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const warningAlert = screen.getByTestId('alert-1');
        const criticalAlert = screen.getByTestId('alert-2');
        
        expect(warningAlert).toHaveClass('warning');
        expect(criticalAlert).toHaveClass('critical');
      });
    });

    it('should allow threshold configuration', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /configure alerts/i }));
      
      expect(screen.getByRole('dialog', { name: /alert configuration/i })).toBeInTheDocument();
      
      const complianceInput = screen.getByLabelText(/compliance threshold/i);
      await user.clear(complianceInput);
      await user.type(complianceInput, '95');
      
      await user.click(screen.getByRole('button', { name: /save thresholds/i }));
      
      const { analyticsService } = require('../../../services/analytics.service');
      expect(analyticsService.updateAlertThreshold).toHaveBeenCalledWith({
        metric: 'complianceRate',
        threshold: 95,
      });
    });

    it('should trigger alert callbacks', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockOnAlertTriggered).toHaveBeenCalledWith([
          expect.objectContaining({ severity: 'warning' }),
          expect.objectContaining({ severity: 'critical' }),
        ]);
      });
    });
  });

  describe('Data Export', () => {
    it('should export metrics as CSV', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.exportMetrics.mockResolvedValue({
        url: 'https://example.com/export.csv',
      });

      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /export/i }));
      await user.click(screen.getByRole('menuitem', { name: /csv/i }));
      
      await waitFor(() => {
        expect(analyticsService.exportMetrics).toHaveBeenCalledWith({
          format: 'csv',
          timeRange: expect.any(String),
          metrics: expect.any(Array),
        });
      });
    });

    it('should export metrics as PDF report', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.exportMetrics.mockResolvedValue({
        url: 'https://example.com/report.pdf',
      });

      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /export/i }));
      await user.click(screen.getByRole('menuitem', { name: /pdf report/i }));
      
      await waitFor(() => {
        expect(analyticsService.exportMetrics).toHaveBeenCalledWith({
          format: 'pdf',
          includeCharts: true,
          timeRange: expect.any(String),
        });
      });
    });

    it('should schedule automated reports', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /schedule report/i }));
      
      const dialog = screen.getByRole('dialog', { name: /schedule report/i });
      expect(dialog).toBeInTheDocument();
      
      await user.selectOptions(screen.getByLabelText(/frequency/i), 'weekly');
      await user.selectOptions(screen.getByLabelText(/day/i), 'monday');
      await user.type(screen.getByLabelText(/email/i), 'team@example.com');
      
      await user.click(screen.getByRole('button', { name: /save schedule/i }));
    });
  });

  describe('Benchmarking', () => {
    it('should show industry benchmarks', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getBenchmarks.mockResolvedValue({
        industry: {
          avgProcessingTime: 3.5,
          avgComplianceRate: 96.2,
          avgSatisfaction: 4.2,
        },
        percentile: {
          processingTime: 85,
          complianceRate: 92,
          satisfaction: 88,
        },
      });

      renderComponent({ showBenchmarks: true });
      
      await waitFor(() => {
        expect(screen.getByTestId('benchmarks-panel')).toBeInTheDocument();
        expect(screen.getByText(/industry avg: 3.5 days/i)).toBeInTheDocument();
        expect(screen.getByText(/85th percentile/i)).toBeInTheDocument();
      });
    });

    it('should compare against custom benchmarks', async () => {
      renderComponent({ showBenchmarks: true });
      
      await user.click(screen.getByRole('button', { name: /set benchmark/i }));
      
      const input = screen.getByLabelText(/processing time benchmark/i);
      await user.type(input, '2.0');
      
      await user.click(screen.getByRole('button', { name: /apply/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/Custom: 2.0 days/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drill-down Analysis', () => {
    it('should allow metric drill-down', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-contracts')).toBeInTheDocument();
      });
      
      await user.dblClick(screen.getByTestId('kpi-card-contracts'));
      
      expect(screen.getByTestId('drill-down-view')).toBeInTheDocument();
      expect(screen.getByText(/contract details/i)).toBeInTheDocument();
    });

    it('should show detailed breakdown', async () => {
      renderComponent();
      
      await user.dblClick(screen.getByTestId('kpi-card-compliance'));
      
      await waitFor(() => {
        expect(screen.getByText(/by department/i)).toBeInTheDocument();
        expect(screen.getByText(/by contract type/i)).toBeInTheDocument();
        expect(screen.getByText(/by region/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /performance tracking/i })).toBeInTheDocument();
      expect(screen.getByRole('tablist', { name: /metric categories/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstTab = screen.getByRole('tab', { name: /overview/i });
      firstTab.focus();
      
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /contracts/i })).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('contract-metrics')).toBeInTheDocument();
    });

    it('should announce metric updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/metrics updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when metrics fail to load', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getKPIMetrics.mockRejectedValue(new Error('API error'));

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry loading on error', async () => {
      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getKPIMetrics
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(mockKPIData);

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));
      
      await waitFor(() => {
        expect(screen.getByText('1,542')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = {
        summary: mockKPIData.summary,
        trends: {
          daily: Array.from({ length: 365 }, (_, i) => ({
            date: `2024-${String(i + 1).padStart(3, '0')}`,
            contracts: Math.floor(Math.random() * 100),
            value: Math.floor(Math.random() * 1000000),
          })),
        },
      };

      const { analyticsService } = require('../../../services/analytics.service');
      analyticsService.getKPIMetrics.mockResolvedValue(largeDataset);

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-trends')).toBeInTheDocument();
      });
    });

    it('should use virtualization for long lists', async () => {
      renderComponent();
      
      await user.click(screen.getByRole('button', { name: /detailed view/i }));
      
      const listContainer = screen.getByTestId('metrics-list');
      const visibleItems = within(listContainer).getAllByRole('row');
      
      expect(visibleItems.length).toBeLessThan(50); // Virtualized
    });
  });
});