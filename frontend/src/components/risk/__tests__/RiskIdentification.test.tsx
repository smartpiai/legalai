import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RiskIdentification } from '../RiskIdentification';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface RiskPattern {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'financial' | 'compliance' | 'operational' | 'reputational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  keywords: string[];
  active: boolean;
}

interface Risk {
  id: string;
  contractId: string;
  patternId: string;
  patternName: string;
  category: RiskPattern['category'];
  severity: RiskPattern['severity'];
  score: number;
  confidence: number;
  location: {
    page?: number;
    paragraph?: string;
    clause?: string;
    section?: string;
  };
  matchedText: string;
  context: string;
  suggestedMitigation?: string;
  status: 'new' | 'reviewed' | 'accepted' | 'mitigated' | 'false_positive';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
}

interface RiskIdentificationProps {
  contractId: string;
  contractContent?: string;
  risks?: Risk[];
  patterns?: RiskPattern[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  thresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  onScanContract?: (contractId: string) => Promise<Risk[]>;
  onUpdateRiskStatus?: (riskId: string, status: Risk['status'], notes?: string) => Promise<void>;
  onCreatePattern?: (pattern: Omit<RiskPattern, 'id'>) => Promise<void>;
  onUpdatePattern?: (patternId: string, pattern: Partial<RiskPattern>) => Promise<void>;
  onDeletePattern?: (patternId: string) => Promise<void>;
  onUpdateThresholds?: (thresholds: RiskIdentificationProps['thresholds']) => Promise<void>;
  onExportRisks?: (format: 'json' | 'csv' | 'pdf') => Promise<void>;
  onGenerateAlert?: (risk: Risk) => Promise<void>;
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

describe('RiskIdentification', () => {
  let queryClient: QueryClient;
  const mockOnScanContract = vi.fn();
  const mockOnUpdateRiskStatus = vi.fn();
  const mockOnCreatePattern = vi.fn();
  const mockOnUpdatePattern = vi.fn();
  const mockOnDeletePattern = vi.fn();
  const mockOnUpdateThresholds = vi.fn();
  const mockOnExportRisks = vi.fn();
  const mockOnGenerateAlert = vi.fn();

  const sampleRisks: Risk[] = [
    {
      id: 'risk1',
      contractId: 'contract1',
      patternId: 'pattern1',
      patternName: 'Unlimited Liability',
      category: 'legal',
      severity: 'critical',
      score: 95,
      confidence: 0.92,
      location: {
        page: 5,
        section: '7.2',
        paragraph: 'Liability Terms',
      },
      matchedText: 'The vendor shall have unlimited liability for all damages',
      context: 'Section 7.2: The vendor shall have unlimited liability for all damages arising from or related to this agreement, including consequential damages.',
      suggestedMitigation: 'Consider capping liability at contract value or annual fees',
      status: 'new',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'risk2',
      contractId: 'contract1',
      patternId: 'pattern2',
      patternName: 'No Termination Clause',
      category: 'legal',
      severity: 'high',
      score: 75,
      confidence: 0.88,
      location: {
        page: 12,
      },
      matchedText: 'No provisions for early termination',
      context: 'The agreement lacks any provisions for early termination by either party.',
      suggestedMitigation: 'Add termination for convenience clause with notice period',
      status: 'reviewed',
      reviewedBy: 'John Doe',
      reviewedAt: '2024-01-15T14:00:00Z',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'risk3',
      contractId: 'contract1',
      patternId: 'pattern3',
      patternName: 'Payment Terms Risk',
      category: 'financial',
      severity: 'medium',
      score: 55,
      confidence: 0.75,
      location: {
        section: '4.1',
        clause: 'Payment Schedule',
      },
      matchedText: 'Payment due in advance for entire contract period',
      context: 'Section 4.1: Payment shall be due in advance for the entire contract period of 3 years.',
      suggestedMitigation: 'Negotiate for quarterly or annual payment terms',
      status: 'new',
      createdAt: '2024-01-15T10:00:00Z',
    },
  ];

  const samplePatterns: RiskPattern[] = [
    {
      id: 'pattern1',
      name: 'Unlimited Liability',
      description: 'Detects clauses with unlimited or uncapped liability',
      category: 'legal',
      severity: 'critical',
      pattern: 'unlimited.{0,20}liability|liability.{0,20}unlimited|no.{0,10}cap.{0,10}liability',
      keywords: ['unlimited', 'liability', 'uncapped', 'no limit'],
      active: true,
    },
    {
      id: 'pattern2',
      name: 'No Termination Clause',
      description: 'Identifies contracts without termination provisions',
      category: 'legal',
      severity: 'high',
      pattern: 'no.{0,20}termination|lack.{0,20}termination|without.{0,20}termination',
      keywords: ['termination', 'exit', 'end contract'],
      active: true,
    },
    {
      id: 'pattern3',
      name: 'Payment Terms Risk',
      description: 'Flags unfavorable payment terms',
      category: 'financial',
      severity: 'medium',
      pattern: 'payment.{0,20}advance|advance.{0,20}payment|prepayment',
      keywords: ['advance payment', 'prepayment', 'upfront'],
      active: true,
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'legal_analyst',
    permissions: ['view_risks', 'review_risks', 'manage_patterns'],
  };

  const defaultThresholds = {
    low: 30,
    medium: 50,
    high: 70,
    critical: 85,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      contractId: 'contract1',
      risks: sampleRisks,
      patterns: samplePatterns,
      currentUser,
      thresholds: defaultThresholds,
      onScanContract: mockOnScanContract,
      onUpdateRiskStatus: mockOnUpdateRiskStatus,
      onCreatePattern: mockOnCreatePattern,
      onUpdatePattern: mockOnUpdatePattern,
      onDeletePattern: mockOnDeletePattern,
      onUpdateThresholds: mockOnUpdateThresholds,
      onExportRisks: mockOnExportRisks,
      onGenerateAlert: mockOnGenerateAlert,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <RiskIdentification {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render risk identification dashboard', () => {
      renderComponent();
      
      expect(screen.getByText('Risk Identification')).toBeInTheDocument();
      expect(screen.getByText('Risk Overview')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /scan contract/i })).toBeInTheDocument();
    });

    it('should display risk statistics', () => {
      renderComponent();
      
      expect(screen.getByText('Total Risks')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('should show risk trend chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('risk-trend-chart')).toBeInTheDocument();
    });

    it('should display risk category breakdown', () => {
      renderComponent();
      
      expect(screen.getByTestId('risk-category-chart')).toBeInTheDocument();
      expect(screen.getByText('Legal: 2')).toBeInTheDocument();
      expect(screen.getByText('Financial: 1')).toBeInTheDocument();
    });
  });

  describe('Risk List', () => {
    it('should display all risks', () => {
      renderComponent();
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.getByText('No Termination Clause')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms Risk')).toBeInTheDocument();
    });

    it('should show risk severity badges', () => {
      renderComponent();
      
      const criticalBadge = screen.getByText('critical');
      expect(criticalBadge).toHaveClass('bg-red-100');
      
      const highBadge = screen.getByText('high');
      expect(highBadge).toHaveClass('bg-orange-100');
    });

    it('should display risk scores', () => {
      renderComponent();
      
      expect(screen.getByText('Score: 95')).toBeInTheDocument();
      expect(screen.getByText('Score: 75')).toBeInTheDocument();
      expect(screen.getByText('Score: 55')).toBeInTheDocument();
    });

    it('should show confidence levels', () => {
      renderComponent();
      
      expect(screen.getByText('92% confidence')).toBeInTheDocument();
      expect(screen.getByText('88% confidence')).toBeInTheDocument();
      expect(screen.getByText('75% confidence')).toBeInTheDocument();
    });

    it('should display risk location', () => {
      renderComponent();
      
      expect(screen.getByText('Page 5, Section 7.2')).toBeInTheDocument();
      expect(screen.getByText('Page 12')).toBeInTheDocument();
      expect(screen.getByText('Section 4.1')).toBeInTheDocument();
    });

    it('should show matched text and context', () => {
      renderComponent();
      
      const expandButton = screen.getAllByRole('button', { name: /show details/i })[0];
      fireEvent.click(expandButton);
      
      expect(screen.getByText(/The vendor shall have unlimited liability/)).toBeInTheDocument();
      expect(screen.getByText(/arising from or related to this agreement/)).toBeInTheDocument();
    });

    it('should display suggested mitigation', () => {
      renderComponent();
      
      const expandButton = screen.getAllByRole('button', { name: /show details/i })[0];
      fireEvent.click(expandButton);
      
      expect(screen.getByText('Consider capping liability at contract value or annual fees')).toBeInTheDocument();
    });

    it('should show risk status', () => {
      renderComponent();
      
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Reviewed')).toBeInTheDocument();
    });
  });

  describe('Risk Filtering', () => {
    it('should filter by severity', async () => {
      renderComponent();
      
      const severityFilter = screen.getByLabelText('Filter by severity');
      await userEvent.selectOptions(severityFilter, 'critical');
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.queryByText('No Termination Clause')).not.toBeInTheDocument();
    });

    it('should filter by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText('Filter by category');
      await userEvent.selectOptions(categoryFilter, 'financial');
      
      expect(screen.getByText('Payment Terms Risk')).toBeInTheDocument();
      expect(screen.queryByText('Unlimited Liability')).not.toBeInTheDocument();
    });

    it('should filter by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByLabelText('Filter by status');
      await userEvent.selectOptions(statusFilter, 'reviewed');
      
      expect(screen.getByText('No Termination Clause')).toBeInTheDocument();
      expect(screen.queryByText('Unlimited Liability')).not.toBeInTheDocument();
    });

    it('should filter by score range', async () => {
      renderComponent();
      
      const minScore = screen.getByLabelText('Min score');
      const maxScore = screen.getByLabelText('Max score');
      
      await userEvent.clear(minScore);
      await userEvent.type(minScore, '70');
      await userEvent.clear(maxScore);
      await userEvent.type(maxScore, '100');
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.getByText('No Termination Clause')).toBeInTheDocument();
      expect(screen.queryByText('Payment Terms Risk')).not.toBeInTheDocument();
    });

