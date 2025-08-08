import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ClauseSuggestions } from '../ClauseSuggestions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  usageCount: number;
  similarity?: number;
  matchReason?: string;
  alternativeOf?: string;
}

interface SuggestionContext {
  documentType: string;
  section: string;
  existingClauses: string[];
  jurisdiction?: string;
  industry?: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

interface ClauseSuggestionsProps {
  context: SuggestionContext;
  searchQuery?: string;
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onSearchClauses?: (query: string, context: SuggestionContext) => Promise<Clause[]>;
  onGetSimilarClauses?: (clauseId: string, limit?: number) => Promise<Clause[]>;
  onGetAlternatives?: (clauseId: string) => Promise<Clause[]>;
  onAcceptSuggestion?: (clauseId: string) => Promise<void>;
  onRejectSuggestion?: (clauseId: string, reason: string) => Promise<void>;
  onProvideFeedback?: (clauseId: string, feedback: { useful: boolean; comment?: string }) => Promise<void>;
  onCustomizeSuggestion?: (clauseId: string, customization: string) => Promise<void>;
  onCompareAlternatives?: (clauseIds: string[]) => void;
  onViewDetails?: (clauseId: string) => void;
  onSaveFavorite?: (clauseId: string) => Promise<void>;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ClauseSuggestions', () => {
  let queryClient: QueryClient;
  const mockOnSearchClauses = vi.fn();
  const mockOnGetSimilarClauses = vi.fn();
  const mockOnGetAlternatives = vi.fn();
  const mockOnAcceptSuggestion = vi.fn();
  const mockOnRejectSuggestion = vi.fn();
  const mockOnProvideFeedback = vi.fn();
  const mockOnCustomizeSuggestion = vi.fn();
  const mockOnCompareAlternatives = vi.fn();
  const mockOnViewDetails = vi.fn();
  const mockOnSaveFavorite = vi.fn();

  const sampleContext: SuggestionContext = {
    documentType: 'Service Agreement',
    section: 'Liability',
    existingClauses: ['clause1', 'clause2'],
    jurisdiction: 'US-CA',
    industry: 'Technology',
    riskTolerance: 'moderate',
  };

  const sampleSuggestions: Clause[] = [
    {
      id: 'suggestion1',
      title: 'Standard Limitation of Liability',
      content: 'Neither party shall be liable for any indirect, incidental, or consequential damages.',
      category: 'Liability',
      tags: ['standard', 'limitation', 'recommended'],
      riskLevel: 'low',
      usageCount: 150,
      similarity: 0.95,
      matchReason: 'High semantic similarity with existing contract type',
    },
    {
      id: 'suggestion2',
      title: 'Mutual Indemnification',
      content: 'Each party shall indemnify and hold harmless the other party from third-party claims.',
      category: 'Liability',
      tags: ['indemnification', 'mutual', 'balanced'],
      riskLevel: 'medium',
      usageCount: 120,
      similarity: 0.88,
      matchReason: 'Commonly used in Technology industry',
    },
    {
      id: 'suggestion3',
      title: 'Cap on Liability',
      content: 'Total liability shall not exceed the fees paid in the twelve months preceding the claim.',
      category: 'Liability',
      tags: ['cap', 'limitation', 'fees'],
      riskLevel: 'low',
      usageCount: 200,
      similarity: 0.82,
      matchReason: 'Recommended for moderate risk tolerance',
      alternativeOf: 'suggestion1',
    },
    {
      id: 'suggestion4',
      title: 'Consequential Damages Waiver',
      content: 'Neither party shall be liable for lost profits or consequential damages.',
      category: 'Liability',
      tags: ['waiver', 'consequential', 'damages'],
      riskLevel: 'high',
      usageCount: 90,
      similarity: 0.75,
      matchReason: 'Alternative approach for liability limitation',
      alternativeOf: 'suggestion1',
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'legal_counsel',
    permissions: ['view_clauses', 'accept_suggestions', 'provide_feedback'],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockOnSearchClauses.mockResolvedValue(sampleSuggestions);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      context: sampleContext,
      currentUser,
      onSearchClauses: mockOnSearchClauses,
      onGetSimilarClauses: mockOnGetSimilarClauses,
      onGetAlternatives: mockOnGetAlternatives,
      onAcceptSuggestion: mockOnAcceptSuggestion,
      onRejectSuggestion: mockOnRejectSuggestion,
      onProvideFeedback: mockOnProvideFeedback,
      onCustomizeSuggestion: mockOnCustomizeSuggestion,
      onCompareAlternatives: mockOnCompareAlternatives,
      onViewDetails: mockOnViewDetails,
      onSaveFavorite: mockOnSaveFavorite,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ClauseSuggestions {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render clause suggestions interface', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('AI-Powered Clause Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Suggested Clauses')).toBeInTheDocument();
      });
    });

