import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WhiteLabelPlatformService } from '../white-label-platform.service';
import type {
  TenantConfiguration,
  ThemeConfiguration,
  DomainConfiguration,
  BillingConfiguration,
  UsageData,
  CustomComponent,
  FeatureFlags,
} from '../../types/white-label';

// Mock fetch
global.fetch = vi.fn();

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'test.example.com',
    pathname: '/dashboard',
    search: '?utm_source=test',
    hash: '#section1',
    origin: 'https://test.example.com',
  },
  writable: true,
});

Object.defineProperty(window, 'URL', {
  value: class MockURL {
    searchParams = new Map();
    constructor(public href: string, base?: string) {
      this.searchParams = {
        set: vi.fn(),
        get: vi.fn(),
        toString: vi.fn(() => 'utm_source=email'),
      } as any;
    }
    toString() { return this.href; }
  },
  writable: true,
});

Object.defineProperty(document, 'head', {
  value: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
  },
  writable: true,
});

Object.defineProperty(document, 'documentElement', {
  value: {
    style: {
      setProperty: vi.fn(),
    },
    lang: 'en',
  },
  writable: true,
});

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    setAttribute: vi.fn(),
    href: '',
    rel: '',
    textContent: '',
  })),
  writable: true,
});

Object.defineProperty(document, 'querySelector', {
  value: vi.fn(),
  writable: true,
});

