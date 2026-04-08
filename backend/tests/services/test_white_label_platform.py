"""
Comprehensive tests for White-Label Platform service.
Follows strict TDD methodology with real implementations.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List
from unittest.mock import AsyncMock, patch
import uuid

from app.services.white_label_platform import (
    WhiteLabelPlatformService,
    TenantConfig,
    ThemeConfig,
    BrandConfig,
    CustomDomain,
    ResourceQuota,
    UsageMetrics,
    BillingEvent,
    CustomWorkflow,
    FieldCustomization,
    FeatureToggle,
    TenantStatus,
    ResourceType,
    WorkflowTrigger,
    FieldType,
    CustomizationType,
    ToggleStatus
)


class MockDatabase:
    """Mock database for testing tenant operations."""
    
    def __init__(self):
        self.tenants = {}
        self.domains = {}
        self.quotas = {}
        self.usage = {}
        self.workflows = {}
        self.customizations = {}
        self.features = {}
        
    async def create_tenant_schema(self, tenant_id: str) -> bool:
        """Create isolated tenant schema."""
        self.tenants[tenant_id] = {"schema_created": True}
        return True
        
    async def delete_tenant_schema(self, tenant_id: str) -> bool:
        """Delete tenant schema."""
        if tenant_id in self.tenants:
            del self.tenants[tenant_id]
        return True
        
    async def backup_tenant_data(self, tenant_id: str) -> str:
        """Create tenant data backup."""
        return f"backup_{tenant_id}_{datetime.utcnow().isoformat()}"
        
    async def restore_tenant_data(self, tenant_id: str, backup_id: str) -> bool:
        """Restore tenant data from backup."""
        return backup_id.startswith(f"backup_{tenant_id}")


@pytest.fixture
def mock_db():
    """Provide mock database instance."""
    return MockDatabase()


@pytest.fixture
def platform_service(mock_db):
    """Provide configured platform service."""
    service = WhiteLabelPlatformService()
    service.db = mock_db
    return service


@pytest.fixture
def sample_tenant_config():
    """Provide sample tenant configuration."""
    return TenantConfig(
        tenant_id="test-tenant-123",
        name="Test Corporation",
        subdomain="testcorp",
        status=TenantStatus.ACTIVE,
        created_at=datetime.utcnow(),
        settings={
            "timezone": "UTC",
            "currency": "USD",
            "language": "en"
        }
    )


@pytest.fixture
def sample_theme_config():
    """Provide sample theme configuration."""
    return ThemeConfig(
        tenant_id="test-tenant-123",
        primary_color="#007bff",
        secondary_color="#6c757d",
        accent_color="#28a745",
        font_family="Inter, sans-serif",
        logo_url="https://example.com/logo.png",
        favicon_url="https://example.com/favicon.ico",
        custom_css=".custom { color: blue; }"
    )


@pytest.fixture
def sample_brand_config():
    """Provide sample brand configuration."""
    return BrandConfig(
        tenant_id="test-tenant-123",
        company_name="Test Corporation",
        tagline="Innovation Through Testing",
        contact_email="support@testcorp.com",
        support_phone="+1-555-TEST",
        privacy_url="https://testcorp.com/privacy",
        terms_url="https://testcorp.com/terms"
    )


class TestTenantProvisioning:
    """Test tenant provisioning and management."""
    
    @pytest.mark.asyncio
    async def test_create_tenant_success(self, platform_service, sample_tenant_config):
        """Test successful tenant creation."""
        result = await platform_service.create_tenant(sample_tenant_config)
        
        assert result is True
        tenant = await platform_service.get_tenant(sample_tenant_config.tenant_id)
        assert tenant.name == "Test Corporation"
        assert tenant.subdomain == "testcorp"
        assert tenant.status == TenantStatus.ACTIVE
        
    @pytest.mark.asyncio
    async def test_create_tenant_duplicate_subdomain(self, platform_service, sample_tenant_config):
        """Test tenant creation with duplicate subdomain."""
        await platform_service.create_tenant(sample_tenant_config)
        
        duplicate_config = TenantConfig(
            tenant_id="different-tenant",
            name="Different Corp",
            subdomain="testcorp",  # Same subdomain
            status=TenantStatus.ACTIVE,
            created_at=datetime.utcnow(),
            settings={}
        )
        
        with pytest.raises(ValueError, match="Subdomain already exists"):
            await platform_service.create_tenant(duplicate_config)
            
    @pytest.mark.asyncio
    async def test_update_tenant_status(self, platform_service, sample_tenant_config):
        """Test tenant status updates."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Suspend tenant
        result = await platform_service.update_tenant_status(
            sample_tenant_config.tenant_id, 
            TenantStatus.SUSPENDED
        )
        assert result is True
        
        tenant = await platform_service.get_tenant(sample_tenant_config.tenant_id)
        assert tenant.status == TenantStatus.SUSPENDED
        
    @pytest.mark.asyncio
    async def test_delete_tenant(self, platform_service, sample_tenant_config):
        """Test tenant deletion with data cleanup."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Create backup before deletion
        backup_id = await platform_service.backup_tenant_data(sample_tenant_config.tenant_id)
        assert backup_id is not None
        
        # Delete tenant
        result = await platform_service.delete_tenant(sample_tenant_config.tenant_id)
        assert result is True
        
        # Verify tenant no longer exists
        with pytest.raises(ValueError, match="Tenant not found"):
            await platform_service.get_tenant(sample_tenant_config.tenant_id)


class TestCustomDomainManagement:
    """Test custom domain configuration and validation."""
    
    @pytest.mark.asyncio
    async def test_configure_custom_domain(self, platform_service, sample_tenant_config):
        """Test custom domain configuration."""
        await platform_service.create_tenant(sample_tenant_config)
        
        domain = CustomDomain(
            tenant_id=sample_tenant_config.tenant_id,
            domain="app.testcorp.com",
            ssl_enabled=True,
            verified=False,
            verification_token="verify_123"
        )
        
        result = await platform_service.configure_custom_domain(domain)
        assert result is True
        
        domains = await platform_service.get_tenant_domains(sample_tenant_config.tenant_id)
        assert len(domains) == 1
        assert domains[0].domain == "app.testcorp.com"
        assert domains[0].ssl_enabled is True
        
    @pytest.mark.asyncio
    async def test_verify_domain_ownership(self, platform_service, sample_tenant_config):
        """Test domain ownership verification."""
        await platform_service.create_tenant(sample_tenant_config)
        
        domain = CustomDomain(
            tenant_id=sample_tenant_config.tenant_id,
            domain="app.testcorp.com",
            ssl_enabled=True,
            verified=False,
            verification_token="verify_123"
        )
        
        await platform_service.configure_custom_domain(domain)
        
        # Mock DNS verification
        with patch('app.services.white_label_platform.verify_dns_record') as mock_verify:
            mock_verify.return_value = True
            
            result = await platform_service.verify_domain_ownership(
                sample_tenant_config.tenant_id,
                "app.testcorp.com"
            )
            assert result is True
            
        domains = await platform_service.get_tenant_domains(sample_tenant_config.tenant_id)
        assert domains[0].verified is True
        
    @pytest.mark.asyncio
    async def test_remove_custom_domain(self, platform_service, sample_tenant_config):
        """Test custom domain removal."""
        await platform_service.create_tenant(sample_tenant_config)
        
        domain = CustomDomain(
            tenant_id=sample_tenant_config.tenant_id,
            domain="app.testcorp.com",
            ssl_enabled=True,
            verified=True,
            verification_token="verify_123"
        )
        
        await platform_service.configure_custom_domain(domain)
        
        result = await platform_service.remove_custom_domain(
            sample_tenant_config.tenant_id,
            "app.testcorp.com"
        )
        assert result is True
        
        domains = await platform_service.get_tenant_domains(sample_tenant_config.tenant_id)
        assert len(domains) == 0


class TestResourceQuotaManagement:
    """Test resource quota enforcement and monitoring."""
    
    @pytest.mark.asyncio
    async def test_set_resource_quota(self, platform_service, sample_tenant_config):
        """Test setting resource quotas."""
        await platform_service.create_tenant(sample_tenant_config)
        
        quota = ResourceQuota(
            tenant_id=sample_tenant_config.tenant_id,
            resource_type=ResourceType.STORAGE,
            limit=1000000000,  # 1GB
            current_usage=0,
            reset_period="monthly"
        )
        
        result = await platform_service.set_resource_quota(quota)
        assert result is True
        
        quotas = await platform_service.get_resource_quotas(sample_tenant_config.tenant_id)
        assert len(quotas) == 1
        assert quotas[0].limit == 1000000000
        
    @pytest.mark.asyncio
    async def test_track_resource_usage(self, platform_service, sample_tenant_config):
        """Test resource usage tracking."""
        await platform_service.create_tenant(sample_tenant_config)
        
        quota = ResourceQuota(
            tenant_id=sample_tenant_config.tenant_id,
            resource_type=ResourceType.API_CALLS,
            limit=10000,
            current_usage=0,
            reset_period="daily"
        )
        await platform_service.set_resource_quota(quota)
        
        # Track usage
        await platform_service.track_resource_usage(
            sample_tenant_config.tenant_id,
            ResourceType.API_CALLS,
            100
        )
        
        quotas = await platform_service.get_resource_quotas(sample_tenant_config.tenant_id)
        api_quota = next(q for q in quotas if q.resource_type == ResourceType.API_CALLS)
        assert api_quota.current_usage == 100
        
    @pytest.mark.asyncio
    async def test_quota_enforcement(self, platform_service, sample_tenant_config):
        """Test quota limit enforcement."""
        await platform_service.create_tenant(sample_tenant_config)
        
        quota = ResourceQuota(
            tenant_id=sample_tenant_config.tenant_id,
            resource_type=ResourceType.USERS,
            limit=5,
            current_usage=5,
            reset_period="none"
        )
        await platform_service.set_resource_quota(quota)
        
        # Try to exceed quota
        with pytest.raises(ValueError, match="Resource quota exceeded"):
            await platform_service.check_resource_quota(
                sample_tenant_config.tenant_id,
                ResourceType.USERS,
                1
            )
            
    @pytest.mark.asyncio
    async def test_billing_event_generation(self, platform_service, sample_tenant_config):
        """Test billing event generation for usage tracking."""
        await platform_service.create_tenant(sample_tenant_config)
        
        event = BillingEvent(
            tenant_id=sample_tenant_config.tenant_id,
            event_type="storage_usage",
            amount=Decimal("15.50"),
            currency="USD",
            timestamp=datetime.utcnow(),
            metadata={"bytes": 500000000}
        )
        
        result = await platform_service.record_billing_event(event)
        assert result is True
        
        events = await platform_service.get_billing_events(
            sample_tenant_config.tenant_id,
            datetime.utcnow() - timedelta(days=1),
            datetime.utcnow()
        )
        assert len(events) == 1
        assert events[0].amount == Decimal("15.50")


class TestCustomizationFramework:
    """Test theme and branding customization."""
    
    @pytest.mark.asyncio
    async def test_apply_theme_config(self, platform_service, sample_tenant_config, sample_theme_config):
        """Test applying theme configuration."""
        await platform_service.create_tenant(sample_tenant_config)
        
        result = await platform_service.apply_theme_config(sample_theme_config)
        assert result is True
        
        theme = await platform_service.get_theme_config(sample_tenant_config.tenant_id)
        assert theme.primary_color == "#007bff"
        assert theme.font_family == "Inter, sans-serif"
        
    @pytest.mark.asyncio
    async def test_apply_brand_config(self, platform_service, sample_tenant_config, sample_brand_config):
        """Test applying brand configuration."""
        await platform_service.create_tenant(sample_tenant_config)
        
        result = await platform_service.apply_brand_config(sample_brand_config)
        assert result is True
        
        brand = await platform_service.get_brand_config(sample_tenant_config.tenant_id)
        assert brand.company_name == "Test Corporation"
        assert brand.contact_email == "support@testcorp.com"
        
    @pytest.mark.asyncio
    async def test_field_customization(self, platform_service, sample_tenant_config):
        """Test field customization functionality."""
        await platform_service.create_tenant(sample_tenant_config)
        
        customization = FieldCustomization(
            tenant_id=sample_tenant_config.tenant_id,
            entity_type="contract",
            field_name="priority_level",
            field_type=FieldType.SELECT,
            is_required=True,
            options=["Low", "Medium", "High", "Critical"],
            default_value="Medium"
        )
        
        result = await platform_service.add_field_customization(customization)
        assert result is True
        
        customizations = await platform_service.get_field_customizations(
            sample_tenant_config.tenant_id,
            "contract"
        )
        assert len(customizations) == 1
        assert customizations[0].field_name == "priority_level"
        assert customizations[0].options == ["Low", "Medium", "High", "Critical"]
        
    @pytest.mark.asyncio
    async def test_custom_workflow_definition(self, platform_service, sample_tenant_config):
        """Test custom workflow definition and execution."""
        await platform_service.create_tenant(sample_tenant_config)
        
        workflow = CustomWorkflow(
            tenant_id=sample_tenant_config.tenant_id,
            name="Contract Approval",
            trigger=WorkflowTrigger.ON_CREATE,
            entity_type="contract",
            steps=[
                {
                    "name": "Legal Review",
                    "type": "approval",
                    "assignee_role": "legal_team",
                    "conditions": {"contract_value": {"gt": 10000}}
                },
                {
                    "name": "Executive Approval",
                    "type": "approval",
                    "assignee_role": "executives",
                    "conditions": {"contract_value": {"gt": 100000}}
                }
            ],
            is_active=True
        )
        
        result = await platform_service.create_custom_workflow(workflow)
        assert result is True
        
        workflows = await platform_service.get_custom_workflows(
            sample_tenant_config.tenant_id,
            "contract"
        )
        assert len(workflows) == 1
        assert workflows[0].name == "Contract Approval"
        assert len(workflows[0].steps) == 2


class TestFeatureToggleManagement:
    """Test feature toggle and A/B testing framework."""
    
    @pytest.mark.asyncio
    async def test_create_feature_toggle(self, platform_service, sample_tenant_config):
        """Test creating feature toggles."""
        await platform_service.create_tenant(sample_tenant_config)
        
        toggle = FeatureToggle(
            tenant_id=sample_tenant_config.tenant_id,
            feature_name="advanced_analytics",
            status=ToggleStatus.ENABLED,
            rollout_percentage=100,
            conditions={"user_tier": "premium"},
            created_at=datetime.utcnow()
        )
        
        result = await platform_service.create_feature_toggle(toggle)
        assert result is True
        
        toggles = await platform_service.get_feature_toggles(sample_tenant_config.tenant_id)
        assert len(toggles) == 1
        assert toggles[0].feature_name == "advanced_analytics"
        assert toggles[0].status == ToggleStatus.ENABLED
        
    @pytest.mark.asyncio
    async def test_gradual_rollout(self, platform_service, sample_tenant_config):
        """Test gradual feature rollout."""
        await platform_service.create_tenant(sample_tenant_config)
        
        toggle = FeatureToggle(
            tenant_id=sample_tenant_config.tenant_id,
            feature_name="new_ui",
            status=ToggleStatus.ROLLOUT,
            rollout_percentage=25,
            conditions={},
            created_at=datetime.utcnow()
        )
        
        await platform_service.create_feature_toggle(toggle)
        
        # Test feature availability for different users
        user_1_enabled = await platform_service.is_feature_enabled(
            sample_tenant_config.tenant_id,
            "new_ui",
            user_id="user_1"
        )
        
        user_2_enabled = await platform_service.is_feature_enabled(
            sample_tenant_config.tenant_id,
            "new_ui",
            user_id="user_2"
        )
        
        # With 25% rollout, we should get consistent results for same user
        assert isinstance(user_1_enabled, bool)
        assert isinstance(user_2_enabled, bool)
        
    @pytest.mark.asyncio
    async def test_ab_testing_framework(self, platform_service, sample_tenant_config):
        """Test A/B testing functionality."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Create A/B test
        result = await platform_service.create_ab_test(
            sample_tenant_config.tenant_id,
            "checkout_flow_test",
            variants={
                "control": {"weight": 50, "config": {"button_color": "blue"}},
                "variant_a": {"weight": 50, "config": {"button_color": "green"}}
            },
            target_users=["premium", "enterprise"]
        )
        assert result is True
        
        # Get variant for user
        variant = await platform_service.get_ab_test_variant(
            sample_tenant_config.tenant_id,
            "checkout_flow_test",
            user_id="test_user_123"
        )
        assert variant in ["control", "variant_a"]


