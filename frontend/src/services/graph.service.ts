/**
 * Graph Service - Neo4j Graph API Integration
 * Provides graph data operations and analytics
 */

import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/auth';

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
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
    });

    // Add auth headers
    this.api.interceptors.request.use((config) => {
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
    const response = await this.api.get('/api/v1/graph/data', {
      params: { contractId },
    });
    return response.data;
  }

  async searchNodes(params: { query: string; types?: string[] }): Promise<{ nodes: GraphNode[] }> {
    const response = await this.api.post('/api/v1/graph/search', params);
    return response.data;
  }

  async getNodeDetails(nodeId: string): Promise<GraphNode & { relationships: GraphLink[] }> {
    const response = await this.api.get(`/api/v1/graph/nodes/${nodeId}`);
    return response.data;
  }

  async getRelatedNodes(nodeId: string, depth: number = 1): Promise<GraphData> {
    const response = await this.api.get(`/api/v1/graph/nodes/${nodeId}/related`, {
      params: { depth },
    });
    return response.data;
  }

  async runCypherQuery(query: string): Promise<GraphData> {
    const response = await this.api.post('/api/v1/graph/cypher', { query });
    return response.data;
  }

  async getGraphStatistics(): Promise<GraphStatistics> {
    const response = await this.api.get('/api/v1/graph/statistics');
    return response.data;
  }

  async exportGraph(params: { format: string; includeProperties?: boolean }): Promise<{ url: string }> {
    const response = await this.api.post('/api/v1/graph/export', params);
    return response.data;
  }

  async getShortestPath(sourceId: string, targetId: string): Promise<PathResult | null> {
    const response = await this.api.get('/api/v1/graph/path', {
      params: { source: sourceId, target: targetId },
    });
    return response.data;
  }

  async getCommunities(): Promise<{ communities: Community[] }> {
    const response = await this.api.get('/api/v1/graph/communities');
    return response.data;
  }

  async getNodeImportance(algorithm: string = 'pagerank'): Promise<NodeImportance> {
    const response = await this.api.get('/api/v1/graph/importance', {
      params: { algorithm },
    });
    return response.data;
  }
}

export const graphService = new GraphService();