    it('should display context information', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Service Agreement')).toBeInTheDocument();
        expect(screen.getByText('Liability')).toBeInTheDocument();
        expect(screen.getByText('Technology')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Analyzing context and finding suggestions...')).toBeInTheDocument();
    });

    it('should display suggestion count', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('4 clauses suggested')).toBeInTheDocument();
      });
    });
  });

  describe('Suggestion Display', () => {
    it('should display all suggestions', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Standard Limitation of Liability')).toBeInTheDocument();
        expect(screen.getByText('Mutual Indemnification')).toBeInTheDocument();
        expect(screen.getByText('Cap on Liability')).toBeInTheDocument();
        expect(screen.getByText('Consequential Damages Waiver')).toBeInTheDocument();
      });
    });

    it('should show similarity scores', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('95% match')).toBeInTheDocument();
        expect(screen.getByText('88% match')).toBeInTheDocument();
        expect(screen.getByText('82% match')).toBeInTheDocument();
      });
    });

    it('should display match reasons', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('High semantic similarity with existing contract type')).toBeInTheDocument();
        expect(screen.getByText('Commonly used in Technology industry')).toBeInTheDocument();
        expect(screen.getByText('Recommended for moderate risk tolerance')).toBeInTheDocument();
      });
    });

    it('should show risk levels', async () => {
      renderComponent();
      
      await waitFor(() => {
        const lowRiskBadges = screen.getAllByText('Low Risk');
        expect(lowRiskBadges).toHaveLength(2);
        expect(screen.getByText('Medium Risk')).toBeInTheDocument();
        expect(screen.getByText('High Risk')).toBeInTheDocument();
      });
    });

    it('should display usage statistics', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Used 150 times')).toBeInTheDocument();
        expect(screen.getByText('Used 120 times')).toBeInTheDocument();
        expect(screen.getByText('Used 200 times')).toBeInTheDocument();
      });
    });

    it('should show alternative indicators', async () => {
      renderComponent();
      
      await waitFor(() => {
        const alternativeLabels = screen.getAllByText(/Alternative/i);
        expect(alternativeLabels.length).toBeGreaterThan(0);
      });
    });

    it('should display clause preview on hover', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstSuggestion = screen.getByText('Standard Limitation of Liability');
        fireEvent.mouseEnter(firstSuggestion.closest('article')!);
      });
      
      expect(screen.getByText(/Neither party shall be liable for any indirect/)).toBeInTheDocument();
    });
  });

  describe('Search and Filter', () => {
    it('should search for specific clauses', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search clauses...');
      await userEvent.type(searchInput, 'indemnification');
      
      await waitFor(() => {
        expect(mockOnSearchClauses).toHaveBeenCalledWith(
          'indemnification',
          expect.any(Object)
        );
      });
    });

    it('should filter by risk level', async () => {
      renderComponent();
      
      await waitFor(() => {
        const riskFilter = screen.getByLabelText('Filter by risk level');
        fireEvent.change(riskFilter, { target: { value: 'low' } });
      });
      
      await waitFor(() => {
        const suggestions = screen.getAllByRole('article');
        expect(suggestions.length).toBeLessThan(4);
      });
    });

    it('should filter by category', async () => {
      renderComponent();
      
      await waitFor(() => {
        const categoryFilter = screen.getByLabelText('Filter by category');
        fireEvent.change(categoryFilter, { target: { value: 'Liability' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Standard Limitation of Liability')).toBeInTheDocument();
      });
    });

    it('should sort suggestions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const sortSelect = screen.getByLabelText('Sort by');
        fireEvent.change(sortSelect, { target: { value: 'usage' } });
      });
      
      await waitFor(() => {
        const suggestions = screen.getAllByRole('article');
        const firstTitle = suggestions[0].querySelector('h3')?.textContent;
        expect(firstTitle).toBe('Cap on Liability');
      });
    });

    it('should toggle alternative view', async () => {
      renderComponent();
      
      await waitFor(() => {
        const toggleButton = screen.getByRole('button', { name: /show alternatives/i });
        fireEvent.click(toggleButton);
      });
      
      expect(screen.getByTestId('alternatives-view')).toBeInTheDocument();
    });
  });

  describe('Suggestion Actions', () => {
    it('should accept suggestion', async () => {
      renderComponent();
      
      await waitFor(() => {
        const acceptButton = screen.getAllByRole('button', { name: /accept/i })[0];
        fireEvent.click(acceptButton);
      });
      
      expect(mockOnAcceptSuggestion).toHaveBeenCalledWith('suggestion1');
    });

    it('should reject suggestion with reason', async () => {
      renderComponent();
      
      await waitFor(() => {
        const rejectButton = screen.getAllByRole('button', { name: /reject/i })[0];
        fireEvent.click(rejectButton);
      });
      
      const reasonInput = screen.getByLabelText('Rejection reason');
      await userEvent.type(reasonInput, 'Not applicable to our use case');
      
      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i });
      fireEvent.click(confirmButton);
      
      expect(mockOnRejectSuggestion).toHaveBeenCalledWith(
        'suggestion1',
        'Not applicable to our use case'
      );
    });

    it('should provide positive feedback', async () => {
      renderComponent();
      
      await waitFor(() => {
        const thumbsUpButton = screen.getAllByRole('button', { name: /useful/i })[0];
        fireEvent.click(thumbsUpButton);
      });
      
      expect(mockOnProvideFeedback).toHaveBeenCalledWith(
        'suggestion1',
        expect.objectContaining({ useful: true })
      );
    });

    it('should provide negative feedback with comment', async () => {
      renderComponent();
      
      await waitFor(() => {
        const thumbsDownButton = screen.getAllByRole('button', { name: /not useful/i })[0];
        fireEvent.click(thumbsDownButton);
      });
      
      const commentInput = screen.getByLabelText('Feedback comment');
      await userEvent.type(commentInput, 'Too generic for our needs');
      
      const submitButton = screen.getByRole('button', { name: /submit feedback/i });
      fireEvent.click(submitButton);
      
      expect(mockOnProvideFeedback).toHaveBeenCalledWith(
        'suggestion1',
        expect.objectContaining({
          useful: false,
          comment: 'Too generic for our needs'
        })
      );
    });

    it('should customize suggestion', async () => {
      renderComponent();
      
      await waitFor(() => {
        const customizeButton = screen.getAllByRole('button', { name: /customize/i })[0];
        fireEvent.click(customizeButton);
      });
      
      const customizationInput = screen.getByLabelText('Customization');
      await userEvent.type(customizationInput, 'Add specific dollar amount cap');
      
      const saveButton = screen.getByRole('button', { name: /save customization/i });
      fireEvent.click(saveButton);
      
      expect(mockOnCustomizeSuggestion).toHaveBeenCalledWith(
        'suggestion1',
        'Add specific dollar amount cap'
      );
    });

    it('should view clause details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const detailsButton = screen.getAllByRole('button', { name: /view details/i })[0];
        fireEvent.click(detailsButton);
      });
      
      expect(mockOnViewDetails).toHaveBeenCalledWith('suggestion1');
    });

    it('should save to favorites', async () => {
      renderComponent();
      
      await waitFor(() => {
        const favoriteButton = screen.getAllByRole('button', { name: /save to favorites/i })[0];
        fireEvent.click(favoriteButton);
      });
      
      expect(mockOnSaveFavorite).toHaveBeenCalledWith('suggestion1');
    });
  });

  describe('Similar Clauses', () => {
    it('should find similar clauses', async () => {
      mockOnGetSimilarClauses.mockResolvedValue([
        { ...sampleSuggestions[1], similarity: 0.90 },
        { ...sampleSuggestions[2], similarity: 0.85 },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        const similarButton = screen.getAllByRole('button', { name: /find similar/i })[0];
        fireEvent.click(similarButton);
      });
      
      await waitFor(() => {
        expect(mockOnGetSimilarClauses).toHaveBeenCalledWith('suggestion1', 5);
        expect(screen.getByText('Similar Clauses')).toBeInTheDocument();
      });
    });

    it('should display similarity comparison', async () => {
      mockOnGetSimilarClauses.mockResolvedValue([
        { ...sampleSuggestions[1], similarity: 0.90 },
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        const similarButton = screen.getAllByRole('button', { name: /find similar/i })[0];
        fireEvent.click(similarButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('90% similar')).toBeInTheDocument();
      });
    });
  });

  describe('Alternative Clauses', () => {
    it('should get alternative clauses', async () => {
      mockOnGetAlternatives.mockResolvedValue([
        sampleSuggestions[2],
        sampleSuggestions[3],
      ]);
      
      renderComponent();
      
      await waitFor(() => {
        const alternativesButton = screen.getAllByRole('button', { name: /view alternatives/i })[0];
        fireEvent.click(alternativesButton);
      });
      
      await waitFor(() => {
        expect(mockOnGetAlternatives).toHaveBeenCalledWith('suggestion1');
        expect(screen.getByText('Alternative Options')).toBeInTheDocument();
      });
    });

    it('should compare alternatives', async () => {
      renderComponent();
      
      await waitFor(() => {
        const compareCheckbox1 = screen.getAllByRole('checkbox', { name: /select for comparison/i })[0];
        const compareCheckbox2 = screen.getAllByRole('checkbox', { name: /select for comparison/i })[1];
        
        fireEvent.click(compareCheckbox1);
        fireEvent.click(compareCheckbox2);
      });
      
      const compareButton = screen.getByRole('button', { name: /compare selected/i });
      fireEvent.click(compareButton);
      
      expect(mockOnCompareAlternatives).toHaveBeenCalledWith(['suggestion1', 'suggestion2']);
    });

    it('should show alternative grouping', async () => {
      renderComponent();
      
      await waitFor(() => {
        const groupButton = screen.getByRole('button', { name: /group by alternatives/i });
        fireEvent.click(groupButton);
      });
      
      expect(screen.getByTestId('alternatives-grouped')).toBeInTheDocument();
    });
  });

  describe('Context-Aware Features', () => {
    it('should refresh suggestions on context change', async () => {
      const { rerender } = renderComponent();
      
      await waitFor(() => {
        expect(mockOnSearchClauses).toHaveBeenCalledTimes(1);
      });
      
      const newContext = { ...sampleContext, section: 'Termination' };
      rerender(
        <QueryClientProvider client={queryClient}>
          <ClauseSuggestions
            context={newContext}
            currentUser={currentUser}
            onSearchClauses={mockOnSearchClauses}
          />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(mockOnSearchClauses).toHaveBeenCalledWith('', newContext);
      });
    });

    it('should show jurisdiction-specific suggestions', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('US-CA')).toBeInTheDocument();
      });
    });

    it('should filter by risk tolerance', async () => {
      renderComponent();
      
      await waitFor(() => {
        const suggestions = screen.getAllByRole('article');
        // Should show suggestions matching moderate risk tolerance
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce search input', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search clauses...');
      
      await userEvent.type(searchInput, 'test');
      
      // Should only call once after debounce
      await waitFor(() => {
        expect(mockOnSearchClauses).toHaveBeenCalledTimes(2); // Initial + search
      }, { timeout: 1000 });
    });

    it('should cache similar clause results', async () => {
      mockOnGetSimilarClauses.mockResolvedValue([sampleSuggestions[1]]);
      
      renderComponent();
      
      await waitFor(() => {
        const similarButton = screen.getAllByRole('button', { name: /find similar/i })[0];
        fireEvent.click(similarButton);
      });
      
      await waitFor(() => {
        expect(mockOnGetSimilarClauses).toHaveBeenCalledTimes(1);
      });
      
      // Click again - should use cache
      const similarButton = screen.getAllByRole('button', { name: /find similar/i })[0];
      fireEvent.click(similarButton);
      
      expect(mockOnGetSimilarClauses).toHaveBeenCalledTimes(1);
    });

    it('should paginate large result sets', async () => {
      const manySuggestions = Array.from({ length: 50 }, (_, i) => ({
        ...sampleSuggestions[0],
        id: `suggestion${i}`,
        title: `Suggestion ${i}`,
      }));
      
      mockOnSearchClauses.mockResolvedValue(manySuggestions);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
      });
    });
  });

  describe('Feedback Loop', () => {
    it('should track suggestion acceptance rate', async () => {
      renderComponent();
      
      await waitFor(() => {
        const metricsButton = screen.getByRole('button', { name: /view metrics/i });
        fireEvent.click(metricsButton);
      });
      
      expect(screen.getByTestId('acceptance-rate')).toBeInTheDocument();
    });

    it('should show improvement suggestions', async () => {
      renderComponent();
      
      await waitFor(() => {
        const improveButton = screen.getByRole('button', { name: /improve suggestions/i });
        fireEvent.click(improveButton);
      });
      
      expect(screen.getByText('Help us improve suggestions')).toBeInTheDocument();
    });

    it('should collect preference data', async () => {
      renderComponent();
      
      await waitFor(() => {
        const preferenceButton = screen.getByRole('button', { name: /set preferences/i });
        fireEvent.click(preferenceButton);
      });
      
      const conservativeOption = screen.getByLabelText('Conservative');
      fireEvent.click(conservativeOption);
      
      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(saveButton);
      
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /clause suggestions/i })).toBeInTheDocument();
        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(screen.getAllByRole('article')).toHaveLength(4);
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        const firstSuggestion = screen.getAllByRole('article')[0];
        firstSuggestion.focus();
        
        fireEvent.keyDown(firstSuggestion, { key: 'Enter' });
        
        expect(mockOnViewDetails).toHaveBeenCalledWith('suggestion1');
      });
    });

    it('should announce suggestion updates', async () => {
      renderComponent();
      
      await waitFor(() => {
        const acceptButton = screen.getAllByRole('button', { name: /accept/i })[0];
        fireEvent.click(acceptButton);
      });
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/suggestion accepted/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search failure', async () => {
      mockOnSearchClauses.mockRejectedValue(new Error('Search failed'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load suggestions/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show empty state', async () => {
      mockOnSearchClauses.mockResolvedValue([]);
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('No suggestions found')).toBeInTheDocument();
        expect(screen.getByText(/try adjusting your search/i)).toBeInTheDocument();
      });
    });

    it('should handle acceptance failure gracefully', async () => {
      mockOnAcceptSuggestion.mockRejectedValue(new Error('Accept failed'));
      
      renderComponent();
      
      await waitFor(() => {
        const acceptButton = screen.getAllByRole('button', { name: /accept/i })[0];
        fireEvent.click(acceptButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/failed to accept suggestion/i)).toBeInTheDocument();
      });
    });
  });
});