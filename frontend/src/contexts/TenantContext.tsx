/**
 * Multi-Tenant Context Provider
 * Ensures proper tenant isolation across the application
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface TenantContextType {
  tenantId: string | null;
  validateTenantAccess: (resourceTenantId: string) => boolean;
  getTenantStorageKey: (key: string) => string;
  clearTenantData: () => void;
  switchTenant: (newTenantId: string) => Promise<void>;
  sanitizeError: (error: any) => any;
  generateTenantUrl: (path: string) => string;
  getTenantWebSocketChannel: (channel: string) => string;
  validateCSRFToken: (token: string) => boolean;
  generateCSRFToken: () => string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: React.ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const tenantId = user?.tenant_id || null;

  // Configure axios interceptors for tenant isolation
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (tenantId) {
          config.headers = config.headers || {};
          config.headers['X-Tenant-ID'] = tenantId;
          
          // Add CSRF token
          const csrfToken = generateCSRFToken();
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle tenant-specific errors
        if (error.response?.status === 403) {
          const message = error.response?.data?.message || '';
          if (message.includes('tenant')) {
            console.error('Tenant access violation detected');
            logout();
            navigate('/login');
          }
        }
        return Promise.reject(sanitizeError(error));
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [tenantId]);

  // Validate tenant access
  const validateTenantAccess = useCallback((resourceTenantId: string): boolean => {
    if (!tenantId) {
      console.error('No tenant context available');
      return false;
    }
    
    if (resourceTenantId !== tenantId) {
      console.error(`Tenant access violation: Attempted to access ${resourceTenantId} from ${tenantId}`);
      return false;
    }
    
    return true;
  }, [tenantId]);

  // Generate tenant-specific storage keys
  const getTenantStorageKey = useCallback((key: string): string => {
    if (!tenantId) {
      throw new Error('Tenant context required for storage operations');
    }
    return `tenant_${tenantId}_${key}`;
  }, [tenantId]);

  // Clear all tenant-specific data
  const clearTenantData = useCallback(() => {
    if (!tenantId) return;

    // Clear localStorage
    const localKeys = Object.keys(localStorage);
    localKeys.forEach(key => {
      if (key.startsWith(`tenant_${tenantId}_`)) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.startsWith(`tenant_${tenantId}_`)) {
        sessionStorage.removeItem(key);
      }
    });

    // Clear stores
    const stores = ['contracts', 'templates', 'users', 'analytics'];
    stores.forEach(storeName => {
      try {
        const store = require(`../store/${storeName}`);
        if (store.default?.setState) {
          store.default.setState(store.default.getState().reset?.() || {});
        }
      } catch (e) {
        // Store might not exist
      }
    });

    // Clear query cache
    if (window.__REACT_QUERY_CLIENT__) {
      window.__REACT_QUERY_CLIENT__.clear();
    }
  }, [tenantId]);

  // Switch tenant (for super admin functionality)
  const switchTenant = useCallback(async (newTenantId: string) => {
    if (!user?.is_super_admin) {
      throw new Error('Only super admins can switch tenants');
    }

    // Clear current tenant data
    clearTenantData();

    // Update auth store with new tenant
    await useAuthStore.getState().switchTenant(newTenantId);

    // Navigate to new tenant context
    navigate(`/app/${newTenantId}/dashboard`);
  }, [user, clearTenantData, navigate]);

  // Sanitize errors to prevent tenant information leakage
  const sanitizeError = useCallback((error: any): any => {
    if (!error) return error;

    let message = error.message || error.toString();
    
    // Remove any tenant IDs that aren't the current tenant's
    const tenantIdPattern = /tenant-[\w-]+/g;
    message = message.replace(tenantIdPattern, (match: string) => 
      match === tenantId ? match : 'tenant-xxx'
    );

    // Remove sensitive paths
    message = message.replace(/\/app\/tenant-[\w-]+/g, (match: string) =>
      match.includes(tenantId || '') ? match : '/app/tenant-xxx'
    );

    return {
      ...error,
      message,
      sanitized: true,
    };
  }, [tenantId]);

  // Generate tenant-specific URLs
  const generateTenantUrl = useCallback((path: string): string => {
    if (!tenantId) {
      throw new Error('Tenant context required for URL generation');
    }
    
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `/app/${tenantId}${normalizedPath}`;
  }, [tenantId]);

  // Get tenant-specific WebSocket channel
  const getTenantWebSocketChannel = useCallback((channel: string): string => {
    if (!tenantId) {
      throw new Error('Tenant context required for WebSocket connection');
    }
    return `/ws/${tenantId}/${channel}`;
  }, [tenantId]);

  // CSRF token generation
  const generateCSRFToken = useCallback((): string => {
    if (!tenantId) return '';
    
    const sessionId = sessionStorage.getItem('session_id') || 
                     Math.random().toString(36).substring(2);
    
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', sessionId);
    }
    
    const timestamp = Date.now();
    const token = btoa(`${tenantId}:${sessionId}:${timestamp}`);
    
    // Store for validation
    sessionStorage.setItem(getTenantStorageKey('csrf_token'), token);
    
    return token;
  }, [tenantId, getTenantStorageKey]);

  // CSRF token validation
  const validateCSRFToken = useCallback((token: string): boolean => {
    if (!tenantId || !token) return false;

    try {
      const decoded = atob(token);
      const [tokenTenantId, sessionId, timestamp] = decoded.split(':');
      
      // Check tenant ID matches
      if (tokenTenantId !== tenantId) return false;
      
      // Check session ID matches
      const currentSessionId = sessionStorage.getItem('session_id');
      if (sessionId !== currentSessionId) return false;
      
      // Check token age (max 1 hour)
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      if (tokenAge > 3600000) return false;
      
      // Check against stored token
      const storedToken = sessionStorage.getItem(getTenantStorageKey('csrf_token'));
      if (token !== storedToken) return false;
      
      return true;
    } catch {
      return false;
    }
  }, [tenantId, getTenantStorageKey]);

  // Clear data on logout
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.isAuthenticated) {
        clearTenantData();
      }
    });

    return unsubscribe;
  }, [clearTenantData]);

  // Validate tenant on route changes
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname;
      const pathMatch = path.match(/\/app\/([^\/]+)/);
      
      if (pathMatch) {
        const pathTenantId = pathMatch[1];
        if (pathTenantId !== tenantId && tenantId) {
          console.error('Tenant mismatch in URL');
          navigate(generateTenantUrl('/dashboard'));
        }
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, [tenantId, navigate, generateTenantUrl]);

  const value = useMemo(() => ({
    tenantId,
    validateTenantAccess,
    getTenantStorageKey,
    clearTenantData,
    switchTenant,
    sanitizeError,
    generateTenantUrl,
    getTenantWebSocketChannel,
    validateCSRFToken,
    generateCSRFToken,
  }), [
    tenantId,
    validateTenantAccess,
    getTenantStorageKey,
    clearTenantData,
    switchTenant,
    sanitizeError,
    generateTenantUrl,
    getTenantWebSocketChannel,
    validateCSRFToken,
    generateCSRFToken,
  ]);

  // Don't render children if no tenant context
  if (user && !tenantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Tenant Context Required</h2>
          <p className="text-gray-600 mb-4">Unable to determine tenant context.</p>
          <button
            onClick={logout}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

// Higher-order component for tenant protection
export const withTenantProtection = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { tenantId } = useTenant();
    
    if (!tenantId) {
      return (
        <div className="p-4 bg-red-50 text-red-800 rounded">
          Tenant context required to access this resource.
        </div>
      );
    }
    
    return <Component {...props} />;
  };
};

// Custom hook for tenant-aware storage
export const useTenantStorage = () => {
  const { getTenantStorageKey } = useTenant();
  
  const getItem = useCallback((key: string): string | null => {
    return localStorage.getItem(getTenantStorageKey(key));
  }, [getTenantStorageKey]);
  
  const setItem = useCallback((key: string, value: string): void => {
    localStorage.setItem(getTenantStorageKey(key), value);
  }, [getTenantStorageKey]);
  
  const removeItem = useCallback((key: string): void => {
    localStorage.removeItem(getTenantStorageKey(key));
  }, [getTenantStorageKey]);
  
  return { getItem, setItem, removeItem };
};

// Custom hook for tenant-aware API calls
export const useTenantApi = () => {
  const { tenantId, validateCSRFToken, generateCSRFToken } = useTenant();
  
  const apiCall = useCallback(async (
    method: string,
    url: string,
    data?: any,
    config?: any
  ) => {
    if (!tenantId) {
      throw new Error('Tenant context required for API calls');
    }
    
    const csrfToken = generateCSRFToken();
    
    return axios({
      method,
      url,
      data,
      ...config,
      headers: {
        ...config?.headers,
        'X-Tenant-ID': tenantId,
        'X-CSRF-Token': csrfToken,
      },
    });
  }, [tenantId, generateCSRFToken]);
  
  return { apiCall };
};