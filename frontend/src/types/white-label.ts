// White-Label Platform Type Definitions

export interface TenantConfiguration {
  tenantId: string;
  name: string;
  domain: DomainConfiguration;
  theme: ThemeConfiguration;
  branding: BrandingConfiguration;
  localization: LocalizationSettings;
  features: FeatureFlags;
  billing: BillingConfiguration;
  customization: CustomizationSettings;
}

export interface DomainConfiguration {
  primary: string;
  subdomain: string;
  customDomains: string[];
  pathPrefix?: string;
  seoSettings: SEOSettings;
}

export interface SEOSettings {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  twitterCard?: string;
}

export interface ThemeConfiguration {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  borderRadius: string;
  spacing: 'compact' | 'normal' | 'comfortable';
  customCss?: string;
}

export interface BrandingConfiguration {
  logo: {
    light: string;
    dark: string;
    favicon: string;
  };
  colors: {
    primary: string;
    secondary: string;
  };
  fonts: {
    primary: string;
    secondary: string;
  };
}

export interface LocalizationSettings {
  defaultLanguage: string;
  supportedLanguages: string[];
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
}

export interface FeatureFlags {
  contractManagement: boolean;
  documentAnalysis: boolean;
  aiAssistant: boolean;
  reportGeneration: boolean;
  apiAccess: boolean;
  whiteLabeling: boolean;
  customIntegrations: boolean;
  advancedAnalytics: boolean;
}

export interface BillingConfiguration {
  plan: string;
  limits: UsageData;
  usage: UsageData;
  subscription: {
    status: 'active' | 'inactive' | 'canceled' | 'past_due';
    renewalDate: string;
    amount: number;
    currency: string;
  };
}

export interface UsageData {
  users: number;
  documents: number;
  apiCalls: number;
  storage: number;
}

export interface CustomizationSettings {
  navigation: NavigationItem[];
  dashboard: DashboardLayout;
  components: Record<string, CustomComponent>;
}

export interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
  children?: NavigationItem[];
  permission?: string;
}

export interface DashboardLayout {
  widgets: string[];
  layout: 'grid' | 'flex' | 'masonry';
  columns?: number;
}

export interface CustomComponent {
  fields: string[];
  validation: 'strict' | 'loose' | 'none';
  layout?: 'vertical' | 'horizontal' | 'grid';
  styling?: Record<string, any>;
}

export interface UserInvitation {
  email: string;
  role: string;
  permissions: string[];
  token: string;
  expiresAt: string;
}

export interface APIKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
}

export interface WebhookConfiguration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'active' | 'inactive';
}

// Export the service interface for dependency injection
export interface IWhiteLabelPlatformService {
  loadTenantConfiguration(tenantId: string): Promise<TenantConfiguration>;
  applyTenantSettings(configuration: TenantConfiguration): Promise<void>;
  validateConfiguration(configuration: any): void;
  mergeConfigurations(customConfig: Partial<TenantConfiguration>): TenantConfiguration;
  
  // Theme management
  applyTheme(theme: ThemeConfiguration): Promise<void>;
  switchTheme(newTheme: ThemeConfiguration): Promise<void>;
  getCurrentTheme(): ThemeConfiguration | null;
  
  // Feature flags
  setFeatureFlags(flags: FeatureFlags): void;
  isFeatureEnabled(feature: keyof FeatureFlags): boolean;
  updateFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void;
  getEnabledFeatures(): string[];
  
  // Localization
  setLanguage(language: string): Promise<void>;
  getCurrentLanguage(): string;
  formatDate(date: Date): string;
  formatNumber(number: number): string;
  formatCurrency(amount: number): string;
  
  // Domain management
  isCustomDomain(domain: string): boolean;
  getTenantFromSubdomain(hostname: string): string | null;
  resolveAssetUrl(path: string): string;
  generateDeepLink(path: string, params?: Record<string, string>): string;
  
  // Component management
  isComponentVisible(componentId: string): boolean;
  hideComponent(componentId: string): void;
  showComponent(componentId: string): void;
  getCustomFields(componentId: string): string[];
  
  // Navigation and widgets
  getNavigationItems(): NavigationItem[];
  getDashboardLayout(): DashboardLayout;
  getActiveWidgets(): string[];
  
  // Usage and billing
  getUsagePercentage(metric: keyof UsageData): number;
  generateUsageDashboard(): Record<string, { current: number; limit: number; percentage: number }>;
  formatBillingAmount(amount: number): string;
  isUsageLimitExceeded(metric: keyof UsageData): boolean;
  
  // Admin functions
  createUserInvitation(invitation: Omit<UserInvitation, 'token' | 'expiresAt'>): Promise<UserInvitation>;
  generateAPIKey(options: { name: string; permissions: string[]; expiresIn?: number }): Promise<APIKey>;
  configureWebhook(config: Omit<WebhookConfiguration, 'id' | 'status'>): Promise<WebhookConfiguration>;
  
  // Security
  sanitizeCSS(css: string): string;
  isValidURL(url: string): boolean;
  
  // Utility
  getCurrentConfiguration(): TenantConfiguration | null;
  cleanup(): void;
}