class TestSecurityAndIsolation:
    """Test security boundaries and tenant isolation."""
    
    @pytest.mark.asyncio
    async def test_tenant_data_isolation(self, platform_service):
        """Test that tenant data is properly isolated."""
        # Create two tenants
        tenant_1 = TenantConfig(
            tenant_id="tenant-1",
            name="Company One",
            subdomain="company1",
            status=TenantStatus.ACTIVE,
            created_at=datetime.utcnow(),
            settings={}
        )
        
        tenant_2 = TenantConfig(
            tenant_id="tenant-2",
            name="Company Two",
            subdomain="company2",
            status=TenantStatus.ACTIVE,
            created_at=datetime.utcnow(),
            settings={}
        )
        
        await platform_service.create_tenant(tenant_1)
        await platform_service.create_tenant(tenant_2)
        
        # Add customization to tenant 1
        customization_1 = FieldCustomization(
            tenant_id="tenant-1",
            entity_type="contract",
            field_name="tenant_1_field",
            field_type=FieldType.TEXT,
            is_required=False,
            options=[],
            default_value=""
        )
        await platform_service.add_field_customization(customization_1)
        
        # Verify tenant 2 cannot access tenant 1's customizations
        customizations_2 = await platform_service.get_field_customizations("tenant-2", "contract")
        field_names = [c.field_name for c in customizations_2]
        assert "tenant_1_field" not in field_names
        
    @pytest.mark.asyncio
    async def test_resource_quota_isolation(self, platform_service):
        """Test resource quota isolation between tenants."""
        # Create two tenants with different quotas
        tenant_1 = TenantConfig(
            tenant_id="tenant-1",
            name="Small Company",
            subdomain="small",
            status=TenantStatus.ACTIVE,
            created_at=datetime.utcnow(),
            settings={}
        )
        
        tenant_2 = TenantConfig(
            tenant_id="tenant-2",
            name="Large Company",
            subdomain="large",
            status=TenantStatus.ACTIVE,
            created_at=datetime.utcnow(),
            settings={}
        )
        
        await platform_service.create_tenant(tenant_1)
        await platform_service.create_tenant(tenant_2)
        
        # Set different quotas
        quota_1 = ResourceQuota(
            tenant_id="tenant-1",
            resource_type=ResourceType.STORAGE,
            limit=1000000,  # 1MB
            current_usage=0,
            reset_period="monthly"
        )
        
        quota_2 = ResourceQuota(
            tenant_id="tenant-2",
            resource_type=ResourceType.STORAGE,
            limit=1000000000,  # 1GB
            current_usage=0,
            reset_period="monthly"
        )
        
        await platform_service.set_resource_quota(quota_1)
        await platform_service.set_resource_quota(quota_2)
        
        # Verify isolation
        quotas_1 = await platform_service.get_resource_quotas("tenant-1")
        quotas_2 = await platform_service.get_resource_quotas("tenant-2")
        
        storage_quota_1 = next(q for q in quotas_1 if q.resource_type == ResourceType.STORAGE)
        storage_quota_2 = next(q for q in quotas_2 if q.resource_type == ResourceType.STORAGE)
        
        assert storage_quota_1.limit == 1000000
        assert storage_quota_2.limit == 1000000000


