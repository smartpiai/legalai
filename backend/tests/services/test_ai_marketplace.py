"""
Tests for AI Marketplace backend service.
Following strict TDD methodology - tests written first (RED phase).
Week 39-40 implementation for comprehensive marketplace operations.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from unittest.mock import Mock, AsyncMock
import json
from decimal import Decimal

from app.services.ai_marketplace import (
    AIMarketplaceService,
    AppStoreManager,
    DeveloperPortalManager,
    MarketplaceOperationsManager,
    RevenueManager,
    APISDKManager
)


@pytest.fixture
async def marketplace_service(test_db_session):
    """Create AI marketplace service instance."""
    return AIMarketplaceService(test_db_session)


@pytest.fixture
def sample_app_data():
    """Sample app data for testing."""
    return {
        "name": "Legal Contract Analyzer",
        "description": "AI-powered contract analysis and risk assessment",
        "category": "Contract Analysis",
        "version": "1.0.0",
        "pricing_model": "freemium",
        "base_price": Decimal("99.99"),
        "developer_id": "dev-123",
        "tags": ["contract", "analysis", "AI", "risk"],
        "requirements": {
            "min_python_version": "3.8",
            "dependencies": ["openai", "pandas", "numpy"]
        },
        "permissions": ["read_contracts", "write_analysis"]
    }


@pytest.fixture
def sample_developer_data():
    """Sample developer data for testing."""
    return {
        "name": "LegalTech Innovations",
        "email": "dev@legaltech.com",
        "company": "LegalTech Inc",
        "website": "https://legaltech.com",
        "description": "Leading provider of AI legal solutions",
        "verification_status": "verified"
    }


class TestAppStoreInfrastructure:
    """Test app store infrastructure components."""
    
    @pytest.mark.asyncio
    async def test_register_app_success(self, marketplace_service, sample_app_data):
        """Test successful app registration."""
        result = await marketplace_service.register_app(
            app_data=sample_app_data,
            developer_id="dev-123"
        )
        
        assert result["success"] is True
        assert result["app_id"] is not None
        assert result["status"] == "pending_review"
        assert result["version"] == "1.0.0"
    
    @pytest.mark.asyncio
    async def test_register_app_duplicate_name(self, marketplace_service, sample_app_data):
        """Test app registration with duplicate name."""
        # Register first app
        await marketplace_service.register_app(sample_app_data, "dev-123")
        
        # Try to register with same name
        with pytest.raises(ValueError, match="App name already exists"):
            await marketplace_service.register_app(sample_app_data, "dev-123")
    
    @pytest.mark.asyncio
    async def test_publish_app_version(self, marketplace_service, sample_app_data):
        """Test publishing a new app version."""
        # Register app first
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        version_data = {
            "version": "1.1.0",
            "changelog": "Bug fixes and performance improvements",
            "breaking_changes": False
        }
        
        result = await marketplace_service.publish_version(app_id, version_data)
        
        assert result["success"] is True
        assert result["version"] == "1.1.0"
        assert result["status"] == "pending_review"
    
    @pytest.mark.asyncio
    async def test_manage_app_categories(self, marketplace_service):
        """Test app category management."""
        categories = await marketplace_service.get_app_categories()
        
        expected_categories = [
            "Contract Analysis", "Document Review", "Legal Research",
            "Compliance Monitoring", "Risk Assessment", "Workflow Automation"
        ]
        
        for category in expected_categories:
            assert category in categories
    
    @pytest.mark.asyncio
    async def test_search_and_discovery(self, marketplace_service, sample_app_data):
        """Test app search and discovery functionality."""
        # Register multiple apps
        await marketplace_service.register_app(sample_app_data, "dev-123")
        
        app_data_2 = sample_app_data.copy()
        app_data_2["name"] = "Document Reviewer Pro"
        app_data_2["category"] = "Document Review"
        await marketplace_service.register_app(app_data_2, "dev-456")
        
        # Search by category
        results = await marketplace_service.search_apps(
            category="Contract Analysis",
            limit=10
        )
        
        assert len(results) >= 1
        assert results[0]["category"] == "Contract Analysis"
        
        # Search by keyword
        keyword_results = await marketplace_service.search_apps(
            query="contract",
            limit=10
        )
        
        assert len(keyword_results) >= 1
    
    @pytest.mark.asyncio
    async def test_app_ratings_and_reviews(self, marketplace_service, sample_app_data):
        """Test app ratings and reviews system."""
        # Register and approve app
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        await marketplace_service.approve_app(app_id)
        
        # Add review
        review_data = {
            "user_id": "user-789",
            "rating": 5,
            "comment": "Excellent app for contract analysis!",
            "pros": ["Fast analysis", "Accurate results"],
            "cons": ["Could use more templates"]
        }
        
        result = await marketplace_service.add_review(app_id, review_data)
        
        assert result["success"] is True
        assert result["review_id"] is not None
        
        # Get app ratings
        ratings = await marketplace_service.get_app_ratings(app_id)
        
        assert ratings["average_rating"] == 5.0
        assert ratings["total_reviews"] == 1
        assert ratings["rating_distribution"]["5"] == 1
    
    @pytest.mark.asyncio
    async def test_featured_apps_curation(self, marketplace_service, sample_app_data):
        """Test featured apps curation."""
        # Register and approve app
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        await marketplace_service.approve_app(app_id)
        
        # Feature the app
        result = await marketplace_service.feature_app(
            app_id,
            featured_until=datetime.utcnow() + timedelta(days=30),
            priority=1
        )
        
        assert result["success"] is True
        
        # Get featured apps
        featured = await marketplace_service.get_featured_apps()
        
        assert len(featured) >= 1
        assert any(app["app_id"] == app_id for app in featured)
    
    @pytest.mark.asyncio
    async def test_app_installation_tracking(self, marketplace_service, sample_app_data):
        """Test app installation tracking."""
        # Register and approve app
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        await marketplace_service.approve_app(app_id)
        
        # Install app
        install_result = await marketplace_service.install_app(
            app_id,
            user_id="user-789",
            tenant_id="tenant-123"
        )
        
        assert install_result["success"] is True
        assert install_result["installation_id"] is not None
        
        # Get installation stats
        stats = await marketplace_service.get_installation_stats(app_id)
        
        assert stats["total_installations"] >= 1
        assert stats["active_installations"] >= 1
    
    @pytest.mark.asyncio
    async def test_dependency_management(self, marketplace_service, sample_app_data):
        """Test app dependency management."""
        # Create app with dependencies
        app_data = sample_app_data.copy()
        app_data["dependencies"] = ["core-legal-lib>=1.0.0", "nlp-toolkit>=2.1.0"]
        
        app_result = await marketplace_service.register_app(app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Check dependencies
        deps = await marketplace_service.check_dependencies(app_id)
        
        assert "dependencies" in deps
        assert "conflicts" in deps
        assert "missing" in deps
    
    @pytest.mark.asyncio
    async def test_security_scanning(self, marketplace_service, sample_app_data):
        """Test app security scanning."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Run security scan
        scan_result = await marketplace_service.run_security_scan(app_id)
        
        assert "scan_id" in scan_result
        assert "vulnerabilities" in scan_result
        assert "severity_levels" in scan_result
        assert "recommendations" in scan_result


