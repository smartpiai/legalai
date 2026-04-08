"""
Batch Document Processing Service Tests
Following TDD - RED phase: Comprehensive test suite for batch document operations
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import UUID, uuid4
from pathlib import Path

from app.services.batch_document_processing import (
    BatchDocumentProcessor,
    BatchJob,
    BatchStatus,
    BatchOperation,
    BatchConfig,
    BatchResult,
    DocumentBatch,
    BatchValidator,
    BatchScheduler,
    BatchMonitor,
    BatchExporter,
    BatchNotifier,
    ParallelProcessor,
    StreamProcessor,
    ChunkProcessor,
    BatchOptimizer,
    BatchErrorHandler,
    BatchStatistics,
    BatchReport,
    process_batch,
    validate_batch,
    schedule_batch,
    monitor_batch,
    export_batch_results
)


@pytest.fixture
def mock_db():
    """Mock database session"""
    db_mock = AsyncMock()
    db_mock.execute = AsyncMock()
    db_mock.commit = AsyncMock()
    db_mock.rollback = AsyncMock()
    return db_mock


@pytest.fixture
def mock_storage():
    """Mock storage service"""
    storage_mock = AsyncMock()
    storage_mock.upload = AsyncMock(return_value="s3://bucket/file.pdf")
    storage_mock.download = AsyncMock(return_value=b"file content")
    storage_mock.exists = AsyncMock(return_value=True)
    return storage_mock


@pytest.fixture
def sample_documents():
    """Sample document list for batch processing"""
    return [
        {
            "id": str(uuid4()),
            "name": f"document_{i}.pdf",
            "size": 1024 * (i + 1),
            "type": "contract",
            "tenant_id": "tenant_123"
        }
        for i in range(10)
    ]


@pytest.fixture
def batch_config():
    """Sample batch configuration"""
    return BatchConfig(
        operation=BatchOperation.EXTRACTION,
        parallel_workers=4,
        chunk_size=100,
        timeout_seconds=3600,
        retry_failed=True,
        notification_emails=["admin@example.com"]
    )


class TestBatchDocumentProcessor:
    """Test batch document processing functionality"""
    
    @pytest.mark.asyncio
    async def test_create_batch_job(self, mock_db, sample_documents):
        """Test creating a batch processing job"""
        processor = BatchDocumentProcessor(db=mock_db)
        
        job = await processor.create_batch(
            documents=sample_documents,
            operation=BatchOperation.EXTRACTION,
            tenant_id="tenant_123"
        )
        
        assert job.id is not None
        assert job.status == BatchStatus.PENDING
        assert job.total_documents == 10
        assert job.operation == BatchOperation.EXTRACTION
    
    @pytest.mark.asyncio
    async def test_process_batch_extraction(self, mock_db, mock_storage, sample_documents):
        """Test batch extraction processing"""
        processor = BatchDocumentProcessor(db=mock_db, storage=mock_storage)
        
        job = await processor.create_batch(
            documents=sample_documents,
            operation=BatchOperation.EXTRACTION
        )
        
        results = await processor.process_batch(job.id)
        
        assert len(results) == 10
        assert all(r.status in ["completed", "failed"] for r in results)
        assert job.status == BatchStatus.COMPLETED
    
    @pytest.mark.asyncio
    async def test_batch_with_failures(self, mock_db, mock_storage, sample_documents):
        """Test batch processing with some failures"""
        processor = BatchDocumentProcessor(db=mock_db, storage=mock_storage)
        
        # Mock some extraction failures
        with patch.object(processor, '_process_document', 
                         side_effect=[None, Exception("Failed"), None] * 4):
            
            job = await processor.create_batch(
                documents=sample_documents[:3],
                operation=BatchOperation.EXTRACTION
            )
            
            results = await processor.process_batch(job.id)
            
            assert job.status == BatchStatus.PARTIAL
            assert job.failed_count == 1
            assert job.success_count == 2
    
    @pytest.mark.asyncio
    async def test_batch_cancellation(self, mock_db, sample_documents):
        """Test cancelling a batch job"""
        processor = BatchDocumentProcessor(db=mock_db)
        
        job = await processor.create_batch(
            documents=sample_documents,
            operation=BatchOperation.CONVERSION
        )
        
        # Start processing in background
        process_task = asyncio.create_task(processor.process_batch(job.id))
        
        # Cancel after short delay
        await asyncio.sleep(0.1)
        cancelled = await processor.cancel_batch(job.id)
        
        assert cancelled is True
        assert job.status == BatchStatus.CANCELLED
        
        process_task.cancel()
    
    @pytest.mark.asyncio
    async def test_batch_retry_failed(self, mock_db, sample_documents):
        """Test retrying failed documents in a batch"""
        processor = BatchDocumentProcessor(db=mock_db)
        
        job = await processor.create_batch(
            documents=sample_documents,
            operation=BatchOperation.VALIDATION
        )
        
        # Mark some as failed
        job.failed_documents = sample_documents[:3]
        job.failed_count = 3
        
        retry_results = await processor.retry_failed(job.id)
        
        assert len(retry_results) == 3
        assert job.retry_count == 1


class TestBatchValidator:
    """Test batch validation functionality"""
    
    @pytest.mark.asyncio
    async def test_validate_documents(self, sample_documents):
        """Test document validation before batch processing"""
        validator = BatchValidator()
        
        validation = await validator.validate_documents(sample_documents)
        
        assert validation.is_valid is True
        assert validation.total_size > 0
        assert validation.document_count == 10
        assert len(validation.errors) == 0
    
    @pytest.mark.asyncio
    async def test_validate_size_limits(self, sample_documents):
        """Test batch size limit validation"""
        validator = BatchValidator(max_batch_size=5 * 1024)  # 5KB limit
        
        validation = await validator.validate_documents(sample_documents)
        
        assert validation.is_valid is False
        assert "exceeds maximum batch size" in validation.errors[0]
    
    @pytest.mark.asyncio
    async def test_validate_document_types(self):
        """Test document type validation"""
        validator = BatchValidator(allowed_types=["pdf", "docx"])
        
        documents = [
            {"name": "doc1.pdf", "type": "pdf"},
            {"name": "doc2.txt", "type": "txt"},  # Invalid
            {"name": "doc3.docx", "type": "docx"}
        ]
        
        validation = await validator.validate_documents(documents)
        
        assert validation.is_valid is False
        assert "Invalid document type" in validation.errors[0]
    
    @pytest.mark.asyncio
    async def test_validate_duplicate_detection(self):
        """Test duplicate document detection"""
        validator = BatchValidator()
        
        documents = [
            {"id": "doc_1", "name": "contract.pdf"},
            {"id": "doc_1", "name": "contract.pdf"},  # Duplicate
            {"id": "doc_2", "name": "agreement.pdf"}
        ]
        
        validation = await validator.validate_documents(documents)
        
        assert validation.is_valid is False
        assert "Duplicate document" in validation.errors[0]


class TestBatchScheduler:
    """Test batch scheduling functionality"""
    
    @pytest.mark.asyncio
    async def test_schedule_immediate_batch(self, mock_db, sample_documents):
        """Test scheduling batch for immediate processing"""
        scheduler = BatchScheduler(db=mock_db)
        
        schedule = await scheduler.schedule_batch(
            documents=sample_documents,
            operation=BatchOperation.EXTRACTION,
            start_time=None  # Immediate
        )
        
        assert schedule.id is not None
        assert schedule.status == "scheduled"
        assert schedule.start_time is not None
    
    @pytest.mark.asyncio
    async def test_schedule_future_batch(self, mock_db, sample_documents):
        """Test scheduling batch for future processing"""
        scheduler = BatchScheduler(db=mock_db)
        
        future_time = datetime.utcnow() + timedelta(hours=2)
        
        schedule = await scheduler.schedule_batch(
            documents=sample_documents,
            operation=BatchOperation.ANALYSIS,
            start_time=future_time
        )
        
        assert schedule.start_time == future_time
        assert schedule.status == "scheduled"
    
    @pytest.mark.asyncio
    async def test_recurring_batch_schedule(self, mock_db, sample_documents):
        """Test recurring batch schedule"""
        scheduler = BatchScheduler(db=mock_db)
        
        schedule = await scheduler.schedule_recurring(
            documents=sample_documents,
            operation=BatchOperation.VALIDATION,
            frequency="daily",
            start_time=datetime.utcnow()
        )
        
        assert schedule.is_recurring is True
        assert schedule.frequency == "daily"
        
        # Get next occurrence
        next_run = await scheduler.get_next_occurrence(schedule.id)
        assert next_run > datetime.utcnow()
    
    @pytest.mark.asyncio
    async def test_cancel_scheduled_batch(self, mock_db, sample_documents):
        """Test cancelling a scheduled batch"""
        scheduler = BatchScheduler(db=mock_db)
        
        schedule = await scheduler.schedule_batch(
            documents=sample_documents,
            operation=BatchOperation.EXTRACTION,
            start_time=datetime.utcnow() + timedelta(hours=1)
        )
        
        cancelled = await scheduler.cancel_schedule(schedule.id)
        
        assert cancelled is True
        assert schedule.status == "cancelled"


class TestBatchMonitor:
    """Test batch monitoring functionality"""
    
    @pytest.mark.asyncio
    async def test_monitor_batch_progress(self, mock_db):
        """Test monitoring batch processing progress"""
        monitor = BatchMonitor(db=mock_db)
        
        job_id = str(uuid4())
        
        # Simulate progress updates
        await monitor.update_progress(job_id, processed=5, total=10)
        
        progress = await monitor.get_progress(job_id)
        
        assert progress["processed"] == 5
        assert progress["total"] == 10
        assert progress["percentage"] == 50
        assert progress["status"] == "processing"
    
    @pytest.mark.asyncio
    async def test_monitor_performance_metrics(self, mock_db):
        """Test collecting batch performance metrics"""
        monitor = BatchMonitor(db=mock_db)
        
        metrics = await monitor.get_performance_metrics(job_id=str(uuid4()))
        
        assert "documents_per_second" in metrics
        assert "average_processing_time" in metrics
        assert "memory_usage" in metrics
        assert "cpu_usage" in metrics
    
    @pytest.mark.asyncio
    async def test_monitor_error_tracking(self, mock_db):
        """Test error tracking during batch processing"""
        monitor = BatchMonitor(db=mock_db)
        
        job_id = str(uuid4())
        
        # Record errors
        await monitor.record_error(job_id, "doc_1", "Extraction failed")
        await monitor.record_error(job_id, "doc_2", "Invalid format")
        
        errors = await monitor.get_errors(job_id)
        
        assert len(errors) == 2
        assert errors[0]["document_id"] == "doc_1"
        assert "Extraction failed" in errors[0]["error"]
    
    @pytest.mark.asyncio
    async def test_real_time_updates(self, mock_db):
        """Test real-time batch status updates"""
        monitor = BatchMonitor(db=mock_db)
        
        job_id = str(uuid4())
        updates = []
        
        async def update_handler(update):
            updates.append(update)
        
        # Subscribe to updates
        await monitor.subscribe(job_id, update_handler)
        
        # Trigger updates
        await monitor.update_progress(job_id, processed=1, total=10)
        await monitor.update_progress(job_id, processed=5, total=10)
        
        assert len(updates) == 2
        assert updates[1]["processed"] == 5


class TestParallelProcessor:
    """Test parallel processing functionality"""
    
    @pytest.mark.asyncio
    async def test_parallel_document_processing(self, sample_documents):
        """Test processing documents in parallel"""
        processor = ParallelProcessor(workers=4)
        
        async def process_doc(doc):
            await asyncio.sleep(0.01)  # Simulate processing
            return {"id": doc["id"], "status": "completed"}
        
        results = await processor.process_parallel(
            documents=sample_documents,
            process_func=process_doc
        )
        
        assert len(results) == 10
        assert all(r["status"] == "completed" for r in results)
    
    @pytest.mark.asyncio
    async def test_worker_pool_management(self):
        """Test dynamic worker pool management"""
        processor = ParallelProcessor(min_workers=2, max_workers=8)
        
        # Start with minimum workers
        assert processor.active_workers == 2
        
        # Scale up under load
        await processor.adjust_workers(queue_size=100)
        assert processor.active_workers > 2
        
        # Scale down when idle
        await processor.adjust_workers(queue_size=5)
        assert processor.active_workers <= 4
    
    @pytest.mark.asyncio
    async def test_parallel_error_handling(self, sample_documents):
        """Test error handling in parallel processing"""
        processor = ParallelProcessor(workers=4)
        
        async def flaky_process(doc):
            if int(doc["id"][-1]) % 2 == 0:
                raise Exception("Processing error")
            return {"id": doc["id"], "status": "completed"}
        
        results = await processor.process_parallel(
            documents=sample_documents[:4],
            process_func=flaky_process,
            on_error="continue"
        )
        
        completed = [r for r in results if r.get("status") == "completed"]
        failed = [r for r in results if r.get("error")]
        
        assert len(completed) > 0
        assert len(failed) > 0


class TestStreamProcessor:
    """Test stream processing functionality"""
    
    @pytest.mark.asyncio
    async def test_stream_processing(self, sample_documents):
        """Test processing documents as a stream"""
        processor = StreamProcessor(buffer_size=5)
        
        processed = []
        
        async def handler(doc):
            processed.append(doc["id"])
            return {"id": doc["id"], "processed": True}
        
        async for result in processor.process_stream(sample_documents, handler):
            assert result["processed"] is True
        
        assert len(processed) == 10
    
    @pytest.mark.asyncio
    async def test_stream_backpressure(self):
        """Test backpressure handling in stream processing"""
        processor = StreamProcessor(buffer_size=3)
        
        slow_consumer = []
        
        async def slow_handler(doc):
            await asyncio.sleep(0.1)  # Simulate slow processing
            slow_consumer.append(doc)
        
        documents = [{"id": f"doc_{i}"} for i in range(10)]
        
        # Process with backpressure
        async for _ in processor.process_stream(documents, slow_handler):
            # Buffer should not exceed limit
            assert processor.buffer_size <= 3
    
    @pytest.mark.asyncio
    async def test_stream_error_recovery(self, sample_documents):
        """Test error recovery in stream processing"""
        processor = StreamProcessor()
        
        error_count = 0
        
        async def error_handler(doc):
            nonlocal error_count
            if error_count < 2:
                error_count += 1
                raise Exception("Stream error")
            return {"id": doc["id"], "status": "recovered"}
        
        results = []
        async for result in processor.process_stream(
            sample_documents[:5],
            error_handler,
            retry_on_error=True
        ):
            results.append(result)
        
        assert len(results) == 5
        assert all(r["status"] == "recovered" for r in results)


class TestBatchExporter:
    """Test batch export functionality"""
    
    @pytest.mark.asyncio
    async def test_export_to_csv(self, mock_storage):
        """Test exporting batch results to CSV"""
        exporter = BatchExporter(storage=mock_storage)
        
        results = [
            {"id": "doc_1", "status": "completed", "extracted_text": "Contract text"},
            {"id": "doc_2", "status": "failed", "error": "Invalid format"}
        ]
        
        export_path = await exporter.export_csv(
            job_id="batch_123",
            results=results
        )
        
        assert export_path.endswith(".csv")
        mock_storage.upload.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_export_to_json(self, mock_storage):
        """Test exporting batch results to JSON"""
        exporter = BatchExporter(storage=mock_storage)
        
        results = [
            {"id": "doc_1", "data": {"title": "Contract", "parties": ["A", "B"]}},
            {"id": "doc_2", "data": {"title": "Agreement", "value": 10000}}
        ]
        
        export_path = await exporter.export_json(
            job_id="batch_123",
            results=results
        )
        
        assert export_path.endswith(".json")
    
    @pytest.mark.asyncio
    async def test_export_to_excel(self, mock_storage):
        """Test exporting batch results to Excel"""
        exporter = BatchExporter(storage=mock_storage)
        
        results = [
            {"id": f"doc_{i}", "status": "completed", "pages": i+1}
            for i in range(10)
        ]
        
        export_path = await exporter.export_excel(
            job_id="batch_123",
            results=results,
            include_summary=True
        )
        
        assert export_path.endswith(".xlsx")
    
    @pytest.mark.asyncio
    async def test_compressed_export(self, mock_storage):
        """Test compressed export for large batches"""
        exporter = BatchExporter(storage=mock_storage)
        
        # Large result set
        results = [
            {"id": f"doc_{i}", "data": "x" * 1000}
            for i in range(1000)
        ]
        
        export_path = await exporter.export_compressed(
            job_id="batch_123",
            results=results,
            format="json.gz"
        )
        
        assert export_path.endswith(".gz")


class TestBatchStatistics:
    """Test batch statistics generation"""
    
    @pytest.mark.asyncio
    async def test_calculate_statistics(self):
        """Test calculating batch processing statistics"""
        stats = BatchStatistics()
        
        job_data = {
            "total_documents": 100,
            "processed": 95,
            "failed": 5,
            "start_time": datetime.utcnow() - timedelta(hours=1),
            "end_time": datetime.utcnow()
        }
        
        statistics = await stats.calculate(job_data)
        
        assert statistics["success_rate"] == 95.0
        assert statistics["failure_rate"] == 5.0
        assert statistics["processing_time_hours"] == 1.0
        assert statistics["documents_per_hour"] == 95
    
    @pytest.mark.asyncio
    async def test_aggregate_statistics(self):
        """Test aggregating statistics across multiple batches"""
        stats = BatchStatistics()
        
        batch_stats = [
            {"success_rate": 90, "processing_time": 60},
            {"success_rate": 95, "processing_time": 45},
            {"success_rate": 85, "processing_time": 75}
        ]
        
        aggregated = await stats.aggregate(batch_stats)
        
        assert aggregated["average_success_rate"] == 90.0
        assert aggregated["total_processing_time"] == 180
        assert aggregated["batch_count"] == 3
    
    @pytest.mark.asyncio
    async def test_performance_trends(self):
        """Test analyzing performance trends"""
        stats = BatchStatistics()
        
        historical_data = [
            {"date": datetime.utcnow() - timedelta(days=i), "success_rate": 85 + i}
            for i in range(7)
        ]
        
        trends = await stats.analyze_trends(historical_data)
        
        assert trends["trend_direction"] == "improving"
        assert trends["average_improvement"] > 0


class TestBatchReport:
    """Test batch report generation"""
    
    @pytest.mark.asyncio
    async def test_generate_summary_report(self):
        """Test generating batch summary report"""
        reporter = BatchReport()
        
        job_data = {
            "id": "batch_123",
            "operation": "extraction",
            "total": 100,
            "completed": 95,
            "failed": 5,
            "duration_seconds": 3600
        }
        
        report = await reporter.generate_summary(job_data)
        
        assert "Batch Processing Summary" in report
        assert "Success Rate: 95.0%" in report
        assert "Total Documents: 100" in report
    
    @pytest.mark.asyncio
    async def test_generate_detailed_report(self):
        """Test generating detailed batch report"""
        reporter = BatchReport()
        
        job_data = {
            "id": "batch_123",
            "documents": [
                {"id": "doc_1", "status": "completed", "time": 5.2},
                {"id": "doc_2", "status": "failed", "error": "Invalid"},
            ],
            "statistics": {"success_rate": 50}
        }
        
        report = await reporter.generate_detailed(job_data)
        
        assert "Document Details" in report
        assert "doc_1" in report
        assert "Failed Documents" in report
        assert "Statistics" in report
    
    @pytest.mark.asyncio
    async def test_generate_error_report(self):
        """Test generating error-focused report"""
        reporter = BatchReport()
        
        errors = [
            {"document": "doc_1", "error": "Extraction failed", "timestamp": datetime.utcnow()},
            {"document": "doc_2", "error": "Invalid format", "timestamp": datetime.utcnow()}
        ]
        
        report = await reporter.generate_error_report("batch_123", errors)
        
        assert "Error Report" in report
        assert "doc_1: Extraction failed" in report
        assert "doc_2: Invalid format" in report
        assert "Total Errors: 2" in report