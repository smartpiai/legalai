import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RiskAnalyticsDashboard } from '../RiskAnalyticsDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface RiskMetrics {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  mitigatedRisks: number;
  openRisks: number;
  averageRiskScore: number;
  complianceScore: number;
  riskTrend: 'increasing' | 'decreasing' | 'stable';
}

interface RiskHeatMapData {
  category: string;
  department: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  score: number;
}

interface RiskTrendData {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

interface RiskCategory {
  name: string;
  count: number;
  percentage: number;
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface MitigationItem {
  id: string;
  riskId: string;
  riskTitle: string;
  action: string;
  status: 'planned' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  owner: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

interface Alert {
  id: string;
  type: 'critical_risk' | 'compliance_breach' | 'sla_violation' | 'threshold_exceeded';
  title: string;
  description: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  acknowledged: boolean;
}

interface RiskAnalyticsDashboardProps {
  dateRange?: { start: Date; end: Date };
  departmentFilter?: string;
  categoryFilter?: string;
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
    department?: string;
  };
  onFetchMetrics?: (filters?: any) => Promise<RiskMetrics>;
  onFetchHeatMapData?: (filters?: any) => Promise<RiskHeatMapData[]>;
  onFetchTrendData?: (filters?: any) => Promise<RiskTrendData[]>;
  onFetchCategoryData?: (filters?: any) => Promise<RiskCategory[]>;
  onFetchMitigations?: (filters?: any) => Promise<MitigationItem[]>;
  onFetchAlerts?: (filters?: any) => Promise<Alert[]>;
  onFetchComplianceData?: (filters?: any) => Promise<any>;
  onFetchForecastData?: (period: string) => Promise<any>;
  onGenerateReport?: (type: string, filters?: any) => Promise<void>;
  onExportData?: (format: 'pdf' | 'excel' | 'csv', data: any) => Promise<void>;
  onUpdateMitigation?: (id: string, updates: any) => Promise<void>;
  onAcknowledgeAlert?: (id: string) => Promise<void>;
  onDrillDown?: (metric: string, data: any) => void;
  onSaveConfiguration?: (config: any) => Promise<void>;
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

describe('RiskAnalyticsDashboard', () => {
  let queryClient: QueryClient;
  const mockOnFetchMetrics = vi.fn();
  const mockOnFetchHeatMapData = vi.fn();
  const mockOnFetchTrendData = vi.fn();
  const mockOnFetchCategoryData = vi.fn();
  const mockOnFetchMitigations = vi.fn();
  const mockOnFetchAlerts = vi.fn();
  const mockOnFetchComplianceData = vi.fn();
  const mockOnFetchForecastData = vi.fn();
  const mockOnGenerateReport = vi.fn();
  const mockOnExportData = vi.fn();
  const mockOnUpdateMitigation = vi.fn();
  const mockOnAcknowledgeAlert = vi.fn();
  const mockOnDrillDown = vi.fn();
  const mockOnSaveConfiguration = vi.fn();

  const sampleMetrics: RiskMetrics = {
    totalRisks: 247,
    criticalRisks: 12,
    highRisks: 45,
    mediumRisks: 98,
    lowRisks: 92,
    mitigatedRisks: 156,
    openRisks: 91,
    averageRiskScore: 5.8,
    complianceScore: 87,
    riskTrend: 'decreasing',
  };

  const sampleHeatMapData: RiskHeatMapData[] = [
    { category: 'Financial', department: 'Legal', riskLevel: 'critical', count: 3, score: 9.2 },
    { category: 'Financial', department: 'IT', riskLevel: 'high', count: 5, score: 7.5 },
    { category: 'Operational', department: 'Legal', riskLevel: 'medium', count: 8, score: 5.3 },
    { category: 'Operational', department: 'Finance', riskLevel: 'high', count: 6, score: 7.1 },
    { category: 'Compliance', department: 'Legal', riskLevel: 'critical', count: 2, score: 9.5 },
    { category: 'Compliance', department: 'HR', riskLevel: 'medium', count: 10, score: 4.8 },
    { category: 'Strategic', department: 'Executive', riskLevel: 'high', count: 4, score: 8.0 },
    { category: 'Reputational', department: 'Marketing', riskLevel: 'low', count: 15, score: 2.5 },
  ];

  const sampleTrendData: RiskTrendData[] = [
    { date: '2024-01-01', critical: 15, high: 52, medium: 105, low: 88, total: 260 },
    { date: '2024-02-01', critical: 14, high: 48, medium: 102, low: 90, total: 254 },
    { date: '2024-03-01', critical: 13, high: 47, medium: 100, low: 91, total: 251 },
    { date: '2024-04-01', critical: 13, high: 46, medium: 99, low: 92, total: 250 },
    { date: '2024-05-01', critical: 12, high: 45, medium: 98, low: 92, total: 247 },
    { date: '2024-06-01', critical: 12, high: 45, medium: 98, low: 92, total: 247 },
  ];

  const sampleCategoryData: RiskCategory[] = [
    { name: 'Financial', count: 68, percentage: 27.5, averageScore: 6.8, trend: 'down' },
    { name: 'Operational', count: 82, percentage: 33.2, averageScore: 5.2, trend: 'stable' },
    { name: 'Compliance', count: 45, percentage: 18.2, averageScore: 7.1, trend: 'up' },
    { name: 'Strategic', count: 32, percentage: 13.0, averageScore: 6.5, trend: 'down' },
    { name: 'Reputational', count: 20, percentage: 8.1, averageScore: 3.8, trend: 'stable' },
  ];

  const sampleMitigations: MitigationItem[] = [
    {
      id: 'mit1',
      riskId: 'risk1',
      riskTitle: 'Data breach vulnerability',
      action: 'Implement enhanced encryption',
      status: 'in_progress',
      dueDate: '2024-07-15',
      owner: 'John Smith',
      priority: 'urgent',
    },
    {
      id: 'mit2',
      riskId: 'risk2',
      riskTitle: 'Contract compliance gap',
      action: 'Review and update contract templates',
      status: 'planned',
      dueDate: '2024-07-30',
      owner: 'Jane Doe',
      priority: 'high',
    },
    {
      id: 'mit3',
      riskId: 'risk3',
      riskTitle: 'Vendor performance issues',
      action: 'Conduct vendor assessment',
      status: 'overdue',
      dueDate: '2024-06-30',
      owner: 'Mike Johnson',
      priority: 'high',
    },
  ];

  const sampleAlerts: Alert[] = [
    {
      id: 'alert1',
      type: 'critical_risk',
      title: 'Critical Risk Detected',
      description: 'New critical risk identified in contract CON-2024-156',
      timestamp: '2024-06-15T10:30:00Z',
      severity: 'critical',
      acknowledged: false,
    },
    {
      id: 'alert2',
      type: 'compliance_breach',
      title: 'Compliance Threshold Exceeded',
      description: 'Compliance score dropped below 85% threshold',
      timestamp: '2024-06-15T09:15:00Z',
      severity: 'high',
      acknowledged: false,
    },
    {
      id: 'alert3',
      type: 'sla_violation',
      title: 'SLA Violation Warning',
      description: 'Risk mitigation SLA approaching deadline',
      timestamp: '2024-06-15T08:00:00Z',
      severity: 'medium',
      acknowledged: true,
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'risk_manager',
    permissions: ['view_risks', 'manage_mitigations', 'generate_reports'],
    department: 'Risk Management',
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
    mockOnFetchHeatMapData.mockResolvedValue(sampleHeatMapData);
    mockOnFetchTrendData.mockResolvedValue(sampleTrendData);
    mockOnFetchCategoryData.mockResolvedValue(sampleCategoryData);
    mockOnFetchMitigations.mockResolvedValue(sampleMitigations);
    mockOnFetchAlerts.mockResolvedValue(sampleAlerts);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      currentUser,
      onFetchMetrics: mockOnFetchMetrics,
      onFetchHeatMapData: mockOnFetchHeatMapData,
      onFetchTrendData: mockOnFetchTrendData,
      onFetchCategoryData: mockOnFetchCategoryData,
      onFetchMitigations: mockOnFetchMitigations,
      onFetchAlerts: mockOnFetchAlerts,
      onFetchComplianceData: mockOnFetchComplianceData,
      onFetchForecastData: mockOnFetchForecastData,
      onGenerateReport: mockOnGenerateReport,
      onExportData: mockOnExportData,
      onUpdateMitigation: mockOnUpdateMitigation,
      onAcknowledgeAlert: mockOnAcknowledgeAlert,
      onDrillDown: mockOnDrillDown,
      onSaveConfiguration: mockOnSaveConfiguration,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <RiskAnalyticsDashboard {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render risk analytics dashboard', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Risk Analytics Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('risk-analytics-dashboard')).toBeInTheDocument();
      });
    });

    it('should display risk metrics summary', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('metric-total-risks')).toBeInTheDocument();
        expect(screen.getByTestId('metric-critical-risks')).toBeInTheDocument();
        expect(screen.getByTestId('metric-compliance-score')).toBeInTheDocument();
        expect(screen.getByTestId('metric-average-score')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading risk analytics...')).toBeInTheDocument();
    });

    it('should display filter controls', () => {
      renderComponent();
      
      expect(screen.getByLabelText('Date range')).toBeInTheDocument();
      expect(screen.getByLabelText('Department')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk category')).toBeInTheDocument();
    });
  });

