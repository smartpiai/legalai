import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';

interface Pipeline {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped' | 'failed';
  type: string;
  schedule?: string;
  lastRun?: string;
  nextRun?: string;
}

interface PipelineMetrics {
  throughput: number;
  latency: number;
  errorRate: number;
  recordsProcessed: number;
}

interface DataQuality {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
}

export const DataPipelineArchitecture: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configType, setConfigType] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Mock data for demonstration
  const mockPipelines: Pipeline[] = [
    { id: '1', name: 'Contract Ingestion', status: 'active', type: 'realtime', lastRun: '2024-01-20T10:00:00Z' },
    { id: '2', name: 'Daily ETL', status: 'active', type: 'batch', schedule: '0 2 * * *', lastRun: '2024-01-20T02:00:00Z' }
  ];

  const mockMetrics: PipelineMetrics = {
    throughput: 1250,
    latency: 45,
    errorRate: 0.02,
    recordsProcessed: 1500000
  };

  const mockQuality: DataQuality = {
    completeness: 98.5,
    accuracy: 99.2,
    consistency: 97.8,
    timeliness: 99.5
  };

  const canEdit = hasPermission('analytics:edit');
  const canDelete = hasPermission('analytics:delete');

  const handlePipelineAction = (action: string) => {
    setStatus(`Pipeline ${action}`);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleRetryJob = () => {
    setStatus('Retry initiated');
    setTimeout(() => setStatus(''), 3000);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Pipelines</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">8</p>
          <p className="text-sm text-green-600 mt-1">↑ 2 from last week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Running Jobs</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
          <p className="text-sm text-gray-600 mt-1">5 queued</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Data Quality</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">98.5%</p>
          <p className="text-sm text-green-600 mt-1">↑ 0.3% improvement</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Throughput</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">1.2K/s</p>
          <p className="text-sm text-gray-600 mt-1">Avg last hour</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Pipeline Health</h3>
          <div data-testid="pipeline-health" className="space-y-2">
            {mockPipelines.map(pipeline => (
              <div key={pipeline.id} className="flex justify-between items-center p-2 border rounded">
                <span>{pipeline.name}</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  pipeline.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>{pipeline.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">System Status</h3>
          <div data-testid="system-status" className="space-y-2">
            <div className="flex justify-between">
              <span>CPU Usage</span>
              <span>45%</span>
            </div>
            <div className="flex justify-between">
              <span>Memory Usage</span>
              <span>62%</span>
            </div>
            <div className="flex justify-between">
              <span>Disk Usage</span>
              <span>78%</span>
            </div>
          </div>
        </div>
      </div>
      <div data-testid="realtime-metrics" className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Real-time Metrics</h3>
        <p>Records processed: {mockMetrics.recordsProcessed.toLocaleString()}</p>
      </div>
      <div data-testid="health-indicator" className="bg-white p-4 rounded-lg shadow">
        <p>System health: Healthy</p>
      </div>
      <div data-testid="alert-panel" className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Alerts</h3>
        <p className="text-gray-600">No active alerts</p>
      </div>
    </div>
  );

  const renderIngestionTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Ingestion Streams</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">WebSocket Stream</h4>
            <p className="text-sm text-gray-600">Real-time contract updates</p>
            <p className="text-sm mt-1">1,250 events/sec • Latency: 12ms</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Kafka Topics</h4>
            <p className="text-sm text-gray-600">Event streaming platform</p>
            <p className="text-sm mt-1">Queue depth: 1,024</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">API Webhooks</h4>
            <p className="text-sm text-gray-600">External system integration</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setShowConfigDialog(true); setConfigType('source'); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Configure Source
          </button>
        )}
      </div>
    </div>
  );

  const renderETLTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Pipeline Stages</h3>
        <div className="flex space-x-4">
          <div className="flex-1 p-4 border rounded">
            <h4 className="font-medium">Extract</h4>
            <p className="text-sm text-gray-600 mt-1">Data sources connected</p>
          </div>
          <div className="flex-1 p-4 border rounded">
            <h4 className="font-medium">Transform</h4>
            <p className="text-sm text-gray-600 mt-1">Rules applied</p>
          </div>
          <div className="flex-1 p-4 border rounded">
            <h4 className="font-medium">Load</h4>
            <p className="text-sm text-gray-600 mt-1">Target systems</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Transformation Rules</h3>
        <div className="space-y-2">
          <div className="p-2 border rounded">Data Cleansing</div>
          <div className="p-2 border rounded">Field Mapping</div>
          <div className="p-2 border rounded">Validation Rules</div>
        </div>
      </div>
      {canEdit && (
        <div className="flex space-x-2">
          <button onClick={() => { setShowConfigDialog(true); setConfigType('pipeline'); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Create Pipeline
          </button>
          <button onClick={() => { setShowConfigDialog(true); setConfigType('schedule'); }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Schedule
          </button>
        </div>
      )}
    </div>
  );

  const renderSchemaTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Data Warehouse Schema</h3>
        <div data-testid="schema-diagram" className="border rounded p-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Fact Tables</h4>
              <p className="text-sm text-gray-600">contract_facts, performance_facts</p>
            </div>
            <div>
              <h4 className="font-medium">Dimension Tables</h4>
              <p className="text-sm text-gray-600">dim_date, dim_contract_type, dim_vendor</p>
            </div>
            <div>
              <h4 className="font-medium">Foreign Keys</h4>
              <p className="text-sm text-gray-600">Properly defined relationships</p>
            </div>
            <div>
              <h4 className="font-medium">Indexes</h4>
              <p className="text-sm text-gray-600">Optimized for query performance</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total tables</p>
            <p className="text-xl font-bold">24</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Row count</p>
            <p className="text-xl font-bold">15.2M</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Storage size</p>
            <p className="text-xl font-bold">128 GB</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAggregationTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Aggregation Rules</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">Time-based Aggregation</h4>
            <div className="mt-2 flex space-x-2">
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">Hourly</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">Daily</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">Monthly</span>
            </div>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Dimensional Rollup</h4>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Metric Calculations</h4>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setShowConfigDialog(true); setConfigType('aggregation'); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Configure Aggregation
          </button>
        )}
      </div>
    </div>
  );

  const renderQualityTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Data Quality Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <h4 className="font-medium">Completeness</h4>
            <p className="text-2xl font-bold text-green-600">{mockQuality.completeness}%</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium">Accuracy</h4>
            <p className="text-2xl font-bold text-green-600">{mockQuality.accuracy}%</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium">Consistency</h4>
            <p className="text-2xl font-bold text-green-600">{mockQuality.consistency}%</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium">Timeliness</h4>
            <p className="text-2xl font-bold text-green-600">{mockQuality.timeliness}%</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Quality Rules</h3>
        <div className="space-y-2">
          <div className="p-2 border rounded">Validation Rules</div>
          <div className="p-2 border rounded">Anomaly Detection</div>
          <div className="p-2 border rounded">Data Profiling</div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Quality Issues</h3>
        <div data-testid="quality-alerts" className="text-gray-600">
          No quality issues detected
        </div>
        {canEdit && (
          <button onClick={() => { setShowConfigDialog(true); setConfigType('thresholds'); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Set Thresholds
          </button>
        )}
      </div>
    </div>
  );

  const renderMigrationTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Migration Progress</h3>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Overall Progress</span>
            <span>75%</span>
          </div>
          <div data-testid="migration-progress-bar" className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>Data Extraction</span>
            <span className="text-green-600">Complete</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Schema Mapping</span>
            <span className="text-green-600">Complete</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Data Loading</span>
            <span className="text-yellow-600">In Progress</span>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setShowConfigDialog(true); setConfigType('migration'); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Start Migration
          </button>
        )}
      </div>
    </div>
  );

  const renderIncrementalTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Incremental Processing</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">Delta Processing</h4>
            <p className="text-sm text-gray-600">Last processed: 2024-01-20 10:00:00</p>
            <p className="text-sm text-gray-600">Next run: 2024-01-20 11:00:00</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Change Data Capture</h4>
            <p className="text-sm text-gray-600">Monitoring table changes</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Processing Window</h4>
            <p className="text-sm text-gray-600">1 hour window</p>
            <p className="text-sm text-gray-600">Batch Size: 10,000 records</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderErrorsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Error Summary</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Failed Jobs</p>
            <p className="text-2xl font-bold text-red-600">3</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Error Rate</p>
            <p className="text-2xl font-bold">0.02%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Recovery Actions</p>
            <p className="text-2xl font-bold">2</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">Error Message</h4>
            <p className="text-sm text-red-600">Connection timeout</p>
            <h4 className="font-medium mt-2">Stack Trace</h4>
            <pre className="text-xs bg-gray-100 p-2 rounded">Error details...</pre>
            <h4 className="font-medium mt-2">Affected Records</h4>
            <p className="text-sm">152 records</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <h4 className="font-medium">Recovery Strategies</h4>
          <div className="flex space-x-2">
            <span className="px-2 py-1 bg-gray-100 rounded text-sm">Auto-Retry</span>
            <span className="px-2 py-1 bg-gray-100 rounded text-sm">Dead Letter Queue</span>
            <span className="px-2 py-1 bg-gray-100 rounded text-sm">Manual Intervention</span>
          </div>
        </div>
        {canEdit && (
          <button onClick={handleRetryJob} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            Retry Job
          </button>
        )}
      </div>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Performance Metrics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <h4 className="font-medium">Throughput</h4>
            <p className="text-2xl font-bold">{mockMetrics.throughput}/s</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium">Latency</h4>
            <p className="text-2xl font-bold">{mockMetrics.latency}ms</p>
          </div>
          <div className="text-center">
            <h4 className="font-medium">Resource Usage</h4>
            <p className="text-2xl font-bold">65%</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Optimization Suggestions</h3>
        <div className="space-y-2">
          <div className="p-2 border rounded">Index Recommendations</div>
          <div className="p-2 border rounded">Query Optimization</div>
          <div className="p-2 border rounded">Caching Strategies</div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Bottlenecks</h3>
        <div data-testid="bottleneck-chart" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          Bottleneck Analysis Chart
        </div>
      </div>
    </div>
  );

  const renderRetentionTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Data Retention Policies</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">Hot Storage</h4>
            <p className="text-sm text-gray-600">0-30 days • Fast access</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Warm Storage</h4>
            <p className="text-sm text-gray-600">31-90 days • Standard access</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Cold Storage</h4>
            <p className="text-sm text-gray-600">90+ days • Archive access</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span>Archive After</span>
            <span>90 days</span>
          </div>
          <div className="flex justify-between">
            <span>Delete After</span>
            <span>7 years</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="flex justify-between">
            <span>Current storage cost</span>
            <span className="font-bold">$2,450/month</span>
          </div>
          <div className="flex justify-between">
            <span>Projected savings</span>
            <span className="text-green-600">$450/month</span>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setShowConfigDialog(true); setConfigType('retention'); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Configure Policy
          </button>
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', content: renderOverviewTab },
    { id: 'ingestion', label: 'Ingestion', content: renderIngestionTab },
    { id: 'etl', label: 'ETL', content: renderETLTab },
    { id: 'schema', label: 'Schema', content: renderSchemaTab },
    { id: 'aggregation', label: 'Aggregation', content: renderAggregationTab },
    { id: 'quality', label: 'Quality', content: renderQualityTab },
    { id: 'migration', label: 'Migration', content: renderMigrationTab },
    { id: 'incremental', label: 'Incremental', content: renderIncrementalTab },
    { id: 'errors', label: 'Errors', content: renderErrorsTab },
    { id: 'performance', label: 'Performance', content: renderPerformanceTab },
    { id: 'retention', label: 'Retention', content: renderRetentionTab }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="data-pipeline-architecture">
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <main role="main" aria-label="Data Pipeline Architecture">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Pipeline Architecture</h1>
          <p className="text-gray-600">Manage and monitor data pipelines for analytics processing</p>
        </div>
        <div className="mb-6 flex justify-between items-center">
          <nav role="tablist" className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex space-x-2">
            {canEdit && (
              <>
                <button onClick={() => handlePipelineAction('started')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Start Pipeline
                </button>
                <button onClick={() => handlePipelineAction('stopped')}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                  Stop Pipeline
                </button>
                <button onClick={() => handlePipelineAction('paused')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                  Pause Pipeline
                </button>
              </>
            )}
            <button onClick={() => setShowLogs(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              View Logs
            </button>
            <button onClick={() => { setShowConfigDialog(true); setConfigType('export'); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Export Config
            </button>
            <button onClick={() => { setShowConfigDialog(true); setConfigType('report'); }}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              Generate Report
            </button>
          </div>
        </div>
        <div role="tabpanel">{tabs.find(t => t.id === activeTab)?.content()}</div>
        {showLogs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Pipeline Logs</h2>
              <div data-testid="pipeline-logs" className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm">
                <div>[2024-01-20 10:00:00] Pipeline started</div>
                <div>[2024-01-20 10:00:01] Connecting to data source...</div>
                <div>[2024-01-20 10:00:02] Connection established</div>
                <div>[2024-01-20 10:00:03] Processing batch 1/100</div>
              </div>
              <button onClick={() => setShowLogs(false)}
                className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        )}
        {showConfigDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">
                {configType === 'source' && 'Configure Source'}
                {configType === 'pipeline' && 'Create Pipeline'}
                {configType === 'schedule' && 'Schedule Pipeline'}
                {configType === 'aggregation' && 'Configure Aggregation'}
                {configType === 'thresholds' && 'Set Quality Thresholds'}
                {configType === 'migration' && 'Start Migration'}
                {configType === 'retention' && 'Configure Retention Policy'}
                {configType === 'export' && 'Export Configuration'}
                {configType === 'report' && 'Generate Report'}
              </h2>
              {(configType === 'source' || configType === 'pipeline') && (
                <>
                  <label htmlFor="source-type" className="block text-sm font-medium text-gray-700 mb-1">
                    {configType === 'source' ? 'Source Type' : 'Pipeline Name'}
                  </label>
                  <input id="source-type" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                  {configType === 'source' && (
                    <>
                      <label htmlFor="connection-url" className="block text-sm font-medium text-gray-700 mb-1">
                        Connection URL
                      </label>
                      <input id="connection-url" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                    </>
                  )}
                  {configType === 'pipeline' && (
                    <>
                      <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-1">
                        Schedule
                      </label>
                      <input id="schedule" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                    </>
                  )}
                </>
              )}
              {configType === 'schedule' && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Cron Expression</p>
                    <input type="text" className="w-full px-3 py-2 border rounded" placeholder="0 2 * * *" />
                  </div>
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Frequency</p>
                    <select className="w-full px-3 py-2 border rounded">
                      <option>Hourly</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                    </select>
                  </div>
                </>
              )}
              {configType === 'aggregation' && (
                <>
                  <label htmlFor="agg-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Aggregation Type
                  </label>
                  <select id="agg-type" className="w-full px-3 py-2 border rounded mb-3">
                    <option>Sum</option>
                    <option>Average</option>
                    <option>Count</option>
                  </select>
                  <label htmlFor="group-fields" className="block text-sm font-medium text-gray-700 mb-1">
                    Group By Fields
                  </label>
                  <input id="group-fields" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                </>
              )}
              {configType === 'thresholds' && (
                <>
                  <label htmlFor="min-completeness" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Completeness (%)
                  </label>
                  <input id="min-completeness" type="number" className="w-full px-3 py-2 border rounded mb-3" />
                  <label htmlFor="max-error" className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Error Rate (%)
                  </label>
                  <input id="max-error" type="number" className="w-full px-3 py-2 border rounded mb-3" />
                </>
              )}
              {configType === 'migration' && (
                <>
                  <label htmlFor="source-db" className="block text-sm font-medium text-gray-700 mb-1">
                    Source Database
                  </label>
                  <input id="source-db" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                  <label htmlFor="target-db" className="block text-sm font-medium text-gray-700 mb-1">
                    Target Database
                  </label>
                  <input id="target-db" type="text" className="w-full px-3 py-2 border rounded mb-3" />
                </>
              )}
              {configType === 'retention' && (
                <>
                  <label htmlFor="data-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Data Type
                  </label>
                  <select id="data-type" className="w-full px-3 py-2 border rounded mb-3">
                    <option>Contracts</option>
                    <option>Analytics</option>
                    <option>Logs</option>
                  </select>
                  <label htmlFor="retention-period" className="block text-sm font-medium text-gray-700 mb-1">
                    Retention Period
                  </label>
                  <select id="retention-period" className="w-full px-3 py-2 border rounded mb-3">
                    <option>30 days</option>
                    <option>90 days</option>
                    <option>1 year</option>
                    <option>7 years</option>
                  </select>
                </>
              )}
              {configType === 'export' && (
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">JSON</button>
                  <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">YAML</button>
                </div>
              )}
              {configType === 'report' && (
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">
                    Performance Report
                  </button>
                  <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">
                    Error Report
                  </button>
                </div>
              )}
              <div className="mt-4 flex space-x-2">
                <button onClick={() => { setShowConfigDialog(false); setConfigType(''); }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                  Cancel
                </button>
                {configType !== 'export' && configType !== 'report' && (
                  <button onClick={() => { setShowConfigDialog(false); setConfigType(''); }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};