import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';

interface Report {
  id: string;
  name: string;
  type: string;
  status: 'completed' | 'generating' | 'scheduled' | 'failed';
  createdAt: string;
  schedule?: string;
  nextRun?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: string[];
}

interface Subscription {
  id: string;
  reportId: string;
  subscriber: string;
  frequency: string;
  lastSent: string;
}

export const ReportGenerationSystem: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showRecipientDialog, setShowRecipientDialog] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [status, setStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [reportType, setReportType] = useState('all');
  const [previewMode, setPreviewMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const canEdit = hasPermission('reports:edit');
  const canDelete = hasPermission('reports:delete');
  const canSchedule = hasPermission('reports:schedule');

  const mockReports: Report[] = [
    { id: '1', name: 'Monthly Contract Summary', type: 'executive', status: 'completed', createdAt: '2024-01-20T10:00:00Z' },
    { id: '2', name: 'Compliance Report', type: 'compliance', status: 'scheduled', createdAt: '2024-01-19T10:00:00Z', schedule: 'weekly', nextRun: '2024-01-26T10:00:00Z' }
  ];

  const mockTemplates: Template[] = [
    { id: '1', name: 'Contract Summary', category: 'Executive', description: 'Monthly overview of contracts', fields: ['status', 'value', 'vendor'] },
    { id: '2', name: 'Risk Assessment', category: 'Compliance', description: 'Risk analysis report', fields: ['risk_score', 'mitigation', 'owner'] }
  ];

  const handleGenerateReport = () => {
    setStatus('Generating report...');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleRunNow = () => {
    setStatus('Running report...');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleSaveConfig = () => {
    setStatus('Configuration saved');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleClearCache = () => {
    setStatus('Cache cleared');
    setTimeout(() => setStatus(''), 2000);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Reports</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">234</p>
          <p className="text-sm text-green-600 mt-1">↑ 12 this week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Scheduled Reports</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">18</p>
          <p className="text-sm text-gray-600 mt-1">Active schedules</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Subscriptions</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">156</p>
          <p className="text-sm text-gray-600 mt-1">Subscribers</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Templates</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">24</p>
          <p className="text-sm text-gray-600 mt-1">Available</p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Recent Reports</h3>
        <div data-testid="recent-reports-list" className="space-y-2">
          {mockReports.map(report => (
            <div key={report.id} className="flex justify-between items-center p-2 border rounded">
              <span>{report.name}</span>
              <span className={`px-2 py-1 text-xs rounded ${
                report.status === 'completed' ? 'bg-green-100 text-green-800' :
                report.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>{report.status}</span>
            </div>
          ))}
        </div>
      </div>
      {searchTerm && <p className="text-sm text-gray-600">Showing results for: {searchTerm}</p>}
      {dateRange !== 'all' && <p className="text-sm text-gray-600">Filtered by date range</p>}
      {reportType !== 'all' && <p className="text-sm text-gray-600">Executive reports</p>}
    </div>
  );

  const renderScheduledTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Scheduled Reports</h3>
        <div data-testid="scheduled-reports-table" className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Report Name</th>
                <th className="px-4 py-2 text-left">Frequency</th>
                <th className="px-4 py-2 text-left">Next Run</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2">Daily Contract Report</td>
                <td className="px-4 py-2">Daily</td>
                <td className="px-4 py-2">Tomorrow 2:00 AM</td>
                <td className="px-4 py-2"><span className="text-green-600">Active</span></td>
                <td className="px-4 py-2">
                  <button onClick={() => setStatus('Paused')} className="text-blue-600 hover:underline mr-2">Pause</button>
                  <button className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2">Weekly Summary</td>
                <td className="px-4 py-2">Weekly</td>
                <td className="px-4 py-2">Monday 9:00 AM</td>
                <td className="px-4 py-2"><span className="text-green-600">Active</span></td>
                <td className="px-4 py-2">
                  <button onClick={() => setStatus('Paused')} className="text-blue-600 hover:underline mr-2">Pause</button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2">Monthly Analytics</td>
                <td className="px-4 py-2">Monthly</td>
                <td className="px-4 py-2">Feb 1, 2024</td>
                <td className="px-4 py-2"><span className="text-yellow-600">Paused</span></td>
                <td className="px-4 py-2">
                  <button className="text-blue-600 hover:underline">Resume</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {canSchedule && (
          <button onClick={() => setShowScheduleDialog(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Schedule Report
          </button>
        )}
      </div>
    </div>
  );

  const renderBuilderTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Report Builder</h3>
        <div data-testid="report-builder" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Data Sources</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" /> Contracts
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" /> Vendors
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" /> Analytics
                </label>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Available Fields</h4>
              <div data-testid="field-selector" className="border rounded p-2 h-32 overflow-y-auto">
                <div className="space-y-1 text-sm">
                  <div className="p-1 hover:bg-gray-100 cursor-move">Contract ID</div>
                  <div className="p-1 hover:bg-gray-100 cursor-move">Contract Name</div>
                  <div className="p-1 hover:bg-gray-100 cursor-move">Value</div>
                  <div className="p-1 hover:bg-gray-100 cursor-move">Status</div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Selected Fields</h4>
            <div className="border rounded p-2 min-h-[100px]">
              <p className="text-gray-500 text-sm">Drag fields here</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setShowTemplateDialog(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Add Filter
            </button>
            <button onClick={() => setPreviewMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Preview
            </button>
          </div>
        </div>
      </div>
      {previewMode && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Report Preview</h3>
          <div data-testid="report-preview" className="border rounded p-4">
            <p className="text-gray-600">Preview content will appear here</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Report Templates</h3>
        <div className="mb-4 flex space-x-2">
          <button className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Executive</button>
          <button className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Operational</button>
          <button className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Compliance</button>
          <button className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Financial</button>
        </div>
        <div data-testid="template-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockTemplates.map(template => (
            <div key={template.id} className="border rounded-lg p-4">
              <h4 className="font-medium">{template.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              <div className="mt-3 flex space-x-2">
                <button onClick={() => setStatus('Generating report...')}
                  className="text-blue-600 hover:underline text-sm">Use Template</button>
                {canEdit && (
                  <>
                    <button onClick={() => setShowTemplateDialog(true)}
                      className="text-green-600 hover:underline text-sm">Edit</button>
                    <button className="text-red-600 hover:underline text-sm">Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowTemplateDialog(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Create Template
          </button>
        )}
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Export Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`border rounded-lg p-4 cursor-pointer ${selectedFormat === 'pdf' ? 'border-blue-500' : ''}`}
            onClick={() => setSelectedFormat('pdf')}>
            <h4 className="font-medium">PDF</h4>
            <p className="text-sm text-gray-600 mt-1">Formatted document with charts</p>
            {selectedFormat === 'pdf' && (
              <div className="mt-3 space-y-2 text-sm">
                <div>Page Size: A4</div>
                <div>Orientation: Portrait</div>
                <div>Include Charts: Yes</div>
              </div>
            )}
          </div>
          <div className={`border rounded-lg p-4 cursor-pointer ${selectedFormat === 'excel' ? 'border-blue-500' : ''}`}
            onClick={() => setSelectedFormat('excel')}>
            <h4 className="font-medium">Excel</h4>
            <p className="text-sm text-gray-600 mt-1">Spreadsheet with formulas</p>
            {selectedFormat === 'excel' && (
              <div className="mt-3 space-y-2 text-sm">
                <div>Include Formulas: Yes</div>
                <div>Multiple Sheets: Yes</div>
              </div>
            )}
          </div>
          <div className={`border rounded-lg p-4 cursor-pointer ${selectedFormat === 'csv' ? 'border-blue-500' : ''}`}
            onClick={() => setSelectedFormat('csv')}>
            <h4 className="font-medium">CSV</h4>
            <p className="text-sm text-gray-600 mt-1">Raw data export</p>
            {selectedFormat === 'csv' && (
              <div className="mt-3 space-y-2 text-sm">
                <div>Delimiter: Comma</div>
                <div>Include Headers: Yes</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDistributionTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Distribution Settings</h3>
        <div className="mb-4">
          <h4 className="font-medium mb-2">Recipients</h4>
          <div className="mb-3">
            <h5 className="text-sm font-medium text-gray-700 mb-1">Email Recipients</h5>
            <div data-testid="recipient-list" className="border rounded p-2 space-y-1">
              <div className="flex justify-between items-center p-1">
                <span>john.doe@company.com</span>
                <button className="text-red-600 hover:underline text-sm">Remove</button>
              </div>
              <div className="flex justify-between items-center p-1">
                <span>jane.smith@company.com</span>
                <button className="text-red-600 hover:underline text-sm">Remove</button>
              </div>
            </div>
            <button onClick={() => setShowRecipientDialog(true)}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              Add Recipient
            </button>
          </div>
        </div>
        <div className="mb-4">
          <h4 className="font-medium mb-2">Distribution Channels</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" defaultChecked /> Email
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" /> Slack
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" /> Teams
            </label>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Delivery Schedule</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="radio" name="delivery" className="mr-2" defaultChecked /> Send Immediately
            </label>
            <label className="flex items-center">
              <input type="radio" name="delivery" className="mr-2" /> Schedule Delivery
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVersionsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Version History</h3>
        <div data-testid="version-list" className="space-y-2">
          <div className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Version 3</h4>
                <p className="text-sm text-gray-600">Created: Jan 20, 2024 | Modified: Jan 20, 2024</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setCompareMode(true)}
                  className="text-blue-600 hover:underline text-sm">Compare</button>
                <button onClick={() => setStatus('Restore version?')}
                  className="text-green-600 hover:underline text-sm">Restore</button>
              </div>
            </div>
          </div>
          <div className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Version 2</h4>
                <p className="text-sm text-gray-600">Created: Jan 15, 2024 | Modified: Jan 18, 2024</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setCompareMode(true)}
                  className="text-blue-600 hover:underline text-sm">Compare</button>
                <button className="text-green-600 hover:underline text-sm">Restore</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {compareMode && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-3">Version Comparison</h3>
          <div data-testid="version-comparison" className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <h4 className="font-medium mb-2">Version 2</h4>
              <p className="text-sm text-gray-600">Previous version content</p>
            </div>
            <div className="border rounded p-3">
              <h4 className="font-medium mb-2">Version 3</h4>
              <p className="text-sm text-gray-600">Current version content</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAccessTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Access Control</h3>
        <div className="mb-4">
          <h4 className="font-medium mb-2">Permissions</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 border rounded">
              <span>View</span>
              <select className="px-2 py-1 border rounded">
                <option>All Users</option>
                <option>Managers Only</option>
                <option>Admin Only</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span>Edit</span>
              <select className="px-2 py-1 border rounded">
                <option>Admin Only</option>
                <option>Managers</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span>Delete</span>
              <select className="px-2 py-1 border rounded">
                <option>Admin Only</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span>Share</span>
              <select className="px-2 py-1 border rounded">
                <option>All Users</option>
                <option>Restricted</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <h4 className="font-medium mb-2">User Roles</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between p-2 border rounded">
              <span>Admin</span>
              <span className="text-green-600">Full Access</span>
            </div>
            <div className="flex justify-between p-2 border rounded">
              <span>Manager</span>
              <span className="text-blue-600">Edit Access</span>
            </div>
            <div className="flex justify-between p-2 border rounded">
              <span>Viewer</span>
              <span className="text-gray-600">View Only</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Visibility</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="radio" name="visibility" className="mr-2" /> Public
            </label>
            <label className="flex items-center">
              <input type="radio" name="visibility" className="mr-2" defaultChecked /> Private
            </label>
            <label className="flex items-center">
              <input type="radio" name="visibility" className="mr-2" /> Restricted
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCacheTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Cache Settings</h3>
        <div className="mb-4">
          <h4 className="font-medium mb-2">Cache Duration</h4>
          <select className="px-3 py-2 border rounded">
            <option>1 hour</option>
            <option>6 hours</option>
            <option>24 hours</option>
            <option>7 days</option>
          </select>
        </div>
        <div className="mb-4">
          <h4 className="font-medium mb-2">Cache Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Cache Hit Rate</p>
              <p className="text-xl font-bold">87%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cache Size</p>
              <p className="text-xl font-bold">234 MB</p>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Cached Reports</h4>
          <div data-testid="cache-list" className="border rounded p-2 space-y-1">
            <div className="flex justify-between items-center p-1">
              <span className="text-sm">Monthly Summary - Jan 2024</span>
              <span className="text-xs text-gray-500">Cached 2h ago</span>
            </div>
            <div className="flex justify-between items-center p-1">
              <span className="text-sm">Compliance Report - Q4 2023</span>
              <span className="text-xs text-gray-500">Cached 5h ago</span>
            </div>
          </div>
        </div>
        <button onClick={handleClearCache}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Clear Cache
        </button>
      </div>
    </div>
  );

  const renderSubscriptionsTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Report Subscriptions</h3>
        <div data-testid="subscription-list" className="space-y-2">
          <div className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Monthly Contract Summary</h4>
                <p className="text-sm text-gray-600">Subscriber: john.doe@company.com</p>
                <p className="text-sm text-gray-600">Frequency: Monthly | Last sent: Jan 1, 2024</p>
              </div>
              <button className="text-blue-600 hover:underline">Manage</button>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <h4 className="font-medium mb-2">Subscription Preferences</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" defaultChecked /> Email Notifications
            </label>
            <div className="ml-6">
              <label className="text-sm">Format Preference:</label>
              <select className="ml-2 px-2 py-1 border rounded text-sm">
                <option>PDF</option>
                <option>Excel</option>
              </select>
            </div>
          </div>
        </div>
        <button onClick={() => setShowSubscribeDialog(true)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Subscribe
        </button>
      </div>
    </div>
  );

  const renderExecutiveTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-3">Executive Dashboard</h3>
        <div data-testid="executive-metrics" className="mb-4">
          <h4 className="font-medium mb-2">Key Performance Indicators</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Contract Value</p>
              <p className="text-2xl font-bold">$45.2M</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Compliance Rate</p>
              <p className="text-2xl font-bold text-green-600">94.5%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Risk Score</p>
              <p className="text-2xl font-bold text-yellow-600">Medium</p>
            </div>
          </div>
        </div>
        <div data-testid="executive-charts" className="mb-4">
          <h4 className="font-medium mb-2">Trend Analysis</h4>
          <div className="h-48 bg-gray-100 rounded flex items-center justify-center">
            Executive charts placeholder
          </div>
        </div>
        <button onClick={() => setShowCustomizeDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Customize
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', content: renderOverviewTab },
    { id: 'scheduled', label: 'Scheduled', content: renderScheduledTab },
    { id: 'builder', label: 'Builder', content: renderBuilderTab },
    { id: 'templates', label: 'Templates', content: renderTemplatesTab },
    { id: 'export', label: 'Export', content: renderExportTab },
    { id: 'distribution', label: 'Distribution', content: renderDistributionTab },
    { id: 'versions', label: 'Versions', content: renderVersionsTab },
    { id: 'access', label: 'Access', content: renderAccessTab },
    { id: 'cache', label: 'Cache', content: renderCacheTab },
    { id: 'subscriptions', label: 'Subscriptions', content: renderSubscriptionsTab },
    { id: 'executive', label: 'Executive', content: renderExecutiveTab }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="report-generation-system">
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <main role="main" aria-label="Report Generation System">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Report Generation System</h1>
          <p className="text-gray-600">Create and manage automated reports for analytics and insights</p>
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
            <input type="text" placeholder="Search reports..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border rounded" />
            <label htmlFor="date-range" className="sr-only">Date Range</label>
            <select id="date-range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border rounded">
              <option value="all">All Time</option>
              <option value="last30days">Last 30 Days</option>
              <option value="last90days">Last 90 Days</option>
            </select>
            <label htmlFor="report-type" className="sr-only">Report Type</label>
            <select id="report-type" value={reportType} onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 border rounded">
              <option value="all">All Types</option>
              <option value="executive">Executive</option>
              <option value="operational">Operational</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
        </div>
        <div className="mb-4 flex justify-end space-x-2">
          <button onClick={handleGenerateReport}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Generate Report
          </button>
          <button onClick={handleSaveConfig}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Save Configuration
          </button>
          <button onClick={handleRunNow}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Run Now
          </button>
        </div>
        <div role="tabpanel">{tabs.find(t => t.id === activeTab)?.content()}</div>
        {showScheduleDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Schedule Report</h2>
              <label htmlFor="report-name" className="block text-sm font-medium text-gray-700 mb-1">
                Report Name
              </label>
              <input id="report-name" type="text" className="w-full px-3 py-2 border rounded mb-3" />
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                Frequency
              </label>
              <select id="frequency" className="w-full px-3 py-2 border rounded mb-3">
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
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                <button onClick={() => { setShowScheduleDialog(false); setStatus('Report scheduled'); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Schedule</button>
              </div>
            </div>
          </div>
        )}
        {showTemplateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Create Template</h2>
              <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input id="template-name" type="text" className="w-full px-3 py-2 border rounded mb-3" />
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select id="category" className="w-full px-3 py-2 border rounded mb-3">
                <option>Executive</option>
                <option>Operational</option>
                <option>Compliance</option>
              </select>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea id="description" className="w-full px-3 py-2 border rounded mb-3" rows={3}></textarea>
              <label htmlFor="field" className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              <input id="field" type="text" className="w-full px-3 py-2 border rounded mb-1" />
              <label htmlFor="operator" className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
              <select id="operator" className="w-full px-3 py-2 border rounded mb-1">
                <option>Equals</option>
                <option>Contains</option>
              </select>
              <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input id="value" type="text" className="w-full px-3 py-2 border rounded mb-4" />
              <div className="flex space-x-2">
                <button onClick={() => setShowTemplateDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                <button onClick={() => setShowTemplateDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}
        {showRecipientDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Add Recipient</h2>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="email" type="email" className="w-full px-3 py-2 border rounded mb-3" />
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input id="name" type="text" className="w-full px-3 py-2 border rounded mb-4" />
              <div className="flex space-x-2">
                <button onClick={() => setShowRecipientDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                <button onClick={() => setShowRecipientDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              </div>
            </div>
          </div>
        )}
        {showSubscribeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Subscribe to Report</h2>
              <label htmlFor="report" className="block text-sm font-medium text-gray-700 mb-1">Report</label>
              <select id="report" className="w-full px-3 py-2 border rounded mb-3">
                <option>Monthly Contract Summary</option>
                <option>Compliance Report</option>
              </select>
              <label htmlFor="delivery-frequency" className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Frequency
              </label>
              <select id="delivery-frequency" className="w-full px-3 py-2 border rounded mb-4">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
              <div className="flex space-x-2">
                <button onClick={() => setShowSubscribeDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                <button onClick={() => setShowSubscribeDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Subscribe</button>
              </div>
            </div>
          </div>
        )}
        {showCustomizeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Customize Dashboard</h2>
              <h3 className="font-medium mb-2">Select Widgets</h3>
              <div className="space-y-2 mb-4">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked /> KPI Summary
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" defaultChecked /> Trend Charts
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" /> Risk Matrix
                </label>
              </div>
              <h3 className="font-medium mb-2">Layout Options</h3>
              <select className="w-full px-3 py-2 border rounded mb-4">
                <option>2 Column</option>
                <option>3 Column</option>
                <option>Grid</option>
              </select>
              <div className="flex space-x-2">
                <button onClick={() => setShowCustomizeDialog(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
                <button onClick={() => setShowCustomizeDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};