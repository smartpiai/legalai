/**
 * Enterprise CRM Integration Service Tests
 * Following TDD - RED phase: Writing comprehensive tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CRMIntegrationService } from '../crm-integration.service';
import { apiClient } from '../apiClient';

// Mock the apiClient
vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockApiClient = vi.mocked(apiClient);

describe('CRMIntegrationService', () => {
  let crmService: CRMIntegrationService;

  beforeEach(() => {
    crmService = new CRMIntegrationService();
    mockApiClient.get.mockClear();
    mockApiClient.post.mockClear();
    mockApiClient.put.mockClear();
    mockApiClient.delete.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth Authentication', () => {
    it('should initiate Salesforce OAuth flow', async () => {
      const mockAuthUrl = 'https://login.salesforce.com/services/oauth2/authorize?client_id=123';
      
      mockApiClient.get.mockResolvedValue({
        data: {
          auth_url: mockAuthUrl,
          state: 'state-123'
        }
      });

      const result = await crmService.initiateSalesforceAuth();

      expect(result.auth_url).toBe(mockAuthUrl);
      expect(result.state).toBe('state-123');
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/salesforce/auth/url');
    });

    it('should initiate HubSpot OAuth flow', async () => {
      const mockAuthUrl = 'https://app.hubspot.com/oauth/authorize?client_id=456';
      
      mockApiClient.get.mockResolvedValue({
        data: {
          auth_url: mockAuthUrl,
          state: 'state-456'
        }
      });

      const result = await crmService.initiateHubSpotAuth();

      expect(result.auth_url).toBe(mockAuthUrl);
      expect(result.state).toBe('state-456');
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/hubspot/auth/url');
    });

    it('should initiate Dynamics 365 OAuth flow', async () => {
      const mockAuthUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
      
      mockApiClient.get.mockResolvedValue({
        data: {
          auth_url: mockAuthUrl,
          state: 'state-789'
        }
      });

      const result = await crmService.initiateDynamics365Auth();

      expect(result.auth_url).toBe(mockAuthUrl);
      expect(result.state).toBe('state-789');
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/dynamics365/auth/url');
    });

    it('should handle OAuth callback for Salesforce', async () => {
      const mockToken = {
        success: true,
        access_token: 'sf-token-123',
        refresh_token: 'sf-refresh-123',
        instance_url: 'https://company.my.salesforce.com'
      };

      mockApiClient.post.mockResolvedValue({ data: mockToken });

      const result = await crmService.handleSalesforceCallback('auth-code-123', 'state-123');

      expect(result.success).toBe(true);
      expect(result.access_token).toBe(mockToken.access_token);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/salesforce/auth/callback', {
        code: 'auth-code-123',
        state: 'state-123'
      });
    });
  });

  describe('Salesforce CPQ Integration', () => {
    it('should fetch opportunities for quote-to-contract automation', async () => {
      const mockOpportunities = [
        {
          id: 'opp-123',
          name: 'Enterprise Deal',
          amount: 250000,
          stage: 'Proposal/Price Quote',
          close_date: '2024-03-15',
          account: { id: 'acc-123', name: 'Acme Corp' },
          quotes: [{
            id: 'quote-456',
            total_price: 250000,
            status: 'Approved'
          }]
        }
      ];

      mockApiClient.get.mockResolvedValue({ data: mockOpportunities });

      const result = await crmService.getSalesforceOpportunities({
        stage: 'Proposal/Price Quote',
        has_approved_quote: true
      });

      expect(result).toHaveLength(1);
      expect(result[0].quotes![0].status).toBe('Approved');
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/salesforce/opportunities', {
        params: {
          stage: 'Proposal/Price Quote',
          has_approved_quote: true
        }
      });
    });

    it('should synchronize opportunity data', async () => {
      const mockSync = {
        opportunities_synced: 15,
        quotes_synced: 8,
        contracts_created: 3,
        last_sync: '2024-01-15T10:30:00Z'
      };

      mockApiClient.post.mockResolvedValue({ data: mockSync });

      const result = await crmService.syncSalesforceOpportunities();

      expect(result.opportunities_synced).toBe(15);
      expect(result.contracts_created).toBe(3);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/salesforce/sync/opportunities');
    });

    it('should map product catalog to contract templates', async () => {
      const mockMapping = {
        mappings: [
          {
            product_id: 'prod-123',
            product_name: 'Enterprise License',
            template_id: 'template-456',
            template_name: 'Software License Agreement',
            variables: ['seats', 'term_length', 'support_level']
          }
        ],
        total_mappings: 1
      };

      mockApiClient.get.mockResolvedValue({ data: mockMapping });

      const result = await crmService.getSalesforceProductMappings();

      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].variables).toContain('seats');
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/salesforce/product-catalog/mappings');
    });
  });

  describe('HubSpot Workflow Automation', () => {
    it('should fetch deal pipeline data', async () => {
      const mockDeals = {
        deals: [
          {
            id: 'deal-123',
            dealname: 'Q1 Enterprise Deal',
            amount: 150000,
            dealstage: 'contractsent',
            probability: 90,
            closedate: '2024-02-28',
            pipeline: 'default',
            associatedcompanyids: ['company-456']
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockDeals });

      const result = await crmService.getHubSpotDeals({
        pipeline: 'default',
        stage: 'contractsent'
      });

      expect(result.deals).toHaveLength(1);
      expect(result.deals[0].probability).toBe(90);
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/hubspot/deals', {
        params: {
          pipeline: 'default',
          stage: 'contractsent'
        }
      });
    });

    it('should create marketing automation triggers', async () => {
      const triggerData = {
        name: 'Contract Signed Trigger',
        trigger_type: 'contract_status_change',
        conditions: [
          { property: 'contract_status', operator: 'EQ', value: 'signed' }
        ],
        actions: [
          { type: 'send_email', template_id: 'welcome-email-123' },
          { type: 'update_deal_stage', stage: 'closedwon' }
        ]
      };

      const mockResponse = {
        id: 'trigger-123',
        ...triggerData,
        created_at: '2024-01-15T10:00:00Z'
      };

      mockApiClient.post.mockResolvedValue({ data: mockResponse });

      const result = await crmService.createHubSpotTrigger(triggerData);

      expect(result.id).toBe('trigger-123');
      expect(result.actions).toHaveLength(2);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/hubspot/automation/triggers', triggerData);
    });
  });

  describe('Microsoft Dynamics 365 Suite', () => {
    it('should sync account management data', async () => {
      const mockAccounts = {
        accounts: [
          {
            accountid: 'account-123',
            name: 'Global Tech Solutions',
            revenue: 50000000,
            industrycode: 'Technology',
            address1_country: 'United States',
            statuscode: 1,
            customertypecode: 3
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockAccounts });

      const result = await crmService.getDynamics365Accounts({
        industry: 'Technology',
        status: 'active'
      });

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].revenue).toBe(50000000);
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/dynamics365/accounts', {
        params: {
          industry: 'Technology',
          status: 'active'
        }
      });
    });
  });

  describe('Pipeline Synchronization', () => {
    it('should map deal stages between CRM systems', async () => {
      const mockMappings = {
        stage_mappings: [
          { 
            source_system: 'salesforce',
            source_stage: 'Prospecting',
            target_system: 'hubspot',
            target_stage: 'prospect',
            probability: 10
          },
          {
            source_system: 'hubspot',
            source_stage: 'contractsent',
            target_system: 'dynamics365',
            target_stage: 'contract_review',
            probability: 80
          }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockMappings });

      const result = await crmService.getPipelineStageMappings();

      expect(result.stage_mappings).toHaveLength(2);
      expect(result.stage_mappings[1].probability).toBe(80);
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/pipeline/stage-mappings');
    });

    it('should calculate cross-platform probability', async () => {
      const mockCalculation = {
        deal_id: 'deal-123',
        base_probability: 75,
        adjustments: [
          { factor: 'historical_win_rate', adjustment: 5 },
          { factor: 'deal_size', adjustment: -2 },
          { factor: 'customer_tier', adjustment: 3 }
        ],
        final_probability: 81,
        confidence_score: 0.85
      };

      mockApiClient.post.mockResolvedValue({ data: mockCalculation });

      const result = await crmService.calculateDealProbability('deal-123', {
        historical_data: true,
        external_factors: true
      });

      expect(result.final_probability).toBe(81);
      expect(result.confidence_score).toBe(0.85);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/pipeline/calculate-probability', {
        deal_id: 'deal-123',
        historical_data: true,
        external_factors: true
      });
    });
  });

  describe('Quote-to-Contract Automation', () => {
    it('should trigger contract generation from approved quote', async () => {
      const mockGeneration = {
        contract_id: 'contract-789',
        quote_id: 'quote-456',
        template_selected: 'enterprise-license-template',
        variables_mapped: {
          customer_name: 'Acme Corp',
          license_count: 500,
          contract_value: 250000,
          term_length: '24 months'
        },
        generation_status: 'completed'
      };

      mockApiClient.post.mockResolvedValue({ data: mockGeneration });

      const result = await crmService.generateContractFromQuote('quote-456', {
        template_id: 'enterprise-license-template',
        auto_populate: true
      });

      expect(result.contract_id).toBe('contract-789');
      expect(result.variables_mapped.license_count).toBe(500);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/quote-to-contract/generate', {
        quote_id: 'quote-456',
        template_id: 'enterprise-license-template',
        auto_populate: true
      });
    });

    it('should route for approval based on quote value', async () => {
      const mockRouting = {
        approval_required: true,
        approval_chain: [
          { step: 1, approver: 'sales.manager@company.com', role: 'Sales Manager' },
          { step: 2, approver: 'legal.director@company.com', role: 'Legal Director' },
          { step: 3, approver: 'cfo@company.com', role: 'Chief Financial Officer' }
        ],
        routing_reason: 'contract_value_exceeds_threshold',
        threshold_value: 100000
      };

      mockApiClient.post.mockResolvedValue({ data: mockRouting });

      const result = await crmService.routeForApproval('contract-789');

      expect(result.approval_required).toBe(true);
      expect(result.approval_chain).toHaveLength(3);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/quote-to-contract/approval-routing', {
        contract_id: 'contract-789'
      });
    });
  });

  describe('Revenue Recognition', () => {
    it('should track contract values across systems', async () => {
      const mockTracking = {
        total_contract_value: 5250000,
        by_currency: [
          { currency: 'USD', amount: 4200000 },
          { currency: 'EUR', amount: 850000 },
          { currency: 'GBP', amount: 200000 }
        ],
        by_status: [
          { status: 'active', amount: 4500000 },
          { status: 'pending', amount: 750000 }
        ],
        monthly_breakdown: [
          { month: '2024-01', recognized: 425000, deferred: 125000 }
        ]
      };

      mockApiClient.get.mockResolvedValue({ data: mockTracking });

      const result = await crmService.getContractValueTracking({
        period: 'current_year'
      });

      expect(result.total_contract_value).toBe(5250000);
      expect(result.by_currency).toHaveLength(3);
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/revenue/contract-values', {
        params: { period: 'current_year' }
      });
    });

    it('should create recognition schedules', async () => {
      const mockSchedule = {
        contract_id: 'contract-789',
        total_value: 240000,
        recognition_method: 'straight_line',
        schedule_entries: [
          { period: '2024-01', amount: 20000, status: 'recognized' },
          { period: '2024-02', amount: 20000, status: 'scheduled' },
          { period: '2024-03', amount: 20000, status: 'scheduled' }
        ],
        milestones: [
          { name: 'Implementation Complete', date: '2024-02-15', value: 60000 },
          { name: 'Go-Live', date: '2024-03-01', value: 40000 }
        ]
      };

      mockApiClient.post.mockResolvedValue({ data: mockSchedule });

      const result = await crmService.createRecognitionSchedule('contract-789', {
        method: 'straight_line',
        include_milestones: true
      });

      expect(result.schedule_entries).toHaveLength(3);
      expect(result.milestones).toHaveLength(2);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/revenue/recognition-schedule', {
        contract_id: 'contract-789',
        method: 'straight_line',
        include_milestones: true
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should implement conflict resolution for bi-directional sync', async () => {
      const mockConflict = {
        conflict_id: 'conflict-123',
        entity_type: 'opportunity',
        entity_id: 'opp-456',
        conflicts: [
          {
            field: 'amount',
            salesforce_value: 150000,
            hubspot_value: 155000,
            last_modified_sf: '2024-01-15T10:30:00Z',
            last_modified_hs: '2024-01-15T11:15:00Z'
          }
        ],
        resolution_strategy: 'last_modified_wins'
      };

      mockApiClient.post.mockResolvedValue({ data: mockConflict });

      const result = await crmService.resolveConflicts(['conflict-123'], {
        strategy: 'last_modified_wins'
      });

      expect(result.conflicts[0].hubspot_value).toBe(155000);
      expect(result.resolution_strategy).toBe('last_modified_wins');
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/sync/resolve-conflicts', {
        conflict_ids: ['conflict-123'],
        strategy: 'last_modified_wins'
      });
    });

    it('should validate data integrity across systems', async () => {
      const mockValidation = {
        validation_id: 'validation-789',
        total_records: 1000,
        valid_records: 985,
        invalid_records: 15,
        issues: [
          {
            type: 'missing_required_field',
            field: 'close_date',
            count: 8,
            affected_records: ['opp-123', 'opp-456']
          },
          {
            type: 'data_type_mismatch',
            field: 'amount',
            count: 7,
            affected_records: ['opp-789']
          }
        ]
      };

      mockApiClient.post.mockResolvedValue({ data: mockValidation });

      const result = await crmService.validateDataIntegrity({
        entity_types: ['opportunities', 'contacts'],
        deep_validation: true
      });

      expect(result.valid_records).toBe(985);
      expect(result.issues).toHaveLength(2);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/sync/validate', {
        entity_types: ['opportunities', 'contacts'],
        deep_validation: true
      });
    });
  });

  describe('Caching Functionality', () => {
    it('should cache frequently accessed data', async () => {
      const mockData = [{ id: 'opp-123', name: 'Cached Opportunity' }];
      
      mockApiClient.get.mockResolvedValue({ data: mockData });

      // First call - hits API and caches
      await crmService.getSalesforceOpportunities();
      
      // Second call - should use cache
      await crmService.getSalesforceOpportunities();

      // Should only make one API call due to caching
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when requested', () => {
      // This should not throw an error
      expect(() => crmService.clearCache()).not.toThrow();
    });
  });

  describe('Integration Status', () => {
    it('should get integration status for all providers', async () => {
      const mockStatus = {
        salesforce: { connected: true, last_sync: '2024-01-15T10:00:00Z', status: 'active' },
        hubspot: { connected: true, last_sync: '2024-01-15T09:30:00Z', status: 'active' },
        dynamics365: { connected: false, last_sync: null, status: 'disconnected' }
      };

      mockApiClient.get.mockResolvedValue({ data: mockStatus });

      const result = await crmService.getIntegrationStatus();

      expect(result.salesforce.connected).toBe(true);
      expect(result.dynamics365.connected).toBe(false);
      expect(mockApiClient.get).toHaveBeenCalledWith('/crm/integration/status');
    });

    it('should disconnect a CRM provider', async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      const result = await crmService.disconnectProvider('salesforce');

      expect(result.success).toBe(true);
      expect(mockApiClient.post).toHaveBeenCalledWith('/crm/salesforce/disconnect');
    });
  });
});