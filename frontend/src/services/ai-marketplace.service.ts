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
} from '../types/ai-marketplace';

// Cache interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Service class for AI Marketplace operations
class AIMarketplaceService {
  private cache = new Map<string, CacheEntry<any>>();
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEBOUNCE_DELAY = 300; // 300ms
  private readonly MAX_RETRIES = 3;

  /**
   * Generic API request handler with retry logic and error handling
   */
  private async apiRequest<T>(
    url: string,
    options: RequestInit = {},
    retries = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < this.MAX_RETRIES && error instanceof Error) {
        // Retry on network errors or specific error patterns
        if (error.message.includes('Network error') || 
            error.message.includes('fetch') ||
            error.name === 'TypeError') {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
          return this.apiRequest<T>(url, options, retries + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Cache management methods
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Input sanitization
   */
  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .replace(/<script[^>]*>/gi, '')
        .replace(/<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Debounced search function
   */
  private debounce<T extends (...args: any[]) => Promise<any>>(
    func: T,
    key: string
  ): T {
    return ((...args: Parameters<T>) => {
      return new Promise<ReturnType<T>>((resolve, reject) => {
        const existingTimeout = this.debounceTimeouts.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(async () => {
          try {
            const result = await func(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
          this.debounceTimeouts.delete(key);
        }, this.DEBOUNCE_DELAY);

        this.debounceTimeouts.set(key, timeout);
      });
    }) as T;
  }

  // App Discovery & Browse Methods

  /**
   * Search apps with filters (debounced)
   */
  public searchApps = this.debounce(
    async (filters: MarketplaceFilters): Promise<{ apps: App[]; total: number }> => {
      const sanitizedFilters = this.sanitizeInput(filters);
      return this.apiRequest<{ apps: App[]; total: number }>(
        '/api/v1/marketplace/apps/search',
        {
          method: 'POST',
          body: JSON.stringify(sanitizedFilters),
        }
      );
    },
    'search'
  );

  /**
   * Get featured apps carousel
   */
  async getFeaturedApps(): Promise<App[]> {
    const cacheKey = 'featured-apps';
    const cached = this.getCached<App[]>(cacheKey);
    if (cached) return cached;

    const apps = await this.apiRequest<App[]>('/api/v1/marketplace/apps/featured');
    this.setCache(cacheKey, apps);
    return apps;
  }

  /**
   * Browse apps by category
   */
  async getCategories(): Promise<AppCategory[]> {
    const cacheKey = 'categories';
    const cached = this.getCached<AppCategory[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.apiRequest<AppCategory[]>('/api/v1/marketplace/categories');
    this.setCache(cacheKey, categories);
    return categories;
  }

  /**
   * Get trending apps section
   */
  async getTrendingApps(): Promise<App[]> {
    const cacheKey = 'trending-apps';
    const cached = this.getCached<App[]>(cacheKey);
    if (cached) return cached;

    const apps = await this.apiRequest<App[]>('/api/v1/marketplace/apps/trending');
    this.setCache(cacheKey, apps, 10 * 60 * 1000); // 10 minutes cache
    return apps;
  }

  /**
   * Get new releases
   */
  async getNewReleases(): Promise<App[]> {
    return this.apiRequest<App[]>('/api/v1/marketplace/apps/new-releases');
  }

  /**
   * Get top rated apps
   */
  async getTopRatedApps(): Promise<App[]> {
    const cacheKey = 'top-rated-apps';
    const cached = this.getCached<App[]>(cacheKey);
    if (cached) return cached;

    const apps = await this.apiRequest<App[]>('/api/v1/marketplace/apps/top-rated');
    this.setCache(cacheKey, apps, 30 * 60 * 1000); // 30 minutes cache
    return apps;
  }

  /**
   * Get recommendations engine
   */
  async getRecommendations(userId: string): Promise<App[]> {
    return this.apiRequest<App[]>(`/api/v1/marketplace/recommendations/${userId}`);
  }

  /**
   * App comparison tool
   */
  async compareApps(appIds: string[]): Promise<{
    apps: App[];
    features: Record<string, any>;
    pricing: Record<string, any>;
  }> {
    return this.apiRequest('/api/v1/marketplace/apps/compare', {
      method: 'POST',
      body: JSON.stringify({ appIds }),
    });
  }

  /**
   * Collection management
   */
  async getUserCollections(userId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/users/${userId}/collections`);
  }

  async createCollection(userId: string, collection: any): Promise<any> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/collections`, {
      method: 'POST',
      body: JSON.stringify(this.sanitizeInput(collection)),
    });
  }

  /**
   * Wishlist functionality
   */
  async getWishlist(userId: string): Promise<App[]> {
    return this.apiRequest<App[]>(`/api/v1/marketplace/users/${userId}/wishlist`);
  }

  async addToWishlist(userId: string, appId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/wishlist`, {
      method: 'POST',
      body: JSON.stringify({ appId }),
    });
  }

  async removeFromWishlist(userId: string, appId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/wishlist/${appId}`, {
      method: 'DELETE',
    });
  }

  // App Details & Installation Methods

  /**
   * Get app detail page data
   */
  async getAppDetails(appId: string): Promise<App> {
    return this.apiRequest<App>(`/api/v1/marketplace/apps/${appId}`);
  }

  /**
   * Get app screenshots and videos
   */
  async getAppMedia(appId: string): Promise<{
    screenshots: string[];
    videos: string[];
    thumbnails: string[];
  }> {
    return this.apiRequest(`/api/v1/marketplace/apps/${appId}/media`);
  }

  /**
   * Get app reviews and ratings
   */
  async getAppReviews(
    appId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ reviews: AppReview[]; total: number }> {
    return this.apiRequest(
      `/api/v1/marketplace/apps/${appId}/reviews?page=${page}&limit=${limit}`
    );
  }

  /**
   * Get app version history
   */
  async getAppVersionHistory(appId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/apps/${appId}/versions`);
  }

  /**
   * Get app permissions required
   */
  async getAppPermissions(appId: string): Promise<string[]> {
    return this.apiRequest<string[]>(`/api/v1/marketplace/apps/${appId}/permissions`);
  }

  /**
   * Installation flow
   */
  async installApp(appId: string, userId: string): Promise<AppInstallation> {
    return this.apiRequest<AppInstallation>(`/api/v1/marketplace/apps/${appId}/install`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  /**
   * Update management
   */
  async updateApp(installationId: string): Promise<AppInstallation> {
    return this.apiRequest<AppInstallation>(
      `/api/v1/marketplace/installations/${installationId}/update`,
      { method: 'POST' }
    );
  }

  /**
   * Uninstall process
   */
  async uninstallApp(installationId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/installations/${installationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * App configuration
   */
  async updateAppConfiguration(
    installationId: string,
    configuration: Record<string, any>
  ): Promise<AppInstallation> {
    return this.apiRequest(`/api/v1/marketplace/installations/${installationId}/config`, {
      method: 'PUT',
      body: JSON.stringify(this.sanitizeInput(configuration)),
    });
  }

  /**
   * License activation
   */
  async activateLicense(installationId: string, licenseKey: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/installations/${installationId}/license`, {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
    });
  }

  // Developer Dashboard Methods

  /**
   * Submit new app
   */
  async submitApp(appData: any, developerId: string): Promise<DeveloperApp> {
    const sanitizedData = this.sanitizeInput(appData);
    return this.apiRequest<DeveloperApp>('/api/v1/marketplace/developer/apps', {
      method: 'POST',
      body: JSON.stringify({ ...sanitizedData, developerId }),
    });
  }

  /**
   * Get developer apps
   */
  async getDeveloperApps(developerId: string): Promise<DeveloperApp[]> {
    return this.apiRequest<DeveloperApp[]>(`/api/v1/marketplace/developer/${developerId}/apps`);
  }

  /**
   * Get app analytics
   */
  async getAppAnalytics(appId: string): Promise<{
    downloads: number;
    revenue: number;
    ratings: { average: number; count: number };
    views: number;
    dailyStats: any[];
  }> {
    return this.apiRequest(`/api/v1/marketplace/apps/${appId}/analytics`);
  }

  /**
   * Get revenue charts
   */
  async getDeveloperRevenue(developerId: string): Promise<{
    total: number;
    thisMonth: number;
    pending: number;
    paid: number;
    monthlyBreakdown: any[];
  }> {
    return this.apiRequest(`/api/v1/marketplace/developer/${developerId}/revenue`);
  }

  /**
   * Get user feedback management
   */
  async getDeveloperFeedback(developerId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/developer/${developerId}/feedback`);
  }

  /**
   * Version management
   */
  async updateAppVersion(appId: string, versionData: any): Promise<DeveloperApp> {
    return this.apiRequest(`/api/v1/marketplace/developer/apps/${appId}/version`, {
      method: 'POST',
      body: JSON.stringify(this.sanitizeInput(versionData)),
    });
  }

  /**
   * Get API keys
   */
  async getDeveloperApiKeys(developerId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/developer/${developerId}/api-keys`);
  }

  /**
   * Documentation editor
   */
  async updateAppDocumentation(appId: string, documentation: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/apps/${appId}/documentation`, {
      method: 'PUT',
      body: JSON.stringify({ documentation: this.sanitizeInput(documentation) }),
    });
  }

  /**
   * Support ticket interface
   */
  async getDeveloperTickets(developerId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/developer/${developerId}/tickets`);
  }

  /**
   * Payout reports
   */
  async getPayoutReports(developerId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/developer/${developerId}/payouts`);
  }

  /**
   * Performance metrics
   */
  async getPerformanceMetrics(appId: string): Promise<any> {
    return this.apiRequest(`/api/v1/marketplace/apps/${appId}/performance`);
  }

  // User Management Methods

  /**
   * Get purchased apps list
   */
  async getUserPurchases(userId: string): Promise<UserPurchase[]> {
    return this.apiRequest<UserPurchase[]>(`/api/v1/marketplace/users/${userId}/purchases`);
  }

  /**
   * Get installed apps management
   */
  async getUserInstallations(userId: string): Promise<AppInstallation[]> {
    return this.apiRequest<AppInstallation[]>(`/api/v1/marketplace/users/${userId}/installations`);
  }

  /**
   * Subscription management
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.apiRequest<Subscription[]>(`/api/v1/marketplace/users/${userId}/subscriptions`);
  }

  async updateSubscription(subscriptionId: string, updates: any): Promise<Subscription> {
    return this.apiRequest(`/api/v1/marketplace/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(this.sanitizeInput(updates)),
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Payment methods
   */
  async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return this.apiRequest<PaymentMethod[]>(`/api/v1/marketplace/users/${userId}/payment-methods`);
  }

  async addPaymentMethod(userId: string, paymentData: any): Promise<PaymentMethod> {
    return this.apiRequest<PaymentMethod>(`/api/v1/marketplace/users/${userId}/payment-methods`, {
      method: 'POST',
      body: JSON.stringify(this.sanitizeInput(paymentData)),
    });
  }

  async removePaymentMethod(paymentMethodId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Invoice history
   */
  async getUserInvoices(userId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/users/${userId}/invoices`);
  }

  /**
   * Usage tracking
   */
  async getUserUsageStats(userId: string): Promise<any> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/usage`);
  }

  /**
   * License management
   */
  async getUserLicenses(userId: string): Promise<any[]> {
    return this.apiRequest<any[]>(`/api/v1/marketplace/users/${userId}/licenses`);
  }

  /**
   * App settings
   */
  async getUserAppSettings(userId: string, appId: string): Promise<any> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/apps/${appId}/settings`);
  }

  async updateUserAppSettings(userId: string, appId: string, settings: any): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/apps/${appId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(this.sanitizeInput(settings)),
    });
  }

  /**
   * Notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<any> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/notifications/preferences`);
  }

