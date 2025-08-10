import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { dashboardService } from '../../services/dashboard.service';
import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard';
import { RecentActivityFeed } from '../../components/contracts/RecentActivityFeed';
import { ContractAnalyticsView } from '../../components/analytics/ContractAnalyticsView';
import { RiskAnalyticsDashboard } from '../../components/risk/RiskAnalyticsDashboard';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BellIcon,
  CogIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  DocumentChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  AdjustmentsHorizontalIcon,
  SunIcon,
  MoonIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';

type ViewType = 'executive' | 'analytics' | 'risk' | 'activity';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: string;
}

interface Preferences {
  defaultView: ViewType;
  theme: 'light' | 'dark';
  refreshInterval: number;
  notifications: boolean;
}

interface DashboardData {
  executiveSummary?: any;
  contractMetrics?: any;
  riskAnalytics?: any;
  recentActivities?: any;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [currentView, setCurrentView] = useState<ViewType>('executive');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [websocket, setWebsocket] = useState<any>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    defaultView: 'executive',
    theme: 'light',
    refreshInterval: 60,
    notifications: true,
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch data based on current view
      const promises: Promise<any>[] = [];
      
      if (currentView === 'executive') {
        promises.push(dashboardService.getExecutiveSummary());
      } else if (currentView === 'analytics') {
        promises.push(dashboardService.getContractMetrics());
      } else if (currentView === 'risk') {
        promises.push(dashboardService.getRiskAnalytics());
      } else if (currentView === 'activity') {
        promises.push(dashboardService.getRecentActivities());
      }

      // Always fetch notifications
      promises.push(dashboardService.getNotifications());

      const results = await Promise.all(promises);
      
      // Update dashboard data
      const newData: DashboardData = {};
      if (currentView === 'executive') {
        newData.executiveSummary = results[0];
      } else if (currentView === 'analytics') {
        newData.contractMetrics = results[0];
      } else if (currentView === 'risk') {
        newData.riskAnalytics = results[0];
      } else if (currentView === 'activity') {
        newData.recentActivities = results[0];
      }
      
      setDashboardData(prev => ({ ...prev, ...newData }));
      
