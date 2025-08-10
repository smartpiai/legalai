"""
ERP Integration Service Tests
Following TDD - RED phase: Comprehensive test suite for ERP integration service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json
import xml.etree.ElementTree as ET

from app.services.erp_integration import (
    ERPIntegrationService,
    ERPConnection,
    ERPSystem,
    ERPEntity,
    ERPSyncStatus,
    ERPMapping,
    ERPConfiguration,
    ERPCredentials,
    SAPClient,
    OracleClient,
    ERPDataSync,
    ERPVendor,
    ERPCustomer,
    ERPContract,
    ERPInvoice,
    ERPPurchaseOrder,
    SyncDirection,
    DataFormat,
    ERPError,
    ERPWebhook
)
from app.models.erp import ERP, ERPIntegration, ERPLog
from app.core.exceptions import IntegrationError, ConfigurationError, AuthenticationError


class TestERPIntegrationService:
    """Test suite for ERP integration service"""

    @pytest.fixture
    def mock_postgres(self):
        """Mock PostgreSQL connection"""
        db = AsyncMock()
        db.query = AsyncMock()
        db.execute = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.lpush = AsyncMock()
        return redis

    @pytest.fixture
    def mock_sap_client(self):
        """Mock SAP client"""
        client = AsyncMock()
        client.connect = AsyncMock()
        client.execute = AsyncMock()
        client.get_vendors = AsyncMock()
        client.sync_contracts = AsyncMock()
        return client

    @pytest.fixture
    def mock_oracle_client(self):
        """Mock Oracle client"""
        client = AsyncMock()
        client.connect = AsyncMock()
        client.query = AsyncMock()
        client.get_customers = AsyncMock()
        client.sync_invoices = AsyncMock()
        return client

    @pytest.fixture
    def erp_service(
        self,
        mock_postgres,
        mock_redis,
        mock_sap_client,
        mock_oracle_client
    ):
        """Create ERP integration service instance"""
        return ERPIntegrationService(
            postgres=mock_postgres,
            redis=mock_redis,
            sap_client=mock_sap_client,
            oracle_client=mock_oracle_client
        )

    @pytest.fixture
    def sample_sap_connection(self):
        """Sample SAP connection"""
        return ERPConnection(
            id="sap-conn-123",
            system=ERPSystem.SAP,
            host="sap.company.com",
            port=8000,
            credentials=ERPCredentials(
                username="sap_user",
                password="sap_pass",
                client="100",
                system_id="PRD"
            ),
            is_active=True
        )

    @pytest.fixture
    def sample_oracle_connection(self):
        """Sample Oracle connection"""
        return ERPConnection(
            id="oracle-conn-123",
            system=ERPSystem.ORACLE,
            host="oracle.company.com",
            port=1521,
            credentials=ERPCredentials(
                username="oracle_user",
                password="oracle_pass",
                database="PROD",
                service_name="prod.company.com"
            ),
            is_active=True
        )

    # Test Connection Management

    @pytest.mark.asyncio
    async def test_create_erp_connection(self, erp_service, sample_sap_connection):
        """Test creating ERP connection"""
        result = await erp_service.create_connection(
            connection=sample_sap_connection,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.system == ERPSystem.SAP
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_test_connection(self, erp_service):
        """Test testing ERP connection"""
        result = await erp_service.test_connection(
            connection_id="sap-conn-123",
            tenant_id="tenant-123"
        )
        
        assert result.is_successful is True
        assert result.response_time_ms > 0

    @pytest.mark.asyncio
    async def test_list_connections(self, erp_service):
        """Test listing ERP connections"""
        connections = await erp_service.list_connections(
            tenant_id="tenant-123"
        )
        
        assert isinstance(connections, list)
        assert all(c.tenant_id == "tenant-123" for c in connections)

    @pytest.mark.asyncio
    async def test_update_connection(self, erp_service):
        """Test updating ERP connection"""
        updated = await erp_service.update_connection(
            connection_id="sap-conn-123",
            host="new-sap.company.com",
            is_active=False,
            tenant_id="tenant-123"
        )
        
        assert updated.host == "new-sap.company.com"
        assert updated.is_active is False

    # Test SAP Integration

    @pytest.mark.asyncio
    async def test_sap_connect(self, erp_service, sample_sap_connection):
        """Test SAP connection"""
        client = await erp_service.get_sap_client(
            connection=sample_sap_connection
        )
        
        assert client is not None
        assert hasattr(client, 'connect')

    @pytest.mark.asyncio
    async def test_sap_get_vendors(self, erp_service):
        """Test fetching vendors from SAP"""
        vendors = await erp_service.get_sap_vendors(
            connection_id="sap-conn-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(vendors, list)
        assert all(isinstance(v, ERPVendor) for v in vendors)

    @pytest.mark.asyncio
    async def test_sap_sync_contracts(self, erp_service):
        """Test syncing contracts with SAP"""
        sync_result = await erp_service.sync_sap_contracts(
            connection_id="sap-conn-123",
            direction=SyncDirection.BIDIRECTIONAL,
            tenant_id="tenant-123"
        )
        
        assert sync_result.synced_count > 0
        assert sync_result.status == ERPSyncStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_sap_create_purchase_order(self, erp_service):
        """Test creating purchase order in SAP"""
        po_data = ERPPurchaseOrder(
            vendor_id="V001",
            items=[
                {"material": "MAT001", "quantity": 100, "price": 50.0}
            ],
            total_amount=5000.0
        )
        
        result = await erp_service.create_sap_purchase_order(
            connection_id="sap-conn-123",
            purchase_order=po_data,
            tenant_id="tenant-123"
        )
        
        assert result.po_number is not None
        assert result.status == "created"

    @pytest.mark.asyncio
    async def test_sap_get_invoices(self, erp_service):
        """Test fetching invoices from SAP"""
        invoices = await erp_service.get_sap_invoices(
            connection_id="sap-conn-123",
            date_from=datetime.utcnow() - timedelta(days=30),
            date_to=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert isinstance(invoices, list)
        assert all(isinstance(i, ERPInvoice) for i in invoices)

    # Test Oracle Integration

    @pytest.mark.asyncio
    async def test_oracle_connect(self, erp_service, sample_oracle_connection):
        """Test Oracle connection"""
        client = await erp_service.get_oracle_client(
            connection=sample_oracle_connection
        )
        
        assert client is not None
        assert hasattr(client, 'connect')

    @pytest.mark.asyncio
    async def test_oracle_get_customers(self, erp_service):
        """Test fetching customers from Oracle"""
        customers = await erp_service.get_oracle_customers(
            connection_id="oracle-conn-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(customers, list)
        assert all(isinstance(c, ERPCustomer) for c in customers)

    @pytest.mark.asyncio
    async def test_oracle_sync_financial_data(self, erp_service):
        """Test syncing financial data with Oracle"""
        sync_result = await erp_service.sync_oracle_financials(
            connection_id="oracle-conn-123",
            data_types=["invoices", "payments", "contracts"],
            tenant_id="tenant-123"
        )
        
        assert sync_result.synced_records > 0
        assert sync_result.status == ERPSyncStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_oracle_execute_query(self, erp_service):
        """Test executing custom Oracle query"""
        result = await erp_service.execute_oracle_query(
            connection_id="oracle-conn-123",
            query="SELECT * FROM customers WHERE active = 'Y'",
            parameters=[],
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, list)
        assert len(result) >= 0

    # Test Data Mapping

    @pytest.mark.asyncio
    async def test_create_field_mapping(self, erp_service):
        """Test creating field mapping"""
        mapping = ERPMapping(
            source_field="vendor_name",
            target_field="company_name",
            transformation_rule="upper_case",
            is_required=True
        )
        
        result = await erp_service.create_mapping(
            entity_type=ERPEntity.VENDOR,
            mapping=mapping,
            tenant_id="tenant-123"
        )
        
        assert result.mapping_id is not None

    @pytest.mark.asyncio
    async def test_apply_mapping(self, erp_service):
        """Test applying field mapping"""
        source_data = {
            "vendor_name": "acme corp",
            "vendor_code": "V001",
            "address": "123 Main St"
        }
        
        mapped_data = await erp_service.apply_mapping(
            entity_type=ERPEntity.VENDOR,
            source_data=source_data,
            tenant_id="tenant-123"
        )
        
        assert mapped_data["company_name"] == "ACME CORP"

    @pytest.mark.asyncio
    async def test_validate_mapping(self, erp_service):
        """Test validating mapping configuration"""
        mapping_config = {
            "vendor_name": "company_name",
            "vendor_code": "external_id"
        }
        
        is_valid = await erp_service.validate_mapping(
            entity_type=ERPEntity.VENDOR,
            mapping_config=mapping_config,
            tenant_id="tenant-123"
        )
        
        assert is_valid is True

    # Test Data Synchronization

    @pytest.mark.asyncio
    async def test_sync_entities(self, erp_service):
        """Test syncing entities between systems"""
        sync_config = ERPDataSync(
            entity_types=[ERPEntity.VENDOR, ERPEntity.CONTRACT],
            direction=SyncDirection.FROM_ERP,
            schedule="daily",
            batch_size=100
        )
        
        sync_result = await erp_service.sync_entities(
            connection_id="sap-conn-123",
            sync_config=sync_config,
            tenant_id="tenant-123"
        )
        
        assert sync_result.total_processed > 0
        assert sync_result.errors == 0

    @pytest.mark.asyncio
    async def test_schedule_sync(self, erp_service):
        """Test scheduling automatic sync"""
        schedule = await erp_service.schedule_sync(
            connection_id="sap-conn-123",
            entity_types=[ERPEntity.INVOICE],
            frequency="hourly",
            tenant_id="tenant-123"
        )
        
        assert schedule.schedule_id is not None
        assert schedule.next_run is not None

    @pytest.mark.asyncio
    async def test_manual_sync(self, erp_service):
        """Test manual data synchronization"""
        result = await erp_service.trigger_manual_sync(
            connection_id="oracle-conn-123",
            entity_type=ERPEntity.CUSTOMER,
            force=True,
            tenant_id="tenant-123"
        )
        
        assert result.sync_id is not None
        assert result.status in [ERPSyncStatus.RUNNING, ERPSyncStatus.COMPLETED]

    # Test Webhooks

    @pytest.mark.asyncio
    async def test_setup_webhook(self, erp_service):
        """Test setting up ERP webhook"""
        webhook = ERPWebhook(
            event_type="contract.created",
            callback_url="https://api.company.com/webhooks/erp",
            secret_key="webhook_secret_123"
        )
        
        result = await erp_service.setup_webhook(
            connection_id="sap-conn-123",
            webhook=webhook,
            tenant_id="tenant-123"
        )
        
        assert result.webhook_id is not None
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_handle_webhook(self, erp_service):
        """Test handling incoming webhook"""
        webhook_data = {
            "event": "contract.updated",
            "contract_id": "C001",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        result = await erp_service.handle_webhook(
            connection_id="sap-conn-123",
            webhook_data=webhook_data,
            signature="webhook_signature",
            tenant_id="tenant-123"
        )
        
        assert result.processed is True

    # Test Configuration

    @pytest.mark.asyncio
    async def test_configure_erp_system(self, erp_service):
        """Test configuring ERP system"""
        config = ERPConfiguration(
            default_mappings={"vendor": {"name": "company_name"}},
            sync_settings={"batch_size": 50, "timeout": 300},
            retry_policy={"max_attempts": 3, "backoff": "exponential"}
        )
        
        result = await erp_service.configure_system(
            system=ERPSystem.SAP,
            configuration=config,
            tenant_id="tenant-123"
        )
        
        assert result.config_id is not None

    @pytest.mark.asyncio
    async def test_get_system_status(self, erp_service):
        """Test getting ERP system status"""
        status = await erp_service.get_system_status(
            connection_id="sap-conn-123",
            tenant_id="tenant-123"
        )
        
        assert status.is_online is not None
        assert status.last_sync is not None

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_connection_failure(self, erp_service):
        """Test handling connection failures"""
        with pytest.raises(IntegrationError):
            await erp_service.test_connection(
                connection_id="invalid-conn",
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_authentication_error(self, erp_service):
        """Test handling authentication errors"""
        with pytest.raises(AuthenticationError):
            await erp_service.get_sap_vendors(
                connection_id="invalid-auth-conn",
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_retry_failed_sync(self, erp_service):
        """Test retrying failed synchronization"""
        result = await erp_service.retry_sync(
            sync_id="sync-failed-123",
            tenant_id="tenant-123"
        )
        
        assert result.retry_attempt > 0
        assert result.status in [ERPSyncStatus.RUNNING, ERPSyncStatus.COMPLETED]

    # Test Data Transformation

    @pytest.mark.asyncio
    async def test_transform_sap_data(self, erp_service):
        """Test transforming SAP data format"""
        sap_data = {
            "LIFNR": "V001",
            "NAME1": "ACME Corporation",
            "ORT01": "New York"
        }
        
        transformed = await erp_service.transform_data(
            system=ERPSystem.SAP,
            entity_type=ERPEntity.VENDOR,
            raw_data=sap_data,
            target_format=DataFormat.JSON,
            tenant_id="tenant-123"
        )
        
        assert transformed["vendor_id"] == "V001"
        assert transformed["name"] == "ACME Corporation"

    @pytest.mark.asyncio
    async def test_transform_oracle_data(self, erp_service):
        """Test transforming Oracle data format"""
        oracle_data = {
            "CUSTOMER_ID": "C001",
            "CUSTOMER_NAME": "XYZ Company",
            "CREDIT_LIMIT": 100000
        }
        
        transformed = await erp_service.transform_data(
            system=ERPSystem.ORACLE,
            entity_type=ERPEntity.CUSTOMER,
            raw_data=oracle_data,
            target_format=DataFormat.JSON,
            tenant_id="tenant-123"
        )
        
        assert transformed["customer_id"] == "C001"
        assert transformed["name"] == "XYZ Company"

    # Test Monitoring and Logging

    @pytest.mark.asyncio
    async def test_log_sync_activity(self, erp_service):
        """Test logging sync activity"""
        await erp_service.log_activity(
            connection_id="sap-conn-123",
            activity_type="sync",
            details={"entity": "vendor", "count": 50},
            tenant_id="tenant-123"
        )
        
        logs = await erp_service.get_activity_logs(
            connection_id="sap-conn-123",
            tenant_id="tenant-123"
        )
        
        assert len(logs) > 0

    @pytest.mark.asyncio
    async def test_monitor_performance(self, erp_service):
        """Test monitoring ERP performance"""
        metrics = await erp_service.get_performance_metrics(
            connection_id="oracle-conn-123",
            period="daily",
            tenant_id="tenant-123"
        )
        
        assert "sync_duration" in metrics
        assert "throughput" in metrics
        assert "error_rate" in metrics

    # Test Bulk Operations

    @pytest.mark.asyncio
    async def test_bulk_sync_vendors(self, erp_service):
        """Test bulk vendor synchronization"""
        result = await erp_service.bulk_sync(
            connection_id="sap-conn-123",
            entity_type=ERPEntity.VENDOR,
            batch_size=100,
            tenant_id="tenant-123"
        )
        
        assert result.total_batches > 0
        assert result.completed_batches >= 0

    @pytest.mark.asyncio
    async def test_bulk_export_data(self, erp_service):
        """Test bulk data export"""
        export = await erp_service.bulk_export(
            connection_id="oracle-conn-123",
            entity_types=[ERPEntity.CUSTOMER, ERPEntity.INVOICE],
            format=DataFormat.CSV,
            tenant_id="tenant-123"
        )
        
        assert export.file_path is not None
        assert export.record_count > 0

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_connection_isolation(self, erp_service, sample_sap_connection):
        """Test ERP connection isolation between tenants"""
        # Create connection for tenant A
        conn_a = await erp_service.create_connection(
            connection=sample_sap_connection,
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        conn_b = await erp_service.get_connection(
            connection_id=conn_a.id,
            tenant_id="tenant-B"
        )
        
        assert conn_b is None

    @pytest.mark.asyncio
    async def test_tenant_data_isolation(self, erp_service):
        """Test ERP data isolation between tenants"""
        # Get vendors for tenant A
        vendors_a = await erp_service.get_sap_vendors(
            connection_id="tenant-a-conn",
            tenant_id="tenant-A"
        )
        
        # Try to access same connection from tenant B
        vendors_b = await erp_service.get_sap_vendors(
            connection_id="tenant-a-conn",
            tenant_id="tenant-B"
        )
        
        assert vendors_b == [] or vendors_b is None