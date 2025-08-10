/**
 * Data Pipeline Architecture Tests
 * Following TDD - RED phase: Comprehensive test suite for data pipeline visualization and management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataPipelineArchitecture } from '../DataPipelineArchitecture';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock API calls
const mockApi = {
  getPipelines: vi.fn(),
  createPipeline: vi.fn(),
  updatePipeline: vi.fn(),
  deletePipeline: vi.fn(),
  runPipeline: vi.fn(),
  getMetrics: vi.fn(),
  getJobs: vi.fn(),
  retryJob: vi.fn(),
  getDataQuality: vi.fn(),
  getMigrationStatus: vi.fn(),
  startMigration: vi.fn(),
  configurePipeline: vi.fn(),
  getRetentionPolicies: vi.fn(),
  updateRetentionPolicy: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('DataPipelineArchitecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: (perm: string) => true
    });
  });

  describe('Pipeline Overview', () => {
    it('should render pipeline dashboard', () => {
      render(<DataPipelineArchitecture />, { wrapper });
      expect(screen.getByText('Data Pipeline Architecture')).toBeInTheDocument();
      expect(screen.getByText(/manage and monitor data pipelines/i)).toBeInTheDocument();
    });

    it('should display pipeline statistics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Active Pipelines')).toBeInTheDocument();
        expect(screen.getByText('Running Jobs')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
        expect(screen.getByText('Throughput')).toBeInTheDocument();
      });
    });

    it('should show pipeline status indicators', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('pipeline-health')).toBeInTheDocument();
        expect(screen.getByTestId('system-status')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Data Ingestion', () => {
    it('should display ingestion streams', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /ingestion/i }));
      await waitFor(() => {
        expect(screen.getByText('WebSocket Stream')).toBeInTheDocument();
        expect(screen.getByText('Kafka Topics')).toBeInTheDocument();
        expect(screen.getByText('API Webhooks')).toBeInTheDocument();
      });
    });

    it('should show ingestion metrics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /ingestion/i }));
      await waitFor(() => {
        expect(screen.getByText(/events\/sec/i)).toBeInTheDocument();
        expect(screen.getByText(/latency/i)).toBeInTheDocument();
        expect(screen.getByText(/queue depth/i)).toBeInTheDocument();
      });
    });

    it('should allow configuring ingestion sources', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /ingestion/i }));
      fireEvent.click(screen.getByText('Configure Source'));
      await waitFor(() => {
        expect(screen.getByLabelText('Source Type')).toBeInTheDocument();
        expect(screen.getByLabelText('Connection URL')).toBeInTheDocument();
      });
    });
  });

  describe('ETL Pipeline Configuration', () => {
    it('should display pipeline stages', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /etl/i }));
      await waitFor(() => {
        expect(screen.getByText('Extract')).toBeInTheDocument();
        expect(screen.getByText('Transform')).toBeInTheDocument();
        expect(screen.getByText('Load')).toBeInTheDocument();
      });
    });

    it('should show transformation rules', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /etl/i }));
      await waitFor(() => {
        expect(screen.getByText('Data Cleansing')).toBeInTheDocument();
        expect(screen.getByText('Field Mapping')).toBeInTheDocument();
        expect(screen.getByText('Validation Rules')).toBeInTheDocument();
      });
    });

    it('should allow creating new pipelines', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /etl/i }));
      fireEvent.click(screen.getByText('Create Pipeline'));
      await waitFor(() => {
        expect(screen.getByLabelText('Pipeline Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Schedule')).toBeInTheDocument();
      });
    });

    it('should support pipeline scheduling', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /etl/i }));
      fireEvent.click(screen.getByText('Schedule'));
      await waitFor(() => {
        expect(screen.getByText('Cron Expression')).toBeInTheDocument();
        expect(screen.getByText('Frequency')).toBeInTheDocument();
      });
    });
  });

  describe('Data Warehouse Schema', () => {
    it('should display schema visualization', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /schema/i }));
      await waitFor(() => {
        expect(screen.getByTestId('schema-diagram')).toBeInTheDocument();
        expect(screen.getByText('Fact Tables')).toBeInTheDocument();
        expect(screen.getByText('Dimension Tables')).toBeInTheDocument();
      });
    });

    it('should show table relationships', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /schema/i }));
      await waitFor(() => {
        expect(screen.getByText('Foreign Keys')).toBeInTheDocument();
        expect(screen.getByText('Indexes')).toBeInTheDocument();
      });
    });

    it('should display schema statistics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /schema/i }));
      await waitFor(() => {
        expect(screen.getByText(/total tables/i)).toBeInTheDocument();
        expect(screen.getByText(/row count/i)).toBeInTheDocument();
        expect(screen.getByText(/storage size/i)).toBeInTheDocument();
      });
    });
  });

  describe('Aggregation Strategies', () => {
    it('should display aggregation rules', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /aggregation/i }));
      await waitFor(() => {
        expect(screen.getByText('Time-based Aggregation')).toBeInTheDocument();
        expect(screen.getByText('Dimensional Rollup')).toBeInTheDocument();
        expect(screen.getByText('Metric Calculations')).toBeInTheDocument();
      });
    });

    it('should show aggregation intervals', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /aggregation/i }));
      await waitFor(() => {
        expect(screen.getByText('Hourly')).toBeInTheDocument();
        expect(screen.getByText('Daily')).toBeInTheDocument();
        expect(screen.getByText('Monthly')).toBeInTheDocument();
      });
    });

    it('should allow configuring aggregations', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /aggregation/i }));
      fireEvent.click(screen.getByText('Configure Aggregation'));
      await waitFor(() => {
        expect(screen.getByLabelText('Aggregation Type')).toBeInTheDocument();
        expect(screen.getByLabelText('Group By Fields')).toBeInTheDocument();
      });
    });
  });

  describe('Data Quality Monitoring', () => {
    it('should display quality metrics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /quality/i }));
      await waitFor(() => {
        expect(screen.getByText('Completeness')).toBeInTheDocument();
        expect(screen.getByText('Accuracy')).toBeInTheDocument();
        expect(screen.getByText('Consistency')).toBeInTheDocument();
        expect(screen.getByText('Timeliness')).toBeInTheDocument();
      });
    });

    it('should show quality rules', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /quality/i }));
      await waitFor(() => {
        expect(screen.getByText('Validation Rules')).toBeInTheDocument();
        expect(screen.getByText('Anomaly Detection')).toBeInTheDocument();
        expect(screen.getByText('Data Profiling')).toBeInTheDocument();
      });
    });

    it('should display quality alerts', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /quality/i }));
      await waitFor(() => {
        expect(screen.getByText('Quality Issues')).toBeInTheDocument();
        expect(screen.getByTestId('quality-alerts')).toBeInTheDocument();
      });
    });

    it('should allow setting quality thresholds', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /quality/i }));
      fireEvent.click(screen.getByText('Set Thresholds'));
      await waitFor(() => {
        expect(screen.getByLabelText('Minimum Completeness')).toBeInTheDocument();
        expect(screen.getByLabelText('Maximum Error Rate')).toBeInTheDocument();
      });
    });
  });

  describe('Historical Data Migration', () => {
    it('should display migration status', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /migration/i }));
      await waitFor(() => {
        expect(screen.getByText('Migration Progress')).toBeInTheDocument();
        expect(screen.getByTestId('migration-progress-bar')).toBeInTheDocument();
      });
    });

    it('should show migration tasks', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /migration/i }));
      await waitFor(() => {
        expect(screen.getByText('Data Extraction')).toBeInTheDocument();
        expect(screen.getByText('Schema Mapping')).toBeInTheDocument();
        expect(screen.getByText('Data Loading')).toBeInTheDocument();
      });
    });

    it('should allow starting migration', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /migration/i }));
      fireEvent.click(screen.getByText('Start Migration'));
      await waitFor(() => {
        expect(screen.getByLabelText('Source Database')).toBeInTheDocument();
        expect(screen.getByLabelText('Target Database')).toBeInTheDocument();
      });
    });
  });

  describe('Incremental Processing', () => {
    it('should display incremental jobs', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /incremental/i }));
      await waitFor(() => {
        expect(screen.getByText('Delta Processing')).toBeInTheDocument();
        expect(screen.getByText('Change Data Capture')).toBeInTheDocument();
      });
    });

    it('should show last processed timestamps', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /incremental/i }));
      await waitFor(() => {
        expect(screen.getByText(/last processed/i)).toBeInTheDocument();
        expect(screen.getByText(/next run/i)).toBeInTheDocument();
      });
    });

    it('should display processing windows', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /incremental/i }));
      await waitFor(() => {
        expect(screen.getByText('Processing Window')).toBeInTheDocument();
        expect(screen.getByText('Batch Size')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should display error summary', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /errors/i }));
      await waitFor(() => {
        expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
        expect(screen.getByText('Error Rate')).toBeInTheDocument();
        expect(screen.getByText('Recovery Actions')).toBeInTheDocument();
      });
    });

    it('should show error details', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /errors/i }));
      await waitFor(() => {
        expect(screen.getByText('Error Message')).toBeInTheDocument();
        expect(screen.getByText('Stack Trace')).toBeInTheDocument();
        expect(screen.getByText('Affected Records')).toBeInTheDocument();
      });
    });

    it('should allow retrying failed jobs', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /errors/i }));
      const retryButton = screen.getByText('Retry Job');
      fireEvent.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText(/retry initiated/i)).toBeInTheDocument();
      });
    });

    it('should display recovery strategies', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /errors/i }));
      await waitFor(() => {
        expect(screen.getByText('Auto-Retry')).toBeInTheDocument();
        expect(screen.getByText('Dead Letter Queue')).toBeInTheDocument();
        expect(screen.getByText('Manual Intervention')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should display performance metrics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /performance/i }));
      await waitFor(() => {
        expect(screen.getByText('Throughput')).toBeInTheDocument();
        expect(screen.getByText('Latency')).toBeInTheDocument();
        expect(screen.getByText('Resource Usage')).toBeInTheDocument();
      });
    });

    it('should show optimization suggestions', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /performance/i }));
      await waitFor(() => {
        expect(screen.getByText('Index Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Query Optimization')).toBeInTheDocument();
        expect(screen.getByText('Caching Strategies')).toBeInTheDocument();
      });
    });

    it('should display bottleneck analysis', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /performance/i }));
      await waitFor(() => {
        expect(screen.getByText('Bottlenecks')).toBeInTheDocument();
        expect(screen.getByTestId('bottleneck-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Data Retention Policies', () => {
    it('should display retention rules', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /retention/i }));
      await waitFor(() => {
        expect(screen.getByText('Hot Storage')).toBeInTheDocument();
        expect(screen.getByText('Warm Storage')).toBeInTheDocument();
        expect(screen.getByText('Cold Storage')).toBeInTheDocument();
      });
    });

    it('should show archival schedules', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /retention/i }));
      await waitFor(() => {
        expect(screen.getByText('Archive After')).toBeInTheDocument();
        expect(screen.getByText('Delete After')).toBeInTheDocument();
      });
    });

    it('should allow configuring retention policies', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /retention/i }));
      fireEvent.click(screen.getByText('Configure Policy'));
      await waitFor(() => {
        expect(screen.getByLabelText('Data Type')).toBeInTheDocument();
        expect(screen.getByLabelText('Retention Period')).toBeInTheDocument();
      });
    });

    it('should display storage costs', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByRole('tab', { name: /retention/i }));
      await waitFor(() => {
        expect(screen.getByText(/storage cost/i)).toBeInTheDocument();
        expect(screen.getByText(/projected savings/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pipeline Actions', () => {
    it('should allow starting pipelines', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      const startButton = screen.getByText('Start Pipeline');
      fireEvent.click(startButton);
      await waitFor(() => {
        expect(screen.getByText(/pipeline started/i)).toBeInTheDocument();
      });
    });

    it('should allow stopping pipelines', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      const stopButton = screen.getByText('Stop Pipeline');
      fireEvent.click(stopButton);
      await waitFor(() => {
        expect(screen.getByText(/pipeline stopped/i)).toBeInTheDocument();
      });
    });

    it('should allow pausing pipelines', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      const pauseButton = screen.getByText('Pause Pipeline');
      fireEvent.click(pauseButton);
      await waitFor(() => {
        expect(screen.getByText(/pipeline paused/i)).toBeInTheDocument();
      });
    });

    it('should show pipeline logs', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByText('View Logs'));
      await waitFor(() => {
        expect(screen.getByTestId('pipeline-logs')).toBeInTheDocument();
      });
    });
  });

  describe('Monitoring Dashboard', () => {
    it('should display real-time metrics', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('realtime-metrics')).toBeInTheDocument();
        expect(screen.getByText(/records processed/i)).toBeInTheDocument();
      });
    });

    it('should show pipeline health', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
        expect(screen.getByText(/system health/i)).toBeInTheDocument();
      });
    });

    it('should display alert notifications', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('alert-panel')).toBeInTheDocument();
      });
    });
  });

  describe('Export and Reporting', () => {
    it('should allow exporting pipeline configurations', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByText('Export Config'));
      await waitFor(() => {
        expect(screen.getByText('JSON')).toBeInTheDocument();
        expect(screen.getByText('YAML')).toBeInTheDocument();
      });
    });

    it('should generate pipeline reports', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByText('Generate Report'));
      await waitFor(() => {
        expect(screen.getByText('Performance Report')).toBeInTheDocument();
        expect(screen.getByText('Error Report')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DataPipelineArchitecture />, { wrapper });
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Data Pipeline Architecture');
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      await waitFor(() => {
        expect(tabs[1]).toHaveFocus();
      });
    });

    it('should announce status changes', async () => {
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByText('Start Pipeline'));
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/pipeline started/i);
      });
    });
  });

  describe('Error States', () => {
    it('should handle pipeline failures gracefully', async () => {
      mockApi.runPipeline.mockRejectedValue(new Error('Pipeline error'));
      render(<DataPipelineArchitecture />, { wrapper });
      fireEvent.click(screen.getByText('Start Pipeline'));
      await waitFor(() => {
        expect(screen.getByText(/pipeline error/i)).toBeInTheDocument();
      });
    });

    it('should display connection errors', async () => {
      mockApi.getPipelines.mockRejectedValue(new Error('Connection failed'));
      render(<DataPipelineArchitecture />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should hide admin actions for non-admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => false
      });
      render(<DataPipelineArchitecture />, { wrapper });
      expect(screen.queryByText('Create Pipeline')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Pipeline')).not.toBeInTheDocument();
    });

    it('should show read-only view for viewers', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'analytics:view'
      });
      render(<DataPipelineArchitecture />, { wrapper });
      expect(screen.queryByText('Configure')).not.toBeInTheDocument();
      expect(screen.getByText('Data Pipeline Architecture')).toBeInTheDocument();
    });
  });
});