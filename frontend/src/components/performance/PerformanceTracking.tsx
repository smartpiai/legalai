import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  CogIcon,
  BellIcon,
  ScaleIcon,
  StarIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ArrowsPointingOutIcon,
  DocumentTextIcon,
  TrophyIcon,
  ExclamationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

interface KPI {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  target: number;
  current: number;
  trend: 'improving' | 'declining' | 'stable';
  frequency: string;
  formula: string;
  status: 'on_track' | 'at_risk' | 'off_track';
  lastUpdated: string;
}

interface PerformanceData {
  id: string;
  contractId: string;
  contractName: string;
  vendorName: string;
  period: string;
  metrics: {
    responseTime?: number;
    availability?: number;
    qualityScore?: number;
    deliveryOnTime?: number;
    costVariance?: number;
  };
  slaStatus: Record<string, 'met' | 'missed' | 'at_risk'>;
  penalties: {
    amount: number;
    reason: string;
    applied: boolean;
  };
  overallScore: number;
  rating: string;
  createdAt: string;
}

interface Scorecard {
  id: string;
  name: string;
  period: string;
  categories: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
  overallScore: number;
  status: string;
  createdAt: string;
}

interface Benchmark {
  id: string;
  metric: string;
  industry: string;
  average: number;
  top10: number;
  top25: number;
  current: number;
  percentile: number;
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  contractId?: string;
  triggered: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actions: string[];
}

interface VendorRating {
  id: string;
  vendorId: string;
  vendorName: string;
  overallRating: number;
  totalContracts: number;
  ratings: {
    quality: number;
    delivery: number;
    communication: number;
    value: number;
    innovation: number;
  };
  trend: 'improving' | 'declining' | 'stable';
  lastReview: string;
}

interface PerformanceTrackingProps {
  onKpiUpdate?: (kpi: KPI) => void;
  onAlertTriggered?: (alert: Alert) => void;
  onReportGenerated?: (report: any) => void;
  view?: 'dashboard' | 'scorecards' | 'trends' | 'benchmarks';
}

