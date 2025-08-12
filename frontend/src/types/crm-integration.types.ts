/**
 * TypeScript interfaces for CRM Integration
 * Defines all types used in the CRM integration service
 */

// Core authentication types
export interface CRMAuthResponse {
  auth_url: string;
  state: string;
}

export interface CRMTokenResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  instance_url?: string;
  expires_in?: number;
}

// Salesforce types
export interface SalesforceOpportunity {
  id: string;
  name: string;
  amount: number;
  stage: string;
  close_date: string;
  probability?: number;
  account: { id: string; name: string };
  quotes?: Array<{ id: string; total_price: number; status: string }>;
}

export interface SalesforceOpportunityFilters {
  stage?: string;
  has_approved_quote?: boolean;
  amount_min?: number;
  amount_max?: number;
  close_date_from?: string;
  close_date_to?: string;
}

export interface SalesforceSync {
  opportunities_synced: number;
  quotes_synced: number;
  contracts_created: number;
  last_sync: string;
}

export interface ProductMapping {
  product_id: string;
  product_name: string;
  template_id: string;
  template_name: string;
  variables: string[];
}

export interface ProductMappingResponse {
  mappings: ProductMapping[];
  total_mappings: number;
}

export interface PricingRule {
  id: string;
  name: string;
  condition: string;
  discount_percent: number;
  active: boolean;
}

export interface PricingRulesResponse {
  rules: PricingRule[];
  total_rules: number;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  steps: Array<{ step: number; role: string; required: boolean }>;
}

export interface ApprovalWorkflowResponse {
  workflows: ApprovalWorkflow[];
}

// HubSpot types
export interface HubSpotDeal {
  id: string;
  dealname: string;
  amount: number;
  dealstage: string;
  probability: number;
  closedate: string;
  pipeline: string;
  associatedcompanyids: string[];
}

export interface HubSpotDealsResponse {
  deals: HubSpotDeal[];
  total?: number;
}

export interface HubSpotDealFilters {
  pipeline?: string;
  stage?: string;
  amount_min?: number;
  amount_max?: number;
}

export interface HubSpotContact {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  company: string;
  jobtitle: string;
  lifecyclestage: string;
}

export interface HubSpotContactsResponse {
  contacts: HubSpotContact[];
  total?: number;
}

export interface HubSpotContactFilters {
  lifecycle_stage?: string;
  company?: string;
}

export interface HubSpotActivity {
  id: string;
  type: string;
  timestamp: string;
  engagement: { subject: string; body: string };
  associations: { dealIds: string[]; contactIds: string[] };
}

export interface HubSpotActivitiesResponse {
  activities: HubSpotActivity[];
}

export interface HubSpotActivityFilters {
  deal_id?: string;
  contact_id?: string;
  activity_types?: string[];
  date_from?: string;
  date_to?: string;
}

export interface HubSpotCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  recipients: number;
  opens: number;
  clicks: number;
  sent_at: string;
}

export interface HubSpotCampaignsResponse {
  campaigns: HubSpotCampaign[];
}

export interface HubSpotTriggerData {
  name: string;
  trigger_type: string;
  conditions: Array<{ property: string; operator: string; value: string }>;
  actions: Array<{ type: string; template_id?: string; stage?: string }>;
}

export interface HubSpotTrigger extends HubSpotTriggerData {
  id: string;
  created_at: string;
}

// Microsoft Dynamics 365 types
export interface Dynamics365Account {
  accountid: string;
  name: string;
  revenue: number;
  industrycode: string;
  address1_country: string;
  statuscode: number;
  customertypecode: number;
}

export interface Dynamics365AccountsResponse {
  accounts: Dynamics365Account[];
  total?: number;
}

export interface Dynamics365AccountFilters {
  industry?: string;
  status?: string;
  revenue_min?: number;
  revenue_max?: number;
}

export interface Dynamics365Lead {
  leadid: string;
  fullname: string;
  companyname: string;
  emailaddress1: string;
  statecode: number;
  statuscode: number;
  leadqualitycode: number;
  estimatedvalue: number;
}

export interface Dynamics365LeadsResponse {
  leads: Dynamics365Lead[];
  total?: number;
}

export interface Dynamics365LeadFilters {
  status?: string;
  quality?: string;
  value_min?: number;
  value_max?: number;
}

export interface Dynamics365Case {
  incidentid: string;
  title: string;
  description: string;
  prioritycode: number;
  statecode: number;
  statuscode: number;
  customerid: string;
  caseorigincode: number;
}

export interface Dynamics365CasesResponse {
  cases: Dynamics365Case[];
  total?: number;
}

export interface Dynamics365CaseFilters {
  status?: string;
  priority?: string;
  customer_id?: string;
}

export interface Dynamics365BusinessProcess {
  businessprocessflowinstanceid: string;
  bpf_name: string;
  activestageid: string;
  businessprocessflowdefinitionid: string;
  statecode: number;
  statuscode: number;
}

export interface Dynamics365BusinessProcessesResponse {
  processes: Dynamics365BusinessProcess[];
}