class TestDeveloperPortal:
    """Test developer portal functionality."""
    
    @pytest.mark.asyncio
    async def test_developer_registration(self, marketplace_service, sample_developer_data):
        """Test developer registration."""
        result = await marketplace_service.register_developer(sample_developer_data)
        
        assert result["success"] is True
        assert result["developer_id"] is not None
        assert result["api_key"] is not None
        assert result["status"] == "pending_verification"
    
    @pytest.mark.asyncio
    async def test_api_key_management(self, marketplace_service, sample_developer_data):
        """Test API key management."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Generate new API key
        api_key_result = await marketplace_service.generate_api_key(
            developer_id,
            name="Production Key",
            permissions=["app_management", "analytics"]
        )
        
        assert api_key_result["success"] is True
        assert api_key_result["api_key"] is not None
        
        # List API keys
        keys = await marketplace_service.list_api_keys(developer_id)
        
        assert len(keys) >= 2  # Initial + new key
        
        # Revoke API key
        revoke_result = await marketplace_service.revoke_api_key(
            developer_id,
            api_key_result["key_id"]
        )
        
        assert revoke_result["success"] is True
    
    @pytest.mark.asyncio
    async def test_app_submission_workflow(self, marketplace_service, sample_developer_data, sample_app_data):
        """Test app submission workflow."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Submit app
        submission_result = await marketplace_service.submit_app_for_review(
            developer_id,
            sample_app_data,
            submission_notes="Initial submission for review"
        )
        
        assert submission_result["success"] is True
        assert submission_result["submission_id"] is not None
        assert submission_result["status"] == "submitted"
        
        # Get submission status
        status = await marketplace_service.get_submission_status(
            submission_result["submission_id"]
        )
        
        assert status["current_status"] == "submitted"
        assert "review_timeline" in status
    
    @pytest.mark.asyncio
    async def test_documentation_hosting(self, marketplace_service, sample_developer_data):
        """Test documentation hosting."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Upload documentation
        doc_data = {
            "title": "API Documentation",
            "content": "# API Documentation\n\nThis is the API documentation...",
            "version": "1.0.0",
            "format": "markdown"
        }
        
        doc_result = await marketplace_service.upload_documentation(
            developer_id,
            doc_data
        )
        
        assert doc_result["success"] is True
        assert doc_result["doc_id"] is not None
        assert doc_result["url"] is not None
    
    @pytest.mark.asyncio
    async def test_testing_sandbox_access(self, marketplace_service, sample_developer_data):
        """Test testing sandbox access."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Request sandbox access
        sandbox_result = await marketplace_service.request_sandbox_access(
            developer_id,
            environment="testing",
            duration_days=30
        )
        
        assert sandbox_result["success"] is True
        assert sandbox_result["sandbox_id"] is not None
        assert sandbox_result["access_url"] is not None
        assert sandbox_result["expires_at"] is not None
    
    @pytest.mark.asyncio
    async def test_analytics_dashboard(self, marketplace_service, sample_developer_data, sample_app_data):
        """Test developer analytics dashboard."""
        # Register developer and app
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        app_result = await marketplace_service.register_app(sample_app_data, developer_id)
        app_id = app_result["app_id"]
        
        # Get analytics
        analytics = await marketplace_service.get_developer_analytics(
            developer_id,
            time_range="30d"
        )
        
        assert "app_performance" in analytics
        assert "revenue_metrics" in analytics
        assert "user_engagement" in analytics
        assert "installation_trends" in analytics


