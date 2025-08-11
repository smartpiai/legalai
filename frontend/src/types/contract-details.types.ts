/**
 * TypeScript interfaces for Contract Details Page
 * Comprehensive type definitions for contract information display
 */

import { Contract, ContractDocument, ContractVersion } from '@/services/contract.service';

// Extended contract interface with metadata
export interface ContractDetails extends Contract {
  currency?: string;
  metadata: {
    auto_renewal?: boolean;
    renewal_notice_period?: number;
    governing_law?: string;
    risk_score?: number;
    compliance_status?: 'compliant' | 'non_compliant' | 'under_review';
    owner?: string;
    approvers?: string[];
    next_renewal_date?: string;
    canEdit?: boolean;
    canDelete?: boolean;
    canApprove?: boolean;
    canArchive?: boolean;
  };
}

// Activity timeline interfaces
export interface ContractActivity {
  date: string;
  event: string;
  user: string;
  details: string;
  type?: 'created' | 'updated' | 'approved' | 'rejected' | 'activated' | 'expired' | 'renewed' | 'archived';
  metadata?: Record<string, any>;
}

// Obligation management interfaces
export interface ContractObligation {
  id: string;
  type: 'payment' | 'delivery' | 'review' | 'renewal' | 'termination' | 'compliance' | 'other';
  description: string;
  due_date: string;
  status: 'completed' | 'pending' | 'overdue' | 'upcoming' | 'cancelled';
  responsible_party: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Risk assessment interfaces
export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category?: 'financial' | 'legal' | 'operational' | 'compliance' | 'reputation';
  mitigation?: string;
  impact_score?: number;
  probability_score?: number;
}

export interface ContractRiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number; // 0-100
  risk_factors: RiskFactor[];
  last_assessed?: string;
  assessed_by?: string;
  recommendations?: string[];
}

// Comment system interfaces
export interface ContractComment {
  id: string;
  user: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  mentions?: string[];
  attachments?: CommentAttachment[];
  replies?: ContractComment[];
  is_internal?: boolean;
  is_edited?: boolean;
}

export interface CommentAttachment {
  id: string;
  filename: string;
  size: number;
  type: string;
  url?: string;
}

export interface NewCommentData {
  content: string;
  mentions?: string[];
  attachments?: File[];
  is_internal?: boolean;
  parent_id?: string; // For replies
}

// Document extended interfaces
export interface ContractDocumentDetails extends ContractDocument {
  type?: 'contract' | 'amendment' | 'attachment' | 'signature';
  status?: 'draft' | 'final' | 'signed' | 'archived';
  version?: string;
  checksum?: string;
  signed_by?: string[];
  signed_at?: string;
}

// Version comparison interfaces
export interface VersionDifference {
  type: 'added' | 'removed' | 'modified';
  path: string;
  old_value?: any;
  new_value?: any;
  description?: string;
}

export interface VersionComparison {
  version1: string;
  version2: string;
  differences: VersionDifference[];
  summary?: {
    additions: number;
    modifications: number;
    deletions: number;
  };
}

// Notification interfaces
export interface ContractNotification {
  id: string;
  type: 'reminder' | 'approval_request' | 'status_change' | 'comment' | 'obligation_due';
  message: string;
  created_at: string;
  read: boolean;
  action_url?: string;
  metadata?: Record<string, any>;
}

// Tab content interfaces
export type TabId = 'overview' | 'documents' | 'activity' | 'obligations' | 'risks' | 'comments';

export interface TabContent {
  id: TabId;
  label: string;
  icon?: React.ComponentType<any>;
  badge?: number | string;
  disabled?: boolean;
}

// Related contracts interface
export interface RelatedContract {
  id: string;
  title: string;
  contract_type: string;
  status: string;
  relationship_type: 'amendment' | 'renewal' | 'master_agreement' | 'subsidiary' | 'similar';
  relationship_description?: string;
}

// Actions and permissions
export interface ContractAction {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  permission?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
}

// Loading states
export interface LoadingState {
  contract: boolean;
  documents: boolean;
  activity: boolean;
  obligations: boolean;
  risks: boolean;
  comments: boolean;
  versions: boolean;
  related: boolean;
}

// Error states
export interface ErrorState {
  contract?: string;
  documents?: string;
  activity?: string;
  obligations?: string;
  risks?: string;
  comments?: string;
  versions?: string;
  related?: string;
}

// Component state interfaces
export interface ContractDetailsState {
  contract: ContractDetails | null;
  documents: ContractDocumentDetails[];
  activity: ContractActivity[];
  obligations: ContractObligation[];
  riskAssessment: ContractRiskAssessment | null;
  comments: ContractComment[];
  versions: ContractVersion[];
  relatedContracts: RelatedContract[];
  activeTab: TabId;
  loading: LoadingState;
  errors: ErrorState;
  isDeleteDialogOpen: boolean;
  isShareDialogOpen: boolean;
  isSidebarCollapsed: boolean;
}