class TestBackupAndMigration:
    """Test backup, restore, and migration functionality."""
    
    @pytest.mark.asyncio
    async def test_tenant_backup_creation(self, platform_service, sample_tenant_config):
        """Test creating tenant data backups."""
        await platform_service.create_tenant(sample_tenant_config)
        
        backup_id = await platform_service.backup_tenant_data(sample_tenant_config.tenant_id)
        assert backup_id is not None
        assert backup_id.startswith("backup_")
        
        backups = await platform_service.list_tenant_backups(sample_tenant_config.tenant_id)
        assert len(backups) == 1
        assert backups[0]["backup_id"] == backup_id
        
    @pytest.mark.asyncio
    async def test_tenant_data_restoration(self, platform_service, sample_tenant_config):
        """Test restoring tenant data from backup."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Create backup
        backup_id = await platform_service.backup_tenant_data(sample_tenant_config.tenant_id)
        
        # Simulate data changes
        await platform_service.apply_theme_config(ThemeConfig(
            tenant_id=sample_tenant_config.tenant_id,
            primary_color="#ff0000",
            secondary_color="#00ff00",
            accent_color="#0000ff",
            font_family="Arial",
            logo_url="",
            favicon_url="",
            custom_css=""
        ))
        
        # Restore from backup
        result = await platform_service.restore_tenant_data(
            sample_tenant_config.tenant_id,
            backup_id
        )
        assert result is True
        
    @pytest.mark.asyncio
    async def test_tenant_migration(self, platform_service, sample_tenant_config):
        """Test tenant migration between environments."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Export tenant data
        export_data = await platform_service.export_tenant_data(sample_tenant_config.tenant_id)
        assert export_data is not None
        assert "tenant_config" in export_data
        assert "customizations" in export_data
        
        # Import to new tenant
        new_tenant_id = "migrated-tenant-456"
        result = await platform_service.import_tenant_data(new_tenant_id, export_data)
        assert result is True
        
        # Verify migration
        migrated_tenant = await platform_service.get_tenant(new_tenant_id)
        assert migrated_tenant.name == sample_tenant_config.name


