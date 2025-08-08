import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InteractiveGraphExplorer } from '../InteractiveGraphExplorer';
import { useAuthStore } from '../../../store/auth';

// Mock auth store
vi.mock('../../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock API calls
const mockApi = {
  getGraphData: vi.fn(),
  getNodeDetails: vi.fn(),
  getRelationships: vi.fn(),
  searchGraph: vi.fn(),
  getNeighbors: vi.fn(),
  findPath: vi.fn(),
  exportGraph: vi.fn(),
  updateLayout: vi.fn(),
  saveView: vi.fn(),
  loadView: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('InteractiveGraphExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({
      user: { id: '1', name: 'Test User', role: 'admin' },
      hasPermission: (perm: string) => true
    });
  });

  describe('Graph Rendering', () => {
    it('should render graph explorer interface', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Interactive Graph Explorer')).toBeInTheDocument();
      expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
    });

    it('should display force-directed graph layout', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      await waitFor(() => {
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();
        expect(screen.getByText(/nodes/i)).toBeInTheDocument();
        expect(screen.getByText(/edges/i)).toBeInTheDocument();
      });
    });

    it('should show graph statistics', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Total Nodes')).toBeInTheDocument();
        expect(screen.getByText('Total Edges')).toBeInTheDocument();
        expect(screen.getByText('Connected Components')).toBeInTheDocument();
      });
    });
  });

  describe('Zoom and Pan Controls', () => {
    it('should display zoom controls', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByLabelText('Zoom In')).toBeInTheDocument();
      expect(screen.getByLabelText('Zoom Out')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset Zoom')).toBeInTheDocument();
    });

    it('should zoom in on click', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const zoomInButton = screen.getByLabelText('Zoom In');
      fireEvent.click(zoomInButton);
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('125%');
      });
    });

    it('should zoom out on click', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const zoomOutButton = screen.getByLabelText('Zoom Out');
      fireEvent.click(zoomOutButton);
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('75%');
      });
    });

    it('should reset zoom', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const resetButton = screen.getByLabelText('Reset Zoom');
      fireEvent.click(resetButton);
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
      });
    });

    it('should support pan controls', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByLabelText('Pan Mode')).toBeInTheDocument();
    });

    it('should support mouse wheel zoom', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const canvas = screen.getByTestId('graph-canvas');
      fireEvent.wheel(canvas, { deltaY: -100 });
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).not.toHaveTextContent('100%');
      });
    });
  });

  describe('Node Filtering Options', () => {
    it('should display node filter panel', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Node Filters')).toBeInTheDocument();
    });

    it('should filter by node type', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const typeFilter = screen.getByLabelText('Node Type');
      fireEvent.change(typeFilter, { target: { value: 'contract' } });
      await waitFor(() => {
        expect(screen.getByText(/showing contract nodes/i)).toBeInTheDocument();
      });
    });

    it('should filter by node properties', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Add Property Filter'));
      await waitFor(() => {
        expect(screen.getByLabelText('Property')).toBeInTheDocument();
        expect(screen.getByLabelText('Operator')).toBeInTheDocument();
        expect(screen.getByLabelText('Value')).toBeInTheDocument();
      });
    });

    it('should apply multiple filters', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const typeFilter = screen.getByLabelText('Node Type');
      fireEvent.change(typeFilter, { target: { value: 'contract' } });
      const statusFilter = screen.getByLabelText('Status');
      fireEvent.change(statusFilter, { target: { value: 'active' } });
      await waitFor(() => {
        expect(screen.getByText(/active contract nodes/i)).toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Clear Filters'));
      await waitFor(() => {
        expect(screen.getByText(/all nodes visible/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Filtering Options', () => {
    it('should display edge filter panel', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Edge Filters')).toBeInTheDocument();
    });

    it('should filter by edge type', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const edgeTypeFilter = screen.getByLabelText('Edge Type');
      fireEvent.change(edgeTypeFilter, { target: { value: 'contains' } });
      await waitFor(() => {
        expect(screen.getByText(/showing contains edges/i)).toBeInTheDocument();
      });
    });

    it('should filter by edge weight', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const weightSlider = screen.getByLabelText('Minimum Weight');
      fireEvent.change(weightSlider, { target: { value: '0.5' } });
      await waitFor(() => {
        expect(screen.getByText(/weight >= 0.5/i)).toBeInTheDocument();
      });
    });

    it('should hide/show edge labels', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const labelToggle = screen.getByLabelText('Show Edge Labels');
      fireEvent.click(labelToggle);
      await waitFor(() => {
        expect(screen.getByTestId('edge-labels-hidden')).toBeInTheDocument();
      });
    });
  });

  describe('Node Clustering', () => {
    it('should display clustering options', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Clustering')).toBeInTheDocument();
    });

    it('should cluster by node type', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Cluster by Type'));
      await waitFor(() => {
        expect(screen.getByText(/nodes clustered by type/i)).toBeInTheDocument();
      });
    });

    it('should cluster by community', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Detect Communities'));
      await waitFor(() => {
        expect(screen.getByText(/communities detected/i)).toBeInTheDocument();
      });
    });

    it('should expand cluster on click', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Cluster by Type'));
      await waitFor(() => {
        const cluster = screen.getByTestId('cluster-contract');
        fireEvent.click(cluster);
        expect(screen.getByText(/expanded/i)).toBeInTheDocument();
      });
    });

    it('should collapse expanded cluster', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const collapseButton = screen.getByText('Collapse All');
      fireEvent.click(collapseButton);
      await waitFor(() => {
        expect(screen.getByText(/all clusters collapsed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should expand node neighbors', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.doubleClick(node);
      await waitFor(() => {
        expect(screen.getByText(/neighbors loaded/i)).toBeInTheDocument();
      });
    });

    it('should collapse node branch', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.contextMenu(node);
      const collapseOption = screen.getByText('Collapse Branch');
      fireEvent.click(collapseOption);
      await waitFor(() => {
        expect(screen.getByText(/branch collapsed/i)).toBeInTheDocument();
      });
    });

    it('should expand all nodes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Expand All'));
      await waitFor(() => {
        expect(screen.getByText(/all nodes expanded/i)).toBeInTheDocument();
      });
    });

    it('should show expansion depth control', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByLabelText('Expansion Depth')).toBeInTheDocument();
    });
  });

  describe('Search Within Graph', () => {
    it('should display search box', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('should search nodes by name', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await userEvent.type(searchInput, 'Contract');
      await waitFor(() => {
        expect(screen.getByText(/found \d+ matching nodes/i)).toBeInTheDocument();
      });
    });

    it('should highlight search results', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await userEvent.type(searchInput, 'Contract');
      await waitFor(() => {
        expect(screen.getByTestId('highlighted-nodes')).toBeInTheDocument();
      });
    });

    it('should navigate between search results', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await userEvent.type(searchInput, 'Contract');
      await waitFor(() => {
        const nextButton = screen.getByLabelText('Next Result');
        fireEvent.click(nextButton);
        expect(screen.getByText(/result 2 of/i)).toBeInTheDocument();
      });
    });

    it('should clear search', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      await userEvent.type(searchInput, 'Contract');
      const clearButton = screen.getByLabelText('Clear Search');
      fireEvent.click(clearButton);
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Node Details Panel', () => {
    it('should show node details on click', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.click(node);
      await waitFor(() => {
        expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
        expect(screen.getByText('Node Details')).toBeInTheDocument();
      });
    });

    it('should display node properties', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.click(node);
      await waitFor(() => {
        expect(screen.getByText('ID:')).toBeInTheDocument();
        expect(screen.getByText('Type:')).toBeInTheDocument();
        expect(screen.getByText('Properties:')).toBeInTheDocument();
      });
    });

    it('should show node relationships', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.click(node);
      await waitFor(() => {
        expect(screen.getByText('Relationships')).toBeInTheDocument();
        expect(screen.getByText(/incoming/i)).toBeInTheDocument();
        expect(screen.getByText(/outgoing/i)).toBeInTheDocument();
      });
    });

    it('should close details panel', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.click(node);
      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close Details');
        fireEvent.click(closeButton);
        expect(screen.queryByTestId('node-details-panel')).not.toBeInTheDocument();
      });
    });
  });

  describe('Path Highlighting', () => {
    it('should find shortest path between nodes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Find Path'));
      await waitFor(() => {
        expect(screen.getByText('Select Source Node')).toBeInTheDocument();
        expect(screen.getByText('Select Target Node')).toBeInTheDocument();
      });
    });

    it('should highlight path when found', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Find Path'));
      const sourceNode = screen.getByTestId('node-1');
      const targetNode = screen.getByTestId('node-5');
      fireEvent.click(sourceNode);
      fireEvent.click(targetNode);
      await waitFor(() => {
        expect(screen.getByTestId('highlighted-path')).toBeInTheDocument();
      });
    });

    it('should show path details', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Find Path'));
      const sourceNode = screen.getByTestId('node-1');
      const targetNode = screen.getByTestId('node-5');
      fireEvent.click(sourceNode);
      fireEvent.click(targetNode);
      await waitFor(() => {
        expect(screen.getByText(/path length:/i)).toBeInTheDocument();
        expect(screen.getByText(/nodes in path:/i)).toBeInTheDocument();
      });
    });

    it('should clear path highlighting', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Clear Path'));
      await waitFor(() => {
        expect(screen.queryByTestId('highlighted-path')).not.toBeInTheDocument();
      });
    });
  });

  describe('Export Capabilities', () => {
    it('should display export options', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should export as image', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getByText('Export as PNG'));
      await waitFor(() => {
        expect(screen.getByText(/image exported/i)).toBeInTheDocument();
      });
    });

    it('should export as SVG', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getByText('Export as SVG'));
      await waitFor(() => {
        expect(screen.getByText(/svg exported/i)).toBeInTheDocument();
      });
    });

    it('should export graph data', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getByText('Export Data (JSON)'));
      await waitFor(() => {
        expect(screen.getByText(/data exported/i)).toBeInTheDocument();
      });
    });

    it('should export filtered view', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const typeFilter = screen.getByLabelText('Node Type');
      fireEvent.change(typeFilter, { target: { value: 'contract' } });
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(screen.getByText('Export Current View'));
      await waitFor(() => {
        expect(screen.getByText(/filtered view exported/i)).toBeInTheDocument();
      });
    });
  });

  describe('Graph Layout Options', () => {
    it('should display layout options', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText('Layout')).toBeInTheDocument();
    });

    it('should switch to hierarchical layout', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const layoutSelect = screen.getByLabelText('Layout Type');
      fireEvent.change(layoutSelect, { target: { value: 'hierarchical' } });
      await waitFor(() => {
        expect(screen.getByText(/hierarchical layout applied/i)).toBeInTheDocument();
      });
    });

    it('should switch to circular layout', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const layoutSelect = screen.getByLabelText('Layout Type');
      fireEvent.change(layoutSelect, { target: { value: 'circular' } });
      await waitFor(() => {
        expect(screen.getByText(/circular layout applied/i)).toBeInTheDocument();
      });
    });

    it('should adjust force strength', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const forceSlider = screen.getByLabelText('Force Strength');
      fireEvent.change(forceSlider, { target: { value: '0.8' } });
      await waitFor(() => {
        expect(screen.getByText(/force strength: 0.8/i)).toBeInTheDocument();
      });
    });
  });

  describe('Interactive Features', () => {
    it('should drag nodes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.mouseDown(node);
      fireEvent.mouseMove(node, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(node);
      await waitFor(() => {
        expect(screen.getByText(/node position updated/i)).toBeInTheDocument();
      });
    });

    it('should pin node position', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.contextMenu(node);
      fireEvent.click(screen.getByText('Pin Position'));
      await waitFor(() => {
        expect(screen.getByTestId('node-1-pinned')).toBeInTheDocument();
      });
    });

    it('should show node tooltip on hover', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node = screen.getByTestId('node-1');
      fireEvent.mouseEnter(node);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should select multiple nodes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const node1 = screen.getByTestId('node-1');
      const node2 = screen.getByTestId('node-2');
      fireEvent.click(node1, { ctrlKey: true });
      fireEvent.click(node2, { ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByText(/2 nodes selected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Options', () => {
    it('should toggle performance mode', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const perfToggle = screen.getByLabelText('Performance Mode');
      fireEvent.click(perfToggle);
      await waitFor(() => {
        expect(screen.getByText(/performance mode enabled/i)).toBeInTheDocument();
      });
    });

    it('should limit visible nodes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const limitInput = screen.getByLabelText('Max Visible Nodes');
      fireEvent.change(limitInput, { target: { value: '100' } });
      await waitFor(() => {
        expect(screen.getByText(/showing 100 of/i)).toBeInTheDocument();
      });
    });

    it('should toggle animations', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const animToggle = screen.getByLabelText('Enable Animations');
      fireEvent.click(animToggle);
      await waitFor(() => {
        expect(screen.getByText(/animations disabled/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Interactive Graph Explorer');
      expect(screen.getByTestId('graph-canvas')).toHaveAttribute('role', 'img');
    });

    it('should support keyboard navigation', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const canvas = screen.getByTestId('graph-canvas');
      canvas.focus();
      fireEvent.keyDown(canvas, { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByText(/moved right/i)).toBeInTheDocument();
      });
    });

    it('should announce graph changes', async () => {
      render(<InteractiveGraphExplorer />, { wrapper });
      const typeFilter = screen.getByLabelText('Node Type');
      fireEvent.change(typeFilter, { target: { value: 'contract' } });
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/graph updated/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle graph data loading errors', async () => {
      mockApi.getGraphData.mockRejectedValue(new Error('Failed to load graph'));
      render(<InteractiveGraphExplorer />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show retry option on error', async () => {
      mockApi.getGraphData.mockRejectedValue(new Error('Network error'));
      render(<InteractiveGraphExplorer />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('should hide export for viewers', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'graph:view'
      });
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.queryByText('Export')).not.toBeInTheDocument();
    });

    it('should show read-only mode for non-admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: { id: '1', name: 'Test User', role: 'viewer' },
        hasPermission: (perm: string) => perm === 'graph:view'
      });
      render(<InteractiveGraphExplorer />, { wrapper });
      expect(screen.getByText(/read-only mode/i)).toBeInTheDocument();
    });
  });
});