  describe('Risk Heat Map', () => {
    it('should display risk heat map', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-heat-map')).toBeInTheDocument();
        expect(screen.getByText('Risk Heat Map')).toBeInTheDocument();
      });
    });

    it('should show heat map cells with colors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const heatMap = screen.getByTestId('risk-heat-map');
        const criticalCells = within(heatMap).getAllByTestId('heat-cell-critical');
        expect(criticalCells.length).toBeGreaterThan(0);
      });
    });

    it('should display departments and categories', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Legal')).toBeInTheDocument();
        expect(screen.getByText('Financial')).toBeInTheDocument();
        expect(screen.getByText('Operational')).toBeInTheDocument();
      });
    });

    it('should show risk count on hover', async () => {
      renderComponent();
      
      await waitFor(() => {
        const cell = screen.getAllByTestId(/heat-cell/)[0];
        fireEvent.mouseEnter(cell);
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should handle cell click for drill-down', async () => {
      renderComponent();
      
      await waitFor(() => {
        const cell = screen.getAllByTestId(/heat-cell/)[0];
        fireEvent.click(cell);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('heat-map', expect.any(Object));
    });
  });

  describe('Risk Trend Analysis', () => {
    it('should display risk trend chart', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-trend-chart')).toBeInTheDocument();
        expect(screen.getByText('Risk Trend Analysis')).toBeInTheDocument();
      });
    });

    it('should show trend direction indicator', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
        expect(screen.getByText('Decreasing')).toBeInTheDocument();
      });
    });

    it('should toggle between chart views', async () => {
      renderComponent();
      
      await waitFor(() => {
        const viewToggle = screen.getByRole('button', { name: /stacked view/i });
        fireEvent.click(viewToggle);
      });
      
      expect(screen.getByTestId('chart-view-stacked')).toBeInTheDocument();
    });

    it('should show period selector', async () => {
      renderComponent();
      
      const periodSelect = screen.getByLabelText('Trend period');
      fireEvent.change(periodSelect, { target: { value: '3-months' } });
      
      await waitFor(() => {
        expect(mockOnFetchTrendData).toHaveBeenCalledWith(
          expect.objectContaining({ period: '3-months' })
        );
      });
    });
  });

  describe('Risk by Category', () => {
    it('should display risk categories breakdown', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-categories')).toBeInTheDocument();
        expect(screen.getByText('Risk by Category')).toBeInTheDocument();
      });
    });

    it('should show category percentages', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('27.5%')).toBeInTheDocument(); // Financial
        expect(screen.getByText('33.2%')).toBeInTheDocument(); // Operational
      });
    });

    it('should display average scores', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Avg: 6.8')).toBeInTheDocument(); // Financial
        expect(screen.getByText('Avg: 5.2')).toBeInTheDocument(); // Operational
      });
    });

    it('should show trend indicators for categories', async () => {
      renderComponent();
      
      await waitFor(() => {
        const financialCategory = screen.getByTestId('category-Financial');
        expect(within(financialCategory).getByTestId('trend-down')).toBeInTheDocument();
      });
    });

    it('should handle category click for filtering', async () => {
      renderComponent();
      
      await waitFor(() => {
        const categoryCard = screen.getByTestId('category-Financial');
        fireEvent.click(categoryCard);
      });
      
      expect(mockOnDrillDown).toHaveBeenCalledWith('category', { name: 'Financial' });
    });
  });

  describe('Mitigation Tracking', () => {
    it('should display mitigation items', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('mitigation-tracking')).toBeInTheDocument();
        expect(screen.getByText('Mitigation Tracking')).toBeInTheDocument();
      });
    });

    it('should show mitigation status badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByText('Planned')).toBeInTheDocument();
        expect(screen.getByText('Overdue')).toBeInTheDocument();
      });
    });

    it('should display priority indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Urgent')).toBeInTheDocument();
        expect(screen.getAllByText('High')).toHaveLength(2);
      });
    });

    it('should show owner information', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });
    });

    it('should update mitigation status', async () => {
      renderComponent();
      
      await waitFor(() => {
        const statusSelect = screen.getAllByLabelText('Status')[0];
        fireEvent.change(statusSelect, { target: { value: 'completed' } });
      });
      
      expect(mockOnUpdateMitigation).toHaveBeenCalledWith('mit1', { status: 'completed' });
    });

    it('should filter mitigations by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByLabelText('Filter by status');
      fireEvent.change(statusFilter, { target: { value: 'overdue' } });
      
      await waitFor(() => {
        expect(screen.getByText('Vendor performance issues')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Summary', () => {
    it('should display alerts', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('alert-summary')).toBeInTheDocument();
        expect(screen.getByText('Alert Summary')).toBeInTheDocument();
      });
    });

    it('should show unacknowledged count', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('unacknowledged-count')).toHaveTextContent('2');
      });
    });

    it('should display alert severity badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });
    });

    it('should acknowledge alert', async () => {
      renderComponent();
      
      await waitFor(() => {
        const ackButton = screen.getAllByRole('button', { name: /acknowledge/i })[0];
        fireEvent.click(ackButton);
      });
      
      expect(mockOnAcknowledgeAlert).toHaveBeenCalledWith('alert1');
    });

    it('should filter alerts by type', async () => {
      renderComponent();
      
      const typeFilter = screen.getByLabelText('Alert type');
      fireEvent.change(typeFilter, { target: { value: 'critical_risk' } });
      
      await waitFor(() => {
        expect(screen.getByText('Critical Risk Detected')).toBeInTheDocument();
      });
    });
  });

  describe('Compliance Scores', () => {
    it('should display compliance score gauge', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('compliance-gauge')).toBeInTheDocument();
        expect(screen.getByText('87%')).toBeInTheDocument();
      });
    });

    it('should show compliance trend', async () => {
      mockOnFetchComplianceData.mockResolvedValue({
        current: 87,
        previous: 85,
        target: 90,
        trend: 'improving',
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Improving')).toBeInTheDocument();
        expect(screen.getByText('Target: 90%')).toBeInTheDocument();
      });
    });

    it('should display compliance breakdown', async () => {
      mockOnFetchComplianceData.mockResolvedValue({
        breakdown: [
          { area: 'Regulatory', score: 92, status: 'compliant' },
          { area: 'Internal Policy', score: 85, status: 'warning' },
          { area: 'Industry Standards', score: 88, status: 'compliant' },
        ],
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Regulatory: 92%')).toBeInTheDocument();
        expect(screen.getByText('Internal Policy: 85%')).toBeInTheDocument();
      });
    });
  });

  describe('Risk Forecasting', () => {
    it('should display risk forecast', async () => {
      mockOnFetchForecastData.mockResolvedValue({
        predictions: [
          { month: 'Jul 2024', predicted: 250, confidence: 85 },
          { month: 'Aug 2024', predicted: 248, confidence: 82 },
          { month: 'Sep 2024', predicted: 245, confidence: 78 },
        ],
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-forecast')).toBeInTheDocument();
        expect(screen.getByText('Risk Forecasting')).toBeInTheDocument();
      });
    });

    it('should show forecast period selector', async () => {
      renderComponent();
      
      const periodSelect = screen.getByLabelText('Forecast period');
      fireEvent.change(periodSelect, { target: { value: '6-months' } });
      
      await waitFor(() => {
        expect(mockOnFetchForecastData).toHaveBeenCalledWith('6-months');
      });
    });

    it('should display confidence levels', async () => {
      mockOnFetchForecastData.mockResolvedValue({
        predictions: [
          { month: 'Jul 2024', predicted: 250, confidence: 85 },
        ],
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('85% confidence')).toBeInTheDocument();
      });
    });
  });

  describe('Comparative Analysis', () => {
    it('should compare with previous period', async () => {
      renderComponent();
      
      const compareToggle = screen.getByLabelText('Compare with previous period');
      fireEvent.click(compareToggle);
      
      await waitFor(() => {
        expect(screen.getByText('vs. Previous Period')).toBeInTheDocument();
      });
    });

    it('should show percentage changes', async () => {
      renderComponent();
      
      const compareToggle = screen.getByLabelText('Compare with previous period');
      fireEvent.click(compareToggle);
      
      await waitFor(() => {
        expect(screen.getByText('-5%')).toBeInTheDocument(); // Risk reduction
      });
    });

    it('should compare by department', async () => {
      renderComponent();
      
      const compareSelect = screen.getByLabelText('Compare by');
      fireEvent.change(compareSelect, { target: { value: 'department' } });
      
      await waitFor(() => {
        expect(screen.getByTestId('department-comparison')).toBeInTheDocument();
      });
    });
  });

  describe('Report Generation', () => {
    it('should generate risk report', async () => {
      renderComponent();
      
      const generateButton = screen.getByRole('button', { name: /generate report/i });
      fireEvent.click(generateButton);
      
      const reportType = screen.getByLabelText('Report type');
      fireEvent.change(reportType, { target: { value: 'executive-summary' } });
      
      const confirmButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(confirmButton);
      
      expect(mockOnGenerateReport).toHaveBeenCalledWith('executive-summary', expect.any(Object));
    });

    it('should export data to Excel', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const excelOption = screen.getByText('Export to Excel');
      fireEvent.click(excelOption);
      
      expect(mockOnExportData).toHaveBeenCalledWith('excel', expect.any(Object));
    });

    it('should export data to PDF', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const pdfOption = screen.getByText('Export to PDF');
      fireEvent.click(pdfOption);
      
      expect(mockOnExportData).toHaveBeenCalledWith('pdf', expect.any(Object));
    });

    it('should schedule automated reports', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule/i });
      fireEvent.click(scheduleButton);
      
      expect(screen.getByTestId('schedule-dialog')).toBeInTheDocument();
    });
  });

  describe('Action Item Tracking', () => {
    it('should display action items', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('action-items')).toBeInTheDocument();
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
    });

    it('should show action item counts by status', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('actions-pending')).toBeInTheDocument();
        expect(screen.getByTestId('actions-in-progress')).toBeInTheDocument();
        expect(screen.getByTestId('actions-completed')).toBeInTheDocument();
      });
    });

    it('should create new action item', async () => {
      renderComponent();
      
      const addButton = screen.getByRole('button', { name: /add action/i });
      fireEvent.click(addButton);
      
      const titleInput = screen.getByLabelText('Action title');
      await userEvent.type(titleInput, 'Review critical risks');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);
      
      expect(screen.getByText('Review critical risks')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    it('should filter by date range', async () => {
      renderComponent();
      
      const dateSelect = screen.getByLabelText('Date range');
      fireEvent.change(dateSelect, { target: { value: 'last-quarter' } });
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({ dateRange: expect.any(Object) })
        );
      });
    });

    it('should filter by department', async () => {
      renderComponent();
      
      const deptSelect = screen.getByLabelText('Department');
      fireEvent.change(deptSelect, { target: { value: 'Legal' } });
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({ department: 'Legal' })
        );
      });
    });

    it('should filter by risk category', async () => {
      renderComponent();
      
      const categorySelect = screen.getByLabelText('Risk category');
      fireEvent.change(categorySelect, { target: { value: 'Financial' } });
      
      await waitFor(() => {
        expect(mockOnFetchMetrics).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Financial' })
        );
      });
    });

    it('should search risks', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search risks...');
      await userEvent.type(searchInput, 'compliance');
      
      await waitFor(() => {
        expect(screen.getByText(/compliance/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configuration', () => {
    it('should save dashboard configuration', async () => {
      renderComponent();
      
      const configButton = screen.getByRole('button', { name: /configure/i });
      fireEvent.click(configButton);
      
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      fireEvent.click(saveButton);
      
      expect(mockOnSaveConfiguration).toHaveBeenCalled();
    });

    it('should toggle widget visibility', async () => {
      renderComponent();
      
      const configButton = screen.getByRole('button', { name: /configure/i });
      fireEvent.click(configButton);
      
      const heatMapToggle = screen.getByLabelText('Show Heat Map');
      fireEvent.click(heatMapToggle);
      
      expect(screen.queryByTestId('risk-heat-map')).not.toBeInTheDocument();
    });

    it('should set refresh interval', async () => {
      renderComponent();
      
      const configButton = screen.getByRole('button', { name: /configure/i });
      fireEvent.click(configButton);
      
      const intervalSelect = screen.getByLabelText('Refresh interval');
      fireEvent.change(intervalSelect, { target: { value: '30' } });
      
      expect(screen.getByText('Auto-refresh: 30s')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('risk-analytics-dashboard')).toHaveClass('mobile-view');
    });

    it('should stack widgets on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const container = screen.getByTestId('widgets-container');
      expect(container).toHaveClass('flex-col');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('main', { name: /risk analytics/i })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /risk metrics/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const heatMapCell = screen.getAllByTestId(/heat-cell/)[0];
        heatMapCell.focus();
        
        fireEvent.keyDown(heatMapCell, { key: 'Enter' });
        
        expect(mockOnDrillDown).toHaveBeenCalled();
      });
    });

    it('should announce updates', async () => {
      renderComponent();
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics fetch failure', async () => {
      mockOnFetchMetrics.mockRejectedValue(new Error('Failed to fetch'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show empty state', async () => {
      mockOnFetchMetrics.mockResolvedValue({
        ...sampleMetrics,
        totalRisks: 0,
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('No risks found')).toBeInTheDocument();
      });
    });
  });
});