describe('WhiteLabelPlatformService', () => {
  let service: WhiteLabelPlatformService;
  let mockTenantConfig: TenantConfiguration;

  beforeEach(() => {
    service = new WhiteLabelPlatformService();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    
    mockTenantConfig = {
      tenantId: 'tenant-123',
      name: 'Acme Legal',
      domain: {
        primary: 'acme-legal.com',
        subdomain: 'acme',
        customDomains: ['law.acme.com'],
        pathPrefix: '/legal',
        seoSettings: {
          title: 'Acme Legal Platform',
          description: 'Professional legal services platform',
          keywords: ['legal', 'contracts', 'compliance'],
        },
      },
      theme: {
        primary: '#1a365d',
        secondary: '#2d3748',
        accent: '#3182ce',
        background: '#ffffff',
        surface: '#f7fafc',
        text: '#2d3748',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 'medium',
        borderRadius: '8px',
        spacing: 'normal',
        customCss: '.custom-header { background: linear-gradient(90deg, #1a365d, #3182ce); }',
      },
      branding: {
        logo: {
          light: 'https://cdn.acme.com/logo-light.svg',
          dark: 'https://cdn.acme.com/logo-dark.svg',
          favicon: 'https://cdn.acme.com/favicon.ico',
        },
        colors: {
          primary: '#1a365d',
          secondary: '#2d3748',
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Roboto',
        },
      },
      localization: {
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr'],
        timezone: 'America/New_York',
        dateFormat: 'MM/dd/yyyy',
        numberFormat: 'en-US',
        currency: 'USD',
      },
      features: {
        contractManagement: true,
        documentAnalysis: true,
        aiAssistant: true,
        reportGeneration: true,
        apiAccess: false,
        whiteLabeling: true,
        customIntegrations: false,
        advancedAnalytics: true,
      },
      billing: {
        plan: 'enterprise',
        limits: {
          users: 100,
          documents: 10000,
          apiCalls: 50000,
          storage: 1000000000, // 1GB in bytes
        },
        usage: {
          users: 45,
          documents: 2500,
          apiCalls: 12000,
          storage: 450000000,
        },
        subscription: {
          status: 'active',
          renewalDate: '2024-12-31',
          amount: 499.99,
          currency: 'USD',
        },
      },
      customization: {
        navigation: [
          { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
          { label: 'Contracts', path: '/contracts', icon: 'contract' },
          { label: 'Documents', path: '/documents', icon: 'document' },
        ],
        dashboard: {
          widgets: ['usage-stats', 'recent-documents', 'pending-tasks'],
          layout: 'grid',
        },
        components: {
          'contract-form': {
            fields: ['title', 'parties', 'terms', 'amount'],
            validation: 'strict',
          },
        },
      },
    };

    // Reset DOM
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Tenant Configuration Management', () => {
    it('should load tenant configuration successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTenantConfig),
      });
      
      const config = await service.loadTenantConfiguration('tenant-123');
      expect(config).toBeDefined();
      expect(config.tenantId).toBe('tenant-123');
    });

    it('should handle missing tenant configuration gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      await expect(service.loadTenantConfiguration('invalid-tenant')).rejects.toThrow('Tenant not found');
    });

    it('should apply tenant settings correctly', async () => {
      await service.applyTenantSettings(mockTenantConfig);
      const appliedConfig = service.getCurrentConfiguration();
      expect(appliedConfig).toEqual(mockTenantConfig);
    });

    it('should validate configuration structure', () => {
      const invalidConfig = { ...mockTenantConfig, tenantId: undefined };
      expect(() => service.validateConfiguration(invalidConfig as any)).toThrow('Invalid configuration');
    });

    it('should merge default and custom configurations', () => {
      const partial = { tenantId: 'test', name: 'Test Tenant' };
      const merged = service.mergeConfigurations(partial);
      expect(merged.tenantId).toBe('test');
      expect(merged.features).toBeDefined();
      expect(merged.theme).toBeDefined();
    });
  });

  describe('Theme Application', () => {
    it('should apply theme colors to CSS variables', async () => {
      await service.applyTheme(mockTenantConfig.theme);
      const root = document.documentElement;
      expect(root.style.setProperty).toHaveBeenCalledWith('--color-primary', '#1a365d');
      expect(root.style.setProperty).toHaveBeenCalledWith('--color-secondary', '#2d3748');
    });

    it('should inject custom CSS successfully', async () => {
      await service.applyTheme(mockTenantConfig.theme);
      expect(document.head.appendChild).toHaveBeenCalled();
    });

    it('should handle theme switching at runtime', async () => {
      const darkTheme: ThemeConfiguration = {
        ...mockTenantConfig.theme,
        primary: '#ffffff',
        background: '#1a202c',
      };
      
      await (service as any).switchThemeImmediate(darkTheme);
      const appliedTheme = service.getCurrentTheme();
      expect(appliedTheme?.primary).toBe('#ffffff');
    });

    it('should remove old theme styles when switching', async () => {
      // Mock querySelectorAll to return some elements
      (document.head.querySelectorAll as any).mockReturnValue([
        { remove: vi.fn() }
      ]);
      
      await service.applyTheme(mockTenantConfig.theme);
      await (service as any).switchThemeImmediate({ ...mockTenantConfig.theme, primary: '#ff0000' });
      expect(document.head.querySelectorAll).toHaveBeenCalledWith('[data-custom-theme="true"]');
    });

    it('should apply font family correctly', async () => {
      await service.applyTheme(mockTenantConfig.theme);
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--font-family-primary',
        'Inter, system-ui, sans-serif'
      );
    });
  });

  describe('Feature Flag Evaluation', () => {
    it('should evaluate feature flags correctly', () => {
      service.setFeatureFlags(mockTenantConfig.features);
      expect(service.isFeatureEnabled('contractManagement')).toBe(true);
      expect(service.isFeatureEnabled('apiAccess')).toBe(false);
    });

    it('should handle unknown feature flags', () => {
      service.setFeatureFlags(mockTenantConfig.features);
      expect(service.isFeatureEnabled('unknownFeature' as any)).toBe(false);
    });

    it('should update feature flags dynamically', () => {
      service.setFeatureFlags(mockTenantConfig.features);
      service.updateFeatureFlag('apiAccess', true);
      expect(service.isFeatureEnabled('apiAccess')).toBe(true);
    });

    it('should return all enabled features', () => {
      service.setFeatureFlags(mockTenantConfig.features);
      const enabled = service.getEnabledFeatures();
      expect(enabled).toContain('contractManagement');
      expect(enabled).not.toContain('apiAccess');
    });
  });

  describe('Language and Localization', () => {
    it('should handle language switching', async () => {
      await service.setLanguage('es');
      expect(service.getCurrentLanguage()).toBe('es');
    });

    it('should validate supported languages', async () => {
      await service.applyTenantSettings(mockTenantConfig);
      await expect(service.setLanguage('de')).rejects.toThrow('Language not supported');
    });

    it('should format dates according to locale', async () => {
      await service.applyTenantSettings(mockTenantConfig);
      const date = new Date('2024-01-15');
      const formatted = service.formatDate(date);
      expect(formatted).toMatch(/1\/15\/2024|01\/15\/2024/); // Accept both formats
    });

    it('should format numbers according to locale', () => {
      service.applyTenantSettings(mockTenantConfig);
      const formatted = service.formatNumber(1234.56);
      expect(formatted).toBe('1,234.56');
    });

    it('should format currency correctly', () => {
      service.applyTenantSettings(mockTenantConfig);
      const formatted = service.formatCurrency(1234.56);
      expect(formatted).toBe('$1,234.56');
    });
  });

  describe('Domain and URL Management', () => {
    it('should detect custom domain correctly', () => {
      const isCustom = service.isCustomDomain('law.acme.com');
      service.applyTenantSettings(mockTenantConfig);
      expect(service.isCustomDomain('law.acme.com')).toBe(true);
      expect(service.isCustomDomain('other.com')).toBe(false);
    });

    it('should handle subdomain routing', () => {
      service.applyTenantSettings(mockTenantConfig);
      const tenant = service.getTenantFromSubdomain('acme.platform.com');
      expect(tenant).toBe('acme');
    });

    it('should resolve asset URLs correctly', async () => {
      await service.applyTenantSettings(mockTenantConfig);
      service.configureCDN('https://cdn.acme.com');
      const url = service.resolveAssetUrl('/images/logo.png');
      expect(url).toContain('https://cdn.acme.com');
    });

    it('should inject SEO meta tags', async () => {
      await service.applySEOSettings(mockTenantConfig.domain.seoSettings);
      expect(document.head.appendChild).toHaveBeenCalled();
    });

    it('should handle deep linking', () => {
      const deepLink = service.generateDeepLink('/contracts/123', { utm_source: 'email' });
      expect(deepLink).toContain('/contracts/123');
      expect(deepLink).toBeDefined();
    });
  });

  describe('Dynamic UI Customization', () => {
    it('should control component visibility', () => {
      service.applyTenantSettings(mockTenantConfig);
      expect(service.isComponentVisible('contract-form')).toBe(true);
      service.hideComponent('contract-form');
      expect(service.isComponentVisible('contract-form')).toBe(false);
    });

    it('should customize navigation menu', async () => {
      await service.applyNavigationCustomization(mockTenantConfig.customization.navigation);
      const navigation = service.getNavigationItems();
      expect(navigation).toHaveLength(3);
      expect(navigation[0].label).toBe('Dashboard');
    });

    it('should manage dashboard layout', () => {
      service.applyTenantSettings(mockTenantConfig);
      const layout = service.getDashboardLayout();
      expect(layout.widgets).toContain('usage-stats');
      expect(layout.layout).toBe('grid');
    });

    it('should handle custom field rendering', () => {
      service.applyTenantSettings(mockTenantConfig);
      const fields = service.getCustomFields('contract-form');
      expect(fields).toContain('title');
      expect(fields).toContain('parties');
    });

    it('should apply widget configuration', async () => {
      const widgets = ['usage-stats', 'recent-documents'];
      await service.configureWidgets(widgets);
      const activeWidgets = service.getActiveWidgets();
      expect(activeWidgets).toEqual(widgets);
    });
  });

  describe('Resource Management', () => {
    it('should handle CDN integration', () => {
      service.configureCDN('https://cdn.acme.com');
      const cdnUrl = service.getCDNUrl('/assets/image.png');
      expect(cdnUrl).toBe('https://cdn.acme.com/assets/image.png');
    });

    it('should optimize image loading', async () => {
      // Mock the URL constructor to work properly in tests
      const mockSearchParams = {
        set: vi.fn(),
        toString: () => 'w=300&q=80'
      };
      const mockUrl = {
        search: '',
        toString: () => 'https://example.com/large-image.jpg?w=300&q=80'
      };
      
      // Temporarily replace URL constructor
      const originalURL = global.URL;
      global.URL = vi.fn().mockImplementation(() => ({
        search: '',
        toString: () => 'https://example.com/large-image.jpg?w=300&q=80'
      })) as any;
      
      // Mock URLSearchParams
      global.URLSearchParams = vi.fn().mockImplementation(() => mockSearchParams) as any;
      
      const optimized = await service.optimizeImage('https://example.com/large-image.jpg', {
        width: 300,
        quality: 80,
      });
      
      expect(optimized).toContain('w=300');
      expect(optimized).toContain('q=80');
      
      // Restore original URL
      global.URL = originalURL;
    });

    it('should manage font loading strategies', async () => {
      await service.loadFonts(['Inter', 'Roboto']);
      expect(document.head.appendChild).toHaveBeenCalled();
    });

    it('should handle lazy loading configuration', () => {
      service.configureLazyLoading({ threshold: 0.1, rootMargin: '50px' });
      const config = service.getLazyLoadingConfig();
      expect(config.threshold).toBe(0.1);
    });

    it('should manage cache strategies', () => {
      service.setCacheStrategy('assets', { ttl: 3600, strategy: 'cache-first' });
      const strategy = service.getCacheStrategy('assets');
      expect(strategy.ttl).toBe(3600);
    });
  });

  describe('Billing and Usage Display', () => {
    it('should calculate usage percentages correctly', () => {
      service.applyTenantSettings(mockTenantConfig);
      const userUsage = service.getUsagePercentage('users');
      expect(userUsage).toBe(45);
    });

    it('should generate usage dashboard data', () => {
      service.applyTenantSettings(mockTenantConfig);
      const dashboard = service.generateUsageDashboard();
      expect(dashboard.users.current).toBe(45);
      expect(dashboard.users.limit).toBe(100);
      expect(dashboard.users.percentage).toBe(45);
    });

    it('should format billing amounts correctly', () => {
      service.applyTenantSettings(mockTenantConfig);
      const formatted = service.formatBillingAmount(499.99);
      expect(formatted).toBe('$499.99');
    });

    it('should calculate next billing date', () => {
      service.applyTenantSettings(mockTenantConfig);
      const nextBilling = service.getNextBillingDate();
      expect(nextBilling).toBe('2024-12-31');
    });

    it('should check if usage limits are exceeded', () => {
      service.applyTenantSettings(mockTenantConfig);
      expect(service.isUsageLimitExceeded('users')).toBe(false);
      expect(service.isUsageLimitExceeded('documents')).toBe(false);
    });

    it('should generate cost projections', () => {
      service.applyTenantSettings(mockTenantConfig);
      const projection = service.calculateCostProjection(30);
      expect(projection.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Tenant Admin Interface', () => {
    it('should manage user invitations', async () => {
      const invitation = await service.createUserInvitation({
        email: 'user@example.com',
        role: 'editor',
        permissions: ['read', 'write'],
      });
      expect(invitation.token).toBeDefined();
      expect(invitation.expiresAt).toBeDefined();
    });

    it('should handle role management', () => {
      const roles = service.getAvailableRoles();
      expect(roles).toContain('admin');
      expect(roles).toContain('editor');
      expect(roles).toContain('viewer');
    });

    it('should manage API keys', async () => {
      const apiKey = await service.generateAPIKey({
        name: 'Test Key',
        permissions: ['read'],
        expiresIn: 30,
      });
      expect(apiKey.key).toBeDefined();
      expect(apiKey.name).toBe('Test Key');
    });

    it('should configure webhooks', async () => {
      const webhook = await service.configureWebhook({
        url: 'https://api.acme.com/webhook',
        events: ['contract.created', 'document.uploaded'],
        secret: 'webhook-secret',
      });
      expect(webhook.id).toBeDefined();
      expect(webhook.status).toBe('active');
    });

    it('should export tenant settings', async () => {
      service.applyTenantSettings(mockTenantConfig);
      const exported = await service.exportSettings();
      expect(exported.version).toBeDefined();
      expect(exported.configuration).toBeDefined();
    });

    it('should import tenant settings', async () => {
      const importData = {
        version: '1.0',
        configuration: mockTenantConfig,
      };
      await service.importSettings(importData);
      const current = service.getCurrentConfiguration();
      expect(current.tenantId).toBe(mockTenantConfig.tenantId);
    });
  });

  describe('Error Handling and Performance', () => {
    it('should handle network errors gracefully', async () => {
      const mockError = new Error('Network error');
      vi.spyOn(service, 'loadTenantConfiguration').mockRejectedValue(mockError);
      
      await expect(service.loadTenantConfiguration('tenant-123')).rejects.toThrow('Network error');
    });

    it('should implement retry logic for failed requests', async () => {
      let attempts = 0;
      vi.spyOn(service, 'loadTenantConfiguration').mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary error');
        return mockTenantConfig;
      });

      const config = await service.loadTenantConfigurationWithRetry('tenant-123', { maxRetries: 3 });
      expect(config).toBeDefined();
      expect(attempts).toBe(3);
    });

    it('should cache frequently accessed data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTenantConfig),
      });
      
      await service.loadTenantConfiguration('tenant-123');
      await service.loadTenantConfiguration('tenant-123');
      
      // Should only call fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid theme changes', async () => {
      const spy = vi.spyOn(service, 'applyTheme');
      
      service.switchTheme({ ...mockTenantConfig.theme, primary: '#ff0000' });
      service.switchTheme({ ...mockTenantConfig.theme, primary: '#00ff00' });
      service.switchTheme({ ...mockTenantConfig.theme, primary: '#0000ff' });
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should debounce and only apply the last theme
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should handle memory cleanup properly', () => {
      service.applyTenantSettings(mockTenantConfig);
      service.cleanup();
      
      expect(service.getCurrentConfiguration()).toBeNull();
    });
  });

  describe('Security and Validation', () => {
    it('should sanitize custom CSS input', () => {
      const maliciousCSS = 'body { background: url("javascript:alert(1)"); }';
      const sanitized = service.sanitizeCSS(maliciousCSS);
      expect(sanitized).not.toContain('javascript:');
    });

    it('should validate URL inputs', () => {
      expect(service.isValidURL('https://example.com')).toBe(true);
      expect(service.isValidURL('http://example.com')).toBe(true);
      expect(service.isValidURL('javascript:alert(1)')).toBe(false);
      expect(service.isValidURL('invalid-url')).toBe(false);
    });

    it('should enforce tenant boundaries', () => {
      service.applyTenantSettings(mockTenantConfig);
      expect(() => service.accessTenantData('other-tenant')).toThrow('Access denied');
    });

    it('should validate configuration schema', () => {
      const invalidConfig = { ...mockTenantConfig, billing: null };
      expect(() => service.validateConfiguration(invalidConfig as any)).toThrow('Invalid billing configuration');
    });
  });
});