/**
 * Enterprise CRM Integration Service
 * Integrates with Salesforce, HubSpot, and Microsoft Dynamics 365
 * Supports quote-to-contract automation, pipeline synchronization, and revenue recognition
 */

import { apiClient } from './apiClient';
import type {
  CRMAuthResponse,
  CRMTokenResponse,
  SalesforceOpportunity,
  SalesforceOpportunityFilters,
  SalesforceSync,
  ProductMappingResponse,
  PricingRulesResponse,
  ApprovalWorkflowResponse,
  HubSpotDealsResponse,
  HubSpotDealFilters,
  HubSpotContactsResponse,
  HubSpotContactFilters,
  HubSpotActivitiesResponse,
  HubSpotActivityFilters,
  HubSpotCampaignsResponse,
  HubSpotTriggerData,
  HubSpotTrigger,
  Dynamics365AccountsResponse,
  Dynamics365AccountFilters,
  Dynamics365LeadsResponse,
  Dynamics365LeadFilters,
  Dynamics365CasesResponse,
  Dynamics365CaseFilters,
  Dynamics365BusinessProcessesResponse,
  PowerAutomateFlowsResponse,
  PipelineStageMappingsResponse,
  ProbabilityCalculation,
  ProbabilityCalculationRequest,
  PipelineForecast,
  PipelineForecastRequest,
  DealVelocity,
  DealVelocityRequest,
  WinLossAnalysis,
  WinLossAnalysisRequest,
  ContractGeneration,
  ContractGenerationRequest,
  QuoteVariableMapping,
  TemplateSelection,
  ApprovalRouting,
  ESignatureWorkflow,
  ContractValueTracking,
  ContractValueTrackingRequest,
  RecognitionSchedule,
  RecognitionScheduleRequest,
  MilestoneRecognition,
  MilestoneRecognitionRequest,
  CurrencyConversionRequest,
  CurrencyConversionResponse,
  RevenueExportRequest,
  RevenueExport,
  ConflictResolution,
  ConflictResolutionRequest,
  DataValidation,
  DataValidationRequest,
} from '../types/crm-integration.types';

