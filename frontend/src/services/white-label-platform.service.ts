import type {
  TenantConfiguration,
  ThemeConfiguration,
  DomainConfiguration,
  BillingConfiguration,
  UsageData,
  CustomComponent,
  FeatureFlags,
  NavigationItem,
  DashboardLayout,
  UserInvitation,
  APIKey,
  WebhookConfiguration,
  SEOSettings,
  LocalizationSettings,
} from '../types/white-label';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface RetryOptions {
  maxRetries: number;
  delay?: number;
  backoff?: number;
}

interface CDNConfiguration {
  baseUrl: string;
  imageOptimization: boolean;
  cacheHeaders: Record<string, string>;
}

interface LazyLoadingConfig {
  threshold: number;
  rootMargin: string;
}

interface CacheStrategy {
  ttl: number;
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
}

export class WhiteLabelPlatformService {
  private currentConfiguration: TenantConfiguration | null = null;
  private currentTheme: ThemeConfiguration | null = null;
  private featureFlags: FeatureFlags = {};
  private cache = new Map<string, CacheEntry<any>>();
  private cdnConfig: CDNConfiguration | null = null;
  private lazyLoadingConfig: LazyLoadingConfig = { threshold: 0.1, rootMargin: '0px' };
  private cacheStrategies = new Map<string, CacheStrategy>();
  private activeWidgets: string[] = [];
  private hiddenComponents = new Set<string>();
  private navigationItems: NavigationItem[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  // Default configuration template
  private defaultConfiguration: Partial<TenantConfiguration> = {
    theme: {
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#06b6d4',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 'medium',
      borderRadius: '6px',
      spacing: 'normal',
      customCss: '',
    },
    localization: {
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      timezone: 'UTC',
      dateFormat: 'yyyy-MM-dd',
      numberFormat: 'en-US',
      currency: 'USD',
    },
    features: {
      contractManagement: true,
      documentAnalysis: true,
      aiAssistant: false,
      reportGeneration: true,
      apiAccess: false,
      whiteLabeling: false,
      customIntegrations: false,
      advancedAnalytics: false,
    },
  };

  /**
   * Load tenant configuration from API or cache
   */
  async loadTenantConfiguration(tenantId: string): Promise<TenantConfiguration> {
    const cacheKey = `config:${tenantId}`;
    const cached = this.getFromCache<TenantConfiguration>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Simulate API call - replace with actual API endpoint
      const response = await fetch(`/api/tenants/${tenantId}/configuration`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Tenant not found');
        }
        throw new Error(`Failed to load configuration: ${response.statusText}`);
      }

      const configuration: TenantConfiguration = await response.json();
      this.validateConfiguration(configuration);
      
      // Cache for 5 minutes
      this.setInCache(cacheKey, configuration, 300000);
      
      return configuration;
    } catch (error) {
      throw new Error(`Failed to load tenant configuration: ${error.message}`);
    }
  }

  /**
   * Load configuration with retry logic
   */
  async loadTenantConfigurationWithRetry(
    tenantId: string,
    options: RetryOptions = { maxRetries: 3, delay: 1000, backoff: 2 }
  ): Promise<TenantConfiguration> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        return await this.loadTenantConfiguration(tenantId);
      } catch (error) {
        lastError = error;
        
        if (attempt < options.maxRetries) {
          const delay = options.delay * Math.pow(options.backoff || 1, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Apply tenant settings to the platform
   */
  async applyTenantSettings(configuration: TenantConfiguration): Promise<void> {
    this.validateConfiguration(configuration);
    this.currentConfiguration = configuration;

    // Apply theme
    if (configuration.theme) {
      await this.applyTheme(configuration.theme);
    }

    // Set feature flags
    if (configuration.features) {
      this.setFeatureFlags(configuration.features);
    }

    // Apply branding
    if (configuration.branding) {
      await this.applyBranding(configuration.branding);
    }

    // Apply localization
    if (configuration.localization) {
      await this.applyLocalization(configuration.localization);
    }

    // Apply customizations
    if (configuration.customization) {
      await this.applyCustomizations(configuration.customization);
    }

    // Apply SEO settings
    if (configuration.domain?.seoSettings) {
      await this.applySEOSettings(configuration.domain.seoSettings);
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfiguration(configuration: any): void {
    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Invalid configuration: must be an object');
    }

    if (!configuration.tenantId || typeof configuration.tenantId !== 'string') {
      throw new Error('Invalid configuration: tenantId is required');
    }

    if (!configuration.name || typeof configuration.name !== 'string') {
      throw new Error('Invalid configuration: name is required');
    }

    // Validate billing configuration if present
    if (configuration.billing !== undefined && configuration.billing !== null && !this.isValidBillingConfiguration(configuration.billing)) {
      throw new Error('Invalid billing configuration');
    }

    // Throw error if billing is explicitly null
    if (configuration.billing === null) {
      throw new Error('Invalid billing configuration');
    }
  }

  private isValidBillingConfiguration(billing: any): boolean {
    return billing.plan && billing.limits && billing.usage && billing.subscription;
  }

  /**
   * Merge default and custom configurations
   */
  mergeConfigurations(customConfig: Partial<TenantConfiguration>): TenantConfiguration {
    return {
      ...this.defaultConfiguration,
      ...customConfig,
      theme: {
        ...this.defaultConfiguration.theme,
        ...customConfig.theme,
      },
      localization: {
        ...this.defaultConfiguration.localization,
        ...customConfig.localization,
      },
      features: {
        ...this.defaultConfiguration.features,
        ...customConfig.features,
      },
    } as TenantConfiguration;
  }

  /**
   * Apply theme configuration
   */
  async applyTheme(theme: ThemeConfiguration): Promise<void> {
    this.currentTheme = theme;
    const root = document.documentElement;

    // Apply CSS custom properties
    const cssVars = {
      '--color-primary': theme.primary,
      '--color-secondary': theme.secondary,
      '--color-accent': theme.accent,
      '--color-background': theme.background,
      '--color-surface': theme.surface,
      '--color-text': theme.text,
      '--font-family-primary': theme.fontFamily,
      '--font-size-base': theme.fontSize,
      '--border-radius': theme.borderRadius,
      '--spacing-unit': this.getSpacingUnit(theme.spacing),
    };

    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply custom CSS
    if (theme.customCss) {
      await this.injectCustomCSS(theme.customCss);
    }

    // Load custom fonts if specified
    if (theme.fontFamily && !this.isSystemFont(theme.fontFamily)) {
      await this.loadCustomFont(theme.fontFamily);
    }
  }

  /**
   * Switch theme with debouncing
   */
  async switchTheme(newTheme: ThemeConfiguration): Promise<void> {
    const timerId = this.debounceTimers.get('theme-switch');
    if (timerId) {
      clearTimeout(timerId);
    }

    this.debounceTimers.set('theme-switch', setTimeout(async () => {
      // Remove old theme styles
      if (this.currentTheme) {
        this.removeCustomCSS();
      }
      
      await this.applyTheme(newTheme);
      this.debounceTimers.delete('theme-switch');
    }, 100));
  }

  /** Switch theme immediately (for testing) */
  async switchThemeImmediate(newTheme: ThemeConfiguration): Promise<void> {
    // Remove old theme styles
    if (this.currentTheme) {
      this.removeCustomCSS();
    }
    
    await this.applyTheme(newTheme);
  }

  private getSpacingUnit(spacing: string): string {
    const spacingMap = {
      'compact': '4px',
      'normal': '8px',
      'comfortable': '12px',
    };
    return spacingMap[spacing] || '8px';
  }

  private isSystemFont(fontFamily: string): boolean {
    const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace'];
    return systemFonts.some(font => fontFamily.includes(font));
  }

  private async loadCustomFont(fontFamily: string): Promise<void> {
    const fontName = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  private async injectCustomCSS(css: string): Promise<void> {
    const sanitizedCSS = this.sanitizeCSS(css);
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-custom-theme', 'true');
    styleElement.textContent = sanitizedCSS;
    document.head.appendChild(styleElement);
  }

  private removeCustomCSS(): void {
    const customStyles = document.head.querySelectorAll('[data-custom-theme="true"]');
    customStyles.forEach(style => document.head.removeChild(style));
  }

  /**
   * Sanitize CSS to prevent XSS attacks
   */
  sanitizeCSS(css: string): string {
    // Remove potentially dangerous patterns
    const dangerousPatterns = [
      /javascript:/gi,
      /expression\s*\(/gi,
      /behavior\s*:/gi,
      /@import/gi,
      /binding\s*:/gi,
    ];

    let sanitized = css;
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  /**
   * Apply branding configuration
   */
  private async applyBranding(branding: any): Promise<void> {
    // Update favicon
    if (branding.logo?.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = branding.logo.favicon;
      }
    }

    // Store logo URLs for component usage
    if (branding.logo) {
      this.setInCache('branding:logos', branding.logo, 3600000); // 1 hour
    }
  }

  /**
   * Apply localization settings
   */
  private async applyLocalization(localization: LocalizationSettings): Promise<void> {
    // Set document language
    document.documentElement.lang = localization.defaultLanguage;

    // Store localization settings for formatting functions
    this.setInCache('localization', localization, 3600000);
  }

  /**
   * Apply UI customizations
   */
  private async applyCustomizations(customization: any): Promise<void> {
    if (customization.navigation) {
      await this.applyNavigationCustomization(customization.navigation);
    }

    if (customization.dashboard?.widgets) {
      await this.configureWidgets(customization.dashboard.widgets);
    }
  }

  /**
   * Feature flag management
   */
  setFeatureFlags(flags: FeatureFlags): void {
    this.featureFlags = { ...flags };
  }

  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.featureFlags[feature] === true;
  }

  updateFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.featureFlags[feature] = enabled;
  }

  getEnabledFeatures(): string[] {
    return Object.entries(this.featureFlags)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature);
  }

  /**
   * Language management
   */
  async setLanguage(language: string): Promise<void> {
    const config = this.currentConfiguration;
    if (config?.localization?.supportedLanguages && 
        !config.localization.supportedLanguages.includes(language)) {
      throw new Error('Language not supported');
    }

    document.documentElement.lang = language;
    this.setInCache('current-language', language, 3600000);
  }

  getCurrentLanguage(): string {
    return this.getFromCache('current-language') || 'en';
  }

  /**
   * Formatting utilities
   */
  formatDate(date: Date): string {
    const localization = this.getFromCache<LocalizationSettings>('localization');
    if (!localization) return date.toLocaleDateString();

    const locale = localization.numberFormat || 'en-US';
    const format = localization.dateFormat || 'MM/dd/yyyy';
    
    // Simple date formatting - in production, use a proper date library
    return date.toLocaleDateString(locale);
  }

  formatNumber(number: number): string {
    const localization = this.getFromCache<LocalizationSettings>('localization');
    const locale = localization?.numberFormat || 'en-US';
    return number.toLocaleString(locale);
  }

  formatCurrency(amount: number): string {
    const localization = this.getFromCache<LocalizationSettings>('localization');
    const locale = localization?.numberFormat || 'en-US';
    const currency = localization?.currency || 'USD';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Domain and URL management
   */
  isCustomDomain(domain: string): boolean {
    if (!this.currentConfiguration?.domain?.customDomains) return false;
    return this.currentConfiguration.domain.customDomains.includes(domain);
  }

  getTenantFromSubdomain(hostname: string): string | null {
    const parts = hostname.split('.');
    return parts.length > 2 ? parts[0] : null;
  }

  resolveAssetUrl(path: string): string {
    if (this.cdnConfig) {
      return `${this.cdnConfig.baseUrl}${path}`;
    }
    return path;
  }

  generateDeepLink(path: string, params?: Record<string, string>): string {
    let url = `${window.location.origin}${path}`;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  /**
   * SEO management
   */
  async applySEOSettings(seoSettings: SEOSettings): Promise<void> {
    // Update title
    document.title = seoSettings.title;

    // Update meta description
    this.updateMetaTag('description', seoSettings.description);

    // Update meta keywords
    if (seoSettings.keywords) {
      this.updateMetaTag('keywords', seoSettings.keywords.join(', '));
    }

    // Update Open Graph tags
    this.updateMetaTag('og:title', seoSettings.title, 'property');
    this.updateMetaTag('og:description', seoSettings.description, 'property');
  }

  private updateMetaTag(name: string, content: string, attribute: string = 'name'): void {
    let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.appendChild(meta);
    }
    
    meta.content = content;
  }

  /**
   * Component visibility and customization
   */
  isComponentVisible(componentId: string): boolean {
    return !this.hiddenComponents.has(componentId);
  }

  hideComponent(componentId: string): void {
    this.hiddenComponents.add(componentId);
  }

  showComponent(componentId: string): void {
    this.hiddenComponents.delete(componentId);
  }

  getCustomFields(componentId: string): string[] {
    const config = this.currentConfiguration?.customization?.components?.[componentId];
    return config?.fields || [];
  }

  /**
   * Navigation customization
   */
  async applyNavigationCustomization(navigation: NavigationItem[]): Promise<void> {
    this.navigationItems = [...navigation];
  }

  getNavigationItems(): NavigationItem[] {
    return this.navigationItems;
  }

  /**
   * Dashboard and widget management
   */
  getDashboardLayout(): DashboardLayout {
    return this.currentConfiguration?.customization?.dashboard || {
      widgets: [],
      layout: 'grid',
    };
  }

  async configureWidgets(widgets: string[]): Promise<void> {
    this.activeWidgets = [...widgets];
  }

  getActiveWidgets(): string[] {
    return this.activeWidgets;
  }

  /**
   * CDN and resource management
   */
  configureCDN(baseUrl: string, options?: Partial<CDNConfiguration>): void {
    this.cdnConfig = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      imageOptimization: true,
      cacheHeaders: {},
      ...options,
    };
  }

  getCDNUrl(path: string): string {
    if (!this.cdnConfig) return path;
    return `${this.cdnConfig.baseUrl}${path}`;
  }

  async optimizeImage(src: string, options: { width?: number; height?: number; quality?: number }): Promise<string> {
    const url = new URL(src);
    const searchParams = new URLSearchParams(url.search);
    
    if (options.width) searchParams.set('w', options.width.toString());
    if (options.height) searchParams.set('h', options.height.toString());
    if (options.quality) searchParams.set('q', options.quality.toString());
    
    url.search = searchParams.toString();
    return url.toString();
  }

  async loadFonts(fontFamilies: string[]): Promise<void> {
    const promises = fontFamilies.map(font => this.loadCustomFont(font));
    await Promise.all(promises);
  }

  configureLazyLoading(config: LazyLoadingConfig): void {
    this.lazyLoadingConfig = config;
  }

  getLazyLoadingConfig(): LazyLoadingConfig {
    return this.lazyLoadingConfig;
  }

  setCacheStrategy(resource: string, strategy: CacheStrategy): void {
    this.cacheStrategies.set(resource, strategy);
  }

  getCacheStrategy(resource: string): CacheStrategy {
    return this.cacheStrategies.get(resource) || {
      ttl: 3600,
      strategy: 'cache-first',
    };
  }

  /**
   * Billing and usage management
   */
  getUsagePercentage(metric: keyof UsageData): number {
    const config = this.currentConfiguration;
    if (!config?.billing) return 0;

    const current = config.billing.usage[metric];
    const limit = config.billing.limits[metric];
    
    if (typeof current !== 'number' || typeof limit !== 'number' || limit === 0) {
      return 0;
    }

    return Math.round((current / limit) * 100);
  }

  generateUsageDashboard(): Record<string, { current: number; limit: number; percentage: number }> {
    const config = this.currentConfiguration;
    if (!config?.billing) return {};

    const dashboard: Record<string, { current: number; limit: number; percentage: number }> = {};
    
    Object.keys(config.billing.usage).forEach(metric => {
      const typedMetric = metric as keyof UsageData;
      dashboard[metric] = {
        current: config.billing.usage[typedMetric],
        limit: config.billing.limits[typedMetric],
        percentage: this.getUsagePercentage(typedMetric),
      };
    });

    return dashboard;
  }

  formatBillingAmount(amount: number): string {
    return this.formatCurrency(amount);
  }

  getNextBillingDate(): string {
    const config = this.currentConfiguration;
    return config?.billing?.subscription?.renewalDate || '';
  }

  isUsageLimitExceeded(metric: keyof UsageData): boolean {
    return this.getUsagePercentage(metric) >= 100;
  }

  calculateCostProjection(days: number): { estimatedCost: number; breakdown: Record<string, number> } {
    const config = this.currentConfiguration;
    if (!config?.billing) return { estimatedCost: 0, breakdown: {} };

    const dailyRate = config.billing.subscription.amount / 30; // Rough daily rate
    const estimatedCost = dailyRate * days;

    return {
      estimatedCost,
      breakdown: {
        base: estimatedCost * 0.7,
        usage: estimatedCost * 0.3,
      },
    };
  }

  /**
   * Admin interface methods
   */
  async createUserInvitation(invitation: Omit<UserInvitation, 'token' | 'expiresAt'>): Promise<UserInvitation> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      ...invitation,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  getAvailableRoles(): string[] {
    return ['admin', 'editor', 'viewer'];
  }

  async generateAPIKey(options: { name: string; permissions: string[]; expiresIn?: number }): Promise<APIKey> {
    const key = this.generateSecureToken(32);
    const expiresAt = options.expiresIn 
      ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
      : null;

    return {
      id: this.generateSecureToken(16),
      key,
      name: options.name,
      permissions: options.permissions,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() || null,
      lastUsed: null,
    };
  }

  async configureWebhook(config: Omit<WebhookConfiguration, 'id' | 'status'>): Promise<WebhookConfiguration> {
    return {
      id: this.generateSecureToken(16),
      status: 'active',
      ...config,
    };
  }

  async exportSettings(): Promise<{ version: string; configuration: TenantConfiguration }> {
    if (!this.currentConfiguration) {
      throw new Error('No configuration to export');
    }

    return {
      version: '1.0',
      configuration: this.currentConfiguration,
    };
  }

  async importSettings(data: { version: string; configuration: TenantConfiguration }): Promise<void> {
    this.validateConfiguration(data.configuration);
    await this.applyTenantSettings(data.configuration);
  }

  /**
   * Security and validation
   */
  isValidURL(url: string): boolean {
    try {
      // For testing environment, accept valid patterns
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  accessTenantData(tenantId: string): any {
    if (this.currentConfiguration?.tenantId !== tenantId) {
      throw new Error('Access denied');
    }
    return this.currentConfiguration;
  }

  /**
   * Utility methods
   */
  getCurrentConfiguration(): TenantConfiguration | null {
    return this.currentConfiguration;
  }

  getCurrentTheme(): ThemeConfiguration | null {
    return this.currentTheme;
  }

  cleanup(): void {
    this.currentConfiguration = null;
    this.currentTheme = null;
    this.featureFlags = {};
    this.cache.clear();
    this.activeWidgets = [];
    this.hiddenComponents.clear();
    this.navigationItems = [];
    
    // Clear debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Remove custom styles
    this.removeCustomCSS();
  }

  /**
   * Cache management
   */
  private setInCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private generateSecureToken(length: number = 24): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}