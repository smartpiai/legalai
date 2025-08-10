/**
 * Dashboard Store - Centralized state management for dashboard data
 * Using Zustand for state management with persistence and devtools support
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { dashboardService } from '../services/dashboard.service';

interface ExecutiveSummary {
  total_contracts: number;
  active_contracts: number;
  expiring_soon: number;
  total_value: number;
  compliance_rate: number;
  risk_score: number;
  recent_activities: number;
}

interface ContractMetrics {
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
  trend: Array<{
    month: string;
    count: number;
    value: number;
  }>;
}

interface RiskAnalytics {
  high_risk_contracts: Array<{
    id: string;
    title: string;
    risk_score: number;
    risk_factors: string[];
  }>;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  top_risk_factors: Array<{
    factor: string;
    count: number;
  }>;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
  };
  entity: {
    type: string;
    id: string;
    title: string;
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: string;
}

interface DashboardState {
  // Data
  executiveSummary: ExecutiveSummary | null;
  contractMetrics: ContractMetrics | null;
  riskAnalytics: RiskAnalytics | null;
  recentActivities: Activity[];
  notifications: Notification[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  currentView: 'executive' | 'analytics' | 'risk' | 'activity';
  
  // Preferences
  preferences: {
    defaultView: 'executive' | 'analytics' | 'risk' | 'activity';
    theme: 'light' | 'dark';
    refreshInterval: number;
    notifications: boolean;
  };
  
  // WebSocket
  isConnected: boolean;
  reconnectAttempts: number;
  
  // Actions
  fetchExecutiveSummary: () => Promise<void>;
  fetchContractMetrics: (startDate?: string, endDate?: string) => Promise<void>;
  fetchRiskAnalytics: () => Promise<void>;
  fetchRecentActivities: (limit?: number, offset?: number, activityType?: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  
  // Notification actions
  markNotificationAsRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  
  // UI actions
  setCurrentView: (view: 'executive' | 'analytics' | 'risk' | 'activity') => void;
  setPreferences: (preferences: Partial<DashboardState['preferences']>) => void;
  clearError: () => void;
  
  // WebSocket actions
  setConnectionStatus: (connected: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  
  // Data refresh
  refreshAllData: () => Promise<void>;
  refreshCurrentView: () => Promise<void>;
  
  // Cache management
  clearCache: () => void;
  prefetchData: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        executiveSummary: null,
        contractMetrics: null,
        riskAnalytics: null,
        recentActivities: [],
        notifications: [],
        
        isLoading: false,
        error: null,
        lastUpdated: null,
        currentView: 'executive',
        
        preferences: {
          defaultView: 'executive',
          theme: 'light',
          refreshInterval: 60,
          notifications: true,
        },
        
        isConnected: false,
        reconnectAttempts: 0,
        
        // Fetch executive summary
        fetchExecutiveSummary: async () => {
          set({ isLoading: true, error: null });
          try {
            const data = await dashboardService.getExecutiveSummary();
            set({ 
              executiveSummary: data, 
              lastUpdated: new Date(),
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch executive summary',
              isLoading: false 
            });
          }
        },
        
        // Fetch contract metrics
        fetchContractMetrics: async (startDate?: string, endDate?: string) => {
          set({ isLoading: true, error: null });
          try {
            const data = await dashboardService.getContractMetrics(startDate, endDate);
            set({ 
              contractMetrics: data, 
              lastUpdated: new Date(),
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch contract metrics',
              isLoading: false 
            });
          }
        },
        
        // Fetch risk analytics
        fetchRiskAnalytics: async () => {
          set({ isLoading: true, error: null });
          try {
            const data = await dashboardService.getRiskAnalytics();
            set({ 
              riskAnalytics: data, 
              lastUpdated: new Date(),
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch risk analytics',
              isLoading: false 
            });
          }
        },
        
        // Fetch recent activities
        fetchRecentActivities: async (
          limit: number = 20,
          offset: number = 0,
          activityType?: string
        ) => {
          set({ isLoading: true, error: null });
          try {
            const data = await dashboardService.getRecentActivities(limit, offset, activityType);
            set({ 
              recentActivities: data.items, 
              lastUpdated: new Date(),
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch recent activities',
              isLoading: false 
            });
          }
        },
        
        // Fetch notifications
        fetchNotifications: async () => {
          try {
            const data = await dashboardService.getNotifications();
            set({ notifications: data });
          } catch (error) {
            console.error('Failed to fetch notifications:', error);
          }
        },
        
        // Mark notification as read
        markNotificationAsRead: async (id: string) => {
          try {
            await dashboardService.markNotificationAsRead(id);
            set(state => ({
              notifications: state.notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
              )
            }));
          } catch (error) {
            console.error('Failed to mark notification as read:', error);
          }
        },
        
        // Clear all notifications
        clearAllNotifications: async () => {
          try {
            await dashboardService.clearAllNotifications();
            set(state => ({
              notifications: state.notifications.map(n => ({ ...n, read: true }))
            }));
          } catch (error) {
            console.error('Failed to clear notifications:', error);
          }
        },
        
        // Add notification (for real-time updates)
        addNotification: (notification: Notification) => {
          set(state => ({
            notifications: [notification, ...state.notifications]
          }));
        },
        
        // Set current view
        setCurrentView: (view: 'executive' | 'analytics' | 'risk' | 'activity') => {
          set({ currentView: view });
        },
        
        // Set preferences
        setPreferences: (preferences: Partial<DashboardState['preferences']>) => {
          set(state => ({
            preferences: { ...state.preferences, ...preferences }
          }));
        },
        
        // Clear error
        clearError: () => {
          set({ error: null });
        },
        
        // WebSocket connection status
        setConnectionStatus: (connected: boolean) => {
          set({ isConnected: connected });
          if (connected) {
            get().resetReconnectAttempts();
          }
        },
        
        incrementReconnectAttempts: () => {
          set(state => ({ reconnectAttempts: state.reconnectAttempts + 1 }));
        },
        
        resetReconnectAttempts: () => {
          set({ reconnectAttempts: 0 });
        },
        
        // Refresh all data
        refreshAllData: async () => {
          const promises = [
            get().fetchExecutiveSummary(),
            get().fetchContractMetrics(),
            get().fetchRiskAnalytics(),
            get().fetchRecentActivities(),
            get().fetchNotifications(),
          ];
          
          await Promise.allSettled(promises);
        },
        
        // Refresh current view data
        refreshCurrentView: async () => {
          const view = get().currentView;
          
          switch (view) {
            case 'executive':
              await get().fetchExecutiveSummary();
              break;
            case 'analytics':
              await get().fetchContractMetrics();
              break;
            case 'risk':
              await get().fetchRiskAnalytics();
              break;
            case 'activity':
              await get().fetchRecentActivities();
              break;
          }
          
          // Always refresh notifications
          await get().fetchNotifications();
        },
        
        // Clear cache
        clearCache: () => {
          dashboardService.invalidateCache();
          set({
            executiveSummary: null,
            contractMetrics: null,
            riskAnalytics: null,
            recentActivities: [],
            lastUpdated: null,
          });
        },
        
        // Prefetch data for performance
        prefetchData: async () => {
          await dashboardService.prefetchDashboardData();
          // Data will be cached in the service layer
        },
      }),
      {
        name: 'dashboard-store',
        // Only persist preferences and UI state
        partialize: (state) => ({
          preferences: state.preferences,
          currentView: state.currentView,
        }),
      }
    ),
    {
      name: 'DashboardStore',
    }
  )
);

// Selector hooks for specific data
export const useExecutiveSummary = () => useDashboardStore(state => state.executiveSummary);
export const useContractMetrics = () => useDashboardStore(state => state.contractMetrics);
export const useRiskAnalytics = () => useDashboardStore(state => state.riskAnalytics);
export const useRecentActivities = () => useDashboardStore(state => state.recentActivities);
export const useNotifications = () => useDashboardStore(state => state.notifications);
export const useDashboardPreferences = () => useDashboardStore(state => state.preferences);
export const useDashboardLoading = () => useDashboardStore(state => state.isLoading);
export const useDashboardError = () => useDashboardStore(state => state.error);