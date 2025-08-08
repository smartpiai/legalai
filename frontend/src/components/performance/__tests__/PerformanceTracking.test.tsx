import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PerformanceTracking } from '../PerformanceTracking';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../../../services/api';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      permissions: ['view_performance', 'manage_kpis', 'export_reports'],
    },
  }),
}));

describe('PerformanceTracking', () => {
  let queryClient: QueryClient;
  const mockOnKpiUpdate = vi.fn();
  const mockOnAlertTriggered = vi.fn();
  const mockOnReportGenerated = vi.fn();

  const mockKpis = [
    {
      id: 'kpi1',
      name: 'Contract Cycle Time',
      description: 'Average time from initiation to execution',
      category: 'efficiency',
      unit: 'days',
      target: 30,
      current: 25,
      trend: 'improving',
      frequency: 'daily',
      formula: 'AVG(execution_date - initiation_date)',
      status: 'on_track',
      lastUpdated: '2024-02-15T10:00:00Z',
    },
    {
      id: 'kpi2',
      name: 'SLA Compliance Rate',
      description: 'Percentage of contracts meeting SLA requirements',
      category: 'compliance',
      unit: 'percentage',
      target: 95,
      current: 92,
      trend: 'declining',
      frequency: 'weekly',
      formula: '(met_sla / total_contracts) * 100',
      status: 'at_risk',
      lastUpdated: '2024-02-15T10:00:00Z',
    },
  ];

  const mockPerformanceData = [
    {
      id: 'perf1',
      contractId: 'contract1',
      contractName: 'Service Agreement A',
      vendorName: 'TechCorp',
      period: '2024-01',
      metrics: {
        responseTime: 2.5,
        availability: 99.5,
        qualityScore: 88,
        deliveryOnTime: 95,
        costVariance: -2.5,
      },
      slaStatus: {
        responseTime: 'met',
        availability: 'met',
        quality: 'missed',
        delivery: 'met',
      },
      penalties: {
        amount: 5000,
        reason: 'Quality score below threshold',
        applied: true,
      },
      overallScore: 85,
      rating: 'good',
      createdAt: '2024-02-01T00:00:00Z',
    },
    {
      id: 'perf2',
      contractId: 'contract2',
      contractName: 'Maintenance Contract B',
      vendorName: 'ServicePro',
      period: '2024-01',
      metrics: {
        responseTime: 4.0,
        availability: 97.0,
        qualityScore: 75,
        deliveryOnTime: 82,
        costVariance: 5.5,
      },
      slaStatus: {
        responseTime: 'missed',
        availability: 'at_risk',
        quality: 'missed',
        delivery: 'missed',
      },
      penalties: {
        amount: 15000,
        reason: 'Multiple SLA breaches',
        applied: true,
      },
      overallScore: 68,
      rating: 'poor',
      createdAt: '2024-02-01T00:00:00Z',
    },
  ];

  const mockScorecards = [
    {
      id: 'scorecard1',
      name: 'Q1 2024 Performance',
      period: '2024-Q1',
      categories: [
        { name: 'Efficiency', score: 85, weight: 30 },
        { name: 'Quality', score: 78, weight: 25 },
        { name: 'Compliance', score: 92, weight: 25 },
        { name: 'Cost', score: 88, weight: 20 },
      ],
      overallScore: 85.5,
      status: 'published',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockBenchmarks = [
    {
      id: 'benchmark1',
      metric: 'Contract Cycle Time',
      industry: 'Technology',
      average: 35,
      top10: 20,
      top25: 25,
      current: 25,
      percentile: 75,
    },
    {
      id: 'benchmark2',
      metric: 'SLA Compliance Rate',
      industry: 'Technology',
      average: 90,
      top10: 98,
      top25: 95,
      current: 92,
      percentile: 60,
    },
  ];

  const mockAlerts = [
    {
      id: 'alert1',
      type: 'sla_breach',
      severity: 'high',
      title: 'SLA Breach Detected',
      description: 'Response time exceeded threshold for Contract B',
      contractId: 'contract2',
      triggered: '2024-02-15T09:00:00Z',
      acknowledged: false,
      actions: ['Review contract', 'Contact vendor', 'Apply penalty'],
    },
    {
      id: 'alert2',
      type: 'performance_decline',
      severity: 'medium',
      title: 'Performance Declining',
      description: 'Quality score trending down for past 3 periods',
      contractId: 'contract1',
      triggered: '2024-02-14T14:00:00Z',
      acknowledged: true,
      acknowledgedBy: 'Jane Smith',
      acknowledgedAt: '2024-02-14T15:00:00Z',
    },
  ];

  const mockVendorRatings = [
    {
      id: 'rating1',
      vendorId: 'vendor1',
      vendorName: 'TechCorp',
      overallRating: 4.2,
      totalContracts: 5,
      ratings: {
        quality: 4.5,
        delivery: 4.0,
        communication: 4.3,
        value: 4.0,
        innovation: 4.2,
      },
      trend: 'stable',
      lastReview: '2024-02-10T00:00:00Z',
    },
    {
      id: 'rating2',
      vendorId: 'vendor2',
      vendorName: 'ServicePro',
      overallRating: 3.1,
      totalContracts: 3,
      ratings: {
        quality: 3.0,
        delivery: 2.8,
        communication: 3.5,
        value: 3.2,
        innovation: 3.0,
      },
      trend: 'declining',
      lastReview: '2024-02-10T00:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    const mockApi = vi.mocked(api);
    mockApi.get.mockImplementation((url) => {
      if (url.includes('/kpis')) {
        return Promise.resolve({ data: mockKpis });
      }
      if (url.includes('/performance-data')) {
        return Promise.resolve({ data: mockPerformanceData });
      }
      if (url.includes('/scorecards')) {
        return Promise.resolve({ data: mockScorecards });
      }
      if (url.includes('/benchmarks')) {
        return Promise.resolve({ data: mockBenchmarks });
      }
      if (url.includes('/performance-alerts')) {
        return Promise.resolve({ data: mockAlerts });
      }
      if (url.includes('/vendor-ratings')) {
        return Promise.resolve({ data: mockVendorRatings });
      }
      return Promise.resolve({ data: [] });
    });

    mockApi.post.mockResolvedValue({ 
      data: { id: 'new-kpi', ...mockKpis[0] } 
    });

    mockApi.put.mockResolvedValue({ 
      data: { ...mockKpis[0], current: 28 } 
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PerformanceTracking
          onKpiUpdate={mockOnKpiUpdate}
          onAlertTriggered={mockOnAlertTriggered}
          onReportGenerated={mockOnReportGenerated}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the performance tracking interface', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-tracking')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /performance tracking/i })).toBeInTheDocument();
      });
    });

    it('should display KPI dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Contract Cycle Time')).toBeInTheDocument();
        expect(screen.getByText('SLA Compliance Rate')).toBeInTheDocument();
      });
    });

    it('should show performance metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
        expect(screen.getByText('Service Agreement A')).toBeInTheDocument();
        expect(screen.getByText('Maintenance Contract B')).toBeInTheDocument();
      });
    });

    it('should display view mode tabs', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /scorecards/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /trends/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /benchmarks/i })).toBeInTheDocument();
      });
    });
  });

  describe('KPI Definition System', () => {
    it('should display KPI details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kpi1 = screen.getByTestId('kpi-kpi1');
        expect(within(kpi1).getByText('25 days')).toBeInTheDocument();
        expect(within(kpi1).getByText('Target: 30 days')).toBeInTheDocument();
        expect(within(kpi1).getByTestId('trend-indicator')).toBeInTheDocument();
      });
    });

    it('should allow creating new KPIs', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create kpi/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('kpi-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/kpi name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/target value/i)).toBeInTheDocument();
      });
    });

    it('should validate KPI formula', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create kpi/i });
        fireEvent.click(createButton);
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/formula/i), 'INVALID(formula)');
      
      await waitFor(() => {
        expect(screen.getByText(/invalid formula syntax/i)).toBeInTheDocument();
      });
    });

    it('should edit existing KPIs', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kpi1 = screen.getByTestId('kpi-kpi1');
        const editButton = within(kpi1).getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('kpi-edit-form')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Contract Cycle Time')).toBeInTheDocument();
      });
    });

    it('should categorize KPIs', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-category-efficiency')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-category-compliance')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Data Collection', () => {
    it('should display performance data table', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-data-table')).toBeInTheDocument();
        expect(screen.getByText('TechCorp')).toBeInTheDocument();
        expect(screen.getByText('ServicePro')).toBeInTheDocument();
      });
    });

    it('should allow manual data entry', async () => {
      renderComponent();
      
      await waitFor(() => {
        const addDataButton = screen.getByRole('button', { name: /add performance data/i });
        fireEvent.click(addDataButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-entry-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/response time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/availability/i)).toBeInTheDocument();
      });
    });

    it('should import data from CSV', async () => {
      renderComponent();
      
      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: /import data/i });
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('import-dialog')).toBeInTheDocument();
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });
    });

    it('should validate data ranges', async () => {
      renderComponent();
      
      await waitFor(() => {
        const addDataButton = screen.getByRole('button', { name: /add performance data/i });
        fireEvent.click(addDataButton);
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/availability/i), '150');
      
      await waitFor(() => {
        expect(screen.getByText(/must be between 0 and 100/i)).toBeInTheDocument();
      });
    });

    it('should show data collection frequency', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kpi1 = screen.getByTestId('kpi-kpi1');
        expect(within(kpi1).getByText('Daily')).toBeInTheDocument();
      });
    });
  });

  describe('SLA Monitoring', () => {
    it('should display SLA status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf1 = screen.getByTestId('performance-perf1');
        expect(within(perf1).getByTestId('sla-status')).toBeInTheDocument();
        expect(within(perf1).getByText('3/4 SLAs Met')).toBeInTheDocument();
      });
    });

    it('should highlight SLA breaches', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf2 = screen.getByTestId('performance-perf2');
        const breachBadge = within(perf2).getByTestId('sla-breach-badge');
        expect(breachBadge).toHaveClass('bg-red-100');
        expect(breachBadge).toHaveTextContent('3 Breaches');
      });
    });

    it('should show SLA details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf1 = screen.getByTestId('performance-perf1');
        fireEvent.click(within(perf1).getByRole('button', { name: /view sla details/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('sla-details')).toBeInTheDocument();
        expect(screen.getByText('Response Time: Met')).toBeInTheDocument();
        expect(screen.getByText('Quality: Missed')).toBeInTheDocument();
      });
    });

    it('should configure SLA thresholds', async () => {
      renderComponent();
      
      await waitFor(() => {
        const configButton = screen.getByRole('button', { name: /configure sla/i });
        fireEvent.click(configButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sla-configuration')).toBeInTheDocument();
        expect(screen.getByLabelText(/response time threshold/i)).toBeInTheDocument();
      });
    });

    it('should track SLA trends', async () => {
      renderComponent({ view: 'trends' });
      
      await waitFor(() => {
        expect(screen.getByTestId('sla-trend-chart')).toBeInTheDocument();
        expect(screen.getByText('SLA Compliance Trend')).toBeInTheDocument();
      });
    });
  });

  describe('Penalty Calculations', () => {
    it('should display penalty amounts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf1 = screen.getByTestId('performance-perf1');
        expect(within(perf1).getByText('$5,000')).toBeInTheDocument();
        expect(within(perf1).getByText('Quality score below threshold')).toBeInTheDocument();
      });
    });

    it('should calculate penalties automatically', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf2 = screen.getByTestId('performance-perf2');
        expect(within(perf2).getByTestId('penalty-amount')).toHaveTextContent('$15,000');
      });
    });

    it('should show penalty calculation details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf1 = screen.getByTestId('performance-perf1');
        fireEvent.click(within(perf1).getByRole('button', { name: /penalty details/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('penalty-calculation')).toBeInTheDocument();
        expect(screen.getByText(/base penalty/i)).toBeInTheDocument();
      });
    });

    it('should allow penalty waiver', async () => {
      renderComponent();
      
      await waitFor(() => {
        const perf1 = screen.getByTestId('performance-perf1');
        const waiverButton = within(perf1).getByRole('button', { name: /waive penalty/i });
        fireEvent.click(waiverButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('waiver-dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/waiver reason/i)).toBeInTheDocument();
      });
    });

    it('should track penalty history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const historyButton = screen.getByRole('button', { name: /penalty history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('penalty-history')).toBeInTheDocument();
        expect(screen.getByText('Total Penalties: $20,000')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Scorecards', () => {
    it('should display scorecards', async () => {
      renderComponent({ view: 'scorecards' });
      
      await waitFor(() => {
        expect(screen.getByTestId('scorecards-view')).toBeInTheDocument();
        expect(screen.getByText('Q1 2024 Performance')).toBeInTheDocument();
      });
    });

    it('should show scorecard categories', async () => {
      renderComponent({ view: 'scorecards' });
      
      await waitFor(() => {
        const scorecard = screen.getByTestId('scorecard-scorecard1');
        expect(within(scorecard).getByText('Efficiency: 85')).toBeInTheDocument();
        expect(within(scorecard).getByText('Quality: 78')).toBeInTheDocument();
      });
    });

    it('should calculate weighted scores', async () => {
      renderComponent({ view: 'scorecards' });
      
      await waitFor(() => {
        const scorecard = screen.getByTestId('scorecard-scorecard1');
        expect(within(scorecard).getByTestId('overall-score')).toHaveTextContent('85.5');
      });
    });

    it('should create custom scorecards', async () => {
      renderComponent({ view: 'scorecards' });
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create scorecard/i });
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('scorecard-builder')).toBeInTheDocument();
        expect(screen.getByLabelText(/scorecard name/i)).toBeInTheDocument();
      });
    });

    it('should export scorecards', async () => {
      renderComponent({ view: 'scorecards' });
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export scorecard/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-options')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
      });
    });
  });

  describe('Trend Analysis', () => {
    it('should display trend charts', async () => {
      renderComponent({ view: 'trends' });
      
      await waitFor(() => {
        expect(screen.getByTestId('trend-charts')).toBeInTheDocument();
        expect(screen.getByTestId('performance-trend-chart')).toBeInTheDocument();
      });
    });

    it('should show trend indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kpi1 = screen.getByTestId('kpi-kpi1');
        const trendIcon = within(kpi1).getByTestId('trend-icon');
        expect(trendIcon).toHaveClass('text-green-600');
      });
    });

    it('should allow period selection', async () => {
      renderComponent({ view: 'trends' });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/period/i)).toBeInTheDocument();
        const periodSelect = screen.getByLabelText(/period/i);
        expect(periodSelect).toHaveValue('last_30_days');
      });
    });

    it('should compare periods', async () => {
      renderComponent({ view: 'trends' });
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare periods/i });
        fireEvent.click(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('period-comparison')).toBeInTheDocument();
        expect(screen.getByLabelText(/compare from/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/compare to/i)).toBeInTheDocument();
      });
    });

    it('should forecast trends', async () => {
      renderComponent({ view: 'trends' });
      
      await waitFor(() => {
        const forecastButton = screen.getByRole('button', { name: /show forecast/i });
        fireEvent.click(forecastButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('trend-forecast')).toBeInTheDocument();
        expect(screen.getByText(/projected performance/i)).toBeInTheDocument();
      });
    });
  });

  describe('Benchmark Comparisons', () => {
    it('should display benchmarks', async () => {
      renderComponent({ view: 'benchmarks' });
      
      await waitFor(() => {
        expect(screen.getByTestId('benchmarks-view')).toBeInTheDocument();
        expect(screen.getByText('Industry Benchmarks')).toBeInTheDocument();
      });
    });

    it('should show percentile rankings', async () => {
      renderComponent({ view: 'benchmarks' });
      
      await waitFor(() => {
        const benchmark1 = screen.getByTestId('benchmark-benchmark1');
        expect(within(benchmark1).getByText('75th Percentile')).toBeInTheDocument();
      });
    });

    it('should compare with industry average', async () => {
      renderComponent({ view: 'benchmarks' });
      
      await waitFor(() => {
        const benchmark1 = screen.getByTestId('benchmark-benchmark1');
        expect(within(benchmark1).getByText('Industry Avg: 35')).toBeInTheDocument();
        expect(within(benchmark1).getByText('Current: 25')).toBeInTheDocument();
      });
    });

    it('should filter by industry', async () => {
      renderComponent({ view: 'benchmarks' });
      
      await waitFor(() => {
        const industrySelect = screen.getByLabelText(/industry/i);
        fireEvent.change(industrySelect, { target: { value: 'technology' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Technology')).toBeInTheDocument();
      });
    });

    it('should show top performers', async () => {
      renderComponent({ view: 'benchmarks' });
      
      await waitFor(() => {
        const benchmark1 = screen.getByTestId('benchmark-benchmark1');
        expect(within(benchmark1).getByText('Top 10%: 20')).toBeInTheDocument();
        expect(within(benchmark1).getByText('Top 25%: 25')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Alerts', () => {
    it('should display active alerts', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('performance-alerts')).toBeInTheDocument();
        expect(screen.getByText('SLA Breach Detected')).toBeInTheDocument();
      });
    });

    it('should categorize alerts by severity', async () => {
      renderComponent();
      
      await waitFor(() => {
        const alert1 = screen.getByTestId('alert-alert1');
        const severityBadge = within(alert1).getByTestId('severity-badge');
        expect(severityBadge).toHaveClass('bg-red-100');
        expect(severityBadge).toHaveTextContent('High');
      });
    });

    it('should acknowledge alerts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const alert1 = screen.getByTestId('alert-alert1');
        const ackButton = within(alert1).getByRole('button', { name: /acknowledge/i });
        fireEvent.click(ackButton);
      });

      expect(mockOnAlertTriggered).toHaveBeenCalled();
    });

    it('should configure alert rules', async () => {
      renderComponent();
      
      await waitFor(() => {
        const configButton = screen.getByRole('button', { name: /configure alerts/i });
        fireEvent.click(configButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-configuration')).toBeInTheDocument();
        expect(screen.getByLabelText(/alert threshold/i)).toBeInTheDocument();
      });
    });

    it('should show alert history', async () => {
      renderComponent();
      
      await waitFor(() => {
        const historyButton = screen.getByRole('button', { name: /alert history/i });
        fireEvent.click(historyButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-history')).toBeInTheDocument();
        expect(screen.getByText('Performance Declining')).toBeInTheDocument();
      });
    });
  });

  describe('Vendor Ratings', () => {
    it('should display vendor ratings', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('vendor-ratings')).toBeInTheDocument();
        expect(screen.getByText('TechCorp')).toBeInTheDocument();
        expect(screen.getByText('4.2')).toBeInTheDocument();
      });
    });

    it('should show rating breakdown', async () => {
      renderComponent();
      
      await waitFor(() => {
        const rating1 = screen.getByTestId('vendor-rating-rating1');
        fireEvent.click(within(rating1).getByRole('button', { name: /view details/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('rating-breakdown')).toBeInTheDocument();
        expect(screen.getByText('Quality: 4.5')).toBeInTheDocument();
        expect(screen.getByText('Delivery: 4.0')).toBeInTheDocument();
      });
    });

    it('should track rating trends', async () => {
      renderComponent();
      
      await waitFor(() => {
        const rating2 = screen.getByTestId('vendor-rating-rating2');
        const trendBadge = within(rating2).getByTestId('rating-trend');
        expect(trendBadge).toHaveClass('text-red-600');
        expect(trendBadge).toHaveTextContent('Declining');
      });
    });

    it('should allow rating vendors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const rateButton = screen.getByRole('button', { name: /rate vendor/i });
        fireEvent.click(rateButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('rating-form')).toBeInTheDocument();
        expect(screen.getByLabelText(/quality rating/i)).toBeInTheDocument();
      });
    });

    it('should compare vendor performance', async () => {
      renderComponent();
      
      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare vendors/i });
        fireEvent.click(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('vendor-comparison')).toBeInTheDocument();
        expect(screen.getByText('TechCorp vs ServicePro')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Reporting', () => {
    it('should generate performance reports', async () => {
      renderComponent();
      
      await waitFor(() => {
        const reportButton = screen.getByRole('button', { name: /generate report/i });
        fireEvent.click(reportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('report-generator')).toBeInTheDocument();
        expect(screen.getByLabelText(/report type/i)).toBeInTheDocument();
      });
    });

    it('should schedule automated reports', async () => {
      renderComponent();
      
      await waitFor(() => {
        const scheduleButton = screen.getByRole('button', { name: /schedule reports/i });
        fireEvent.click(scheduleButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('report-scheduler')).toBeInTheDocument();
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/recipients/i)).toBeInTheDocument();
      });
    });

    it('should export reports in multiple formats', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export report/i });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-formats')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
        expect(screen.getByText('PowerPoint')).toBeInTheDocument();
      });
    });

    it('should customize report templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const templateButton = screen.getByRole('button', { name: /report templates/i });
        fireEvent.click(templateButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('template-manager')).toBeInTheDocument();
        expect(screen.getByText('Executive Summary')).toBeInTheDocument();
      });
    });

    it('should preview reports', async () => {
      renderComponent();
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview report/i });
        fireEvent.click(previewButton);
      });

      expect(mockOnReportGenerated).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle data loading errors', async () => {
      const mockApi = vi.mocked(api);
      mockApi.get.mockRejectedValueOnce(new Error('Failed to load performance data'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load performance data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should validate KPI targets', async () => {
      renderComponent();
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create kpi/i });
        fireEvent.click(createButton);
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/target value/i), '-10');
      
      await waitFor(() => {
        expect(screen.getByText(/must be a positive number/i)).toBeInTheDocument();
      });
    });

    it('should show loading states', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading performance data/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Performance Tracking');
        expect(screen.getByRole('region', { name: /kpi dashboard/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        const firstKpi = screen.getByTestId('kpi-kpi1');
        firstKpi.focus();
        user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.getByTestId('kpi-details-kpi1')).toBeInTheDocument();
      });
    });

    it('should announce updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const kpi1 = screen.getByTestId('kpi-kpi1');
        const updateButton = within(kpi1).getByRole('button', { name: /update/i });
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/kpi updated/i);
      });
    });
  });

  describe('Integration Features', () => {
    it('should filter by contract', async () => {
      renderComponent();
      
      await waitFor(() => {
        const contractFilter = screen.getByLabelText(/filter by contract/i);
        fireEvent.change(contractFilter, { target: { value: 'contract1' } });
      });

      await waitFor(() => {
        const performanceData = screen.getAllByTestId(/^performance-/);
        expect(performanceData).toHaveLength(1);
        expect(screen.getByText('Service Agreement A')).toBeInTheDocument();
      });
    });

    it('should filter by period', async () => {
      renderComponent();
      
      await waitFor(() => {
        const periodFilter = screen.getByLabelText(/filter by period/i);
        fireEvent.change(periodFilter, { target: { value: '2024-01' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('filtered-data')).toBeInTheDocument();
      });
    });

    it('should sync with contract management', async () => {
      renderComponent();
      
      await waitFor(() => {
        const syncButton = screen.getByRole('button', { name: /sync contracts/i });
        fireEvent.click(syncButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/syncing/i)).toBeInTheDocument();
      });
    });
  });
});