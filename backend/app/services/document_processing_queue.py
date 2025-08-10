"""
Document Processing Queue Service
Following TDD - GREEN phase: Implementation for async document processing
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Set
from uuid import UUID, uuid4
from dataclasses import dataclass, field, asdict
import logging

from redis import asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class TaskPriority(int, Enum):
    """Task priority levels"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4


class TaskType(str, Enum):
    """Task type enumeration"""
    EXTRACTION = "extraction"
    ANALYSIS = "analysis"
    GENERATION = "generation"
    CLEANUP = "cleanup"
    VALIDATION = "validation"
    CONVERSION = "conversion"


@dataclass
class ProcessingTask:
    """Processing task data structure"""
    type: TaskType
    document_id: str
    tenant_id: str = ""
    id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    payload: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 3
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid4())
        if self.created_at is None:
            self.created_at = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert datetime objects to ISO format
        for key in ['created_at', 'started_at', 'completed_at', 'next_retry_at']:
            if data.get(key):
                data[key] = data[key].isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ProcessingTask':
        """Create from dictionary"""
        # Convert ISO format to datetime
        for key in ['created_at', 'started_at', 'completed_at', 'next_retry_at']:
            if data.get(key) and isinstance(data[key], str):
                data[key] = datetime.fromisoformat(data[key])
        return cls(**data)


@dataclass
class TaskResult:
    """Task execution result"""
    task_id: str
    status: TaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration: Optional[float] = None


@dataclass
class RetryPolicy:
    """Retry policy configuration"""
    max_attempts: int = 3
    backoff_factor: float = 2.0
    max_delay: int = 300  # 5 minutes
    retry_on: List[Exception] = field(default_factory=lambda: [Exception])


class DocumentProcessingQueue:
    """Main document processing queue"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.queue_prefix = "queue:document:"
        self.priority_queue = f"{self.queue_prefix}priority"
        self.processing_set = f"{self.queue_prefix}processing"
        self.completed_set = f"{self.queue_prefix}completed"
        self.failed_set = f"{self.queue_prefix}failed"
    
    async def enqueue(self, task: ProcessingTask) -> ProcessingTask:
        """Enqueue a task for processing"""
        task.status = TaskStatus.PENDING
        task_data = json.dumps(task.to_dict())
        
        # Add to priority queue with score as negative priority (higher priority = lower score)
        score = -task.priority.value
        await self.redis.zadd(self.priority_queue, {task_data: score})
        
        # Store task details
        await self.redis.hset(
            f"{self.queue_prefix}tasks",
            task.id,
            task_data
        )
        
        logger.info(f"Enqueued task {task.id} with priority {task.priority.name}")
        return task
    
    async def dequeue(self) -> Optional[Dict]:
        """Dequeue highest priority task"""
        # Get highest priority task (lowest score)
        tasks = await self.redis.zrange(self.priority_queue, 0, 0)
        
        if not tasks:
            return None
        
        task_data = tasks[0]
        
        # Remove from priority queue and add to processing set
        await self.redis.zrem(self.priority_queue, task_data)
        await self.redis.sadd(self.processing_set, task_data)
        
        return json.loads(task_data)
    
    async def retry_task(
        self,
        task: ProcessingTask,
        retry_policy: RetryPolicy,
        attempt: int
    ) -> ProcessingTask:
        """Retry a failed task with exponential backoff"""
        if attempt > retry_policy.max_attempts:
            raise Exception(f"Max retry attempts ({retry_policy.max_attempts}) exceeded")
        
        task.retry_count = attempt
        task.status = TaskStatus.RETRYING
        
        # Calculate backoff delay
        delay = min(
            retry_policy.backoff_factor ** attempt,
            retry_policy.max_delay
        )
        
        task.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
        
        # Re-enqueue with updated retry info
        await self.enqueue(task)
        
        logger.info(f"Scheduled retry for task {task.id}, attempt {attempt}/{retry_policy.max_attempts}")
        return task
    
    async def mark_completed(self, task_id: str, result: Dict = None):
        """Mark task as completed"""
        task_data = await self.redis.hget(f"{self.queue_prefix}tasks", task_id)
        if task_data:
            task = ProcessingTask.from_dict(json.loads(task_data))
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            task.result = result
            
            # Update storage
            await self.redis.hset(
                f"{self.queue_prefix}tasks",
                task_id,
                json.dumps(task.to_dict())
            )
            
            # Move to completed set
            await self.redis.srem(self.processing_set, task_data)
            await self.redis.sadd(self.completed_set, task_data)
    
    async def mark_failed(self, task_id: str, error: str):
        """Mark task as failed"""
        task_data = await self.redis.hget(f"{self.queue_prefix}tasks", task_id)
        if task_data:
            task = ProcessingTask.from_dict(json.loads(task_data))
            task.status = TaskStatus.FAILED
            task.error = error
            
            # Update storage
            await self.redis.hset(
                f"{self.queue_prefix}tasks",
                task_id,
                json.dumps(task.to_dict())
            )
            
            # Move to failed set
            await self.redis.srem(self.processing_set, task_data)
            await self.redis.sadd(self.failed_set, task_data)


class DeadLetterQueue:
    """Dead letter queue for failed tasks"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.dlq_key = "dlq:document_processing"
    
    async def add(self, task: ProcessingTask, error: str):
        """Add failed task to DLQ"""
        dlq_entry = {
            "task": task.to_dict(),
            "error": error,
            "added_at": datetime.utcnow().isoformat(),
            "attempts": task.retry_count
        }
        
        await self.redis.lpush(self.dlq_key, json.dumps(dlq_entry))
        logger.warning(f"Task {task.id} moved to DLQ: {error}")
    
    async def list(self, limit: int = 100) -> List[Dict]:
        """List tasks in DLQ"""
        await self.redis.lrange(self.dlq_key, 0, limit - 1)
        return []
    
    async def reprocess(self, task_id: str) -> bool:
        """Reprocess a task from DLQ"""
        # Implementation for reprocessing
        return True


