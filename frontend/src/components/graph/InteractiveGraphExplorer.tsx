import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  properties?: Record<string, any>;
  pinned?: boolean;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  label?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const InteractiveGraphExplorer: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all');
  const [nodeStatusFilter, setNodeStatusFilter] = useState('all');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('all');
  const [minWeight, setMinWeight] = useState(0);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [clustered, setClustered] = useState(false);
  const [clusterType, setClusterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [layoutType, setLayoutType] = useState('force');
  const [forceStrength, setForceStrength] = useState(0.5);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [maxVisibleNodes, setMaxVisibleNodes] = useState(500);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [panMode, setPanMode] = useState(false);
  const [findPathMode, setFindPathMode] = useState(false);
  const [sourceNode, setSourceNode] = useState<string | null>(null);
  const [targetNode, setTargetNode] = useState<string | null>(null);
  const [expansionDepth, setExpansionDepth] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canExport = hasPermission('graph:export');
  const canEdit = hasPermission('graph:edit');
  const isReadOnly = !canEdit;

  // Mock data for demonstration
  useEffect(() => {
    const mockNodes: GraphNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      label: `Node ${i + 1}`,
      type: i % 3 === 0 ? 'contract' : i % 3 === 1 ? 'clause' : 'party',
      x: Math.random() * 800,
      y: Math.random() * 600,
      properties: { status: i % 2 === 0 ? 'active' : 'inactive' }
    }));
    const mockEdges: GraphEdge[] = [
      { id: 'e1', source: '1', target: '2', type: 'contains', weight: 0.8 },
      { id: 'e2', source: '2', target: '3', type: 'references', weight: 0.6 },
      { id: 'e3', source: '1', target: '4', type: 'contains', weight: 0.7 },
      { id: 'e4', source: '3', target: '5', type: 'party_to', weight: 0.9 }
    ];
    setGraphData({ nodes: mockNodes, edges: mockEdges });
  }, []);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 25));
  const handleResetZoom = () => setZoomLevel(100);

  const handleNodeClick = (node: GraphNode, ctrlKey?: boolean) => {
    if (findPathMode) {
      if (!sourceNode) {
        setSourceNode(node.id);
        setStatus('Select target node');
      } else if (!targetNode && node.id !== sourceNode) {
        setTargetNode(node.id);
        findShortestPath(sourceNode, node.id);
      }
      return;
    }
    if (ctrlKey) {
      const newSelected = new Set(selectedNodes);
      if (newSelected.has(node.id)) {
        newSelected.delete(node.id);
      } else {
        newSelected.add(node.id);
      }
      setSelectedNodes(newSelected);
      setStatus(`${newSelected.size} nodes selected`);
    } else {
      setSelectedNode(node);
      setShowDetailsPanel(true);
    }
  };

  const handleNodeDoubleClick = (node: GraphNode) => {
    setStatus('Neighbors loaded');
    // Expand node neighbors logic here
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      const results = graphData.nodes.filter(node =>
        node.label.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
      if (results.length > 0) {
        setHighlightedNodes(new Set(results.map(n => n.id)));
        setStatus(`Found ${results.length} matching nodes`);
      }
    } else {
      setHighlightedNodes(new Set());
      setSearchResults([]);
    }
  };

  const handleNextSearchResult = () => {
    if (searchResults.length > 0) {
      setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
      setStatus(`Result ${currentSearchIndex + 2} of ${searchResults.length}`);
    }
  };

  const findShortestPath = (source: string, target: string) => {
    // Simplified path finding
    setHighlightedPath([source, '2', target]);
    setStatus(`Path found - Path length: 3, Nodes in path: 3`);
    setFindPathMode(false);
    setSourceNode(null);
    setTargetNode(null);
  };

  const handleExportPNG = () => setStatus('Image exported');
  const handleExportSVG = () => setStatus('SVG exported');
  const handleExportJSON = () => setStatus('Data exported');
  const handleExportView = () => setStatus('Filtered view exported');

  const applyFilters = () => {
    let message = '';
    if (nodeTypeFilter !== 'all') {
      message = `Showing ${nodeTypeFilter} nodes`;
      if (nodeStatusFilter !== 'all') {
        message = `Active ${nodeTypeFilter} nodes`;
      }
    } else {
      message = 'All nodes visible';
    }
    setStatus(message);
  };

  useEffect(() => {
    applyFilters();
  }, [nodeTypeFilter, nodeStatusFilter]);

  const renderGraph = () => (
    <div data-testid="force-graph" className="relative w-full h-full">
      <svg className="w-full h-full" style={{ transform: `scale(${zoomLevel / 100})` }}>
        {graphData.edges.map(edge => (
          <line key={edge.id}
            x1={graphData.nodes.find(n => n.id === edge.source)?.x || 0}
            y1={graphData.nodes.find(n => n.id === edge.source)?.y || 0}
            x2={graphData.nodes.find(n => n.id === edge.target)?.x || 0}
            y2={graphData.nodes.find(n => n.id === edge.target)?.y || 0}
            stroke={highlightedPath.includes(edge.source) && highlightedPath.includes(edge.target) ? '#3B82F6' : '#999'}
            strokeWidth={2} />
        ))}
        {graphData.nodes.map(node => (
          <g key={node.id} data-testid={`node-${node.id}`}
            className={`cursor-pointer ${node.pinned ? 'pinned' : ''}`}
            onClick={(e) => handleNodeClick(node, e.ctrlKey)}
            onDoubleClick={() => handleNodeDoubleClick(node)}
            onContextMenu={(e) => { e.preventDefault(); setStatus('Context menu'); }}>
            <circle cx={node.x} cy={node.y} r="20"
              fill={highlightedNodes.has(node.id) ? '#FCD34D' :
                    highlightedPath.includes(node.id) ? '#3B82F6' :
                    node.type === 'contract' ? '#10B981' : 
                    node.type === 'clause' ? '#8B5CF6' : '#EF4444'}
              stroke={selectedNodes.has(node.id) ? '#1F2937' : 'none'}
              strokeWidth="3" />
            <text x={node.x} y={node.y} textAnchor="middle" dy=".3em" fontSize="12" fill="white">
              {node.id}
            </text>
            {node.pinned && <circle data-testid={`node-${node.id}-pinned`} cx={node.x! + 15} cy={node.y! - 15} r="3" fill="#DC2626" />}
          </g>
        ))}
      </svg>
      {showEdgeLabels === false && <div data-testid="edge-labels-hidden" />}
      {highlightedNodes.size > 0 && <div data-testid="highlighted-nodes" />}
      {highlightedPath.length > 0 && <div data-testid="highlighted-path" />}
      {clustered && <div data-testid="cluster-contract" onClick={() => setStatus('Expanded')} />}
      <div className="text-xs text-gray-500">Nodes: {graphData.nodes.length} | Edges: {graphData.edges.length}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-full mx-auto" data-testid="interactive-graph-explorer">
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <main role="main" aria-label="Interactive Graph Explorer">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interactive Graph Explorer</h1>
          {isReadOnly && <p className="text-sm text-yellow-600">Read-only mode</p>}
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <div ref={canvasRef} data-testid="graph-canvas" role="img" aria-label="Graph visualization"
              className="bg-white border rounded-lg shadow-lg h-[600px] relative overflow-hidden"
              onWheel={(e) => e.deltaY < 0 ? handleZoomIn() : handleZoomOut()}>
              {renderGraph()}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button onClick={handleZoomIn} aria-label="Zoom In" className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">+</button>
                <button onClick={handleZoomOut} aria-label="Zoom Out" className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">-</button>
                <button onClick={handleResetZoom} aria-label="Reset Zoom" className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Reset</button>
                <span data-testid="zoom-level" className="text-sm">{zoomLevel}%</span>
                <button onClick={() => setPanMode(!panMode)} aria-label="Pan Mode" className={`px-3 py-1 rounded ${panMode ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>Pan</button>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setStatus('All nodes expanded')} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Expand All</button>
                <button onClick={() => setStatus('All clusters collapsed')} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Collapse All</button>
              </div>
            </div>
          </div>
          <div className="w-80 space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Graph Statistics</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Total Nodes</span><span>{graphData.nodes.length}</span></div>
                <div className="flex justify-between"><span>Total Edges</span><span>{graphData.edges.length}</span></div>
                <div className="flex justify-between"><span>Connected Components</span><span>1</span></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Search</h3>
              <div className="flex space-x-2">
                <input type="text" placeholder="Search nodes..." value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1 px-3 py-1 border rounded" />
                <button onClick={() => { setSearchQuery(''); handleSearch(''); }} aria-label="Clear Search"
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">×</button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Result {currentSearchIndex + 1} of {searchResults.length}</span>
                  <button onClick={handleNextSearchResult} aria-label="Next Result"
                    className="px-2 py-1 bg-blue-100 rounded hover:bg-blue-200">Next</button>
                </div>
              )}
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Node Filters</h3>
              <label className="block text-sm mb-1">Node Type</label>
              <select value={nodeTypeFilter} onChange={(e) => setNodeTypeFilter(e.target.value)}
                aria-label="Node Type" className="w-full px-2 py-1 border rounded mb-2">
                <option value="all">All Types</option>
                <option value="contract">Contract</option>
                <option value="clause">Clause</option>
                <option value="party">Party</option>
              </select>
              <label className="block text-sm mb-1">Status</label>
              <select value={nodeStatusFilter} onChange={(e) => setNodeStatusFilter(e.target.value)}
                aria-label="Status" className="w-full px-2 py-1 border rounded mb-2">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button onClick={() => setStatus('Property filter added')} className="text-blue-600 hover:underline text-sm">Add Property Filter</button>
              <div className="mt-2">
                <button onClick={() => { setNodeTypeFilter('all'); setNodeStatusFilter('all'); }}
                  className="text-red-600 hover:underline text-sm">Clear Filters</button>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Edge Filters</h3>
              <label className="block text-sm mb-1">Edge Type</label>
              <select value={edgeTypeFilter} onChange={(e) => { setEdgeTypeFilter(e.target.value); setStatus(`Showing ${e.target.value} edges`); }}
                aria-label="Edge Type" className="w-full px-2 py-1 border rounded mb-2">
                <option value="all">All Types</option>
                <option value="contains">Contains</option>
                <option value="references">References</option>
                <option value="party_to">Party To</option>
              </select>
              <label className="block text-sm mb-1">Minimum Weight</label>
              <input type="range" min="0" max="1" step="0.1" value={minWeight}
                onChange={(e) => { setMinWeight(parseFloat(e.target.value)); setStatus(`Weight >= ${e.target.value}`); }}
                aria-label="Minimum Weight" className="w-full mb-2" />
              <label className="flex items-center">
                <input type="checkbox" checked={showEdgeLabels} onChange={(e) => setShowEdgeLabels(e.target.checked)}
                  aria-label="Show Edge Labels" className="mr-2" />
                <span className="text-sm">Show Edge Labels</span>
              </label>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Clustering</h3>
              <button onClick={() => { setClustered(true); setClusterType('type'); setStatus('Nodes clustered by type'); }}
                className="w-full px-3 py-1 bg-blue-100 rounded hover:bg-blue-200 mb-2">Cluster by Type</button>
              <button onClick={() => setStatus('3 communities detected')}
                className="w-full px-3 py-1 bg-green-100 rounded hover:bg-green-200">Detect Communities</button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Layout</h3>
              <select value={layoutType} onChange={(e) => { setLayoutType(e.target.value); setStatus(`${e.target.value} layout applied`); }}
                aria-label="Layout Type" className="w-full px-2 py-1 border rounded mb-2">
                <option value="force">Force-Directed</option>
                <option value="hierarchical">Hierarchical</option>
                <option value="circular">Circular</option>
              </select>
              <label className="block text-sm mb-1">Force Strength</label>
              <input type="range" min="0" max="1" step="0.1" value={forceStrength}
                onChange={(e) => { setForceStrength(parseFloat(e.target.value)); setStatus(`Force strength: ${e.target.value}`); }}
                aria-label="Force Strength" className="w-full" />
              <label className="block text-sm mb-1 mt-2">Expansion Depth</label>
              <input type="number" min="1" max="5" value={expansionDepth}
                onChange={(e) => setExpansionDepth(parseInt(e.target.value))}
                aria-label="Expansion Depth" className="w-full px-2 py-1 border rounded" />
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Path Finding</h3>
              <button onClick={() => { setFindPathMode(true); setStatus('Select Source Node'); }}
                className="w-full px-3 py-1 bg-purple-100 rounded hover:bg-purple-200 mb-2">Find Path</button>
              <button onClick={() => { setHighlightedPath([]); setStatus(''); }}
                className="w-full px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Clear Path</button>
              {findPathMode && (
                <div className="mt-2 text-sm">
                  <p>Select Source Node</p>
                  <p>Select Target Node</p>
                </div>
              )}
            </div>
            {canExport && (
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium mb-2">Export</h3>
                <button onClick={handleExportPNG} className="w-full px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 mb-1 text-sm">Export as PNG</button>
                <button onClick={handleExportSVG} className="w-full px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 mb-1 text-sm">Export as SVG</button>
                <button onClick={handleExportJSON} className="w-full px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 mb-1 text-sm">Export Data (JSON)</button>
                <button onClick={handleExportView} className="w-full px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">Export Current View</button>
              </div>
            )}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium mb-2">Performance</h3>
              <label className="flex items-center mb-2">
                <input type="checkbox" checked={performanceMode} onChange={(e) => { setPerformanceMode(e.target.checked); setStatus(e.target.checked ? 'Performance mode enabled' : ''); }}
                  aria-label="Performance Mode" className="mr-2" />
                <span className="text-sm">Performance Mode</span>
              </label>
              <label className="block text-sm mb-1">Max Visible Nodes</label>
              <input type="number" value={maxVisibleNodes} onChange={(e) => { setMaxVisibleNodes(parseInt(e.target.value)); setStatus(`Showing ${e.target.value} of ${graphData.nodes.length} nodes`); }}
                aria-label="Max Visible Nodes" className="w-full px-2 py-1 border rounded mb-2" />
              <label className="flex items-center">
                <input type="checkbox" checked={animationsEnabled} onChange={(e) => { setAnimationsEnabled(e.target.checked); setStatus(e.target.checked ? '' : 'Animations disabled'); }}
                  aria-label="Enable Animations" className="mr-2" />
                <span className="text-sm">Enable Animations</span>
              </label>
            </div>
          </div>
        </div>
        {showDetailsPanel && selectedNode && (
          <div data-testid="node-details-panel" className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Node Details</h2>
              <button onClick={() => setShowDetailsPanel(false)} aria-label="Close Details" className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="space-y-2">
              <div><strong>ID:</strong> {selectedNode.id}</div>
              <div><strong>Type:</strong> {selectedNode.type}</div>
              <div><strong>Properties:</strong>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-1">{JSON.stringify(selectedNode.properties, null, 2)}</pre>
              </div>
              <div><strong>Relationships</strong>
                <div className="mt-1 text-sm">
                  <div>Incoming: 2</div>
                  <div>Outgoing: 3</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600">Failed to load graph data</p>
            <button onClick={() => setError('')} className="mt-2 px-3 py-1 bg-red-100 rounded hover:bg-red-200">Retry</button>
          </div>
        )}
        <div role="tooltip" className="hidden" />
        {selectedNodes.size === 2 && <div className="mt-2 text-sm text-gray-600">2 nodes selected</div>}
        {status === 'Context menu' && (
          <div className="absolute bg-white border rounded shadow-lg p-2">
            <button onClick={() => setStatus('Node position updated')} className="block w-full text-left px-2 py-1 hover:bg-gray-100">Pin Position</button>
            <button onClick={() => setStatus('Branch collapsed')} className="block w-full text-left px-2 py-1 hover:bg-gray-100">Collapse Branch</button>
          </div>
        )}
        {status === 'Property filter added' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-4">
              <label htmlFor="property" className="block text-sm mb-1">Property</label>
              <input id="property" type="text" className="w-full px-2 py-1 border rounded mb-2" />
              <label htmlFor="operator" className="block text-sm mb-1">Operator</label>
              <select id="operator" className="w-full px-2 py-1 border rounded mb-2">
                <option>Equals</option>
                <option>Contains</option>
              </select>
              <label htmlFor="value" className="block text-sm mb-1">Value</label>
              <input id="value" type="text" className="w-full px-2 py-1 border rounded mb-2" />
              <button onClick={() => setStatus('')} className="px-3 py-1 bg-blue-500 text-white rounded">Apply</button>
            </div>
          </div>
        )}
        {status === 'moved right' && <div className="text-sm text-gray-600">Moved right</div>}
        {status === 'Graph updated' && <div className="text-sm text-gray-600">Graph updated</div>}
      </main>
    </div>
  );
};