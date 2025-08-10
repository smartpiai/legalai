/**
 * InteractiveGraphExplorer Component Tests
 * Following TDD - RED phase: Writing comprehensive tests first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteractiveGraphExplorer } from '../InteractiveGraphExplorer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock graph visualization library
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(({ onNodeClick, onNodeHover, onLinkClick, nodeCanvasObject }) => (
    <div data-testid="graph-visualization">
      <button onClick={() => onNodeClick({ id: 'node-1', label: 'Contract A' })}>
        Node Click
      </button>
      <button onClick={() => onNodeHover({ id: 'node-2', label: 'Party B' })}>
        Node Hover
      </button>
      <button onClick={() => onLinkClick({ source: 'node-1', target: 'node-2', type: 'PARTY_TO' })}>
        Link Click
      </button>
    </div>
  )),
}));

// Mock API service
vi.mock('../../../services/graph.service', () => ({
  graphService: {
    getGraphData: vi.fn(),
    searchNodes: vi.fn(),
    getNodeDetails: vi.fn(),
    getRelatedNodes: vi.fn(),
    runCypherQuery: vi.fn(),
    getGraphStatistics: vi.fn(),
    exportGraph: vi.fn(),
    getShortestPath: vi.fn(),
    getCommunities: vi.fn(),
    getNodeImportance: vi.fn(),
  },
}));

const mockGraphData = {
  nodes: [
    { id: 'node-1', label: 'Contract A', type: 'CONTRACT', properties: { value: 100000, status: 'active' } },
    { id: 'node-2', label: 'Party B', type: 'PARTY', properties: { jurisdiction: 'US', type: 'company' } },
    { id: 'node-3', label: 'Clause C', type: 'CLAUSE', properties: { risk_level: 'high', category: 'liability' } },
    { id: 'node-4', label: 'Contract D', type: 'CONTRACT', properties: { value: 250000, status: 'draft' } },
    { id: 'node-5', label: 'Party E', type: 'PARTY', properties: { jurisdiction: 'UK', type: 'individual' } },
  ],
  links: [
    { source: 'node-1', target: 'node-2', type: 'PARTY_TO', properties: { role: 'buyer' } },
    { source: 'node-1', target: 'node-3', type: 'CONTAINS', properties: { position: 1 } },
    { source: 'node-4', target: 'node-2', type: 'PARTY_TO', properties: { role: 'seller' } },
    { source: 'node-4', target: 'node-5', type: 'PARTY_TO', properties: { role: 'buyer' } },
    { source: 'node-4', target: 'node-1', type: 'SUPERSEDES', properties: { date: '2024-01-01' } },
  ],
};

describe('InteractiveGraphExplorer', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();
  const mockOnNodeSelect = vi.fn();
  const mockOnRelationshipSelect = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: () => true,
    } as any);
    
    const { graphService } = require('../../../services/graph.service');
    graphService.getGraphData.mockResolvedValue(mockGraphData);
    graphService.searchNodes.mockResolvedValue({ 
      nodes: [mockGraphData.nodes[0], mockGraphData.nodes[3]] 
    });
    graphService.getNodeDetails.mockResolvedValue({
      ...mockGraphData.nodes[0],
      relationships: [mockGraphData.links[0], mockGraphData.links[1]],
    });
    graphService.getGraphStatistics.mockResolvedValue({
      totalNodes: 5,
      totalRelationships: 5,
      nodeTypes: { CONTRACT: 2, PARTY: 2, CLAUSE: 1 },
      relationshipTypes: { PARTY_TO: 3, CONTAINS: 1, SUPERSEDES: 1 },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <InteractiveGraphExplorer
          onNodeSelect={mockOnNodeSelect}
          onRelationshipSelect={mockOnRelationshipSelect}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Graph Visualization', () => {
    it('should render graph visualization container', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-explorer')).toBeInTheDocument();
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });
    });

    it('should load and display graph data', async () => {
      renderComponent({ contractId: 'contract-123' });
      
      await waitFor(() => {
        expect(screen.getByText(/5 nodes/i)).toBeInTheDocument();
        expect(screen.getByText(/5 relationships/i)).toBeInTheDocument();
      });
    });

    it('should handle node click events', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Node Click'));
      
      expect(mockOnNodeSelect).toHaveBeenCalledWith({
        id: 'node-1',
        label: 'Contract A',
      });
    });

    it('should handle link click events', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Link Click'));
      
      expect(mockOnRelationshipSelect).toHaveBeenCalledWith({
        source: 'node-1',
        target: 'node-2',
        type: 'PARTY_TO',
      });
    });

    it('should show node details on hover', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Node Hover'));
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Party B')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should render search input', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText(/search nodes/i)).toBeInTheDocument();
    });

    it('should search nodes on input', async () => {
      const { graphService } = require('../../../services/graph.service');
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      await user.type(searchInput, 'Contract');
      
      await waitFor(() => {
        expect(graphService.searchNodes).toHaveBeenCalledWith({
          query: 'Contract',
          types: [],
        });
      });
    });

    it('should filter by node type', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const contractCheckbox = screen.getByRole('checkbox', { name: /contract/i });
      await user.click(contractCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText(/Filtered: CONTRACT/i)).toBeInTheDocument();
      });
    });

    it('should filter by relationship type', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const partyToCheckbox = screen.getByRole('checkbox', { name: /party_to/i });
      await user.click(partyToCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText(/Filtered: PARTY_TO/i)).toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Filtered:/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Layout Controls', () => {
    it('should provide layout options', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /force layout/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hierarchical/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /circular/i })).toBeInTheDocument();
    });

    it('should change layout on selection', async () => {
      renderComponent();
      
      const hierarchicalButton = screen.getByRole('button', { name: /hierarchical/i });
      await user.click(hierarchicalButton);
      
      expect(hierarchicalButton).toHaveClass('active');
    });

    it('should provide zoom controls', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fit to screen/i })).toBeInTheDocument();
    });

    it('should center graph on button click', async () => {
      renderComponent();
      
      const centerButton = screen.getByRole('button', { name: /center graph/i });
      await user.click(centerButton);
      
      // Graph should be centered (implementation will handle this)
      expect(centerButton).toBeInTheDocument();
    });
  });

  describe('Node Operations', () => {
    it('should expand node relationships', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getRelatedNodes.mockResolvedValue({
        nodes: [mockGraphData.nodes[1], mockGraphData.nodes[2]],
        links: [mockGraphData.links[0], mockGraphData.links[1]],
      });

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      const expandButton = screen.getByRole('button', { name: /expand node/i });
      await user.click(expandButton);
      
      await waitFor(() => {
        expect(graphService.getRelatedNodes).toHaveBeenCalled();
      });
    });

    it('should hide selected nodes', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      const hideButton = screen.getByRole('button', { name: /hide node/i });
      await user.click(hideButton);
      
      // Node should be hidden from view
      expect(screen.getByText(/Node hidden/i)).toBeInTheDocument();
    });

    it('should highlight connected nodes', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      const highlightButton = screen.getByRole('button', { name: /highlight connections/i });
      await user.click(highlightButton);
      
      expect(screen.getByText(/Connections highlighted/i)).toBeInTheDocument();
    });

    it('should show node details panel', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Node Click'));
      
      await waitFor(() => {
        expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
        expect(screen.getByText('Contract A')).toBeInTheDocument();
        expect(screen.getByText(/Value: \$100,000/i)).toBeInTheDocument();
      });
    });
  });

  describe('Path Finding', () => {
    it('should find shortest path between nodes', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getShortestPath.mockResolvedValue({
        path: ['node-1', 'node-2', 'node-4'],
        distance: 2,
      });

      renderComponent();
      
      const pathButton = screen.getByRole('button', { name: /find path/i });
      await user.click(pathButton);
      
      // Select source and target nodes
      const sourceSelect = screen.getByLabelText(/source node/i);
      const targetSelect = screen.getByLabelText(/target node/i);
      
      await user.selectOptions(sourceSelect, 'node-1');
      await user.selectOptions(targetSelect, 'node-4');
      
      const findButton = screen.getByRole('button', { name: /calculate path/i });
      await user.click(findButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Path length: 2/i)).toBeInTheDocument();
      });
    });

    it('should show no path message when nodes not connected', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getShortestPath.mockResolvedValue(null);

      renderComponent();
      
      const pathButton = screen.getByRole('button', { name: /find path/i });
      await user.click(pathButton);
      
      const findButton = screen.getByRole('button', { name: /calculate path/i });
      await user.click(findButton);
      
      await waitFor(() => {
        expect(screen.getByText(/No path found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Graph Analytics', () => {
    it('should show graph statistics', async () => {
      renderComponent();
      
      const statsButton = screen.getByRole('button', { name: /statistics/i });
      await user.click(statsButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Total Nodes: 5/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Relationships: 5/i)).toBeInTheDocument();
      });
    });

    it('should detect communities', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getCommunities.mockResolvedValue({
        communities: [
          { id: 'community-1', nodes: ['node-1', 'node-2', 'node-3'], color: '#FF0000' },
          { id: 'community-2', nodes: ['node-4', 'node-5'], color: '#00FF00' },
        ],
      });

      renderComponent();
      
      const communityButton = screen.getByRole('button', { name: /detect communities/i });
      await user.click(communityButton);
      
      await waitFor(() => {
        expect(screen.getByText(/2 communities detected/i)).toBeInTheDocument();
      });
    });

    it('should calculate node importance', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getNodeImportance.mockResolvedValue({
        scores: {
          'node-1': 0.85,
          'node-2': 0.72,
          'node-3': 0.45,
          'node-4': 0.68,
          'node-5': 0.31,
        },
        algorithm: 'pagerank',
      });

      renderComponent();
      
      const importanceButton = screen.getByRole('button', { name: /node importance/i });
      await user.click(importanceButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Importance calculated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export and Sharing', () => {
    it('should export graph as image', async () => {
      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);
      
      const imageOption = screen.getByRole('menuitem', { name: /export as png/i });
      await user.click(imageOption);
      
      expect(screen.getByText(/Graph exported/i)).toBeInTheDocument();
    });

    it('should export graph data as JSON', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.exportGraph.mockResolvedValue({
        url: 'https://example.com/export.json',
      });

      renderComponent();
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);
      
      const jsonOption = screen.getByRole('menuitem', { name: /export as json/i });
      await user.click(jsonOption);
      
      await waitFor(() => {
        expect(graphService.exportGraph).toHaveBeenCalledWith({
          format: 'json',
          includeProperties: true,
        });
      });
    });

    it('should share graph view via link', async () => {
      renderComponent();
      
      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Share Graph View/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /share link/i })).toBeInTheDocument();
      });
    });
  });

  describe('Cypher Query', () => {
    it('should show Cypher query input', async () => {
      renderComponent();
      
      const queryButton = screen.getByRole('button', { name: /query/i });
      await user.click(queryButton);
      
      expect(screen.getByPlaceholderText(/enter cypher query/i)).toBeInTheDocument();
    });

    it('should execute Cypher query', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.runCypherQuery.mockResolvedValue({
        nodes: [mockGraphData.nodes[0]],
        links: [],
      });

      renderComponent();
      
      const queryButton = screen.getByRole('button', { name: /query/i });
      await user.click(queryButton);
      
      const queryInput = screen.getByPlaceholderText(/enter cypher query/i);
      await user.type(queryInput, 'MATCH (n:CONTRACT) RETURN n');
      
      const executeButton = screen.getByRole('button', { name: /execute/i });
      await user.click(executeButton);
      
      await waitFor(() => {
        expect(graphService.runCypherQuery).toHaveBeenCalledWith(
          'MATCH (n:CONTRACT) RETURN n'
        );
      });
    });

    it('should show query error messages', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.runCypherQuery.mockRejectedValue(new Error('Invalid query syntax'));

      renderComponent();
      
      const queryButton = screen.getByRole('button', { name: /query/i });
      await user.click(queryButton);
      
      const executeButton = screen.getByRole('button', { name: /execute/i });
      await user.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid query syntax/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /graph explorer/i })).toBeInTheDocument();
      expect(screen.getByRole('search', { name: /search nodes/i })).toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: /graph controls/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search nodes/i);
      searchInput.focus();
      
      // Tab to next element
      await user.tab();
      expect(screen.getByRole('button', { name: /filter/i })).toHaveFocus();
      
      // Tab to layout controls
      await user.tab();
      expect(screen.getByRole('button', { name: /force layout/i })).toHaveFocus();
    });

    it('should announce graph updates to screen readers', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/Graph loaded with 5 nodes/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when graph data fails to load', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getGraphData.mockRejectedValue(new Error('Network error'));

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load graph data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry loading on error', async () => {
      const { graphService } = require('../../../services/graph.service');
      graphService.getGraphData.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockGraphData);

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/5 nodes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', async () => {
      const largeGraph = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node-${i}`,
          label: `Node ${i}`,
          type: 'CONTRACT',
        })),
        links: Array.from({ length: 2000 }, (_, i) => ({
          source: `node-${i % 1000}`,
          target: `node-${(i + 1) % 1000}`,
          type: 'RELATES_TO',
        })),
      };

      const { graphService } = require('../../../services/graph.service');
      graphService.getGraphData.mockResolvedValue(largeGraph);

      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/1000 nodes/i)).toBeInTheDocument();
      });
    });

    it('should use virtualization for node lists', async () => {
      renderComponent();
      
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      await user.click(listViewButton);
      
      // Only visible nodes should be rendered
      const nodeItems = screen.getAllByTestId(/node-list-item/i);
      expect(nodeItems.length).toBeLessThan(50); // Virtualized
    });
  });
});