class TestMarketplaceOperations:
    """Test marketplace operations management."""
    
    @pytest.mark.asyncio
    async def test_app_review_process(self, marketplace_service, sample_app_data):
        """Test app review process."""
        # Register app
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Start review process
        review_result = await marketplace_service.start_app_review(
            app_id,
            reviewer_id="reviewer-456",
            review_type="security_and_functionality"
        )
        
        assert review_result["success"] is True
        assert review_result["review_id"] is not None
        
        # Add review comments
        comment_result = await marketplace_service.add_review_comment(
            review_result["review_id"],
            comment="Code quality looks good, testing security features",
            category="security"
        )
        
        assert comment_result["success"] is True
        
        # Complete review
        completion_result = await marketplace_service.complete_review(
            review_result["review_id"],
            decision="approved",
            final_notes="App meets all security and quality standards"
        )
        
        assert completion_result["success"] is True
    
    @pytest.mark.asyncio
    async def test_quality_assurance_checks(self, marketplace_service, sample_app_data):
        """Test quality assurance checks."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Run QA checks
        qa_result = await marketplace_service.run_qa_checks(app_id)
        
        assert "performance_score" in qa_result
        assert "code_quality_score" in qa_result
        assert "security_score" in qa_result
        assert "usability_score" in qa_result
        assert "overall_score" in qa_result
        assert qa_result["overall_score"] >= 0
        assert qa_result["overall_score"] <= 100
    
    @pytest.mark.asyncio
    async def test_performance_benchmarking(self, marketplace_service, sample_app_data):
        """Test performance benchmarking."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Run performance benchmark
        benchmark_result = await marketplace_service.run_performance_benchmark(app_id)
        
        assert "response_time_ms" in benchmark_result
        assert "memory_usage_mb" in benchmark_result
        assert "cpu_usage_percent" in benchmark_result
        assert "throughput_requests_per_second" in benchmark_result
        assert "error_rate_percent" in benchmark_result
    
    @pytest.mark.asyncio
    async def test_compatibility_testing(self, marketplace_service, sample_app_data):
        """Test compatibility testing."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Run compatibility tests
        compat_result = await marketplace_service.run_compatibility_tests(app_id)
        
        assert "python_versions" in compat_result
        assert "platform_compatibility" in compat_result
        assert "dependency_compatibility" in compat_result
        assert "api_compatibility" in compat_result
    
    @pytest.mark.asyncio
    async def test_fraud_detection(self, marketplace_service, sample_developer_data):
        """Test fraud detection system."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Run fraud detection
        fraud_result = await marketplace_service.run_fraud_detection(developer_id)
        
        assert "risk_score" in fraud_result
        assert "risk_factors" in fraud_result
        assert "recommendations" in fraud_result
        assert fraud_result["risk_score"] >= 0
        assert fraud_result["risk_score"] <= 100
    
    @pytest.mark.asyncio
    async def test_app_suspension_and_removal(self, marketplace_service, sample_app_data):
        """Test app suspension and removal."""
        # Register and approve app
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        await marketplace_service.approve_app(app_id)
        
        # Suspend app
        suspend_result = await marketplace_service.suspend_app(
            app_id,
            reason="Policy violation",
            suspension_duration_days=7
        )
        
        assert suspend_result["success"] is True
        
        # Remove app
        remove_result = await marketplace_service.remove_app(
            app_id,
            reason="Repeated policy violations"
        )
        
        assert remove_result["success"] is True


