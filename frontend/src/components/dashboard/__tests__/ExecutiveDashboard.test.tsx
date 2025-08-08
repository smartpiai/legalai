import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExecutiveDashboard } from '../ExecutiveDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface KPIData {
  totalContracts: number;
  activeContracts: number;
  contractsExpiringSoon: number;
  totalContractValue: number;
  averageApprovalTime: number;
  complianceScore: number;
  riskScore: number;
  automationRate: number;
}

interface TrendData {
  label: string;
  value: number;
  date: string;
  category?: string;
}

interface ActivityItem {
  id: string;
  type: 'contract_created' | 'contract_approved' | 'contract_expired' | 'risk_identified' | 'milestone_reached';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface ChartData {
  contractVolume: TrendData[];
  valueDistribution: TrendData[];
  riskTrends: TrendData[];
  departmentMetrics: TrendData[];
  timeToApproval: TrendData[];
}

interface ExecutiveDashboardProps {
  dateRange?: { start: Date; end: Date };
  refreshInterval?: number;
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
    preferences?: {
      dashboard?: {
        widgets?: string[];
        layout?: string;
      };
    };
  };
  onFetchKPIs?: (dateRange?: { start: Date; end: Date }) => Promise<KPIData>;
  onFetchChartData?: (type: string, dateRange?: { start: Date; end: Date }) => Promise<TrendData[]>;
  onFetchRecentActivity?: (limit?: number) => Promise<ActivityItem[]>;
  onExportDashboard?: (format: 'pdf' | 'excel' | 'png') => Promise<void>;
  onCustomizeLayout?: (layout: any) => Promise<void>;
  onDrillDown?: (metric: string, data: any) => void;
  onScheduleReport?: (schedule: any) => Promise<void>;
  onShareDashboard?: (recipients: string[]) => Promise<void>;
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

describe('ExecutiveDashboard', () => {
  let queryClient: QueryClient;
  const mockOnFetchKPIs = vi.fn();
  const mockOnFetchChartData = vi.fn();
  const mockOnFetchRecentActivity = vi.fn();
  const mockOnExportDashboard = vi.fn();
  const mockOnCustomizeLayout = vi.fn();
  const mockOnDrillDown = vi.fn();
  const mockOnScheduleReport = vi.fn();
  const mockOnShareDashboard = vi.fn();

  const sampleKPIData: KPIData = {
    totalContracts: 1247,
    activeContracts: 892,
    contractsExpiringSoon: 45,
    totalContractValue: 125000000,
    averageApprovalTime: 3.5,
    complianceScore: 94,
    riskScore: 28,
    automationRate: 72,
  };

  const sampleTrendData: TrendData[] = [
    { label: 'Jan', value: 120, date: '2024-01-01' },
    { label: 'Feb', value: 135, date: '2024-02-01' },
    { label: 'Mar', value: 128, date: '2024-03-01' },
    { label: 'Apr', value: 145, date: '2024-04-01' },
    { label: 'May', value: 158, date: '2024-05-01' },
    { label: 'Jun', value: 162, date: '2024-06-01' },
  ];

  const sampleActivityItems: ActivityItem[] = [
    {
      id: 'activity1',
      type: 'contract_approved',
      title: 'Service Agreement Approved',
      description: 'Microsoft Azure Enterprise Agreement approved by Legal team',
      timestamp: '2024-06-15T10:30:00Z',
      user: 'Sarah Johnson',
    },
    {
      id: 'activity2',
      type: 'risk_identified',
      title: 'High Risk Clause Detected',
      description: 'Unlimited liability clause found in vendor contract',
      timestamp: '2024-06-15T09:15:00Z',
      severity: 'high',
    },
    {
      id: 'activity3',
      type: 'contract_expired',
      title: 'Contract Expiration',
      description: 'AWS Support contract expired',
      timestamp: '2024-06-15T08:00:00Z',
    },
    {
      id: 'activity4',
      type: 'milestone_reached',
      title: '1000 Contracts Processed',
      description: 'Platform has successfully processed 1000 contracts',
      timestamp: '2024-06-14T16:45:00Z',
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'executive',
    permissions: ['view_dashboard', 'export_reports', 'customize_dashboard'],
    preferences: {
      dashboard: {
        widgets: ['kpi', 'trends', 'activity'],
        layout: 'default',
      },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockOnFetchKPIs.mockResolvedValue(sampleKPIData);
    mockOnFetchChartData.mockResolvedValue(sampleTrendData);
    mockOnFetchRecentActivity.mockResolvedValue(sampleActivityItems);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      currentUser,
      onFetchKPIs: mockOnFetchKPIs,
      onFetchChartData: mockOnFetchChartData,
      onFetchRecentActivity: mockOnFetchRecentActivity,
      onExportDashboard: mockOnExportDashboard,
      onCustomizeLayout: mockOnCustomizeLayout,
      onDrillDown: mockOnDrillDown,
      onScheduleReport: mockOnScheduleReport,
      onShareDashboard: mockOnShareDashboard,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ExecutiveDashboard {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render executive dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('executive-dashboard')).toBeInTheDocument();
      });
    });

    it('should display date range selector', () => {
      renderComponent();
      
      expect(screen.getByLabelText('Date range')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
    });

    it('should display refresh button', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should show customization button', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });
  });

  describe('KPI Cards', () => {
    it('should display all KPI cards', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('kpi-total-contracts')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-active-contracts')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-expiring-soon')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-total-value')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-approval-time')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-compliance-score')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-risk-score')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-automation-rate')).toBeInTheDocument();
      });
    });

    it('should format KPI values correctly', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('1,247')).toBeInTheDocument(); // Total contracts
        expect(screen.getByText('892')).toBeInTheDocument(); // Active contracts
        expect(screen.getByText('45')).toBeInTheDocument(); // Expiring soon
        expect(screen.getByText('$125M')).toBeInTheDocument(); // Total value
        expect(screen.getByText('3.5 days')).toBeInTheDocument(); // Approval time
        expect(screen.getByText('94%')).toBeInTheDocument(); // Compliance score
        expect(screen.getByText('28')).toBeInTheDocument(); // Risk score
        expect(screen.getByText('72%')).toBeInTheDocument(); // Automation rate
      });
    });

    it('should show trend indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const upIndicators = screen.getAllByTestId('trend-up');
        const downIndicators = screen.getAllByTestId('trend-down');
        expect(upIndicators.length).toBeGreaterThan(0);
        expect(downIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should handle KPI click for drill-down', async () => {
      renderComponent();
      
      await waitFor(() => {
        const totalContractsCard = screen.getByTestId('kpi-total-contracts');
        fireEvent.click(totalContractsCard);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('total-contracts', expect.any(Object));
    });

    it('should show KPI tooltips on hover', async () => {
      renderComponent();
      
      await waitFor(() => {
        const complianceCard = screen.getByTestId('kpi-compliance-score');
        fireEvent.mouseEnter(complianceCard);
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Trend Charts', () => {
    it('should display contract volume chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-contract-volume')).toBeInTheDocument();
        expect(screen.getByText('Contract Volume')).toBeInTheDocument();
      });
    });

    it('should display value distribution chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-value-distribution')).toBeInTheDocument();
        expect(screen.getByText('Value Distribution')).toBeInTheDocument();
      });
    });

    it('should display risk trends chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-risk-trends')).toBeInTheDocument();
        expect(screen.getByText('Risk Trends')).toBeInTheDocument();
      });
    });

    it('should display approval time chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-approval-time')).toBeInTheDocument();
        expect(screen.getByText('Approval Time')).toBeInTheDocument();
      });
    });

    it('should toggle chart types', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chartTypeButton = screen.getAllByRole('button', { name: /chart type/i })[0];
        fireEvent.click(chartTypeButton);
      });
      
      const barOption = screen.getByText('Bar Chart');
      fireEvent.click(barOption);
      
      expect(screen.getByTestId('chart-type-bar')).toBeInTheDocument();
    });

    it('should handle chart interaction', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chart = screen.getByTestId('chart-contract-volume');
        fireEvent.click(chart);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('contract-volume', expect.any(Object));
    });
  });

  describe('Recent Activity', () => {
    it('should display recent activity feed', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      });
    });

    it('should show all activity items', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Service Agreement Approved')).toBeInTheDocument();
        expect(screen.getByText('High Risk Clause Detected')).toBeInTheDocument();
        expect(screen.getByText('Contract Expiration')).toBeInTheDocument();
        expect(screen.getByText('1000 Contracts Processed')).toBeInTheDocument();
      });
    });

    it('should display activity timestamps', async () => {
      renderComponent();
      
      await waitFor(() => {
        const timestamps = screen.getAllByTestId(/activity-timestamp/);
        expect(timestamps.length).toBe(4);
      });
    });

    it('should show activity severity badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });

    it('should handle view all activities', async () => {
      renderComponent();
      
      await waitFor(() => {
        const viewAllButton = screen.getByRole('button', { name: /view all/i });
        fireEvent.click(viewAllButton);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('activity', expect.any(Object));
    });
  });

  describe('Date Range Selection', () => {
    it('should change date range', async () => {
      renderComponent();
      
      const dateRangeSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateRangeSelect, { target: { value: 'last-7-days' } });
      
      await waitFor(() => {
        expect(mockOnFetchKPIs).toHaveBeenCalledWith(
          expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
          })
        );
      });
    });

    it('should allow custom date range', async () => {
      renderComponent();
      
      const dateRangeSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateRangeSelect, { target: { value: 'custom' } });
      
      await waitFor(() => {
        expect(screen.getByLabelText('Start date')).toBeInTheDocument();
        expect(screen.getByLabelText('End date')).toBeInTheDocument();
      });
    });

    it('should apply custom date range', async () => {
      renderComponent();
      
      const dateRangeSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateRangeSelect, { target: { value: 'custom' } });
      
      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');
      
      fireEvent.change(startDate, { target: { value: '2024-06-01' } });
      fireEvent.change(endDate, { target: { value: '2024-06-30' } });
      
      const applyButton = screen.getByRole('button', { name: /apply/i });
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(mockOnFetchKPIs).toHaveBeenCalledWith(
          expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
          })
        );
      });
    });

    it('should show date range in header', async () => {
      renderComponent({ 
        dateRange: { 
          start: new Date('2024-06-01'), 
          end: new Date('2024-06-30') 
        } 
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Jun 1 - Jun 30, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Export and Share', () => {
    it('should export dashboard as PDF', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });
      
      const pdfOption = screen.getByText('Export as PDF');
      fireEvent.click(pdfOption);
      
      expect(mockOnExportDashboard).toHaveBeenCalledWith('pdf');
    });

    it('should export dashboard as Excel', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });
      
      const excelOption = screen.getByText('Export as Excel');
      fireEvent.click(excelOption);
      
      expect(mockOnExportDashboard).toHaveBeenCalledWith('excel');
    });

    it('should export dashboard as image', async () => {
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });
      
      const imageOption = screen.getByText('Export as Image');
      fireEvent.click(imageOption);
      
      expect(mockOnExportDashboard).toHaveBeenCalledWith('png');
    });

    it('should share dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        const shareButton = screen.getByRole('button', { name: /share/i });
        fireEvent.click(shareButton);
      });
      
      const emailInput = screen.getByPlaceholderText('Enter email addresses');
      await userEvent.type(emailInput, 'user@example.com, team@example.com');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);
      
      expect(mockOnShareDashboard).toHaveBeenCalledWith(['user@example.com', 'team@example.com']);
    });
  });

  describe('Dashboard Customization', () => {
    it('should open customization panel', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize/i });
        fireEvent.click(customizeButton);
      });
      
      expect(screen.getByTestId('customization-panel')).toBeInTheDocument();
    });

    it('should toggle widget visibility', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize/i });
        fireEvent.click(customizeButton);
      });
      
      const kpiToggle = screen.getByLabelText('Show KPI Cards');
      fireEvent.click(kpiToggle);
      
      expect(screen.queryByTestId('kpi-cards')).not.toBeInTheDocument();
    });

    it('should rearrange widgets', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize/i });
        fireEvent.click(customizeButton);
      });
      
      // Simulate drag and drop
      const dragHandle = screen.getAllByTestId('drag-handle')[0];
      fireEvent.dragStart(dragHandle);
      fireEvent.dragEnd(dragHandle);
      
      expect(mockOnCustomizeLayout).toHaveBeenCalled();
    });

    it('should save custom layout', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize/i });
        fireEvent.click(customizeButton);
      });
      
      const saveButton = screen.getByRole('button', { name: /save layout/i });
      fireEvent.click(saveButton);
      
      expect(mockOnCustomizeLayout).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should reset to default layout', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getByRole('button', { name: /customize/i });
        fireEvent.click(customizeButton);
      });
      
      const resetButton = screen.getByRole('button', { name: /reset to default/i });
      fireEvent.click(resetButton);
      
      expect(mockOnCustomizeLayout).toHaveBeenCalledWith({ layout: 'default' });
    });
  });

  describe('Auto-refresh', () => {
    it('should auto-refresh data', async () => {
      vi.useFakeTimers();
      renderComponent({ refreshInterval: 30000 }); // 30 seconds
      
      await waitFor(() => {
        expect(mockOnFetchKPIs).toHaveBeenCalledTimes(1);
      });
      
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockOnFetchKPIs).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });

    it('should show last updated time', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      });
    });

    it('should toggle auto-refresh', async () => {
      renderComponent();
      
      await waitFor(() => {
        const autoRefreshToggle = screen.getByLabelText('Auto-refresh');
        fireEvent.click(autoRefreshToggle);
      });
      
      expect(screen.getByText('Auto-refresh disabled')).toBeInTheDocument();
    });
  });

  describe('Report Scheduling', () => {
    it('should open report scheduling dialog', async () => {
      renderComponent();
      
      await waitFor(() => {
        const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
        fireEvent.click(scheduleButton);
      });
      
      expect(screen.getByTestId('schedule-dialog')).toBeInTheDocument();
    });

    it('should schedule daily report', async () => {
      renderComponent();
      
      await waitFor(() => {
        const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
        fireEvent.click(scheduleButton);
      });
      
      const frequencySelect = screen.getByLabelText('Frequency');
      fireEvent.change(frequencySelect, { target: { value: 'daily' } });
      
      const timeInput = screen.getByLabelText('Time');
      fireEvent.change(timeInput, { target: { value: '09:00' } });
      
      const emailInput = screen.getByLabelText('Recipients');
      await userEvent.type(emailInput, 'team@example.com');
      
      const saveButton = screen.getByRole('button', { name: /save schedule/i });
      fireEvent.click(saveButton);
      
      expect(mockOnScheduleReport).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'daily',
          time: '09:00',
          recipients: ['team@example.com'],
        })
      );
    });

    it('should schedule weekly report', async () => {
      renderComponent();
      
      await waitFor(() => {
        const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
        fireEvent.click(scheduleButton);
      });
      
      const frequencySelect = screen.getByLabelText('Frequency');
      fireEvent.change(frequencySelect, { target: { value: 'weekly' } });
      
      const daySelect = screen.getByLabelText('Day of week');
      fireEvent.change(daySelect, { target: { value: 'monday' } });
      
      const saveButton = screen.getByRole('button', { name: /save schedule/i });
      fireEvent.click(saveButton);
      
      expect(mockOnScheduleReport).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'weekly',
          dayOfWeek: 'monday',
        })
      );
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('executive-dashboard')).toHaveClass('mobile-view');
    });

    it('should show mobile menu', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    it('should stack cards on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const kpiContainer = screen.getByTestId('kpi-container');
      expect(kpiContainer).toHaveClass('flex-col');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /executive dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /key performance indicators/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /trend charts/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstKPICard = screen.getByTestId('kpi-total-contracts');
        firstKPICard.focus();
        
        fireEvent.keyDown(firstKPICard, { key: 'Enter' });
        
        expect(mockOnDrillDown).toHaveBeenCalled();
      });
    });

    it('should announce data updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        fireEvent.click(refreshButton);
      });
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/dashboard updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle KPI fetch failure', async () => {
      mockOnFetchKPIs.mockRejectedValue(new Error('Failed to fetch KPIs'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load kpis/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should handle chart data failure', async () => {
      mockOnFetchChartData.mockRejectedValue(new Error('Failed to fetch chart data'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load chart data/i)).toBeInTheDocument();
      });
    });

    it('should handle export failure gracefully', async () => {
      mockOnExportDashboard.mockRejectedValue(new Error('Export failed'));
      
      renderComponent();
      
      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportButton);
      });
      
      const pdfOption = screen.getByText('Export as PDF');
      fireEvent.click(pdfOption);
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });
    });

    it('should show empty state for no data', async () => {
      mockOnFetchKPIs.mockResolvedValue({
        totalContracts: 0,
        activeContracts: 0,
        contractsExpiringSoon: 0,
        totalContractValue: 0,
        averageApprovalTime: 0,
        complianceScore: 0,
        riskScore: 0,
        automationRate: 0,
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/no data available/i)).toBeInTheDocument();
        expect(screen.getByText(/start by creating contracts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permission-based Features', () => {
    it('should hide export button without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_dashboard'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    it('should hide customize button without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_dashboard'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /customize/i })).not.toBeInTheDocument();
    });

    it('should disable drill-down without permission', async () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['view_dashboard'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      await waitFor(() => {
        const kpiCard = screen.getByTestId('kpi-total-contracts');
        expect(kpiCard).not.toHaveClass('cursor-pointer');
      });
    });
  });
});