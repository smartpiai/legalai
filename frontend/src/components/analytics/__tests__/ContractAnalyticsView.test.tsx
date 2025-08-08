import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ContractAnalyticsView } from '../ContractAnalyticsView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ChartData {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  metadata?: Record<string, any>;
}

interface TimeSeriesData {
  date: string;
  value: number;
  category?: string;
}

interface ContractMetrics {
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  pendingContracts: number;
  averageValue: number;
  totalValue: number;
  averageCycleTime: number;
  renewalRate: number;
  complianceRate: number;
}

interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  contractCount: number;
  totalValue: number;
  averageRating: number;
  onTimeDelivery: number;
  issues: number;
}

interface ContractAnalyticsViewProps {
  dateRange?: { start: Date; end: Date };
  departmentFilter?: string;
  contractTypeFilter?: string;
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
    department?: string;
  };
  onFetchMetrics?: (filters?: any) => Promise<ContractMetrics>;
  onFetchVolumeData?: (filters?: any) => Promise<TimeSeriesData[]>;
  onFetchStatusDistribution?: (filters?: any) => Promise<ChartData[]>;
  onFetchValueByCategory?: (filters?: any) => Promise<ChartData[]>;
  onFetchRiskDistribution?: (filters?: any) => Promise<ChartData[]>;
  onFetchCycleTimeAnalysis?: (filters?: any) => Promise<TimeSeriesData[]>;
  onFetchRenewalForecast?: (filters?: any) => Promise<TimeSeriesData[]>;
  onFetchVendorPerformance?: (filters?: any) => Promise<VendorPerformance[]>;
  onFetchDepartmentBreakdown?: (filters?: any) => Promise<ChartData[]>;
  onFetchObligationTracking?: (filters?: any) => Promise<any[]>;
  onExportAnalytics?: (format: 'pdf' | 'excel' | 'csv', data: any) => Promise<void>;
  onDrillDown?: (metric: string, data: any) => void;
  onSaveView?: (viewConfig: any) => Promise<void>;
  onScheduleReport?: (schedule: any) => Promise<void>;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ContractAnalyticsView', () => {
  let queryClient: QueryClient;
  const mockOnFetchMetrics = vi.fn();
  const mockOnFetchVolumeData = vi.fn();
  const mockOnFetchStatusDistribution = vi.fn();
  const mockOnFetchValueByCategory = vi.fn();
  const mockOnFetchRiskDistribution = vi.fn();
  const mockOnFetchCycleTimeAnalysis = vi.fn();
  const mockOnFetchRenewalForecast = vi.fn();
  const mockOnFetchVendorPerformance = vi.fn();
  const mockOnFetchDepartmentBreakdown = vi.fn();
  const mockOnFetchObligationTracking = vi.fn();
  const mockOnExportAnalytics = vi.fn();
  const mockOnDrillDown = vi.fn();
  const mockOnSaveView = vi.fn();
  const mockOnScheduleReport = vi.fn();

  const sampleMetrics: ContractMetrics = {
    totalContracts: 2456,
    activeContracts: 1823,
    expiredContracts: 456,
    pendingContracts: 177,
    averageValue: 125000,
    totalValue: 307000000,
    averageCycleTime: 14.5,
    renewalRate: 78,
    complianceRate: 92,
  };

  const sampleVolumeData: TimeSeriesData[] = [
    { date: '2024-01-01', value: 145 },
    { date: '2024-02-01', value: 168 },
    { date: '2024-03-01', value: 192 },
    { date: '2024-04-01', value: 178 },
    { date: '2024-05-01', value: 205 },
    { date: '2024-06-01', value: 198 },
  ];

  const sampleStatusDistribution: ChartData[] = [
    { label: 'Active', value: 1823, percentage: 74.2, color: '#10B981' },
    { label: 'Expired', value: 456, percentage: 18.6, color: '#EF4444' },
    { label: 'Pending', value: 177, percentage: 7.2, color: '#F59E0B' },
  ];

  const sampleValueByCategory: ChartData[] = [
    { label: 'Software Licenses', value: 89000000, percentage: 29 },
    { label: 'Professional Services', value: 67000000, percentage: 22 },
    { label: 'Maintenance', value: 52000000, percentage: 17 },
    { label: 'Consulting', value: 43000000, percentage: 14 },
    { label: 'Hardware', value: 31000000, percentage: 10 },
    { label: 'Other', value: 25000000, percentage: 8 },
  ];

  const sampleRiskDistribution: ChartData[] = [
    { label: 'Low Risk', value: 1456, percentage: 59.3, color: '#10B981' },
    { label: 'Medium Risk', value: 723, percentage: 29.5, color: '#F59E0B' },
    { label: 'High Risk', value: 277, percentage: 11.2, color: '#EF4444' },
  ];

  const sampleVendorPerformance: VendorPerformance[] = [
    {
      vendorId: 'vendor1',
      vendorName: 'Microsoft',
      contractCount: 45,
      totalValue: 12500000,
      averageRating: 4.5,
      onTimeDelivery: 95,
      issues: 2,
    },
    {
      vendorId: 'vendor2',
      vendorName: 'Amazon Web Services',
      contractCount: 32,
      totalValue: 8900000,
      averageRating: 4.3,
      onTimeDelivery: 92,
      issues: 3,
    },
    {
      vendorId: 'vendor3',
      vendorName: 'Salesforce',
      contractCount: 28,
      totalValue: 6700000,
      averageRating: 4.1,
      onTimeDelivery: 88,
      issues: 5,
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'analyst',
    permissions: ['view_analytics', 'export_data', 'create_reports'],
    department: 'Legal',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockOnFetchMetrics.mockResolvedValue(sampleMetrics);
    mockOnFetchVolumeData.mockResolvedValue(sampleVolumeData);
    mockOnFetchStatusDistribution.mockResolvedValue(sampleStatusDistribution);
    mockOnFetchValueByCategory.mockResolvedValue(sampleValueByCategory);
    mockOnFetchRiskDistribution.mockResolvedValue(sampleRiskDistribution);
    mockOnFetchVendorPerformance.mockResolvedValue(sampleVendorPerformance);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      currentUser,
      onFetchMetrics: mockOnFetchMetrics,
      onFetchVolumeData: mockOnFetchVolumeData,
      onFetchStatusDistribution: mockOnFetchStatusDistribution,
      onFetchValueByCategory: mockOnFetchValueByCategory,
      onFetchRiskDistribution: mockOnFetchRiskDistribution,
      onFetchCycleTimeAnalysis: mockOnFetchCycleTimeAnalysis,
      onFetchRenewalForecast: mockOnFetchRenewalForecast,
      onFetchVendorPerformance: mockOnFetchVendorPerformance,
      onFetchDepartmentBreakdown: mockOnFetchDepartmentBreakdown,
      onFetchObligationTracking: mockOnFetchObligationTracking,
      onExportAnalytics: mockOnExportAnalytics,
      onDrillDown: mockOnDrillDown,
      onSaveView: mockOnSaveView,
      onScheduleReport: mockOnScheduleReport,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ContractAnalyticsView {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render contract analytics view', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Analytics')).toBeInTheDocument();
        expect(screen.getByTestId('contract-analytics-view')).toBeInTheDocument();
      });
    });

    it('should display metrics summary cards', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('metric-total-contracts')).toBeInTheDocument();
        expect(screen.getByTestId('metric-active-contracts')).toBeInTheDocument();
        expect(screen.getByTestId('metric-average-value')).toBeInTheDocument();
        expect(screen.getByTestId('metric-renewal-rate')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading analytics data...')).toBeInTheDocument();
    });

    it('should display filter controls', () => {
      renderComponent();
      
      expect(screen.getByLabelText('Date range')).toBeInTheDocument();
      expect(screen.getByLabelText('Department')).toBeInTheDocument();
      expect(screen.getByLabelText('Contract type')).toBeInTheDocument();
    });
  });

  describe('Contract Volume Chart', () => {
    it('should display contract volume over time', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-contract-volume')).toBeInTheDocument();
        expect(screen.getByText('Contract Volume')).toBeInTheDocument();
      });
    });

    it('should toggle between chart types', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chartTypeButton = screen.getByRole('button', { name: /chart type/i });
        fireEvent.click(chartTypeButton);
      });
      
      const lineOption = screen.getByText('Line Chart');
      fireEvent.click(lineOption);
      
      expect(screen.getByTestId('chart-type-line')).toBeInTheDocument();
    });

    it('should show data points on hover', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chart = screen.getByTestId('chart-contract-volume');
        fireEvent.mouseEnter(chart);
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should handle drill-down on click', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chart = screen.getByTestId('chart-contract-volume');
        fireEvent.click(chart);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('contract-volume', expect.any(Object));
    });
  });

  describe('Status Distribution', () => {
    it('should display status distribution pie chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-status-distribution')).toBeInTheDocument();
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      });
    });

    it('should show percentage values', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('74.2%')).toBeInTheDocument(); // Active
        expect(screen.getByText('18.6%')).toBeInTheDocument(); // Expired
        expect(screen.getByText('7.2%')).toBeInTheDocument(); // Pending
      });
    });

    it('should display legend with colors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const legend = screen.getByTestId('status-legend');
        expect(legend).toBeInTheDocument();
        expect(within(legend).getByText('Active')).toBeInTheDocument();
        expect(within(legend).getByText('Expired')).toBeInTheDocument();
        expect(within(legend).getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should filter data on legend click', async () => {
      renderComponent();
      
      await waitFor(() => {
        const legendItem = screen.getByTestId('legend-active');
        fireEvent.click(legendItem);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('status', { status: 'Active' });
    });
  });

  describe('Value by Category', () => {
    it('should display value distribution by category', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-value-category')).toBeInTheDocument();
        expect(screen.getByText('Value by Category')).toBeInTheDocument();
      });
    });

    it('should format currency values', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('$89M')).toBeInTheDocument(); // Software Licenses
        expect(screen.getByText('$67M')).toBeInTheDocument(); // Professional Services
      });
    });

    it('should show category percentages', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('29%')).toBeInTheDocument(); // Software Licenses
        expect(screen.getByText('22%')).toBeInTheDocument(); // Professional Services
      });
    });

    it('should sort categories by value', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sortButton = screen.getByRole('button', { name: /sort/i });
        fireEvent.click(sortButton);
      });
      
      const categories = screen.getAllByTestId(/category-item/);
      expect(categories[0]).toHaveTextContent('Software Licenses');
    });
  });

  describe('Risk Distribution', () => {
    it('should display risk distribution chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-risk-distribution')).toBeInTheDocument();
        expect(screen.getByText('Risk Distribution')).toBeInTheDocument();
      });
    });

    it('should use appropriate colors for risk levels', async () => {
      renderComponent();
      
      await waitFor(() => {
        const lowRisk = screen.getByTestId('risk-low');
        const mediumRisk = screen.getByTestId('risk-medium');
        const highRisk = screen.getByTestId('risk-high');
        
        expect(lowRisk).toHaveStyle({ backgroundColor: '#10B981' });
        expect(mediumRisk).toHaveStyle({ backgroundColor: '#F59E0B' });
        expect(highRisk).toHaveStyle({ backgroundColor: '#EF4444' });
      });
    });

    it('should show risk counts and percentages', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('1,456 contracts')).toBeInTheDocument(); // Low Risk
        expect(screen.getByText('59.3%')).toBeInTheDocument();
      });
    });
  });

  describe('Cycle Time Analysis', () => {
    it('should display cycle time trends', async () => {
      mockOnFetchCycleTimeAnalysis.mockResolvedValue([
        { date: '2024-01-01', value: 18 },
        { date: '2024-02-01', value: 16 },
        { date: '2024-03-01', value: 14 },
        { date: '2024-04-01', value: 15 },
        { date: '2024-05-01', value: 13 },
        { date: '2024-06-01', value: 14 },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-cycle-time')).toBeInTheDocument();
        expect(screen.getByText('Cycle Time Analysis')).toBeInTheDocument();
      });
    });

    it('should show average cycle time', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('14.5 days')).toBeInTheDocument();
        expect(screen.getByText('Average Cycle Time')).toBeInTheDocument();
      });
    });

    it('should highlight improvement trends', async () => {
      renderComponent();
      
      await waitFor(() => {
        const trendIndicator = screen.getByTestId('cycle-time-trend');
        expect(trendIndicator).toHaveClass('text-green-600'); // Improving trend
      });
    });
  });

  describe('Renewal Forecast', () => {
    it('should display renewal forecast chart', async () => {
      mockOnFetchRenewalForecast.mockResolvedValue([
        { date: '2024-07-01', value: 45 },
        { date: '2024-08-01', value: 62 },
        { date: '2024-09-01', value: 38 },
        { date: '2024-10-01', value: 71 },
        { date: '2024-11-01', value: 55 },
        { date: '2024-12-01', value: 49 },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-renewal-forecast')).toBeInTheDocument();
        expect(screen.getByText('Renewal Forecast')).toBeInTheDocument();
      });
    });

    it('should show upcoming renewals count', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('320 contracts')).toBeInTheDocument();
        expect(screen.getByText('Due for renewal in next 6 months')).toBeInTheDocument();
      });
    });

    it('should display renewal rate metric', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('78%')).toBeInTheDocument();
        expect(screen.getByText('Renewal Rate')).toBeInTheDocument();
      });
    });

    it('should allow filtering by time period', async () => {
      renderComponent();
      
      const periodSelect = screen.getByLabelText('Forecast period');
      fireEvent.change(periodSelect, { target: { value: '3-months' } });
      
      await waitFor(() => {
        expect(mockOnFetchRenewalForecast).toHaveBeenCalledWith(
          expect.objectContaining({ period: '3-months' })
        );
      });
    });
  });

  describe('Vendor Performance', () => {
    it('should display vendor performance table', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('vendor-performance-table')).toBeInTheDocument();
        expect(screen.getByText('Vendor Performance')).toBeInTheDocument();
      });
    });

    it('should show vendor metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Microsoft')).toBeInTheDocument();
        expect(screen.getByText('45 contracts')).toBeInTheDocument();
        expect(screen.getByText('$12.5M')).toBeInTheDocument();
        expect(screen.getByText('4.5')).toBeInTheDocument(); // Rating
      });
    });

    it('should sort vendors by different metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        const valueHeader = screen.getByText('Total Value');
        fireEvent.click(valueHeader);
      });
      
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Microsoft'); // Highest value first
    });

    it('should highlight performance issues', async () => {
      renderComponent();
      
      await waitFor(() => {
        const salesforceRow = screen.getByText('Salesforce').closest('tr');
        expect(salesforceRow).toHaveClass('bg-yellow-50'); // Warning for issues
      });
    });

    it('should open vendor detail on click', async () => {
      renderComponent();
      
      await waitFor(() => {
        const vendorName = screen.getByText('Microsoft');
        fireEvent.click(vendorName);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('vendor', { vendorId: 'vendor1' });
    });
  });

  describe('Department Breakdown', () => {
    it('should display department breakdown chart', async () => {
      mockOnFetchDepartmentBreakdown.mockResolvedValue([
        { label: 'Legal', value: 892, percentage: 36.3 },
        { label: 'IT', value: 623, percentage: 25.4 },
        { label: 'Finance', value: 445, percentage: 18.1 },
        { label: 'HR', value: 312, percentage: 12.7 },
        { label: 'Operations', value: 184, percentage: 7.5 },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-department-breakdown')).toBeInTheDocument();
        expect(screen.getByText('Department Breakdown')).toBeInTheDocument();
      });
    });

    it('should show contract counts by department', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Legal: 892')).toBeInTheDocument();
        expect(screen.getByText('IT: 623')).toBeInTheDocument();
      });
    });

    it('should filter analytics by department', async () => {
      renderComponent();
      
      const departmentFilter = screen.getByLabelText('Department');
      fireEvent.change(departmentFilter, { target: { value: 'Legal' } });
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({ department: 'Legal' })
        );
      });
    });
  });

  describe('Obligation Tracking', () => {
    it('should display obligation tracking section', async () => {
      mockOnFetchObligationTracking.mockResolvedValue([
        { id: '1', type: 'Payment', dueDate: '2024-07-15', status: 'upcoming', value: 50000 },
        { id: '2', type: 'Delivery', dueDate: '2024-07-20', status: 'upcoming', vendor: 'AWS' },
        { id: '3', type: 'Review', dueDate: '2024-07-10', status: 'overdue', contract: 'CON-123' },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('obligation-tracking')).toBeInTheDocument();
        expect(screen.getByText('Obligation Tracking')).toBeInTheDocument();
      });
    });

    it('should show upcoming obligations', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Payment due')).toBeInTheDocument();
        expect(screen.getByText('Jul 15, 2024')).toBeInTheDocument();
        expect(screen.getByText('$50,000')).toBeInTheDocument();
      });
    });

    it('should highlight overdue obligations', async () => {
      renderComponent();
      
      await waitFor(() => {
        const overdueItem = screen.getByText('Review').closest('div');
        expect(overdueItem).toHaveClass('bg-red-50');
      });
    });

    it('should filter obligations by type', async () => {
      renderComponent();
      
      const typeFilter = screen.getByLabelText('Obligation type');
      fireEvent.change(typeFilter, { target: { value: 'Payment' } });
      
      await waitFor(() => {
        expect(mockOnFetchObligationTracking).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'Payment' })
        );
      });
    });
  });

  describe('Time-based Filtering', () => {
    it('should filter all charts by date range', async () => {
      renderComponent();
      
      const dateRangeSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateRangeSelect, { target: { value: 'last-quarter' } });
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({ dateRange: expect.any(Object) })
        );
        expect(mockOnFetchVolumeData).toHaveBeenCalledWith(
          expect.objectContaining({ dateRange: expect.any(Object) })
        );
      });
    });

    it('should support custom date range', async () => {
      renderComponent();
      
      const dateRangeSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateRangeSelect, { target: { value: 'custom' } });
      
      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');
      
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });
      fireEvent.change(endDate, { target: { value: '2024-06-30' } });
      
      const applyButton = screen.getByRole('button', { name: /apply/i });
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              start: expect.any(Date),
              end: expect.any(Date),
            },
          })
        );
      });
    });

    it('should show comparison with previous period', async () => {
      renderComponent();
      
      const compareToggle = screen.getByLabelText('Compare with previous period');
      fireEvent.click(compareToggle);
      
      await waitFor(() => {
        expect(screen.getByText('vs. Previous Period')).toBeInTheDocument();
      });
    });
  });

  describe('Export and Reporting', () => {
    it('should export analytics to PDF', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const pdfOption = screen.getByText('Export as PDF');
      fireEvent.click(pdfOption);
      
      expect(mockOnExportAnalytics).toHaveBeenCalledWith('pdf', expect.any(Object));
    });

    it('should export analytics to Excel', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByText('Export as Excel');
      fireEvent.click(excelOption);
      
      expect(mockOnExportAnalytics).toHaveBeenCalledWith('excel', expect.any(Object));
    });

    it('should export analytics to CSV', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByText('Export as CSV');
      fireEvent.click(csvOption);
      
      expect(mockOnExportAnalytics).toHaveBeenCalledWith('csv', expect.any(Object));
    });

    it('should schedule recurring reports', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule/i });
      fireEvent.click(scheduleButton);
      
      const frequencySelect = screen.getByLabelText('Frequency');
      fireEvent.change(frequencySelect, { target: { value: 'weekly' } });
      
      const saveButton = screen.getByRole('button', { name: /save schedule/i });
      fireEvent.click(saveButton);
      
      expect(mockOnScheduleReport).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 'weekly' })
      );
    });
  });

  describe('View Customization', () => {
    it('should save custom view configuration', async () => {
      renderComponent();
      
      const customizeButton = screen.getByRole('button', { name: /customize view/i });
      fireEvent.click(customizeButton);
      
      const toggleChart = screen.getByLabelText('Show Vendor Performance');
      fireEvent.click(toggleChart);
      
      const saveButton = screen.getByRole('button', { name: /save view/i });
      fireEvent.click(saveButton);
      
      expect(mockOnSaveView).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should toggle chart visibility', async () => {
      renderComponent();
      
      const customizeButton = screen.getByRole('button', { name: /customize view/i });
      fireEvent.click(customizeButton);
      
      const toggleChart = screen.getByLabelText('Show Risk Distribution');
      fireEvent.click(toggleChart);
      
      expect(screen.queryByTestId('chart-risk-distribution')).not.toBeInTheDocument();
    });

    it('should rearrange chart order', async () => {
      renderComponent();
      
      const customizeButton = screen.getByRole('button', { name: /customize view/i });
      fireEvent.click(customizeButton);
      
      const dragHandle = screen.getAllByTestId('drag-handle')[0];
      fireEvent.dragStart(dragHandle);
      fireEvent.dragEnd(dragHandle);
      
      expect(mockOnSaveView).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('contract-analytics-view')).toHaveClass('mobile-view');
    });

    it('should stack charts on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const chartsContainer = screen.getByTestId('charts-container');
      expect(chartsContainer).toHaveClass('flex-col');
    });

    it('should show mobile-friendly table', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const vendorTable = screen.getByTestId('vendor-performance-table');
      expect(vendorTable).toHaveClass('mobile-table');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /contract analytics/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /metrics summary/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /charts/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstChart = screen.getByTestId('chart-contract-volume');
        firstChart.focus();
        
        fireEvent.keyDown(firstChart, { key: 'Enter' });
        
        expect(mockOnDrillDown).toHaveBeenCalled();
      });
    });

    it('should announce data updates', async () => {
      renderComponent();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/data updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics fetch failure', async () => {
      mockOnFetchMetrics.mockRejectedValue(new Error('Failed to fetch metrics'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should handle chart data failure gracefully', async () => {
      mockOnFetchVolumeData.mockRejectedValue(new Error('Failed to fetch data'));
      
      renderComponent();
      
      await waitFor(() => {
        const volumeChart = screen.getByTestId('chart-contract-volume');
        expect(within(volumeChart).getByText(/no data available/i)).toBeInTheDocument();
      });
    });

    it('should show empty state for no contracts', async () => {
      mockOnFetchMetrics.mockResolvedValue({
        ...sampleMetrics,
        totalContracts: 0,
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/no contracts found/i)).toBeInTheDocument();
        expect(screen.getByText(/start by creating contracts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should lazy load chart components', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-contract-volume')).toBeInTheDocument();
      });
      
      // Scroll to bottom to load more charts
      window.scrollTo(0, document.body.scrollHeight);
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-renewal-forecast')).toBeInTheDocument();
      });
    });

    it('should cache analytics data', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledTimes(1);
      });
      
      // Trigger re-render
      const { rerender } = renderComponent();
      rerender(
        <QueryClientProvider client={queryClient}>
          <ContractAnalyticsView currentUser={currentUser} />
        </QueryClientProvider>
      );
      
      // Should not fetch again due to cache
      expect(mockOnFetchMetrics).toHaveBeenCalledTimes(1);
    });
  });
});