/**
 * Contract Service Integration Tests
 * Following TDD - RED phase: Writing comprehensive tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ContractService } from '../contract.service';
import { authStore } from '../../stores/authStore';

const mockAxios = new MockAdapter(axios);

describe('ContractService', () => {
  let contractService: ContractService;
  const mockToken = 'test-jwt-token';
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    vi.spyOn(authStore.getState(), 'token', 'get').mockReturnValue(mockToken);
    vi.spyOn(authStore.getState(), 'user', 'get').mockReturnValue({
      id: mockUserId,
      tenant_id: mockTenantId,
      name: 'Test User',
      email: 'test@example.com',
      role: 'contract_manager',
      permissions: ['contracts.read', 'contracts.write', 'contracts.delete'],
    });

    contractService = new ContractService();
    mockAxios.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Contract CRUD Operations', () => {
    it('should fetch contracts list with pagination and filters', async () => {
      const mockContracts = {
        items: [
          {
            id: 'contract-1',
            title: 'Service Agreement',
            contract_number: 'CON-2024-001',
            status: 'active',
            value: 100000,
            start_date: '2024-01-01',
            end_date: '2024-12-31',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockAxios.onGet('/api/v1/contracts').reply(200, mockContracts);

      const result = await contractService.getContracts({
        limit: 20,
        offset: 0,
        status: 'active',
      });

      expect(result).toEqual(mockContracts);
      expect(mockAxios.history.get[0].params).toEqual({
        limit: 20,
        offset: 0,
        status: 'active',
      });
      expect(mockAxios.history.get[0].headers?.Authorization).toBe(`Bearer ${mockToken}`);
      expect(mockAxios.history.get[0].headers?.['X-Tenant-ID']).toBe(mockTenantId);
    });

    it('should get single contract by ID', async () => {
      const mockContract = {
        id: 'contract-1',
        title: 'Service Agreement',
        content: 'Full contract text...',
        metadata: {
          parties: ['Acme Corp', 'Legal AI Inc'],
          jurisdiction: 'California',
        },
      };

      mockAxios.onGet('/api/v1/contracts/contract-1').reply(200, mockContract);

      const result = await contractService.getContract('contract-1');

      expect(result).toEqual(mockContract);
    });

    it('should create new contract', async () => {
      const newContract = {
        title: 'New Agreement',
        contract_type: 'service_agreement',
        parties: ['Party A', 'Party B'],
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        value: 50000,
      };

      const mockResponse = {
        id: 'contract-new',
        ...newContract,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockAxios.onPost('/api/v1/contracts').reply(201, mockResponse);

      const result = await contractService.createContract(newContract);

      expect(result).toEqual(mockResponse);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(newContract));
    });

    it('should update existing contract', async () => {
      const updates = {
        title: 'Updated Agreement',
        value: 75000,
      };

      const mockResponse = {
        id: 'contract-1',
        ...updates,
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockAxios.onPut('/api/v1/contracts/contract-1').reply(200, mockResponse);

      const result = await contractService.updateContract('contract-1', updates);

      expect(result).toEqual(mockResponse);
    });

    it('should delete contract', async () => {
      mockAxios.onDelete('/api/v1/contracts/contract-1').reply(204);

      await contractService.deleteContract('contract-1');

      expect(mockAxios.history.delete).toHaveLength(1);
      expect(mockAxios.history.delete[0].url).toBe('/api/v1/contracts/contract-1');
    });
  });

  describe('Contract Workflow Operations', () => {
    it('should submit contract for approval', async () => {
      const mockResponse = {
        id: 'contract-1',
        status: 'pending_approval',
        approval_request: {
          id: 'approval-1',
          requested_by: mockUserId,
          requested_at: '2024-01-01T00:00:00Z',
        },
      };

      mockAxios.onPost('/api/v1/contracts/contract-1/submit-approval').reply(200, mockResponse);

      const result = await contractService.submitForApproval('contract-1', {
        approvers: ['user-789'],
        notes: 'Please review',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should approve contract', async () => {
      mockAxios.onPost('/api/v1/contracts/contract-1/approve').reply(200, {
        id: 'contract-1',
        status: 'approved',
      });

      const result = await contractService.approveContract('contract-1', {
        notes: 'Approved',
      });

      expect(result.status).toBe('approved');
    });

    it('should reject contract', async () => {
      mockAxios.onPost('/api/v1/contracts/contract-1/reject').reply(200, {
        id: 'contract-1',
        status: 'rejected',
      });

      const result = await contractService.rejectContract('contract-1', {
        reason: 'Missing clauses',
      });

      expect(result.status).toBe('rejected');
    });

    it('should activate contract', async () => {
      mockAxios.onPost('/api/v1/contracts/contract-1/activate').reply(200, {
        id: 'contract-1',
        status: 'active',
        activated_at: '2024-01-01T00:00:00Z',
      });

      const result = await contractService.activateContract('contract-1');

      expect(result.status).toBe('active');
    });
  });

  describe('Contract Search and Filtering', () => {
    it('should search contracts by text', async () => {
      const mockResults = {
        items: [
          { id: 'contract-1', title: 'Service Agreement', score: 0.95 },
        ],
        total: 1,
      };

      mockAxios.onGet('/api/v1/contracts/search').reply(200, mockResults);

      const result = await contractService.searchContracts({
        query: 'service agreement',
        limit: 10,
      });

      expect(result).toEqual(mockResults);
      expect(mockAxios.history.get[0].params.query).toBe('service agreement');
    });

    it('should get contract statistics', async () => {
      const mockStats = {
        total: 150,
        by_status: {
          draft: 20,
          active: 100,
          expired: 30,
        },
        by_type: {
          service_agreement: 50,
          nda: 40,
          purchase_order: 60,
        },
        total_value: 5000000,
      };

      mockAxios.onGet('/api/v1/contracts/statistics').reply(200, mockStats);

      const result = await contractService.getStatistics();

      expect(result).toEqual(mockStats);
    });

    it('should get contracts expiring soon', async () => {
      const mockExpiring = {
        items: [
          {
            id: 'contract-1',
            title: 'Expiring Agreement',
            end_date: '2024-02-01',
            days_until_expiry: 15,
          },
        ],
        total: 1,
      };

      mockAxios.onGet('/api/v1/contracts/expiring').reply(200, mockExpiring);

      const result = await contractService.getExpiringContracts(30);

      expect(result).toEqual(mockExpiring);
      expect(mockAxios.history.get[0].params.days).toBe(30);
    });
  });

  describe('Contract Documents', () => {
    it('should upload contract document', async () => {
      const file = new File(['content'], 'contract.pdf', { type: 'application/pdf' });
      const mockResponse = {
        id: 'doc-1',
        filename: 'contract.pdf',
        size: 1024,
        upload_status: 'completed',
      };

      mockAxios.onPost('/api/v1/contracts/contract-1/documents').reply(201, mockResponse);

      const result = await contractService.uploadDocument('contract-1', file, {
        onProgress: vi.fn(),
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxios.history.post[0].headers?.['Content-Type']).toContain('multipart/form-data');
    });

    it('should get contract documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          filename: 'contract.pdf',
          size: 1024,
          uploaded_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockAxios.onGet('/api/v1/contracts/contract-1/documents').reply(200, mockDocuments);

      const result = await contractService.getDocuments('contract-1');

      expect(result).toEqual(mockDocuments);
    });

    it('should download contract document', async () => {
      const mockBlob = new Blob(['document content'], { type: 'application/pdf' });
      
      mockAxios.onGet('/api/v1/contracts/contract-1/documents/doc-1/download')
        .reply(200, mockBlob);

      const result = await contractService.downloadDocument('contract-1', 'doc-1');

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Contract Versions', () => {
    it('should get contract versions', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          version_number: 1,
          created_at: '2024-01-01T00:00:00Z',
          created_by: 'user-123',
          changes: 'Initial version',
        },
        {
          id: 'version-2',
          version_number: 2,
          created_at: '2024-01-02T00:00:00Z',
          created_by: 'user-456',
          changes: 'Updated payment terms',
        },
      ];

      mockAxios.onGet('/api/v1/contracts/contract-1/versions').reply(200, mockVersions);

      const result = await contractService.getVersions('contract-1');

      expect(result).toEqual(mockVersions);
    });

    it('should create new contract version', async () => {
      const versionData = {
        changes: 'Updated terms and conditions',
        content: 'New contract content...',
      };

      const mockResponse = {
        id: 'version-3',
        version_number: 3,
        ...versionData,
        created_at: '2024-01-03T00:00:00Z',
      };

      mockAxios.onPost('/api/v1/contracts/contract-1/versions').reply(201, mockResponse);

      const result = await contractService.createVersion('contract-1', versionData);

      expect(result).toEqual(mockResponse);
    });

    it('should compare contract versions', async () => {
      const mockComparison = {
        version1: 'version-1',
        version2: 'version-2',
        differences: [
          {
            type: 'modified',
            path: 'payment_terms',
            old_value: '30 days',
            new_value: '45 days',
          },
        ],
      };

      mockAxios.onGet('/api/v1/contracts/contract-1/versions/compare')
        .reply(200, mockComparison);

      const result = await contractService.compareVersions('contract-1', 'version-1', 'version-2');

      expect(result).toEqual(mockComparison);
    });
  });

  describe('Contract Templates', () => {
    it('should create contract from template', async () => {
      const templateData = {
        template_id: 'template-1',
        variables: {
          party_a: 'Acme Corp',
          party_b: 'Legal AI Inc',
          value: 100000,
        },
      };

      const mockResponse = {
        id: 'contract-new',
        title: 'Generated Contract',
        status: 'draft',
        generated_from_template: 'template-1',
      };

      mockAxios.onPost('/api/v1/contracts/from-template').reply(201, mockResponse);

      const result = await contractService.createFromTemplate(templateData);

      expect(result).toEqual(mockResponse);
    });

    it('should save contract as template', async () => {
      const templateData = {
        name: 'Service Agreement Template',
        description: 'Standard service agreement',
        category: 'service_agreements',
      };

      const mockResponse = {
        id: 'template-new',
        ...templateData,
        created_from_contract: 'contract-1',
      };

      mockAxios.onPost('/api/v1/contracts/contract-1/save-as-template')
        .reply(201, mockResponse);

      const result = await contractService.saveAsTemplate('contract-1', templateData);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk status update', async () => {
      const contractIds = ['contract-1', 'contract-2', 'contract-3'];
      const mockResponse = {
        updated: 3,
        failed: 0,
        results: contractIds.map(id => ({ id, success: true })),
      };

      mockAxios.onPost('/api/v1/contracts/bulk/update-status').reply(200, mockResponse);

      const result = await contractService.bulkUpdateStatus(contractIds, 'active');

      expect(result).toEqual(mockResponse);
      expect(mockAxios.history.post[0].data).toContain('active');
    });

    it('should perform bulk export', async () => {
      const contractIds = ['contract-1', 'contract-2'];
      const mockBlob = new Blob(['export data'], { type: 'application/zip' });

      mockAxios.onPost('/api/v1/contracts/bulk/export').reply(200, mockBlob);

      const result = await contractService.bulkExport(contractIds, 'pdf');

      expect(result).toBeInstanceOf(Blob);
    });

    it('should perform bulk delete', async () => {
      const contractIds = ['contract-1', 'contract-2'];
      const mockResponse = {
        deleted: 2,
        failed: 0,
      };

      mockAxios.onPost('/api/v1/contracts/bulk/delete').reply(200, mockResponse);

      const result = await contractService.bulkDelete(contractIds);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Contract Analytics', () => {
    it('should get contract analytics', async () => {
      const mockAnalytics = {
        average_processing_time: 2.5,
        average_value: 75000,
        renewal_rate: 0.85,
        compliance_score: 0.92,
        risk_distribution: {
          low: 60,
          medium: 30,
          high: 10,
        },
      };

      mockAxios.onGet('/api/v1/contracts/analytics').reply(200, mockAnalytics);

      const result = await contractService.getAnalytics({
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result).toEqual(mockAnalytics);
    });

    it('should get contract timeline', async () => {
      const mockTimeline = [
        {
          date: '2024-01-01',
          event: 'created',
          user: 'user-123',
          details: 'Contract created',
        },
        {
          date: '2024-01-02',
          event: 'updated',
          user: 'user-456',
          details: 'Updated payment terms',
        },
      ];

      mockAxios.onGet('/api/v1/contracts/contract-1/timeline').reply(200, mockTimeline);

      const result = await contractService.getTimeline('contract-1');

      expect(result).toEqual(mockTimeline);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      mockAxios.onGet('/api/v1/contracts/non-existent').reply(404, {
        detail: 'Contract not found',
      });

      await expect(contractService.getContract('non-existent')).rejects.toThrow(
        'Contract not found'
      );
    });

    it('should handle validation errors', async () => {
      mockAxios.onPost('/api/v1/contracts').reply(422, {
        detail: [
          {
            loc: ['body', 'title'],
            msg: 'Title is required',
            type: 'value_error',
          },
        ],
      });

      await expect(contractService.createContract({})).rejects.toThrow(
        'Validation error'
      );
    });

    it('should retry on network errors', async () => {
      mockAxios
        .onGet('/api/v1/contracts')
        .replyOnce(503)
        .onGet('/api/v1/contracts')
        .replyOnce(200, { items: [], total: 0 });

      const result = await contractService.getContracts();

      expect(result.items).toEqual([]);
      expect(mockAxios.history.get).toHaveLength(2);
    });
  });

  describe('Caching', () => {
    it('should cache frequently accessed contracts', async () => {
      const mockContract = { id: 'contract-1', title: 'Cached Contract' };
      
      mockAxios.onGet('/api/v1/contracts/contract-1').reply(200, mockContract);

      // First call - hits API
      await contractService.getContract('contract-1');
      
      // Second call - should use cache
      await contractService.getContract('contract-1');

      // Should only make one API call
      expect(mockAxios.history.get).toHaveLength(1);
    });

    it('should invalidate cache on update', async () => {
      const mockContract = { id: 'contract-1', title: 'Original' };
      const updatedContract = { id: 'contract-1', title: 'Updated' };
      
      mockAxios.onGet('/api/v1/contracts/contract-1').reply(200, mockContract);
      mockAxios.onPut('/api/v1/contracts/contract-1').reply(200, updatedContract);

      // Get and cache
      await contractService.getContract('contract-1');
      
      // Update should invalidate cache
      await contractService.updateContract('contract-1', { title: 'Updated' });
      
      // Next get should hit API again
      mockAxios.onGet('/api/v1/contracts/contract-1').reply(200, updatedContract);
      await contractService.getContract('contract-1');

      expect(mockAxios.history.get).toHaveLength(2);
    });
  });
});