"""
Data models for Healthcare & Life Sciences Suite
Contains all dataclasses for Clinical Trial Agreements and HIPAA Compliance
"""
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from decimal import Decimal
from dataclasses import dataclass, field

# Configuration classes
@dataclass
class HealthcareConfig:
    regulatory_frameworks: List[str] = field(default_factory=lambda: ["fda", "gcp", "hipaa"])
    compliance_strictness: str = "high"
    audit_level: str = "comprehensive"
    patient_safety_priority: str = "critical"
    data_protection_level: str = "maximum"

# Clinical Trial result classes
@dataclass
class ClinicalTrialResult:
    study_phase: str
    protocol_compliance: bool
    regulatory_status: str
    enrollment_progress: Dict[str, Any]
    safety_profile: Dict[str, Any]
    data_quality_score: float
    timeline_adherence: float

@dataclass
class ProtocolAlignmentResult:
    alignment_score: float
    discrepancies: List[str]
    critical_deviations: List[str]
    regulatory_gaps: List[str]
    recommended_amendments: List[str]
    compliance_confidence: float

@dataclass
class SiteAgreementResult:
    total_sites: int
    activated_sites: int
    pending_approvals: List[str]
    compliance_status: Dict[str, str]
    coordination_efficiency: float
    site_performance_metrics: Dict[str, Dict[str, Any]]

@dataclass
class BudgetReconciliationResult:
    total_budget_variance: Decimal
    per_site_variances: Dict[str, Decimal]
    milestone_payment_status: Dict[str, str]
    cost_category_analysis: Dict[str, Dict[str, Decimal]]
    forecasted_completion_cost: Decimal
    budget_utilization_rate: float

@dataclass
class MilestoneTrackingResult:
    completed_milestones: List[str]
    current_milestone: str
    overdue_milestones: List[str]
    projected_completion_dates: Dict[str, date]
    critical_path_risks: List[str]
    timeline_confidence: float

@dataclass
class AdverseEventResult:
    reporting_compliance: bool
    serious_ae_count: int
    causality_assessments: Dict[str, List[str]]
    regulatory_actions_required: List[str]
    safety_signal_detected: bool
    risk_mitigation_recommendations: List[str]

@dataclass
class IPOwnershipResult:
    ownership_clarity: float
    licensing_terms: Dict[str, str]
    publication_restrictions: Dict[str, Any]
    commercialization_rights: Dict[str, str]
    dispute_risks: List[str]

@dataclass
class PublicationRightsResult:
    publication_timeline: Dict[str, int]
    authorship_requirements: Dict[str, str]
    review_processes: Dict[str, int]
    compliance_obligations: List[str]
    coordination_complexity: str

@dataclass
class DataSharingResult:
    sharing_permissions: Dict[str, str]
    access_restrictions: List[str]
    governance_framework: Dict[str, str]
    compliance_requirements: Dict[str, List[str]]
    risk_assessment: Dict[str, str]

@dataclass
class RegulatoryComplianceResult:
    framework_compliance: Dict[str, bool]
    documentation_completeness: float
    monitoring_adequacy: bool
    corrective_actions_needed: List[str]
    inspection_readiness: float

@dataclass
class MultiSiteResult:
    coordination_effectiveness: float
    operational_challenges: List[str]
    performance_variations: Dict[str, Dict[str, float]]
    standardization_level: float
    communication_efficiency: float

# HIPAA result classes
@dataclass
class HIPAAComplianceResult:
    overall_compliance_score: float
    regulatory_gaps: List[str]
    risk_assessment: Dict[str, str]
    remediation_timeline: Dict[str, int]
    certification_status: str

@dataclass
class BusinessAssociateResult:
    agreement_completeness: float
    permitted_uses_clarity: bool
    safeguards_adequacy: Dict[str, bool]
    subcontractor_compliance: Dict[str, str]
    breach_notification_readiness: bool

@dataclass
class PHIHandlingResult:
    handling_procedures_score: float
    processing_compliance: Dict[str, bool]
    access_controls_adequacy: bool
    audit_trail_completeness: float
    training_compliance: float

@dataclass
class SecurityRequirementsResult:
    administrative_safeguards: Dict[str, bool]
    physical_safeguards: Dict[str, bool]
    technical_safeguards: Dict[str, bool]
    overall_security_score: float
    vulnerability_risks: List[str]

@dataclass
class BreachNotificationResult:
    breach_classification: str
    notification_timeline: Dict[str, int]
    affected_individuals_count: int
    regulatory_reporting_required: List[str]
    mitigation_adequacy: float

@dataclass
class AuditTrailResult:
    logging_completeness: float
    access_tracking_adequacy: bool
    retention_compliance: bool
    monitoring_effectiveness: float
    forensic_readiness: bool

@dataclass
class SubcontractorResult:
    flowdown_completeness: float
    subcontractor_compliance: Dict[str, str]
    oversight_mechanisms: List[str]
    liability_allocation: Dict[str, str]
    termination_procedures: Dict[str, str]

@dataclass
class StateLawResult:
    state_compliance_analysis: Dict[str, bool]
    conflicting_requirements: List[str]
    harmonization_approach: Dict[str, str]
    additional_obligations: List[str]
    legal_risk_assessment: float

@dataclass
class MinimumNecessaryResult:
    access_limitations: Dict[str, List[str]]
    use_restrictions: Dict[str, str]
    disclosure_controls: List[str]
    policy_compliance: float
    training_effectiveness: float

@dataclass
class DeIdentificationResult:
    deidentification_method: str
    identifier_removal_completeness: float
    reidentification_risk: float
    expert_determination_required: bool
    safe_harbor_compliance: bool

@dataclass
class PatientRightsResult:
    rights_notification_adequacy: bool
    access_request_procedures: Dict[str, str]
    amendment_processes: Dict[str, str]
    complaint_handling: Dict[str, str]
    patient_portal_compliance: bool

# Exception classes
class HealthcareException(Exception):
    """Base healthcare exception"""
    pass

class ClinicalTrialException(HealthcareException):
    """Clinical trial specific exception"""
    pass

class HIPAAException(HealthcareException):
    """HIPAA specific exception"""
    pass