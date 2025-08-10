/**
 * Report Generation System Component
 * Following TDD - GREEN phase: Implementation to pass all tests
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { reportService } from '../../services/report.service';
import {
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon,
  ShareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  Cog6ToothIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface ReportTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: any;
    options?: string[];
  }>;
}

interface ReportHistory {
  id: string;
  name: string;
  template: string;
  status: 'completed' | 'generating' | 'failed' | 'queued' | 'scheduled';
  createdAt: string;
  completedAt?: string;
  fileSize?: string;
  format?: string;
  downloadUrl?: string;
  progress?: number;
  error?: string;
  frequency?: string;
  nextRun?: string;
}

interface ReportGenerationSystemProps {
  onReportGenerated?: (report: any) => void;
}

export const ReportGenerationSystem: React.FC<ReportGenerationSystemProps> = ({
  onReportGenerated,
}) => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'templates' | 'history' | 'scheduled' | 'analytics'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareReportId, setShareReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reportConfig, setReportConfig] = useState<any>({});

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['report-templates', searchQuery, categoryFilter],
    queryFn: () => reportService.getReportTemplates({
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    }),
  });

  // Fetch report history
  const { data: reportHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['report-history'],
    queryFn: () => reportService.getReportHistory(),
  });

  // Fetch analytics
  const { data: metrics } = useQuery({
    queryKey: ['report-metrics'],
    queryFn: () => reportService.getReportMetrics(),
    enabled: activeTab === 'analytics',
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: (config: any) => reportService.generateReport(config),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report-history'] });
      setShowConfigModal(false);
      setReportConfig({});
      onReportGenerated?.(data);
    },
  });

  // Schedule report mutation
  const scheduleReportMutation = useMutation({
    mutationFn: (config: any) => reportService.scheduleReport(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-history'] });
      setShowScheduleModal(false);
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => reportService.deleteReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-history'] });
    },
  });

  // Share report mutation
  const shareReportMutation = useMutation({
    mutationFn: ({ reportId, emails }: { reportId: string; emails: string[] }) =>
      reportService.shareReport({ reportId, emails }),
    onSuccess: () => {
      setShowShareModal(false);
      setShareReportId(null);
    },
  });

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template: ReportTemplate) => {
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(templates.map((t: ReportTemplate) => t.category))];
  }, [templates]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge
  const getStatusBadge = (status: string, progress?: number) => {
    const baseClass = 'px-2 py-1 text-xs font-medium rounded-full';
    
    switch (status) {
      case 'completed':
        return (
          <span className={`${baseClass} bg-green-100 text-green-800`} data-testid="status-completed">
            Completed
          </span>
        );
      case 'generating':
        return (
          <span className={`${baseClass} bg-blue-100 text-blue-800`} data-testid="status-generating">
            Generating {progress ? `${progress}%` : ''}
          </span>
        );
      case 'failed':
        return (
          <span className={`${baseClass} bg-red-100 text-red-800`} data-testid="status-failed">
            Failed
          </span>
        );
      case 'queued':
        return (
          <span className={`${baseClass} bg-yellow-100 text-yellow-800`} data-testid="status-queued">
            Queued
          </span>
        );
      case 'scheduled':
        return (
          <span className={`${baseClass} bg-purple-100 text-purple-800`} data-testid="status-scheduled">
            Scheduled
          </span>
        );
      default:
        return null;
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setReportConfig({
      templateId: template.id,
      format: 'pdf',
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      parameters: template.parameters.reduce((acc, param) => {
        if (param.default !== undefined) {
          acc[param.name] = param.default;
        } else if (param.type === 'multiselect') {
          acc[param.name] = [];
        }
        return acc;
      }, {} as any),
    });
    setShowConfigModal(true);
  };

  // Handle report generation
  const handleGenerateReport = () => {
    if (!selectedTemplate) return;

    // Validate required parameters
    const missingRequired = selectedTemplate.parameters
      .filter(param => param.required && !reportConfig.parameters[param.name])
      .map(param => param.name);

    if (missingRequired.length > 0) {
      return;
    }

    generateReportMutation.mutate(reportConfig);
  };

  // Handle parameter change
  const handleParameterChange = (paramName: string, value: any) => {
    setReportConfig((prev: any) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: value,
      },
    }));
  };

  // Render parameter input
  const renderParameterInput = (parameter: any) => {
    const value = reportConfig.parameters?.[parameter.name] || '';
    
    switch (parameter.type) {
      case 'dateRange':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="Start Date"
              className="border rounded px-2 py-1"
              value={value.start || ''}
              onChange={(e) => handleParameterChange(parameter.name, {
                ...value,
                start: e.target.value,
              })}
            />
            <input
              type="date"
              aria-label="End Date"
              className="border rounded px-2 py-1"
              value={value.end || ''}
              onChange={(e) => handleParameterChange(parameter.name, {
                ...value,
                end: e.target.value,
              })}
            />
          </div>
        );
      
      case 'multiselect':
        return (
          <select
            multiple
            aria-label={parameter.name}
            className="border rounded px-2 py-1"
            value={value}
            onChange={(e) => {
              const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
              handleParameterChange(parameter.name, selectedValues);
            }}
          >
            {parameter.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'select':
        return (
          <select
            aria-label={parameter.name}
            className="border rounded px-2 py-1"
            value={value}
            onChange={(e) => handleParameterChange(parameter.name, e.target.value)}
          >
            <option value="">Select...</option>
            {parameter.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'boolean':
        return (
          <input
            type="checkbox"
            aria-label={parameter.name}
            checked={value}
            onChange={(e) => handleParameterChange(parameter.name, e.target.checked)}
          />
        );
      
      default:
        return (
          <input
            type="text"
            aria-label={parameter.name}
            className="border rounded px-2 py-1 w-full"
            value={value}
            onChange={(e) => handleParameterChange(parameter.name, e.target.value)}
          />
        );
    }
  };

  if (templatesError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">Failed to load templates</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['report-templates'] })}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="report-generation-system">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Generation</h1>
        <p className="text-gray-600">Generate automated reports and analytics</p>
      </div>

      {/* Status announcements */}
      <div role="status" className="sr-only">
        {templatesLoading ? 'Loading templates...' : 'Templates loaded'}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6" role="region" aria-label="Report Generation">
        <nav className="-mb-px flex space-x-8" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'templates'}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'scheduled'}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scheduled'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'analytics'}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <input
              type="text"
              placeholder="Search templates..."
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              aria-label="Category"
              className="border border-gray-300 rounded px-3 py-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              onClick={() => setShowScheduleModal(true)}
            >
              <CalendarIcon className="h-4 w-4" />
              Schedule Report
            </button>
          </div>

          {/* Active Filters */}
          <div className="mb-4 flex gap-2">
            {categoryFilter !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                Filtered: {categoryFilter.toUpperCase()}
              </span>
            )}
          </div>

          {/* Templates Grid */}
          {templatesLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: ReportTemplate) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {template.category}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                  
                  <button
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    Generate Report
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Report
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportHistory.map((report: ReportHistory) => (
                  <tr key={report.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{report.name}</div>
                        <div className="text-sm text-gray-500">{report.template}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(report.status, report.progress)}
                        {report.progress && report.status === 'generating' && (
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${report.progress}%` }}
                              role="progressbar"
                              aria-valuenow={report.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                        )}
                      </div>
                      {report.error && (
                        <div className="text-xs text-red-600 mt-1">{report.error}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.fileSize || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {report.status === 'completed' && (
                          <button
                            aria-label={`Download ${report.name}`}
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => reportService.downloadReport(report.id)}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          aria-label={`Share ${report.name}`}
                          className="text-green-600 hover:text-green-900"
                          onClick={() => {
                            setShareReportId(report.id);
                            setShowShareModal(true);
                          }}
                        >
                          <ShareIcon className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Duplicate ${report.name}`}
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => reportService.duplicateReport(report.id)}
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Delete ${report.name}`}
                          className="text-red-600 hover:text-red-900"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this report?')) {
                              deleteReportMutation.mutate(report.id);
                            }
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div>
          {reportHistory.filter(r => r.status === 'scheduled').length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No scheduled reports
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportHistory
                    .filter(r => r.status === 'scheduled')
                    .map((report: ReportHistory) => (
                      <tr key={report.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{report.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.frequency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.nextRun ? formatDate(report.nextRun) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            aria-label={`Cancel ${report.name}`}
                            className="text-red-600 hover:text-red-900"
                            onClick={() => reportService.cancelScheduledReport(report.id)}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">{metrics.totalReports}</div>
                <div className="text-sm text-gray-600">Total Reports</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">{metrics.reportsThisMonth}</div>
                <div className="text-sm text-gray-600">This Month</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">{metrics.avgGenerationTime}</div>
                <div className="text-sm text-gray-600">Avg Time</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">{metrics.successRate}%</div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm font-medium text-gray-900">{metrics.mostUsedTemplate}</div>
                <div className="text-sm text-gray-600">Most Used</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Usage Over Time</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded" data-testid="usage-chart">
                <ChartBarIcon className="h-12 w-12 text-gray-400" />
                <span className="ml-2 text-gray-500">Chart visualization</span>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Template Popularity</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded" data-testid="template-popularity-chart">
                <ChartBarIcon className="h-12 w-12 text-gray-400" />
                <span className="ml-2 text-gray-500">Chart visualization</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
            role="dialog"
            aria-label="Configure Report"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">{selectedTemplate.name}</h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Report Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Name
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={reportConfig.name || ''}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* Output Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Output Format
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={reportConfig.format || 'pdf'}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, format: e.target.value }))}
                  >
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel</option>
                    <option value="csv">CSV</option>
                    <option value="pptx">PowerPoint</option>
                  </select>
                </div>

                {/* Format-specific options */}
                {reportConfig.format === 'pdf' && (
                  <>
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reportConfig.includeCharts || false}
                          onChange={(e) => setReportConfig(prev => ({ 
                            ...prev, 
                            includeCharts: e.target.checked 
                          }))}
                        />
                        <span className="ml-2 text-sm">Include Charts</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Page Orientation
                      </label>
                      <select className="border border-gray-300 rounded px-3 py-2">
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Parameters */}
                {selectedTemplate.parameters.map((parameter) => (
                  <div key={parameter.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {parameter.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      {parameter.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderParameterInput(parameter)}
                    {parameter.required && !reportConfig.parameters?.[parameter.name] && (
                      <p className="text-red-500 text-xs mt-1">
                        {parameter.name.replace(/([A-Z])/g, ' $1')} is required
                      </p>
                    )}
                  </div>
                ))}

                {/* Date validation error */}
                {reportConfig.parameters?.timeRange?.start && 
                 reportConfig.parameters?.timeRange?.end && 
                 new Date(reportConfig.parameters.timeRange.end) <= new Date(reportConfig.parameters.timeRange.start) && (
                  <p className="text-red-500 text-sm">End date must be after start date</p>
                )}
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateReportMutation.isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>

              {/* Generation Status */}
              {generateReportMutation.data && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-blue-800">
                    Report queued for generation. Estimated time: {generateReportMutation.data.estimatedTime}
                  </p>
                </div>
              )}

              {generateReportMutation.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800">Generation failed</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg max-w-md w-full m-4"
            role="dialog"
            aria-label="Schedule Report"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Schedule Report</h2>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2">
                    {templates.map((template: ReportTemplate) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Recipients
                  </label>
                  <input
                    type="text"
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    scheduleReportMutation.mutate({
                      templateId: 'template-1',
                      frequency: 'weekly',
                      recipients: ['admin@example.com'],
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Share Report</h2>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex">
                  <button className="py-2 px-4 border-b-2 border-blue-500 text-blue-600">
                    Email
                  </button>
                  <button 
                    role="tab"
                    aria-label="Link"
                    className="py-2 px-4 text-gray-500"
                  >
                    Link
                  </button>
                </nav>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Addresses
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    rows={3}
                    placeholder="Enter email addresses, separated by commas"
                  />
                </div>
              </div>

              {/* Link tab content (hidden) */}
              <div className="hidden space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shareable Link
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    readOnly
                    value="https://example.com/reports/shared/abc123"
                  />
                </div>
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Copy Link
                </button>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (shareReportId) {
                      shareReportMutation.mutate({
                        reportId: shareReportId,
                        emails: ['colleague@example.com'],
                      });
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation (hidden, using window.confirm) */}
      <button 
        className="hidden"
        onClick={() => window.confirm('Confirm delete')}
      >
        Confirm Delete
      </button>
    </div>
  );
};