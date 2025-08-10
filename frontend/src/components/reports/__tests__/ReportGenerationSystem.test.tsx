/**
 * Report Generation System Tests
 * Following TDD - RED phase: Comprehensive test suite for automated report generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportGenerationSystem } from '../ReportGenerationSystem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock report service
vi.mock('../../../services/report.service', () => ({
  reportService: {
    generateReport: vi.fn(),
    getReportTemplates: vi.fn(),
    getReportHistory: vi.fn(),
    scheduleReport: vi.fn(),
    cancelScheduledReport: vi.fn(),
    downloadReport: vi.fn(),
    shareReport: vi.fn(),
    getReportStatus: vi.fn(),
    deleteReport: vi.fn(),
    duplicateReport: vi.fn(),
    getReportMetrics: vi.fn(),
  },
}));

const mockReportTemplates = [
  {
    id: 'template-1',
    name: 'Contract Performance Report',
    type: 'contract_performance',
    category: 'operational',
    description: 'Comprehensive contract performance analysis',
    parameters: [
      { name: 'timeRange', type: 'dateRange', required: true },
      { name: 'contractStatus', type: 'multiselect', options: ['active', 'draft', 'expired'] },
      { name: 'includeCharts', type: 'boolean', default: true },
    ],
  },
  {
    id: 'template-2',
    name: 'Compliance Audit Report',
    type: 'compliance_audit',
    category: 'compliance',
    description: 'Detailed compliance monitoring and audit trail',
    parameters: [
      { name: 'auditPeriod', type: 'dateRange', required: true },
      { name: 'departments', type: 'multiselect', required: false },
      { name: 'riskLevel', type: 'select', options: ['high', 'medium', 'low'] },
    ],
  },
  {
    id: 'template-3',
    name: 'Revenue Analysis Report',
    type: 'revenue_analysis',
    category: 'financial',
    description: 'Financial performance and revenue tracking',
    parameters: [
      { name: 'fiscalPeriod', type: 'dateRange', required: true },
      { name: 'currency', type: 'select', options: ['USD', 'EUR', 'GBP'], default: 'USD' },
      { name: 'breakdown', type: 'multiselect', options: ['monthly', 'quarterly', 'by_client'] },
    ],
  },
];

const mockReportHistory = [
  {
    id: 'report-1',
    name: 'Q4 Contract Performance',
    template: 'Contract Performance Report',
    status: 'completed',
    createdAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:05:30Z',
    fileSize: '2.3 MB',
    format: 'pdf',
    downloadUrl: 'https://example.com/reports/report-1.pdf',
  },
  {
    id: 'report-2',
    name: 'Compliance Audit - January',
    template: 'Compliance Audit Report',
    status: 'generating',
    createdAt: '2024-01-20T14:30:00Z',
    progress: 65,
  },
  {
    id: 'report-3',
    name: 'Revenue Analysis 2023',
    template: 'Revenue Analysis Report',
    status: 'failed',
    createdAt: '2024-01-18T09:15:00Z',
    error: 'Insufficient data for requested period',
  },
];

describe('ReportGenerationSystem', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();
  const mockOnReportGenerated = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin', tenant_id: 'tenant-1' },
      hasPermission: () => true,
    } as any);

    const { reportService } = require('../../../services/report.service');
    reportService.getReportTemplates.mockResolvedValue(mockReportTemplates);
    reportService.getReportHistory.mockResolvedValue(mockReportHistory);
    reportService.generateReport.mockResolvedValue({
      id: 'report-new',
      status: 'queued',
      estimatedTime: '3-5 minutes',
    });
    reportService.getReportStatus.mockResolvedValue({
      status: 'completed',
      progress: 100,
      downloadUrl: 'https://example.com/reports/report-new.pdf',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ReportGenerationSystem
          onReportGenerated={mockOnReportGenerated}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Report Templates', () => {
    it('should render report generation interface', () => {
      renderComponent();
      
      expect(screen.getByTestId('report-generation-system')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /report generation/i })).toBeInTheDocument();
    });

    it('should display available report templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
        expect(screen.getByText('Compliance Audit Report')).toBeInTheDocument();
        expect(screen.getByText('Revenue Analysis Report')).toBeInTheDocument();
      });
    });

    it('should show template descriptions and categories', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/operational/i)).toBeInTheDocument();
        expect(screen.getByText(/compliance/i)).toBeInTheDocument();
        expect(screen.getByText(/financial/i)).toBeInTheDocument();
        expect(screen.getByText(/comprehensive contract performance analysis/i)).toBeInTheDocument();
      });
    });

    it('should filter templates by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'compliance');
      
      await waitFor(() => {
        expect(screen.getByText('Compliance Audit Report')).toBeInTheDocument();
        expect(screen.queryByText('Contract Performance Report')).not.toBeInTheDocument();
      });
    });

    it('should search templates by name', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'Revenue');
      
      await waitFor(() => {
        expect(screen.getByText('Revenue Analysis Report')).toBeInTheDocument();
        expect(screen.queryByText('Contract Performance Report')).not.toBeInTheDocument();
      });
    });
  });

  describe('Report Configuration', () => {
    it('should open configuration modal on template selection', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      expect(screen.getByRole('dialog', { name: /configure report/i })).toBeInTheDocument();
      expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
    });

    it('should display required parameter fields', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      expect(screen.getByLabelText(/time range/i)).toBeInTheDocument();
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it('should show optional parameter fields', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      expect(screen.getByLabelText(/contract status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/include charts/i)).toBeInTheDocument();
    });

    it('should validate required parameters', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      await user.click(screen.getByRole('button', { name: /generate/i }));
      
      expect(screen.getByText(/time range is required/i)).toBeInTheDocument();
    });

    it('should set default values for parameters', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const includeChartsCheckbox = screen.getByLabelText(/include charts/i);
      expect(includeChartsCheckbox).toBeChecked();
    });

    it('should allow selecting multiple options', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const statusSelect = screen.getByLabelText(/contract status/i);
      await user.selectOptions(statusSelect, ['active', 'draft']);
      
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
    });
  });

  describe('Report Generation', () => {
    it('should generate report with valid configuration', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      // Fill required fields
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);
      await user.type(startDate, '2024-01-01');
      await user.type(endDate, '2024-03-31');
      
      await user.click(screen.getByRole('button', { name: /generate/i }));
      
      await waitFor(() => {
        expect(reportService.generateReport).toHaveBeenCalledWith({
          templateId: 'template-1',
          parameters: {
            timeRange: { start: '2024-01-01', end: '2024-03-31' },
            contractStatus: [],
            includeCharts: true,
          },
          format: 'pdf',
        });
      });
    });

    it('should show generation progress', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const startDate = screen.getByLabelText(/start date/i);
      await user.type(startDate, '2024-01-01');
      
      await user.click(screen.getByRole('button', { name: /generate/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/report queued/i)).toBeInTheDocument();
        expect(screen.getByText(/estimated time: 3-5 minutes/i)).toBeInTheDocument();
      });
    });

    it('should allow selecting output format', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const formatSelect = screen.getByLabelText(/output format/i);
      await user.selectOptions(formatSelect, 'xlsx');
      
      expect(screen.getByDisplayValue('xlsx')).toBeInTheDocument();
    });

    it('should provide report name customization', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const nameInput = screen.getByLabelText(/report name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Custom Report Name');
      
      expect(nameInput).toHaveValue('Custom Report Name');
    });
  });

  describe('Report History', () => {
    it('should display report history', async () => {
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        expect(screen.getByText('Q4 Contract Performance')).toBeInTheDocument();
        expect(screen.getByText('Compliance Audit - January')).toBeInTheDocument();
        expect(screen.getByText('Revenue Analysis 2023')).toBeInTheDocument();
      });
    });

    it('should show report status indicators', async () => {
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('status-completed')).toBeInTheDocument();
        expect(screen.getByTestId('status-generating')).toBeInTheDocument();
        expect(screen.getByTestId('status-failed')).toBeInTheDocument();
      });
    });

    it('should display generation progress for running reports', async () => {
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        expect(screen.getByText('65%')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should show error messages for failed reports', async () => {
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        expect(screen.getByText(/insufficient data for requested period/i)).toBeInTheDocument();
      });
    });

    it('should allow downloading completed reports', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download.*q4 contract performance/i });
        expect(downloadButton).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download.*q4 contract performance/i });
      await user.click(downloadButton);
      
      expect(reportService.downloadReport).toHaveBeenCalledWith('report-1');
    });

    it('should allow deleting reports', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      const deleteButton = screen.getByRole('button', { name: /delete.*q4 contract performance/i });
      await user.click(deleteButton);
      
      // Confirm deletion
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));
      
      expect(reportService.deleteReport).toHaveBeenCalledWith('report-1');
    });

    it('should allow duplicating reports', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      const duplicateButton = screen.getByRole('button', { name: /duplicate.*q4 contract performance/i });
      await user.click(duplicateButton);
      
      expect(reportService.duplicateReport).toHaveBeenCalledWith('report-1');
    });
  });

  describe('Report Scheduling', () => {
    it('should open schedule modal', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
      await user.click(scheduleButton);
      
      expect(screen.getByRole('dialog', { name: /schedule report/i })).toBeInTheDocument();
    });

    it('should provide frequency options', async () => {
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
      await user.click(scheduleButton);
      
      const frequencySelect = screen.getByLabelText(/frequency/i);
      expect(within(frequencySelect).getByText('Daily')).toBeInTheDocument();
      expect(within(frequencySelect).getByText('Weekly')).toBeInTheDocument();
      expect(within(frequencySelect).getByText('Monthly')).toBeInTheDocument();
    });

    it('should schedule recurring reports', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const scheduleButton = screen.getByRole('button', { name: /schedule report/i });
      await user.click(scheduleButton);
      
      await user.selectOptions(screen.getByLabelText(/template/i), 'template-1');
      await user.selectOptions(screen.getByLabelText(/frequency/i), 'weekly');
      await user.type(screen.getByLabelText(/email recipients/i), 'admin@example.com');
      
      await user.click(screen.getByRole('button', { name: /create schedule/i }));
      
      expect(reportService.scheduleReport).toHaveBeenCalledWith({
        templateId: 'template-1',
        frequency: 'weekly',
        recipients: ['admin@example.com'],
      });
    });

    it('should show scheduled reports list', async () => {
      renderComponent();
      
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);
      
      expect(screen.getByText(/no scheduled reports/i)).toBeInTheDocument();
    });

    it('should allow canceling scheduled reports', async () => {
      const { reportService } = require('../../../services/report.service');
      reportService.getReportHistory.mockResolvedValue([
        ...mockReportHistory,
        {
          id: 'schedule-1',
          name: 'Weekly Compliance Report',
          template: 'Compliance Audit Report',
          status: 'scheduled',
          frequency: 'weekly',
          nextRun: '2024-01-25T09:00:00Z',
        },
      ]);

      renderComponent();
      
      const scheduledTab = screen.getByRole('tab', { name: /scheduled/i });
      await user.click(scheduledTab);
      
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel.*weekly compliance/i });
        expect(cancelButton).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel.*weekly compliance/i });
      await user.click(cancelButton);
      
      expect(reportService.cancelScheduledReport).toHaveBeenCalledWith('schedule-1');
    });
  });

  describe('Report Sharing', () => {
    it('should allow sharing reports via email', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        const shareButton = screen.getByRole('button', { name: /share.*q4 contract performance/i });
        expect(shareButton).toBeInTheDocument();
      });

      const shareButton = screen.getByRole('button', { name: /share.*q4 contract performance/i });
      await user.click(shareButton);
      
      const emailInput = screen.getByLabelText(/email addresses/i);
      await user.type(emailInput, 'colleague@example.com');
      
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      expect(reportService.shareReport).toHaveBeenCalledWith({
        reportId: 'report-1',
        emails: ['colleague@example.com'],
      });
    });

    it('should generate shareable links', async () => {
      renderComponent();
      
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      const shareButton = screen.getByRole('button', { name: /share.*q4 contract performance/i });
      await user.click(shareButton);
      
      const linkTab = screen.getByRole('tab', { name: /link/i });
      await user.click(linkTab);
      
      expect(screen.getByRole('textbox', { name: /shareable link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    });
  });

  describe('Export Options', () => {
    it('should provide multiple export formats', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const formatSelect = screen.getByLabelText(/output format/i);
      expect(within(formatSelect).getByText('PDF')).toBeInTheDocument();
      expect(within(formatSelect).getByText('Excel')).toBeInTheDocument();
      expect(within(formatSelect).getByText('CSV')).toBeInTheDocument();
      expect(within(formatSelect).getByText('PowerPoint')).toBeInTheDocument();
    });

    it('should show format-specific options', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await user.selectOptions(screen.getByLabelText(/output format/i), 'pdf');
      
      expect(screen.getByLabelText(/include charts/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/page orientation/i)).toBeInTheDocument();
    });
  });

  describe('Analytics and Metrics', () => {
    it('should show report generation metrics', async () => {
      const { reportService } = require('../../../services/report.service');
      reportService.getReportMetrics.mockResolvedValue({
        totalReports: 45,
        reportsThisMonth: 12,
        avgGenerationTime: '2.3 minutes',
        mostUsedTemplate: 'Contract Performance Report',
        successRate: 92.5,
      });

      renderComponent();
      
      const metricsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(metricsTab);
      
      await waitFor(() => {
        expect(screen.getByText('45')).toBeInTheDocument(); // Total reports
        expect(screen.getByText('12')).toBeInTheDocument(); // This month
        expect(screen.getByText('2.3 minutes')).toBeInTheDocument(); // Avg time
        expect(screen.getByText('92.5%')).toBeInTheDocument(); // Success rate
      });
    });

    it('should display usage charts', async () => {
      renderComponent();
      
      const metricsTab = screen.getByRole('tab', { name: /analytics/i });
      await user.click(metricsTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
        expect(screen.getByTestId('template-popularity-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle template loading errors', async () => {
      const { reportService } = require('../../../services/report.service');
      reportService.getReportTemplates.mockRejectedValue(new Error('Network error'));

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load templates/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should handle report generation failures', async () => {
      const { reportService } = require('../../../services/report.service');
      reportService.generateReport.mockRejectedValue(new Error('Generation failed'));

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      await user.type(screen.getByLabelText(/start date/i), '2024-01-01');
      await user.click(screen.getByRole('button', { name: /generate/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
      });
    });

    it('should validate parameter constraints', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Contract Performance Report')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);
      await user.type(startDate, '2024-06-01');
      await user.type(endDate, '2024-01-01');
      
      await user.click(screen.getByRole('button', { name: /generate/i }));
      
      expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /report generation/i })).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstTemplate = screen.getByRole('button', { name: /generate report/i });
      firstTemplate.focus();
      
      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /schedule report/i })).toHaveFocus();
    });

    it('should announce report status updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/templates loaded/i);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large template lists efficiently', async () => {
      const largeTemplateList = Array.from({ length: 100 }, (_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        type: 'generic',
        category: 'operational',
        description: `Template ${i} description`,
        parameters: [],
      }));

      const { reportService } = require('../../../services/report.service');
      reportService.getReportTemplates.mockResolvedValue(largeTemplateList);

      renderComponent();
      
      await waitFor(() => {
        // Should use virtualization or pagination
        const templates = screen.getAllByText(/Template \d+/);
        expect(templates.length).toBeLessThan(50);
      });
    });

    it('should debounce search input', async () => {
      const { reportService } = require('../../../services/report.service');
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search templates/i);
      
      await user.type(searchInput, 'Contract');
      
      // Should not call immediately
      expect(reportService.getReportTemplates).toHaveBeenCalledTimes(1);
      
      // Wait for debounce
      await waitFor(() => {
        expect(reportService.getReportTemplates).toHaveBeenCalledWith({
          search: 'Contract',
        });
      }, { timeout: 1000 });
    });
  });
});