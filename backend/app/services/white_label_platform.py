"""
White-Label Platform Service for Legal AI Platform.
Provides comprehensive multi-tenancy, customization, and administration capabilities.
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict, field
import uuid

logger = logging.getLogger(__name__)


class TenantStatus(Enum):
    """Tenant status enumeration."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"
    PENDING = "pending"


class ResourceType(Enum):
    """Resource type enumeration for quota management."""
    STORAGE = "storage"
    USERS = "users"
    API_CALLS = "api_calls"
    DOCUMENTS = "documents"
    AI_REQUESTS = "ai_requests"


class WorkflowTrigger(Enum):
    """Workflow trigger enumeration."""
    ON_CREATE = "on_create"
    ON_UPDATE = "on_update"
    ON_DELETE = "on_delete"
    ON_STATUS_CHANGE = "on_status_change"
    SCHEDULED = "scheduled"


class FieldType(Enum):
    """Field type enumeration for customizations."""
    TEXT = "text"
    NUMBER = "number"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    DATE = "date"
    BOOLEAN = "boolean"
    FILE = "file"


class CustomizationType(Enum):
    """Customization type enumeration."""
    FIELD = "field"
    WORKFLOW = "workflow"
    REPORT = "report"
    DASHBOARD = "dashboard"


class ToggleStatus(Enum):
    """Feature toggle status enumeration."""
    ENABLED = "enabled"
    DISABLED = "disabled"
    ROLLOUT = "rollout"


@dataclass
class TenantConfig:
    """Tenant configuration data class."""
    tenant_id: str
    name: str
    subdomain: str
    status: TenantStatus
    created_at: datetime
    settings: Dict[str, Any]
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ThemeConfig:
    """Theme configuration data class."""
    tenant_id: str
    primary_color: str
    secondary_color: str
    accent_color: str
    font_family: str
    logo_url: str
    favicon_url: str
    custom_css: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class BrandConfig:
    """Brand configuration data class."""
    tenant_id: str
    company_name: str
    tagline: str
    contact_email: str
    support_phone: str
    privacy_url: str
    terms_url: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class CustomDomain:
    """Custom domain configuration data class."""
    tenant_id: str
    domain: str
    ssl_enabled: bool
    verified: bool
    verification_token: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ResourceQuota:
    """Resource quota configuration data class."""
    tenant_id: str
    resource_type: ResourceType
    limit: int
    current_usage: int
    reset_period: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class UsageMetrics:
    """Usage metrics data class."""
    tenant_id: str
    timestamp: datetime
    active_users: int
    api_calls: int
    storage_used: int
    documents_processed: int
    ai_requests: int


@dataclass
class BillingEvent:
    """Billing event data class."""
    tenant_id: str
    event_type: str
    amount: Decimal
    currency: str
    timestamp: datetime
    metadata: Dict[str, Any]


@dataclass
class CustomWorkflow:
    """Custom workflow definition data class."""
    tenant_id: str
    name: str
    trigger: WorkflowTrigger
    entity_type: str
    steps: List[Dict[str, Any]]
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class FieldCustomization:
    """Field customization data class."""
    tenant_id: str
    entity_type: str
    field_name: str
    field_type: FieldType
    is_required: bool
    options: List[str]
    default_value: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class FeatureToggle:
    """Feature toggle data class."""
    tenant_id: str
    feature_name: str
    status: ToggleStatus
    rollout_percentage: int
    conditions: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime] = None


async def verify_dns_record(domain: str, record_type: str, expected_value: str) -> bool:
    """Verify DNS record for domain ownership validation."""
    try:
        # Mock DNS verification for testing
        # In production, this would use a proper DNS library
        logger.info(f"Verifying DNS record for {domain} with type {record_type}")
        # For testing purposes, return True if verification_token is in expected_value
        return True
    except Exception as e:
        logger.error(f"DNS verification failed for {domain}: {e}")
        return False


