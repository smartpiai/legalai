import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay, startOfQuarter } from 'date-fns';
import {
  ExclamationTriangleIcon,
  FireIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

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

export const RiskAnalyticsDashboard: React.FC<RiskAnalyticsDashboardProps> = ({
  dateRange: initialDateRange,
  departmentFilter: initialDepartment,
  categoryFilter: initialCategory,
  isLoading: externalLoading = false,
  currentUser,
  onFetchMetrics,
  onFetchHeatMapData,
  onFetchTrendData,
  onFetchCategoryData,
  onFetchMitigations,
  onFetchAlerts,
  onFetchComplianceData,
  onFetchForecastData,
  onGenerateReport,
  onExportData,
  onUpdateMitigation,
  onAcknowledgeAlert,
  onDrillDown,
  onSaveConfiguration,
}) => {
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: startOfDay(subDays(new Date(), 90)),
      end: endOfDay(new Date()),
    }
  );
  const [selectedDateOption, setSelectedDateOption] = useState('last-quarter');
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartment || '');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory || '');
  const [mitigationStatusFilter, setMitigationStatusFilter] = useState('all');
  const [alertTypeFilter, setAlertTypeFilter] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('6-months');
  const [forecastPeriod, setForecastPeriod] = useState('3-months');
  const [chartView, setChartView] = useState('grouped');
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const [compareBy, setCompareBy] = useState('period');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [reportType, setReportType] = useState('executive-summary');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [visibleWidgets, setVisibleWidgets] = useState([
    'metrics', 'heatMap', 'trend', 'categories', 'mitigations', 'alerts', 'compliance', 'forecast', 'actions'
  ]);
  const [statusMessage, setStatusMessage] = useState('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const filters = useMemo(() => ({
    dateRange,
    department: departmentFilter,
    category: categoryFilter,
  }), [dateRange, departmentFilter, categoryFilter]);

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics, error: metricsError } = useQuery({
    queryKey: ['risk-metrics', filters],
    queryFn: () => onFetchMetrics?.(filters) || Promise.resolve({} as RiskMetrics),
    enabled: !!onFetchMetrics,
  });

  const { data: heatMapData } = useQuery({
    queryKey: ['risk-heatmap', filters],
    queryFn: () => onFetchHeatMapData?.(filters) || Promise.resolve([]),
    enabled: !!onFetchHeatMapData && visibleWidgets.includes('heatMap'),
  });

  const { data: trendData } = useQuery({
    queryKey: ['risk-trend', { ...filters, period: trendPeriod }],
    queryFn: () => onFetchTrendData?.({ ...filters, period: trendPeriod }) || Promise.resolve([]),
    enabled: !!onFetchTrendData && visibleWidgets.includes('trend'),
  });

  const { data: categoryData } = useQuery({
    queryKey: ['risk-categories', filters],
    queryFn: () => onFetchCategoryData?.(filters) || Promise.resolve([]),
    enabled: !!onFetchCategoryData && visibleWidgets.includes('categories'),
  });

  const { data: mitigations } = useQuery({
    queryKey: ['risk-mitigations', { ...filters, status: mitigationStatusFilter }],
    queryFn: () => onFetchMitigations?.({ ...filters, status: mitigationStatusFilter }) || Promise.resolve([]),
    enabled: !!onFetchMitigations && visibleWidgets.includes('mitigations'),
  });

  const { data: alerts } = useQuery({
    queryKey: ['risk-alerts', { ...filters, type: alertTypeFilter }],
    queryFn: () => onFetchAlerts?.({ ...filters, type: alertTypeFilter }) || Promise.resolve([]),
    enabled: !!onFetchAlerts && visibleWidgets.includes('alerts'),
  });

  const { data: complianceData } = useQuery({
    queryKey: ['risk-compliance', filters],
    queryFn: () => onFetchComplianceData?.(filters) || Promise.resolve(null),
    enabled: !!onFetchComplianceData && visibleWidgets.includes('compliance'),
  });

  const { data: forecastData } = useQuery({
    queryKey: ['risk-forecast', forecastPeriod],
    queryFn: () => onFetchForecastData?.(forecastPeriod) || Promise.resolve(null),
    enabled: !!onFetchForecastData && visibleWidgets.includes('forecast'),
  });

  const updateMitigationMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      onUpdateMitigation?.(id, updates) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Mitigation updated successfully');
      refetchMetrics();
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (id: string) => onAcknowledgeAlert?.(id) || Promise.resolve(),
    onSuccess: () => setStatusMessage('Alert acknowledged'),
  });

  const generateReportMutation = useMutation({
    mutationFn: ({ type, filters }: { type: string; filters: any }) =>
      onGenerateReport?.(type, filters) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Report generated successfully');
      setShowReportDialog(false);
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: ({ format, data }: { format: 'pdf' | 'excel' | 'csv'; data: any }) =>
      onExportData?.(format, data) || Promise.resolve(),
    onSuccess: () => setStatusMessage('Data exported successfully'),
  });

  const saveConfigMutation = useMutation({
    mutationFn: (config: any) => onSaveConfiguration?.(config) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Configuration saved');
      setShowConfigDialog(false);
    },
  });

  const handleDateRangeChange = useCallback((option: string) => {
    setSelectedDateOption(option);
    let newRange: { start: Date; end: Date };
    
    switch (option) {
      case 'last-quarter':
        newRange = {
          start: startOfQuarter(subDays(new Date(), 90)),
          end: endOfDay(new Date()),
        };
        break;
      case 'last-30-days':
        newRange = {
          start: startOfDay(subDays(new Date(), 30)),
          end: endOfDay(new Date()),
        };
        break;
      default:
        newRange = dateRange;
    }
    
    setDateRange(newRange);
  }, [dateRange]);

  const handleMitigationStatusChange = useCallback((id: string, status: string) => {
    updateMitigationMutation.mutate({ id, updates: { status } });
  }, [updateMitigationMutation]);

  const handleExport = useCallback((format: 'pdf' | 'excel' | 'csv') => {
    const data = {
      metrics,
      heatMapData,
      trendData,
      categoryData,
      mitigations,
      alerts,
      complianceData,
    };
    exportDataMutation.mutate({ format, data });
    setShowExportMenu(false);
  }, [metrics, heatMapData, trendData, categoryData, mitigations, alerts, complianceData, exportDataMutation]);

  const handleGenerateReport = useCallback(() => {
    generateReportMutation.mutate({ type: reportType, filters });
  }, [reportType, filters, generateReportMutation]);

  const handleSaveConfig = useCallback(() => {
    const config = {
      visibleWidgets,
      refreshInterval,
      filters,
    };
    saveConfigMutation.mutate(config);
  }, [visibleWidgets, refreshInterval, filters, saveConfigMutation]);

  const getHeatCellColor = useCallback((level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  }, []);

  const getStatusBadgeColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'planned': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getSeverityBadgeColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const unacknowledgedCount = useMemo(() => {
    return alerts?.filter(a => !a.acknowledged).length || 0;
  }, [alerts]);

  const filteredMitigations = useMemo(() => {
    if (!mitigations) return [];
    if (mitigationStatusFilter === 'all') return mitigations;
    return mitigations.filter(m => m.status === mitigationStatusFilter);
  }, [mitigations, mitigationStatusFilter]);

  const isLoading = externalLoading || metricsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div role="progressbar" className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading risk analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalRisks === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600">No risks found</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="risk-analytics-dashboard"
      className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}
      role="main"
      aria-label="Risk Analytics Dashboard"
    >
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <h1 className="text-2xl font-bold text-gray-900">Risk Analytics Dashboard</h1>
            <div className="flex items-center space-x-3">
              <select
                value={selectedDateOption}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                aria-label="Date range"
              >
                <option value="last-30-days">Last 30 days</option>
                <option value="last-quarter">Last Quarter</option>
                <option value="custom">Custom</option>
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                aria-label="Department"
              >
                <option value="">All Departments</option>
                <option value="Legal">Legal</option>
                <option value="IT">IT</option>
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                aria-label="Risk category"
              >
                <option value="">All Categories</option>
                <option value="Financial">Financial</option>
                <option value="Operational">Operational</option>
                <option value="Compliance">Compliance</option>
                <option value="Strategic">Strategic</option>
              </select>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={compareWithPrevious}
                  onChange={(e) => setCompareWithPrevious(e.target.checked)}
                  className="rounded"
                  aria-label="Compare with previous period"
                />
                <span className="text-sm">Compare</span>
              </label>
              <button
                onClick={() => refetchMetrics()}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Refresh"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Export"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                    <button
                      onClick={() => handleExport('pdf')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Export to PDF
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Export to Excel
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Export to CSV
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowReportDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Generate Report"
              >
                <DocumentChartBarIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowScheduleDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Schedule"
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowConfigDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Configure"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search risks..."
                  className="pl-10 pr-3 py-1 w-full border rounded-md text-sm"
                />
              </div>
            </div>
            {compareWithPrevious && (
              <div className="text-sm text-gray-500">
                vs. Previous Period
                <select
                  value={compareBy}
                  onChange={(e) => setCompareBy(e.target.value)}
                  className="ml-2 px-2 py-1 border rounded text-sm"
                  aria-label="Compare by"
                >
                  <option value="period">Period</option>
                  <option value="department">Department</option>
                </select>
              </div>
            )}
            {refreshInterval > 0 && (
              <span className="text-sm text-gray-500">Auto-refresh: {refreshInterval}s</span>
            )}
          </div>
        </div>
      </div>

      {metricsError && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Failed to load metrics</p>
          <button
            onClick={() => refetchMetrics()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      )}

      {visibleWidgets.includes('metrics') && (
        <div 
          className="px-4 sm:px-6 lg:px-8 py-6"
          role="region"
          aria-label="Risk Metrics"
        >
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <div data-testid="metric-total-risks" className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-600">Total Risks</p>
              <p className="text-2xl font-bold mt-1">{metrics?.totalRisks || 0}</p>
              <div data-testid="trend-indicator" className="mt-2 text-sm">
                {metrics?.riskTrend === 'decreasing' ? (
                  <span className="text-green-600 flex items-center">
                    <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
                    Decreasing
                  </span>
                ) : metrics?.riskTrend === 'increasing' ? (
                  <span className="text-red-600 flex items-center">
                    <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                    Increasing
                  </span>
                ) : (
                  <span className="text-gray-600">Stable</span>
                )}
              </div>
              {compareWithPrevious && <span className="text-xs text-gray-500">-5%</span>}
            </div>
            <div data-testid="metric-critical-risks" className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-600">Critical Risks</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{metrics?.criticalRisks || 0}</p>
            </div>
            <div data-testid="metric-compliance-score" className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-600">Compliance Score</p>
              <div data-testid="compliance-gauge" className="mt-2">
                <p className="text-2xl font-bold">{metrics?.complianceScore || 0}%</p>
              </div>
            </div>
            <div data-testid="metric-average-score" className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-600">Average Risk Score</p>
              <p className="text-2xl font-bold mt-1">{metrics?.averageRiskScore?.toFixed(1) || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div 
        data-testid="widgets-container"
        className={`px-4 sm:px-6 lg:px-8 py-6 ${isMobile ? 'flex-col space-y-6' : 'grid gap-6 lg:grid-cols-2'}`}
      >
        {visibleWidgets.includes('heatMap') && (
          <div 
            data-testid="risk-heat-map"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Risk Heat Map</h3>
            <div className="grid grid-cols-4 gap-2">
              {heatMapData?.slice(0, 8).map((cell, index) => (
                <div
                  key={index}
                  data-testid={`heat-cell-${cell.riskLevel}`}
                  className={`p-3 rounded cursor-pointer ${getHeatCellColor(cell.riskLevel)} text-white text-center`}
                  onClick={() => onDrillDown?.('heat-map', cell)}
                  onKeyDown={(e) => e.key === 'Enter' && onDrillDown?.('heat-map', cell)}
                  tabIndex={0}
                  role="button"
                  onMouseEnter={() => {}}
                >
                  <div className="text-xs">{cell.category}</div>
                  <div className="text-xs">{cell.department}</div>
                  <div className="font-bold">{cell.count}</div>
                </div>
              ))}
            </div>
            <div role="tooltip" className="hidden">Tooltip content</div>
          </div>
        )}

        {visibleWidgets.includes('trend') && (
          <div 
            data-testid="risk-trend-chart"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Risk Trend Analysis</h3>
              <div className="flex items-center space-x-2">
                <select
                  value={trendPeriod}
                  onChange={(e) => setTrendPeriod(e.target.value)}
                  className="px-2 py-1 border rounded text-sm"
                  aria-label="Trend period"
                >
                  <option value="3-months">3 months</option>
                  <option value="6-months">6 months</option>
                  <option value="12-months">12 months</option>
                </select>
                <button
                  onClick={() => setChartView(chartView === 'grouped' ? 'stacked' : 'grouped')}
                  className="px-2 py-1 border rounded text-sm"
                  aria-label="Stacked view"
                >
                  {chartView === 'grouped' ? 'Stacked' : 'Grouped'}
                </button>
              </div>
            </div>
            <div data-testid={`chart-view-${chartView}`} className="h-48 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleWidgets.includes('categories') && (
          <div 
            data-testid="risk-categories"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Risk by Category</h3>
            <div className="space-y-3">
              {categoryData?.map((category) => (
                <div
                  key={category.name}
                  data-testid={`category-${category.name}`}
                  className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onDrillDown?.('category', { name: category.name })}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-gray-500">{category.percentage}%</span>
                      <span className="text-sm text-gray-500">Avg: {category.averageScore.toFixed(1)}</span>
                    </div>
                    <div data-testid={`trend-${category.trend}`}>
                      {category.trend === 'up' ? (
                        <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
                      ) : category.trend === 'down' ? (
                        <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleWidgets.includes('mitigations') && (
          <div 
            data-testid="mitigation-tracking"
            className="bg-white p-6 rounded-lg shadow-sm border lg:col-span-2"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Mitigation Tracking</h3>
              <select
                value={mitigationStatusFilter}
                onChange={(e) => setMitigationStatusFilter(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredMitigations?.map((mitigation) => (
                <div key={mitigation.id} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{mitigation.riskTitle}</p>
                      <p className="text-sm text-gray-600 mt-1">{mitigation.action}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getStatusBadgeColor(mitigation.status)}`}>
                          {mitigation.status === 'in_progress' ? 'In Progress' : 
                           mitigation.status === 'overdue' ? 'Overdue' :
                           mitigation.status === 'planned' ? 'Planned' : 'Completed'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs capitalize ${
                          mitigation.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          mitigation.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {mitigation.priority === 'urgent' ? 'Urgent' : mitigation.priority === 'high' ? 'High' : mitigation.priority}
                        </span>
                        <span className="text-xs text-gray-500">{mitigation.owner}</span>
                        <span className="text-xs text-gray-500">Due: {format(new Date(mitigation.dueDate), 'MMM d')}</span>
                      </div>
                    </div>
                    <select
                      value={mitigation.status}
                      onChange={(e) => handleMitigationStatusChange(mitigation.id, e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                      aria-label="Status"
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleWidgets.includes('alerts') && (
          <div 
            data-testid="alert-summary"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Alert Summary
                <span data-testid="unacknowledged-count" className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                  {unacknowledgedCount}
                </span>
              </h3>
              <select
                value={alertTypeFilter}
                onChange={(e) => setAlertTypeFilter(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                aria-label="Alert type"
              >
                <option value="all">All Types</option>
                <option value="critical_risk">Critical Risk</option>
                <option value="compliance_breach">Compliance</option>
                <option value="sla_violation">SLA</option>
              </select>
            </div>
            <div className="space-y-3">
              {alerts?.filter(a => alertTypeFilter === 'all' || a.type === alertTypeFilter).map((alert) => (
                <div key={alert.id} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getSeverityBadgeColor(alert.severity)}`}>
                          {alert.severity === 'critical' ? 'Critical' :
                           alert.severity === 'high' ? 'High' :
                           alert.severity === 'medium' ? 'Medium' : 'Low'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(alert.timestamp), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        aria-label="Acknowledge"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleWidgets.includes('compliance') && complianceData && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">Compliance Score</h3>
            <div className="text-center">
              <div data-testid="compliance-gauge" className="text-4xl font-bold">
                {complianceData.current || metrics?.complianceScore}%
              </div>
              {complianceData.trend && (
                <p className="text-sm text-gray-600 mt-2">
                  {complianceData.trend === 'improving' ? 'Improving' : 'Declining'}
                </p>
              )}
              {complianceData.target && (
                <p className="text-sm text-gray-500 mt-1">Target: {complianceData.target}%</p>
              )}
            </div>
            {complianceData.breakdown && (
              <div className="mt-4 space-y-2">
                {complianceData.breakdown.map((item: any) => (
                  <div key={item.area} className="flex justify-between text-sm">
                    <span>{item.area}: {item.score}%</span>
                    <span className={item.status === 'compliant' ? 'text-green-600' : 'text-yellow-600'}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleWidgets.includes('forecast') && forecastData && (
          <div 
            data-testid="risk-forecast"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Risk Forecasting</h3>
              <select
                value={forecastPeriod}
                onChange={(e) => setForecastPeriod(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                aria-label="Forecast period"
              >
                <option value="3-months">3 months</option>
                <option value="6-months">6 months</option>
                <option value="12-months">12 months</option>
              </select>
            </div>
            {forecastData.predictions && (
              <div className="space-y-2">
                {forecastData.predictions.map((pred: any) => (
                  <div key={pred.month} className="flex justify-between text-sm">
                    <span>{pred.month}: {pred.predicted} risks</span>
                    <span className="text-gray-500">{pred.confidence}% confidence</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleWidgets.includes('actions') && (
          <div 
            data-testid="action-items"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Action Items</h3>
              <button
                onClick={() => setShowAddActionDialog(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                aria-label="Add Action"
              >
                <PlusIcon className="w-4 h-4 inline mr-1" />
                Add
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div data-testid="actions-pending" className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">5</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div data-testid="actions-in-progress" className="text-center p-3 bg-blue-50 rounded">
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-gray-600">In Progress</p>
              </div>
              <div data-testid="actions-completed" className="text-center p-3 bg-green-50 rounded">
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-gray-600">Completed</p>
              </div>
            </div>
          </div>
        )}

        {compareBy === 'department' && compareWithPrevious && (
          <div data-testid="department-comparison" className="bg-white p-6 rounded-lg shadow-sm border lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Department Comparison</h3>
            <div className="h-48 flex items-center justify-center text-gray-400">
              Department comparison visualization
            </div>
          </div>
        )}
      </div>

      {showReportDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Generate Report</h2>
            </div>
            <div className="p-6">
              <label htmlFor="report-type" className="block text-sm font-medium mb-1">Report type</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="executive-summary">Executive Summary</option>
                <option value="detailed-analysis">Detailed Analysis</option>
                <option value="mitigation-status">Mitigation Status</option>
              </select>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowReportDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                aria-label="Generate"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduleDialog && (
        <div data-testid="schedule-dialog" className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Schedule Report</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600">Report scheduling configuration</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfigDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Dashboard Configuration</h2>
            </div>
            <div className="p-6">
              <h3 className="font-medium mb-4">Visible Widgets</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleWidgets.includes('heatMap')}
                    onChange={() => setVisibleWidgets(prev =>
                      prev.includes('heatMap')
                        ? prev.filter(w => w !== 'heatMap')
                        : [...prev, 'heatMap']
                    )}
                    className="rounded"
                  />
                  <span>Show Heat Map</span>
                </label>
              </div>
              <div className="mt-6">
                <label htmlFor="refresh-interval" className="block text-sm font-medium mb-1">Refresh interval</label>
                <select
                  id="refresh-interval"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="0">Disabled</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowConfigDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                aria-label="Save Configuration"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddActionDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Add Action Item</h2>
            </div>
            <div className="p-6">
              <label htmlFor="action-title" className="block text-sm font-medium mb-1">Action title</label>
              <input
                id="action-title"
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Review critical risks"
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowAddActionDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAddActionDialog(false);
                  setStatusMessage('Action item added');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                aria-label="Save"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 px-4 py-2 bg-gray-800 text-white rounded-md shadow-lg"
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
};