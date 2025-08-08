import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TemplateSelectionEngine } from '../TemplateSelectionEngine';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user1',
      permissions: ['view_templates', 'use_templates', 'manage_templates'],
    },
  }),
}));

describe('TemplateSelectionEngine', () => {
  let queryClient: QueryClient;
  const mockOnSelect = vi.fn();
  const mockOnPreview = vi.fn();
  const mockOnCombine = vi.fn();

  const mockTemplates = [
    {
      id: 'tmpl1',
      name: 'Service Agreement Template',
      type: 'service_agreement',
      jurisdiction: 'US',
      riskLevel: 'medium',
      industry: 'technology',
      tags: ['services', 'technology', 'B2B'],
      usageCount: 150,
      lastUsed: '2024-01-15',
      averageRating: 4.2,
      compatibility: ['NDA', 'SOW'],
      metadata: {
        complexity: 'medium',
        estimatedTime: '30min',
        requiredFields: ['party1', 'party2', 'services', 'amount'],
      },
    },
    {
      id: 'tmpl2',
      name: 'Non-Disclosure Agreement',
      type: 'nda',
      jurisdiction: 'US',
      riskLevel: 'low',
      industry: 'general',
      tags: ['confidentiality', 'intellectual_property'],
      usageCount: 300,
      lastUsed: '2024-01-20',
      averageRating: 4.8,
      compatibility: ['Service Agreement', 'Employment'],
      metadata: {
        complexity: 'low',
        estimatedTime: '15min',
        requiredFields: ['disclosing_party', 'receiving_party'],
      },
    },
    {
      id: 'tmpl3',
      name: 'Employment Contract UK',
      type: 'employment',
      jurisdiction: 'UK',
      riskLevel: 'high',
      industry: 'general',
      tags: ['employment', 'UK_law'],
      usageCount: 75,
      lastUsed: '2024-01-10',
      averageRating: 4.0,
      compatibility: ['NDA'],
      metadata: {
        complexity: 'high',
        estimatedTime: '60min',
        requiredFields: ['employee', 'employer', 'salary', 'position'],
      },
    },
  ];

  const mockUserProfile = {
    jurisdiction: 'US',
    industry: 'technology',
    riskTolerance: 'medium',
    preferredComplexity: 'medium',
    recentTypes: ['service_agreement', 'nda'],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    const { api } = require('../../../services/api');
    api.get.mockImplementation((url) => {
      if (url.includes('/templates/recommendations')) {
        return Promise.resolve({ data: mockTemplates });
      }
      if (url.includes('/user/profile')) {
        return Promise.resolve({ data: mockUserProfile });
      }
      if (url.includes('/templates/analytics')) {
        return Promise.resolve({
          data: {
            trending: ['tmpl1', 'tmpl2'],
            mostSuccessful: ['tmpl2', 'tmpl1'],
            industry: mockTemplates,
          },
        });
      }
      if (url.includes('/templates/compatibility')) {
        return Promise.resolve({ data: ['tmpl1', 'tmpl2'] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TemplateSelectionEngine
          contractType="service_agreement"
          onSelect={mockOnSelect}
          onPreview={mockOnPreview}
          onCombine={mockOnCombine}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should render the template selection engine', () => {
      renderComponent();
      
      expect(screen.getByTestId('template-selection-engine')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /template selection/i })).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      renderComponent();
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/analyzing your requirements/i)).toBeInTheDocument();
    });

    it('should display contract type filter', () => {
      renderComponent();
      
      expect(screen.getByLabelText(/contract type/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/service agreement/i)).toBeInTheDocument();
    });
  });

  describe('Intelligent Recommendations', () => {
    it('should display recommended templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/recommended templates/i)).toBeInTheDocument();
        expect(screen.getByText('Service Agreement Template')).toBeInTheDocument();
        expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
      });
    });

    it('should show recommendation scores and reasons', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/match: 95%/i)).toBeInTheDocument();
        expect(screen.getByText(/perfect for technology services/i)).toBeInTheDocument();
        expect(screen.getByText(/frequently used together/i)).toBeInTheDocument();
      });
    });

    it('should prioritize templates by user profile', async () => {
      renderComponent();
      
      await waitFor(() => {
        const templates = screen.getAllByTestId(/template-card/);
        expect(templates[0]).toHaveTextContent('Service Agreement Template');
        expect(templates[1]).toHaveTextContent('Non-Disclosure Agreement');
      });
    });

    it('should show fallback templates when no matches', async () => {
      const { api } = require('../../../services/api');
      api.get.mockResolvedValueOnce({ data: [] });
      
      renderComponent({ contractType: 'rare_contract_type' });
      
      await waitFor(() => {
        expect(screen.getByText(/no exact matches found/i)).toBeInTheDocument();
        expect(screen.getByText(/similar templates/i)).toBeInTheDocument();
        expect(screen.getByText(/general contract template/i)).toBeInTheDocument();
      });
    });
  });

  describe('Contract Type Classification', () => {
    it('should classify contract type automatically', async () => {
      renderComponent({ contractType: undefined });
      
      await waitFor(() => {
        expect(screen.getByText(/auto-detected: service agreement/i)).toBeInTheDocument();
      });
    });

    it('should allow manual contract type override', async () => {
      renderComponent();
      
      const typeSelect = screen.getByLabelText(/contract type/i);
      fireEvent.change(typeSelect, { target: { value: 'employment' } });
      
      await waitFor(() => {
        expect(screen.getByText('Employment Contract UK')).toBeInTheDocument();
      });
    });

    it('should show confidence level for auto-classification', async () => {
      renderComponent({ contractType: undefined });
      
      await waitFor(() => {
        expect(screen.getByText(/confidence: 87%/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /verify classification/i })).toBeInTheDocument();
      });
    });

    it('should provide classification alternatives', async () => {
      renderComponent({ contractType: undefined });
      
      await waitFor(() => {
        expect(screen.getByText(/other possibilities/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /consulting agreement/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /master service agreement/i })).toBeInTheDocument();
      });
    });
  });

  describe('Jurisdiction-based Selection', () => {
    it('should filter templates by jurisdiction', async () => {
      renderComponent();
      
      await waitFor(() => {
        const jurisdictionFilter = screen.getByLabelText(/jurisdiction/i);
        fireEvent.change(jurisdictionFilter, { target: { value: 'UK' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Employment Contract UK')).toBeInTheDocument();
        expect(screen.queryByText('Service Agreement Template')).not.toBeInTheDocument();
      });
    });

    it('should show jurisdiction compatibility warnings', async () => {
      renderComponent();
      
      await waitFor(() => {
        const jurisdictionFilter = screen.getByLabelText(/jurisdiction/i);
        fireEvent.change(jurisdictionFilter, { target: { value: 'EU' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/limited templates available for EU/i)).toBeInTheDocument();
        expect(screen.getByText(/consider adaptation of US template/i)).toBeInTheDocument();
      });
    });

    it('should suggest jurisdiction-specific clauses', async () => {
      renderComponent();
      
      await waitFor(() => {
        const templateCard = screen.getByTestId('template-card-tmpl3');
        expect(within(templateCard).getByText(/uk employment law compliant/i)).toBeInTheDocument();
        expect(within(templateCard).getByText(/includes gdpr clauses/i)).toBeInTheDocument();
      });
    });
  });

  describe('Risk Profile Matching', () => {
    it('should match templates to user risk tolerance', async () => {
      renderComponent();
      
      await waitFor(() => {
        const mediumRiskTemplate = screen.getByTestId('template-card-tmpl1');
        expect(within(mediumRiskTemplate).getByText(/risk: medium/i)).toBeInTheDocument();
        expect(within(mediumRiskTemplate).getByText(/matches your profile/i)).toBeInTheDocument();
      });
    });

    it('should warn about risk mismatches', async () => {
      renderComponent();
      
      await waitFor(() => {
        const highRiskTemplate = screen.getByTestId('template-card-tmpl3');
        expect(within(highRiskTemplate).getByText(/risk: high/i)).toBeInTheDocument();
        expect(within(highRiskTemplate).getByText(/higher risk than usual/i)).toBeInTheDocument();
      });
    });

    it('should allow risk tolerance adjustment', async () => {
      renderComponent();
      
      await waitFor(() => {
        const riskFilter = screen.getByLabelText(/risk tolerance/i);
        fireEvent.change(riskFilter, { target: { value: 'high' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/showing all risk levels/i)).toBeInTheDocument();
      });
    });

    it('should explain risk factors', async () => {
      renderComponent();
      
      await waitFor(() => {
        const riskInfo = screen.getByRole('button', { name: /risk details/i });
        fireEvent.click(riskInfo);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/complex termination clauses/i)).toBeInTheDocument();
        expect(screen.getByText(/multiple liability provisions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Historical Usage Analysis', () => {
    it('should show usage statistics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/used 150 times/i)).toBeInTheDocument();
        expect(screen.getByText(/last used: jan 15/i)).toBeInTheDocument();
        expect(screen.getByText(/rating: 4.2/5/i)).toBeInTheDocument();
      });
    });

    it('should highlight trending templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const trendingBadge = screen.getByText(/trending/i);
        expect(trendingBadge).toHaveClass('bg-green-100');
        expect(screen.getByText(/25% increase this month/i)).toBeInTheDocument();
      });
    });

    it('should show success metrics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/95% approval rate/i)).toBeInTheDocument();
        expect(screen.getByText(/avg completion: 2.3 days/i)).toBeInTheDocument();
      });
    });

    it('should provide usage recommendations', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/teams like yours choose this 78% of the time/i)).toBeInTheDocument();
        expect(screen.getByText(/highly rated by technology companies/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Compatibility Checking', () => {
    it('should show compatible templates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/works well with/i)).toBeInTheDocument();
        expect(screen.getByText(/NDA/i)).toBeInTheDocument();
        expect(screen.getByText(/SOW/i)).toBeInTheDocument();
      });
    });

    it('should warn about incompatible combinations', async () => {
      renderComponent();
      
      const template1 = await screen.findByTestId('template-card-tmpl1');
      const template3 = await screen.findByTestId('template-card-tmpl3');
      
      fireEvent.click(within(template1).getByRole('checkbox'));
      fireEvent.click(within(template3).getByRole('checkbox'));
      
      await waitFor(() => {
        expect(screen.getByText(/compatibility warning/i)).toBeInTheDocument();
        expect(screen.getByText(/jurisdiction conflicts/i)).toBeInTheDocument();
      });
    });

    it('should suggest template modifications for compatibility', async () => {
      renderComponent();
      
      const template1 = await screen.findByTestId('template-card-tmpl1');
      fireEvent.click(within(template1).getByRole('button', { name: /compatibility/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/suggested modifications/i)).toBeInTheDocument();
        expect(screen.getByText(/add termination clause/i)).toBeInTheDocument();
        expect(screen.getByText(/update liability section/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-template Assembly', () => {
    it('should allow multiple template selection', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template1 = screen.getByTestId('template-card-tmpl1');
        const template2 = screen.getByTestId('template-card-tmpl2');
        
        fireEvent.click(within(template1).getByRole('checkbox'));
        fireEvent.click(within(template2).getByRole('checkbox'));
        
        expect(screen.getByText(/2 templates selected/i)).toBeInTheDocument();
      });
    });

    it('should show assembly preview', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template1 = screen.getByTestId('template-card-tmpl1');
        const template2 = screen.getByTestId('template-card-tmpl2');
        
        fireEvent.click(within(template1).getByRole('checkbox'));
        fireEvent.click(within(template2).getByRole('checkbox'));
        
        const combineButton = screen.getByRole('button', { name: /combine templates/i });
        fireEvent.click(combineButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/assembly preview/i)).toBeInTheDocument();
        expect(screen.getByText(/section order/i)).toBeInTheDocument();
      });
    });

    it('should handle section conflicts', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template1 = screen.getByTestId('template-card-tmpl1');
        const template2 = screen.getByTestId('template-card-tmpl2');
        
        fireEvent.click(within(template1).getByRole('checkbox'));
        fireEvent.click(within(template2).getByRole('checkbox'));
        
        const combineButton = screen.getByRole('button', { name: /combine templates/i });
        fireEvent.click(combineButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/conflicting sections detected/i)).toBeInTheDocument();
        expect(screen.getByText(/termination clause mismatch/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /resolve conflicts/i })).toBeInTheDocument();
      });
    });

    it('should suggest optimal section ordering', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template1 = screen.getByTestId('template-card-tmpl1');
        const template2 = screen.getByTestId('template-card-tmpl2');
        
        fireEvent.click(within(template1).getByRole('checkbox'));
        fireEvent.click(within(template2).getByRole('checkbox'));
        
        const combineButton = screen.getByRole('button', { name: /combine templates/i });
        fireEvent.click(combineButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/recommended order/i)).toBeInTheDocument();
        expect(screen.getByText(/1. introduction/i)).toBeInTheDocument();
        expect(screen.getByText(/2. confidentiality/i)).toBeInTheDocument();
        expect(screen.getByText(/3. services/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Preview Generation', () => {
    it('should generate template preview', async () => {
      renderComponent();
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(previewButton);
      });
      
      expect(mockOnPreview).toHaveBeenCalledWith('tmpl1');
    });

    it('should show preview with sample data', async () => {
      renderComponent();
      
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /quick preview/i });
        fireEvent.click(previewButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/preview with sample data/i)).toBeInTheDocument();
        expect(screen.getByText(/[your company]/i)).toBeInTheDocument();
        expect(screen.getByText(/[counterparty]/i)).toBeInTheDocument();
      });
    });

    it('should allow custom preview data', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customPreviewButton = screen.getByRole('button', { name: /custom preview/i });
        fireEvent.click(customPreviewButton);
      });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/service description/i)).toBeInTheDocument();
        
        const companyInput = screen.getByLabelText(/company name/i);
        await userEvent.type(companyInput, 'Acme Corp');
        
        const generateButton = screen.getByRole('button', { name: /generate preview/i });
        fireEvent.click(generateButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
      });
    });

    it('should show estimated completion time', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/estimated time: 30min/i)).toBeInTheDocument();
        expect(screen.getByText(/complexity: medium/i)).toBeInTheDocument();
      });
    });
  });

  describe('A/B Testing Integration', () => {
    it('should track template selection for A/B testing', async () => {
      renderComponent();
      
      await waitFor(() => {
        const selectButton = screen.getByRole('button', { name: /select template/i });
        fireEvent.click(selectButton);
      });
      
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'tmpl1',
          abTestGroup: expect.any(String),
          selectionReason: expect.any(String),
        })
      );
    });

    it('should show A/B test variations', async () => {
      const { api } = require('../../../services/api');
      api.get.mockImplementation((url) => {
        if (url.includes('/templates/recommendations')) {
          return Promise.resolve({
            data: mockTemplates.map(t => ({
              ...t,
              abTestVariant: Math.random() > 0.5 ? 'A' : 'B',
            })),
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/variant a/i) || screen.getByText(/variant b/i)).toBeInTheDocument();
      });
    });

    it('should record user interactions for analytics', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template = screen.getByTestId('template-card-tmpl1');
        fireEvent.mouseEnter(template);
        
        // Simulate time spent viewing
        setTimeout(() => {
          fireEvent.mouseLeave(template);
        }, 1000);
      });
      
      const { api } = require('../../../services/api');
      expect(api.post).toHaveBeenCalledWith(
        '/analytics/template-interaction',
        expect.objectContaining({
          templateId: 'tmpl1',
          interactionType: 'view',
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('Search and Filtering', () => {
    it('should filter templates by search query', async () => {
      renderComponent();
      
      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search templates/i);
        await userEvent.type(searchInput, 'employment');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Employment Contract UK')).toBeInTheDocument();
        expect(screen.queryByText('Service Agreement Template')).not.toBeInTheDocument();
      });
    });

    it('should filter by tags', async () => {
      renderComponent();
      
      await waitFor(() => {
        const tagFilter = screen.getByRole('button', { name: /technology/i });
        fireEvent.click(tagFilter);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Service Agreement Template')).toBeInTheDocument();
        expect(screen.queryByText('Employment Contract UK')).not.toBeInTheDocument();
      });
    });

    it('should sort templates by different criteria', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sortSelect = screen.getByLabelText(/sort by/i);
        fireEvent.change(sortSelect, { target: { value: 'usage' } });
      });
      
      await waitFor(() => {
        const templates = screen.getAllByTestId(/template-card/);
        expect(templates[0]).toHaveTextContent('Non-Disclosure Agreement'); // Highest usage
      });
    });

    it('should show active filters', async () => {
      renderComponent();
      
      await waitFor(() => {
        const jurisdictionFilter = screen.getByLabelText(/jurisdiction/i);
        fireEvent.change(jurisdictionFilter, { target: { value: 'US' } });
        
        const riskFilter = screen.getByLabelText(/risk tolerance/i);
        fireEvent.change(riskFilter, { target: { value: 'low' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/active filters/i)).toBeInTheDocument();
        expect(screen.getByText(/jurisdiction: us/i)).toBeInTheDocument();
        expect(screen.getByText(/risk: low/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Template selection');
      expect(screen.getByRole('region', { name: /recommended templates/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstTemplate = screen.getByTestId('template-card-tmpl1');
        firstTemplate.focus();
        
        fireEvent.keyDown(firstTemplate, { key: 'ArrowDown' });
        
        expect(screen.getByTestId('template-card-tmpl2')).toHaveFocus();
      });
    });

    it('should announce selection changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        const template = screen.getByTestId('template-card-tmpl1');
        const checkbox = within(template).getByRole('checkbox');
        fireEvent.click(checkbox);
      });
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/selected service agreement template/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { api } = require('../../../services/api');
      api.get.mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load templates/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show empty state when no templates found', async () => {
      const { api } = require('../../../services/api');
      api.get.mockResolvedValueOnce({ data: [] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/no templates found/i)).toBeInTheDocument();
        expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create new template/i })).toBeInTheDocument();
      });
    });
  });
});