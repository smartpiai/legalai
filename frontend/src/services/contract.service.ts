/**
 * Contract Service - API Integration Layer
 * Handles all contract-related API calls with caching and error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

interface ContractFilters {
  limit?: number;
  offset?: number;
  status?: string;
  contract_type?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  department?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

interface Contract {
  id: string;
  title: string;
  contract_number?: string;
  contract_type?: string;
  status: string;
  value?: number;
  start_date?: string;
  end_date?: string;
  parties?: string[];
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface ContractDocument {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  uploaded_by?: string;
}

interface ContractVersion {
  id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  changes: string;
}

interface BulkOperationResult {
  updated?: number;
  deleted?: number;
  failed: number;
  results?: Array<{ id: string; success: boolean; error?: string }>;
}

export class ContractService {
  private api: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 300000; // 5 minutes
  private retryAttempts: number = 2;
  private retryDelay: number = 1000;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
    });

    this.cache = new Map();

    // Add request interceptor for auth and tenant headers
    this.api.interceptors.request.use((config) => {
      const state = useAuthStore.getState();
      const token = state.token;
      const user = state.user;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (user?.tenant_id) {
        config.headers['X-Tenant-ID'] = user.tenant_id;
      }

      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 404) {
          throw new Error('Contract not found');
        }

        if (error.response?.status === 422) {
          throw new Error('Validation error');
        }

        if (error.response?.status === 503 && this.retryAttempts > 0) {
          await this.delay(this.retryDelay);
          return this.api.request(error.config!);
        }

        throw error;
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${JSON.stringify(params || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.timestamp + this.cacheTimeout > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  // CRUD Operations
  async getContracts(filters?: ContractFilters): Promise<PaginatedResponse<Contract>> {
    const response = await this.api.get<PaginatedResponse<Contract>>('/api/v1/contracts', {
      params: filters,
    });
    return response.data;
  }

  async getContract(id: string): Promise<Contract> {
    const cacheKey = this.getCacheKey(`/api/v1/contracts/${id}`);
    const cached = this.getFromCache<Contract>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.api.get<Contract>(`/api/v1/contracts/${id}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  async createContract(data: Partial<Contract>): Promise<Contract> {
    const response = await this.api.post<Contract>('/api/v1/contracts', data);
    this.invalidateCache('contracts');
    return response.data;
  }

  async updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
    const response = await this.api.put<Contract>(`/api/v1/contracts/${id}`, data);
    this.invalidateCache(`contracts/${id}`);
    this.invalidateCache('contracts');
    return response.data;
  }

  async deleteContract(id: string): Promise<void> {
    await this.api.delete(`/api/v1/contracts/${id}`);
    this.invalidateCache(`contracts/${id}`);
    this.invalidateCache('contracts');
  }

  // Workflow Operations
  async submitForApproval(
    id: string,
    data: { approvers?: string[]; notes?: string }
  ): Promise<Contract> {
    const response = await this.api.post<Contract>(
      `/api/v1/contracts/${id}/submit-approval`,
      data
    );
    this.invalidateCache(`contracts/${id}`);
    return response.data;
  }

  async approveContract(id: string, data: { notes?: string }): Promise<Contract> {
    const response = await this.api.post<Contract>(`/api/v1/contracts/${id}/approve`, data);
    this.invalidateCache(`contracts/${id}`);
    return response.data;
  }

  async rejectContract(id: string, data: { reason: string }): Promise<Contract> {
    const response = await this.api.post<Contract>(`/api/v1/contracts/${id}/reject`, data);
    this.invalidateCache(`contracts/${id}`);
    return response.data;
  }

  async activateContract(id: string): Promise<Contract> {
    const response = await this.api.post<Contract>(`/api/v1/contracts/${id}/activate`);
    this.invalidateCache(`contracts/${id}`);
    return response.data;
  }

  // Search and Filtering
  async searchContracts(params: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Contract & { score: number }>> {
    const response = await this.api.get<PaginatedResponse<Contract & { score: number }>>(
      '/api/v1/contracts/search',
      { params }
    );
    return response.data;
  }

  async getStatistics(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    total_value: number;
  }> {
    const response = await this.api.get('/api/v1/contracts/statistics');
    return response.data;
  }

  async getExpiringContracts(days: number): Promise<PaginatedResponse<Contract & {
    days_until_expiry: number;
  }>> {
    const response = await this.api.get('/api/v1/contracts/expiring', {
      params: { days },
    });
    return response.data;
  }

  // Document Operations
  async uploadDocument(
    contractId: string,
    file: File,
    options?: {
      onProgress?: (progress: number) => void;
    }
  ): Promise<ContractDocument> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post<ContractDocument>(
      `/api/v1/contracts/${contractId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (options?.onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            options.onProgress(progress);
          }
        },
      }
    );
    return response.data;
  }

  async getDocuments(contractId: string): Promise<ContractDocument[]> {
    const response = await this.api.get<ContractDocument[]>(
      `/api/v1/contracts/${contractId}/documents`
    );
    return response.data;
  }

  async downloadDocument(contractId: string, documentId: string): Promise<Blob> {
    const response = await this.api.get(
      `/api/v1/contracts/${contractId}/documents/${documentId}/download`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  // Version Management
  async getVersions(contractId: string): Promise<ContractVersion[]> {
    const response = await this.api.get<ContractVersion[]>(
      `/api/v1/contracts/${contractId}/versions`
    );
    return response.data;
  }

  async createVersion(
    contractId: string,
    data: { changes: string; content: string }
  ): Promise<ContractVersion> {
    const response = await this.api.post<ContractVersion>(
      `/api/v1/contracts/${contractId}/versions`,
      data
    );
    this.invalidateCache(`contracts/${contractId}`);
    return response.data;
  }

  async compareVersions(
    contractId: string,
    version1: string,
    version2: string
  ): Promise<{
    version1: string;
    version2: string;
    differences: Array<{
      type: string;
      path: string;
      old_value?: any;
      new_value?: any;
    }>;
  }> {
    const response = await this.api.get(
      `/api/v1/contracts/${contractId}/versions/compare`,
      {
        params: { version1, version2 },
      }
    );
    return response.data;
  }

  // Template Operations
  async createFromTemplate(data: {
    template_id: string;
    variables: Record<string, any>;
  }): Promise<Contract> {
    const response = await this.api.post<Contract>('/api/v1/contracts/from-template', data);
    this.invalidateCache('contracts');
    return response.data;
  }

  async saveAsTemplate(
    contractId: string,
    data: {
      name: string;
      description: string;
      category: string;
    }
  ): Promise<{ id: string; name: string; created_from_contract: string }> {
    const response = await this.api.post(
      `/api/v1/contracts/${contractId}/save-as-template`,
      data
    );
    return response.data;
  }

  // Bulk Operations
  async bulkUpdateStatus(
    contractIds: string[],
    status: string
  ): Promise<BulkOperationResult> {
    const response = await this.api.post<BulkOperationResult>(
      '/api/v1/contracts/bulk/update-status',
      {
        contract_ids: contractIds,
        status,
      }
    );
    this.invalidateCache('contracts');
    return response.data;
  }

  async bulkExport(contractIds: string[], format: string): Promise<Blob> {
    const response = await this.api.post(
      '/api/v1/contracts/bulk/export',
      {
        contract_ids: contractIds,
        format,
      },
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  async bulkDelete(contractIds: string[]): Promise<BulkOperationResult> {
    const response = await this.api.post<BulkOperationResult>(
      '/api/v1/contracts/bulk/delete',
      {
        contract_ids: contractIds,
      }
    );
    this.invalidateCache('contracts');
    return response.data;
  }

  // Analytics
  async getAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<{
    average_processing_time: number;
    average_value: number;
    renewal_rate: number;
    compliance_score: number;
    risk_distribution: Record<string, number>;
  }> {
    const response = await this.api.get('/api/v1/contracts/analytics', { params });
    return response.data;
  }

  async getTimeline(contractId: string): Promise<Array<{
    date: string;
    event: string;
    user: string;
    details: string;
  }>> {
    const response = await this.api.get(`/api/v1/contracts/${contractId}/timeline`);
    return response.data;
  }

  // Obligations
  async getObligations(contractId: string): Promise<Array<{
    id: string;
    type: string;
    description: string;
    due_date: string;
    status: string;
    responsible_party: string;
  }>> {
    const response = await this.api.get(`/api/v1/contracts/${contractId}/obligations`);
    return response.data;
  }

  async updateObligation(
    contractId: string,
    obligationId: string,
    data: { status: string; notes?: string }
  ): Promise<void> {
    await this.api.put(
      `/api/v1/contracts/${contractId}/obligations/${obligationId}`,
      data
    );
  }

  // Risk Assessment
  async getRiskAssessment(contractId: string): Promise<{
    overall_risk: string;
    risk_score: number;
    risk_factors: Array<{
      factor: string;
      severity: string;
      mitigation?: string;
    }>;
  }> {
    const response = await this.api.get(`/api/v1/contracts/${contractId}/risk-assessment`);
    return response.data;
  }

  // Notifications
  async getContractNotifications(contractId: string): Promise<Array<{
    id: string;
    type: string;
    message: string;
    created_at: string;
    read: boolean;
  }>> {
    const response = await this.api.get(`/api/v1/contracts/${contractId}/notifications`);
    return response.data;
  }

  async subscribeToUpdates(contractId: string): Promise<void> {
    await this.api.post(`/api/v1/contracts/${contractId}/subscribe`);
  }

  async unsubscribeFromUpdates(contractId: string): Promise<void> {
    await this.api.post(`/api/v1/contracts/${contractId}/unsubscribe`);
  }
}

// Export singleton instance
export const contractService = new ContractService();