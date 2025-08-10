/**
 * Template Service Integration Tests
 * Following TDD - RED phase: Writing comprehensive tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TemplateService } from '../template.service';
import { authStore } from '../../stores/authStore';

const mockAxios = new MockAdapter(axios);

describe('TemplateService', () => {
  let templateService: TemplateService;
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
      role: 'template_admin',
      permissions: ['templates.read', 'templates.write', 'templates.delete'],
    });

    templateService = new TemplateService();
    mockAxios.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Template CRUD Operations', () => {
    it('should fetch templates list with pagination and filters', async () => {
      const mockTemplates = {
        items: [
          {
            id: 'template-1',
            name: 'Service Agreement Template',
            category: 'service_agreements',
            description: 'Standard service agreement',
            version: '1.0.0',
            is_active: true,
            usage_count: 25,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockAxios.onGet('/api/v1/templates').reply(200, mockTemplates);

      const result = await templateService.getTemplates({
        limit: 20,
        offset: 0,
        category: 'service_agreements',
      });

      expect(result).toEqual(mockTemplates);
      expect(mockAxios.history.get[0].params).toEqual({
        limit: 20,
        offset: 0,
        category: 'service_agreements',
      });
    });

    it('should get single template by ID', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'NDA Template',
        content: 'This Agreement is entered into between {{party_a}} and {{party_b}}...',
        variables: {
          party_a: { type: 'text', required: true },
          party_b: { type: 'text', required: true },
          effective_date: { type: 'date', required: true },
        },
        metadata: {
          jurisdiction: 'California',
          language: 'en',
        },
      };

      mockAxios.onGet('/api/v1/templates/template-1').reply(200, mockTemplate);

      const result = await templateService.getTemplate('template-1');

      expect(result).toEqual(mockTemplate);
    });

    it('should create new template', async () => {
      const newTemplate = {
        name: 'Purchase Order Template',
        category: 'purchase_orders',
        description: 'Standard PO template',
        content: 'Purchase order content...',
        variables: {
          vendor: { type: 'text', required: true },
          amount: { type: 'number', required: true },
        },
      };

      const mockResponse = {
        id: 'template-new',
        ...newTemplate,
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockAxios.onPost('/api/v1/templates').reply(201, mockResponse);

      const result = await templateService.createTemplate(newTemplate);

      expect(result).toEqual(mockResponse);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(newTemplate));
    });

    it('should update existing template', async () => {
      const updates = {
        name: 'Updated Template Name',
        description: 'Updated description',
      };

      const mockResponse = {
        id: 'template-1',
        ...updates,
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockAxios.onPut('/api/v1/templates/template-1').reply(200, mockResponse);

      const result = await templateService.updateTemplate('template-1', updates);

      expect(result).toEqual(mockResponse);
    });

    it('should delete template', async () => {
      mockAxios.onDelete('/api/v1/templates/template-1').reply(204);

      await templateService.deleteTemplate('template-1');

      expect(mockAxios.history.delete).toHaveLength(1);
      expect(mockAxios.history.delete[0].url).toBe('/api/v1/templates/template-1');
    });
  });

  describe('Template Variables and Logic', () => {
    it('should validate template variables', async () => {
      const mockValidation = {
        is_valid: true,
        errors: [],
        warnings: ['Variable "optional_field" is defined but not used'],
      };

      mockAxios.onPost('/api/v1/templates/validate').reply(200, mockValidation);

      const result = await templateService.validateTemplate({
        content: 'Template content {{variable}}',
        variables: { variable: { type: 'text' } },
      });

      expect(result).toEqual(mockValidation);
    });

    it('should add variable to template', async () => {
      const variable = {
        name: 'new_variable',
        type: 'text',
        required: true,
        default_value: '',
      };

      mockAxios.onPost('/api/v1/templates/template-1/variables').reply(200, {
        id: 'template-1',
        variables: {
          existing_var: { type: 'text' },
          new_variable: variable,
        },
      });

      const result = await templateService.addVariable('template-1', variable);

      expect(result.variables.new_variable).toEqual(variable);
    });

    it('should add conditional logic block', async () => {
      const logicBlock = {
        type: 'if',
        condition: 'contract_value > 100000',
        content: 'High value contract terms...',
      };

      mockAxios.onPost('/api/v1/templates/template-1/logic').reply(200, {
        id: 'logic-1',
        ...logicBlock,
      });

      const result = await templateService.addLogicBlock('template-1', logicBlock);

      expect(result.type).toBe('if');
      expect(result.condition).toBe('contract_value > 100000');
    });
  });

  describe('Template Generation', () => {
    it('should generate document from template', async () => {
      const variables = {
        party_a: 'Acme Corp',
        party_b: 'Legal AI Inc',
        effective_date: '2024-01-01',
        contract_value: 100000,
      };

      const mockGenerated = {
        id: 'doc-generated-1',
        content: 'This Agreement is entered into between Acme Corp and Legal AI Inc...',
        format: 'html',
        metadata: {
          generated_from: 'template-1',
          generated_at: '2024-01-01T00:00:00Z',
        },
      };

      mockAxios.onPost('/api/v1/templates/template-1/generate').reply(200, mockGenerated);

      const result = await templateService.generateDocument('template-1', variables);

      expect(result).toEqual(mockGenerated);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual(variables);
    });

    it('should preview template with sample data', async () => {
      const mockPreview = {
        content: 'Preview content with sample values...',
        variables_used: ['party_a', 'party_b', 'effective_date'],
        warnings: [],
      };

      mockAxios.onPost('/api/v1/templates/template-1/preview').reply(200, mockPreview);

      const result = await templateService.previewTemplate('template-1', {
        use_sample_data: true,
      });

      expect(result).toEqual(mockPreview);
    });

    it('should generate in multiple formats', async () => {
      const formats = ['pdf', 'docx', 'html'];
      const mockResponse = {
        pdf: 'base64_pdf_content',
        docx: 'base64_docx_content',
        html: '<html>...</html>',
      };

      mockAxios.onPost('/api/v1/templates/template-1/generate-multi').reply(200, mockResponse);

      const result = await templateService.generateMultiFormat('template-1', {}, formats);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Template Versioning', () => {
    it('should get template versions', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z',
          created_by: 'user-123',
          changes: 'Initial version',
        },
        {
          id: 'version-2',
          version: '1.1.0',
          created_at: '2024-01-02T00:00:00Z',
          created_by: 'user-456',
          changes: 'Added new clauses',
        },
      ];

      mockAxios.onGet('/api/v1/templates/template-1/versions').reply(200, mockVersions);

      const result = await templateService.getVersions('template-1');

      expect(result).toEqual(mockVersions);
    });

    it('should create new template version', async () => {
      const versionData = {
        changes: 'Updated payment terms',
        content: 'New template content...',
      };

      const mockResponse = {
        id: 'version-3',
        version: '1.2.0',
        ...versionData,
        created_at: '2024-01-03T00:00:00Z',
      };

      mockAxios.onPost('/api/v1/templates/template-1/versions').reply(201, mockResponse);

      const result = await templateService.createVersion('template-1', versionData);

      expect(result).toEqual(mockResponse);
    });

    it('should revert to previous version', async () => {
      mockAxios.onPost('/api/v1/templates/template-1/revert').reply(200, {
        id: 'template-1',
        version: '1.0.0',
        reverted_from: '1.2.0',
      });

      const result = await templateService.revertToVersion('template-1', 'version-1');

      expect(result.version).toBe('1.0.0');
    });
  });

  describe('Template Categories and Tags', () => {
    it('should get template categories', async () => {
      const mockCategories = [
        { id: 'service_agreements', name: 'Service Agreements', count: 15 },
        { id: 'ndas', name: 'NDAs', count: 10 },
        { id: 'purchase_orders', name: 'Purchase Orders', count: 8 },
      ];

      mockAxios.onGet('/api/v1/templates/categories').reply(200, mockCategories);

      const result = await templateService.getCategories();

      expect(result).toEqual(mockCategories);
    });

    it('should add tags to template', async () => {
      const tags = ['high-value', 'enterprise', 'sla'];

      mockAxios.onPost('/api/v1/templates/template-1/tags').reply(200, {
        id: 'template-1',
        tags: ['existing-tag', ...tags],
      });

      const result = await templateService.addTags('template-1', tags);

      expect(result.tags).toContain('high-value');
      expect(result.tags).toContain('enterprise');
    });

    it('should search templates by tags', async () => {
      const mockResults = {
        items: [
          { id: 'template-1', name: 'Enterprise SLA', tags: ['enterprise', 'sla'] },
        ],
        total: 1,
      };

      mockAxios.onGet('/api/v1/templates/search').reply(200, mockResults);

      const result = await templateService.searchByTags(['enterprise', 'sla']);

      expect(result).toEqual(mockResults);
      expect(mockAxios.history.get[0].params.tags).toEqual(['enterprise', 'sla']);
    });
  });

  describe('Template Clauses', () => {
    it('should get template clauses', async () => {
      const mockClauses = [
        {
          id: 'clause-1',
          name: 'Confidentiality',
          content: 'Confidentiality clause content...',
          category: 'standard',
          risk_level: 'low',
        },
        {
          id: 'clause-2',
          name: 'Termination',
          content: 'Termination clause content...',
          category: 'standard',
          risk_level: 'medium',
        },
      ];

      mockAxios.onGet('/api/v1/templates/template-1/clauses').reply(200, mockClauses);

      const result = await templateService.getClauses('template-1');

      expect(result).toEqual(mockClauses);
    });

    it('should add clause to template', async () => {
      const clause = {
        clause_id: 'clause-3',
        position: 5,
        is_optional: false,
      };

      mockAxios.onPost('/api/v1/templates/template-1/clauses').reply(200, {
        id: 'template-1',
        clauses: ['clause-1', 'clause-2', 'clause-3'],
      });

      const result = await templateService.addClause('template-1', clause);

      expect(result.clauses).toContain('clause-3');
    });

    it('should reorder clauses', async () => {
      const newOrder = ['clause-2', 'clause-1', 'clause-3'];

      mockAxios.onPut('/api/v1/templates/template-1/clauses/order').reply(200, {
        id: 'template-1',
        clauses: newOrder,
      });

      const result = await templateService.reorderClauses('template-1', newOrder);

      expect(result.clauses).toEqual(newOrder);
    });
  });

  describe('Template Analytics', () => {
    it('should get template usage statistics', async () => {
      const mockStats = {
        total_uses: 150,
        last_30_days: 45,
        average_generation_time: 2.5,
        success_rate: 0.98,
        popular_variables: ['party_a', 'party_b', 'effective_date'],
        by_department: {
          legal: 80,
          sales: 50,
          procurement: 20,
        },
      };

      mockAxios.onGet('/api/v1/templates/template-1/statistics').reply(200, mockStats);

      const result = await templateService.getStatistics('template-1');

      expect(result).toEqual(mockStats);
    });

    it('should get template recommendations', async () => {
      const context = {
        contract_type: 'service_agreement',
        jurisdiction: 'California',
        value: 100000,
      };

      const mockRecommendations = [
        {
          template_id: 'template-1',
          name: 'Enterprise Service Agreement',
          score: 0.95,
          reasons: ['Matches jurisdiction', 'Suitable for value range'],
        },
      ];

      mockAxios.onPost('/api/v1/templates/recommend').reply(200, mockRecommendations);

      const result = await templateService.getRecommendations(context);

      expect(result).toEqual(mockRecommendations);
    });
  });

  describe('Template Approval Workflow', () => {
    it('should submit template for approval', async () => {
      const approvalRequest = {
        approvers: ['user-789'],
        notes: 'Please review new template',
      };

      mockAxios.onPost('/api/v1/templates/template-1/submit-approval').reply(200, {
        id: 'template-1',
        status: 'pending_approval',
        approval_request: {
          id: 'approval-1',
          requested_by: mockUserId,
          requested_at: '2024-01-01T00:00:00Z',
        },
      });

      const result = await templateService.submitForApproval('template-1', approvalRequest);

      expect(result.status).toBe('pending_approval');
    });

    it('should approve template', async () => {
      mockAxios.onPost('/api/v1/templates/template-1/approve').reply(200, {
        id: 'template-1',
        status: 'approved',
        approved_by: mockUserId,
        approved_at: '2024-01-01T00:00:00Z',
      });

      const result = await templateService.approveTemplate('template-1', {
        notes: 'Approved for use',
      });

      expect(result.status).toBe('approved');
    });

    it('should reject template', async () => {
      mockAxios.onPost('/api/v1/templates/template-1/reject').reply(200, {
        id: 'template-1',
        status: 'rejected',
        rejected_by: mockUserId,
        rejection_reason: 'Missing required clauses',
      });

      const result = await templateService.rejectTemplate('template-1', {
        reason: 'Missing required clauses',
      });

      expect(result.status).toBe('rejected');
    });
  });

  describe('Template Cloning and Import/Export', () => {
    it('should clone template', async () => {
      const cloneData = {
        name: 'Cloned Template',
        category: 'service_agreements',
      };

      mockAxios.onPost('/api/v1/templates/template-1/clone').reply(201, {
        id: 'template-cloned',
        ...cloneData,
        cloned_from: 'template-1',
      });

      const result = await templateService.cloneTemplate('template-1', cloneData);

      expect(result.cloned_from).toBe('template-1');
    });

    it('should export template', async () => {
      const mockExport = {
        template: {
          name: 'Template Name',
          content: 'Template content...',
          variables: {},
        },
        format: 'json',
      };

      mockAxios.onGet('/api/v1/templates/template-1/export').reply(200, mockExport);

      const result = await templateService.exportTemplate('template-1', 'json');

      expect(result).toEqual(mockExport);
    });

    it('should import template', async () => {
      const importData = {
        name: 'Imported Template',
        content: 'Template content...',
        variables: {},
      };

      mockAxios.onPost('/api/v1/templates/import').reply(201, {
        id: 'template-imported',
        ...importData,
        imported_at: '2024-01-01T00:00:00Z',
      });

      const result = await templateService.importTemplate(importData);

      expect(result.id).toBe('template-imported');
    });
  });

  describe('Multi-language Support', () => {
    it('should get template translations', async () => {
      const mockTranslations = {
        en: { content: 'English content...' },
        es: { content: 'Spanish content...' },
        fr: { content: 'French content...' },
      };

      mockAxios.onGet('/api/v1/templates/template-1/translations').reply(200, mockTranslations);

      const result = await templateService.getTranslations('template-1');

      expect(result).toEqual(mockTranslations);
    });

    it('should add template translation', async () => {
      const translation = {
        language: 'de',
        content: 'German content...',
      };

      mockAxios.onPost('/api/v1/templates/template-1/translations').reply(200, {
        id: 'template-1',
        translations: ['en', 'es', 'fr', 'de'],
      });

      const result = await templateService.addTranslation('template-1', translation);

      expect(result.translations).toContain('de');
    });

    it('should generate in specific language', async () => {
      const variables = { party_a: 'Company A', party_b: 'Company B' };
      
      mockAxios.onPost('/api/v1/templates/template-1/generate').reply(200, {
        content: 'Contrato generado en español...',
        language: 'es',
      });

      const result = await templateService.generateDocument('template-1', variables, {
        language: 'es',
      });

      expect(result.language).toBe('es');
    });
  });

  describe('Error Handling', () => {
    it('should handle template not found', async () => {
      mockAxios.onGet('/api/v1/templates/non-existent').reply(404, {
        detail: 'Template not found',
      });

      await expect(templateService.getTemplate('non-existent')).rejects.toThrow(
        'Template not found'
      );
    });

    it('should handle validation errors', async () => {
      mockAxios.onPost('/api/v1/templates').reply(422, {
        detail: [
          {
            loc: ['body', 'name'],
            msg: 'Name is required',
            type: 'value_error',
          },
        ],
      });

      await expect(templateService.createTemplate({})).rejects.toThrow(
        'Validation error'
      );
    });

    it('should handle generation errors', async () => {
      mockAxios.onPost('/api/v1/templates/template-1/generate').reply(500, {
        detail: 'Generation failed: Missing required variable',
      });

      await expect(templateService.generateDocument('template-1', {})).rejects.toThrow(
        'Generation failed'
      );
    });
  });

  describe('Caching', () => {
    it('should cache template data', async () => {
      const mockTemplate = { id: 'template-1', name: 'Cached Template' };
      
      mockAxios.onGet('/api/v1/templates/template-1').reply(200, mockTemplate);

      // First call - hits API
      await templateService.getTemplate('template-1');
      
      // Second call - should use cache
      await templateService.getTemplate('template-1');

      // Should only make one API call
      expect(mockAxios.history.get).toHaveLength(1);
    });

    it('should invalidate cache on template update', async () => {
      mockAxios.onPut('/api/v1/templates/template-1').reply(200, {});
      
      await templateService.updateTemplate('template-1', { name: 'Updated' });
      
      // Cache should be invalidated for this template
      mockAxios.onGet('/api/v1/templates/template-1').reply(200, {});
      await templateService.getTemplate('template-1');
      
      expect(mockAxios.history.get).toHaveLength(1);
    });
  });
});