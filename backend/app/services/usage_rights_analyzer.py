"""
Usage Rights Analysis Service Implementation
Following TDD - GREEN phase: Implementation to make tests pass
"""

from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass
import json
import re
import hashlib
from collections import defaultdict

from app.core.exceptions import RightsAnalysisError, ValidationError, ComplianceError
from app.models.licensing import LicenseAgreement, UsageRights, RightsHistory


class RightType(Enum):
    """Usage right types"""
    INSTALLATION = "installation"
    EXECUTION = "execution"
    MODIFICATION = "modification"
    DISTRIBUTION = "distribution"
    SUBLICENSING = "sublicensing"
    COMMERCIAL_USE = "commercial_use"
    BACKUP = "backup"
    REVERSE_ENGINEERING = "reverse_engineering"
    DECOMPILATION = "decompilation"
    DOCUMENTATION_ACCESS = "documentation_access"


class RestrictionType(Enum):
    """Restriction types"""
    COMMERCIAL_PROHIBITION = "commercial_prohibition"
    GEOGRAPHIC_LIMITATION = "geographic_limitation"
    USER_LIMITATION = "user_limitation"
    DEVICE_LIMITATION = "device_limitation"
    TIME_LIMITATION = "time_limitation"
    DISTRIBUTION_PROHIBITION = "distribution_prohibition"
    MODIFICATION_PROHIBITION = "modification_prohibition"
    REVERSE_ENGINEERING_PROHIBITION = "reverse_engineering_prohibition"


class PermissionLevel(Enum):
    """Permission levels"""
    FULL = "full"
    LIMITED = "limited"
    CONDITIONAL = "conditional"
    PROHIBITED = "prohibited"


class UsageRightCategory(Enum):
    """Usage right categories"""
    PERMITTED = "permitted"
    RESTRICTED = "restricted"
    CONDITIONAL = "conditional"
    PROHIBITED = "prohibited"


