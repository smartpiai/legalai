// Core App Types
export interface App {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  reviewCount: number;
  downloads: number;
  version: string;
  screenshots: string[];
  permissions: string[];
  publishedAt: string;
  updatedAt: string;
  developerId: string;
  developerName: string;
  featured: boolean;
  verified: boolean;
  videos?: string[];
  documentation?: string;
  supportUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
}

// App Category
export interface AppCategory {
  id: string;
  name: string;
  description: string;
  appCount: number;
  icon: string;
  parentId?: string;
  subcategories?: AppCategory[];
}

// Search and Filter Types
export interface MarketplaceFilters {
  query?: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  sortBy?: 'name' | 'price' | 'rating' | 'downloads' | 'updated';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
  featured?: boolean;
  verified?: boolean;
  tags?: string[];
}

// App Installation
export interface AppInstallation {
  id: string;
  appId: string;
  userId: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  installedAt: string;
  version: string;
  licenseKey: string;
  configuration: Record<string, any>;
  autoUpdate?: boolean;
  lastUpdated?: string;
  errorMessage?: string;
}

// App Review
export interface AppReview {
  id: string;
  appId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  helpful: number;
  verified: boolean;
  response?: {
    content: string;
    createdAt: string;
    developerId: string;
  };
}

// Developer App (Extended App for developers)
export interface DeveloperApp {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  developerId: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  analytics: {
    downloads: number;
    revenue: number;
    ratings: {
      average: number;
      count: number;
    };
    views: number;
  };
  version: string;
  screenshots: string[];
  permissions: string[];
  documentation?: string;
  supportUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
}

// User Purchase
export interface UserPurchase {
  id: string;
  userId: string;
  appId: string;
  appName: string;
  price: number;
  purchasedAt: string;
  licenseKey: string;
  status: 'active' | 'expired' | 'refunded' | 'suspended';
  expiresAt?: string;
  refundedAt?: string;
  invoiceId?: string;
}

// Subscription
export interface Subscription {
  id: string;
  userId: string;
  appId: string;
  plan: string;
  status: 'active' | 'canceled' | 'expired' | 'pending';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate?: string;
  canceledAt?: string;
  cancelReason?: string;
}

// Payment Method
export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'bank' | 'paypal' | 'crypto';
  cardNumber?: string;
  expiryDate?: string;
  isDefault: boolean;
  nickname?: string;
  createdAt?: string;
  lastUsed?: string;
}

// Invoice
export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  paidAt?: string;
  items: InvoiceItem[];
  paymentMethodId?: string;
  downloadUrl?: string;
}

export interface InvoiceItem {
  id: string;
  appId: string;
  appName: string;
  price: number;
  quantity: number;
  type: 'purchase' | 'subscription' | 'upgrade';
}

// Analytics Types
export interface AppAnalytics {
  appId: string;
  downloads: number;
  revenue: number;
  ratings: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  views: number;
  dailyStats: DailyStats[];
  topCountries: CountryStats[];
  conversionRate: number;
}

export interface DailyStats {
  date: string;
  downloads: number;
  revenue: number;
  views: number;
  ratings: number;
}

export interface CountryStats {
  country: string;
  downloads: number;
  revenue: number;
}

// Revenue Types
export interface RevenueData {
  total: number;
  thisMonth: number;
  pending: number;
  paid: number;
  monthlyBreakdown: MonthlyRevenue[];
  topApps: AppRevenue[];
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  downloads: number;
  apps: number;
}

export interface AppRevenue {
  appId: string;
  appName: string;
  revenue: number;
  downloads: number;
}

// Admin Types
export interface PlatformAnalytics {
  totalApps: number;
  totalUsers: number;
  totalDevelopers: number;
  totalRevenue: number;
  monthlyGrowth: number;
  topCategories: CategoryStats[];
  recentActivity: ActivityLog[];
}

export interface CategoryStats {
  category: string;
  appCount: number;
  revenue: number;
  growth: number;
}

export interface ActivityLog {
  id: string;
  type: 'app_submission' | 'user_registration' | 'purchase' | 'review';
  description: string;
  timestamp: string;
  userId?: string;
  appId?: string;
}

// Developer Types
export interface Developer {
  id: string;
  name: string;
  email: string;
  company?: string;
  verified: boolean;
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
  totalApps: number;
  totalRevenue: number;
  rating: number;
  payoutInfo: PayoutInfo;
}

export interface PayoutInfo {
  method: 'bank' | 'paypal' | 'stripe';
  accountDetails: Record<string, any>;
  schedule: 'weekly' | 'monthly';
  minimumAmount: number;
}

// Notification Types
export interface NotificationPreferences {
  userId: string;
  emailNotifications: {
    newReviews: boolean;
    appUpdates: boolean;
    promotions: boolean;
    security: boolean;
  };
  pushNotifications: {
    newReviews: boolean;
    appUpdates: boolean;
    promotions: boolean;
    security: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly';
}

// Collection Types
export interface AppCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  appIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// Wishlist Types
export interface WishlistItem {
  id: string;
  userId: string;
  appId: string;
  addedAt: string;
  notifyOnSale: boolean;
  notifyOnUpdate: boolean;
}

// License Types
export interface License {
  id: string;
  userId: string;
  appId: string;
  licenseKey: string;
  type: 'single' | 'team' | 'enterprise';
  maxUsers: number;
  currentUsers: number;
  expiresAt?: string;
  features: string[];
  restrictions: string[];
}

// Security Types
export interface SecurityAlert {
  id: string;
  type: 'vulnerability' | 'malware' | 'suspicious_activity' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  appId?: string;
  userId?: string;
  developerId?: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: string;
  resolvedAt?: string;
  assignedTo?: string;
}

// Appeal Types
export interface Appeal {
  id: string;
  type: 'app_rejection' | 'account_suspension' | 'content_removal' | 'policy_dispute';
  appId?: string;
  userId?: string;
  developerId?: string;
  reason: string;
  evidence: string[];
  status: 'pending' | 'under_review' | 'approved' | 'denied';
  submittedAt: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  decision?: string;
}

// Fraud Types
export interface FraudAlert {
  id: string;
  type: 'fake_reviews' | 'payment_fraud' | 'account_farming' | 'app_cloning';
  severity: 'low' | 'medium' | 'high';
  targetId: string; // Can be userId, appId, etc.
  targetType: 'user' | 'app' | 'developer';
  description: string;
  evidence: any[];
  status: 'open' | 'investigating' | 'confirmed' | 'false_positive';
  createdAt: string;
  investigatedBy?: string;
  actionTaken?: string;
}

// Usage Tracking Types
export interface UsageStats {
  userId: string;
  appId: string;
  dailyUsage: DailyUsage[];
  totalSessions: number;
  totalDuration: number; // in minutes
  averageSessionDuration: number;
  featuresUsed: FeatureUsage[];
  lastUsed: string;
}

export interface DailyUsage {
  date: string;
  sessions: number;
  duration: number;
  features: string[];
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  lastUsed: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search Results
export interface SearchResult {
  apps: App[];
  total: number;
  facets: {
    categories: { name: string; count: number }[];
    priceRanges: { range: string; count: number }[];
    ratings: { rating: number; count: number }[];
  };
  suggestions: string[];
}

// Error Types
export interface MarketplaceError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Event Types for real-time updates
export interface MarketplaceEvent {
  type: 'app_installed' | 'app_updated' | 'review_posted' | 'purchase_completed';
  data: any;
  timestamp: string;
  userId?: string;
  appId?: string;
}