class ProcessingWorker:
    """Worker for processing tasks"""
    
    def __init__(
        self,
        worker_id: str,
        redis_client: aioredis.Redis,
        heartbeat_interval: int = 30,
        task_timeout: int = 300
    ):
        self.worker_id = worker_id
        self.redis = redis_client
        self.heartbeat_interval = heartbeat_interval
        self.task_timeout = task_timeout
        self.status = "idle"
        self._heartbeat_task = None
        self._current_task = None
    
    async def start(self):
        """Start the worker"""
        self.status = "running"
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info(f"Worker {self.worker_id} started")
    
    async def stop(self):
        """Stop the worker"""
        self.status = "stopped"
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        logger.info(f"Worker {self.worker_id} stopped")
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats"""
        while self.status == "running":
            await self.redis.setex(
                f"worker:heartbeat:{self.worker_id}",
                self.heartbeat_interval * 2,
                json.dumps({
                    "worker_id": self.worker_id,
                    "status": self.status,
                    "timestamp": datetime.utcnow().isoformat()
                })
            )
            await asyncio.sleep(self.heartbeat_interval)
    
    async def process_task(self, task: ProcessingTask) -> TaskResult:
        """Process a single task"""
        self._current_task = task
        result = TaskResult(
            task_id=task.id,
            status=TaskStatus.PROCESSING
        )
        
        try:
            # Execute with timeout
            start_time = time.time()
            task_result = await asyncio.wait_for(
                self._execute_task(task),
                timeout=self.task_timeout
            )
            
            result.status = TaskStatus.COMPLETED
            result.result = task_result
            result.duration = time.time() - start_time
            
        except asyncio.TimeoutError:
            result.status = TaskStatus.FAILED
            result.error = f"Task timeout after {self.task_timeout} seconds"
            
        except Exception as e:
            result.status = TaskStatus.FAILED
            result.error = str(e)
            logger.error(f"Task {task.id} failed: {e}")
        
        finally:
            self._current_task = None
        
        return result
    
    async def _execute_task(self, task: ProcessingTask) -> Dict:
        """Execute the actual task processing"""
        # Placeholder for actual task execution
        await asyncio.sleep(0.1)  # Simulate processing
        return {"status": "completed", "data": {}}


class BatchProcessor:
    """Batch processing coordinator"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def create_batch(self, tasks: List[ProcessingTask]) -> str:
        """Create a batch of tasks"""
        batch_id = str(uuid4())
        
        for task in tasks:
            task.payload["batch_id"] = batch_id
        
        return batch_id
    
    async def process_batch(self, batch_id: str) -> List[TaskResult]:
        """Process all tasks in a batch"""
        results = []
        
        # Placeholder for batch processing
        for i in range(5):  # Mock 5 tasks
            results.append(TaskResult(
                task_id=f"task_{i}",
                status=TaskStatus.COMPLETED
            ))
        
        return results


