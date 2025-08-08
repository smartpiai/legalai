import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';

interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface CalculationStatus {
  isCalculating: boolean;
  lastCalculated: string;
  progress: number;
  message: string;
}

export const MetricsCalculationEngine: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState<CalculationStatus>({
    isCalculating: false,
    lastCalculated: new Date().toISOString(),
    progress: 0,
    message: ''
  });
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [dateRange, setDateRange] = useState('30days');
  const [department, setDepartment] = useState('all');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');

  const canEdit = hasPermission('analytics:edit');
  const canCalculate = hasPermission('analytics:calculate');

  const handleCalculate = () => {
    setStatus({ ...status, isCalculating: true, message: 'Calculating metrics...', progress: 0 });
    const interval = setInterval(() => {
      setStatus(prev => {
        if (prev.progress >= 100) {
          clearInterval(interval);
          return { ...prev, isCalculating: false, lastCalculated: new Date().toISOString(), progress: 100, message: '' };
        }
        return { ...prev, progress: prev.progress + 10 };
      });
    }, 500);
  };

  const handleRefresh = () => {
    setAlertMessage('Refreshing data...');
    setTimeout(() => setAlertMessage(''), 2000);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div data-testid="calculation-status" className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Calculation Status</h3>
            <p className="text-sm text-gray-600">Last calculated: {new Date(status.lastCalculated).toLocaleString()}</p>
          </div>
          {status.isCalculating && (
            <div className="flex items-center space-x-2">
              <div data-testid="progress-bar" className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${status.progress}%` }}></div>
              </div>
              <span className="text-sm">{status.progress}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Metrics</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">156</p>
          <p className="text-sm text-green-600 mt-1">↑ 12 new this week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Calculations</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">8</p>
          <p className="text-sm text-gray-600 mt-1">Running now</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Data Points</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">2.5M</p>
          <p className="text-sm text-gray-600 mt-1">Processed today</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Update Frequency</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">15min</p>
          <p className="text-sm text-gray-600 mt-1">Auto-refresh</p>
        </div>
      </div>
      {autoUpdate && (
        <div data-testid="auto-update-indicator" className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-blue-700">Auto-updating enabled - metrics refresh every 15 minutes</p>
        </div>
      )}
    </div>
  );

  const renderVolumeTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Contracts</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">12,456</p>
          <p className="text-sm text-gray-600 mt-1">All time</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Contracts</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">8,234</p>
          <p className="text-sm text-green-600 mt-1">66% of total</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">New This Month</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">423</p>
          <p className="text-sm text-green-600 mt-1">↑ 15% growth rate</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Volume Trends</h3>
        <div data-testid="volume-chart" className="h-64 bg-gray-100 rounded flex items-center justify-center">
          Volume Chart Placeholder
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Category</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Sales</span><span>3,456</span></div>
            <div className="flex justify-between"><span>Service</span><span>2,890</span></div>
            <div className="flex justify-between"><span>NDA</span><span>2,110</span></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Department</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Legal</span><span>4,567</span></div>
            <div className="flex justify-between"><span>Sales</span><span>3,890</span></div>
            <div className="flex justify-between"><span>IT</span><span>1,999</span></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Status</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Active</span><span>8,234</span></div>
            <div className="flex justify-between"><span>Expired</span><span>2,890</span></div>
            <div className="flex justify-between"><span>Pending</span><span>1,332</span></div>
          </div>
        </div>
      </div>
      {canCalculate && (
        <button onClick={handleCalculate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Calculate Volume
        </button>
      )}
    </div>
  );

  const renderCycleTimeTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Cycle Time</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">14.5 days</p>
          <p className="text-sm text-green-600 mt-1">↓ 2 days improvement</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Approval Time</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">3.2 days</p>
          <p className="text-sm text-gray-600 mt-1">Median time</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Negotiation Time</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">8.7 days</p>
          <p className="text-sm text-gray-600 mt-1">Average duration</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Cycle Time by Stage</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>Draft Stage</span><span>2.3 days</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Review Stage</span><span>3.1 days</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Approval Stage</span><span>3.2 days</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Execution Stage</span><span>5.9 days</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Bottlenecks</h3>
        <div data-testid="bottleneck-analysis" className="space-y-2">
          <div className="p-3 border-l-4 border-red-500 bg-red-50">
            <p className="font-medium">Legal Review</p>
            <p className="text-sm text-gray-600">Average delay: 2.5 days</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Time Distribution</h3>
        <div data-testid="time-distribution" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Median time: 12 days</p>
        </div>
      </div>
    </div>
  );

  const renderValueTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Contract Value</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$45.2M</p>
          <p className="text-sm text-green-600 mt-1">↑ $5.3M this quarter</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Value</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$125K</p>
          <p className="text-sm text-gray-600 mt-1">Per contract</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Value at Risk</h3>
          <p className="text-2xl font-bold text-red-600 mt-1">$2.8M</p>
          <p className="text-sm text-gray-600 mt-1">Expiring soon</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Value Distribution</h3>
        <div data-testid="value-distribution" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Value ranges chart</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Top Vendors by Value</h3>
        <div data-testid="vendor-value-table" className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead><tr><th className="px-4 py-2 text-left">Vendor</th><th className="px-4 py-2 text-right">Value</th></tr></thead>
            <tbody>
              <tr><td className="px-4 py-2">Vendor A</td><td className="px-4 py-2 text-right">$5.2M</td></tr>
              <tr><td className="px-4 py-2">Vendor B</td><td className="px-4 py-2 text-right">$3.8M</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium">ROI</h4>
          <p className="text-2xl font-bold text-green-600">245%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium">Cost Avoidance</h4>
          <p className="text-2xl font-bold">$1.2M</p>
        </div>
      </div>
    </div>
  );

  const renderRiskTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Risk Score</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">6.2</p>
          <p className="text-sm text-yellow-600 mt-1">Medium risk</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">High Risk Contracts</h3>
          <p className="text-2xl font-bold text-red-600 mt-1">89</p>
          <p className="text-sm text-gray-600 mt-1">Require attention</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Risk Mitigation Rate</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">78%</p>
          <p className="text-sm text-gray-600 mt-1">Successfully mitigated</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Risk Distribution</h3>
        <div data-testid="risk-heatmap" className="grid grid-cols-4 gap-2">
          <div className="p-4 bg-red-500 text-white rounded text-center">
            <p className="font-bold">Critical</p><p className="text-2xl">12</p>
          </div>
          <div className="p-4 bg-orange-500 text-white rounded text-center">
            <p className="font-bold">High</p><p className="text-2xl">89</p>
          </div>
          <div className="p-4 bg-yellow-500 text-white rounded text-center">
            <p className="font-bold">Medium</p><p className="text-2xl">234</p>
          </div>
          <div className="p-4 bg-green-500 text-white rounded text-center">
            <p className="font-bold">Low</p><p className="text-2xl">567</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Risk Factors</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded">
            <h4 className="font-medium">Financial Risk</h4>
            <p className="text-sm text-gray-600">Score: 7.2/10</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Compliance Risk</h4>
            <p className="text-sm text-gray-600">Score: 5.8/10</p>
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium">Operational Risk</h4>
            <p className="text-sm text-gray-600">Score: 6.1/10</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Risk Trends</h3>
        <div data-testid="risk-trend-chart" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Risk trajectory: Decreasing</p>
        </div>
      </div>
    </div>
  );

  const renderComplianceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Overall Compliance</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">94.5%</p>
          <p className="text-sm text-gray-600 mt-1">↑ 2.3% improvement rate</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Regulatory Compliance</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">96.2%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Policy Compliance</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">92.8%</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Compliance by Category</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>GDPR Compliance</span>
            <span className="text-green-600 font-bold">98.5%</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>SOC 2 Compliance</span>
            <span className="text-green-600 font-bold">95.2%</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>ISO Compliance</span>
            <span className="text-yellow-600 font-bold">89.7%</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Non-Compliant Contracts</h3>
        <div data-testid="compliance-issues" className="space-y-2">
          <div className="p-2 border-l-4 border-red-500 bg-red-50">
            <p className="font-medium">45 contracts need attention</p>
            <p className="text-sm text-gray-600">Missing required clauses</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div data-testid="compliance-trend" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Compliance improvement rate: +2.3%/month</p>
        </div>
      </div>
    </div>
  );

  const renderActivityTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">234</p>
          <p className="text-sm text-gray-600 mt-1">Last 24 hours</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Daily Actions</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">1,456</p>
          <p className="text-sm text-green-600 mt-1">↑ 23% from yesterday</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Session Time</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">18.5m</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">Admin Activity</h4>
          <p className="text-xl font-bold">456</p>
          <p className="text-sm text-gray-600">Actions today</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">Manager Activity</h4>
          <p className="text-xl font-bold">678</p>
          <p className="text-sm text-gray-600">Actions today</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">Viewer Activity</h4>
          <p className="text-xl font-bold">322</p>
          <p className="text-sm text-gray-600">Actions today</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Most Active Users</h3>
        <div data-testid="user-leaderboard" className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>John Doe</span><span>234 actions</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Jane Smith</span><span>189 actions</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Activity Heatmap</h3>
        <div data-testid="activity-heatmap" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Peak hours: 9AM-11AM, 2PM-4PM</p>
        </div>
      </div>
    </div>
  );

  const renderSavingsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Savings</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">$3.2M</p>
          <p className="text-sm text-gray-600 mt-1">Year to date</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Negotiation Savings</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$1.8M</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Process Savings</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$1.4M</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Department</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Legal</span><span>$890K</span></div>
            <div className="flex justify-between"><span>Sales</span><span>$1.2M</span></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Contract Type</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Service</span><span>$1.5M</span></div>
            <div className="flex justify-between"><span>Supply</span><span>$980K</span></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium mb-2">By Quarter</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Q1</span><span>$780K</span></div>
            <div className="flex justify-between"><span>Q2</span><span>$890K</span></div>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Potential Savings</h3>
        <div data-testid="opportunities-list" className="space-y-2">
          <div className="p-3 border rounded">
            <p className="font-medium">Contract consolidation</p>
            <p className="text-sm text-gray-600">Estimated: $450K/year</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Projected Annual Savings</h3>
        <div data-testid="savings-projection" className="text-center py-4">
          <p className="text-3xl font-bold text-green-600">$4.8M</p>
          <p className="text-gray-600">Based on current trends</p>
        </div>
      </div>
    </div>
  );

  const renderEfficiencyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Process Efficiency</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">87%</p>
          <p className="text-sm text-green-600 mt-1">↑ 5% improvement</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Automation Rate</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">62%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Error Rate</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">0.8%</p>
          <p className="text-sm text-gray-600 mt-1">↓ Decreasing</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Efficiency by Process</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>Contract Creation</span><span>92%</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Review Process</span><span>85%</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Approval Workflow</span><span>88%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium">Contracts per User</h4>
          <p className="text-2xl font-bold">48</p>
          <p className="text-sm text-gray-600">Monthly average</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-medium">Tasks Completed</h4>
          <p className="text-2xl font-bold">1,234</p>
          <p className="text-sm text-gray-600">This week</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div data-testid="efficiency-trend" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>Improvement areas: Review process, approvals</p>
        </div>
      </div>
    </div>
  );

  const renderTrendsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Trend Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Seasonal Patterns</p>
            <p className="text-xl font-bold">Q4 Peak</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Growth Trends</p>
            <p className="text-xl font-bold text-green-600">+23%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Trend Direction</p>
            <p className="text-xl font-bold">↑ Upward</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Moving Averages</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>7-Day Moving Average</span><span>145</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>30-Day Moving Average</span><span>132</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>90-Day Moving Average</span><span>128</span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div data-testid="trend-indicators" className="text-center py-4">
          <p className="text-sm text-gray-600">Trend direction: Upward</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Anomalies Detected</h3>
        <div data-testid="anomaly-chart" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>2 anomalies detected this month</p>
        </div>
      </div>
    </div>
  );

  const renderPredictiveTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Contract Volume Forecast</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">15,234</p>
          <p className="text-sm text-gray-600 mt-1">Next 3 months</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Value Predictions</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">$52.3M</p>
          <p className="text-sm text-gray-600 mt-1">Q4 forecast</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Risk Forecast</h3>
          <p className="text-2xl font-bold text-yellow-600 mt-1">Medium</p>
          <p className="text-sm text-gray-600 mt-1">Next quarter</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Confidence Level</h3>
        <div data-testid="confidence-bands" className="h-48 bg-gray-100 rounded flex items-center justify-center">
          <p>95% confidence interval</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Model Accuracy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">MAPE</p>
            <p className="text-xl font-bold">8.2%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">R-squared</p>
            <p className="text-xl font-bold">0.92</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Scenario Analysis</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 border rounded">
            <span>Best Case</span><span>$58.2M</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Expected Case</span><span>$52.3M</span>
          </div>
          <div className="flex justify-between p-2 border rounded">
            <span>Worst Case</span><span>$46.1M</span>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', content: renderOverviewTab },
    { id: 'volume', label: 'Volume', content: renderVolumeTab },
    { id: 'cycle-time', label: 'Cycle Time', content: renderCycleTimeTab },
    { id: 'value', label: 'Value', content: renderValueTab },
    { id: 'risk', label: 'Risk', content: renderRiskTab },
    { id: 'compliance', label: 'Compliance', content: renderComplianceTab },
    { id: 'activity', label: 'Activity', content: renderActivityTab },
    { id: 'savings', label: 'Savings', content: renderSavingsTab },
    { id: 'efficiency', label: 'Efficiency', content: renderEfficiencyTab },
    { id: 'trends', label: 'Trends', content: renderTrendsTab },
    { id: 'predictive', label: 'Predictive', content: renderPredictiveTab }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="metrics-calculation-engine">
      <div className="sr-only" role="status" aria-live="polite">
        {status.isCalculating ? 'Calculating metrics...' : ''}
        {alertMessage}
        {department !== 'all' ? `Filtered by ${department}` : ''}
      </div>
      <main role="main" aria-label="Metrics Calculation Engine">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Metrics Calculation Engine</h1>
          <p className="text-gray-600">Calculate and analyze contract metrics across all dimensions</p>
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
          <div className="flex items-center space-x-2">
            <label htmlFor="date-range" className="sr-only">Date Range</label>
            <select id="date-range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded">
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <label htmlFor="department" className="sr-only">Department</label>
            <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded">
              <option value="all">All Departments</option>
              <option value="legal">Legal</option>
              <option value="sales">Sales</option>
              <option value="it">IT</option>
            </select>
          </div>
        </div>
        <div className="mb-4 flex justify-end space-x-2">
          {canCalculate && (
            <>
              <button onClick={handleCalculate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Calculate Now
              </button>
              <button onClick={() => setShowScheduleDialog(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                Schedule Calculation
              </button>
            </>
          )}
          <button onClick={() => setShowExportDialog(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Export Metrics
          </button>
          <button onClick={handleRefresh} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Refresh Data
          </button>
          {canEdit && (
            <button onClick={() => setShowSettingsDialog(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Settings
            </button>
          )}
        </div>
        {status.isCalculating && (
          <div className="mb-4 bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-700">Processing: {status.message}</p>
          </div>
        )}
        <div role="tabpanel">{tabs.find(t => t.id === activeTab)?.content()}</div>
        {showScheduleDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Schedule Calculation</h2>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <select id="frequency" className="w-full px-3 py-2 border rounded mb-3">
                <option>Hourly</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input id="time" type="time" className="w-full px-3 py-2 border rounded mb-4" />
              <div className="flex space-x-2">
                <button onClick={() => setShowScheduleDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                  Cancel
                </button>
                <button onClick={() => setShowScheduleDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
        {showExportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Export Metrics</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">CSV</button>
                <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">Excel</button>
                <button className="w-full px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-left">JSON</button>
              </div>
              <button onClick={() => setShowExportDialog(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                Close
              </button>
            </div>
          </div>
        )}
        {showSettingsDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Calculation Settings</h2>
              <label htmlFor="precision" className="block text-sm font-medium text-gray-700 mb-1">
                Precision
              </label>
              <select id="precision" className="w-full px-3 py-2 border rounded mb-3">
                <option>2 decimal places</option>
                <option>3 decimal places</option>
                <option>4 decimal places</option>
              </select>
              <label htmlFor="rounding" className="block text-sm font-medium text-gray-700 mb-1">
                Rounding
              </label>
              <select id="rounding" className="w-full px-3 py-2 border rounded mb-4">
                <option>Round up</option>
                <option>Round down</option>
                <option>Round to nearest</option>
              </select>
              <div className="flex space-x-2">
                <button onClick={() => setShowSettingsDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                  Cancel
                </button>
                <button onClick={() => setShowSettingsDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};