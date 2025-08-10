/**
 * Template Service - API Integration Layer
 * Handles all template-related API calls with caching and error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { authStore } from '../stores/authStore';

interface TemplateFilters {
  limit?: number;
  offset?: number;
  category?: string;
  is_active?: boolean;
  search?: string;
  tags?: string[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables?: Record<string, TemplateVariable>;
  version?: string;
  is_active?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface TemplateVariable {
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  default_value?: any;
  options?: string[];
  validation?: string;
  description?: string;
}

interface TemplateVersion {
  id: string;
  version: string;
  created_at: string;
  created_by: string;
  changes: string;
}

interface TemplateClause {
  id: string;
  name: string;
  content: string;
  category: string;
  risk_level: 'low' | 'medium' | 'high';
  is_optional?: boolean;
}

interface GenerateOptions {
  language?: string;
  format?: 'html' | 'pdf' | 'docx';
  include_metadata?: boolean;
}

export class TemplateService {
  private api: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 600000; // 10 minutes for templates
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
      const state = authStore.getState();
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
          throw new Error('Template not found');
        }

        if (error.response?.status === 422) {
          throw new Error('Validation error');
        }

        if (error.response?.status === 500) {
          const detail = (error.response.data as any)?.detail;
          if (detail?.includes('Generation failed')) {
            throw new Error('Generation failed');
          }
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
  async getTemplates(filters?: TemplateFilters): Promise<PaginatedResponse<Template>> {
    const response = await this.api.get<PaginatedResponse<Template>>('/api/v1/templates', {
      params: filters,
    });
    return response.data;
  }

  async getTemplate(id: string): Promise<Template> {
    const cacheKey = this.getCacheKey(`/api/v1/templates/${id}`);
    const cached = this.getFromCache<Template>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.api.get<Template>(`/api/v1/templates/${id}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  async createTemplate(data: Partial<Template>): Promise<Template> {
    const response = await this.api.post<Template>('/api/v1/templates', data);
    this.invalidateCache('templates');
    return response.data;
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    const response = await this.api.put<Template>(`/api/v1/templates/${id}`, data);
    this.invalidateCache(`templates/${id}`);
    this.invalidateCache('templates');
    return response.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.api.delete(`/api/v1/templates/${id}`);
    this.invalidateCache(`templates/${id}`);
    this.invalidateCache('templates');
  }

  // Variables and Logic
  async validateTemplate(data: {
    content: string;
    variables?: Record<string, TemplateVariable>;
  }): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const response = await this.api.post('/api/v1/templates/validate', data);
    return response.data;
  }

  async addVariable(
    templateId: string,
    variable: {
      name: string;
      type: string;
      required?: boolean;
      default_value?: any;
    }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/variables`,
      variable
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async addLogicBlock(
    templateId: string,
    logic: {
      type: 'if' | 'for' | 'switch';
      condition: string;
      content: string;
    }
  ): Promise<{ id: string; type: string; condition: string; content: string }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/logic`,
      logic
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  // Generation
  async generateDocument(
    templateId: string,
    variables: Record<string, any>,
    options?: GenerateOptions
  ): Promise<{
    id?: string;
    content: string;
    format?: string;
    language?: string;
    metadata?: Record<string, any>;
  }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/generate`,
      variables,
      { params: options }
    );
    return response.data;
  }

  async previewTemplate(
    templateId: string,
    options?: { use_sample_data?: boolean; variables?: Record<string, any> }
  ): Promise<{
    content: string;
    variables_used: string[];
    warnings: string[];
  }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/preview`,
      options
    );
    return response.data;
  }

  async generateMultiFormat(
    templateId: string,
    variables: Record<string, any>,
    formats: string[]
  ): Promise<Record<string, string>> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/generate-multi`,
      { variables, formats }
    );
    return response.data;
  }

  // Versioning
  async getVersions(templateId: string): Promise<TemplateVersion[]> {
    const response = await this.api.get<TemplateVersion[]>(
      `/api/v1/templates/${templateId}/versions`
    );
    return response.data;
  }

  async createVersion(
    templateId: string,
    data: { changes: string; content: string }
  ): Promise<TemplateVersion> {
    const response = await this.api.post<TemplateVersion>(
      `/api/v1/templates/${templateId}/versions`,
      data
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async revertToVersion(
    templateId: string,
    versionId: string
  ): Promise<{ id: string; version: string; reverted_from: string }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/revert`,
      { version_id: versionId }
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  // Categories and Tags
  async getCategories(): Promise<Array<{
    id: string;
    name: string;
    count: number;
  }>> {
    const response = await this.api.get('/api/v1/templates/categories');
    return response.data;
  }

  async addTags(templateId: string, tags: string[]): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/tags`,
      { tags }
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async searchByTags(tags: string[]): Promise<PaginatedResponse<Template>> {
    const response = await this.api.get<PaginatedResponse<Template>>(
      '/api/v1/templates/search',
      { params: { tags } }
    );
    return response.data;
  }

  // Clauses
  async getClauses(templateId: string): Promise<TemplateClause[]> {
    const response = await this.api.get<TemplateClause[]>(
      `/api/v1/templates/${templateId}/clauses`
    );
    return response.data;
  }

  async addClause(
    templateId: string,
    clause: {
      clause_id: string;
      position?: number;
      is_optional?: boolean;
    }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/clauses`,
      clause
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async reorderClauses(
    templateId: string,
    clauseIds: string[]
  ): Promise<Template> {
    const response = await this.api.put<Template>(
      `/api/v1/templates/${templateId}/clauses/order`,
      { clause_ids: clauseIds }
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  // Analytics
  async getStatistics(templateId: string): Promise<{
    total_uses: number;
    last_30_days: number;
    average_generation_time: number;
    success_rate: number;
    popular_variables: string[];
    by_department: Record<string, number>;
  }> {
    const response = await this.api.get(
      `/api/v1/templates/${templateId}/statistics`
    );
    return response.data;
  }

  async getRecommendations(context: {
    contract_type?: string;
    jurisdiction?: string;
    value?: number;
  }): Promise<Array<{
    template_id: string;
    name: string;
    score: number;
    reasons: string[];
  }>> {
    const response = await this.api.post('/api/v1/templates/recommend', context);
    return response.data;
  }

  // Approval Workflow
  async submitForApproval(
    templateId: string,
    data: { approvers?: string[]; notes?: string }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/submit-approval`,
      data
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async approveTemplate(
    templateId: string,
    data?: { notes?: string }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/approve`,
      data
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  async rejectTemplate(
    templateId: string,
    data: { reason: string }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/reject`,
      data
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  // Cloning and Import/Export
  async cloneTemplate(
    templateId: string,
    data: { name: string; category?: string }
  ): Promise<Template & { cloned_from: string }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/clone`,
      data
    );
    this.invalidateCache('templates');
    return response.data;
  }

  async exportTemplate(
    templateId: string,
    format: 'json' | 'yaml' | 'xml'
  ): Promise<{ template: Template; format: string }> {
    const response = await this.api.get(
      `/api/v1/templates/${templateId}/export`,
      { params: { format } }
    );
    return response.data;
  }

  async importTemplate(data: Partial<Template>): Promise<Template> {
    const response = await this.api.post<Template>('/api/v1/templates/import', data);
    this.invalidateCache('templates');
    return response.data;
  }

  // Multi-language Support
  async getTranslations(templateId: string): Promise<Record<string, {
    content: string;
    variables?: Record<string, any>;
  }>> {
    const response = await this.api.get(
      `/api/v1/templates/${templateId}/translations`
    );
    return response.data;
  }

  async addTranslation(
    templateId: string,
    translation: { language: string; content: string }
  ): Promise<Template> {
    const response = await this.api.post<Template>(
      `/api/v1/templates/${templateId}/translations`,
      translation
    );
    this.invalidateCache(`templates/${templateId}`);
    return response.data;
  }

  // Bulk Operations
  async bulkUpdate(
    templateIds: string[],
    updates: Partial<Template>
  ): Promise<{
    updated: number;
    failed: number;
    results: Array<{ id: string; success: boolean; error?: string }>;
  }> {
    const response = await this.api.post('/api/v1/templates/bulk/update', {
      template_ids: templateIds,
      updates,
    });
    this.invalidateCache('templates');
    return response.data;
  }

  async bulkDelete(templateIds: string[]): Promise<{
    deleted: number;
    failed: number;
  }> {
    const response = await this.api.post('/api/v1/templates/bulk/delete', {
      template_ids: templateIds,
    });
    this.invalidateCache('templates');
    return response.data;
  }

  // Template Sharing
  async shareTemplate(
    templateId: string,
    data: {
      users?: string[];
      departments?: string[];
      permissions: string[];
    }
  ): Promise<{
    id: string;
    shared_with: { users: string[]; departments: string[] };
  }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/share`,
      data
    );
    return response.data;
  }

  async getSharedTemplates(): Promise<PaginatedResponse<Template>> {
    const response = await this.api.get<PaginatedResponse<Template>>(
      '/api/v1/templates/shared'
    );
    return response.data;
  }

  // Template Comments
  async getComments(templateId: string): Promise<Array<{
    id: string;
    user: string;
    comment: string;
    created_at: string;
  }>> {
    const response = await this.api.get(
      `/api/v1/templates/${templateId}/comments`
    );
    return response.data;
  }

  async addComment(
    templateId: string,
    comment: string
  ): Promise<{
    id: string;
    comment: string;
    created_at: string;
  }> {
    const response = await this.api.post(
      `/api/v1/templates/${templateId}/comments`,
      { comment }
    );
    return response.data;
  }
}

// Export singleton instance
export const templateService = new TemplateService();