class TestRevenueAndMonetization:
    """Test revenue and monetization features."""
    
    @pytest.mark.asyncio
    async def test_pricing_models(self, marketplace_service, sample_app_data):
        """Test different pricing models."""
        pricing_models = [
            {"model": "free", "base_price": Decimal("0.00")},
            {"model": "paid", "base_price": Decimal("49.99")},
            {"model": "freemium", "base_price": Decimal("0.00"), "premium_price": Decimal("99.99")},
            {"model": "subscription", "monthly_price": Decimal("29.99"), "annual_price": Decimal("299.99")},
            {"model": "usage_based", "price_per_request": Decimal("0.01")}
        ]
        
        for pricing in pricing_models:
            app_data = sample_app_data.copy()
            app_data["name"] = f"Test App {pricing['model']}"
            app_data["pricing_model"] = pricing["model"]
            app_data.update(pricing)
            
            result = await marketplace_service.register_app(app_data, "dev-123")
            assert result["success"] is True
    
    @pytest.mark.asyncio
    async def test_revenue_sharing_calculations(self, marketplace_service, sample_app_data):
        """Test revenue sharing calculations."""
        # Register paid app
        app_data = sample_app_data.copy()
        app_data["pricing_model"] = "paid"
        app_data["base_price"] = Decimal("100.00")
        
        app_result = await marketplace_service.register_app(app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Calculate revenue share
        revenue_data = {
            "gross_revenue": Decimal("1000.00"),
            "transaction_fees": Decimal("30.00"),
            "platform_fee_percent": Decimal("15.00")
        }
        
        share_result = await marketplace_service.calculate_revenue_share(
            app_id,
            revenue_data
        )
        
        assert share_result["platform_share"] == Decimal("145.50")  # (1000-30) * 0.15
        assert share_result["developer_share"] == Decimal("824.50")  # (1000-30) * 0.85
        assert share_result["net_revenue"] == Decimal("970.00")  # 1000-30
    
    @pytest.mark.asyncio
    async def test_payment_processing_integration(self, marketplace_service, sample_app_data):
        """Test payment processing integration."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Process payment
        payment_data = {
            "user_id": "user-789",
            "amount": Decimal("99.99"),
            "currency": "USD",
            "payment_method": "stripe",
            "payment_token": "tok_1234567890"
        }
        
        payment_result = await marketplace_service.process_payment(
            app_id,
            payment_data
        )
        
        assert payment_result["success"] is True
        assert payment_result["transaction_id"] is not None
        assert payment_result["status"] == "completed"
    
    @pytest.mark.asyncio
    async def test_invoice_generation(self, marketplace_service, sample_developer_data):
        """Test invoice generation."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Generate invoice
        invoice_data = {
            "period_start": datetime.utcnow() - timedelta(days=30),
            "period_end": datetime.utcnow(),
            "revenue_items": [
                {"app_id": "app-123", "gross_revenue": Decimal("500.00"), "developer_share": Decimal("425.00")},
                {"app_id": "app-456", "gross_revenue": Decimal("300.00"), "developer_share": Decimal("255.00")}
            ]
        }
        
        invoice_result = await marketplace_service.generate_invoice(
            developer_id,
            invoice_data
        )
        
        assert invoice_result["success"] is True
        assert invoice_result["invoice_id"] is not None
        assert invoice_result["total_amount"] == Decimal("680.00")


class TestAPIAndSDKManagement:
    """Test API and SDK management features."""
    
    @pytest.mark.asyncio
    async def test_api_gateway_configuration(self, marketplace_service, sample_app_data):
        """Test API gateway configuration."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Configure API gateway
        gateway_config = {
            "endpoints": [
                {"path": "/analyze", "method": "POST", "rate_limit": 100},
                {"path": "/health", "method": "GET", "rate_limit": 1000}
            ],
            "authentication": "api_key",
            "cors_enabled": True,
            "timeout_seconds": 30
        }
        
        config_result = await marketplace_service.configure_api_gateway(
            app_id,
            gateway_config
        )
        
        assert config_result["success"] is True
        assert config_result["gateway_url"] is not None
    
    @pytest.mark.asyncio
    async def test_rate_limiting_per_app(self, marketplace_service, sample_app_data):
        """Test rate limiting per app."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Set rate limits
        rate_limit_config = {
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "requests_per_day": 10000,
            "burst_limit": 10
        }
        
        limit_result = await marketplace_service.set_rate_limits(
            app_id,
            rate_limit_config
        )
        
        assert limit_result["success"] is True
        
        # Check rate limit status
        status = await marketplace_service.get_rate_limit_status(
            app_id,
            user_id="user-789"
        )
        
        assert "remaining_requests" in status
        assert "reset_time" in status
    
    @pytest.mark.asyncio
    async def test_sdk_versioning(self, marketplace_service):
        """Test SDK versioning."""
        # Create SDK version
        sdk_data = {
            "name": "Legal AI SDK",
            "version": "2.1.0",
            "language": "python",
            "min_version": "3.8",
            "dependencies": ["requests", "pydantic"],
            "changelog": "Added new contract analysis methods"
        }
        
        sdk_result = await marketplace_service.create_sdk_version(sdk_data)
        
        assert sdk_result["success"] is True
        assert sdk_result["sdk_id"] is not None
        
        # Get SDK versions
        versions = await marketplace_service.get_sdk_versions("python")
        
        assert len(versions) >= 1
        assert any(v["version"] == "2.1.0" for v in versions)
    
    @pytest.mark.asyncio
    async def test_webhook_management(self, marketplace_service, sample_app_data):
        """Test webhook management."""
        app_result = await marketplace_service.register_app(sample_app_data, "dev-123")
        app_id = app_result["app_id"]
        
        # Register webhook
        webhook_data = {
            "url": "https://example.com/webhooks/marketplace",
            "events": ["app_installed", "app_uninstalled", "payment_completed"],
            "secret": "webhook_secret_123"
        }
        
        webhook_result = await marketplace_service.register_webhook(
            app_id,
            webhook_data
        )
        
        assert webhook_result["success"] is True
        assert webhook_result["webhook_id"] is not None
        
        # Test webhook delivery
        event_data = {
            "event": "app_installed",
            "app_id": app_id,
            "user_id": "user-789",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        delivery_result = await marketplace_service.deliver_webhook(
            webhook_result["webhook_id"],
            event_data
        )
        
        assert delivery_result["success"] is True


class TestIntegrationScenarios:
    """Test complex integration scenarios."""
    
    @pytest.mark.asyncio
    async def test_complete_app_lifecycle(self, marketplace_service, sample_developer_data, sample_app_data):
        """Test complete app lifecycle from registration to removal."""
        # Register developer
        dev_result = await marketplace_service.register_developer(sample_developer_data)
        developer_id = dev_result["developer_id"]
        
        # Register app
        app_result = await marketplace_service.register_app(sample_app_data, developer_id)
        app_id = app_result["app_id"]
        
        # Submit for review
        await marketplace_service.submit_app_for_review(developer_id, sample_app_data)
        
        # Review and approve
        await marketplace_service.approve_app(app_id)
        
        # Install app
        install_result = await marketplace_service.install_app(app_id, "user-789", "tenant-123")
        
        # Add review
        review_data = {"user_id": "user-789", "rating": 5, "comment": "Great app!"}
        await marketplace_service.add_review(app_id, review_data)
        
        # Process payment
        payment_data = {
            "user_id": "user-789",
            "amount": Decimal("99.99"),
            "currency": "USD",
            "payment_method": "stripe",
            "payment_token": "tok_test"
        }
        await marketplace_service.process_payment(app_id, payment_data)
        
        # Generate analytics
        analytics = await marketplace_service.get_developer_analytics(developer_id, "30d")
        
        assert analytics["app_performance"]["total_apps"] >= 1
        assert analytics["revenue_metrics"]["total_revenue"] >= Decimal("99.99")
        
        # Uninstall app
        uninstall_result = await marketplace_service.uninstall_app(
            install_result["installation_id"]
        )
        
        assert uninstall_result["success"] is True
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, marketplace_service, sample_app_data):
        """Test multi-tenant isolation in marketplace."""
        # Register app for tenant 1
        app_result_1 = await marketplace_service.register_app(
            sample_app_data, 
            "dev-123", 
            tenant_id="tenant-1"
        )
        
        # Register same app for tenant 2
        app_result_2 = await marketplace_service.register_app(
            sample_app_data, 
            "dev-123", 
            tenant_id="tenant-2"
        )
        
        # Both should succeed (different tenants)
        assert app_result_1["success"] is True
        assert app_result_2["success"] is True
        assert app_result_1["app_id"] != app_result_2["app_id"]
        
        # Search should be tenant-isolated
        tenant_1_apps = await marketplace_service.search_apps(
            tenant_id="tenant-1"
        )
        tenant_2_apps = await marketplace_service.search_apps(
            tenant_id="tenant-2"
        )
        
        # Each tenant should only see their own apps
        tenant_1_ids = [app["app_id"] for app in tenant_1_apps]
        tenant_2_ids = [app["app_id"] for app in tenant_2_apps]
        
        assert app_result_1["app_id"] in tenant_1_ids
        assert app_result_1["app_id"] not in tenant_2_ids
        assert app_result_2["app_id"] in tenant_2_ids
        assert app_result_2["app_id"] not in tenant_1_ids
    
    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self, marketplace_service, sample_app_data):
        """Test comprehensive error handling and recovery."""
        # Test invalid app data
        invalid_app_data = sample_app_data.copy()
        invalid_app_data["pricing_model"] = "invalid_model"
        
        with pytest.raises(ValueError, match="Invalid pricing model"):
            await marketplace_service.register_app(invalid_app_data, "dev-123")
        
        # Test missing developer
        with pytest.raises(ValueError, match="Developer not found"):
            await marketplace_service.register_app(sample_app_data, "non-existent-dev")
        
        # Test operation on non-existent app
        with pytest.raises(ValueError, match="App not found"):
            await marketplace_service.approve_app("non-existent-app")