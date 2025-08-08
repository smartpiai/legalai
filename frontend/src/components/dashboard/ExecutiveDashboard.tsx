import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import {
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowPathIcon as RefreshIcon,
  ShareIcon,
  ArrowDownTrayIcon as DownloadIcon,
  CogIcon,
  CalendarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  Squares2X2Icon as ViewGridIcon,
  PresentationChartLineIcon,
  PresentationChartBarIcon,
  ChartPieIcon,
  Bars3Icon as MenuIcon,
  XMarkIcon as XIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

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

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  dateRange: initialDateRange,
  refreshInterval = 0,
  isLoading: externalLoading = false,
  currentUser,
  onFetchKPIs,
  onFetchChartData,
  onFetchRecentActivity,
  onExportDashboard,
  onCustomizeLayout,
  onDrillDown,
  onScheduleReport,
  onShareDashboard,
}) => {
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: startOfDay(subDays(new Date(), 30)),
      end: endOfDay(new Date()),
    }
  );
  const [selectedDateOption, setSelectedDateOption] = useState('last-30-days');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(refreshInterval > 0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [visibleWidgets, setVisibleWidgets] = useState(
    currentUser.preferences?.dashboard?.widgets || ['kpi', 'trends', 'activity']
  );
  const [chartTypes, setChartTypes] = useState<Record<string, string>>({
    contractVolume: 'line',
    valueDistribution: 'bar',
    riskTrends: 'line',
    approvalTime: 'bar',
  });
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'daily',
    time: '09:00',
    dayOfWeek: 'monday',
    recipients: '',
  });
  const [shareRecipients, setShareRecipients] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [tooltipContent, setTooltipContent] = useState<{ id: string; content: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const { data: kpiData, isLoading: kpisLoading, refetch: refetchKPIs, error: kpiError } = useQuery({
    queryKey: ['dashboard-kpis', dateRange],
    queryFn: () => onFetchKPIs?.(dateRange) || Promise.resolve({} as KPIData),
    enabled: !!onFetchKPIs,
  });

  const { data: contractVolumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ['chart-contract-volume', dateRange],
    queryFn: () => onFetchChartData?.('contractVolume', dateRange) || Promise.resolve([]),
    enabled: !!onFetchChartData && visibleWidgets.includes('trends'),
  });

  const { data: valueDistributionData } = useQuery({
    queryKey: ['chart-value-distribution', dateRange],
    queryFn: () => onFetchChartData?.('valueDistribution', dateRange) || Promise.resolve([]),
    enabled: !!onFetchChartData && visibleWidgets.includes('trends'),
  });

  const { data: riskTrendsData } = useQuery({
    queryKey: ['chart-risk-trends', dateRange],
    queryFn: () => onFetchChartData?.('riskTrends', dateRange) || Promise.resolve([]),
    enabled: !!onFetchChartData && visibleWidgets.includes('trends'),
  });

  const { data: approvalTimeData } = useQuery({
    queryKey: ['chart-approval-time', dateRange],
    queryFn: () => onFetchChartData?.('approvalTime', dateRange) || Promise.resolve([]),
    enabled: !!onFetchChartData && visibleWidgets.includes('trends'),
  });

  const { data: activityData, isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => onFetchRecentActivity?.(10) || Promise.resolve([]),
    enabled: !!onFetchRecentActivity && visibleWidgets.includes('activity'),
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'excel' | 'png') => onExportDashboard?.(format) || Promise.resolve(),
    onSuccess: () => setStatusMessage('Dashboard exported successfully'),
    onError: () => setStatusMessage('Export failed'),
  });

  const shareMutation = useMutation({
    mutationFn: (recipients: string[]) => onShareDashboard?.(recipients) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Dashboard shared successfully');
      setShowShareDialog(false);
      setShareRecipients('');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (schedule: any) => onScheduleReport?.(schedule) || Promise.resolve(),
    onSuccess: () => {
      setStatusMessage('Report scheduled successfully');
      setShowScheduleDialog(false);
    },
  });

  const layoutMutation = useMutation({
    mutationFn: (layout: any) => onCustomizeLayout?.(layout) || Promise.resolve(),
    onSuccess: () => setStatusMessage('Layout saved successfully'),
  });

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refetchKPIs();
        setLastUpdated(new Date());
      }, refreshInterval);
      return () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      };
    }
  }, [autoRefresh, refreshInterval, refetchKPIs]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setShowMobileMenu(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDateRangeChange = useCallback((option: string) => {
    setSelectedDateOption(option);
    let newRange: { start: Date; end: Date };
    
    switch (option) {
      case 'last-7-days':
        newRange = {
          start: startOfDay(subDays(new Date(), 7)),
          end: endOfDay(new Date()),
        };
        break;
      case 'last-30-days':
        newRange = {
          start: startOfDay(subDays(new Date(), 30)),
          end: endOfDay(new Date()),
        };
        break;
      case 'last-90-days':
        newRange = {
          start: startOfDay(subDays(new Date(), 90)),
          end: endOfDay(new Date()),
        };
        break;
      case 'custom':
        return;
      default:
        newRange = {
          start: startOfDay(subDays(new Date(), 30)),
          end: endOfDay(new Date()),
        };
    }
    
    setDateRange(newRange);
  }, []);

  const handleCustomDateApply = useCallback(() => {
    if (customDateStart && customDateEnd) {
      setDateRange({
        start: startOfDay(new Date(customDateStart)),
        end: endOfDay(new Date(customDateEnd)),
      });
    }
  }, [customDateStart, customDateEnd]);

  const handleKPIClick = useCallback((metric: string, data: any) => {
    if (currentUser.permissions.includes('view_details')) {
      onDrillDown?.(metric, data);
    }
  }, [currentUser.permissions, onDrillDown]);

  const handleChartClick = useCallback((chartType: string, data: any) => {
    if (currentUser.permissions.includes('view_details')) {
      onDrillDown?.(chartType, data);
    }
  }, [currentUser.permissions, onDrillDown]);

  const handleExport = useCallback((format: 'pdf' | 'excel' | 'png') => {
    exportMutation.mutate(format);
    setShowExportMenu(false);
  }, [exportMutation]);

  const handleShare = useCallback(() => {
    const recipients = shareRecipients.split(',').map(r => r.trim()).filter(Boolean);
    if (recipients.length > 0) {
      shareMutation.mutate(recipients);
    }
  }, [shareRecipients, shareMutation]);

  const handleScheduleSave = useCallback(() => {
    const schedule = {
      ...scheduleConfig,
      recipients: scheduleConfig.recipients.split(',').map(r => r.trim()).filter(Boolean),
    };
    scheduleMutation.mutate(schedule);
  }, [scheduleConfig, scheduleMutation]);

  const handleToggleWidget = useCallback((widget: string) => {
    setVisibleWidgets(prev => 
      prev.includes(widget) 
        ? prev.filter(w => w !== widget)
        : [...prev, widget]
    );
  }, []);

  const handleSaveLayout = useCallback(() => {
    layoutMutation.mutate({
      widgets: visibleWidgets,
      chartTypes,
    });
    setShowCustomizePanel(false);
  }, [visibleWidgets, chartTypes, layoutMutation]);

  const handleResetLayout = useCallback(() => {
    setVisibleWidgets(['kpi', 'trends', 'activity']);
    setChartTypes({
      contractVolume: 'line',
      valueDistribution: 'bar',
      riskTrends: 'line',
      approvalTime: 'bar',
    });
    layoutMutation.mutate({ layout: 'default' });
  }, [layoutMutation]);

  const formatKPIValue = useCallback((value: number, type: string) => {
    switch (type) {
      case 'currency':
        return value >= 1000000 ? `$${(value / 1000000).toFixed(0)}M` : `$${(value / 1000).toFixed(0)}K`;
      case 'percentage':
        return `${value}%`;
      case 'days':
        return `${value} days`;
      case 'number':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  }, []);

  const getActivityIcon = useCallback((type: ActivityItem['type']) => {
    switch (type) {
      case 'contract_approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'contract_expired':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'risk_identified':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'milestone_reached':
        return <TrendingUpIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <DocumentIcon className="w-5 h-5 text-gray-500" />;
    }
  }, []);

  const getSeverityColor = useCallback((severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const isDataEmpty = useMemo(() => {
    return kpiData && Object.values(kpiData).every(v => v === 0);
  }, [kpiData]);

  const dateRangeDisplay = useMemo(() => {
    if (selectedDateOption === 'custom' && dateRange) {
      return `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    }
    return selectedDateOption.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [selectedDateOption, dateRange]);

  const canExport = currentUser.permissions.includes('export_reports');
  const canCustomize = currentUser.permissions.includes('customize_dashboard');
  const canViewDetails = currentUser.permissions.includes('view_details');

  const isLoading = externalLoading || kpisLoading || volumeLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div role="progressbar" className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="executive-dashboard" 
      className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}
      role="main"
      aria-label="Executive Dashboard"
    >
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              {isMobile && (
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Menu"
                >
                  {showMobileMenu ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
              {dateRange && (
                <span className="text-sm text-gray-500">{dateRangeDisplay}</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label htmlFor="date-range" className="text-sm text-gray-600">Date range</label>
                <select
                  id="date-range"
                  value={selectedDateOption}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm"
                  aria-label="Date range"
                >
                  <option value="last-7-days">Last 7 days</option>
                  <option value="last-30-days">Last 30 days</option>
                  <option value="last-90-days">Last 90 days</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {selectedDateOption === 'custom' && (
                <div className="flex items-center space-x-2">
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
                </div>
              )}
              <button
                onClick={() => {
                  refetchKPIs();
                  setLastUpdated(new Date());
                  setStatusMessage('Dashboard updated');
                }}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Refresh"
              >
                <RefreshIcon className="w-5 h-5" />
              </button>
              {canExport && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="p-2 rounded-md hover:bg-gray-100"
                    aria-label="Export"
                  >
                    <DownloadIcon className="w-5 h-5" />
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
                        onClick={() => handleExport('png')}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        Export as Image
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowShareDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Share"
              >
                <ShareIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowScheduleDialog(true)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Schedule Report"
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
              {canCustomize && (
                <button
                  onClick={() => setShowCustomizePanel(true)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Customize"
                >
                  <CogIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Last updated: {format(lastUpdated, 'MMM d, h:mm a')}</span>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
                aria-label="Auto-refresh"
              />
              <span>{autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}</span>
            </label>
          </div>
        </div>
      </div>

      {kpiError && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Failed to load KPIs</p>
          <button
            onClick={() => refetchKPIs()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      )}

      {isDataEmpty && (
        <div className="mx-4 mt-4 p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600 text-lg">No data available</p>
          <p className="text-gray-500 mt-2">Start by creating contracts</p>
        </div>
      )}

      {!isDataEmpty && visibleWidgets.includes('kpi') && (
        <div 
          className="px-4 sm:px-6 lg:px-8 py-6"
          role="region"
          aria-label="Key Performance Indicators"
        >
          <div 
            data-testid="kpi-container"
            className={`grid gap-4 ${isMobile ? 'grid-cols-1 flex-col' : 'grid-cols-2 lg:grid-cols-4'}`}
          >
            {[
              { id: 'total-contracts', label: 'Total Contracts', value: kpiData?.totalContracts || 0, type: 'number', trend: 'up' },
              { id: 'active-contracts', label: 'Active Contracts', value: kpiData?.activeContracts || 0, type: 'number', trend: 'up' },
              { id: 'expiring-soon', label: 'Expiring Soon', value: kpiData?.contractsExpiringSoon || 0, type: 'number', trend: 'down' },
              { id: 'total-value', label: 'Total Value', value: kpiData?.totalContractValue || 0, type: 'currency', trend: 'up' },
              { id: 'approval-time', label: 'Avg Approval Time', value: kpiData?.averageApprovalTime || 0, type: 'days', trend: 'down' },
              { id: 'compliance-score', label: 'Compliance Score', value: kpiData?.complianceScore || 0, type: 'percentage', trend: 'up' },
              { id: 'risk-score', label: 'Risk Score', value: kpiData?.riskScore || 0, type: 'number', trend: 'down' },
              { id: 'automation-rate', label: 'Automation Rate', value: kpiData?.automationRate || 0, type: 'percentage', trend: 'up' },
            ].map((kpi) => (
              <div
                key={kpi.id}
                data-testid={`kpi-${kpi.id}`}
                className={`bg-white p-6 rounded-lg shadow-sm border ${
                  canViewDetails ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}
                onClick={() => canViewDetails && handleKPIClick(kpi.id, kpi)}
                onKeyDown={(e) => e.key === 'Enter' && canViewDetails && handleKPIClick(kpi.id, kpi)}
                tabIndex={canViewDetails ? 0 : -1}
                onMouseEnter={() => setTooltipContent({ id: kpi.id, content: `Click to view ${kpi.label} details` })}
                onMouseLeave={() => setTooltipContent(null)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{formatKPIValue(kpi.value, kpi.type)}</p>
                  </div>
                  <div 
                    data-testid={`trend-${kpi.trend}`}
                    className={`p-2 rounded-full ${
                      kpi.trend === 'up' ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {kpi.trend === 'up' ? (
                      <ArrowUpIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownIcon className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                {tooltipContent?.id === kpi.id && canViewDetails && (
                  <div role="tooltip" className="absolute z-10 px-2 py-1 text-sm bg-gray-800 text-white rounded mt-1">
                    {tooltipContent.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleWidgets.includes('trends') && (
        <div 
          className="px-4 sm:px-6 lg:px-8 py-6"
          role="region"
          aria-label="Trend Charts"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div 
              data-testid="chart-contract-volume"
              className="bg-white p-6 rounded-lg shadow-sm border"
              onClick={() => handleChartClick('contract-volume', contractVolumeData)}
              data-chart-type={chartTypes.contractVolume}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Contract Volume</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChartTypes(prev => ({
                      ...prev,
                      contractVolume: prev.contractVolume === 'line' ? 'bar' : 'line',
                    }));
                  }}
                  className="p-1 rounded hover:bg-gray-100"
                  aria-label="Chart type"
                >
                  {chartTypes.contractVolume === 'line' ? (
                    <PresentationChartBarIcon className="w-5 h-5" />
                  ) : (
                    <PresentationChartLineIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div 
                data-testid={`chart-type-${chartTypes.contractVolume}`}
                className="h-64 flex items-center justify-center text-gray-400"
              >
                Chart visualization placeholder
              </div>
            </div>

            <div 
              data-testid="chart-value-distribution"
              className="bg-white p-6 rounded-lg shadow-sm border"
              onClick={() => handleChartClick('value-distribution', valueDistributionData)}
            >
              <h3 className="text-lg font-semibold mb-4">Value Distribution</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chart visualization placeholder
              </div>
            </div>

            <div 
              data-testid="chart-risk-trends"
              className="bg-white p-6 rounded-lg shadow-sm border"
              onClick={() => handleChartClick('risk-trends', riskTrendsData)}
            >
              <h3 className="text-lg font-semibold mb-4">Risk Trends</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chart visualization placeholder
              </div>
            </div>

            <div 
              data-testid="chart-approval-time"
              className="bg-white p-6 rounded-lg shadow-sm border"
              onClick={() => handleChartClick('approval-time', approvalTimeData)}
            >
              <h3 className="text-lg font-semibold mb-4">Approval Time</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chart visualization placeholder
              </div>
            </div>
          </div>
        </div>
      )}

      {visibleWidgets.includes('activity') && (
        <div 
          data-testid="recent-activity"
          className="px-4 sm:px-6 lg:px-8 py-6"
        >
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <button
                onClick={() => onDrillDown?.('activity', activityData)}
                className="text-sm text-primary hover:text-primary-dark"
                aria-label="View all"
              >
                View all
              </button>
            </div>
            <div className="divide-y">
              {activityError && (
                <div className="p-4 text-red-600">Failed to load activity</div>
              )}
              {activityData?.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-start space-x-3">
                  {getActivityIcon(item.type)}
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span 
                        data-testid={`activity-timestamp-${item.id}`}
                        className="text-xs text-gray-500"
                      >
                        {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                      </span>
                      {item.user && (
                        <span className="text-xs text-gray-500">by {item.user}</span>
                      )}
                      {item.severity && (
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${getSeverityColor(item.severity)}`}>
                          {item.severity === 'high' ? 'High' : item.severity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCustomizePanel && (
        <div 
          data-testid="customization-panel"
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Customize Dashboard</h2>
            </div>
            <div className="p-6">
              <h3 className="font-medium mb-4">Toggle Widgets</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleWidgets.includes('kpi')}
                    onChange={() => handleToggleWidget('kpi')}
                    className="rounded"
                  />
                  <span>Show KPI Cards</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleWidgets.includes('trends')}
                    onChange={() => handleToggleWidget('trends')}
                    className="rounded"
                  />
                  <span>Show Trend Charts</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={visibleWidgets.includes('activity')}
                    onChange={() => handleToggleWidget('activity')}
                    className="rounded"
                  />
                  <span>Show Recent Activity</span>
                </label>
              </div>
              <div className="mt-6">
                <h3 className="font-medium mb-4">Widget Order</h3>
                <div className="space-y-2">
                  {visibleWidgets.map((widget, index) => (
                    <div key={widget} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                      <span data-testid="drag-handle" className="cursor-move">☰</span>
                      <span className="capitalize">{widget}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-between">
              <button
                onClick={handleResetLayout}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                aria-label="Reset to Default"
              >
                Reset to Default
              </button>
              <div className="space-x-3">
                <button
                  onClick={() => setShowCustomizePanel(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLayout}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  aria-label="Save Layout"
                >
                  Save Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleDialog && (
        <div 
          data-testid="schedule-dialog"
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
        >
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
                  aria-label="Frequency"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {scheduleConfig.frequency === 'daily' && (
                <div>
                  <label htmlFor="time" className="block text-sm font-medium mb-1">Time</label>
                  <input
                    id="time"
                    type="time"
                    value={scheduleConfig.time}
                    onChange={(e) => setScheduleConfig(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                    aria-label="Time"
                  />
                </div>
              )}
              {scheduleConfig.frequency === 'weekly' && (
                <div>
                  <label htmlFor="day-of-week" className="block text-sm font-medium mb-1">Day of week</label>
                  <select
                    id="day-of-week"
                    value={scheduleConfig.dayOfWeek}
                    onChange={(e) => setScheduleConfig(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                    aria-label="Day of week"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="recipients" className="block text-sm font-medium mb-1">Recipients</label>
                <input
                  id="recipients"
                  type="text"
                  value={scheduleConfig.recipients}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, recipients: e.target.value }))}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 border rounded-md"
                  aria-label="Recipients"
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

      {showShareDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Share Dashboard</h2>
            </div>
            <div className="p-6">
              <label htmlFor="share-recipients" className="block text-sm font-medium mb-1">Recipients</label>
              <input
                id="share-recipients"
                type="text"
                value={shareRecipients}
                onChange={(e) => setShareRecipients(e.target.value)}
                placeholder="Enter email addresses"
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowShareDialog(false);
                  setShareRecipients('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                aria-label="Send"
              >
                Send
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

      {!visibleWidgets.includes('kpi') && (
        <div data-testid="kpi-cards" className="hidden"></div>
      )}
    </div>
  );
};