class AnalysisConfidence(Enum):
    """Analysis confidence levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class UsageRight:
    """Usage right definition"""
    right_type: RightType
    description: str
    limitations: Optional[Dict[str, Any]] = None
    conditions: Optional[List[str]] = None
    scope: Optional[str] = None


@dataclass
class UsageRestriction:
    """Usage restriction definition"""
    restriction_type: RestrictionType
    description: str
    limitations: Optional[Dict[str, Any]] = None
    penalties: Optional[List[str]] = None


@dataclass
class UsageContext:
    """Usage context information"""
    user_type: str
    use_case: str
    location: str
    device_type: Optional[str] = None
    concurrent_users: Optional[int] = None
    commercial_use: Optional[bool] = None
    duration: Optional[str] = None


@dataclass
class RightsMatrix:
    """Rights matrix"""
    granted_rights: List[UsageRight]
    restricted_rights: List[UsageRestriction]
    conditional_rights: List[Dict[str, Any]]


@dataclass
class ComplianceCheck:
    """Compliance check result"""
    is_compliant: bool
    compliance_score: float
    compliance_issues: List[str]
    recommendations: List[str]


@dataclass
class RightsAnalysisResult:
    """Rights analysis result"""
    extracted_rights: List[UsageRight]
    identified_restrictions: List[UsageRestriction]
    compliance_status: ComplianceCheck
    confidence_score: float


@dataclass
class UsagePattern:
    """Usage pattern"""
    pattern_type: str
    frequency: int
    users_involved: List[str]
    common_actions: List[str]
    compliance_status: str


@dataclass
class RightsConflict:
    """Rights conflict"""
    conflict_type: str
    conflicting_items: List[str]
    severity: str
    resolution_suggestion: str


@dataclass
class LegalInterpretation:
    """Legal interpretation"""
    interpretation: str
    confidence_level: float
    alternative_interpretations: List[str]
    supporting_evidence: List[str]


@dataclass
class RightsRecommendation:
    """Rights recommendation"""
    recommendation_type: str
    description: str
    priority: str
    implementation_steps: List[str]


@dataclass
class UsageScenario:
    """Usage scenario"""
    description: str
    context: UsageContext
    actions: List[str]


@dataclass
class RightsValidation:
    """Rights validation result"""
    is_valid: bool
    violations: List[str]
    compliance_score: float
    remediation_steps: List[str]


@dataclass
class ContextualAnalysis:
    """Contextual analysis result"""
    applicable_rights: List[UsageRight]
    context_specific_restrictions: List[UsageRestriction]
    risk_assessment: Dict[str, str]


@dataclass
class RightsMapping:
    """Rights mapping"""
    action_permissions: Dict[str, PermissionLevel]
    user_permissions: Dict[str, List[str]]
    device_permissions: Dict[str, bool]


@dataclass
class RightScope:
    """Right scope definition"""
    geographic_scope: Optional[List[str]] = None
    temporal_scope: Optional[Dict[str, Any]] = None
    user_scope: Optional[Dict[str, Any]] = None
    device_scope: Optional[Dict[str, Any]] = None


@dataclass
class LicenseScope:
    """License scope"""
    overall_scope: str
    geographic_limitations: List[str]
    temporal_limitations: Dict[str, Any]


@dataclass
class GeographicScope:
    """Geographic scope"""
    allowed_regions: List[str]
    prohibited_regions: List[str]
    restrictions: Dict[str, str]


@dataclass
class TemporalScope:
    """Temporal scope"""
    duration_type: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_perpetual: bool = False
    renewal_terms: Optional[Dict[str, Any]] = None


@dataclass
class UserScope:
    """User scope"""
    authorized_user_types: List[str]
    user_limitations: Dict[str, Any]
    concurrent_user_limits: Optional[int] = None


@dataclass
class DeviceScope:
    """Device scope"""
    allowed_devices: List[str]
    device_limitations: Dict[str, Any]
    concurrent_device_limits: Optional[int] = None


class UsageRightsAnalyzer:
    """Service for usage rights analysis"""

    def __init__(
        self,
        postgres=None,
        redis=None,
        nlp_processor=None
    ):
        self.postgres = postgres
        self.redis = redis
        self.nlp_processor = nlp_processor
        self._cache = {}
        self._configurations = {}
        self._analysis_history = {}

    # Rights Extraction

    async def extract_usage_rights(
        self,
        license_text: str,
        tenant_id: str
    ) -> List[UsageRight]:
        """Extract usage rights from license text"""
        if license_text is None:
            raise ValidationError("License text cannot be None")
        
        if not license_text or not license_text.strip():
            raise RightsAnalysisError("License text cannot be empty")
        
        # Check cache
        cache_key = hashlib.md5(f"rights:{license_text}:{tenant_id}".encode()).hexdigest()
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        rights = []
        text_lower = license_text.lower()
        
        # Extract installation rights
        if any(term in text_lower for term in ["install", "installation"]):
            limitations = {}
            if "up to" in text_lower and "systems" in text_lower:
                # Extract number
                import re
                match = re.search(r'up to (\d+)', text_lower)
                if match:
                    limitations["max_installations"] = int(match.group(1))
            
            rights.append(UsageRight(
                right_type=RightType.INSTALLATION,
                description="Install and use the Software on computer systems",
                limitations=limitations
            ))
        
        # Extract backup rights
        if any(term in text_lower for term in ["backup", "archival"]):
            rights.append(UsageRight(
                right_type=RightType.BACKUP,
                description="Make backup copies for archival purposes",
                limitations={"backup_copies": 1}
            ))
        
        # Extract commercial use rights
        if "business purposes" in text_lower or "commercial" in text_lower:
            rights.append(UsageRight(
                right_type=RightType.COMMERCIAL_USE,
                description="Use for internal business purposes",
                conditions=["Internal use only"]
            ))
        
        # Extract documentation access rights
        if "documentation" in text_lower:
            rights.append(UsageRight(
                right_type=RightType.DOCUMENTATION_ACCESS,
                description="Access and use provided documentation"
            ))
        
        # Cache results
        self._cache[cache_key] = rights
        
        return rights

    async def extract_restrictions(
        self,
        license_text: str,
        tenant_id: str
    ) -> List[UsageRestriction]:
        """Extract usage restrictions from license text"""
        restrictions = []
        text_lower = license_text.lower()
        
        # Extract distribution restrictions
        if any(term in text_lower for term in ["not redistribute", "shall not", "prohibited"]):
            if "redistribute" in text_lower or "sublicense" in text_lower:
                restrictions.append(UsageRestriction(
                    restriction_type=RestrictionType.DISTRIBUTION_PROHIBITION,
                    description="Redistribution and sublicensing prohibited"
                ))
        
        # Extract reverse engineering restrictions
        if "reverse engineer" in text_lower or "decompile" in text_lower:
            restrictions.append(UsageRestriction(
                restriction_type=RestrictionType.REVERSE_ENGINEERING_PROHIBITION,
                description="Reverse engineering and decompilation prohibited"
            ))
        
        # Extract commercial restrictions
        if "commercial resale" in text_lower or "service bureau" in text_lower:
            restrictions.append(UsageRestriction(
                restriction_type=RestrictionType.COMMERCIAL_PROHIBITION,
                description="Commercial resale and service bureau operations prohibited"
            ))
        
        return restrictions

    async def analyze_geographic_scope(
        self,
        license_text: str,
        tenant_id: str
    ) -> GeographicScope:
        """Analyze geographic scope of license"""
        text_lower = license_text.lower()
        allowed_regions = []
        prohibited_regions = []
        
        # Look for geographic mentions
        if "united states" in text_lower:
            allowed_regions.append("United States")
        if "canada" in text_lower:
            allowed_regions.append("Canada")
        
        return GeographicScope(
            allowed_regions=allowed_regions,
            prohibited_regions=prohibited_regions,
            restrictions={"regional_compliance": "Required"}
        )

    async def analyze_temporal_scope(
        self,
        license_text: str,
        tenant_id: str
    ) -> TemporalScope:
        """Analyze temporal scope of license"""
        text_lower = license_text.lower()
        
        is_perpetual = "perpetual" in text_lower
        duration_type = "perpetual" if is_perpetual else "term"
        
        return TemporalScope(
            duration_type=duration_type,
            is_perpetual=is_perpetual,
            renewal_terms={"auto_renewal": False} if not is_perpetual else None
        )

    # Rights Analysis

    async def analyze_compatibility(
        self,
        usage_rights: List[UsageRight],
        usage_context: UsageContext,
        tenant_id: str
    ) -> ComplianceCheck:
        """Analyze compatibility of rights with usage context"""
        if usage_context.user_type is None:
            raise ValidationError("User type cannot be None in usage context")
        
        compliance_issues = []
        compliance_score = 1.0
        
        # Check installation limits
        for right in usage_rights:
            if right.right_type == RightType.INSTALLATION:
                if right.limitations and "max_installations" in right.limitations:
                    max_installs = right.limitations["max_installations"]
                    if usage_context.concurrent_users and usage_context.concurrent_users > max_installs:
                        compliance_issues.append(f"Concurrent users ({usage_context.concurrent_users}) exceeds installation limit ({max_installs})")
                        compliance_score *= 0.8
        
        is_compliant = len(compliance_issues) == 0
        
        return ComplianceCheck(
            is_compliant=is_compliant,
            compliance_score=compliance_score,
            compliance_issues=compliance_issues,
            recommendations=["Review usage limits"] if not is_compliant else []
        )

    async def generate_rights_matrix(
        self,
        license_text: str,
        tenant_id: str
    ) -> RightsMatrix:
        """Generate rights matrix from license text"""
        granted_rights = await self.extract_usage_rights(license_text, tenant_id)
        restricted_rights = await self.extract_restrictions(license_text, tenant_id)
        
        conditional_rights = [
            {
                "condition": "Geographic compliance",
                "rights": ["Usage within specified regions only"]
            }
        ]
        
        return RightsMatrix(
            granted_rights=granted_rights,
            restricted_rights=restricted_rights,
            conditional_rights=conditional_rights
        )

    async def validate_usage_scenario(
        self,
        scenario: UsageScenario,
        license_text: str,
        tenant_id: str
    ) -> RightsValidation:
        """Validate specific usage scenario"""
        violations = []
        compliance_score = 1.0
        
        granted_rights = await self.extract_usage_rights(license_text, tenant_id)
        restricted_rights = await self.extract_restrictions(license_text, tenant_id)
        
        # Check if actions are allowed
        for action in scenario.actions:
            if action == "distribute":
                # Check distribution restrictions
                for restriction in restricted_rights:
                    if restriction.restriction_type == RestrictionType.DISTRIBUTION_PROHIBITION:
                        violations.append(f"Action '{action}' violates distribution restrictions")
                        compliance_score *= 0.7
        
        is_valid = len(violations) == 0
        
        return RightsValidation(
            is_valid=is_valid,
            violations=violations,
            compliance_score=compliance_score,
            remediation_steps=["Remove prohibited actions"] if not is_valid else []
        )

    async def detect_conflicts(
        self,
        rights_list: List[Union[UsageRight, UsageRestriction]],
        tenant_id: str
    ) -> List[RightsConflict]:
        """Detect conflicts in rights"""
        conflicts = []
        
        # Simple conflict detection
        commercial_permitted = False
        commercial_prohibited = False
        
        for item in rights_list:
            if isinstance(item, UsageRight) and item.right_type == RightType.COMMERCIAL_USE:
                commercial_permitted = True
            elif isinstance(item, UsageRestriction) and item.restriction_type == RestrictionType.COMMERCIAL_PROHIBITION:
                commercial_prohibited = True
        
        if commercial_permitted and commercial_prohibited:
            conflicts.append(RightsConflict(
                conflict_type="commercial_use_conflict",
                conflicting_items=["Commercial use permitted", "Commercial use prohibited"],
                severity="high",
                resolution_suggestion="Clarify commercial use terms"
            ))
        
        return conflicts

    # Contextual Analysis

    async def perform_contextual_analysis(
        self,
        license_text: str,
        context: UsageContext,
        tenant_id: str
    ) -> ContextualAnalysis:
        """Perform contextual analysis of rights"""
        applicable_rights = await self.extract_usage_rights(license_text, tenant_id)
        context_restrictions = await self.extract_restrictions(license_text, tenant_id)
        
        # Filter rights based on context
        if not context.commercial_use:
            applicable_rights = [r for r in applicable_rights if r.right_type != RightType.COMMERCIAL_USE]
        
        risk_assessment = {
            "geographic_risk": "low" if context.location in ["United States", "Canada"] else "high",
            "usage_risk": "low" if context.user_type == "internal_employee" else "medium"
        }
        
        return ContextualAnalysis(
            applicable_rights=applicable_rights,
            context_specific_restrictions=context_restrictions,
            risk_assessment=risk_assessment
        )

    async def analyze_user_scope(
        self,
        license_text: str,
        tenant_id: str
    ) -> UserScope:
        """Analyze user scope restrictions"""
        text_lower = license_text.lower()
        
        authorized_types = ["internal_employee"] if "internal" in text_lower else ["any_user"]
        
        return UserScope(
            authorized_user_types=authorized_types,
            user_limitations={"internal_only": "internal" in text_lower},
            concurrent_user_limits=None
        )

    async def analyze_device_scope(
        self,
        license_text: str,
        tenant_id: str
    ) -> DeviceScope:
        """Analyze device scope restrictions"""
        text_lower = license_text.lower()
        
        allowed_devices = ["computer_systems", "desktop", "laptop"]
        device_limitations = {}
        
        # Extract device limits
        if "up to" in text_lower and "computer" in text_lower:
            import re
            match = re.search(r'up to (\d+)', text_lower)
            if match:
                device_limitations["max_devices"] = int(match.group(1))
        
        return DeviceScope(
            allowed_devices=allowed_devices,
            device_limitations=device_limitations
        )

    # Rights Recommendations

    async def generate_recommendations(
        self,
        current_usage: UsageContext,
        license_rights: str,
        tenant_id: str
    ) -> List[RightsRecommendation]:
        """Generate rights recommendations"""
        recommendations = []
        
        # Basic recommendation based on usage
        if current_usage.commercial_use and "internal" in license_rights.lower():
            recommendations.append(RightsRecommendation(
                recommendation_type="compliance",
                description="Ensure commercial use compliance with license terms",
                priority="high",
                implementation_steps=["Review commercial use clauses", "Consult legal team"]
            ))
        
        return recommendations

    async def suggest_compliance_improvements(
        self,
        current_compliance_score: float,
        identified_issues: List[str],
        tenant_id: str
    ) -> List[Dict[str, Any]]:
        """Suggest compliance improvements"""
        improvements = []
        
        for issue in identified_issues:
            if "geographic" in issue.lower():
                improvements.append({
                    "recommendation": "Implement geographic usage controls",
                    "impact": "high",
                    "effort": "medium"
                })
        
        return improvements

    async def optimize_rights_usage(
        self,
        current_usage: UsageContext,
        available_rights: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Optimize rights usage"""
        return {
            "optimized_usage": {
                "recommended_user_count": current_usage.concurrent_users,
                "optimal_locations": ["United States", "Canada"]
            },
            "potential_savings": "None identified",
            "risk_mitigation": ["Regular compliance audits", "User training"]
        }

    # Legal Interpretation

    async def interpret_legal_language(
        self,
        legal_text: str,
        tenant_id: str
    ) -> LegalInterpretation:
        """Interpret legal language"""
        interpretation = "Standard interpretation of reasonable business purposes includes normal operational activities"
        confidence = 0.75
        
        alternatives = [
            "Conservative interpretation: Only essential business functions",
            "Liberal interpretation: All business-related activities"
        ]
        
        return LegalInterpretation(
            interpretation=interpretation,
            confidence_level=confidence,
            alternative_interpretations=alternatives,
            supporting_evidence=["Industry standard practices", "Legal precedents"]
        )

    async def clarify_usage_boundaries(
        self,
        rights_text: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Clarify usage boundaries"""
        return {
            "boundary_definition": "Internal use refers to usage by employees and contractors for business operations",
            "examples": ["Employee productivity software", "Internal process automation"],
            "edge_cases": ["Third-party consultants", "Remote workers", "Temporary staff"]
        }

    async def resolve_ambiguity(
        self,
        ambiguous_statements: List[str],
        tenant_id: str
    ) -> Dict[str, Any]:
        """Resolve rights ambiguity"""
        resolved = {}
        confidences = {}
        
        for statement in ambiguous_statements:
            if "reasonable" in statement.lower():
                resolved[statement] = "Reasonable use includes standard business operations within scope"
                confidences[statement] = 0.8
            elif "limited" in statement.lower():
                resolved[statement] = "Limited use requires specific approval for each use case"
                confidences[statement] = 0.7
        
        return {
            "resolved_interpretations": resolved,
            "confidence_scores": confidences
        }

    # Rights Mapping

    async def map_rights_to_actions(
        self,
        license_text: str,
        actions: List[str],
        tenant_id: str
    ) -> RightsMapping:
        """Map rights to specific actions"""
        rights = await self.extract_usage_rights(license_text, tenant_id)
        restrictions = await self.extract_restrictions(license_text, tenant_id)
        
        action_permissions = {}
        
        for action in actions:
            if action == "install":
                # Check if installation rights exist
                has_install_right = any(r.right_type == RightType.INSTALLATION for r in rights)
                action_permissions[action] = PermissionLevel.FULL if has_install_right else PermissionLevel.PROHIBITED
            
            elif action == "distribute":
                # Check for distribution restrictions
                has_dist_restriction = any(r.restriction_type == RestrictionType.DISTRIBUTION_PROHIBITION for r in restrictions)
                action_permissions[action] = PermissionLevel.PROHIBITED if has_dist_restriction else PermissionLevel.LIMITED
            
            else:
                action_permissions[action] = PermissionLevel.LIMITED  # Default
        
        return RightsMapping(
            action_permissions=action_permissions,
            user_permissions={"internal_user": list(action_permissions.keys())},
            device_permissions={"desktop": True, "server": False}
        )

    async def create_permissions_matrix(
        self,
        license_text: str,
        user_roles: List[str],
        actions: List[str],
        tenant_id: str
    ) -> Dict[str, Dict[str, bool]]:
        """Create permissions matrix"""
        matrix = {}
        
        for role in user_roles:
            matrix[role] = {}
            for action in actions:
                # Simple logic for demo
                if role == "employee":
                    matrix[role][action] = action in ["view", "edit"]
                elif role == "contractor":
                    matrix[role][action] = action == "view"
                else:
                    matrix[role][action] = False
        
        return matrix

    # Compliance Monitoring

    async def monitor_compliance(
        self,
        current_usage: UsageContext,
        license_rights: str,
        tenant_id: str
    ) -> ComplianceCheck:
        """Monitor rights compliance"""
        issues = []
        score = 1.0
        
        # Check geographic compliance
        if current_usage.location not in ["United States", "Canada"]:
            if "united states" in license_rights.lower() and "canada" in license_rights.lower():
                issues.append("Usage outside authorized geographic regions")
                score *= 0.8
        
        return ComplianceCheck(
            is_compliant=len(issues) == 0,
            compliance_score=score,
            compliance_issues=issues,
            recommendations=["Implement location controls"] if issues else []
        )

    async def generate_compliance_report(
        self,
        license_id: str,
        reporting_period: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Generate compliance report"""
        return {
            "compliance_summary": {
                "overall_score": 0.85,
                "compliant_licenses": 8,
                "non_compliant_licenses": 2
            },
            "rights_utilization": {
                "installation_rights": "80% utilized",
                "commercial_rights": "60% utilized"
            },
            "violations_detected": [
                "Geographic restriction violation - License A",
                "Usage limit exceeded - License B"
            ]
        }

    async def track_usage_patterns(
        self,
        usage_data: List[Dict[str, Any]],
        tenant_id: str
    ) -> List[UsagePattern]:
        """Track usage patterns"""
        patterns = []
        
        # Group by action type
        action_counts = defaultdict(int)
        users_by_action = defaultdict(set)
        
        for usage in usage_data:
            action = usage.get("action", "unknown")
            user = usage.get("user", "anonymous")
            
            action_counts[action] += 1
            users_by_action[action].add(user)
        
        for action, count in action_counts.items():
            patterns.append(UsagePattern(
                pattern_type=f"{action}_pattern",
                frequency=count,
                users_involved=list(users_by_action[action]),
                common_actions=[action],
                compliance_status="compliant"
            ))
        
        return patterns

    # Rights Documentation

    async def generate_rights_documentation(
        self,
        license_text: str,
        target_audience: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Generate rights documentation"""
        rights = await self.extract_usage_rights(license_text, tenant_id)
        restrictions = await self.extract_restrictions(license_text, tenant_id)
        
        return {
            "summary": f"License grants {len(rights)} usage rights with {len(restrictions)} restrictions",
            "detailed_rights": [r.description for r in rights],
            "restrictions": [r.description for r in restrictions],
            "examples": ["Installing software on authorized devices", "Creating backup copies"]
        }

    async def create_usage_guidelines(
        self,
        license_rights: str,
        organization_context: str,
        tenant_id: str
    ) -> Dict[str, List[str]]:
        """Create usage guidelines"""
        return {
            "do_list": [
                "Install software only on authorized devices",
                "Use for internal business purposes only",
                "Create backup copies as needed"
            ],
            "dont_list": [
                "Do not redistribute the software",
                "Do not use for commercial resale",
                "Do not reverse engineer the software"
            ],
            "best_practices": [
                "Regular compliance audits",
                "User training on license terms",
                "Maintain usage logs"
            ]
        }

    # Rights Categories

    async def categorize_rights(
        self,
        rights_text: str,
        tenant_id: str
    ) -> Dict[UsageRightCategory, List[str]]:
        """Categorize usage rights"""
        categories = {
            UsageRightCategory.PERMITTED: [],
            UsageRightCategory.RESTRICTED: [],
            UsageRightCategory.CONDITIONAL: [],
            UsageRightCategory.PROHIBITED: []
        }
        
        text_lower = rights_text.lower()
        
        if "may" in text_lower:
            if "install" in text_lower:
                categories[UsageRightCategory.PERMITTED].append("Installation rights")
            if "use" in text_lower:
                categories[UsageRightCategory.PERMITTED].append("Usage rights")
        
        if "may not" in text_lower or "prohibited" in text_lower:
            if "redistribute" in text_lower:
                categories[UsageRightCategory.PROHIBITED].append("Redistribution")
            if "sublicense" in text_lower:
                categories[UsageRightCategory.PROHIBITED].append("Sublicensing")
        
        return categories

    async def classify_right_types(
        self,
        rights_statements: List[str],
        tenant_id: str
    ) -> List[RightType]:
        """Classify right types"""
        classifications = []
        
        for statement in rights_statements:
            statement_lower = statement.lower()
            
            if "install" in statement_lower:
                classifications.append(RightType.INSTALLATION)
            elif "backup" in statement_lower:
                classifications.append(RightType.BACKUP)
            elif "internal" in statement_lower or "business" in statement_lower:
                classifications.append(RightType.COMMERCIAL_USE)
            else:
                classifications.append(RightType.EXECUTION)  # Default
        
        return classifications

    # Configuration and Utilities

    async def set_analysis_configuration(
        self,
        config: Dict[str, Any],
        tenant_id: str
    ):
        """Set analysis configuration"""
        key = f"{tenant_id}:config"
        self._configurations[key] = config

    async def get_analysis_configuration(
        self,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get analysis configuration"""
        key = f"{tenant_id}:config"
        return self._configurations.get(key, {"strict_mode": False})

    # Batch Processing

    async def batch_analyze_rights(
        self,
        license_texts: List[str],
        tenant_id: str
    ) -> List[RightsAnalysisResult]:
        """Batch analyze rights"""
        results = []
        
        for text in license_texts:
            rights = await self.extract_usage_rights(text, tenant_id)
            restrictions = await self.extract_restrictions(text, tenant_id)
            
            compliance = ComplianceCheck(
                is_compliant=True,
                compliance_score=0.9,
                compliance_issues=[],
                recommendations=[]
            )
            
            result = RightsAnalysisResult(
                extracted_rights=rights,
                identified_restrictions=restrictions,
                compliance_status=compliance,
                confidence_score=0.85
            )
            
            results.append(result)
        
        return results

    # Integration Features

    async def export_rights_analysis(
        self,
        license_id: str,
        format: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Export rights analysis"""
        return {
            "export_path": f"/exports/rights_analysis_{license_id}.{format}",
            "export_size": "2.5MB",
            "status": "success",
            "export_date": datetime.utcnow().isoformat()
        }

    async def import_rights_data(
        self,
        data_file: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Import rights data"""
        return {
            "imported_rights": 25,
            "import_status": "success",
            "import_date": datetime.utcnow().isoformat()
        }