  async updateNotificationPreferences(userId: string, preferences: any): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/users/${userId}/notifications/preferences`, {
      method: 'PUT',
      body: JSON.stringify(this.sanitizeInput(preferences)),
    });
  }

  /**
   * Review submission
   */
  async submitReview(reviewData: {
    appId: string;
    userId: string;
    rating: number;
    title: string;
    content: string;
  }): Promise<AppReview> {
    return this.apiRequest<AppReview>('/api/v1/marketplace/reviews', {
      method: 'POST',
      body: JSON.stringify(this.sanitizeInput(reviewData)),
    });
  }

  async updateReview(reviewId: string, reviewData: any): Promise<AppReview> {
    return this.apiRequest<AppReview>(`/api/v1/marketplace/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(this.sanitizeInput(reviewData)),
    });
  }

  async deleteReview(reviewId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  }

  // Admin Functions Methods

  /**
   * Get app review queue
   */
  async getAppReviewQueue(): Promise<DeveloperApp[]> {
    return this.apiRequest<DeveloperApp[]>('/api/v1/marketplace/admin/review-queue');
  }

  /**
   * Approve app
   */
  async approveApp(appId: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/apps/${appId}/approve`, {
      method: 'POST',
    });
  }

  /**
   * Reject app
   */
  async rejectApp(appId: string, reason: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/apps/${appId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Featured app curation
   */
  async setAppFeatured(appId: string, featured: boolean): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/apps/${appId}/featured`, {
      method: 'PUT',
      body: JSON.stringify({ featured }),
    });
  }

  /**
   * Get revenue analytics
   */
  async getPlatformAnalytics(): Promise<{
    totalApps: number;
    totalUsers: number;
    totalRevenue: number;
    monthlyGrowth: number;
    topCategories: any[];
  }> {
    return this.apiRequest('/api/v1/marketplace/admin/analytics');
  }

  /**
   * Developer management
   */
  async getDeveloperList(): Promise<any[]> {
    return this.apiRequest<any[]>('/api/v1/marketplace/admin/developers');
  }

  async suspendDeveloper(developerId: string, reason: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/developers/${developerId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Content moderation
   */
  async getModerationQueue(): Promise<any[]> {
    return this.apiRequest<any[]>('/api/v1/marketplace/admin/moderation');
  }

  async moderateContent(contentId: string, action: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/moderation/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  /**
   * Security alerts
   */
  async getSecurityAlerts(): Promise<any[]> {
    return this.apiRequest<any[]>('/api/v1/marketplace/admin/security/alerts');
  }

  /**
   * Compliance dashboard
   */
  async getComplianceReport(): Promise<any> {
    return this.apiRequest('/api/v1/marketplace/admin/compliance');
  }

  /**
   * Platform statistics
   */
  async getPlatformStatistics(): Promise<any> {
    return this.apiRequest('/api/v1/marketplace/admin/statistics');
  }

  /**
   * Fraud monitoring
   */
  async getFraudAlerts(): Promise<any[]> {
    return this.apiRequest<any[]>('/api/v1/marketplace/admin/fraud/alerts');
  }

  /**
   * Appeal handling
   */
  async getAppeals(): Promise<any[]> {
    return this.apiRequest<any[]>('/api/v1/marketplace/admin/appeals');
  }

  async handleAppeal(appealId: string, decision: string, notes: string): Promise<{ success: boolean }> {
    return this.apiRequest(`/api/v1/marketplace/admin/appeals/${appealId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }
}

// Export singleton instance
export const aiMarketplaceService = new AIMarketplaceService();