    it('should search risks by text', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('Search risks...');
      await userEvent.type(searchInput, 'liability');
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.queryByText('No Termination Clause')).not.toBeInTheDocument();
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      const severityFilter = screen.getByLabelText('Filter by severity');
      await userEvent.selectOptions(severityFilter, 'critical');
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.getByText('No Termination Clause')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms Risk')).toBeInTheDocument();
    });
  });

  describe('Risk Actions', () => {
    it('should scan contract for risks', async () => {
      mockOnScanContract.mockResolvedValue([]);
      renderComponent({ risks: [] });
      
      const scanButton = screen.getByRole('button', { name: /scan contract/i });
      await userEvent.click(scanButton);
      
      await waitFor(() => {
        expect(mockOnScanContract).toHaveBeenCalledWith('contract1');
      });
    });

    it('should update risk status', async () => {
      renderComponent();
      
      const statusButton = screen.getAllByRole('button', { name: /update status/i })[0];
      fireEvent.click(statusButton);
      
      const acceptButton = screen.getByRole('button', { name: /accept risk/i });
      await userEvent.click(acceptButton);
      
      expect(mockOnUpdateRiskStatus).toHaveBeenCalledWith('risk1', 'accepted', undefined);
    });

    it('should mark as false positive', async () => {
      renderComponent();
      
      const statusButton = screen.getAllByRole('button', { name: /update status/i })[0];
      fireEvent.click(statusButton);
      
      const falsePositiveButton = screen.getByRole('button', { name: /false positive/i });
      await userEvent.click(falsePositiveButton);
      
      expect(mockOnUpdateRiskStatus).toHaveBeenCalledWith('risk1', 'false_positive', undefined);
    });

    it('should add review notes', async () => {
      renderComponent();
      
      const statusButton = screen.getAllByRole('button', { name: /update status/i })[0];
      fireEvent.click(statusButton);
      
      const notesInput = screen.getByLabelText('Review notes');
      await userEvent.type(notesInput, 'Already addressed in amendment');
      
      const saveButton = screen.getByRole('button', { name: /save status/i });
      await userEvent.click(saveButton);
      
      expect(mockOnUpdateRiskStatus).toHaveBeenCalledWith(
        'risk1',
        expect.any(String),
        'Already addressed in amendment'
      );
    });

    it('should generate alert for high-risk items', async () => {
      renderComponent();
      
      const alertButton = screen.getAllByRole('button', { name: /generate alert/i })[0];
      await userEvent.click(alertButton);
      
      expect(mockOnGenerateAlert).toHaveBeenCalledWith(sampleRisks[0]);
    });

    it('should export risks', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      const jsonOption = screen.getByRole('menuitem', { name: /export as json/i });
      await userEvent.click(jsonOption);
      
      expect(mockOnExportRisks).toHaveBeenCalledWith('json');
    });
  });

  describe('Pattern Management', () => {
    it('should display pattern list', () => {
      renderComponent();
      
      const patternsTab = screen.getByRole('tab', { name: /patterns/i });
      fireEvent.click(patternsTab);
      
      expect(screen.getByText('Unlimited Liability')).toBeInTheDocument();
      expect(screen.getByText('No Termination Clause')).toBeInTheDocument();
      expect(screen.getByText('Payment Terms Risk')).toBeInTheDocument();
    });

    it('should create new pattern', async () => {
      renderComponent();
      
      const patternsTab = screen.getByRole('tab', { name: /patterns/i });
      fireEvent.click(patternsTab);
      
      const addButton = screen.getByRole('button', { name: /add pattern/i });
      fireEvent.click(addButton);
      
      const nameInput = screen.getByLabelText('Pattern name');
      await userEvent.type(nameInput, 'New Risk Pattern');
      
      const descInput = screen.getByLabelText('Description');
      await userEvent.type(descInput, 'Detects new type of risk');
      
      const saveButton = screen.getByRole('button', { name: /save pattern/i });
      await userEvent.click(saveButton);
      
      expect(mockOnCreatePattern).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Risk Pattern',
          description: 'Detects new type of risk',
        })
      );
    });

    it('should edit existing pattern', async () => {
      renderComponent();
      
      const patternsTab = screen.getByRole('tab', { name: /patterns/i });
      fireEvent.click(patternsTab);
      
      const editButton = screen.getAllByRole('button', { name: /edit pattern/i })[0];
      fireEvent.click(editButton);
      
      const keywordsInput = screen.getByLabelText('Keywords');
      await userEvent.type(keywordsInput, ', new keyword');
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
      
      expect(mockOnUpdatePattern).toHaveBeenCalled();
    });

    it('should toggle pattern active status', async () => {
      renderComponent();
      
      const patternsTab = screen.getByRole('tab', { name: /patterns/i });
      fireEvent.click(patternsTab);
      
      const toggleButton = screen.getAllByRole('switch', { name: /toggle pattern/i })[0];
      await userEvent.click(toggleButton);
      
      expect(mockOnUpdatePattern).toHaveBeenCalledWith('pattern1', { active: false });
    });

    it('should delete pattern', async () => {
      renderComponent();
      
      const patternsTab = screen.getByRole('tab', { name: /patterns/i });
      fireEvent.click(patternsTab);
      
      const deleteButton = screen.getAllByRole('button', { name: /delete pattern/i })[0];
      fireEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnDeletePattern).toHaveBeenCalledWith('pattern1');
    });
  });

  describe('Threshold Configuration', () => {
    it('should display current thresholds', () => {
      renderComponent();
      
      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);
      
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();
      expect(screen.getByDisplayValue('70')).toBeInTheDocument();
      expect(screen.getByDisplayValue('85')).toBeInTheDocument();
    });

    it('should update thresholds', async () => {
      renderComponent();
      
      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);
      
      const lowInput = screen.getByLabelText('Low threshold');
      await userEvent.clear(lowInput);
      await userEvent.type(lowInput, '25');
      
      const saveButton = screen.getByRole('button', { name: /save thresholds/i });
      await userEvent.click(saveButton);
      
      expect(mockOnUpdateThresholds).toHaveBeenCalledWith(
        expect.objectContaining({ low: 25 })
      );
    });

    it('should validate threshold values', async () => {
      renderComponent();
      
      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);
      
      const lowInput = screen.getByLabelText('Low threshold');
      await userEvent.clear(lowInput);
      await userEvent.type(lowInput, '150');
      
      expect(screen.getByText(/must be between 0 and 100/i)).toBeInTheDocument();
    });
  });

  describe('Risk Trending', () => {
    it('should show risk trend over time', () => {
      renderComponent();
      
      const trendingTab = screen.getByRole('tab', { name: /trending/i });
      fireEvent.click(trendingTab);
      
      expect(screen.getByTestId('risk-timeline')).toBeInTheDocument();
    });

    it('should display risk heatmap', () => {
      renderComponent();
      
      const trendingTab = screen.getByRole('tab', { name: /trending/i });
      fireEvent.click(trendingTab);
      
      expect(screen.getByTestId('risk-heatmap')).toBeInTheDocument();
    });

    it('should show risk comparison metrics', () => {
      renderComponent();
      
      const trendingTab = screen.getByRole('tab', { name: /trending/i });
      fireEvent.click(trendingTab);
      
      expect(screen.getByText('vs. Previous Period')).toBeInTheDocument();
      expect(screen.getByText('vs. Average')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /risk identification/i })).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstRisk = screen.getAllByRole('article')[0];
      firstRisk.focus();
      
      fireEvent.keyDown(firstRisk, { key: 'Enter' });
      
      expect(screen.getByText(/The vendor shall have unlimited liability/)).toBeInTheDocument();
    });

    it('should announce risk updates', async () => {
      renderComponent();
      
      const statusButton = screen.getAllByRole('button', { name: /update status/i })[0];
      fireEvent.click(statusButton);
      
      const acceptButton = screen.getByRole('button', { name: /accept risk/i });
      await userEvent.click(acceptButton);
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/risk status updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle scan failure', async () => {
      mockOnScanContract.mockRejectedValue(new Error('Scan failed'));
      renderComponent();
      
      const scanButton = screen.getByRole('button', { name: /scan contract/i });
      await userEvent.click(scanButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to scan contract/i)).toBeInTheDocument();
      });
    });

    it('should show retry option on error', async () => {
      mockOnScanContract.mockRejectedValue(new Error('Network error'));
      renderComponent();
      
      const scanButton = screen.getByRole('button', { name: /scan contract/i });
      await userEvent.click(scanButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of risks', () => {
      const manyRisks = Array.from({ length: 100 }, (_, i) => ({
        ...sampleRisks[0],
        id: `risk${i}`,
        patternName: `Pattern ${i}`,
      }));
      
      renderComponent({ risks: manyRisks });
      
      expect(screen.getByText('Total Risks')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should paginate risk list', () => {
      const manyRisks = Array.from({ length: 50 }, (_, i) => ({
        ...sampleRisks[0],
        id: `risk${i}`,
        patternName: `Pattern ${i}`,
      }));
      
      renderComponent({ risks: manyRisks });
      
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });
});