      // Update notifications (last promise result)
      setNotifications(results[results.length - 1] || []);
      
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [currentView]);

  // Load preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('dashboardPreferences');
    if (savedPreferences) {
      const prefs = JSON.parse(savedPreferences);
      setPreferences(prefs);
      setCurrentView(prefs.defaultView);
      if (prefs.theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  // Fetch data when component mounts or view changes
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, currentView, fetchDashboardData]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!user) return;

    const handleWebSocketMessage = (data: any) => {
      // Handle real-time updates
      if (data.type === 'notification') {
        setNotifications(prev => [data.data, ...prev]);
      } else if (data.type === 'contract_update') {
        // Refresh dashboard data if contract is updated
        fetchDashboardData();
      }
    };

    const handleWebSocketError = (error: Error) => {
      console.error('WebSocket error:', error);
    };

    // Connect to WebSocket
    dashboardService.connectWebSocket(handleWebSocketMessage, handleWebSocketError)
      .then(ws => setWebsocket(ws))
      .catch(err => console.error('Failed to connect WebSocket:', err));

    return () => {
      dashboardService.disconnectWebSocket();
    };
  }, [user, fetchDashboardData]);

  // Auto-refresh based on preferences
  useEffect(() => {
    if (!preferences.refreshInterval || !user) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, preferences.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [preferences.refreshInterval, user, fetchDashboardData]);

  // Save view preference
  useEffect(() => {
    if (currentView !== preferences.defaultView) {
      const newPrefs = { ...preferences, defaultView: currentView };
      setPreferences(newPrefs);
      localStorage.setItem('dashboardPreferences', JSON.stringify(newPrefs));
    }
  }, [currentView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    // Announce to screen readers
    const announcement = document.getElementById('live-region');
    if (announcement) {
      announcement.textContent = `${view.charAt(0).toUpperCase() + view.slice(1)} view loaded`;
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    
    // Mock search results
    setSearchResults([
      {
        id: 'contract1',
        type: 'contract',
        title: 'Service Agreement ABC',
        number: 'CON-2024-001',
        path: '/contracts/contract1',
      },
    ]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleNotificationRead = async (id: string) => {
    try {
      await dashboardService.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      const result = await dashboardService.clearAllNotifications();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      
      // Show success message
      const announcement = document.getElementById('live-region');
      if (announcement) {
        announcement.textContent = `${result.cleared_count} notifications cleared`;
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const handlePreferencesSave = () => {
    localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setShowPreferences(false);
    // Show success message
    const announcement = document.getElementById('live-region');
    if (announcement) {
      announcement.textContent = 'Preferences saved';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!user) {
    return (
      <div data-testid="dashboard-loading" className="flex items-center justify-center min-h-screen">
        <div role="progressbar" className="animate-spin h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg mb-4">Failed to load dashboard</p>
        <button
          onClick={() => setError(null)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page" className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}>
      <main role="main" aria-label="Dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-lg text-gray-600 mt-2">Welcome back, {user.name}</p>
            <p className="text-sm text-gray-500">{currentDate}</p>
            {user.department && (
              <p className="text-sm text-gray-500 mt-1">{user.department} Department</p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900"
                aria-label="notifications"
              >
                {unreadCount > 0 ? (
                  <BellIconSolid className="h-6 w-6 text-blue-600" />
                ) : (
                  <BellIcon className="h-6 w-6" />
                )}
                {unreadCount > 0 && (
                  <span
                    data-testid="notification-count"
                    className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full"
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div
                  data-testid="notifications-panel"
                  className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto"
                >
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Recent Notifications</h3>
                      <button
                        onClick={handleClearAllNotifications}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="divide-y">
                    {notifications.map(notification => (
                      <div key={notification.id} className={`p-4 ${notification.read ? 'bg-gray-50' : 'bg-white'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                          </div>
                          {!notification.read && (
                            <button
                              onClick={() => handleNotificationRead(notification.id)}
                              className="ml-2 text-xs text-blue-600 hover:text-blue-700"
                              aria-label="mark as read"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="settings"
              >
                <CogIcon className="h-6 w-6" />
              </button>
              
              {showSettings && (
                <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowSettings(false);
                      setShowPreferences(true);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4 inline mr-2" />
                    Preferences
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => navigate('/dashboard/profile')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    <UserCircleIcon className="h-4 w-4 inline mr-2" />
                    Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 inline mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {isMobile && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="menu"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {hasPermission('create_contracts') && (
            <button
              onClick={() => navigate('/contracts/new')}
              className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
            >
              <PlusIcon className="h-8 w-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium">New Contract</span>
            </button>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
          >
            <ArrowUpTrayIcon className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium">Upload Document</span>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
          >
            <DocumentChartBarIcon className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium">View Reports</span>
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center"
          >
            <MagnifyingGlassIcon className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium">Search</span>
          </button>
        </div>

        {/* View Toggles */}
        <div
          data-testid="view-buttons"
          role="region"
          aria-label="Dashboard views"
          className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2 mb-8`}
        >
          <button
            onClick={() => handleViewChange('executive')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'executive'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChartBarIcon className="h-5 w-5 inline mr-2" />
            Executive
          </button>
          {hasPermission('view_analytics') && (
            <button
              onClick={() => handleViewChange('analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'analytics'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ChartBarIcon className="h-5 w-5 inline mr-2" />
              Analytics
            </button>
          )}
          {hasPermission('view_analytics') && (
            <button
              onClick={() => handleViewChange('risk')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'risk'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
              Risk
            </button>
          )}
          <button
            onClick={() => handleViewChange('activity')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentView === 'activity'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ClockIcon className="h-5 w-5 inline mr-2" />
            Activity
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="bg-white rounded-lg shadow">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {currentView === 'executive' && (
                <ExecutiveDashboard 
                  currentUser={user} 
                  data={dashboardData.executiveSummary}
                />
              )}
              {currentView === 'analytics' && (
                <ContractAnalyticsView 
                  data={dashboardData.contractMetrics}
                />
              )}
              {currentView === 'risk' && (
                <RiskAnalyticsDashboard 
                  currentUser={user}
                  data={dashboardData.riskAnalytics}
                />
              )}
              {currentView === 'activity' && (
                <div className="p-6">
                  <RecentActivityFeed 
                    data={dashboardData.recentActivities}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Search Dialog */}
        {showSearch && (
          <div role="dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Search</h2>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Search contracts, documents, templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg mb-4"
                autoFocus
              />
              <div className="space-y-2">
                {searchResults.map(result => (
                  <div
                    key={result.id}
                    data-testid={`search-result-${result.id.slice(-1)}`}
                    onClick={() => {
                      navigate(result.path);
                      setShowSearch(false);
                    }}
                    className="p-3 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <p className="font-medium">{result.title}</p>
                    <p className="text-sm text-gray-600">{result.number}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload Dialog */}
        {showUpload && (
          <div role="dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p>Drag and drop files here</p>
              </div>
              <button
                onClick={() => setShowUpload(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Preferences Dialog */}
        {showPreferences && (
          <div role="dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Dashboard Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.theme === 'dark'}
                      onChange={(e) =>
                        setPreferences(prev => ({
                          ...prev,
                          theme: e.target.checked ? 'dark' : 'light',
                        }))
                      }
                      className="mr-2"
                      aria-label="dark mode"
                    />
                    <span>Dark Mode</span>
                  </label>
                </div>
                <div>
                  <label htmlFor="refresh-interval" className="block text-sm font-medium mb-1">
                    Refresh Interval (seconds)
                  </label>
                  <select
                    id="refresh-interval"
                    value={preferences.refreshInterval}
                    onChange={(e) =>
                      setPreferences(prev => ({
                        ...prev,
                        refreshInterval: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    aria-label="refresh interval"
                  >
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="120">120</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreferencesSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div data-testid="mobile-menu" className="fixed inset-0 bg-white z-50 p-4">
            <button onClick={() => setShowMobileMenu(false)} className="mb-4">
              <XMarkIcon className="h-6 w-6" />
            </button>
            {/* Mobile menu content */}
          </div>
        )}

        {/* Live Region for Screen Readers */}
        <div id="live-region" role="status" className="sr-only" aria-live="polite"></div>
      </main>
    </div>
  );
}