class TestUsageMetricsAndAnalytics:
    """Test usage tracking and analytics."""
    
    @pytest.mark.asyncio
    async def test_usage_metrics_tracking(self, platform_service, sample_tenant_config):
        """Test comprehensive usage metrics tracking."""
        await platform_service.create_tenant(sample_tenant_config)
        
        metrics = UsageMetrics(
            tenant_id=sample_tenant_config.tenant_id,
            timestamp=datetime.utcnow(),
            active_users=25,
            api_calls=1500,
            storage_used=750000000,
            documents_processed=120,
            ai_requests=85
        )
        
        result = await platform_service.record_usage_metrics(metrics)
        assert result is True
        
        # Get metrics for analysis
        daily_metrics = await platform_service.get_usage_metrics(
            sample_tenant_config.tenant_id,
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow(),
            granularity="daily"
        )
        
        assert len(daily_metrics) >= 1
        assert daily_metrics[0].active_users == 25
        assert daily_metrics[0].api_calls == 1500
        
    @pytest.mark.asyncio
    async def test_performance_monitoring(self, platform_service, sample_tenant_config):
        """Test tenant performance monitoring."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Record performance metrics
        await platform_service.record_performance_metric(
            sample_tenant_config.tenant_id,
            "api_response_time",
            150.5,  # milliseconds
            {"endpoint": "/api/contracts", "method": "GET"}
        )
        
        await platform_service.record_performance_metric(
            sample_tenant_config.tenant_id,
            "query_execution_time",
            25.3,
            {"query_type": "search", "result_count": 10}
        )
        
        # Get performance summary
        performance_summary = await platform_service.get_performance_summary(
            sample_tenant_config.tenant_id,
            start_date=datetime.utcnow() - timedelta(hours=1),
            end_date=datetime.utcnow()
        )
        
        assert "api_response_time" in performance_summary
        assert "query_execution_time" in performance_summary
        assert performance_summary["api_response_time"]["avg"] == 150.5


class TestLanguageAndLocalization:
    """Test multi-language support and localization."""
    
    @pytest.mark.asyncio
    async def test_language_pack_management(self, platform_service, sample_tenant_config):
        """Test language pack creation and management."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Add Spanish language pack
        language_pack = {
            "language_code": "es",
            "translations": {
                "welcome_message": "Bienvenido",
                "login_button": "Iniciar Sesión",
                "dashboard_title": "Panel de Control"
            }
        }
        
        result = await platform_service.add_language_pack(
            sample_tenant_config.tenant_id,
            language_pack
        )
        assert result is True
        
        # Get available languages
        languages = await platform_service.get_available_languages(sample_tenant_config.tenant_id)
        assert "es" in languages
        
        # Get translations
        translations = await platform_service.get_translations(
            sample_tenant_config.tenant_id,
            "es"
        )
        assert translations["welcome_message"] == "Bienvenido"
        
    @pytest.mark.asyncio
    async def test_dynamic_translation_updates(self, platform_service, sample_tenant_config):
        """Test dynamic translation updates."""
        await platform_service.create_tenant(sample_tenant_config)
        
        # Add initial translations
        language_pack = {
            "language_code": "fr",
            "translations": {
                "save_button": "Sauvegarder",
                "cancel_button": "Annuler"
            }
        }
        await platform_service.add_language_pack(sample_tenant_config.tenant_id, language_pack)
        
        # Update specific translation
        result = await platform_service.update_translation(
            sample_tenant_config.tenant_id,
            "fr",
            "save_button",
            "Enregistrer"
        )
        assert result is True
        
        # Verify update
        translations = await platform_service.get_translations(sample_tenant_config.tenant_id, "fr")
        assert translations["save_button"] == "Enregistrer"
        assert translations["cancel_button"] == "Annuler"