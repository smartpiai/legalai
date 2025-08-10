"""
Document Processing Queue Service Tests
Following TDD - RED phase: Comprehensive test suite for async document processing
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import UUID, uuid4

from app.services.document_processing_queue import (
    DocumentProcessingQueue,
    ProcessingTask,
    TaskStatus,
    TaskPriority,
    TaskType,
    ProcessingWorker,
    QueueManager,
    TaskScheduler,
    RetryPolicy,
    DeadLetterQueue,
    TaskMonitor,
    BatchProcessor,
    PriorityQueue,
    TaskDependencyResolver,
    ProcessingPipeline,
    TaskResult,
    QueueMetrics,
    CircuitBreaker,
    RateLimiter,
    TaskRouter,
    WorkerPool
)


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    redis_mock = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.set = AsyncMock(return_value=True)
    redis_mock.lpush = AsyncMock(return_value=1)
    redis_mock.rpop = AsyncMock(return_value=None)
    redis_mock.llen = AsyncMock(return_value=0)
    redis_mock.hget = AsyncMock(return_value=None)
    redis_mock.hset = AsyncMock(return_value=True)
    redis_mock.zadd = AsyncMock(return_value=1)
    redis_mock.zrange = AsyncMock(return_value=[])
    return redis_mock


@pytest.fixture
def mock_db():
    """Mock database session"""
    db_mock = AsyncMock()
    db_mock.execute = AsyncMock()
    db_mock.commit = AsyncMock()
    db_mock.rollback = AsyncMock()
    return db_mock


@pytest.fixture
def sample_task():
    """Sample processing task"""
    return ProcessingTask(
        id=str(uuid4()),
        type=TaskType.EXTRACTION,
        document_id=str(uuid4()),
        tenant_id="tenant_123",
        priority=TaskPriority.MEDIUM,
        payload={"format": "pdf", "pages": 10},
        created_at=datetime.utcnow()
    )


class TestDocumentProcessingQueue:
    """Test document processing queue functionality"""
    
    @pytest.mark.asyncio
    async def test_enqueue_task(self, mock_redis):
        """Test enqueueing a processing task"""
        queue = DocumentProcessingQueue(redis_client=mock_redis)
        
        task = ProcessingTask(
            type=TaskType.EXTRACTION,
            document_id="doc_123",
            tenant_id="tenant_456",
            priority=TaskPriority.HIGH
        )
        
        result = await queue.enqueue(task)
        
        assert result.id is not None
        assert result.status == TaskStatus.PENDING
        assert result.priority == TaskPriority.HIGH
        mock_redis.zadd.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_dequeue_task_by_priority(self, mock_redis):
        """Test dequeuing tasks by priority"""
        mock_redis.zrange.return_value = [
            json.dumps({"id": "task_1", "priority": 3}),
            json.dumps({"id": "task_2", "priority": 2}),
            json.dumps({"id": "task_3", "priority": 1})
        ]
        
        queue = DocumentProcessingQueue(redis_client=mock_redis)
        task = await queue.dequeue()
        
        assert task is not None
        assert task["id"] == "task_1"
        mock_redis.zrem.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_task_retry_with_backoff(self, mock_redis, sample_task):
        """Test task retry with exponential backoff"""
        queue = DocumentProcessingQueue(redis_client=mock_redis)
        
        retry_policy = RetryPolicy(
            max_attempts=3,
            backoff_factor=2,
            max_delay=60
        )
        
        # First retry
        await queue.retry_task(sample_task, retry_policy, attempt=1)
        assert sample_task.retry_count == 1
        assert sample_task.next_retry_at is not None
        
        # Second retry with backoff
        await queue.retry_task(sample_task, retry_policy, attempt=2)
        assert sample_task.retry_count == 2
        
        # Max attempts reached
        with pytest.raises(Exception) as exc:
            await queue.retry_task(sample_task, retry_policy, attempt=4)
        assert "Max retry attempts" in str(exc.value)
    
    @pytest.mark.asyncio
    async def test_dead_letter_queue(self, mock_redis, sample_task):
        """Test moving failed tasks to dead letter queue"""
        dlq = DeadLetterQueue(redis_client=mock_redis)
        
        await dlq.add(sample_task, error="Processing failed after 3 attempts")
        
        mock_redis.lpush.assert_called_with(
            "dlq:document_processing",
            pytest.Any(str)
        )
        
        # Retrieve from DLQ
        tasks = await dlq.list(limit=10)
        mock_redis.lrange.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_batch_processing(self, mock_redis):
        """Test batch processing of multiple tasks"""
        batch_processor = BatchProcessor(redis_client=mock_redis)
        
        tasks = [
            ProcessingTask(type=TaskType.EXTRACTION, document_id=f"doc_{i}")
            for i in range(5)
        ]
        
        batch_id = await batch_processor.create_batch(tasks)
        assert batch_id is not None
        
        # Process batch
        results = await batch_processor.process_batch(batch_id)
        assert len(results) == 5
        assert all(r.status in [TaskStatus.COMPLETED, TaskStatus.FAILED] for r in results)
    
    @pytest.mark.asyncio
    async def test_task_dependencies(self, mock_redis):
        """Test task dependency resolution"""
        resolver = TaskDependencyResolver(redis_client=mock_redis)
        
        # Create tasks with dependencies
        task1 = ProcessingTask(id="task_1", type=TaskType.EXTRACTION)
        task2 = ProcessingTask(
            id="task_2",
            type=TaskType.ANALYSIS,
            dependencies=["task_1"]
        )
        task3 = ProcessingTask(
            id="task_3",
            type=TaskType.GENERATION,
            dependencies=["task_1", "task_2"]
        )
        
        # Check if task can be executed
        can_execute = await resolver.can_execute(task2)
        assert can_execute is False
        
        # Mark task1 as completed
        await resolver.mark_completed("task_1")
        can_execute = await resolver.can_execute(task2)
        assert can_execute is True
        
        # Check task3 dependencies
        can_execute = await resolver.can_execute(task3)
        assert can_execute is False
        
        await resolver.mark_completed("task_2")
        can_execute = await resolver.can_execute(task3)
        assert can_execute is True


class TestProcessingWorker:
    """Test processing worker functionality"""
    
    @pytest.mark.asyncio
    async def test_worker_lifecycle(self, mock_redis):
        """Test worker start, process, and stop lifecycle"""
        worker = ProcessingWorker(
            worker_id="worker_1",
            redis_client=mock_redis
        )
        
        # Start worker
        await worker.start()
        assert worker.status == "running"
        
        # Process task
        task = ProcessingTask(type=TaskType.EXTRACTION, document_id="doc_123")
        result = await worker.process_task(task)
        assert result.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
        
        # Stop worker
        await worker.stop()
        assert worker.status == "stopped"
    
    @pytest.mark.asyncio
    async def test_worker_heartbeat(self, mock_redis):
        """Test worker heartbeat mechanism"""
        worker = ProcessingWorker(
            worker_id="worker_1",
            redis_client=mock_redis,
            heartbeat_interval=1
        )
        
        await worker.start()
        await asyncio.sleep(2)
        
        # Check heartbeat was sent
        mock_redis.setex.assert_called()
        
        await worker.stop()
    
    @pytest.mark.asyncio
    async def test_worker_error_handling(self, mock_redis):
        """Test worker error handling"""
        worker = ProcessingWorker(worker_id="worker_1", redis_client=mock_redis)
        
        # Simulate processing error
        task = ProcessingTask(type=TaskType.EXTRACTION, document_id="doc_123")
        
        with patch.object(worker, '_execute_task', side_effect=Exception("Processing error")):
            result = await worker.process_task(task)
            
        assert result.status == TaskStatus.FAILED
        assert "Processing error" in result.error
    
    @pytest.mark.asyncio
    async def test_worker_timeout(self, mock_redis):
        """Test worker task timeout"""
        worker = ProcessingWorker(
            worker_id="worker_1",
            redis_client=mock_redis,
            task_timeout=1
        )
        
        # Create slow task
        async def slow_task():
            await asyncio.sleep(5)
        
        task = ProcessingTask(type=TaskType.EXTRACTION, document_id="doc_123")
        
        with patch.object(worker, '_execute_task', side_effect=slow_task):
            result = await worker.process_task(task)
            
        assert result.status == TaskStatus.FAILED
        assert "timeout" in result.error.lower()


class TestQueueManager:
    """Test queue management functionality"""
    
    @pytest.mark.asyncio
    async def test_queue_statistics(self, mock_redis):
        """Test queue statistics gathering"""
        manager = QueueManager(redis_client=mock_redis)
        
        stats = await manager.get_statistics()
        
        assert "pending" in stats
        assert "processing" in stats
        assert "completed" in stats
        assert "failed" in stats
        assert "dlq_size" in stats
        assert "workers_active" in stats
    
    @pytest.mark.asyncio
    async def test_queue_health_check(self, mock_redis):
        """Test queue health monitoring"""
        manager = QueueManager(redis_client=mock_redis)
        
        health = await manager.health_check()
        
        assert health["status"] in ["healthy", "degraded", "unhealthy"]
        assert "queue_depth" in health
        assert "processing_rate" in health
        assert "error_rate" in health
        assert "worker_count" in health
    
    @pytest.mark.asyncio
    async def test_queue_cleanup(self, mock_redis):
        """Test queue cleanup operations"""
        manager = QueueManager(redis_client=mock_redis)
        
        # Clean up old completed tasks
        cleaned = await manager.cleanup_old_tasks(days=7)
        assert cleaned >= 0
        
        # Clean up stuck tasks
        recovered = await manager.recover_stuck_tasks(timeout_minutes=30)
        assert recovered >= 0
    
    @pytest.mark.asyncio
    async def test_queue_pause_resume(self, mock_redis):
        """Test pausing and resuming queue processing"""
        manager = QueueManager(redis_client=mock_redis)
        
        # Pause processing
        await manager.pause_processing()
        status = await manager.get_status()
        assert status == "paused"
        
        # Resume processing
        await manager.resume_processing()
        status = await manager.get_status()
        assert status == "running"


class TestTaskScheduler:
    """Test task scheduling functionality"""
    
    @pytest.mark.asyncio
    async def test_schedule_task(self, mock_redis):
        """Test scheduling a task for future execution"""
        scheduler = TaskScheduler(redis_client=mock_redis)
        
        task = ProcessingTask(
            type=TaskType.EXTRACTION,
            document_id="doc_123"
        )
        
        # Schedule for 1 hour from now
        scheduled_time = datetime.utcnow() + timedelta(hours=1)
        scheduled_id = await scheduler.schedule(task, scheduled_time)
        
        assert scheduled_id is not None
        mock_redis.zadd.assert_called()
    
    @pytest.mark.asyncio
    async def test_recurring_task(self, mock_redis):
        """Test recurring task scheduling"""
        scheduler = TaskScheduler(redis_client=mock_redis)
        
        task = ProcessingTask(
            type=TaskType.CLEANUP,
            document_id="cleanup_task"
        )
        
        # Schedule daily recurring task
        schedule_id = await scheduler.schedule_recurring(
            task,
            interval="daily",
            start_time=datetime.utcnow()
        )
        
        assert schedule_id is not None
        
        # Get next occurrence
        next_run = await scheduler.get_next_occurrence(schedule_id)
        assert next_run is not None
    
    @pytest.mark.asyncio
    async def test_cancel_scheduled_task(self, mock_redis):
        """Test canceling a scheduled task"""
        scheduler = TaskScheduler(redis_client=mock_redis)
        
        task = ProcessingTask(type=TaskType.EXTRACTION, document_id="doc_123")
        scheduled_id = await scheduler.schedule(task, datetime.utcnow() + timedelta(hours=1))
        
        # Cancel task
        cancelled = await scheduler.cancel(scheduled_id)
        assert cancelled is True
        
        # Verify task is removed
        mock_redis.zrem.assert_called()


class TestProcessingPipeline:
    """Test processing pipeline functionality"""
    
    @pytest.mark.asyncio
    async def test_pipeline_creation(self, mock_redis):
        """Test creating a processing pipeline"""
        pipeline = ProcessingPipeline(redis_client=mock_redis)
        
        stages = [
            {"name": "extraction", "type": TaskType.EXTRACTION},
            {"name": "analysis", "type": TaskType.ANALYSIS},
            {"name": "generation", "type": TaskType.GENERATION}
        ]
        
        pipeline_id = await pipeline.create(
            name="document_processing",
            stages=stages
        )
        
        assert pipeline_id is not None
    
    @pytest.mark.asyncio
    async def test_pipeline_execution(self, mock_redis):
        """Test executing a processing pipeline"""
        pipeline = ProcessingPipeline(redis_client=mock_redis)
        
        # Create and execute pipeline
        pipeline_id = await pipeline.create(
            name="test_pipeline",
            stages=[
                {"name": "stage1", "type": TaskType.EXTRACTION},
                {"name": "stage2", "type": TaskType.ANALYSIS}
            ]
        )
        
        execution_id = await pipeline.execute(
            pipeline_id,
            document_id="doc_123",
            tenant_id="tenant_456"
        )
        
        assert execution_id is not None
        
        # Check pipeline status
        status = await pipeline.get_status(execution_id)
        assert status["pipeline_id"] == pipeline_id
        assert "stages" in status
    
    @pytest.mark.asyncio
    async def test_pipeline_error_handling(self, mock_redis):
        """Test pipeline error handling and recovery"""
        pipeline = ProcessingPipeline(redis_client=mock_redis)
        
        pipeline_id = await pipeline.create(
            name="error_pipeline",
            stages=[
                {"name": "stage1", "type": TaskType.EXTRACTION},
                {"name": "stage2", "type": TaskType.ANALYSIS, "on_error": "skip"},
                {"name": "stage3", "type": TaskType.GENERATION}
            ]
        )
        
        # Execute with error in stage2
        with patch.object(pipeline, '_execute_stage', side_effect=[None, Exception("Stage error"), None]):
            execution_id = await pipeline.execute(pipeline_id, document_id="doc_123")
            
        status = await pipeline.get_status(execution_id)
        assert status["stages"]["stage2"]["status"] == "failed"
        assert status["stages"]["stage3"]["status"] == "completed"  # Should continue


class TestQueueMetrics:
    """Test queue metrics collection"""
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self, mock_redis):
        """Test collecting queue metrics"""
        metrics = QueueMetrics(redis_client=mock_redis)
        
        # Record task completion
        await metrics.record_task_completion("task_1", duration=5.2)
        
        # Record task failure
        await metrics.record_task_failure("task_2", error="Processing error")
        
        # Get metrics
        current_metrics = await metrics.get_metrics()
        
        assert "total_processed" in current_metrics
        assert "total_failed" in current_metrics
        assert "average_duration" in current_metrics
        assert "success_rate" in current_metrics
    
    @pytest.mark.asyncio
    async def test_metrics_aggregation(self, mock_redis):
        """Test metrics aggregation over time periods"""
        metrics = QueueMetrics(redis_client=mock_redis)
        
        # Get hourly metrics
        hourly = await metrics.get_hourly_metrics()
        assert isinstance(hourly, list)
        
        # Get daily metrics
        daily = await metrics.get_daily_metrics()
        assert isinstance(daily, list)
    
    @pytest.mark.asyncio
    async def test_performance_metrics(self, mock_redis):
        """Test performance metrics tracking"""
        metrics = QueueMetrics(redis_client=mock_redis)
        
        perf = await metrics.get_performance_metrics()
        
        assert "throughput" in perf
        assert "latency_p50" in perf
        assert "latency_p95" in perf
        assert "latency_p99" in perf
        assert "queue_depth" in perf


class TestCircuitBreaker:
    """Test circuit breaker pattern"""
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_states(self):
        """Test circuit breaker state transitions"""
        breaker = CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=5,
            expected_exception=Exception
        )
        
        # Initially closed
        assert breaker.state == "closed"
        
        # Record failures
        for _ in range(3):
            await breaker.record_failure()
        
        # Should be open after threshold
        assert breaker.state == "open"
        
        # Should reject calls when open
        with pytest.raises(Exception) as exc:
            await breaker.call(lambda: None)
        assert "Circuit breaker is open" in str(exc.value)
        
        # Wait for recovery timeout
        await asyncio.sleep(5)
        
        # Should be half-open
        assert breaker.state == "half-open"
        
        # Success should close it
        await breaker.record_success()
        assert breaker.state == "closed"
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_with_function(self):
        """Test circuit breaker with protected function"""
        breaker = CircuitBreaker(failure_threshold=2)
        
        call_count = 0
        
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise Exception("Service unavailable")
            return "Success"
        
        # First two calls fail
        for _ in range(2):
            with pytest.raises(Exception):
                await breaker.call(flaky_function)
        
        # Circuit should be open
        assert breaker.state == "open"


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, mock_redis):
        """Test rate limiting enforcement"""
        limiter = RateLimiter(
            redis_client=mock_redis,
            max_requests=10,
            window_seconds=60
        )
        
        tenant_id = "tenant_123"
        
        # Should allow initial requests
        for _ in range(10):
            allowed = await limiter.allow_request(tenant_id)
            assert allowed is True
        
        # Should block after limit
        allowed = await limiter.allow_request(tenant_id)
        assert allowed is False
    
    @pytest.mark.asyncio
    async def test_rate_limit_reset(self, mock_redis):
        """Test rate limit window reset"""
        limiter = RateLimiter(
            redis_client=mock_redis,
            max_requests=5,
            window_seconds=1
        )
        
        tenant_id = "tenant_123"
        
        # Exhaust limit
        for _ in range(5):
            await limiter.allow_request(tenant_id)
        
        # Should be blocked
        allowed = await limiter.allow_request(tenant_id)
        assert allowed is False
        
        # Wait for window reset
        await asyncio.sleep(1.1)
        
        # Should allow again
        allowed = await limiter.allow_request(tenant_id)
        assert allowed is True


class TestTaskRouter:
    """Test task routing functionality"""
    
    @pytest.mark.asyncio
    async def test_route_by_document_type(self, mock_redis):
        """Test routing tasks based on document type"""
        router = TaskRouter(redis_client=mock_redis)
        
        # Configure routing rules
        await router.add_rule(
            condition={"document_type": "contract"},
            queue="contract_processing"
        )
        await router.add_rule(
            condition={"document_type": "invoice"},
            queue="invoice_processing"
        )
        
        # Route contract task
        task = ProcessingTask(
            type=TaskType.EXTRACTION,
            document_id="doc_123",
            payload={"document_type": "contract"}
        )
        
        queue = await router.route(task)
        assert queue == "contract_processing"
    
    @pytest.mark.asyncio
    async def test_route_by_priority(self, mock_redis):
        """Test routing based on priority"""
        router = TaskRouter(redis_client=mock_redis)
        
        await router.add_rule(
            condition={"priority": TaskPriority.URGENT},
            queue="urgent_queue"
        )
        
        task = ProcessingTask(
            type=TaskType.EXTRACTION,
            document_id="doc_123",
            priority=TaskPriority.URGENT
        )
        
        queue = await router.route(task)
        assert queue == "urgent_queue"
    
    @pytest.mark.asyncio
    async def test_default_routing(self, mock_redis):
        """Test default routing when no rules match"""
        router = TaskRouter(redis_client=mock_redis)
        
        task = ProcessingTask(
            type=TaskType.EXTRACTION,
            document_id="doc_123"
        )
        
        queue = await router.route(task)
        assert queue == "default_queue"


class TestWorkerPool:
    """Test worker pool management"""
    
    @pytest.mark.asyncio
    async def test_worker_pool_scaling(self, mock_redis):
        """Test worker pool auto-scaling"""
        pool = WorkerPool(
            redis_client=mock_redis,
            min_workers=2,
            max_workers=10
        )
        
        # Start pool
        await pool.start()
        assert pool.worker_count >= 2
        
        # Simulate high load
        await pool.adjust_workers(queue_depth=100)
        assert pool.worker_count > 2
        
        # Simulate low load
        await pool.adjust_workers(queue_depth=5)
        assert pool.worker_count <= 4
        
        # Stop pool
        await pool.stop()
        assert pool.worker_count == 0
    
    @pytest.mark.asyncio
    async def test_worker_health_monitoring(self, mock_redis):
        """Test monitoring worker health"""
        pool = WorkerPool(redis_client=mock_redis)
        
        await pool.start()
        
        # Check worker health
        health = await pool.check_worker_health()
        assert "healthy" in health
        assert "unhealthy" in health
        assert "total" in health
        
        # Restart unhealthy workers
        restarted = await pool.restart_unhealthy_workers()
        assert restarted >= 0
    
    @pytest.mark.asyncio
    async def test_graceful_shutdown(self, mock_redis):
        """Test graceful shutdown of worker pool"""
        pool = WorkerPool(redis_client=mock_redis)
        
        await pool.start()
        
        # Add some tasks to workers
        for i in range(5):
            task = ProcessingTask(
                type=TaskType.EXTRACTION,
                document_id=f"doc_{i}"
            )
            await pool.assign_task(task)
        
        # Graceful shutdown should wait for tasks
        await pool.graceful_shutdown(timeout=30)
        
        assert pool.worker_count == 0
        assert pool.pending_tasks == 0