// API response interfaces
export interface ContractDetailsResponse {
  contract: ContractDetails;
  documents: ContractDocumentDetails[];
  activity: ContractActivity[];
  obligations: ContractObligation[];
  risk_assessment: ContractRiskAssessment;
  comments: ContractComment[];
  versions: ContractVersion[];
  related_contracts: RelatedContract[];
  permissions: {
    can_edit: boolean;
    can_delete: boolean;
    can_approve: boolean;
    can_archive: boolean;
    can_share: boolean;
    can_comment: boolean;
  };
}

// Share functionality interfaces
export interface ShareOptions {
  email?: string[];
  link_expiry?: string;
  permissions?: 'read' | 'comment' | 'edit';
  include_documents?: boolean;
  message?: string;
}

export interface ShareResponse {
  share_url?: string;
  expires_at?: string;
  recipients_notified?: string[];
}

// Archive functionality
export interface ArchiveOptions {
  reason?: string;
  retain_access?: boolean;
  notify_stakeholders?: boolean;
}

// Export functionality
export interface ExportOptions {
  format: 'pdf' | 'docx' | 'json';
  include_documents?: boolean;
  include_history?: boolean;
  include_comments?: boolean;
  template?: string;
}

// Utility types
export type ContractStatus = 'draft' | 'in_review' | 'approved' | 'active' | 'expired' | 'terminated' | 'archived';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ActionHandler = (contractId: string, data?: any) => Promise<void> | void;

// Status configuration
export interface StatusConfig {
  status: ContractStatus;
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ComponentType<any>;
}

// Risk level configuration
export interface RiskLevelConfig {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  threshold: { min: number; max: number };
}

// Form interfaces for actions
export interface EditContractData {
  title?: string;
  description?: string;
  value?: number;
  start_date?: string;
  end_date?: string;
  // ... other editable fields
}

export interface ApprovalData {
  decision: 'approve' | 'reject';
  notes?: string;
  conditions?: string[];
}

// Hooks return types
export interface UseContractDetailsReturn {
  state: ContractDetailsState;
  actions: {
    setActiveTab: (tab: TabId) => void;
    refreshContract: () => Promise<void>;
    handleEdit: () => void;
    handleDownload: () => Promise<void>;
    handleShare: (options: ShareOptions) => Promise<void>;
    handleArchive: (options?: ArchiveOptions) => Promise<void>;
    handleDelete: () => Promise<void>;
    handleAddComment: (comment: NewCommentData) => Promise<void>;
    handleUpdateObligation: (obligationId: string, data: Partial<ContractObligation>) => Promise<void>;
    toggleSidebar: () => void;
  };
  loading: boolean;
  error: string | null;
}

// Event handler types
export type ContractEventHandler<T = any> = (data: T) => void | Promise<void>;

// Constants for configuration
export const CONTRACT_STATUSES: StatusConfig[] = [
  { status: 'draft', label: 'Draft', color: 'text-gray-800', bgColor: 'bg-gray-100' },
  { status: 'in_review', label: 'In Review', color: 'text-blue-800', bgColor: 'bg-blue-100' },
  { status: 'approved', label: 'Approved', color: 'text-purple-800', bgColor: 'bg-purple-100' },
  { status: 'active', label: 'Active', color: 'text-green-800', bgColor: 'bg-green-100' },
  { status: 'expired', label: 'Expired', color: 'text-orange-800', bgColor: 'bg-orange-100' },
  { status: 'terminated', label: 'Terminated', color: 'text-red-800', bgColor: 'bg-red-100' },
  { status: 'archived', label: 'Archived', color: 'text-gray-800', bgColor: 'bg-gray-50' },
];

export const RISK_LEVELS: RiskLevelConfig[] = [
  { level: 'low', label: 'Low Risk', color: 'text-green-600', bgColor: 'bg-green-100', threshold: { min: 0, max: 33 } },
  { level: 'medium', label: 'Medium Risk', color: 'text-yellow-600', bgColor: 'bg-yellow-100', threshold: { min: 34, max: 66 } },
  { level: 'high', label: 'High Risk', color: 'text-orange-600', bgColor: 'bg-orange-100', threshold: { min: 67, max: 85 } },
  { level: 'critical', label: 'Critical Risk', color: 'text-red-600', bgColor: 'bg-red-100', threshold: { min: 86, max: 100 } },
];

export const DEFAULT_TABS: TabContent[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
  { id: 'obligations', label: 'Obligations' },
  { id: 'risks', label: 'Risks' },
  { id: 'comments', label: 'Comments' },
];