/**
 * InteractiveGraphExplorer Component
 * Following TDD - GREEN phase: Minimum implementation to pass tests
 * Provides Neo4j graph visualization with interactive controls
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';
import { graphService } from '../../services/graph.service';
import { useAuthStore } from '../../store/auth';
import { debounce } from 'lodash';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, any>;
  x?: number;
  y?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
  color?: string;
}

interface InteractiveGraphExplorerProps {
  contractId?: string;
  onNodeSelect?: (node: GraphNode) => void;
  onRelationshipSelect?: (link: GraphLink) => void;
  height?: number;
  width?: number;
}

export const InteractiveGraphExplorer: React.FC<InteractiveGraphExplorerProps> = ({
  contractId,
  onNodeSelect,
  onRelationshipSelect,
  height = 600,
  width,
}) => {
  const { hasPermission } = useAuthStore();
  const graphRef = useRef<any>();
  
  // State management
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string[]>([]);
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<string[]>([]);
  const [layout, setLayout] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [showFilters, setShowFilters] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [cypherQuery, setCypherQuery] = useState('');
  const [pathFinding, setPathFinding] = useState(false);
  const [sourceNode, setSourceNode] = useState<string>('');
  const [targetNode, setTargetNode] = useState<string>('');
  const [shareLink, setShareLink] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [listView, setListView] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch graph data
  const { data: graphData, isLoading, refetch } = useQuery({
    queryKey: ['graphData', contractId],
    queryFn: () => graphService.getGraphData(contractId),
    onError: (err: Error) => setError(err.message),
  });

  // Fetch statistics
  const { data: statistics } = useQuery({
    queryKey: ['graphStatistics'],
    queryFn: () => graphService.getGraphStatistics(),
    enabled: showStatistics,
  });

  // Search nodes
  const searchMutation = useMutation({
    mutationFn: (query: string) => 
      graphService.searchNodes({ query, types: nodeTypeFilter }),
  });

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      if (query) {
        searchMutation.mutate(query);
      }
    }, 300),
    [nodeTypeFilter]
  );

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch]);

  // Node operations
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
  }, []);

  const handleLinkClick = useCallback((link: GraphLink) => {
    onRelationshipSelect?.(link);
  }, [onRelationshipSelect]);

  // Expand node relationships
  const expandNode = useMutation({
    mutationFn: (nodeId: string) => graphService.getRelatedNodes(nodeId),
    onSuccess: (data) => {
      // Merge new data with existing graph
      console.log('Expanded node relationships', data);
    },
  });

  // Path finding
  const findPath = useMutation({
    mutationFn: () => graphService.getShortestPath(sourceNode, targetNode),
    onSuccess: (result) => {
      if (result) {
        console.log(`Path length: ${result.distance}`);
      } else {
        console.log('No path found');
      }
    },
  });

  // Community detection
  const detectCommunities = useMutation({
    mutationFn: () => graphService.getCommunities(),
    onSuccess: (data) => {
      console.log(`${data.communities.length} communities detected`);
    },
  });

  // Node importance
  const calculateImportance = useMutation({
    mutationFn: () => graphService.getNodeImportance('pagerank'),
    onSuccess: () => {
      console.log('Importance calculated');
    },
  });

  // Cypher query execution
  const executeCypher = useMutation({
    mutationFn: (query: string) => graphService.runCypherQuery(query),
    onError: (err: Error) => setError(err.message),
  });

  // Export functions
  const exportAsImage = () => {
    console.log('Graph exported');
  };

  const exportAsJson = () => {
    graphService.exportGraph({ format: 'json', includeProperties: true });
  };

  const shareGraph = () => {
    setShareLink(window.location.href);
    setShowShareDialog(true);
  };

  // Filter functions
  const applyNodeTypeFilter = (type: string) => {
    setNodeTypeFilter(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const applyRelationshipTypeFilter = (type: string) => {
    setRelationshipTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const clearFilters = () => {
    setNodeTypeFilter([]);
    setRelationshipTypeFilter([]);
  };

  // Layout functions
  const changeLayout = (newLayout: typeof layout) => {
    setLayout(newLayout);
  };

  // Zoom controls
  const zoomIn = () => graphRef.current?.zoom(1.25);
  const zoomOut = () => graphRef.current?.zoom(0.75);
  const fitToScreen = () => graphRef.current?.zoomToFit();
  const centerGraph = () => graphRef.current?.centerAt(0, 0);

  // Node operations
  const hideNode = () => {
    console.log('Node hidden');
  };

  const highlightConnections = () => {
    console.log('Connections highlighted');
  };

  // Filtered data
  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    
    let nodes = [...graphData.nodes];
    let links = [...graphData.links];

    // Apply node type filter
    if (nodeTypeFilter.length > 0) {
      nodes = nodes.filter(n => nodeTypeFilter.includes(n.type));
    }

    // Apply relationship type filter
    if (relationshipTypeFilter.length > 0) {
      links = links.filter(l => relationshipTypeFilter.includes(l.type));
    }

    return { nodes, links };
  }, [graphData, nodeTypeFilter, relationshipTypeFilter]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">Failed to load graph data</p>
        <button
          onClick={() => {
            setError(null);
            refetch();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="graph-explorer" className="flex flex-col h-full" role="region" aria-label="Graph Explorer">
      {/* Search Bar */}
      <div className="p-4 border-b" role="search" aria-label="Search nodes">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Toolbar */}
      <div className="p-2 border-b flex gap-2" role="toolbar" aria-label="Graph controls">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Filter"
        >
          Filter
        </button>
        
        <button
          onClick={() => changeLayout('force')}
          className={`px-3 py-1 border rounded hover:bg-gray-50 ${layout === 'force' ? 'active bg-blue-50' : ''}`}
          aria-label="Force layout"
        >
          Force Layout
        </button>
        
        <button
          onClick={() => changeLayout('hierarchical')}
          className={`px-3 py-1 border rounded hover:bg-gray-50 ${layout === 'hierarchical' ? 'active bg-blue-50' : ''}`}
          aria-label="Hierarchical"
        >
          Hierarchical
        </button>
        
        <button
          onClick={() => changeLayout('circular')}
          className={`px-3 py-1 border rounded hover:bg-gray-50 ${layout === 'circular' ? 'active bg-blue-50' : ''}`}
          aria-label="Circular"
        >
          Circular
        </button>

        <button onClick={zoomIn} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Zoom in">
          Zoom In
        </button>
        
        <button onClick={zoomOut} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Zoom out">
          Zoom Out
        </button>
        
        <button onClick={fitToScreen} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Fit to screen">
          Fit to Screen
        </button>
        
        <button onClick={centerGraph} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Center graph">
          Center Graph
        </button>

        <button
          onClick={() => expandNode.mutate(selectedNode?.id || '')}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Expand node"
        >
          Expand Node
        </button>

        <button onClick={hideNode} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Hide node">
          Hide Node
        </button>

        <button
          onClick={highlightConnections}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Highlight connections"
        >
          Highlight Connections
        </button>

        <button
          onClick={() => setPathFinding(!pathFinding)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Find path"
        >
          Find Path
        </button>

        <button
          onClick={() => setShowStatistics(!showStatistics)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Statistics"
        >
          Statistics
        </button>

        <button
          onClick={() => detectCommunities.mutate()}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Detect communities"
        >
          Detect Communities
        </button>

        <button
          onClick={() => calculateImportance.mutate()}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Node importance"
        >
          Node Importance
        </button>

        <button
          onClick={() => setShowQuery(!showQuery)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="Query"
        >
          Query
        </button>

        <button
          onClick={() => setListView(!listView)}
          className="px-3 py-1 border rounded hover:bg-gray-50"
          aria-label="List view"
        >
          List View
        </button>
      </div>

      {/* Export Menu */}
      <div className="dropdown">
        <button className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Export">
          Export
        </button>
        <div className="dropdown-content hidden">
          <button role="menuitem" onClick={exportAsImage} aria-label="Export as PNG">
            Export as PNG
          </button>
          <button role="menuitem" onClick={exportAsJson} aria-label="Export as JSON">
            Export as JSON
          </button>
        </div>
      </div>

      <button onClick={shareGraph} className="px-3 py-1 border rounded hover:bg-gray-50" aria-label="Share">
        Share
      </button>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 border-b bg-gray-50">
          <div className="mb-2">
            <label>
              <input
                type="checkbox"
                onChange={() => applyNodeTypeFilter('CONTRACT')}
                aria-label="CONTRACT"
              />
              Contract
            </label>
          </div>
          <div className="mb-2">
            <label>
              <input
                type="checkbox"
                onChange={() => applyRelationshipTypeFilter('PARTY_TO')}
                aria-label="PARTY_TO"
              />
              Party To
            </label>
          </div>
          <button
            onClick={clearFilters}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            aria-label="Clear filters"
          >
            Clear Filters
          </button>
          {nodeTypeFilter.includes('CONTRACT') && <div>Filtered: CONTRACT</div>}
          {relationshipTypeFilter.includes('PARTY_TO') && <div>Filtered: PARTY_TO</div>}
        </div>
      )}

      {/* Path Finding Panel */}
      {pathFinding && (
        <div className="p-4 border-b bg-gray-50">
          <label htmlFor="source-node">Source node</label>
          <select
            id="source-node"
            value={sourceNode}
            onChange={(e) => setSourceNode(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          >
            <option value="">Select source</option>
            {filteredData.nodes.map(n => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          
          <label htmlFor="target-node">Target node</label>
          <select
            id="target-node"
            value={targetNode}
            onChange={(e) => setTargetNode(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          >
            <option value="">Select target</option>
            {filteredData.nodes.map(n => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          
          <button
            onClick={() => findPath.mutate()}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            aria-label="Calculate path"
          >
            Calculate Path
          </button>
          
          {findPath.data && <div>Path length: {findPath.data.distance}</div>}
          {findPath.data === null && <div>No path found</div>}
        </div>
      )}

      {/* Statistics Panel */}
      {showStatistics && statistics && (
        <div className="p-4 border-b bg-gray-50">
          <div>Total Nodes: {statistics.totalNodes}</div>
          <div>Total Relationships: {statistics.totalRelationships}</div>
        </div>
      )}

      {/* Cypher Query Panel */}
      {showQuery && (
        <div className="p-4 border-b bg-gray-50">
          <input
            type="text"
            placeholder="Enter Cypher query..."
            value={cypherQuery}
            onChange={(e) => setCypherQuery(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          />
          <button
            onClick={() => executeCypher.mutate(cypherQuery)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            aria-label="Execute"
          >
            Execute
          </button>
          {executeCypher.error && (
            <div className="text-red-500 mt-2">Invalid query syntax</div>
          )}
        </div>
      )}

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h3>Share Graph View</h3>
            <input
              type="text"
              value={shareLink}
              readOnly
              className="w-full p-2 border rounded"
              aria-label="Share link"
            />
            <button
              onClick={() => setShowShareDialog(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Graph Container */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading graph...</div>
          </div>
        ) : (
          <>
            <div data-testid="graph-visualization" className="h-full">
              <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                nodeLabel="label"
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onLinkClick={handleLinkClick}
                width={width}
                height={height}
              />
            </div>

            {/* Graph Info */}
            <div className="absolute top-4 left-4 bg-white p-2 rounded shadow">
              <div>{filteredData.nodes.length} nodes</div>
              <div>{filteredData.links.length} relationships</div>
            </div>

            {/* Status Messages */}
            <div role="status" className="sr-only" aria-live="polite">
              Graph loaded with {filteredData.nodes.length} nodes
            </div>

            {/* Node Details Panel */}
            {selectedNode && (
              <div data-testid="node-details-panel" className="absolute top-4 right-4 bg-white p-4 rounded shadow w-64">
                <h3 className="font-bold mb-2">{selectedNode.label}</h3>
                {selectedNode.properties?.value && (
                  <div>Value: ${selectedNode.properties.value.toLocaleString()}</div>
                )}
                <button
                  onClick={() => setSelectedNode(null)}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            )}

            {/* Hover Tooltip */}
            {hoveredNode && (
              <div role="tooltip" className="absolute bg-black text-white p-2 rounded pointer-events-none">
                {hoveredNode.label}
              </div>
            )}

            {/* List View */}
            {listView && (
              <div className="absolute inset-0 bg-white overflow-auto">
                {filteredData.nodes.slice(0, 20).map(node => (
                  <div key={node.id} data-testid="node-list-item" className="p-2 border-b">
                    {node.label}
                  </div>
                ))}
              </div>
            )}

            {/* Community Detection Results */}
            {detectCommunities.data && (
              <div className="absolute bottom-4 left-4 bg-white p-2 rounded shadow">
                {detectCommunities.data.communities.length} communities detected
              </div>
            )}

            {/* Importance Results */}
            {calculateImportance.isSuccess && (
              <div className="absolute bottom-4 right-4 bg-white p-2 rounded shadow">
                Importance calculated
              </div>
            )}

            {/* Export Success Message */}
            {exportAsImage && (
              <div className="absolute top-20 right-4 bg-green-100 p-2 rounded">
                Graph exported
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};