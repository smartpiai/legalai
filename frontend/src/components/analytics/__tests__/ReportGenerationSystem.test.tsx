import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportGenerationSystem } from '../ReportGenerationSystem';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock API calls
const mockApi = {
  getReports: vi.fn(),
  generateReport: vi.fn(),
  scheduleReport: vi.fn(),
  getTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  exportReport: vi.fn(),
  distributeReport: vi.fn(),
  getSubscriptions: vi.fn(),
  updateSubscription: vi.fn(),
  getReportHistory: vi.fn(),
  getReportVersion: vi.fn(),
  cacheReport: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ReportGenerationSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: (perm: string) => true
    });
  });

  describe('Report Dashboard', () => {
    it('should render report generation dashboard', () => {
      render(<ReportGenerationSystem />, { wrapper });
      expect(screen.getByText('Report Generation System')).toBeInTheDocument();
      expect(screen.getByText(/create and manage automated reports/i)).toBeInTheDocument();
    });

    it('should display report statistics', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Total Reports')).toBeInTheDocument();
        expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
        expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });
    });

    it('should show recent reports list', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Recent Reports')).toBeInTheDocument();
        expect(screen.getByTestId('recent-reports-list')).toBeInTheDocument();
      });
    });
  });

  describe('Scheduled Report Automation', () => {
    it('should display scheduled reports', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /scheduled/i }));
      await waitFor(() => {
        expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-reports-table')).toBeInTheDocument();
      });
    });

    it('should show report schedules', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /scheduled/i }));
      await waitFor(() => {
        expect(screen.getByText(/daily/i)).toBeInTheDocument();
        expect(screen.getByText(/weekly/i)).toBeInTheDocument();
        expect(screen.getByText(/monthly/i)).toBeInTheDocument();
      });
    });

    it('should allow creating scheduled report', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /scheduled/i }));
      fireEvent.click(screen.getByText('Schedule Report'));
      await waitFor(() => {
        expect(screen.getByLabelText('Report Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
        expect(screen.getByLabelText('Time')).toBeInTheDocument();
      });
    });

    it('should display next run time', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /scheduled/i }));
      await waitFor(() => {
        expect(screen.getByText(/next run/i)).toBeInTheDocument();
      });
    });

    it('should allow pausing scheduled reports', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /scheduled/i }));
      const pauseButton = screen.getByText('Pause');
      fireEvent.click(pauseButton);
      await waitFor(() => {
        expect(screen.getByText(/paused/i)).toBeInTheDocument();
      });
    });
  });

  describe('Custom Report Builder', () => {
    it('should display report builder interface', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      await waitFor(() => {
        expect(screen.getByText('Report Builder')).toBeInTheDocument();
        expect(screen.getByTestId('report-builder')).toBeInTheDocument();
      });
    });

    it('should show available data sources', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      await waitFor(() => {
        expect(screen.getByText('Data Sources')).toBeInTheDocument();
        expect(screen.getByText('Contracts')).toBeInTheDocument();
        expect(screen.getByText('Vendors')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });
    });

    it('should allow selecting report fields', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      await waitFor(() => {
        expect(screen.getByText('Available Fields')).toBeInTheDocument();
        expect(screen.getByText('Selected Fields')).toBeInTheDocument();
      });
    });

    it('should support drag and drop field selection', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      await waitFor(() => {
        expect(screen.getByTestId('field-selector')).toBeInTheDocument();
      });
    });

    it('should allow adding filters', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      fireEvent.click(screen.getByText('Add Filter'));
      await waitFor(() => {
        expect(screen.getByLabelText('Field')).toBeInTheDocument();
        expect(screen.getByLabelText('Operator')).toBeInTheDocument();
        expect(screen.getByLabelText('Value')).toBeInTheDocument();
      });
    });

    it('should preview report', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /builder/i }));
      fireEvent.click(screen.getByText('Preview'));
      await waitFor(() => {
        expect(screen.getByTestId('report-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Report Template Library', () => {
    it('should display template library', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      await waitFor(() => {
        expect(screen.getByText('Report Templates')).toBeInTheDocument();
        expect(screen.getByTestId('template-grid')).toBeInTheDocument();
      });
    });

    it('should show template categories', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      await waitFor(() => {
        expect(screen.getByText('Executive')).toBeInTheDocument();
        expect(screen.getByText('Operational')).toBeInTheDocument();
        expect(screen.getByText('Compliance')).toBeInTheDocument();
        expect(screen.getByText('Financial')).toBeInTheDocument();
      });
    });

    it('should display template details', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      await waitFor(() => {
        expect(screen.getByText('Contract Summary')).toBeInTheDocument();
        expect(screen.getByText(/monthly overview/i)).toBeInTheDocument();
      });
    });

    it('should allow creating new template', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      fireEvent.click(screen.getByText('Create Template'));
      await waitFor(() => {
        expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Category')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
      });
    });

    it('should allow using template', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      const useButton = screen.getAllByText('Use Template')[0];
      fireEvent.click(useButton);
      await waitFor(() => {
        expect(screen.getByText(/generating report/i)).toBeInTheDocument();
      });
    });

    it('should allow editing template', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      const editButton = screen.getAllByText('Edit')[0];
      fireEvent.click(editButton);
      await waitFor(() => {
        expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
      });
    });
  });

  describe('Export Format Options', () => {
    it('should display export options', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /export/i }));
      await waitFor(() => {
        expect(screen.getByText('Export Options')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
      });
    });

    it('should show format-specific settings', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /export/i }));
      fireEvent.click(screen.getByText('PDF'));
      await waitFor(() => {
        expect(screen.getByText('Page Size')).toBeInTheDocument();
        expect(screen.getByText('Orientation')).toBeInTheDocument();
        expect(screen.getByText('Include Charts')).toBeInTheDocument();
      });
    });

    it('should allow Excel configuration', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /export/i }));
      fireEvent.click(screen.getByText('Excel'));
      await waitFor(() => {
        expect(screen.getByText('Include Formulas')).toBeInTheDocument();
        expect(screen.getByText('Multiple Sheets')).toBeInTheDocument();
      });
    });

    it('should allow CSV configuration', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /export/i }));
      fireEvent.click(screen.getByText('CSV'));
      await waitFor(() => {
        expect(screen.getByText('Delimiter')).toBeInTheDocument();
        expect(screen.getByText('Include Headers')).toBeInTheDocument();
      });
    });
  });

  describe('Report Distribution System', () => {
    it('should display distribution settings', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /distribution/i }));
      await waitFor(() => {
        expect(screen.getByText('Distribution Settings')).toBeInTheDocument();
        expect(screen.getByText('Recipients')).toBeInTheDocument();
      });
    });

    it('should manage recipient lists', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /distribution/i }));
      await waitFor(() => {
        expect(screen.getByText('Email Recipients')).toBeInTheDocument();
        expect(screen.getByTestId('recipient-list')).toBeInTheDocument();
      });
    });

    it('should allow adding recipients', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /distribution/i }));
      fireEvent.click(screen.getByText('Add Recipient'));
      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });
    });

    it('should configure distribution channels', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /distribution/i }));
      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Slack')).toBeInTheDocument();
        expect(screen.getByText('Teams')).toBeInTheDocument();
      });
    });

    it('should set distribution schedule', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /distribution/i }));
      await waitFor(() => {
        expect(screen.getByText('Send Immediately')).toBeInTheDocument();
        expect(screen.getByText('Schedule Delivery')).toBeInTheDocument();
      });
    });
  });

  describe('Report Versioning', () => {
    it('should display version history', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /versions/i }));
      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument();
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });
    });

    it('should show version details', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /versions/i }));
      await waitFor(() => {
        expect(screen.getByText(/version \d+/i)).toBeInTheDocument();
        expect(screen.getByText(/created/i)).toBeInTheDocument();
        expect(screen.getByText(/modified/i)).toBeInTheDocument();
      });
    });

    it('should allow comparing versions', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /versions/i }));
      const compareButton = screen.getByText('Compare');
      fireEvent.click(compareButton);
      await waitFor(() => {
        expect(screen.getByTestId('version-comparison')).toBeInTheDocument();
      });
    });

    it('should allow restoring version', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /versions/i }));
      const restoreButton = screen.getByText('Restore');
      fireEvent.click(restoreButton);
      await waitFor(() => {
        expect(screen.getByText(/restore version/i)).toBeInTheDocument();
      });
    });
  });

  describe('Report Access Control', () => {
    it('should display access settings', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /access/i }));
      await waitFor(() => {
        expect(screen.getByText('Access Control')).toBeInTheDocument();
        expect(screen.getByText('Permissions')).toBeInTheDocument();
      });
    });

    it('should manage report permissions', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /access/i }));
      await waitFor(() => {
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText('Share')).toBeInTheDocument();
      });
    });

    it('should show user roles', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /access/i }));
      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
        expect(screen.getByText('Viewer')).toBeInTheDocument();
      });
    });

    it('should allow setting public/private', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /access/i }));
      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('Restricted')).toBeInTheDocument();
      });
    });
  });

  describe('Report Caching Strategy', () => {
    it('should display cache settings', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cache/i }));
      await waitFor(() => {
        expect(screen.getByText('Cache Settings')).toBeInTheDocument();
        expect(screen.getByText('Cache Duration')).toBeInTheDocument();
      });
    });

    it('should show cached reports', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cache/i }));
      await waitFor(() => {
        expect(screen.getByText('Cached Reports')).toBeInTheDocument();
        expect(screen.getByTestId('cache-list')).toBeInTheDocument();
      });
    });

    it('should display cache statistics', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cache/i }));
      await waitFor(() => {
        expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
        expect(screen.getByText('Cache Size')).toBeInTheDocument();
      });
    });

    it('should allow clearing cache', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /cache/i }));
      fireEvent.click(screen.getByText('Clear Cache'));
      await waitFor(() => {
        expect(screen.getByText(/cache cleared/i)).toBeInTheDocument();
      });
    });
  });

  describe('Report Subscription Management', () => {
    it('should display subscriptions', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /subscriptions/i }));
      await waitFor(() => {
        expect(screen.getByText('Report Subscriptions')).toBeInTheDocument();
        expect(screen.getByTestId('subscription-list')).toBeInTheDocument();
      });
    });

    it('should show subscription details', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /subscriptions/i }));
      await waitFor(() => {
        expect(screen.getByText(/subscriber/i)).toBeInTheDocument();
        expect(screen.getByText(/frequency/i)).toBeInTheDocument();
        expect(screen.getByText(/last sent/i)).toBeInTheDocument();
      });
    });

    it('should allow subscribing to reports', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /subscriptions/i }));
      fireEvent.click(screen.getByText('Subscribe'));
      await waitFor(() => {
        expect(screen.getByLabelText('Report')).toBeInTheDocument();
        expect(screen.getByLabelText('Delivery Frequency')).toBeInTheDocument();
      });
    });

    it('should manage subscription preferences', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /subscriptions/i }));
      await waitFor(() => {
        expect(screen.getByText('Email Notifications')).toBeInTheDocument();
        expect(screen.getByText('Format Preference')).toBeInTheDocument();
      });
    });
  });

  describe('Executive Dashboard Generation', () => {
    it('should generate executive dashboard', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /executive/i }));
      await waitFor(() => {
        expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('executive-metrics')).toBeInTheDocument();
      });
    });

    it('should show KPI summary', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /executive/i }));
      await waitFor(() => {
        expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument();
        expect(screen.getByText('Contract Value')).toBeInTheDocument();
        expect(screen.getByText('Compliance Rate')).toBeInTheDocument();
      });
    });

    it('should display executive charts', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /executive/i }));
      await waitFor(() => {
        expect(screen.getByTestId('executive-charts')).toBeInTheDocument();
        expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
      });
    });

    it('should allow customizing dashboard', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /executive/i }));
      fireEvent.click(screen.getByText('Customize'));
      await waitFor(() => {
        expect(screen.getByText('Select Widgets')).toBeInTheDocument();
        expect(screen.getByText('Layout Options')).toBeInTheDocument();
      });
    });
  });

  describe('Report Generation Actions', () => {
    it('should generate report on demand', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByText('Generate Report'));
      await waitFor(() => {
        expect(screen.getByText(/generating/i)).toBeInTheDocument();
      });
    });

    it('should save report configuration', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByText('Save Configuration'));
      await waitFor(() => {
        expect(screen.getByText(/configuration saved/i)).toBeInTheDocument();
      });
    });

    it('should run report immediately', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByText('Run Now'));
      await waitFor(() => {
        expect(screen.getByText(/running report/i)).toBeInTheDocument();
      });
    });
  });

  describe('Report Filters', () => {
    it('should filter by date range', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      const dateInput = screen.getByLabelText('Date Range');
      fireEvent.change(dateInput, { target: { value: 'last30days' } });
      await waitFor(() => {
        expect(screen.getByText(/filtered/i)).toBeInTheDocument();
      });
    });

    it('should filter by report type', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      const typeSelect = screen.getByLabelText('Report Type');
      fireEvent.change(typeSelect, { target: { value: 'executive' } });
      await waitFor(() => {
        expect(screen.getByText(/executive reports/i)).toBeInTheDocument();
      });
    });

    it('should search reports', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      const searchInput = screen.getByPlaceholderText('Search reports...');
      await userEvent.type(searchInput, 'monthly');
      await waitFor(() => {
        expect(screen.getByText(/monthly/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ReportGenerationSystem />, { wrapper });
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Report Generation System');
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      await waitFor(() => {
        expect(tabs[1]).toHaveFocus();
      });
    });

    it('should announce report generation status', async () => {
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByText('Generate Report'));
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/generating/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle generation errors', async () => {
      mockApi.generateReport.mockRejectedValue(new Error('Generation failed'));
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByText('Generate Report'));
      await waitFor(() => {
        expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
      });
    });

    it('should handle template errors', async () => {
      mockApi.getTemplates.mockRejectedValue(new Error('Failed to load templates'));
      render(<ReportGenerationSystem />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /templates/i }));
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should hide admin features for viewers', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'reports:view'
      });
      render(<ReportGenerationSystem />, { wrapper });
      expect(screen.queryByText('Create Template')).not.toBeInTheDocument();
      expect(screen.queryByText('Schedule Report')).not.toBeInTheDocument();
    });

    it('should show read-only view for non-admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'reports:view'
      });
      render(<ReportGenerationSystem />, { wrapper });
      expect(screen.getByText('Report Generation System')).toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });
});