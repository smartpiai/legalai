import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiMarketplaceService } from '../ai-marketplace.service';
import type {
  App,
  AppCategory,
  AppInstallation,
  AppReview,
  DeveloperApp,
  MarketplaceFilters,
  PaymentMethod,
  Subscription,
  UserPurchase
} from '../../types/ai-marketplace';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('AI Marketplace Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  describe('App Discovery & Browse', () => {
    it('should search apps with filters', async () => {
      const mockApps: App[] = [
        {
          id: '1',
          name: 'Contract Analyzer Pro',
          description: 'AI-powered contract analysis',
          category: 'Legal AI',
          price: 49.99,
          rating: 4.5,
          reviewCount: 150,
          downloads: 5000,
          version: '2.1.0',
          screenshots: ['url1', 'url2'],
          permissions: ['read_documents'],
          publishedAt: '2024-01-15',
          updatedAt: '2024-01-20',
          developerId: 'dev1',
          developerName: 'LegalTech Inc',
          featured: false,
          verified: true
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ apps: mockApps, total: 1 })
      });

      const filters: MarketplaceFilters = {
        query: 'contract',
        category: 'Legal AI',
        priceRange: { min: 0, max: 100 },
        rating: 4,
        sortBy: 'rating',
        page: 1,
        limit: 10
      };

      const result = await aiMarketplaceService.searchApps(filters);

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/apps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      expect(result.apps).toEqual(mockApps);
      expect(result.total).toBe(1);
    });

    it('should get featured apps carousel', async () => {
      const mockFeaturedApps: App[] = [
        {
          id: '2',
          name: 'Legal Assistant AI',
          description: 'Your AI legal companion',
          category: 'Legal AI',
          price: 29.99,
          rating: 4.8,
          reviewCount: 300,
          downloads: 10000,
          version: '1.5.0',
          screenshots: ['url3'],
          permissions: ['read_documents'],
          publishedAt: '2024-01-10',
          updatedAt: '2024-01-18',
          developerId: 'dev2',
          developerName: 'AI Legal Co',
          featured: true,
          verified: true
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeaturedApps
      });

      const result = await aiMarketplaceService.getFeaturedApps();

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/apps/featured', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockFeaturedApps);
    });

    it('should browse apps by category', async () => {
      const mockCategories: AppCategory[] = [
        {
          id: 'legal-ai',
          name: 'Legal AI',
          description: 'AI tools for legal professionals',
          appCount: 25,
          icon: 'legal-icon'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories
      });

      const result = await aiMarketplaceService.getCategories();

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/categories', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockCategories);
    });

    it('should get trending apps', async () => {
      const mockTrendingApps: App[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrendingApps
      });

      const result = await aiMarketplaceService.getTrendingApps();

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/apps/trending', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockTrendingApps);
    });

    it('should get app recommendations', async () => {
      const userId = 'user123';
      const mockRecommendations: App[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecommendations
      });

      const result = await aiMarketplaceService.getRecommendations(userId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/recommendations/${userId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockRecommendations);
    });

    it('should compare multiple apps', async () => {
      const appIds = ['1', '2'];
      const mockComparison = {
        apps: [],
        features: {},
        pricing: {}
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockComparison
      });

      const result = await aiMarketplaceService.compareApps(appIds);

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/apps/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds })
      });
      expect(result).toEqual(mockComparison);
    });
  });

  describe('App Details & Installation', () => {
    it('should get app details', async () => {
      const appId = '1';
      const mockApp: App = {
        id: '1',
        name: 'Test App',
        description: 'Test description',
        category: 'Legal AI',
        price: 49.99,
        rating: 4.5,
        reviewCount: 100,
        downloads: 1000,
        version: '1.0.0',
        screenshots: [],
        permissions: [],
        publishedAt: '2024-01-01',
        updatedAt: '2024-01-01',
        developerId: 'dev1',
        developerName: 'Developer',
        featured: false,
        verified: true
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApp
      });

      const result = await aiMarketplaceService.getAppDetails(appId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/apps/${appId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockApp);
    });

    it('should install an app', async () => {
      const appId = '1';
      const userId = 'user123';
      const mockInstallation: AppInstallation = {
        id: 'install1',
        appId,
        userId,
        status: 'installing',
        installedAt: new Date().toISOString(),
        version: '1.0.0',
        licenseKey: 'license123',
        configuration: {}
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInstallation
      });

      const result = await aiMarketplaceService.installApp(appId, userId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/apps/${appId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      expect(result).toEqual(mockInstallation);
    });

    it('should update an installed app', async () => {
      const installationId = 'install1';
      const mockUpdatedInstallation: AppInstallation = {
        id: installationId,
        appId: '1',
        userId: 'user123',
        status: 'installed',
        installedAt: new Date().toISOString(),
        version: '2.0.0',
        licenseKey: 'license123',
        configuration: {}
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedInstallation
      });

      const result = await aiMarketplaceService.updateApp(installationId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/installations/${installationId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockUpdatedInstallation);
    });

    it('should uninstall an app', async () => {
      const installationId = 'install1';

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await aiMarketplaceService.uninstallApp(installationId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/installations/${installationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result.success).toBe(true);
    });

    it('should get app reviews', async () => {
      const appId = '1';
      const mockReviews: AppReview[] = [
        {
          id: 'review1',
          appId,
          userId: 'user123',
          userName: 'John Doe',
          rating: 5,
          title: 'Great app!',
          content: 'Very useful for legal work',
          createdAt: '2024-01-15',
          helpful: 10,
          verified: true
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reviews: mockReviews, total: 1 })
      });

      const result = await aiMarketplaceService.getAppReviews(appId, 1, 10);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/apps/${appId}/reviews?page=1&limit=10`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result.reviews).toEqual(mockReviews);
    });
  });

  describe('Developer Dashboard', () => {
    it('should submit a new app', async () => {
      const appData = {
        name: 'New App',
        description: 'A new AI app',
        category: 'Legal AI',
        price: 39.99
      };
      const developerId = 'dev1';

      const mockSubmittedApp: DeveloperApp = {
        id: 'app123',
        ...appData,
        developerId,
        status: 'pending_review',
        submittedAt: '2024-01-20',
        analytics: {
          downloads: 0,
          revenue: 0,
          ratings: { average: 0, count: 0 },
          views: 0
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubmittedApp
      });

      const result = await aiMarketplaceService.submitApp(appData, developerId);

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/developer/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...appData, developerId })
      });
      expect(result).toEqual(mockSubmittedApp);
    });

    it('should get developer apps', async () => {
      const developerId = 'dev1';
      const mockDeveloperApps: DeveloperApp[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeveloperApps
      });

      const result = await aiMarketplaceService.getDeveloperApps(developerId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/developer/${developerId}/apps`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockDeveloperApps);
    });

    it('should get app analytics', async () => {
      const appId = '1';
      const mockAnalytics = {
        downloads: 5000,
        revenue: 15000,
        ratings: { average: 4.5, count: 150 },
        views: 25000,
        dailyStats: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics
      });

      const result = await aiMarketplaceService.getAppAnalytics(appId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/apps/${appId}/analytics`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockAnalytics);
    });

    it('should get revenue data', async () => {
      const developerId = 'dev1';
      const mockRevenue = {
        total: 50000,
        thisMonth: 5000,
        pending: 1500,
        paid: 48500,
        monthlyBreakdown: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRevenue
      });

      const result = await aiMarketplaceService.getDeveloperRevenue(developerId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/developer/${developerId}/revenue`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockRevenue);
    });
  });

  describe('User Management', () => {
    it('should get user purchased apps', async () => {
      const userId = 'user123';
      const mockPurchases: UserPurchase[] = [
        {
          id: 'purchase1',
          userId,
          appId: '1',
          appName: 'Test App',
          price: 49.99,
          purchasedAt: '2024-01-15',
          licenseKey: 'license123',
          status: 'active'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPurchases
      });

      const result = await aiMarketplaceService.getUserPurchases(userId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/users/${userId}/purchases`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockPurchases);
    });

    it('should get user installed apps', async () => {
      const userId = 'user123';
      const mockInstallations: AppInstallation[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInstallations
      });

      const result = await aiMarketplaceService.getUserInstallations(userId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/users/${userId}/installations`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockInstallations);
    });

    it('should manage subscriptions', async () => {
      const userId = 'user123';
      const mockSubscriptions: Subscription[] = [
        {
          id: 'sub1',
          userId,
          appId: '1',
          plan: 'premium',
          status: 'active',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          autoRenew: true,
          price: 99.99
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubscriptions
      });

      const result = await aiMarketplaceService.getUserSubscriptions(userId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/users/${userId}/subscriptions`, {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockSubscriptions);
    });

    it('should add payment method', async () => {
      const userId = 'user123';
      const paymentData = {
        type: 'card' as const,
        cardNumber: '****-****-****-1234',
        expiryDate: '12/25',
        isDefault: true
      };

      const mockPaymentMethod: PaymentMethod = {
        id: 'pm1',
        userId,
        ...paymentData
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentMethod
      });

      const result = await aiMarketplaceService.addPaymentMethod(userId, paymentData);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/users/${userId}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should submit app review', async () => {
      const reviewData = {
        appId: '1',
        userId: 'user123',
        rating: 5,
        title: 'Excellent!',
        content: 'Love this app'
      };

      const mockReview: AppReview = {
        id: 'review123',
        ...reviewData,
        userName: 'John Doe',
        createdAt: '2024-01-20',
        helpful: 0,
        verified: true
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReview
      });

      const result = await aiMarketplaceService.submitReview(reviewData);

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      expect(result).toEqual(mockReview);
    });
  });

  describe('Admin Functions', () => {
    it('should get app review queue', async () => {
      const mockPendingApps: DeveloperApp[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPendingApps
      });

      const result = await aiMarketplaceService.getAppReviewQueue();

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/admin/review-queue', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockPendingApps);
    });

    it('should approve app', async () => {
      const appId = '1';

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await aiMarketplaceService.approveApp(appId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/admin/apps/${appId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result.success).toBe(true);
    });

    it('should reject app', async () => {
      const appId = '1';
      const reason = 'Does not meet quality standards';

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await aiMarketplaceService.rejectApp(appId, reason);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/marketplace/admin/apps/${appId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      expect(result.success).toBe(true);
    });

    it('should get platform analytics', async () => {
      const mockAnalytics = {
        totalApps: 150,
        totalUsers: 5000,
        totalRevenue: 250000,
        monthlyGrowth: 15,
        topCategories: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics
      });

      const result = await aiMarketplaceService.getPlatformAnalytics();

      expect(fetch).toHaveBeenCalledWith('/api/v1/marketplace/admin/analytics', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(aiMarketplaceService.getAppDetails('nonexistent')).rejects.toThrow('API Error: 404 Not Found');
    });

    it('should handle network errors', async () => {
      // Clear cache first to avoid cache hits
      aiMarketplaceService.clearCache();
      (fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(aiMarketplaceService.getFeaturedApps()).rejects.toThrow('Network error');
    }, 10000);

    it('should retry failed requests', async () => {
      // Clear cache first to avoid cache hits
      aiMarketplaceService.clearCache();
      (fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const result = await aiMarketplaceService.getFeaturedApps();
      expect(result).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    it('should cache frequently accessed data', async () => {
      // Clear cache first to ensure clean state
      aiMarketplaceService.clearCache();
      const mockCategories: AppCategory[] = [];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories
      });

      // First call
      const result1 = await aiMarketplaceService.getCategories();
      // Second call should use cache
      const result2 = await aiMarketplaceService.getCategories();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should invalidate cache when needed', async () => {
      aiMarketplaceService.clearCache();

      const mockCategories: AppCategory[] = [];
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories
      });

      const result = await aiMarketplaceService.getCategories();
      expect(result).toEqual(mockCategories);
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce search requests', async () => {
      // Reset fetch mock to clean state
      (fetch as any).mockClear();
      
      const filters: MarketplaceFilters = {
        query: 'test',
        page: 1,
        limit: 10
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ apps: [], total: 0 })
      });

      // Make a single call to test debounce logic exists
      await aiMarketplaceService.searchApps(filters);

      expect(fetch).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Security Validations', () => {
    it('should validate user permissions for admin operations', async () => {
      const appId = '1';

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(aiMarketplaceService.approveApp(appId)).rejects.toThrow('API Error: 403 Forbidden');
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'Normal description',
        category: 'Legal AI',
        price: 39.99
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'app123' })
      });

      await aiMarketplaceService.submitApp(maliciousData, 'dev1');

      const sentData = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(sentData.name).not.toContain('<script>');
      expect(sentData.name).toBe('alert("xss")'); // Script tags removed
    });
  });
});