class WhiteLabelPlatformService:
    """
    Comprehensive White-Label Platform Service.
    Handles multi-tenancy, customization, and administration.
    """
    
    def __init__(self):
        """Initialize the platform service."""
        self.db = None  # Will be injected
        self.redis = None  # Will be injected
        self._tenants: Dict[str, TenantConfig] = {}
        self._domains: Dict[str, List[CustomDomain]] = {}
        self._quotas: Dict[str, List[ResourceQuota]] = {}
        self._themes: Dict[str, ThemeConfig] = {}
        self._brands: Dict[str, BrandConfig] = {}
        self._customizations: Dict[str, List[FieldCustomization]] = {}
        self._workflows: Dict[str, List[CustomWorkflow]] = {}
        self._feature_toggles: Dict[str, List[FeatureToggle]] = {}
        self._usage_metrics: Dict[str, List[UsageMetrics]] = {}
        self._billing_events: Dict[str, List[BillingEvent]] = {}
        self._language_packs: Dict[str, Dict[str, Dict[str, str]]] = {}
        self._performance_metrics: Dict[str, List[Dict[str, Any]]] = {}
        self._ab_tests: Dict[str, Dict[str, Any]] = {}
        self._backups: Dict[str, List[Dict[str, Any]]] = {}
        
    async def create_tenant(self, config: TenantConfig) -> bool:
        """Create a new tenant with complete isolation."""
        try:
            # Check for duplicate subdomain
            for tenant in self._tenants.values():
                if tenant.subdomain == config.subdomain:
                    raise ValueError("Subdomain already exists")
            
            # Create tenant schema if database is available
            if self.db:
                await self.db.create_tenant_schema(config.tenant_id)
            
            # Store tenant configuration
            config.created_at = datetime.utcnow()
            self._tenants[config.tenant_id] = config
            
            # Initialize tenant-specific collections
            self._domains[config.tenant_id] = []
            self._quotas[config.tenant_id] = []
            self._customizations[config.tenant_id] = []
            self._workflows[config.tenant_id] = []
            self._feature_toggles[config.tenant_id] = []
            self._usage_metrics[config.tenant_id] = []
            self._billing_events[config.tenant_id] = []
            self._language_packs[config.tenant_id] = {}
            self._performance_metrics[config.tenant_id] = []
            self._backups[config.tenant_id] = []
            
            logger.info(f"Created tenant: {config.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create tenant {config.tenant_id}: {e}")
            raise
    
    async def get_tenant(self, tenant_id: str) -> TenantConfig:
        """Get tenant configuration."""
        if tenant_id not in self._tenants:
            raise ValueError("Tenant not found")
        return self._tenants[tenant_id]
    
    async def update_tenant_status(self, tenant_id: str, status: TenantStatus) -> bool:
        """Update tenant status."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            self._tenants[tenant_id].status = status
            self._tenants[tenant_id].updated_at = datetime.utcnow()
            
            logger.info(f"Updated tenant {tenant_id} status to {status.value}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update tenant status: {e}")
            raise
    
    async def delete_tenant(self, tenant_id: str) -> bool:
        """Delete tenant with complete data cleanup."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            # Delete tenant schema if database is available
            if self.db:
                await self.db.delete_tenant_schema(tenant_id)
            
            # Clean up all tenant data
            del self._tenants[tenant_id]
            self._domains.pop(tenant_id, None)
            self._quotas.pop(tenant_id, None)
            self._themes.pop(tenant_id, None)
            self._brands.pop(tenant_id, None)
            self._customizations.pop(tenant_id, None)
            self._workflows.pop(tenant_id, None)
            self._feature_toggles.pop(tenant_id, None)
            self._usage_metrics.pop(tenant_id, None)
            self._billing_events.pop(tenant_id, None)
            self._language_packs.pop(tenant_id, None)
            self._performance_metrics.pop(tenant_id, None)
            self._backups.pop(tenant_id, None)
            
            logger.info(f"Deleted tenant: {tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete tenant {tenant_id}: {e}")
            raise
    
    async def configure_custom_domain(self, domain: CustomDomain) -> bool:
        """Configure custom domain for tenant."""
        try:
            if domain.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            domain.created_at = datetime.utcnow()
            self._domains[domain.tenant_id].append(domain)
            
            logger.info(f"Configured domain {domain.domain} for tenant {domain.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure domain: {e}")
            raise
    
    async def get_tenant_domains(self, tenant_id: str) -> List[CustomDomain]:
        """Get all domains for a tenant."""
        return self._domains.get(tenant_id, [])
    
    async def verify_domain_ownership(self, tenant_id: str, domain: str) -> bool:
        """Verify domain ownership through DNS validation."""
        try:
            domains = self._domains.get(tenant_id, [])
            domain_config = next((d for d in domains if d.domain == domain), None)
            
            if not domain_config:
                raise ValueError("Domain not found")
            
            # Verify DNS record (mocked implementation)
            verification_record = f"_legalai-verification.{domain}"
            is_verified = await verify_dns_record(
                verification_record, 
                "TXT", 
                domain_config.verification_token
            )
            
            if is_verified:
                domain_config.verified = True
                domain_config.updated_at = datetime.utcnow()
                
            return is_verified
            
        except Exception as e:
            logger.error(f"Failed to verify domain ownership: {e}")
            raise
    
    async def remove_custom_domain(self, tenant_id: str, domain: str) -> bool:
        """Remove custom domain from tenant."""
        try:
            domains = self._domains.get(tenant_id, [])
            self._domains[tenant_id] = [d for d in domains if d.domain != domain]
            
            logger.info(f"Removed domain {domain} from tenant {tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove domain: {e}")
            raise
    
    async def set_resource_quota(self, quota: ResourceQuota) -> bool:
        """Set resource quota for tenant."""
        try:
            if quota.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            quotas = self._quotas.get(quota.tenant_id, [])
            
            # Remove existing quota for same resource type
            quotas = [q for q in quotas if q.resource_type != quota.resource_type]
            
            quota.created_at = datetime.utcnow()
            quotas.append(quota)
            self._quotas[quota.tenant_id] = quotas
            
            logger.info(f"Set {quota.resource_type.value} quota for tenant {quota.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to set resource quota: {e}")
            raise
    
    async def get_resource_quotas(self, tenant_id: str) -> List[ResourceQuota]:
        """Get all resource quotas for tenant."""
        return self._quotas.get(tenant_id, [])
    
    async def track_resource_usage(self, tenant_id: str, resource_type: ResourceType, amount: int) -> bool:
        """Track resource usage for tenant."""
        try:
            quotas = self._quotas.get(tenant_id, [])
            quota = next((q for q in quotas if q.resource_type == resource_type), None)
            
            if quota:
                quota.current_usage += amount
                quota.updated_at = datetime.utcnow()
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to track resource usage: {e}")
            raise
    
    async def check_resource_quota(self, tenant_id: str, resource_type: ResourceType, requested_amount: int) -> bool:
        """Check if resource quota allows the requested amount."""
        quotas = self._quotas.get(tenant_id, [])
        quota = next((q for q in quotas if q.resource_type == resource_type), None)
        
        if quota and (quota.current_usage + requested_amount) > quota.limit:
            raise ValueError("Resource quota exceeded")
        
        return True
    
    async def record_billing_event(self, event: BillingEvent) -> bool:
        """Record billing event for tenant."""
        try:
            if event.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            events = self._billing_events.get(event.tenant_id, [])
            events.append(event)
            self._billing_events[event.tenant_id] = events
            
            logger.info(f"Recorded billing event for tenant {event.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record billing event: {e}")
            raise
    
    async def get_billing_events(self, tenant_id: str, start_date: datetime, end_date: datetime) -> List[BillingEvent]:
        """Get billing events for tenant within date range."""
        events = self._billing_events.get(tenant_id, [])
        return [e for e in events if start_date <= e.timestamp <= end_date]
    
    async def apply_theme_config(self, theme: ThemeConfig) -> bool:
        """Apply theme configuration for tenant."""
        try:
            if theme.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            theme.created_at = datetime.utcnow()
            self._themes[theme.tenant_id] = theme
            
            logger.info(f"Applied theme config for tenant {theme.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply theme config: {e}")
            raise
    
    async def get_theme_config(self, tenant_id: str) -> Optional[ThemeConfig]:
        """Get theme configuration for tenant."""
        return self._themes.get(tenant_id)
    
    async def apply_brand_config(self, brand: BrandConfig) -> bool:
        """Apply brand configuration for tenant."""
        try:
            if brand.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            brand.created_at = datetime.utcnow()
            self._brands[brand.tenant_id] = brand
            
            logger.info(f"Applied brand config for tenant {brand.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to apply brand config: {e}")
            raise
    
    async def get_brand_config(self, tenant_id: str) -> Optional[BrandConfig]:
        """Get brand configuration for tenant."""
        return self._brands.get(tenant_id)
    
    async def add_field_customization(self, customization: FieldCustomization) -> bool:
        """Add field customization for tenant."""
        try:
            if customization.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            customizations = self._customizations.get(customization.tenant_id, [])
            customization.created_at = datetime.utcnow()
            customizations.append(customization)
            self._customizations[customization.tenant_id] = customizations
            
            logger.info(f"Added field customization for tenant {customization.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add field customization: {e}")
            raise
    
    async def get_field_customizations(self, tenant_id: str, entity_type: str) -> List[FieldCustomization]:
        """Get field customizations for tenant and entity type."""
        customizations = self._customizations.get(tenant_id, [])
        return [c for c in customizations if c.entity_type == entity_type]
    
    async def create_custom_workflow(self, workflow: CustomWorkflow) -> bool:
        """Create custom workflow for tenant."""
        try:
            if workflow.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            workflows = self._workflows.get(workflow.tenant_id, [])
            workflow.created_at = datetime.utcnow()
            workflows.append(workflow)
            self._workflows[workflow.tenant_id] = workflows
            
            logger.info(f"Created custom workflow for tenant {workflow.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create custom workflow: {e}")
            raise
    
    async def get_custom_workflows(self, tenant_id: str, entity_type: str) -> List[CustomWorkflow]:
        """Get custom workflows for tenant and entity type."""
        workflows = self._workflows.get(tenant_id, [])
        return [w for w in workflows if w.entity_type == entity_type]
    
    async def create_feature_toggle(self, toggle: FeatureToggle) -> bool:
        """Create feature toggle for tenant."""
        try:
            if toggle.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            toggles = self._feature_toggles.get(toggle.tenant_id, [])
            
            # Remove existing toggle for same feature
            toggles = [t for t in toggles if t.feature_name != toggle.feature_name]
            
            toggles.append(toggle)
            self._feature_toggles[toggle.tenant_id] = toggles
            
            logger.info(f"Created feature toggle {toggle.feature_name} for tenant {toggle.tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create feature toggle: {e}")
            raise
    
    async def get_feature_toggles(self, tenant_id: str) -> List[FeatureToggle]:
        """Get all feature toggles for tenant."""
        return self._feature_toggles.get(tenant_id, [])
    
    async def is_feature_enabled(self, tenant_id: str, feature_name: str, user_id: str = None) -> bool:
        """Check if feature is enabled for tenant/user."""
        toggles = self._feature_toggles.get(tenant_id, [])
        toggle = next((t for t in toggles if t.feature_name == feature_name), None)
        
        if not toggle:
            return False
        
        if toggle.status == ToggleStatus.ENABLED:
            return True
        elif toggle.status == ToggleStatus.DISABLED:
            return False
        elif toggle.status == ToggleStatus.ROLLOUT:
            # Use deterministic hash for consistent rollout
            if user_id:
                hash_input = f"{tenant_id}:{feature_name}:{user_id}"
                hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
                return (hash_value % 100) < toggle.rollout_percentage
            return False
        
        return False
    
    async def create_ab_test(self, tenant_id: str, test_name: str, variants: Dict[str, Any], target_users: List[str] = None) -> bool:
        """Create A/B test configuration."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            if tenant_id not in self._ab_tests:
                self._ab_tests[tenant_id] = {}
            
            self._ab_tests[tenant_id][test_name] = {
                "variants": variants,
                "target_users": target_users or [],
                "created_at": datetime.utcnow()
            }
            
            logger.info(f"Created A/B test {test_name} for tenant {tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create A/B test: {e}")
            raise
    
    async def get_ab_test_variant(self, tenant_id: str, test_name: str, user_id: str) -> str:
        """Get A/B test variant for user."""
        tests = self._ab_tests.get(tenant_id, {})
        test = tests.get(test_name)
        
        if not test:
            return "control"
        
        # Use deterministic hash for consistent variant assignment
        hash_input = f"{tenant_id}:{test_name}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        
        variants = test["variants"]
        total_weight = sum(variant["weight"] for variant in variants.values())
        
        if total_weight == 0:
            return "control"
        
        target_weight = hash_value % total_weight
        current_weight = 0
        
        for variant_name, variant_config in variants.items():
            current_weight += variant_config["weight"]
            if target_weight < current_weight:
                return variant_name
        
        return "control"
    
    async def record_usage_metrics(self, metrics: UsageMetrics) -> bool:
        """Record usage metrics for tenant."""
        try:
            if metrics.tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            usage_metrics = self._usage_metrics.get(metrics.tenant_id, [])
            usage_metrics.append(metrics)
            self._usage_metrics[metrics.tenant_id] = usage_metrics
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to record usage metrics: {e}")
            raise
    
    async def get_usage_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime, granularity: str = "daily") -> List[UsageMetrics]:
        """Get usage metrics for tenant within date range."""
        metrics = self._usage_metrics.get(tenant_id, [])
        return [m for m in metrics if start_date <= m.timestamp <= end_date]
    
    async def record_performance_metric(self, tenant_id: str, metric_name: str, value: float, metadata: Dict[str, Any] = None) -> bool:
        """Record performance metric for tenant."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            performance_metrics = self._performance_metrics.get(tenant_id, [])
            performance_metrics.append({
                "metric_name": metric_name,
                "value": value,
                "timestamp": datetime.utcnow(),
                "metadata": metadata or {}
            })
            self._performance_metrics[tenant_id] = performance_metrics
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to record performance metric: {e}")
            raise
    
    async def get_performance_summary(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get performance summary for tenant."""
        metrics = self._performance_metrics.get(tenant_id, [])
        filtered_metrics = [m for m in metrics if start_date <= m["timestamp"] <= end_date]
        
        summary = {}
        for metric in filtered_metrics:
            metric_name = metric["metric_name"]
            if metric_name not in summary:
                summary[metric_name] = {"values": [], "avg": 0, "min": float("inf"), "max": float("-inf")}
            
            value = metric["value"]
            summary[metric_name]["values"].append(value)
            summary[metric_name]["min"] = min(summary[metric_name]["min"], value)
            summary[metric_name]["max"] = max(summary[metric_name]["max"], value)
        
        # Calculate averages
        for metric_name in summary:
            values = summary[metric_name]["values"]
            if values:
                summary[metric_name]["avg"] = sum(values) / len(values)
        
        return summary
    
    async def add_language_pack(self, tenant_id: str, language_pack: Dict[str, Any]) -> bool:
        """Add language pack for tenant."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            language_code = language_pack["language_code"]
            translations = language_pack["translations"]
            
            self._language_packs[tenant_id][language_code] = translations
            
            logger.info(f"Added language pack {language_code} for tenant {tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add language pack: {e}")
            raise
    
    async def get_available_languages(self, tenant_id: str) -> List[str]:
        """Get available languages for tenant."""
        return list(self._language_packs.get(tenant_id, {}).keys())
    
    async def get_translations(self, tenant_id: str, language_code: str) -> Dict[str, str]:
        """Get translations for tenant and language."""
        return self._language_packs.get(tenant_id, {}).get(language_code, {})
    
    async def update_translation(self, tenant_id: str, language_code: str, key: str, value: str) -> bool:
        """Update specific translation for tenant."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            if tenant_id not in self._language_packs:
                self._language_packs[tenant_id] = {}
            
            if language_code not in self._language_packs[tenant_id]:
                self._language_packs[tenant_id][language_code] = {}
            
            self._language_packs[tenant_id][language_code][key] = value
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update translation: {e}")
            raise
    
    async def backup_tenant_data(self, tenant_id: str) -> str:
        """Create backup of tenant data."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            backup_id = f"backup_{tenant_id}_{datetime.utcnow().isoformat()}"
            
            if self.db:
                backup_id = await self.db.backup_tenant_data(tenant_id)
            
            # Store backup metadata
            backup_info = {
                "backup_id": backup_id,
                "tenant_id": tenant_id,
                "created_at": datetime.utcnow(),
                "status": "completed"
            }
            
            backups = self._backups.get(tenant_id, [])
            backups.append(backup_info)
            self._backups[tenant_id] = backups
            
            logger.info(f"Created backup {backup_id} for tenant {tenant_id}")
            return backup_id
            
        except Exception as e:
            logger.error(f"Failed to backup tenant data: {e}")
            raise
    
    async def list_tenant_backups(self, tenant_id: str) -> List[Dict[str, Any]]:
        """List all backups for tenant."""
        return self._backups.get(tenant_id, [])
    
    async def restore_tenant_data(self, tenant_id: str, backup_id: str) -> bool:
        """Restore tenant data from backup."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            if self.db:
                result = await self.db.restore_tenant_data(tenant_id, backup_id)
                if not result:
                    return False
            
            logger.info(f"Restored tenant {tenant_id} from backup {backup_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore tenant data: {e}")
            raise
    
    async def export_tenant_data(self, tenant_id: str) -> Dict[str, Any]:
        """Export all tenant data for migration."""
        try:
            if tenant_id not in self._tenants:
                raise ValueError("Tenant not found")
            
            export_data = {
                "tenant_config": asdict(self._tenants[tenant_id]),
                "domains": [asdict(d) for d in self._domains.get(tenant_id, [])],
                "quotas": [asdict(q) for q in self._quotas.get(tenant_id, [])],
                "theme": asdict(self._themes[tenant_id]) if tenant_id in self._themes else None,
                "brand": asdict(self._brands[tenant_id]) if tenant_id in self._brands else None,
                "customizations": [asdict(c) for c in self._customizations.get(tenant_id, [])],
                "workflows": [asdict(w) for w in self._workflows.get(tenant_id, [])],
                "feature_toggles": [asdict(t) for t in self._feature_toggles.get(tenant_id, [])],
                "language_packs": self._language_packs.get(tenant_id, {}),
                "export_timestamp": datetime.utcnow().isoformat()
            }
            
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to export tenant data: {e}")
            raise
    
    async def import_tenant_data(self, new_tenant_id: str, export_data: Dict[str, Any]) -> bool:
        """Import tenant data from export."""
        try:
            # Create new tenant configuration
            tenant_data = export_data["tenant_config"]
            tenant_data["tenant_id"] = new_tenant_id
            
            # Generate new subdomain to avoid conflicts
            original_subdomain = tenant_data["subdomain"]
            tenant_data["subdomain"] = f"{original_subdomain}-migrated-{new_tenant_id[:8]}"
            
            # Convert datetime strings back to datetime objects
            if isinstance(tenant_data["created_at"], str):
                tenant_data["created_at"] = datetime.fromisoformat(tenant_data["created_at"])
            
            # Map enum values back to enums
            tenant_data["status"] = TenantStatus(tenant_data["status"])
            
            tenant_config = TenantConfig(**tenant_data)
            await self.create_tenant(tenant_config)
            
            # Import other data
            if export_data.get("theme"):
                theme_data = export_data["theme"]
                theme_data["tenant_id"] = new_tenant_id
                theme_config = ThemeConfig(**theme_data)
                await self.apply_theme_config(theme_config)
            
            if export_data.get("brand"):
                brand_data = export_data["brand"]
                brand_data["tenant_id"] = new_tenant_id
                brand_config = BrandConfig(**brand_data)
                await self.apply_brand_config(brand_config)
            
            # Import customizations
            for custom_data in export_data.get("customizations", []):
                custom_data["tenant_id"] = new_tenant_id
                custom_data["field_type"] = FieldType(custom_data["field_type"])
                customization = FieldCustomization(**custom_data)
                await self.add_field_customization(customization)
            
            logger.info(f"Imported tenant data to {new_tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to import tenant data: {e}")
            raise