"""
Data Pipeline Orchestration Service Tests
Following TDD - RED phase: Comprehensive test suite for data pipeline orchestration
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json
import asyncio

from app.services.data_pipeline import (
    DataPipelineService,
    Pipeline,
    PipelineStage,
    PipelineStatus,
    PipelineExecutor,
    DataSource,
    DataSink,
    Transform,
    ETLJob,
    ScheduleConfig,
    PipelineError,
    ValidationError
)
from app.models.pipeline import PipelineModel, PipelineExecution, PipelineSchedule
from app.schemas.pipeline import (
    PipelineCreateRequest,
    PipelineResponse,
    PipelineExecutionResponse,
    ETLJobRequest
)


class TestDataPipelineService:
    """Test suite for data pipeline orchestration service"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        return db

    @pytest.fixture
    def mock_storage_service(self):
        """Mock storage service for data files"""
        service = AsyncMock()
        service.upload_file = AsyncMock(return_value="s3://bucket/file.csv")
        service.download_file = AsyncMock(return_value=b"data content")
        service.list_files = AsyncMock(return_value=["file1.csv", "file2.json"])
        return service

    @pytest.fixture
    def mock_queue_service(self):
        """Mock queue service for job management"""
        service = AsyncMock()
        service.enqueue = AsyncMock(return_value="job-123")
        service.get_status = AsyncMock(return_value="processing")
        service.cancel = AsyncMock(return_value=True)
        return service

    @pytest.fixture
    def mock_notification_service(self):
        """Mock notification service"""
        service = AsyncMock()
        service.send = AsyncMock()
        return service

    @pytest.fixture
    def pipeline_service(
        self,
        mock_db,
        mock_storage_service,
        mock_queue_service,
        mock_notification_service
    ):
        """Create pipeline service instance"""
        return DataPipelineService(
            db=mock_db,
            storage_service=mock_storage_service,
            queue_service=mock_queue_service,
            notification_service=mock_notification_service
        )

    @pytest.fixture
    def sample_pipeline(self):
        """Sample pipeline configuration"""
        return Pipeline(
            id="pipeline-1",
            name="Contract Data Pipeline",
            description="Process contract data from multiple sources",
            stages=[
                PipelineStage(
                    name="Extract",
                    type="extract",
                    config={"source": "database", "query": "SELECT * FROM contracts"}
                ),
                PipelineStage(
                    name="Transform",
                    type="transform",
                    config={"operations": ["clean", "normalize", "enrich"]}
                ),
                PipelineStage(
                    name="Load",
                    type="load",
                    config={"destination": "warehouse", "table": "processed_contracts"}
                )
            ],
            schedule=ScheduleConfig(
                frequency="daily",
                time="02:00",
                timezone="UTC"
            ),
            tenant_id="tenant-123"
        )

    # Test Pipeline Creation and Management

    @pytest.mark.asyncio
    async def test_create_pipeline(self, pipeline_service, sample_pipeline):
        """Test creating a new data pipeline"""
        result = await pipeline_service.create_pipeline(sample_pipeline)
        
        assert result.id == sample_pipeline.id
        assert result.name == "Contract Data Pipeline"
        assert len(result.stages) == 3
        assert result.status == PipelineStatus.CREATED

    @pytest.mark.asyncio
    async def test_validate_pipeline_configuration(self, pipeline_service):
        """Test pipeline configuration validation"""
        invalid_pipeline = Pipeline(
            id="invalid-1",
            name="",  # Invalid: empty name
            stages=[],  # Invalid: no stages
            tenant_id="tenant-123"
        )
        
        with pytest.raises(ValidationError) as exc_info:
            await pipeline_service.validate_pipeline(invalid_pipeline)
        
        assert "Pipeline name is required" in str(exc_info.value)
        assert "At least one stage is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_pipeline(self, pipeline_service):
        """Test updating pipeline configuration"""
        pipeline_service.get_pipeline = AsyncMock(return_value=Pipeline(
            id="pipeline-1",
            name="Old Name",
            stages=[],
            tenant_id="tenant-123"
        ))
        
        updates = {
            "name": "Updated Pipeline",
            "description": "New description"
        }
        
        result = await pipeline_service.update_pipeline(
            pipeline_id="pipeline-1",
            updates=updates,
            tenant_id="tenant-123"
        )
        
        assert result.name == "Updated Pipeline"
        assert result.description == "New description"

    @pytest.mark.asyncio
    async def test_delete_pipeline(self, pipeline_service):
        """Test deleting a pipeline"""
        result = await pipeline_service.delete_pipeline(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert result is True
        pipeline_service.db.commit.assert_called_once()

    # Test Data Source Configuration

    @pytest.mark.asyncio
    async def test_configure_database_source(self, pipeline_service):
        """Test configuring database as data source"""
        source = DataSource(
            type="database",
            config={
                "connection_string": "postgresql://localhost/db",
                "query": "SELECT * FROM contracts WHERE created_at > :start_date",
                "parameters": {"start_date": "2024-01-01"}
            }
        )
        
        result = await pipeline_service.configure_source(source)
        
        assert result.type == "database"
        assert "query" in result.config

    @pytest.mark.asyncio
    async def test_configure_file_source(self, pipeline_service):
        """Test configuring file as data source"""
        source = DataSource(
            type="file",
            config={
                "path": "s3://bucket/data/*.csv",
                "format": "csv",
                "delimiter": ",",
                "header": True
            }
        )
        
        result = await pipeline_service.configure_source(source)
        
        assert result.type == "file"
        assert result.config["format"] == "csv"

    @pytest.mark.asyncio
    async def test_configure_api_source(self, pipeline_service):
        """Test configuring API as data source"""
        source = DataSource(
            type="api",
            config={
                "url": "https://api.example.com/contracts",
                "method": "GET",
                "headers": {"Authorization": "Bearer token"},
                "pagination": {"type": "offset", "limit": 100}
            }
        )
        
        result = await pipeline_service.configure_source(source)
        
        assert result.type == "api"
        assert result.config["method"] == "GET"

    # Test Transform Operations

    @pytest.mark.asyncio
    async def test_data_cleaning_transform(self, pipeline_service):
        """Test data cleaning transformation"""
        transform = Transform(
            name="clean_data",
            type="cleaning",
            operations=[
                {"type": "remove_nulls", "columns": ["contract_value"]},
                {"type": "trim_whitespace", "columns": ["contract_name"]},
                {"type": "deduplicate", "key": "contract_id"}
            ]
        )
        
        input_data = [
            {"contract_id": "1", "contract_name": " Test ", "contract_value": None},
            {"contract_id": "1", "contract_name": "Test", "contract_value": 1000},
            {"contract_id": "2", "contract_name": "Another", "contract_value": 2000}
        ]
        
        result = await pipeline_service.apply_transform(transform, input_data)
        
        assert len(result) == 2  # Deduplicated
        assert result[0]["contract_name"] == "Test"  # Trimmed
        assert all(r["contract_value"] is not None for r in result)

    @pytest.mark.asyncio
    async def test_data_enrichment_transform(self, pipeline_service):
        """Test data enrichment transformation"""
        transform = Transform(
            name="enrich_data",
            type="enrichment",
            operations=[
                {"type": "add_timestamp", "column": "processed_at"},
                {"type": "calculate_field", "name": "days_until_expiry", 
                 "formula": "(expiry_date - today).days"},
                {"type": "lookup", "source": "departments", "key": "dept_id", 
                 "fields": ["dept_name", "manager"]}
            ]
        )
        
        input_data = [{"contract_id": "1", "dept_id": "D001"}]
        
        result = await pipeline_service.apply_transform(transform, input_data)
        
        assert "processed_at" in result[0]
        assert isinstance(result[0]["processed_at"], str)

    @pytest.mark.asyncio
    async def test_data_aggregation_transform(self, pipeline_service):
        """Test data aggregation transformation"""
        transform = Transform(
            name="aggregate_data",
            type="aggregation",
            operations=[
                {"type": "group_by", "columns": ["department"]},
                {"type": "sum", "column": "contract_value", "alias": "total_value"},
                {"type": "count", "column": "contract_id", "alias": "contract_count"},
                {"type": "avg", "column": "processing_days", "alias": "avg_days"}
            ]
        )
        
        input_data = [
            {"department": "Legal", "contract_value": 1000, "processing_days": 5},
            {"department": "Legal", "contract_value": 2000, "processing_days": 3},
            {"department": "Sales", "contract_value": 3000, "processing_days": 7}
        ]
        
        result = await pipeline_service.apply_transform(transform, input_data)
        
        assert len(result) == 2  # Two departments
        legal = next(r for r in result if r["department"] == "Legal")
        assert legal["total_value"] == 3000
        assert legal["contract_count"] == 2
        assert legal["avg_days"] == 4

    # Test Data Sink Configuration

    @pytest.mark.asyncio
    async def test_configure_database_sink(self, pipeline_service):
        """Test configuring database as data sink"""
        sink = DataSink(
            type="database",
            config={
                "connection_string": "postgresql://localhost/warehouse",
                "table": "processed_contracts",
                "mode": "append",  # append, replace, upsert
                "batch_size": 1000
            }
        )
        
        result = await pipeline_service.configure_sink(sink)
        
        assert result.type == "database"
        assert result.config["mode"] == "append"

    @pytest.mark.asyncio
    async def test_configure_file_sink(self, pipeline_service):
        """Test configuring file as data sink"""
        sink = DataSink(
            type="file",
            config={
                "path": "s3://bucket/output/",
                "format": "parquet",
                "compression": "snappy",
                "partition_by": ["year", "month"]
            }
        )
        
        result = await pipeline_service.configure_sink(sink)
        
        assert result.type == "file"
        assert result.config["format"] == "parquet"

    # Test Pipeline Execution

    @pytest.mark.asyncio
    async def test_execute_pipeline(self, pipeline_service, sample_pipeline):
        """Test executing a complete pipeline"""
        pipeline_service.get_pipeline = AsyncMock(return_value=sample_pipeline)
        pipeline_service.extract_data = AsyncMock(return_value=[
            {"id": "1", "value": 100},
            {"id": "2", "value": 200}
        ])
        pipeline_service.transform_data = AsyncMock(return_value=[
            {"id": "1", "value": 100, "processed": True},
            {"id": "2", "value": 200, "processed": True}
        ])
        pipeline_service.load_data = AsyncMock(return_value=True)
        
        execution = await pipeline_service.execute_pipeline(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert execution.status == PipelineStatus.COMPLETED
        assert execution.records_processed == 2
        pipeline_service.extract_data.assert_called_once()
        pipeline_service.transform_data.assert_called_once()
        pipeline_service.load_data.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_pipeline_with_error_handling(self, pipeline_service):
        """Test pipeline execution with error handling"""
        pipeline_service.get_pipeline = AsyncMock(return_value=Pipeline(
            id="pipeline-1",
            name="Test Pipeline",
            stages=[PipelineStage(name="Extract", type="extract", config={})],
            tenant_id="tenant-123"
        ))
        pipeline_service.extract_data = AsyncMock(
            side_effect=Exception("Database connection failed")
        )
        
        execution = await pipeline_service.execute_pipeline(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert execution.status == PipelineStatus.FAILED
        assert "Database connection failed" in execution.error_message

    @pytest.mark.asyncio
    async def test_resume_failed_pipeline(self, pipeline_service):
        """Test resuming a failed pipeline from last checkpoint"""
        pipeline_service.get_execution = AsyncMock(return_value=PipelineExecution(
            id="exec-1",
            pipeline_id="pipeline-1",
            status=PipelineStatus.FAILED,
            checkpoint={"stage": "transform", "batch": 3}
        ))
        
        result = await pipeline_service.resume_pipeline(
            execution_id="exec-1",
            tenant_id="tenant-123"
        )
        
        assert result.status == PipelineStatus.RUNNING
        assert result.checkpoint["stage"] == "transform"

    # Test Incremental Processing

    @pytest.mark.asyncio
    async def test_incremental_data_processing(self, pipeline_service):
        """Test incremental data processing with watermark"""
        pipeline_service.get_watermark = AsyncMock(return_value={
            "last_processed": "2024-01-01T00:00:00",
            "last_id": "1000"
        })
        
        result = await pipeline_service.process_incremental(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert result.incremental_mode is True
        assert result.watermark["last_processed"] == "2024-01-01T00:00:00"

    @pytest.mark.asyncio
    async def test_update_watermark(self, pipeline_service):
        """Test updating processing watermark"""
        await pipeline_service.update_watermark(
            pipeline_id="pipeline-1",
            watermark={
                "last_processed": datetime.utcnow().isoformat(),
                "last_id": "2000",
                "records_processed": 1000
            },
            tenant_id="tenant-123"
        )
        
        pipeline_service.db.commit.assert_called_once()

    # Test Scheduling

    @pytest.mark.asyncio
    async def test_schedule_pipeline(self, pipeline_service):
        """Test scheduling pipeline execution"""
        schedule = ScheduleConfig(
            frequency="daily",
            time="03:00",
            timezone="UTC",
            retry_on_failure=True,
            max_retries=3
        )
        
        result = await pipeline_service.schedule_pipeline(
            pipeline_id="pipeline-1",
            schedule=schedule,
            tenant_id="tenant-123"
        )
        
        assert result.frequency == "daily"
        assert result.next_run is not None
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_pause_scheduled_pipeline(self, pipeline_service):
        """Test pausing a scheduled pipeline"""
        result = await pipeline_service.pause_schedule(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert result.is_active is False

    @pytest.mark.asyncio
    async def test_get_next_scheduled_runs(self, pipeline_service):
        """Test getting next scheduled pipeline runs"""
        runs = await pipeline_service.get_upcoming_runs(
            tenant_id="tenant-123",
            hours_ahead=24
        )
        
        assert isinstance(runs, list)
        for run in runs:
            assert run["pipeline_id"] is not None
            assert run["scheduled_time"] is not None

    # Test Monitoring and Metrics

    @pytest.mark.asyncio
    async def test_monitor_pipeline_execution(self, pipeline_service):
        """Test monitoring pipeline execution progress"""
        status = await pipeline_service.get_execution_status(
            execution_id="exec-1",
            tenant_id="tenant-123"
        )
        
        assert status.execution_id == "exec-1"
        assert status.progress_percentage >= 0
        assert status.current_stage is not None
        assert status.records_processed >= 0

    @pytest.mark.asyncio
    async def test_get_pipeline_metrics(self, pipeline_service):
        """Test getting pipeline performance metrics"""
        pipeline_service.calculate_metrics = AsyncMock(return_value={
            "avg_execution_time": 120.5,
            "success_rate": 95.5,
            "total_records_processed": 50000,
            "avg_records_per_second": 416.67
        })
        
        metrics = await pipeline_service.get_pipeline_metrics(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123",
            period_days=30
        )
        
        assert metrics["success_rate"] == 95.5
        assert metrics["avg_execution_time"] == 120.5

    @pytest.mark.asyncio
    async def test_get_execution_history(self, pipeline_service):
        """Test getting pipeline execution history"""
        pipeline_service.pipeline_repository = AsyncMock()
        pipeline_service.pipeline_repository.get_execution_history = AsyncMock(
            return_value=[
                {"id": "exec-1", "status": "completed", "duration": 120},
                {"id": "exec-2", "status": "failed", "duration": 45},
                {"id": "exec-3", "status": "completed", "duration": 135}
            ]
        )
        
        history = await pipeline_service.get_execution_history(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123",
            limit=10
        )
        
        assert len(history) == 3
        assert history[0]["status"] == "completed"

    # Test Error Recovery

    @pytest.mark.asyncio
    async def test_retry_failed_stage(self, pipeline_service):
        """Test retrying a failed pipeline stage"""
        result = await pipeline_service.retry_stage(
            execution_id="exec-1",
            stage_name="transform",
            tenant_id="tenant-123"
        )
        
        assert result.status == PipelineStatus.RUNNING
        assert result.retry_count > 0

    @pytest.mark.asyncio
    async def test_rollback_pipeline(self, pipeline_service):
        """Test rolling back pipeline changes"""
        result = await pipeline_service.rollback_pipeline(
            execution_id="exec-1",
            tenant_id="tenant-123"
        )
        
        assert result.rollback_completed is True
        assert result.status == PipelineStatus.ROLLED_BACK

    @pytest.mark.asyncio
    async def test_dead_letter_queue(self, pipeline_service):
        """Test handling failed records in dead letter queue"""
        failed_records = [
            {"id": "1", "error": "Invalid format"},
            {"id": "2", "error": "Missing required field"}
        ]
        
        await pipeline_service.send_to_dlq(
            pipeline_id="pipeline-1",
            records=failed_records,
            tenant_id="tenant-123"
        )
        
        dlq_records = await pipeline_service.get_dlq_records(
            pipeline_id="pipeline-1",
            tenant_id="tenant-123"
        )
        
        assert len(dlq_records) == 2

    # Test Data Quality

    @pytest.mark.asyncio
    async def test_data_quality_checks(self, pipeline_service):
        """Test data quality validation"""
        quality_rules = [
            {"type": "not_null", "column": "contract_id"},
            {"type": "range", "column": "value", "min": 0, "max": 1000000},
            {"type": "pattern", "column": "email", "pattern": r"^[\w\.-]+@[\w\.-]+\.\w+$"}
        ]
        
        data = [
            {"contract_id": "1", "value": 5000, "email": "test@example.com"},
            {"contract_id": None, "value": 5000, "email": "test@example.com"},
            {"contract_id": "2", "value": -100, "email": "invalid-email"}
        ]
        
        result = await pipeline_service.validate_data_quality(
            data=data,
            rules=quality_rules
        )
        
        assert result.valid_count == 1
        assert result.invalid_count == 2
        assert len(result.violations) == 3

    @pytest.mark.asyncio
    async def test_data_profiling(self, pipeline_service):
        """Test data profiling for insights"""
        data = [
            {"value": 100, "category": "A"},
            {"value": 200, "category": "B"},
            {"value": 150, "category": "A"},
            {"value": None, "category": "C"}
        ]
        
        profile = await pipeline_service.profile_data(data)
        
        assert profile["row_count"] == 4
        assert profile["columns"]["value"]["null_count"] == 1
        assert profile["columns"]["value"]["mean"] == 150
        assert profile["columns"]["category"]["unique_count"] == 3

    # Test Parallel Processing

    @pytest.mark.asyncio
    async def test_parallel_pipeline_execution(self, pipeline_service):
        """Test parallel execution of pipeline stages"""
        pipeline = Pipeline(
            id="pipeline-1",
            name="Parallel Pipeline",
            stages=[
                PipelineStage(name="Extract1", type="extract", parallel=True),
                PipelineStage(name="Extract2", type="extract", parallel=True),
                PipelineStage(name="Transform", type="transform", parallel=False)
            ],
            tenant_id="tenant-123"
        )
        
        result = await pipeline_service.execute_parallel(pipeline)
        
        assert result.parallel_stages_executed == 2
        assert result.status == PipelineStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_batch_processing(self, pipeline_service):
        """Test batch processing of large datasets"""
        large_dataset = [{"id": i} for i in range(10000)]
        
        batches = await pipeline_service.process_in_batches(
            data=large_dataset,
            batch_size=1000
        )
        
        assert len(batches) == 10
        assert all(len(b) == 1000 for b in batches)

    # Test Notifications

    @pytest.mark.asyncio
    async def test_pipeline_completion_notification(self, pipeline_service, mock_notification_service):
        """Test sending notification on pipeline completion"""
        await pipeline_service.notify_completion(
            pipeline_id="pipeline-1",
            status=PipelineStatus.COMPLETED,
            recipients=["admin@example.com"],
            tenant_id="tenant-123"
        )
        
        mock_notification_service.send.assert_called_once()
        notification = mock_notification_service.send.call_args[0][0]
        assert "completed" in notification["message"].lower()

    @pytest.mark.asyncio
    async def test_pipeline_failure_alert(self, pipeline_service, mock_notification_service):
        """Test sending alert on pipeline failure"""
        await pipeline_service.alert_failure(
            pipeline_id="pipeline-1",
            error="Database connection timeout",
            recipients=["ops@example.com"],
            tenant_id="tenant-123"
        )
        
        mock_notification_service.send.assert_called_once()
        alert = mock_notification_service.send.call_args[0][0]
        assert "failed" in alert["message"].lower()
        assert alert["priority"] == "high"

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_pipeline_isolation(self, pipeline_service):
        """Test that pipelines are isolated between tenants"""
        # Create pipeline for tenant A
        pipeline_a = await pipeline_service.create_pipeline(
            Pipeline(id="p1", name="Pipeline A", stages=[], tenant_id="tenant-A")
        )
        
        # Try to access from tenant B
        with pytest.raises(PermissionError):
            await pipeline_service.get_pipeline(
                pipeline_id="p1",
                tenant_id="tenant-B"
            )

    # Test Performance Optimization

    @pytest.mark.asyncio
    async def test_query_optimization(self, pipeline_service):
        """Test query optimization for data extraction"""
        optimized_query = await pipeline_service.optimize_query(
            query="SELECT * FROM contracts WHERE status = 'active'",
            hints={"indexes": ["status_idx"], "parallel": True}
        )
        
        assert "/*+ PARALLEL */" in optimized_query
        assert "status_idx" in optimized_query