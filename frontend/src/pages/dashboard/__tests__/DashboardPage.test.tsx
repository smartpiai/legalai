import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DashboardPage from '../DashboardPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

// Mock modules
vi.mock('../../../stores/authStore');
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../components/dashboard/ExecutiveDashboard', () => ({
  ExecutiveDashboard: ({ currentUser }: any) => (
    <div data-testid="executive-dashboard">
      Executive Dashboard for {currentUser.name}
    </div>
  ),
}));

vi.mock('../../../components/contracts/RecentActivityFeed', () => ({
  RecentActivityFeed: () => (
    <div data-testid="recent-activity-feed">Recent Activity</div>
  ),
}));

vi.mock('../../../components/analytics/ContractAnalyticsView', () => ({
  ContractAnalyticsView: () => (
    <div data-testid="contract-analytics">Contract Analytics</div>
  ),
}));

vi.mock('../../../components/risk/RiskAnalyticsDashboard', () => ({
  RiskAnalyticsDashboard: () => (
    <div data-testid="risk-analytics">Risk Analytics</div>
  ),
}));

describe('DashboardPage', () => {
  let queryClient: QueryClient;
  const mockUser = {
    id: 'user1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'contract_manager',
    permissions: ['view_dashboard', 'view_analytics', 'view_contracts'],
    tenant_id: 'tenant1',
    department: 'Legal',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Page Layout', () => {
    it('should render the dashboard page', () => {
      renderComponent();
      
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    });

    it('should show user greeting', () => {
      renderComponent();
      
      expect(screen.getByText(/Welcome back, Test User/i)).toBeInTheDocument();
    });

    it('should display current date', () => {
      renderComponent();
      
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(screen.getByText(date)).toBeInTheDocument();
    });

    it('should show department info', () => {
      renderComponent();
      
      expect(screen.getByText(/Legal Department/i)).toBeInTheDocument();
    });
  });

  describe('Dashboard Views', () => {
    it('should display view toggle buttons', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /executive/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /risk/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument();
    });

    it('should show executive dashboard by default', () => {
      renderComponent();
      
      expect(screen.getByTestId('executive-dashboard')).toBeInTheDocument();
    });

    it('should switch to analytics view', async () => {
      renderComponent();
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      fireEvent.click(analyticsButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('contract-analytics')).toBeInTheDocument();
      });
    });

    it('should switch to risk view', async () => {
      renderComponent();
      
      const riskButton = screen.getByRole('button', { name: /risk/i });
      fireEvent.click(riskButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('risk-analytics')).toBeInTheDocument();
      });
    });

    it('should switch to activity view', async () => {
      renderComponent();
      
      const activityButton = screen.getByRole('button', { name: /activity/i });
      fireEvent.click(activityButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('recent-activity-feed')).toBeInTheDocument();
      });
    });

    it('should highlight active view button', () => {
      renderComponent();
      
      const executiveButton = screen.getByRole('button', { name: /executive/i });
      expect(executiveButton).toHaveClass('bg-blue-600');
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      fireEvent.click(analyticsButton);
      
      expect(analyticsButton).toHaveClass('bg-blue-600');
      expect(executiveButton).not.toHaveClass('bg-blue-600');
    });
  });

  describe('Quick Actions', () => {
    it('should display quick action buttons', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /new contract/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('should navigate to new contract page', () => {
      renderComponent();
      
      const newContractButton = screen.getByRole('button', { name: /new contract/i });
      fireEvent.click(newContractButton);
      
      expect(window.location.pathname).toBe('/contracts/new');
    });

    it('should open upload dialog', () => {
      renderComponent();
      
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      fireEvent.click(uploadButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Upload Documents/i)).toBeInTheDocument();
    });

    it('should navigate to reports page', () => {
      renderComponent();
      
      const reportsButton = screen.getByRole('button', { name: /view reports/i });
      fireEvent.click(reportsButton);
      
      expect(window.location.pathname).toBe('/reports');
    });

    it('should open search dialog', () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search contracts/i)).toBeInTheDocument();
    });
  });

  describe('Notifications Panel', () => {
    it('should display notifications icon with count', () => {
      renderComponent();
      
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      expect(notificationButton).toBeInTheDocument();
      expect(screen.getByTestId('notification-count')).toHaveTextContent('3');
    });

    it('should toggle notifications panel', () => {
      renderComponent();
      
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);
      
      expect(screen.getByTestId('notifications-panel')).toBeInTheDocument();
      expect(screen.getByText(/Recent Notifications/i)).toBeInTheDocument();
    });

    it('should display notification items', () => {
      renderComponent();
      
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);
      
      expect(screen.getByText(/Contract CON-2024-001 requires review/i)).toBeInTheDocument();
      expect(screen.getByText(/New risk identified/i)).toBeInTheDocument();
    });

    it('should mark notification as read', async () => {
      renderComponent();
      
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);
      
      const markReadButton = screen.getAllByRole('button', { name: /mark as read/i })[0];
      fireEvent.click(markReadButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
      });
    });

    it('should clear all notifications', async () => {
      renderComponent();
      
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);
      
      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      fireEvent.click(clearAllButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      });
    });
  });

  describe('Settings Menu', () => {
    it('should display settings button', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });

    it('should open settings menu', () => {
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /preferences/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
    });

    it('should navigate to profile page', () => {
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      const profileItem = screen.getByRole('menuitem', { name: /profile/i });
      fireEvent.click(profileItem);
      
      expect(window.location.pathname).toBe('/dashboard/profile');
    });

    it('should open preferences dialog', () => {
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      const preferencesItem = screen.getByRole('menuitem', { name: /preferences/i });
      fireEvent.click(preferencesItem);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Dashboard Preferences/i)).toBeInTheDocument();
    });

    it('should handle logout', async () => {
      const mockLogout = vi.fn();
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        logout: mockLogout,
      });
      
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      const logoutItem = screen.getByRole('menuitem', { name: /logout/i });
      fireEvent.click(logoutItem);
      
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Preferences', () => {
    it('should save view preference', async () => {
      renderComponent();
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      fireEvent.click(analyticsButton);
      
      // Refresh page
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('contract-analytics')).toBeInTheDocument();
      });
    });

    it('should save theme preference', async () => {
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      const preferencesItem = screen.getByRole('menuitem', { name: /preferences/i });
      fireEvent.click(preferencesItem);
      
      const darkModeToggle = screen.getByLabelText(/dark mode/i);
      fireEvent.click(darkModeToggle);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should save refresh interval', async () => {
      renderComponent();
      
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
      
      const preferencesItem = screen.getByRole('menuitem', { name: /preferences/i });
      fireEvent.click(preferencesItem);
      
      const intervalSelect = screen.getByLabelText(/refresh interval/i);
      fireEvent.change(intervalSelect, { target: { value: '30' } });
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Preferences saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should show search dialog', () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search contracts, documents, templates/i)).toBeInTheDocument();
    });

    it('should display search results', async () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      const searchInput = screen.getByPlaceholderText(/Search contracts/i);
      await userEvent.type(searchInput, 'service agreement');
      
      await waitFor(() => {
        expect(screen.getByText(/Service Agreement ABC/i)).toBeInTheDocument();
        expect(screen.getByText(/CON-2024-001/i)).toBeInTheDocument();
      });
    });

    it('should navigate to search result', async () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
      
      const searchInput = screen.getByPlaceholderText(/Search contracts/i);
      await userEvent.type(searchInput, 'service');
      
      await waitFor(() => {
        const resultItem = screen.getByTestId('search-result-1');
        fireEvent.click(resultItem);
      });
      
      expect(window.location.pathname).toBe('/contracts/contract1');
    });

    it('should support keyboard shortcuts', () => {
      renderComponent();
      
      // Press Ctrl+K
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search contracts/i)).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      expect(screen.getByTestId('dashboard-page')).toHaveClass('mobile-view');
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    it('should show mobile menu', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const menuButton = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(menuButton);
      
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    });

    it('should stack view buttons on mobile', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      const viewButtons = screen.getByTestId('view-buttons');
      expect(viewButtons).toHaveClass('flex-col');
    });
  });

  describe('Permissions', () => {
    it('should hide analytics view without permission', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_dashboard'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.queryByRole('button', { name: /analytics/i })).not.toBeInTheDocument();
    });

    it('should hide risk view without permission', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_dashboard'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.queryByRole('button', { name: /risk/i })).not.toBeInTheDocument();
    });

    it('should hide new contract button without permission', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, permissions: ['view_dashboard'] },
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.queryByRole('button', { name: /new contract/i })).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        isAuthenticated: true,
      });
      
      renderComponent();
      
      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle component load errors', async () => {
      vi.mock('../../../components/dashboard/ExecutiveDashboard', () => ({
        ExecutiveDashboard: () => {
          throw new Error('Component failed to load');
        },
      }));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard');
      expect(screen.getByRole('region', { name: /dashboard views/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderComponent();
      
      const firstButton = screen.getByRole('button', { name: /executive/i });
      firstButton.focus();
      
      fireEvent.keyDown(firstButton, { key: 'ArrowRight' });
      
      expect(screen.getByRole('button', { name: /analytics/i })).toHaveFocus();
    });

    it('should announce view changes', async () => {
      renderComponent();
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i });
      fireEvent.click(analyticsButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/Analytics view loaded/i);
      });
    });
  });
});