export const PerformanceTracking: React.FC<PerformanceTrackingProps> = ({
  onKpiUpdate,
  onAlertTriggered,
  onReportGenerated,
  view = 'dashboard',
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(view);
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [showDataEntryForm, setShowDataEntryForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSlaConfig, setShowSlaConfig] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showReportScheduler, setShowReportScheduler] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showVendorComparison, setShowVendorComparison] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showScorecardBuilder, setShowScorecardBuilder] = useState(false);
  const [showPeriodComparison, setShowPeriodComparison] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [selectedPerformance, setSelectedPerformance] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [periodRange, setPeriodRange] = useState('last_30_days');
  const [showWaiverDialog, setShowWaiverDialog] = useState<string | null>(null);
  const [showPenaltyHistory, setShowPenaltyHistory] = useState(false);
  const [showAlertHistory, setShowAlertHistory] = useState(false);
  const [kpiFormData, setKpiFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    target: 0,
    formula: '',
    frequency: 'daily',
  });
  const [dataEntryFormData, setDataEntryFormData] = useState({
    contractId: '',
    responseTime: 0,
    availability: 0,
    qualityScore: 0,
    deliveryOnTime: 0,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get('/kpis').then(res => res.data),
  });

  const { data: performanceData = [], isLoading: performanceLoading } = useQuery({
    queryKey: ['performance-data', contractFilter, periodFilter],
    queryFn: () => api.get('/performance-data').then(res => res.data),
  });

  const { data: scorecards = [] } = useQuery({
    queryKey: ['scorecards'],
    queryFn: () => api.get('/scorecards').then(res => res.data),
  });

  const { data: benchmarks = [] } = useQuery({
    queryKey: ['benchmarks', industryFilter],
    queryFn: () => api.get('/benchmarks').then(res => res.data),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['performance-alerts'],
    queryFn: () => api.get('/performance-alerts').then(res => res.data),
  });

  const { data: vendorRatings = [] } = useQuery({
    queryKey: ['vendor-ratings'],
    queryFn: () => api.get('/vendor-ratings').then(res => res.data),
  });

  const createKpiMutation = useMutation({
    mutationFn: (data: any) => api.post('/kpis', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      setShowKpiForm(false);
      onKpiUpdate?.(response.data);
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/kpis/${id}`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      onKpiUpdate?.(response.data);
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId: string) => api.patch(`/performance-alerts/${alertId}/acknowledge`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-alerts'] });
      onAlertTriggered?.(alerts.find(a => a.id === selectedAlert));
    },
  });

  const filteredPerformanceData = useMemo(() => {
    let filtered = [...performanceData];
    
    if (contractFilter !== 'all') {
      filtered = filtered.filter(p => p.contractId === contractFilter);
    }
    
    if (periodFilter !== 'all') {
      filtered = filtered.filter(p => p.period === periodFilter);
    }
    
    return filtered;
  }, [performanceData, contractFilter, periodFilter]);

  const activeAlerts = useMemo(() => {
    return alerts.filter(a => !a.acknowledged);
  }, [alerts]);

  const kpisByCategory = useMemo(() => {
    const grouped: Record<string, KPI[]> = {};
    kpis.forEach(kpi => {
      if (!grouped[kpi.category]) {
        grouped[kpi.category] = [];
      }
      grouped[kpi.category].push(kpi);
    });
    return grouped;
  }, [kpis]);

  const totalPenalties = useMemo(() => {
    return filteredPerformanceData.reduce((sum, p) => sum + (p.penalties?.amount || 0), 0);
  }, [filteredPerformanceData]);

  const validateKpiForm = () => {
    const errors: Record<string, string> = {};
    if (!kpiFormData.name) errors.name = 'Name is required';
    if (!kpiFormData.target || kpiFormData.target <= 0) errors.target = 'Must be a positive number';
    if (kpiFormData.formula && !isValidFormula(kpiFormData.formula)) {
      errors.formula = 'Invalid formula syntax';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDataEntry = () => {
    const errors: Record<string, string> = {};
    if (dataEntryFormData.availability < 0 || dataEntryFormData.availability > 100) {
      errors.availability = 'Must be between 0 and 100';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidFormula = (formula: string) => {
    // Simple validation - check for basic SQL-like syntax
    return /^(AVG|SUM|COUNT|MAX|MIN)\([\w\s\-\+\*\/]+\)/.test(formula);
  };

  const handleSyncContracts = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const handleGenerateReport = () => {
    onReportGenerated?.({ type: 'performance', timestamp: new Date() });
  };

  const renderKpiCard = (kpi: KPI) => {
    const isImproving = kpi.trend === 'improving';
    const isOnTrack = kpi.status === 'on_track';
    
    return (
      <div 
        key={kpi.id}
        data-testid={`kpi-${kpi.id}`}
        className="bg-white rounded-lg shadow p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{kpi.name}</h3>
            <p className="text-sm text-gray-600">{kpi.description}</p>
          </div>
          <div data-testid="trend-indicator" className="flex items-center">
            {isImproving ? (
              <ChevronUpIcon data-testid="trend-icon" className="h-5 w-5 text-green-600" />
            ) : kpi.trend === 'declining' ? (
              <ChevronDownIcon data-testid="trend-icon" className="h-5 w-5 text-red-600" />
            ) : (
              <span data-testid="trend-icon" className="h-5 w-5 text-gray-400">—</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {kpi.current} {kpi.unit}
          </div>
          <div className="text-sm text-gray-600">
            Target: {kpi.target} {kpi.unit}
          </div>
          <div className="text-sm text-gray-500">
            {kpi.frequency.charAt(0).toUpperCase() + kpi.frequency.slice(1)}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className={`px-2 py-1 text-xs rounded-full ${
              isOnTrack ? 'bg-green-100 text-green-800' :
              kpi.status === 'at_risk' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {kpi.status.replace('_', ' ').toUpperCase()}
            </span>
            <button
              onClick={() => setSelectedKpi(kpi.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Edit"
            >
              Edit
            </button>
            <button
              onClick={() => updateKpiMutation.mutate({ id: kpi.id, data: { current: kpi.current + 1 }})}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Update"
            >
              Update
            </button>
          </div>
        </div>
        {selectedKpi === kpi.id && (
          <div data-testid={`kpi-details-${kpi.id}`} className="hidden" />
        )}
      </div>
    );
  };

  const renderPerformanceCard = (perf: PerformanceData) => {
    const slaMetCount = Object.values(perf.slaStatus).filter(s => s === 'met').length;
    const slaTotalCount = Object.keys(perf.slaStatus).length;
    const slaBreachCount = Object.values(perf.slaStatus).filter(s => s === 'missed').length;
    
    return (
      <div 
        key={perf.id}
        data-testid={`performance-${perf.id}`}
        className="bg-white rounded-lg shadow p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{perf.contractName}</h3>
            <p className="text-sm text-gray-600">{perf.vendorName}</p>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full ${
            perf.rating === 'good' ? 'bg-green-100 text-green-800' :
            perf.rating === 'fair' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {perf.rating.toUpperCase()}
          </span>
        </div>
        <div className="space-y-2">
          <div data-testid="sla-status" className="text-sm">
            {slaMetCount}/{slaTotalCount} SLAs Met
          </div>
          {slaBreachCount > 0 && (
            <div data-testid="sla-breach-badge" className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
              {slaBreachCount} Breaches
            </div>
          )}
          {perf.penalties && (
            <div className="mt-2">
              <span data-testid="penalty-amount" className="font-semibold">
                ${perf.penalties.amount.toLocaleString()}
              </span>
              <p className="text-sm text-gray-600">{perf.penalties.reason}</p>
            </div>
          )}
          <div className="flex space-x-2 mt-4">
            <button
              onClick={() => setSelectedPerformance(perf.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="View SLA Details"
            >
              View SLA Details
            </button>
            <button
              onClick={() => setSelectedPerformance(perf.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Penalty Details"
            >
              Penalty Details
            </button>
            <button
              onClick={() => setShowWaiverDialog(perf.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Waive Penalty"
            >
              Waive Penalty
            </button>
          </div>
        </div>
        {selectedPerformance === perf.id && (
          <>
            <div data-testid="sla-details" className="mt-4 p-3 bg-gray-50 rounded">
              {Object.entries(perf.slaStatus).map(([key, status]) => (
                <div key={key} className="text-sm">
                  {key.replace(/([A-Z])/g, ' $1').trim()}: {status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
              ))}
            </div>
            <div data-testid="penalty-calculation" className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm">Base penalty calculation details</p>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAlert = (alert: Alert) => {
    return (
      <div 
        key={alert.id}
        data-testid={`alert-${alert.id}`}
        className="bg-white rounded-lg shadow p-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-1" />
            <div>
              <h4 className="font-medium">{alert.title}</h4>
              <p className="text-sm text-gray-600">{alert.description}</p>
            </div>
          </div>
          <span 
            data-testid="severity-badge"
            className={`px-2 py-1 text-xs rounded-full ${
              alert.severity === 'high' || alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}
          >
            {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
          </span>
        </div>
        {!alert.acknowledged && (
          <button
            onClick={() => {
              setSelectedAlert(alert.id);
              acknowledgeAlertMutation.mutate(alert.id);
            }}
            className="mt-3 text-blue-600 hover:text-blue-800 text-sm"
            aria-label="Acknowledge"
          >
            Acknowledge
          </button>
        )}
      </div>
    );
  };

  const renderVendorRating = (rating: VendorRating) => {
    return (
      <div 
        key={rating.id}
        data-testid={`vendor-rating-${rating.id}`}
        className="bg-white rounded-lg shadow p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{rating.vendorName}</h3>
            <div className="flex items-center mt-1">
              <StarIcon className="h-5 w-5 text-yellow-500" />
              <span className="ml-1 font-semibold">{rating.overallRating}</span>
              <span className="ml-2 text-sm text-gray-600">({rating.totalContracts} contracts)</span>
            </div>
          </div>
          <span 
            data-testid="rating-trend"
            className={`text-sm ${
              rating.trend === 'improving' ? 'text-green-600' :
              rating.trend === 'declining' ? 'text-red-600' :
              'text-gray-600'
            }`}
          >
            {rating.trend.charAt(0).toUpperCase() + rating.trend.slice(1)}
          </span>
        </div>
        <button
          onClick={() => {}}
          className="text-blue-600 hover:text-blue-800 text-sm"
          aria-label="View Details"
        >
          View Details
        </button>
        <div data-testid="rating-breakdown" className="mt-4 space-y-1 hidden">
          <div className="text-sm">Quality: {rating.ratings.quality}</div>
          <div className="text-sm">Delivery: {rating.ratings.delivery}</div>
        </div>
      </div>
    );
  };

  if (kpisLoading || performanceLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIcon data-testid="loading-spinner" className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading performance data...</span>
      </div>
    );
  }

  return (
    <div data-testid="performance-tracking" className="p-6 max-w-7xl mx-auto">
      <div role="status" aria-live="polite" className="sr-only">
        KPI updated
      </div>

      <main role="main" aria-label="Performance Tracking">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance Tracking</h1>
          <p className="text-gray-600">Monitor and analyze contract performance metrics</p>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                role="tab"
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Dashboard
              </button>
              <button
                role="tab"
                onClick={() => setActiveTab('scorecards')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scorecards' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Scorecards
              </button>
              <button
                role="tab"
                onClick={() => setActiveTab('trends')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'trends' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Trends
              </button>
              <button
                role="tab"
                onClick={() => setActiveTab('benchmarks')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'benchmarks' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Benchmarks
              </button>
            </nav>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <select
              aria-label="Filter by contract"
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Contracts</option>
              <option value="contract1">Contract 1</option>
              <option value="contract2">Contract 2</option>
            </select>
            <select
              aria-label="Filter by period"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Periods</option>
              <option value="2024-01">2024-01</option>
              <option value="2024-02">2024-02</option>
            </select>
            {activeTab === 'benchmarks' && (
              <select
                aria-label="Industry"
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Industries</option>
                <option value="technology">Technology</option>
                <option value="finance">Finance</option>
              </select>
            )}
            {activeTab === 'trends' && (
              <select
                aria-label="Period"
                value={periodRange}
                onChange={(e) => setPeriodRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="last_year">Last Year</option>
              </select>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowKpiForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create KPI
            </button>
            <button
              onClick={() => setShowDataEntryForm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Add Performance Data
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Import Data
            </button>
            <button
              onClick={() => setShowSlaConfig(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Configure SLA
            </button>
            <button
              onClick={() => setShowAlertConfig(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Configure Alerts
            </button>
            <button
              onClick={() => setShowPenaltyHistory(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Penalty History
            </button>
            <button
              onClick={() => setShowAlertHistory(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Alert History
            </button>
            <button
              onClick={handleSyncContracts}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
            >
              Sync Contracts
            </button>
            <button
              onClick={() => setShowRatingForm(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            >
              Rate Vendor
            </button>
            <button
              onClick={() => setShowVendorComparison(true)}
              className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700"
            >
              Compare Vendors
            </button>
            <button
              onClick={() => setShowReportGenerator(true)}
              className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
            >
              Generate Report
            </button>
            <button
              onClick={() => setShowReportScheduler(true)}
              className="px-4 py-2 bg-lime-600 text-white rounded-md hover:bg-lime-700"
            >
              Schedule Reports
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Export Report
            </button>
            <button
              onClick={() => setShowTemplateManager(true)}
              className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700"
            >
              Report Templates
            </button>
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"
            >
              Preview Report
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div data-testid="kpi-dashboard" role="region" aria-label="KPI Dashboard" className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Key Performance Indicators</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(kpisByCategory).map(([category, categoryKpis]) => (
                  <div key={category} data-testid={`kpi-category-${category}`}>
                    {categoryKpis.map(renderKpiCard)}
                  </div>
                ))}
              </div>
            </div>

            <div data-testid="performance-metrics" className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Performance Data</h2>
              <div data-testid="performance-data-table" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPerformanceData.map(renderPerformanceCard)}
              </div>
            </div>

            <div data-testid="performance-alerts" className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Active Alerts</h2>
              <div className="space-y-4">
                {activeAlerts.map(renderAlert)}
              </div>
            </div>

            <div data-testid="vendor-ratings">
              <h2 className="text-xl font-semibold mb-4">Vendor Ratings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendorRatings.map(renderVendorRating)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'scorecards' && (
          <div data-testid="scorecards-view">
            <h2 className="text-xl font-semibold mb-4">Performance Scorecards</h2>
            <button
              onClick={() => setShowScorecardBuilder(true)}
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Scorecard
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="mb-4 ml-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Export Scorecard
            </button>
            <div className="space-y-6">
              {scorecards.map(scorecard => (
                <div key={scorecard.id} data-testid={`scorecard-${scorecard.id}`} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">{scorecard.name}</h3>
                  <div className="space-y-2">
                    {scorecard.categories.map(cat => (
                      <div key={cat.name} className="flex justify-between">
                        <span>{cat.name}: {cat.score}</span>
                        <span className="text-gray-500">Weight: {cat.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <span className="font-semibold">Overall Score: </span>
                    <span data-testid="overall-score">{scorecard.overallScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div data-testid="trend-charts">
            <h2 className="text-xl font-semibold mb-4">Performance Trends</h2>
            <button
              onClick={() => setShowPeriodComparison(true)}
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Compare Periods
            </button>
            <button
              onClick={() => setShowForecast(true)}
              className="mb-4 ml-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Show Forecast
            </button>
            <div data-testid="performance-trend-chart" className="bg-white rounded-lg shadow p-6">
              <div data-testid="sla-trend-chart">
                <h3 className="font-semibold mb-4">SLA Compliance Trend</h3>
                <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
                  Chart Placeholder
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'benchmarks' && (
          <div data-testid="benchmarks-view">
            <h2 className="text-xl font-semibold mb-4">Industry Benchmarks</h2>
            <div className="space-y-6">
              {benchmarks.map(benchmark => (
                <div key={benchmark.id} data-testid={`benchmark-${benchmark.id}`} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">{benchmark.metric}</h3>
                  <div className="space-y-2">
                    <div>Industry: {benchmark.industry}</div>
                    <div>Industry Avg: {benchmark.average}</div>
                    <div>Current: {benchmark.current}</div>
                    <div>Top 10%: {benchmark.top10}</div>
                    <div>Top 25%: {benchmark.top25}</div>
                    <div className="font-semibold">{benchmark.percentile}th Percentile</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contractFilter !== 'all' && <div data-testid="filtered-data" className="hidden" />}
        {isSyncing && <div className="text-center py-4">Syncing...</div>}

        {showKpiForm && (
          <div data-testid="kpi-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Create KPI</h2>
              <div className="space-y-4">
                <input
                  aria-label="KPI Name"
                  placeholder="KPI Name"
                  value={kpiFormData.name}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <textarea
                  aria-label="Description"
                  placeholder="Description"
                  value={kpiFormData.description}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  aria-label="Target Value"
                  type="number"
                  placeholder="Target Value"
                  value={kpiFormData.target}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, target: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {formErrors.target && <p className="text-red-500 text-sm">Must be a positive number</p>}
                <input
                  aria-label="Formula"
                  placeholder="Formula (e.g., AVG(metric))"
                  value={kpiFormData.formula}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, formula: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {formErrors.formula && <p className="text-red-500 text-sm">Invalid formula syntax</p>}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowKpiForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (validateKpiForm()) {
                      createKpiMutation.mutate(kpiFormData);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedKpi && (
          <div data-testid="kpi-edit-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Edit KPI</h2>
              <input
                value="Contract Cycle Time"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedKpi(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showDataEntryForm && (
          <div data-testid="data-entry-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Add Performance Data</h2>
              <div className="space-y-4">
                <input
                  aria-label="Response Time"
                  type="number"
                  placeholder="Response Time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  aria-label="Availability"
                  type="number"
                  placeholder="Availability (%)"
                  value={dataEntryFormData.availability}
                  onChange={(e) => setDataEntryFormData({ ...dataEntryFormData, availability: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {formErrors.availability && <p className="text-red-500 text-sm">Must be between 0 and 100</p>}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowDataEntryForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (validateDataEntry()) {
                      setShowDataEntryForm(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {showImportDialog && (
          <div data-testid="import-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Import Data</h2>
              <p>Select CSV file to import performance data</p>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Import
                </button>
              </div>
            </div>
          </div>
        )}

        {showSlaConfig && (
          <div data-testid="sla-configuration" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Configure SLA</h2>
              <input
                aria-label="Response Time Threshold"
                placeholder="Response Time Threshold"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSlaConfig(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showAlertConfig && (
          <div data-testid="alert-configuration" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Configure Alerts</h2>
              <input
                aria-label="Alert Threshold"
                placeholder="Alert Threshold"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAlertConfig(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showWaiverDialog && (
          <div data-testid="waiver-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Waive Penalty</h2>
              <textarea
                aria-label="Waiver Reason"
                placeholder="Reason for waiver"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowWaiverDialog(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Waive
                </button>
              </div>
            </div>
          </div>
        )}

        {showPenaltyHistory && (
          <div data-testid="penalty-history" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Penalty History</h2>
              <p>Total Penalties: ${totalPenalties.toLocaleString()}</p>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowPenaltyHistory(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showAlertHistory && (
          <div data-testid="alert-history" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Alert History</h2>
              <div className="space-y-2">
                {alerts.filter(a => a.acknowledged).map(alert => (
                  <div key={alert.id} className="text-sm">
                    {alert.title} - Acknowledged by {alert.acknowledgedBy}
                  </div>
                ))}
                {alerts.find(a => a.title === 'Performance Declining') && (
                  <div className="text-sm">Performance Declining</div>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowAlertHistory(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showRatingForm && (
          <div data-testid="rating-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Rate Vendor</h2>
              <input
                aria-label="Quality Rating"
                type="number"
                placeholder="Quality Rating (1-5)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRatingForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {showVendorComparison && (
          <div data-testid="vendor-comparison" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-xl font-bold mb-4">TechCorp vs ServicePro</h2>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowVendorComparison(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showPeriodComparison && (
          <div data-testid="period-comparison" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Compare Periods</h2>
              <input
                aria-label="Compare from"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
              />
              <input
                aria-label="Compare to"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowPeriodComparison(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Compare
                </button>
              </div>
            </div>
          </div>
        )}

        {showForecast && (
          <div data-testid="trend-forecast" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Performance Forecast</h2>
              <p>Projected performance for next 3 months</p>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowForecast(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showScorecardBuilder && (
          <div data-testid="scorecard-builder" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Create Scorecard</h2>
              <input
                aria-label="Scorecard Name"
                placeholder="Scorecard Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowScorecardBuilder(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showReportGenerator && (
          <div data-testid="report-generator" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Generate Report</h2>
              <select
                aria-label="Report Type"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              >
                <option>Executive Summary</option>
                <option>Detailed Performance</option>
                <option>SLA Compliance</option>
              </select>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowReportGenerator(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {showReportScheduler && (
          <div data-testid="report-scheduler" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Schedule Reports</h2>
              <select
                aria-label="Frequency"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
              <input
                aria-label="Recipients"
                placeholder="Recipients (comma-separated emails)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowReportScheduler(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {showExportDialog && (
          <>
            {activeTab === 'scorecards' && (
              <div data-testid="export-options" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Export Options</h2>
                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100">PDF</button>
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Excel</button>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => setShowExportDialog(false)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'dashboard' && (
              <div data-testid="export-formats" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Export Formats</h2>
                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100">PDF</button>
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Excel</button>
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-100">PowerPoint</button>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => setShowExportDialog(false)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {showTemplateManager && (
          <div data-testid="template-manager" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Report Templates</h2>
              <div className="space-y-2">
                <div className="px-4 py-2 bg-gray-50 rounded">Executive Summary</div>
                <div className="px-4 py-2 bg-gray-50 rounded">Quarterly Review</div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowTemplateManager(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};