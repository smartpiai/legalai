/**
 * Report Service
 * API client for report generation functionality
 */

import apiClient from './api';

interface ReportGenerationRequest {
  templateId: string;
  parameters: Record<string, any>;
  format: string;
  name?: string;
  includeCharts?: boolean;
}

interface ScheduleReportRequest {
  templateId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
}

interface ShareReportRequest {
  reportId: string;
  emails: string[];
}

export const reportService = {
  /**
   * Get available report templates
   */
  async getReportTemplates(params?: { search?: string; category?: string }) {
    const response = await apiClient.get('/reports/templates', { params });
    return response.data;
  },

  /**
   * Generate a new report
   */
  async generateReport(request: ReportGenerationRequest) {
    const response = await apiClient.post('/reports/generate', request);
    return response.data;
  },

  /**
   * Get report generation history
   */
  async getReportHistory() {
    const response = await apiClient.get('/reports/history');
    return response.data;
  },

  /**
   * Schedule a recurring report
   */
  async scheduleReport(request: ScheduleReportRequest) {
    const response = await apiClient.post('/reports/schedule', request);
    return response.data;
  },

  /**
   * Cancel a scheduled report
   */
  async cancelScheduledReport(scheduleId: string) {
    const response = await apiClient.delete(`/reports/schedule/${scheduleId}`);
    return response.data;
  },

  /**
   * Download a completed report
   */
  async downloadReport(reportId: string) {
    const response = await apiClient.get(`/reports/${reportId}/download`, {
      responseType: 'blob',
    });
    
    // Create download link
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return response.data;
  },

  /**
   * Share a report via email
   */
  async shareReport(request: ShareReportRequest) {
    const response = await apiClient.post('/reports/share', request);
    return response.data;
  },

  /**
   * Get report generation status
   */
  async getReportStatus(reportId: string) {
    const response = await apiClient.get(`/reports/${reportId}/status`);
    return response.data;
  },

  /**
   * Delete a report
   */
  async deleteReport(reportId: string) {
    const response = await apiClient.delete(`/reports/${reportId}`);
    return response.data;
  },

  /**
   * Duplicate a report configuration
   */
  async duplicateReport(reportId: string) {
    const response = await apiClient.post(`/reports/${reportId}/duplicate`);
    return response.data;
  },

  /**
   * Get report generation metrics and analytics
   */
  async getReportMetrics() {
    const response = await apiClient.get('/reports/metrics');
    return response.data;
  },

  /**
   * Export graph data
   */
  async exportGraph(params: { format: string; includeProperties?: boolean }) {
    const response = await apiClient.get('/reports/export/graph', { params });
    return response.data;
  },
};