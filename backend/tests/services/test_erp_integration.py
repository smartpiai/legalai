"""
Comprehensive ERP Deep Integration Service Tests
Week 31-32 Roadmap Implementation - Following strict TDD methodology
Tests for SAP S/4HANA, Oracle Cloud, Microsoft Dynamics 365, and NetSuite integrations
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, List, Any, Optional
import json
import hashlib
import hmac
from unittest.mock import AsyncMock, patch

from app.services.erp_integration import (
    ERPIntegrationService,
    ERPProvider,
    SyncMode,
    SyncStatus,
    SyncDirection,
    ERPConfiguration,
    SyncJob,
    FieldMapping,
    ConflictResolution,
    ERPAuthConfig,
    WebhookConfig,
    ERPIntegrationError,
    ERPAuthenticationError,
    ERPSyncError,
    ERPValidationError,
    TransformationEngine,
    RateLimiter,
    AuditLogger
)


class TestERPDeepIntegrationService:
    """Comprehensive test suite for ERP Deep Integration service covering all major ERP systems"""

    @pytest.fixture
    async def service(self):
        """Create ERP integration service instance"""
        return ERPIntegrationService()

    @pytest.fixture
    def sap_config(self):
        """SAP S/4HANA configuration fixture"""
        return ERPConfiguration(
            provider=ERPProvider.SAP_S4HANA,
            tenant_id=uuid4(),
            name="SAP Production",
            endpoint="https://sap.company.com/api/v1",
            auth_config=ERPAuthConfig(
                auth_type="oauth2",
                client_id="sap_client_123",
                client_secret="sap_secret_456",
                scope="finance,supply_chain,hr"
            ),
            field_mappings=[
                FieldMapping(
                    source_field="customer_id",
                    target_field="KUNNR",
                    transformation="string_to_sap_id"
                ),
                FieldMapping(
                    source_field="amount",
                    target_field="WRBTR",
                    transformation="currency_conversion"
                )
            ],
            webhook_config=WebhookConfig(
                url="https://ourapp.com/webhooks/sap",
                secret="webhook_secret_123",
                events=["finance.invoice.created", "supply_chain.order.updated"]
            ),
            sync_modules=["finance", "supply_chain", "hr", "master_data"],
            batch_size=1000,
            rate_limit=100,
            conflict_resolution=ConflictResolution.LAST_WRITE_WINS,
            active=True
        )

    @pytest.fixture
    def oracle_config(self):
        """Oracle Cloud ERP configuration fixture"""
        return ERPConfiguration(
            provider=ERPProvider.ORACLE_CLOUD,
            tenant_id=uuid4(),
            name="Oracle Production",
            endpoint="https://oracle.company.com/fscmRestApi/resources/11.13.18.05",
            auth_config=ERPAuthConfig(
                auth_type="oauth2",
                client_id="oracle_client_789",
                client_secret="oracle_secret_012",
                scope="financial,procurement,projects,risk"
            ),
            field_mappings=[
                FieldMapping(
                    source_field="invoice_number",
                    target_field="InvoiceNumber",
                    transformation="format_invoice_number"
                )
            ],
            webhook_config=WebhookConfig(
                url="https://ourapp.com/webhooks/oracle",
                secret="oracle_webhook_secret",
                events=["financial.invoice.approved", "procurement.order.received"]
            ),
            sync_modules=["financial", "procurement", "projects", "risk", "analytics"],
            batch_size=500,
            rate_limit=50,
            conflict_resolution=ConflictResolution.MANUAL_REVIEW,
            active=True
        )

    @pytest.fixture
    def dynamics_config(self):
        """Microsoft Dynamics 365 configuration fixture"""
        return ERPConfiguration(
            provider=ERPProvider.MICROSOFT_DYNAMICS,
            tenant_id=uuid4(),
            name="Dynamics 365",
            endpoint="https://dynamics.company.com/api/data/v9.2",
            auth_config=ERPAuthConfig(
                auth_type="oauth2",
                client_id="dynamics_client_345",
                client_secret="dynamics_secret_678",
                scope="finance,operations,commerce,hr"
            ),
            field_mappings=[
                FieldMapping(
                    source_field="employee_id",
                    target_field="systemuserid",
                    transformation="guid_conversion"
                )
            ],
            webhook_config=WebhookConfig(
                url="https://ourapp.com/webhooks/dynamics",
                secret="dynamics_webhook_secret",
                events=["finance.transaction.posted", "hr.employee.updated"]
            ),
            sync_modules=["finance", "operations", "commerce", "hr", "business_intelligence"],
            batch_size=750,
            rate_limit=75,
            conflict_resolution=ConflictResolution.SOURCE_WINS,
            active=True
        )

    @pytest.fixture
    def netsuite_config(self):
        """NetSuite configuration fixture"""
        return ERPConfiguration(
            provider=ERPProvider.NETSUITE,
            tenant_id=uuid4(),
            name="NetSuite Production",
            endpoint="https://123456.suitetalk.api.netsuite.com/services/NetSuitePort_2021_2",
            auth_config=ERPAuthConfig(
                auth_type="token_based",
                consumer_key="netsuite_consumer_123",
                consumer_secret="netsuite_consumer_secret",
                token_id="netsuite_token_456",
                token_secret="netsuite_token_secret"
            ),
            field_mappings=[
                FieldMapping(
                    source_field="product_sku",
                    target_field="itemid",
                    transformation="sku_normalization"
                )
            ],
            webhook_config=WebhookConfig(
                url="https://ourapp.com/webhooks/netsuite",
                secret="netsuite_webhook_secret",
                events=["financial.invoice.created", "inventory.item.updated"]
            ),
            sync_modules=["financial", "crm", "ecommerce", "inventory", "business_intelligence"],
            batch_size=250,
            rate_limit=25,
            conflict_resolution=ConflictResolution.MERGE_FIELDS,
            active=True
        )

    async def test_create_configuration_sap(self, service, sap_config):
        """Test creating SAP S/4HANA configuration"""
        config_id = await service.create_configuration(sap_config)
        assert config_id is not None
        
        retrieved_config = await service.get_configuration(config_id)
        assert retrieved_config.provider == ERPProvider.SAP_S4HANA
        assert retrieved_config.name == "SAP Production"
        assert len(retrieved_config.sync_modules) == 4
        assert "finance" in retrieved_config.sync_modules

    async def test_create_configuration_oracle(self, service, oracle_config):
        """Test creating Oracle Cloud ERP configuration"""
        config_id = await service.create_configuration(oracle_config)
        assert config_id is not None
        
        retrieved_config = await service.get_configuration(config_id)
        assert retrieved_config.provider == ERPProvider.ORACLE_CLOUD
        assert retrieved_config.batch_size == 500
        assert retrieved_config.conflict_resolution == ConflictResolution.MANUAL_REVIEW

    async def test_create_configuration_dynamics(self, service, dynamics_config):
        """Test creating Microsoft Dynamics 365 configuration"""
        config_id = await service.create_configuration(dynamics_config)
        assert config_id is not None
        
        retrieved_config = await service.get_configuration(config_id)
        assert retrieved_config.provider == ERPProvider.MICROSOFT_DYNAMICS
        assert "business_intelligence" in retrieved_config.sync_modules

    async def test_create_configuration_netsuite(self, service, netsuite_config):
        """Test creating NetSuite configuration"""
        config_id = await service.create_configuration(netsuite_config)
        assert config_id is not None
        
        retrieved_config = await service.get_configuration(config_id)
        assert retrieved_config.provider == ERPProvider.NETSUITE
        assert retrieved_config.auth_config.auth_type == "token_based"

    async def test_authenticate_sap(self, service, sap_config):
        """Test SAP S/4HANA authentication"""
        config_id = await service.create_configuration(sap_config)
        
        with patch.object(service, '_make_oauth_request') as mock_oauth:
            mock_oauth.return_value = {
                "access_token": "sap_access_token_123",
                "token_type": "Bearer",
                "expires_in": 3600
            }
            
            auth_result = await service.authenticate(config_id)
            assert auth_result is True
            
            # Verify token storage
            tokens = await service.get_auth_tokens(config_id)
            assert tokens["access_token"] == "sap_access_token_123"

    async def test_authenticate_oracle(self, service, oracle_config):
        """Test Oracle Cloud ERP authentication"""
        config_id = await service.create_configuration(oracle_config)
        
        with patch.object(service, '_make_oauth_request') as mock_oauth:
            mock_oauth.return_value = {
                "access_token": "oracle_access_token_456",
                "token_type": "Bearer", 
                "expires_in": 7200
            }
            
            auth_result = await service.authenticate(config_id)
            assert auth_result is True

    async def test_authentication_failure(self, service, sap_config):
        """Test authentication failure handling"""
        config_id = await service.create_configuration(sap_config)
        
        with patch.object(service, '_make_oauth_request') as mock_oauth:
            mock_oauth.side_effect = ERPAuthenticationError("Invalid credentials")
            
            with pytest.raises(ERPAuthenticationError):
                await service.authenticate(config_id)

    async def test_start_real_time_sync_sap(self, service, sap_config):
        """Test starting real-time sync for SAP"""
        config_id = await service.create_configuration(sap_config)
        await service.authenticate(config_id)
        
        sync_job = await service.start_sync(
            config_id=config_id,
            sync_mode=SyncMode.REAL_TIME,
            direction=SyncDirection.BIDIRECTIONAL,
            modules=["finance", "supply_chain"]
        )
        
        assert sync_job.sync_mode == SyncMode.REAL_TIME
        assert sync_job.status == SyncStatus.RUNNING
        assert sync_job.direction == SyncDirection.BIDIRECTIONAL
        assert "finance" in sync_job.modules

    async def test_start_batch_sync_oracle(self, service, oracle_config):
        """Test starting batch sync for Oracle"""
        config_id = await service.create_configuration(oracle_config)
        await service.authenticate(config_id)
        
        sync_job = await service.start_sync(
            config_id=config_id,
            sync_mode=SyncMode.BATCH,
            direction=SyncDirection.INBOUND,
            modules=["financial", "procurement"]
        )
        
        assert sync_job.sync_mode == SyncMode.BATCH
        assert sync_job.direction == SyncDirection.INBOUND

    async def test_field_mapping_transformation_sap(self, service, sap_config):
        """Test field mapping and transformation for SAP"""
        config_id = await service.create_configuration(sap_config)
        
        source_data = {
            "customer_id": "CUST_12345",
            "amount": "1500.50",
            "currency": "USD"
        }
        
        transformed_data = await service.transform_data(config_id, source_data)
        
        assert "KUNNR" in transformed_data
        assert "WRBTR" in transformed_data
        assert transformed_data["KUNNR"] == "CUST_12345"

    async def test_field_mapping_transformation_oracle(self, service, oracle_config):
        """Test field mapping and transformation for Oracle"""
        config_id = await service.create_configuration(oracle_config)
        
        source_data = {
            "invoice_number": "INV-2024-001",
            "supplier_id": "SUPP_789"
        }
        
        transformed_data = await service.transform_data(config_id, source_data)
        
        assert "InvoiceNumber" in transformed_data
        assert transformed_data["InvoiceNumber"] == "INV-2024-001"

    async def test_bi_directional_sync_dynamics(self, service, dynamics_config):
        """Test bi-directional synchronization with Dynamics 365"""
        config_id = await service.create_configuration(dynamics_config)
        await service.authenticate(config_id)
        
        # Test outbound sync
        outbound_data = {
            "employee_id": "EMP_001",
            "name": "John Doe",
            "department": "Finance"
        }
        
        with patch.object(service, '_send_to_erp') as mock_send:
            mock_send.return_value = {"success": True, "id": "dynamics_emp_123"}
            
            result = await service.sync_outbound(config_id, "hr", outbound_data)
            assert result["success"] is True
        
        # Test inbound sync
        with patch.object(service, '_fetch_from_erp') as mock_fetch:
            mock_fetch.return_value = [
                {"systemuserid": "guid_123", "fullname": "Jane Smith"}
            ]
            
            inbound_data = await service.sync_inbound(config_id, "hr")
            assert len(inbound_data) == 1
            assert "fullname" in inbound_data[0]

    async def test_batch_processing_netsuite(self, service, netsuite_config):
        """Test batch processing for NetSuite"""
        config_id = await service.create_configuration(netsuite_config)
        await service.authenticate(config_id)
        
        batch_data = [
            {"product_sku": "SKU_001", "name": "Product 1"},
            {"product_sku": "SKU_002", "name": "Product 2"},
            {"product_sku": "SKU_003", "name": "Product 3"}
        ]
        
        with patch.object(service, '_process_batch') as mock_batch:
            mock_batch.return_value = {
                "processed": 3,
                "failed": 0,
                "batch_id": "batch_123"
            }
            
            result = await service.process_batch(config_id, "inventory", batch_data)
            assert result["processed"] == 3
            assert result["failed"] == 0

    async def test_conflict_resolution_last_write_wins(self, service, sap_config):
        """Test conflict resolution with last write wins strategy"""
        config_id = await service.create_configuration(sap_config)
        
        local_record = {
            "id": "RECORD_001",
            "amount": "1000.00",
            "updated_at": "2024-01-15T10:00:00Z"
        }
        
        remote_record = {
            "id": "RECORD_001", 
            "amount": "1500.00",
            "updated_at": "2024-01-15T11:00:00Z"
        }
        
        resolved = await service.resolve_conflict(
            config_id, local_record, remote_record
        )
        
        # Remote record should win (later timestamp)
        assert resolved["amount"] == "1500.00"

    async def test_conflict_resolution_manual_review(self, service, oracle_config):
        """Test conflict resolution with manual review strategy"""
        config_id = await service.create_configuration(oracle_config)
        
        local_record = {"id": "REC_001", "status": "approved"}
        remote_record = {"id": "REC_001", "status": "pending"}
        
        with patch.object(service, '_create_conflict_review') as mock_review:
            mock_review.return_value = "conflict_review_123"
            
            resolved = await service.resolve_conflict(
                config_id, local_record, remote_record
            )
            
            assert resolved is None  # Requires manual review
            mock_review.assert_called_once()

    async def test_webhook_processing_sap(self, service, sap_config):
        """Test webhook processing for SAP events"""
        config_id = await service.create_configuration(sap_config)
        
        webhook_payload = {
            "event": "finance.invoice.created",
            "data": {
                "invoice_id": "INV_SAP_001",
                "amount": "2500.00",
                "customer_id": "CUST_456"
            },
            "timestamp": "2024-01-15T12:00:00Z"
        }
        
        with patch.object(service, '_verify_webhook_signature') as mock_verify:
            mock_verify.return_value = True
            
            result = await service.process_webhook(config_id, webhook_payload)
            assert result["processed"] is True
            assert result["event"] == "finance.invoice.created"

    async def test_webhook_signature_verification(self, service, sap_config):
        """Test webhook signature verification"""
        config_id = await service.create_configuration(sap_config)
        
        webhook_payload = {"event": "test.event", "data": {}}
        invalid_signature = "invalid_signature"
        
        with patch.object(service, '_verify_webhook_signature') as mock_verify:
            mock_verify.return_value = False
            
            with pytest.raises(ERPValidationError):
                await service.process_webhook(
                    config_id, webhook_payload, signature=invalid_signature
                )

    async def test_data_validation_sap(self, service, sap_config):
        """Test data validation for SAP integration"""
        config_id = await service.create_configuration(sap_config)
        
        valid_data = {
            "customer_id": "CUST_123",
            "amount": "1000.00",
            "currency": "USD"
        }
        
        is_valid = await service.validate_data(config_id, "finance", valid_data)
        assert is_valid is True
        
        invalid_data = {
            "customer_id": "",  # Empty required field
            "amount": "invalid_amount"
        }
        
        with pytest.raises(ERPValidationError):
            await service.validate_data(config_id, "finance", invalid_data)

    async def test_transaction_rollback_oracle(self, service, oracle_config):
        """Test transaction rollback for Oracle integration"""
        config_id = await service.create_configuration(oracle_config)
        
        transaction_data = [
            {"invoice_id": "INV_001", "amount": "1000.00"},
            {"invoice_id": "INV_002", "amount": "invalid"}  # Will cause error
        ]
        
        with patch.object(service, '_execute_transaction') as mock_exec:
            mock_exec.side_effect = ERPSyncError("Validation failed")
            
            with pytest.raises(ERPSyncError):
                await service.execute_transaction(config_id, transaction_data)
            
            # Verify rollback was triggered
            rollback_called = await service.check_rollback_status(config_id)
            assert rollback_called is True

    async def test_error_handling_and_retry(self, service, dynamics_config):
        """Test error handling and retry logic"""
        config_id = await service.create_configuration(dynamics_config)
        
        with patch.object(service, '_make_api_call') as mock_call:
            # First two calls fail, third succeeds
            mock_call.side_effect = [
                ERPSyncError("Temporary error"),
                ERPSyncError("Network timeout"),
                {"success": True, "data": "result"}
            ]
            
            result = await service.sync_with_retry(
                config_id, "finance", {"test": "data"}
            )
            
            assert result["success"] is True
            assert mock_call.call_count == 3

    async def test_audit_trail_logging(self, service, netsuite_config):
        """Test audit trail logging for all operations"""
        config_id = await service.create_configuration(netsuite_config)
        
        with patch.object(service, '_log_audit_event') as mock_log:
            await service.sync_outbound(config_id, "inventory", {"sku": "TEST_001"})
            
            # Verify audit logging was called
            mock_log.assert_called()
            call_args = mock_log.call_args[1]
            assert call_args["action"] == "sync_outbound"
            assert call_args["module"] == "inventory"

    async def test_multi_tenant_isolation(self, service, sap_config, oracle_config):
        """Test multi-tenant data isolation"""
        tenant1_id = uuid4()
        tenant2_id = uuid4()
        
        # Create configs for different tenants
        sap_config.tenant_id = tenant1_id
        oracle_config.tenant_id = tenant2_id
        
        config1_id = await service.create_configuration(sap_config)
        config2_id = await service.create_configuration(oracle_config)
        
        # Verify tenant isolation
        tenant1_configs = await service.get_configurations_by_tenant(tenant1_id)
        tenant2_configs = await service.get_configurations_by_tenant(tenant2_id)
        
        assert len(tenant1_configs) == 1
        assert len(tenant2_configs) == 1
        assert tenant1_configs[0].provider == ERPProvider.SAP_S4HANA
        assert tenant2_configs[0].provider == ERPProvider.ORACLE_CLOUD

    async def test_rate_limiting_compliance(self, service, sap_config):
        """Test rate limiting compliance"""
        config_id = await service.create_configuration(sap_config)
        
        with patch.object(service, '_check_rate_limit') as mock_rate:
            mock_rate.return_value = True
            
            # Make multiple rapid calls
            tasks = []
            for i in range(150):  # Exceeds rate limit of 100
                task = service.make_api_call(config_id, f"/api/test/{i}")
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Some calls should be rate limited
            rate_limited_count = sum(
                1 for r in results 
                if isinstance(r, Exception) and "rate limit" in str(r).lower()
            )
            assert rate_limited_count > 0

    async def test_sync_status_monitoring(self, service, dynamics_config):
        """Test sync status monitoring and reporting"""
        config_id = await service.create_configuration(dynamics_config)
        
        sync_job = await service.start_sync(
            config_id=config_id,
            sync_mode=SyncMode.REAL_TIME,
            direction=SyncDirection.BIDIRECTIONAL,
            modules=["finance"]
        )
        
        # Monitor sync status
        status = await service.get_sync_status(sync_job.id)
        assert status.status == SyncStatus.RUNNING
        
        # Update status
        await service.update_sync_status(sync_job.id, SyncStatus.COMPLETED)
        
        updated_status = await service.get_sync_status(sync_job.id)
        assert updated_status.status == SyncStatus.COMPLETED

    async def test_configuration_validation(self, service):
        """Test configuration validation"""
        invalid_config = ERPConfiguration(
            provider=ERPProvider.SAP_S4HANA,
            tenant_id=uuid4(),
            name="",  # Invalid empty name
            endpoint="invalid_url",  # Invalid URL
            auth_config=ERPAuthConfig(
                auth_type="invalid_type",  # Invalid auth type
                client_id="",  # Empty client ID
                client_secret=""
            ),
            field_mappings=[],
            sync_modules=[],  # Empty modules
            batch_size=-1,  # Invalid batch size
            rate_limit=0,  # Invalid rate limit
            active=True
        )
        
        with pytest.raises(ERPValidationError):
            await service.create_configuration(invalid_config)

    async def test_cleanup_and_resource_management(self, service, sap_config):
        """Test cleanup and resource management"""
        config_id = await service.create_configuration(sap_config)
        
        sync_job = await service.start_sync(
            config_id=config_id,
            sync_mode=SyncMode.REAL_TIME,
            direction=SyncDirection.BIDIRECTIONAL,
            modules=["finance"]
        )
        
        # Stop sync and cleanup
        await service.stop_sync(sync_job.id)
        cleanup_result = await service.cleanup_resources(config_id)
        
        assert cleanup_result["connections_closed"] > 0
        assert cleanup_result["cache_cleared"] is True
        
        # Verify sync is stopped
        status = await service.get_sync_status(sync_job.id)
        assert status.status == SyncStatus.STOPPED

    async def test_performance_metrics_collection(self, service, oracle_config):
        """Test performance metrics collection"""
        config_id = await service.create_configuration(oracle_config)
        
        # Simulate some operations
        await service.sync_outbound(config_id, "financial", {"test": "data"})
        await service.sync_inbound(config_id, "procurement")
        
        metrics = await service.get_performance_metrics(config_id)
        
        assert "sync_latency" in metrics
        assert "throughput" in metrics
        assert "error_rate" in metrics
        assert metrics["total_operations"] >= 2