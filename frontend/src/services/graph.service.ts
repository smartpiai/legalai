/**
 * Graph Service - Neo4j Graph API Integration
 * Provides graph data operations and analytics
 */

import { apiClient } from './apiClient';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, any>;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStatistics {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: Record<string, number>;
  relationshipTypes: Record<string, number>;
}

interface PathResult {
  path: string[];
  distance: number;
}

interface Community {
  id: string;
  nodes: string[];
  color: string;
}

interface NodeImportance {
  scores: Record<string, number>;
  algorithm: string;
}

export class GraphService {
  private api: AxiosInstance;

  constructor() {
    apiClient = // Using centralized apiClient;

    // Add auth headers
    apiClient.interceptors.request.use((config) => {
      const state = useAuthStore.getState();
      const token = state.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (state.user?.tenant_id) {
        config.headers['X-Tenant-ID'] = state.user.tenant_id;
      }
      return config;
    });
  }

  async getGraphData(contractId?: string): Promise<GraphData> {
    const response = await apiClient.get('/graph/data', {
      params: { contractId },
    });
    return response.data;
  }

  async searchNodes(params: { query: string; types?: string[] }): Promise<{ nodes: GraphNode[] }> {
    const response = await apiClient.post('/graph/search', params);
    return response.data;
  }

  async getNodeDetails(nodeId: string): Promise<GraphNode & { relationships: GraphLink[] }> {
    const response = await apiClient.get(`/graph/nodes/${nodeId}`);
    return response.data;
  }

  async getRelatedNodes(nodeId: string, depth: number = 1): Promise<GraphData> {
    const response = await apiClient.get(`/graph/nodes/${nodeId}/related`, {
      params: { depth },
    });
    return response.data;
  }

  async runCypherQuery(query: string): Promise<GraphData> {
    const response = await apiClient.post('/graph/cypher', { query });
    return response.data;
  }

  async getGraphStatistics(): Promise<GraphStatistics> {
    const response = await apiClient.get('/graph/statistics');
    return response.data;
  }

  async exportGraph(params: { format: string; includeProperties?: boolean }): Promise<{ url: string }> {
    const response = await apiClient.post('/graph/export', params);
    return response.data;
  }

  async getShortestPath(sourceId: string, targetId: string): Promise<PathResult | null> {
    const response = await apiClient.get('/graph/path', {
      params: { source: sourceId, target: targetId },
    });
    return response.data;
  }

  async getCommunities(): Promise<{ communities: Community[] }> {
    const response = await apiClient.get('/graph/communities');
    return response.data;
  }

  async getNodeImportance(algorithm: string = 'pagerank'): Promise<NodeImportance> {
    const response = await apiClient.get('/graph/importance', {
      params: { algorithm },
    });
    return response.data;
  }
}

export const graphService = new GraphService();