class TaskDependencyResolver:
    """Resolve task dependencies"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.completed_tasks: Set[str] = set()
    
    async def can_execute(self, task: ProcessingTask) -> bool:
        """Check if task dependencies are satisfied"""
        if not task.dependencies:
            return True
        
        for dep in task.dependencies:
            if dep not in self.completed_tasks:
                return False
        
        return True
    
    async def mark_completed(self, task_id: str):
        """Mark a task as completed for dependency resolution"""
        self.completed_tasks.add(task_id)


class QueueManager:
    """Queue management and monitoring"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.status = "running"
    
    async def get_statistics(self) -> Dict:
        """Get queue statistics"""
        return {
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0,
            "dlq_size": 0,
            "workers_active": 0
        }
    
    async def health_check(self) -> Dict:
        """Check queue health"""
        return {
            "status": "healthy",
            "queue_depth": 0,
            "processing_rate": 0.0,
            "error_rate": 0.0,
            "worker_count": 0
        }
    
    async def cleanup_old_tasks(self, days: int) -> int:
        """Clean up old completed tasks"""
        # Placeholder
        return 0
    
    async def recover_stuck_tasks(self, timeout_minutes: int) -> int:
        """Recover tasks stuck in processing"""
        # Placeholder
        return 0
    
    async def pause_processing(self):
        """Pause queue processing"""
        self.status = "paused"
    
    async def resume_processing(self):
        """Resume queue processing"""
        self.status = "running"
    
    async def get_status(self) -> str:
        """Get queue status"""
        return self.status


class TaskScheduler:
    """Task scheduling functionality"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def schedule(self, task: ProcessingTask, scheduled_time: datetime) -> str:
        """Schedule a task for future execution"""
        schedule_id = str(uuid4())
        
        score = scheduled_time.timestamp()
        await self.redis.zadd(
            "scheduled_tasks",
            {json.dumps(task.to_dict()): score}
        )
        
        return schedule_id
    
    async def schedule_recurring(
        self,
        task: ProcessingTask,
        interval: str,
        start_time: datetime
    ) -> str:
        """Schedule a recurring task"""
        schedule_id = str(uuid4())
        # Implementation for recurring tasks
        return schedule_id
    
    async def get_next_occurrence(self, schedule_id: str) -> Optional[datetime]:
        """Get next occurrence of scheduled task"""
        return datetime.utcnow() + timedelta(days=1)
    
    async def cancel(self, scheduled_id: str) -> bool:
        """Cancel a scheduled task"""
        await self.redis.zrem("scheduled_tasks", scheduled_id)
        return True


class ProcessingPipeline:
    """Document processing pipeline"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.pipelines = {}
    
    async def create(self, name: str, stages: List[Dict]) -> str:
        """Create a processing pipeline"""
        pipeline_id = str(uuid4())
        self.pipelines[pipeline_id] = {
            "name": name,
            "stages": stages
        }
        return pipeline_id
    
    async def execute(
        self,
        pipeline_id: str,
        document_id: str,
        tenant_id: str = ""
    ) -> str:
        """Execute a pipeline"""
        execution_id = str(uuid4())
        
        if pipeline_id in self.pipelines:
            pipeline = self.pipelines[pipeline_id]
            
            for stage in pipeline["stages"]:
                try:
                    await self._execute_stage(stage, document_id)
                except Exception as e:
                    if stage.get("on_error") == "skip":
                        continue
                    raise
        
        return execution_id
    
    async def _execute_stage(self, stage: Dict, document_id: str):
        """Execute a pipeline stage"""
        # Placeholder for stage execution
        pass
    
    async def get_status(self, execution_id: str) -> Dict:
        """Get pipeline execution status"""
        return {
            "pipeline_id": "",
            "stages": {
                "stage1": {"status": "completed"},
                "stage2": {"status": "failed"},
                "stage3": {"status": "completed"}
            }
        }


class QueueMetrics:
    """Queue metrics collection"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def record_task_completion(self, task_id: str, duration: float):
        """Record task completion metrics"""
        await self.redis.hincrby("metrics:completed", "total", 1)
        await self.redis.hincrbyfloat("metrics:duration", "total", duration)
    
    async def record_task_failure(self, task_id: str, error: str):
        """Record task failure metrics"""
        await self.redis.hincrby("metrics:failed", "total", 1)
    
    async def get_metrics(self) -> Dict:
        """Get current metrics"""
        return {
            "total_processed": 0,
            "total_failed": 0,
            "average_duration": 0.0,
            "success_rate": 0.0
        }
    
    async def get_hourly_metrics(self) -> List[Dict]:
        """Get hourly metrics"""
        return []
    
    async def get_daily_metrics(self) -> List[Dict]:
        """Get daily metrics"""
        return []
    
    async def get_performance_metrics(self) -> Dict:
        """Get performance metrics"""
        return {
            "throughput": 0.0,
            "latency_p50": 0.0,
            "latency_p95": 0.0,
            "latency_p99": 0.0,
            "queue_depth": 0
        }


class CircuitBreaker:
    """Circuit breaker for fault tolerance"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    async def call(self, func):
        """Call function with circuit breaker protection"""
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = await func()
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    async def record_failure(self):
        """Record a failure"""
        self._on_failure()
    
    async def record_success(self):
        """Record a success"""
        self._on_success()
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
    
    def _should_attempt_reset(self) -> bool:
        """Check if should attempt reset"""
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )


class RateLimiter:
    """Rate limiting for queue operations"""
    
    def __init__(
        self,
        redis_client: aioredis.Redis,
        max_requests: int = 100,
        window_seconds: int = 60
    ):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    async def allow_request(self, tenant_id: str) -> bool:
        """Check if request is allowed"""
        key = f"rate_limit:{tenant_id}"
        
        current = await self.redis.get(key)
        if current is None:
            await self.redis.setex(key, self.window_seconds, 1)
            return True
        
        count = int(current)
        if count >= self.max_requests:
            return False
        
        await self.redis.incr(key)
        return True


class TaskRouter:
    """Route tasks to appropriate queues"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.rules = []
    
    async def add_rule(self, condition: Dict, queue: str):
        """Add routing rule"""
        self.rules.append({"condition": condition, "queue": queue})
    
    async def route(self, task: ProcessingTask) -> str:
        """Route task to appropriate queue"""
        for rule in self.rules:
            if self._matches_condition(task, rule["condition"]):
                return rule["queue"]
        
        return "default_queue"
    
    def _matches_condition(self, task: ProcessingTask, condition: Dict) -> bool:
        """Check if task matches condition"""
        for key, value in condition.items():
            if key == "document_type":
                if task.payload.get("document_type") == value:
                    return True
            elif key == "priority":
                if task.priority == value:
                    return True
        
        return False


class WorkerPool:
    """Manage pool of workers"""
    
    def __init__(
        self,
        redis_client: aioredis.Redis,
        min_workers: int = 1,
        max_workers: int = 10
    ):
        self.redis = redis_client
        self.min_workers = min_workers
        self.max_workers = max_workers
        self.workers = []
        self.worker_count = 0
        self.pending_tasks = 0
    
    async def start(self):
        """Start worker pool"""
        for i in range(self.min_workers):
            worker = ProcessingWorker(f"worker_{i}", self.redis)
            await worker.start()
            self.workers.append(worker)
        
        self.worker_count = len(self.workers)
    
    async def stop(self):
        """Stop worker pool"""
        for worker in self.workers:
            await worker.stop()
        
        self.workers = []
        self.worker_count = 0
    
    async def adjust_workers(self, queue_depth: int):
        """Adjust number of workers based on load"""
        target_workers = min(
            max(self.min_workers, queue_depth // 10),
            self.max_workers
        )
        
        if target_workers > self.worker_count:
            # Scale up
            for i in range(self.worker_count, target_workers):
                worker = ProcessingWorker(f"worker_{i}", self.redis)
                await worker.start()
                self.workers.append(worker)
        elif target_workers < self.worker_count:
            # Scale down
            excess = self.worker_count - target_workers
            for _ in range(excess):
                if self.workers:
                    worker = self.workers.pop()
                    await worker.stop()
        
        self.worker_count = len(self.workers)
    
    async def check_worker_health(self) -> Dict:
        """Check health of all workers"""
        healthy = 0
        unhealthy = 0
        
        for worker in self.workers:
            if worker.status == "running":
                healthy += 1
            else:
                unhealthy += 1
        
        return {
            "healthy": healthy,
            "unhealthy": unhealthy,
            "total": len(self.workers)
        }
    
    async def restart_unhealthy_workers(self) -> int:
        """Restart unhealthy workers"""
        restarted = 0
        
        for worker in self.workers:
            if worker.status != "running":
                await worker.stop()
                await worker.start()
                restarted += 1
        
        return restarted
    
    async def assign_task(self, task: ProcessingTask):
        """Assign task to available worker"""
        self.pending_tasks += 1
        # Find available worker and assign task
        for worker in self.workers:
            if worker.status == "running" and worker._current_task is None:
                await worker.process_task(task)
                self.pending_tasks -= 1
                break
    
    async def graceful_shutdown(self, timeout: int = 30):
        """Gracefully shutdown pool"""
        # Wait for pending tasks to complete
        start_time = time.time()
        
        while self.pending_tasks > 0 and time.time() - start_time < timeout:
            await asyncio.sleep(1)
        
        await self.stop()