export interface PowerAutomateFlow {
  id: string;
  name: string;
  state: string;
  trigger: string;
  actions: Array<{ type: string; approvers?: string[]; recipients?: string[] }>;
}

export interface PowerAutomateFlowsResponse {
  flows: PowerAutomateFlow[];
}

// Pipeline synchronization types
export interface StageMapping {
  source_system: string;
  source_stage: string;
  target_system: string;
  target_stage: string;
  probability: number;
}

export interface PipelineStageMappingsResponse {
  stage_mappings: StageMapping[];
}

export interface ProbabilityCalculation {
  deal_id: string;
  base_probability: number;
  adjustments: Array<{ factor: string; adjustment: number }>;
  final_probability: number;
  confidence_score: number;
}

export interface ProbabilityCalculationRequest {
  historical_data?: boolean;
  external_factors?: boolean;
}

export interface PipelineForecast {
  period: string;
  total_pipeline: number;
  weighted_pipeline: number;
  closed_won: number;
  by_stage: Array<{ stage: string; amount: number; count: number }>;
  forecast_accuracy: number;
}

export interface PipelineForecastRequest {
  period: string;
  include_historical?: boolean;
}

export interface DealVelocity {
  average_days_in_pipeline: number;
  by_stage: Array<{ stage: string; average_days: number }>;
  trends: { velocity_change: string; bottleneck_stage: string };
}

export interface DealVelocityRequest {
  period: string;
}

export interface WinLossAnalysis {
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  win_rate: number;
  common_win_factors: Array<{ factor: string; frequency: number }>;
  common_loss_reasons: Array<{ reason: string; frequency: number }>;
}

export interface WinLossAnalysisRequest {
  period: string;
}

// Quote-to-contract types
export interface ContractGeneration {
  contract_id: string;
  quote_id: string;
  template_selected: string;
  variables_mapped: Record<string, any>;
  generation_status: string;
}

export interface ContractGenerationRequest {
  template_id: string;
  auto_populate?: boolean;
}

export interface QuoteVariableMapping {
  quote_id: string;
  template_id: string;
  variable_mappings: Array<{ quote_field: string; contract_variable: string }>;
  unmapped_fields: string[];
}

export interface TemplateSelection {
  recommended_template: string;
  confidence_score: number;
  selection_criteria: Array<{ criterion: string; value: string; weight: number }>;
  alternative_templates: Array<{ template_id: string; score: number }>;
}

export interface ApprovalRouting {
  approval_required: boolean;
  approval_chain: Array<{ step: number; approver: string; role: string }>;
  routing_reason: string;
  threshold_value: number;
}

export interface ESignatureWorkflow {
  contract_id: string;
  signature_request_id: string;
  signers: Array<{ email: string; name: string; role: string; signing_order: number }>;
  expected_completion: string;
}

// Revenue recognition types
export interface ContractValueTracking {
  total_contract_value: number;
  by_currency: Array<{ currency: string; amount: number }>;
  by_status: Array<{ status: string; amount: number }>;
  monthly_breakdown: Array<{ month: string; recognized: number; deferred: number }>;
}

export interface ContractValueTrackingRequest {
  period: string;
}

export interface RecognitionSchedule {
  contract_id: string;
  total_value: number;
  recognition_method: string;
  schedule_entries: Array<{ period: string; amount: number; status: string }>;
  milestones: Array<{ name: string; date: string; value: number }>;
}

export interface RecognitionScheduleRequest {
  method: string;
  include_milestones?: boolean;
}

export interface MilestoneRecognition {
  milestone_id: string;
  contract_id: string;
  name: string;
  planned_date: string;
  actual_date: string;
  planned_value: number;
  actual_value: number;
  recognition_status: string;
  variance_days: number;
}

export interface MilestoneRecognitionRequest {
  completion_date: string;
  actual_value: number;
}

export interface CurrencyConversionRequest {
  amount: number;
  from: string;
  to: string;
}

export interface CurrencyConversionResponse {
  base_currency: string;
  conversions: Array<{
    from_currency: string;
    to_currency: string;
    amount: number;
    converted_amount: number;
    exchange_rate: number;
    rate_date: string;
  }>;
  total_usd_equivalent: number;
}

export interface RevenueExportRequest {
  format: string;
  period: string;
  include_forecasts?: boolean;
}

export interface RevenueExport {
  export_id: string;
  format: string;
  records_exported: number;
  file_size: string;
  download_url: string;
  expires_at: string;
}

// Error handling types
export interface ConflictResolution {
  conflict_id: string;
  entity_type: string;
  entity_id: string;
  conflicts: Array<{
    field: string;
    salesforce_value: any;
    hubspot_value: any;
    last_modified_sf: string;
    last_modified_hs: string;
  }>;
  resolution_strategy: string;
}

export interface ConflictResolutionRequest {
  strategy: string;
}

export interface DataValidation {
  validation_id: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  issues: Array<{
    type: string;
    field: string;
    count: number;
    affected_records: string[];
  }>;
}

export interface DataValidationRequest {
  entity_types: string[];
  deep_validation?: boolean;
}