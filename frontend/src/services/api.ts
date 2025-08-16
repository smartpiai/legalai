import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Contract endpoints
  async uploadContract(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.client.post('/contracts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async getContract(id: string) {
    return this.client.get(`/contracts/${id}`);
  }

  async analyzeContract(id: string, analysisType: string = 'full') {
    return this.client.post(`/contracts/${id}/analyze`, { analysis_type: analysisType });
  }

  // Analysis endpoints
  async getAnalysis(id: string) {
    return this.client.get(`/analysis/${id}`);
  }

  async queryDocuments(query: string, filters?: any) {
    return this.client.post('/analysis/query', { query, filters });
  }

  // Generic HTTP methods for component usage
  async get(url: string, config?: AxiosRequestConfig) {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put(url, data, config);
  }

  async patch(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch(url, data, config);
  }

  async delete(url: string, config?: AxiosRequestConfig) {
    return this.client.delete(url, config);
  }

  // Add more endpoints as needed
}

export default new ApiService();
