import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay, startOfQuarter, endOfQuarter } from 'date-fns';
import {
  ChartBarIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

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

export const ContractAnalyticsView: React.FC<ContractAnalyticsViewProps> = ({
  dateRange: initialDateRange,
  departmentFilter: initialDepartment,
  contractTypeFilter: initialContractType,
  isLoading: externalLoading = false,
  currentUser,
  onFetchMetrics,
  onFetchVolumeData,
  onFetchStatusDistribution,
  onFetchValueByCategory,
  onFetchRiskDistribution,
  onFetchCycleTimeAnalysis,
  onFetchRenewalForecast,
  onFetchVendorPerformance,
  onFetchDepartmentBreakdown,
  onFetchObligationTracking,
  onExportAnalytics,
  onDrillDown,
  onSaveView,
  onScheduleReport,
}) => {
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: startOfDay(subDays(new Date(), 90)),
      end: endOfDay(new Date()),
    }
  );
  const [selectedDateOption, setSelectedDateOption] = useState('last-quarter');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartment || '');
  const [contractTypeFilter, setContractTypeFilter] = useState(initialContractType || '');
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const [forecastPeriod, setForecastPeriod] = useState('6-months');
  const [obligationType, setObligationType] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [chartType, setChartType] = useState<Record<string, string>>({
    volume: 'bar',
    status: 'pie',
    value: 'bar',
    risk: 'donut',
    cycleTime: 'line',
    renewal: 'area',
    department: 'bar',
  });
  const [visibleCharts, setVisibleCharts] = useState([
    'volume', 'status', 'value', 'risk', 'cycleTime', 'renewal', 'vendor', 'department', 'obligations'
  ]);
  const [sortBy, setSortBy] = useState('value');
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'weekly',
    recipients: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const filters = useMemo(() => ({
    dateRange,
    department: departmentFilter,
    contractType: contractTypeFilter,
  }), [dateRange, departmentFilter, contractTypeFilter]);

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics, error: metricsError } = useQuery({
    queryKey: ['contract-metrics', filters],
    queryFn: () => onFetchMetrics?.(filters) || Promise.resolve({} as ContractMetrics),
    enabled: !!onFetchMetrics,
  });

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ['contract-volume', filters],
    queryFn: () => onFetchVolumeData?.(filters) || Promise.resolve([]),
    enabled: !!onFetchVolumeData && visibleCharts.includes('volume'),
  });

  const { data: statusData } = useQuery({
    queryKey: ['status-distribution', filters],
    queryFn: () => onFetchStatusDistribution?.(filters) || Promise.resolve([]),
    enabled: !!onFetchStatusDistribution && visibleCharts.includes('status'),
  });

  const { data: valueData } = useQuery({
    queryKey: ['value-category', filters],
    queryFn: () => onFetchValueByCategory?.(filters) || Promise.resolve([]),
    enabled: !!onFetchValueByCategory && visibleCharts.includes('value'),
  });

  const { data: riskData } = useQuery({
    queryKey: ['risk-distribution', filters],
    queryFn: () => onFetchRiskDistribution?.(filters) || Promise.resolve([]),
    enabled: !!onFetchRiskDistribution && visibleCharts.includes('risk'),
  });

  const { data: cycleTimeData } = useQuery({
    queryKey: ['cycle-time', filters],
    queryFn: () => onFetchCycleTimeAnalysis?.(filters) || Promise.resolve([]),
    enabled: !!onFetchCycleTimeAnalysis && visibleCharts.includes('cycleTime'),
  });

  const { data: renewalData } = useQuery({
    queryKey: ['renewal-forecast', { ...filters, period: forecastPeriod }],
    queryFn: () => onFetchRenewalForecast?.({ ...filters, period: forecastPeriod }) || Promise.resolve([]),
    enabled: !!onFetchRenewalForecast && visibleCharts.includes('renewal'),
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendor-performance', filters],
    queryFn: () => onFetchVendorPerformance?.(filters) || Promise.resolve([]),
    enabled: !!onFetchVendorPerformance && visibleCharts.includes('vendor'),
  });

  const { data: departmentData } = useQuery({
    queryKey: ['department-breakdown', filters],
    queryFn: () => onFetchDepartmentBreakdown?.(filters) || Promise.resolve([]),
    enabled: !!onFetchDepartmentBreakdown && visibleCharts.includes('department'),
  });

  const { data: obligationData } = useQuery({
    queryKey: ['obligation-tracking', { ...filters, type: obligationType }],
    queryFn: () => onFetchObligationTracking?.({ ...filters, type: obligationType }) || Promise.resolve([]),
    enabled: !!onFetchObligationTracking && visibleCharts.includes('obligations'),
  });

  const exportMutation = useMutation({
    mutationFn: ({ format, data }: { format: 'pdf' | 'excel' | 'csv'; data: any }) =>
      onExportAnalytics?.(format, data) || Promise.resolve(),
    onSuccess: () => setStatusMessage('Analytics exported successfully'),
    onError: () => setStatusMessage('Export failed'),
  });

  const saveViewMutation = useMutation({
    mutationFn: (config: any) => onSaveView?.(config) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('View saved successfully');
      setShowCustomizeDialog(false);
    },
  });

  const scheduleReportMutation = useMutation({
    mutationFn: (schedule: any) => onScheduleReport?.(schedule) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Report scheduled successfully');
      setShowScheduleDialog(false);
    },
  });

  const handleDateRangeChange = useCallback((option: string) => {
    setSelectedDateOption(option);
    let newRange: { start: Date; end: Date };
    
    switch (option) {
      case 'last-quarter':
        newRange = {
          start: startOfQuarter(subDays(new Date(), 90)),
          end: endOfQuarter(subDays(new Date(), 90)),
        };
        break;
      case 'this-quarter':
        newRange = {
          start: startOfQuarter(new Date()),
          end: endOfQuarter(new Date()),
        };
        break;
      case 'last-30-days':
        newRange = {
          start: startOfDay(subDays(new Date(), 30)),
          end: endOfDay(new Date()),
        };
        break;
      case 'custom':
        return;
      default:
        newRange = dateRange;
    }
    
    setDateRange(newRange);
  }, [dateRange]);

  const handleCustomDateApply = useCallback(() => {
    if (customDateStart && customDateEnd) {
      setDateRange({
        start: startOfDay(new Date(customDateStart)),
        end: endOfDay(new Date(customDateEnd)),
      });
    }
  }, [customDateStart, customDateEnd]);

  const handleExport = useCallback((format: 'pdf' | 'excel' | 'csv') => {
    const data = {
      metrics,
      volumeData,
      statusData,
      valueData,
      riskData,
      cycleTimeData,
      renewalData,
      vendorData,
      departmentData,
      obligationData,
    };
    exportMutation.mutate({ format, data });
    setShowExportMenu(false);
  }, [metrics, volumeData, statusData, valueData, riskData, cycleTimeData, renewalData, vendorData, departmentData, obligationData, exportMutation]);

  const handleSaveView = useCallback(() => {
    const config = {
      visibleCharts,
      chartType,
      filters,
    };
    saveViewMutation.mutate(config);
  }, [visibleCharts, chartType, filters, saveViewMutation]);

  const handleScheduleSave = useCallback(() => {
    const schedule = {
      ...scheduleConfig,
      recipients: scheduleConfig.recipients.split(',').map(r => r.trim()).filter(Boolean),
      filters,
    };
    scheduleReportMutation.mutate(schedule);
  }, [scheduleConfig, filters, scheduleReportMutation]);

  const handleToggleChart = useCallback((chart: string) => {
    setVisibleCharts(prev =>
      prev.includes(chart)
        ? prev.filter(c => c !== chart)
        : [...prev, chart]
    );
  }, []);

  const formatCurrency = useCallback((value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  const formatNumber = useCallback((value: number) => {
    return value.toLocaleString();
  }, []);

  const sortedVendorData = useMemo(() => {
    if (!vendorData) return [];
    return [...vendorData].sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return b.totalValue - a.totalValue;
        case 'count':
          return b.contractCount - a.contractCount;
        case 'rating':
          return b.averageRating - a.averageRating;
        default:
          return 0;
      }
    });
  }, [vendorData, sortBy]);

  const upcomingRenewals = useMemo(() => {
    if (!renewalData) return 0;
    return renewalData.reduce((sum, item) => sum + item.value, 0);
  }, [renewalData]);

  const isLoading = externalLoading || metricsLoading || volumeLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div role="progressbar" className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalContracts === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600">No contracts found</p>
          <p className="mt-2 text-gray-500">Start by creating contracts</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="contract-analytics-view"
      className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}
      role="main"
      aria-label="Contract Analytics"
    >
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <h1 className="text-2xl font-bold text-gray-900">Contract Analytics</h1>
            <div className="flex items-center space-x-3">
              <select
                value={selectedDateOption}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                aria-label="Date range"
              >
                <option value="last-30-days">Last 30 days</option>
                <option value="this-quarter">This Quarter</option>
                <option value="last-quarter">Last Quarter</option>
                <option value="custom">Custom</option>
              </select>
              {selectedDateOption === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="px-2 py-1 border rounded-md text-sm"
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="px-2 py-1 border rounded-md text-sm"
                    aria-label="End date"
                  />
                  <button
                    onClick={handleCustomDateApply}
                    className="px-3 py-1 bg-primary text-white rounded-md text-sm hover:bg-primary-dark"
                    aria-label="Apply"
                  >
                    Apply
                  </button>
                </>
              )}
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
                <option value="Operations">Operations</option>
              </select>
              <select
                value={contractTypeFilter}
                onChange={(e) => setContractTypeFilter(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                aria-label="Contract type"
              >
                <option value="">All Types</option>
                <option value="Service">Service</option>
                <option value="Supply">Supply</option>
                <option value="NDA">NDA</option>
                <option value="Employment">Employment</option>
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
                      Export as PDF
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Export as Excel
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Export as CSV
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowScheduleDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Schedule"
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCustomizeDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Customize View"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          {compareWithPrevious && (
            <div className="mt-2 text-sm text-gray-500">vs. Previous Period</div>
          )}
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

      <div 
        className="px-4 sm:px-6 lg:px-8 py-6"
        role="region"
        aria-label="Metrics Summary"
      >
        <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
          <div data-testid="metric-total-contracts" className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Total Contracts</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(metrics?.totalContracts || 0)}</p>
          </div>
          <div data-testid="metric-active-contracts" className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Active Contracts</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(metrics?.activeContracts || 0)}</p>
          </div>
          <div data-testid="metric-average-value" className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Average Value</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(metrics?.averageValue || 0)}</p>
          </div>
          <div data-testid="metric-renewal-rate" className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-600">Renewal Rate</p>
            <p className="text-2xl font-bold mt-1">{metrics?.renewalRate || 0}%</p>
          </div>
        </div>
      </div>

      <div 
        data-testid="charts-container"
        className={`px-4 sm:px-6 lg:px-8 py-6 ${isMobile ? 'flex-col' : 'grid gap-6 lg:grid-cols-2'}`}
        role="region"
        aria-label="Charts"
      >
        {visibleCharts.includes('volume') && (
          <div 
            data-testid="chart-contract-volume"
            className="bg-white p-6 rounded-lg shadow-sm border"
            onClick={() => onDrillDown?.('contract-volume', volumeData)}
            onKeyDown={(e) => e.key === 'Enter' && onDrillDown?.('contract-volume', volumeData)}
            tabIndex={0}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contract Volume</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChartType(prev => ({ ...prev, volume: prev.volume === 'bar' ? 'line' : 'bar' }));
                }}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Chart type"
              >
                {chartType.volume === 'bar' ? <PresentationChartLineIcon className="w-5 h-5" /> : <ChartBarIcon className="w-5 h-5" />}
              </button>
            </div>
            <div 
              data-testid={`chart-type-${chartType.volume}`}
              className="h-64 flex items-center justify-center text-gray-400"
              role="tooltip"
              onMouseEnter={() => {}}
            >
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('status') && (
          <div 
            data-testid="chart-status-distribution"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
            <div className="h-64 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
            <div data-testid="status-legend" className="mt-4 flex justify-center space-x-4">
              <div 
                data-testid="legend-active"
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => onDrillDown?.('status', { status: 'Active' })}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Active</span>
                <span className="text-sm font-semibold">74.2%</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm">Expired</span>
                <span className="text-sm font-semibold">18.6%</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Pending</span>
                <span className="text-sm font-semibold">7.2%</span>
              </div>
            </div>
          </div>
        )}

        {visibleCharts.includes('value') && (
          <div 
            data-testid="chart-value-category"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Value by Category</h3>
              <button
                onClick={() => {}}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Sort"
              >
                <FunnelIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {valueData?.slice(0, 2).map((item, index) => (
                <div key={index} data-testid={`category-item-${index}`} className="flex justify-between items-center">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
                    <span className="text-sm text-gray-500">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-48 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('risk') && visibleCharts.includes('risk') && (
          <div 
            data-testid="chart-risk-distribution"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Risk Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div data-testid="risk-low" className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
                <span className="text-sm">Low Risk</span>
                <span className="text-sm font-semibold">1,456 contracts</span>
                <span className="text-sm text-gray-500">59.3%</span>
              </div>
              <div className="flex items-center space-x-3">
                <div data-testid="risk-medium" className="w-4 h-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                <span className="text-sm">Medium Risk</span>
              </div>
              <div className="flex items-center space-x-3">
                <div data-testid="risk-high" className="w-4 h-4 rounded" style={{ backgroundColor: '#EF4444' }}></div>
                <span className="text-sm">High Risk</span>
              </div>
            </div>
            <div className="h-48 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('cycleTime') && (
          <div 
            data-testid="chart-cycle-time"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Cycle Time Analysis</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Average Cycle Time</p>
              <p className="text-2xl font-bold">{metrics?.averageCycleTime || 0} days</p>
              <div data-testid="cycle-time-trend" className="text-green-600">
                <ArrowTrendingDownIcon className="w-4 h-4 inline" />
              </div>
            </div>
            <div className="h-48 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('renewal') && (
          <div 
            data-testid="chart-renewal-forecast"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Renewal Forecast</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Due for renewal in next 6 months</p>
              <p className="text-2xl font-bold">320 contracts</p>
              <p className="text-sm text-gray-600 mt-2">Renewal Rate</p>
              <p className="text-xl font-bold">{metrics?.renewalRate || 0}%</p>
            </div>
            <select
              value={forecastPeriod}
              onChange={(e) => setForecastPeriod(e.target.value)}
              className="mb-2 px-2 py-1 border rounded text-sm"
              aria-label="Forecast period"
            >
              <option value="3-months">3 months</option>
              <option value="6-months">6 months</option>
              <option value="12-months">12 months</option>
            </select>
            <div className="h-32 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('vendor') && (
          <div 
            data-testid="vendor-performance-table"
            className={`bg-white p-6 rounded-lg shadow-sm border lg:col-span-2 ${isMobile ? 'mobile-table' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-4">Vendor Performance</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left py-2 cursor-pointer hover:text-primary"
                    onClick={() => setSortBy('name')}
                  >
                    Vendor
                  </th>
                  <th 
                    className="text-right py-2 cursor-pointer hover:text-primary"
                    onClick={() => setSortBy('count')}
                  >
                    Contracts
                  </th>
                  <th 
                    className="text-right py-2 cursor-pointer hover:text-primary"
                    onClick={() => setSortBy('value')}
                  >
                    Total Value
                  </th>
                  <th className="text-right py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {sortedVendorData?.slice(0, 3).map((vendor) => (
                  <tr 
                    key={vendor.vendorId}
                    className={`border-b hover:bg-gray-50 ${vendor.issues > 3 ? 'bg-yellow-50' : ''}`}
                  >
                    <td 
                      className="py-2 cursor-pointer text-primary hover:text-primary-dark"
                      onClick={() => onDrillDown?.('vendor', { vendorId: vendor.vendorId })}
                    >
                      {vendor.vendorName}
                    </td>
                    <td className="text-right py-2">{vendor.contractCount} contracts</td>
                    <td className="text-right py-2">{formatCurrency(vendor.totalValue)}</td>
                    <td className="text-right py-2">{vendor.averageRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCharts.includes('department') && (
          <div 
            data-testid="chart-department-breakdown"
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Legal: 892</span>
                <span className="text-sm text-gray-500">36.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">IT: 623</span>
                <span className="text-sm text-gray-500">25.4%</span>
              </div>
            </div>
            <div className="h-48 flex items-center justify-center text-gray-400">
              Chart visualization placeholder
            </div>
          </div>
        )}

        {visibleCharts.includes('obligations') && (
          <div 
            data-testid="obligation-tracking"
            className="bg-white p-6 rounded-lg shadow-sm border lg:col-span-2"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Obligation Tracking</h3>
              <select
                value={obligationType}
                onChange={(e) => setObligationType(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
                aria-label="Obligation type"
              >
                <option value="all">All Types</option>
                <option value="Payment">Payment</option>
                <option value="Delivery">Delivery</option>
                <option value="Review">Review</option>
              </select>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">Payment due</p>
                  <p className="text-sm text-gray-600">Jul 15, 2024</p>
                </div>
                <p className="font-semibold">$50,000</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <div>
                  <p className="font-medium">Review</p>
                  <p className="text-sm text-gray-600">Jul 10, 2024</p>
                </div>
                <span className="text-red-600 text-sm">Overdue</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {showScheduleDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Schedule Report</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="frequency" className="block text-sm font-medium mb-1">Frequency</label>
                <select
                  id="frequency"
                  value={scheduleConfig.frequency}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="recipients" className="block text-sm font-medium mb-1">Recipients</label>
                <input
                  id="recipients"
                  type="text"
                  value={scheduleConfig.recipients}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, recipients: e.target.value }))}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSave}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                aria-label="Save Schedule"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomizeDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Customize View</h2>
            </div>
            <div className="p-6">
              <h3 className="font-medium mb-4">Toggle Charts</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleCharts.includes('vendor')}
                    onChange={() => handleToggleChart('vendor')}
                    className="rounded"
                  />
                  <span>Show Vendor Performance</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleCharts.includes('risk')}
                    onChange={() => handleToggleChart('risk')}
                    className="rounded"
                  />
                  <span>Show Risk Distribution</span>
                </label>
              </div>
              <div className="mt-6">
                <h3 className="font-medium mb-4">Chart Order</h3>
                <div className="space-y-2">
                  {visibleCharts.map((chart) => (
                    <div key={chart} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                      <span data-testid="drag-handle" className="cursor-move">☰</span>
                      <span className="capitalize">{chart}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowCustomizeDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                aria-label="Save View"
              >
                Save View
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