// Cache implementation
class CRMCache {
  private cache = new Map<string, { data: any; expires: number; ttl: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Retry utility
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export class CRMIntegrationService {
  private cache = new CRMCache();

  // OAuth Authentication
  async initiateSalesforceAuth(): Promise<CRMAuthResponse> {
    const response = await apiClient.get<CRMAuthResponse>('/crm/salesforce/auth/url');
    return response.data;
  }

  async initiateHubSpotAuth(): Promise<CRMAuthResponse> {
    const response = await apiClient.get<CRMAuthResponse>('/crm/hubspot/auth/url');
    return response.data;
  }

  async initiateDynamics365Auth(): Promise<CRMAuthResponse> {
    const response = await apiClient.get<CRMAuthResponse>('/crm/dynamics365/auth/url');
    return response.data;
  }

  async handleSalesforceCallback(code: string, state: string): Promise<CRMTokenResponse> {
    const response = await apiClient.post<CRMTokenResponse>('/crm/salesforce/auth/callback', { code, state });
    return response.data;
  }

  async handleHubSpotCallback(code: string, state: string): Promise<CRMTokenResponse> {
    const response = await apiClient.post<CRMTokenResponse>('/crm/hubspot/auth/callback', { code, state });
    return response.data;
  }

  async handleDynamics365Callback(code: string, state: string): Promise<CRMTokenResponse> {
    const response = await apiClient.post<CRMTokenResponse>('/crm/dynamics365/auth/callback', { code, state });
    return response.data;
  }

  // Salesforce CPQ Integration
  async getSalesforceOpportunities(filters: SalesforceOpportunityFilters = {}): Promise<SalesforceOpportunity[]> {
    const cacheKey = `sf_opportunities_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      const response = await apiClient.get<SalesforceOpportunity[]>('/crm/salesforce/opportunities', { params: filters });
      return response.data;
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  async syncSalesforceOpportunities(): Promise<SalesforceSync> {
    const response = await withRetry(async () => {
      return await apiClient.post<SalesforceSync>('/crm/salesforce/sync/opportunities');
    });
    
    this.cache.invalidate('sf_opportunities');
    return response.data;
  }

  async getSalesforceProductMappings(): Promise<ProductMappingResponse> {
    const cacheKey = 'sf_product_mappings';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<ProductMappingResponse>('/crm/salesforce/product-catalog/mappings');
    this.cache.set(cacheKey, response.data, 15 * 60 * 1000);
    return response.data;
  }

  async getSalesforcePricingRules(): Promise<PricingRulesResponse> {
    const cacheKey = 'sf_pricing_rules';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<PricingRulesResponse>('/crm/salesforce/pricing-rules');
    this.cache.set(cacheKey, response.data, 10 * 60 * 1000);
    return response.data;
  }

  async getSalesforceApprovalWorkflows(): Promise<ApprovalWorkflowResponse> {
    const cacheKey = 'sf_approval_workflows';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<ApprovalWorkflowResponse>('/crm/salesforce/approval-workflows');
    this.cache.set(cacheKey, response.data, 30 * 60 * 1000);
    return response.data;
  }

  // HubSpot Workflow Automation
  async getHubSpotDeals(filters: HubSpotDealFilters): Promise<HubSpotDealsResponse> {
    const cacheKey = `hs_deals_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      const response = await apiClient.get<HubSpotDealsResponse>('/crm/hubspot/deals', { params: filters });
      return response.data;
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  async getHubSpotContacts(filters: HubSpotContactFilters): Promise<HubSpotContactsResponse> {
    const cacheKey = `hs_contacts_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      const response = await apiClient.get<HubSpotContactsResponse>('/crm/hubspot/contacts', { params: filters });
      return response.data;
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  async getHubSpotActivities(filters: HubSpotActivityFilters): Promise<HubSpotActivitiesResponse> {
    const response = await withRetry(async () => {
      return await apiClient.get<HubSpotActivitiesResponse>('/crm/hubspot/activities', { params: filters });
    });
    return response.data;
  }

  async getHubSpotCampaigns(): Promise<HubSpotCampaignsResponse> {
    const cacheKey = 'hs_campaigns';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<HubSpotCampaignsResponse>('/crm/hubspot/campaigns');
    this.cache.set(cacheKey, response.data, 10 * 60 * 1000);
    return response.data;
  }

  async createHubSpotTrigger(triggerData: HubSpotTriggerData): Promise<HubSpotTrigger> {
    const response = await apiClient.post<HubSpotTrigger>('/crm/hubspot/automation/triggers', triggerData);
    return response.data;
  }

  // Microsoft Dynamics 365 Suite
  async getDynamics365Accounts(filters: Dynamics365AccountFilters): Promise<Dynamics365AccountsResponse> {
    const cacheKey = `d365_accounts_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      const response = await apiClient.get<Dynamics365AccountsResponse>('/crm/dynamics365/accounts', { params: filters });
      return response.data;
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDynamics365Leads(filters: Dynamics365LeadFilters): Promise<Dynamics365LeadsResponse> {
    const cacheKey = `d365_leads_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      const response = await apiClient.get<Dynamics365LeadsResponse>('/crm/dynamics365/leads', { params: filters });
      return response.data;
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDynamics365Cases(filters: Dynamics365CaseFilters): Promise<Dynamics365CasesResponse> {
    const response = await withRetry(async () => {
      return await apiClient.get<Dynamics365CasesResponse>('/crm/dynamics365/cases', { params: filters });
    });
    return response.data;
  }

  async getDynamics365BusinessProcesses(): Promise<Dynamics365BusinessProcessesResponse> {
    const cacheKey = 'd365_business_processes';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<Dynamics365BusinessProcessesResponse>('/crm/dynamics365/business-processes');
    this.cache.set(cacheKey, response.data, 15 * 60 * 1000);
    return response.data;
  }

  async getDynamics365PowerAutomateFlows(): Promise<PowerAutomateFlowsResponse> {
    const cacheKey = 'd365_power_automate_flows';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<PowerAutomateFlowsResponse>('/crm/dynamics365/power-automate/flows');
    this.cache.set(cacheKey, response.data, 10 * 60 * 1000);
    return response.data;
  }

  // Pipeline Synchronization
  async getPipelineStageMappings(): Promise<PipelineStageMappingsResponse> {
    const cacheKey = 'pipeline_stage_mappings';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<PipelineStageMappingsResponse>('/crm/pipeline/stage-mappings');
    this.cache.set(cacheKey, response.data, 30 * 60 * 1000);
    return response.data;
  }

  async calculateDealProbability(dealId: string, options: ProbabilityCalculationRequest): Promise<ProbabilityCalculation> {
    const response = await apiClient.post<ProbabilityCalculation>('/crm/pipeline/calculate-probability', {
      deal_id: dealId,
      ...options
    });
    return response.data;
  }

  async getPipelineForecast(request: PipelineForecastRequest): Promise<PipelineForecast> {
    const cacheKey = `pipeline_forecast_${JSON.stringify(request)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<PipelineForecast>('/crm/pipeline/forecast', { params: request });
    this.cache.set(cacheKey, response.data, 5 * 60 * 1000);
    return response.data;
  }

  async getDealVelocity(request: DealVelocityRequest): Promise<DealVelocity> {
    const response = await apiClient.get<DealVelocity>('/crm/pipeline/velocity', { params: request });
    return response.data;
  }

  async getWinLossAnalysis(request: WinLossAnalysisRequest): Promise<WinLossAnalysis> {
    const response = await apiClient.get<WinLossAnalysis>('/crm/pipeline/win-loss-analysis', { params: request });
    return response.data;
  }

  // Quote-to-Contract Automation
  async generateContractFromQuote(quoteId: string, options: ContractGenerationRequest): Promise<ContractGeneration> {
    const response = await apiClient.post<ContractGeneration>('/crm/quote-to-contract/generate', {
      quote_id: quoteId,
      ...options
    });
    return response.data;
  }

  async mapQuoteVariables(quoteId: string, templateId: string): Promise<QuoteVariableMapping> {
    const response = await apiClient.post<QuoteVariableMapping>('/crm/quote-to-contract/map-variables', {
      quote_id: quoteId,
      template_id: templateId
    });
    return response.data;
  }

  async selectContractTemplate(quoteId: string): Promise<TemplateSelection> {
    const response = await apiClient.post<TemplateSelection>('/crm/quote-to-contract/select-template', {
      quote_id: quoteId
    });
    return response.data;
  }

  async routeForApproval(contractId: string): Promise<ApprovalRouting> {
    const response = await apiClient.post<ApprovalRouting>('/crm/quote-to-contract/approval-routing', {
      contract_id: contractId
    });
    return response.data;
  }

  async triggerESignature(contractId: string): Promise<ESignatureWorkflow> {
    const response = await apiClient.post<ESignatureWorkflow>('/crm/quote-to-contract/e-signature', {
      contract_id: contractId
    });
    return response.data;
  }

  // Revenue Recognition
  async getContractValueTracking(request: ContractValueTrackingRequest): Promise<ContractValueTracking> {
    const cacheKey = `contract_value_tracking_${JSON.stringify(request)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await apiClient.get<ContractValueTracking>('/crm/revenue/contract-values', { params: request });
    this.cache.set(cacheKey, response.data, 2 * 60 * 1000);
    return response.data;
  }

  async createRecognitionSchedule(contractId: string, options: RecognitionScheduleRequest): Promise<RecognitionSchedule> {
    const response = await apiClient.post<RecognitionSchedule>('/crm/revenue/recognition-schedule', {
      contract_id: contractId,
      ...options
    });
    return response.data;
  }

  async recognizeMilestone(milestoneId: string, data: MilestoneRecognitionRequest): Promise<MilestoneRecognition> {
    const response = await apiClient.post<MilestoneRecognition>('/crm/revenue/milestone-recognition', {
      milestone_id: milestoneId,
      ...data
    });
    return response.data;
  }

  async convertCurrency(conversions: CurrencyConversionRequest[]): Promise<CurrencyConversionResponse> {
    const response = await apiClient.post<CurrencyConversionResponse>('/crm/revenue/currency-conversion', { conversions });
    return response.data;
  }

  async exportRevenueData(request: RevenueExportRequest): Promise<RevenueExport> {
    const response = await apiClient.post<RevenueExport>('/crm/revenue/export', request);
    return response.data;
  }

  // Error Handling and Resilience
  async resolveConflicts(conflictIds: string[], options: ConflictResolutionRequest): Promise<ConflictResolution> {
    const response = await apiClient.post<ConflictResolution>('/crm/sync/resolve-conflicts', {
      conflict_ids: conflictIds,
      ...options
    });
    return response.data;
  }

  async validateDataIntegrity(request: DataValidationRequest): Promise<DataValidation> {
    const response = await apiClient.post<DataValidation>('/crm/sync/validate', request);
    return response.data;
  }

  // Utility methods
  async refreshAuthToken(provider: 'salesforce' | 'hubspot' | 'dynamics365'): Promise<CRMTokenResponse> {
    const response = await apiClient.post<CRMTokenResponse>(`/crm/${provider}/auth/refresh`);
    return response.data;
  }

  async getIntegrationStatus(): Promise<{
    salesforce: { connected: boolean; last_sync: string; status: string };
    hubspot: { connected: boolean; last_sync: string; status: string };
    dynamics365: { connected: boolean; last_sync: string; status: string };
  }> {
    const response = await apiClient.get('/crm/integration/status');
    return response.data;
  }

  async disconnectProvider(provider: 'salesforce' | 'hubspot' | 'dynamics365'): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/crm/${provider}/disconnect`);
    this.cache.invalidate(provider.substring(0, 3));
    return response.data;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const crmIntegrationService = new CRMIntegrationService();