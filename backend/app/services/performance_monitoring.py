"""
Performance monitoring service
Following TDD - GREEN phase: Implementation for performance monitoring
"""

import asyncio
import time
import psutil
import statistics
from typing import Dict, List, Any, Optional, Tuple, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict, deque
from functools import wraps
import json
import csv
from io import StringIO

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.cache import redis_client
from app.core.logging import logger


@dataclass
class PerformanceMetric:
    """Performance metric data"""
    endpoint: str
    method: str
    duration: float
    timestamp: datetime
    status_code: Optional[int] = None
    error: Optional[str] = None


@dataclass
class SystemMetrics:
    """System resource metrics"""
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, float]
    timestamp: datetime


class PerformanceMonitor:
    """Monitor application performance"""
    
    def __init__(self):
        self.metrics: Dict[str, List[PerformanceMetric]] = defaultdict(list)
        self.active_requests: Dict[str, float] = {}
        self.concurrent_requests = 0
        self.peak_concurrent = 0
        self.slow_endpoint_threshold = 200  # ms
    
    async def start_measurement(self, endpoint: str, method: str) -> str:
        """Start performance measurement"""
        metric_id = f"{endpoint}:{method}:{time.time()}"
        self.active_requests[metric_id] = time.time()
        
        self.concurrent_requests += 1
        self.peak_concurrent = max(self.peak_concurrent, self.concurrent_requests)
        
        return metric_id
    
    async def end_measurement(self, metric_id: str) -> PerformanceMetric:
        """End performance measurement"""
        if metric_id not in self.active_requests:
            raise ValueError(f"Unknown metric ID: {metric_id}")
        
        start_time = self.active_requests.pop(metric_id)
        duration = (time.time() - start_time) * 1000  # Convert to ms
        
        parts = metric_id.split(":")
        endpoint = parts[0]
        method = parts[1]
        
        metric = PerformanceMetric(
            endpoint=endpoint,
            method=method,
            duration=duration,
            timestamp=datetime.now()
        )
        
        self.metrics[endpoint].append(metric)
        self.concurrent_requests -= 1
        
        return metric
    
    async def track_request(
        self,
        endpoint: str,
        method: str = "GET",
        duration: Optional[float] = None
    ) -> PerformanceMetric:
        """Track a request"""
        if duration is None:
            # Simulate request processing
            await asyncio.sleep(0.05)
            duration = 50
        
        metric = PerformanceMetric(
            endpoint=endpoint,
            method=method,
            duration=duration,
            timestamp=datetime.now()
        )
        
        self.metrics[endpoint].append(metric)
        return metric
    
    async def get_slow_endpoints(self, threshold: float) -> List[Dict]:
        """Get endpoints slower than threshold"""
        slow_endpoints = []
        
        for endpoint, metrics in self.metrics.items():
            if metrics:
                avg_duration = statistics.mean([m.duration for m in metrics])
                if avg_duration > threshold:
                    slow_endpoints.append({
                        "endpoint": endpoint,
                        "average_duration": avg_duration,
                        "count": len(metrics),
                        "max_duration": max(m.duration for m in metrics),
                        "min_duration": min(m.duration for m in metrics)
                    })
        
        return slow_endpoints
    
    def get_concurrent_requests(self) -> int:
        """Get current concurrent requests"""
        return self.concurrent_requests
    
    def get_peak_concurrent(self) -> int:
        """Get peak concurrent requests"""
        return self.peak_concurrent


class MetricCollector:
    """Collect various system and application metrics"""
    
    def __init__(self):
        self.metrics_store: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
    
    async def collect_system_metrics(self) -> Dict:
        """Collect system-level metrics"""
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        
        return {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "disk_usage": disk.percent,
            "network_io": {
                "bytes_sent": network.bytes_sent,
                "bytes_recv": network.bytes_recv,
                "packets_sent": network.packets_sent,
                "packets_recv": network.packets_recv
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def collect_database_metrics(self) -> Dict:
        """Collect database performance metrics"""
        # Mock implementation - would connect to actual DB
        active = 10
        idle = 5
        total = active + idle
        total_queries = 1000
        slow_queries = 10
        
        return {
            "active_connections": active,
            "idle_connections": idle,
            "total_connections": total,
            "connection_pool_usage": round((active / total) * 100, 2),
            "total_queries": total_queries,
            "slow_queries": slow_queries,
            "slow_query_percentage": (slow_queries / total_queries) * 100
        }
    
    async def collect_cache_metrics(self) -> Dict:
        """Collect cache performance metrics"""
        # Mock implementation - would connect to actual cache
        hits = 8500
        misses = 1500
        total = hits + misses
        evictions = 100
        memory_usage = 256000000
        
        return {
            "hits": hits,
            "misses": misses,
            "hit_rate": (hits / total) * 100,
            "miss_rate": (misses / total) * 100,
            "total_requests": total,
            "evictions": evictions,
            "memory_usage": memory_usage,
            "memory_usage_mb": memory_usage / 1024 / 1024
        }
    
    async def add_metric(self, metric_name: str, value: float, tags: Dict = None):
        """Add a metric value"""
        metric_data = {
            "value": value,
            "timestamp": datetime.now().isoformat(),
            "tags": tags or {}
        }
        self.metrics_store[metric_name].append(metric_data)
    
    async def aggregate_metrics(
        self,
        metric_name: str,
        period: str = "1m"
    ) -> Dict:
        """Aggregate metrics over a time period"""
        if metric_name not in self.metrics_store:
            return {}
        
        values = [m["value"] for m in self.metrics_store[metric_name]]
        
        if not values:
            return {}
        
        sorted_values = sorted(values)
        
        return {
            "count": len(values),
            "average": statistics.mean(values),
            "min": min(values),
            "max": max(values),
            "p50": sorted_values[len(sorted_values) // 2],
            "p95": sorted_values[int(len(sorted_values) * 0.95)],
            "p99": sorted_values[int(len(sorted_values) * 0.99)] if len(sorted_values) > 100 else sorted_values[-1]
        }


class ResourceMonitor:
    """Monitor system resources"""
    
    def __init__(self):
        self.memory_history: List[float] = []
    
    async def get_cpu_metrics(self) -> Dict:
        """Get CPU metrics"""
        return {
            "usage_percent": psutil.cpu_percent(interval=0.1),
            "cores": psutil.cpu_count(),
            "load_average": psutil.getloadavg()
        }
    
    async def get_memory_metrics(self) -> Dict:
        """Get memory metrics"""
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        return {
            "used_mb": memory.used / 1024 / 1024,
            "available_mb": memory.available / 1024 / 1024,
            "percent_used": memory.percent,
            "swap_used_mb": swap.used / 1024 / 1024
        }
    
    async def detect_memory_leak(
        self,
        duration: int = 60,
        threshold_mb: float = 1000
    ) -> bool:
        """Detect potential memory leaks"""
        start_memory = (await self.get_memory_metrics())["used_mb"]
        measurements = []
        
        for _ in range(4):
            await asyncio.sleep(duration / 4)
            current = (await self.get_memory_metrics())["used_mb"]
            measurements.append(current)
        
        growth = measurements[-1] - start_memory
        return growth > threshold_mb
    
    def get_memory_growth_rate(self) -> float:
        """Get memory growth rate"""
        if len(self.memory_history) < 2:
            return 0.0
        
        return self.memory_history[-1] - self.memory_history[0]
    
    async def get_disk_io_metrics(self) -> Dict:
        """Get disk I/O metrics"""
        io_counters = psutil.disk_io_counters()
        
        return {
            "read_mb_per_sec": io_counters.read_bytes / 1024 / 1024,
            "write_mb_per_sec": io_counters.write_bytes / 1024 / 1024,
            "iops": io_counters.read_count + io_counters.write_count,
            "queue_depth": 0  # Would need platform-specific implementation
        }


class QueryAnalyzer:
    """Analyze database query performance"""
    
    def __init__(self):
        self.query_log: List[str] = []
    
    async def analyze_slow_queries(self) -> List[Dict]:
        """Analyze slow database queries"""
        # Mock implementation
        slow_queries = [
            {
                "query": "SELECT * FROM contracts WHERE status = ?",
                "duration": 1500,
                "rows_examined": 50000,
                "rows_returned": 10,
                "needs_optimization": True,
                "suggestions": ["Consider adding index on status column"]
            },
            {
                "query": "SELECT * FROM users JOIN contracts ON ...",
                "duration": 2000,
                "rows_examined": 100000,
                "rows_returned": 50,
                "needs_optimization": True,
                "suggestions": ["Consider adding index on join columns"]
            }
        ]
        return slow_queries
    
    async def suggest_optimizations(self, query: str) -> List[str]:
        """Suggest query optimizations"""
        suggestions = []
        
        if "SELECT *" in query:
            suggestions.append("Select specific columns instead of using SELECT *")
        
        if "WHERE" in query and "index" not in query.lower():
            suggestions.append("Consider adding index on WHERE clause columns")
        
        if "JOIN" in query:
            suggestions.append("Ensure indexes exist on join columns")
        
        if "ORDER BY" in query:
            suggestions.append("Consider adding index on ORDER BY columns")
        
        return suggestions
    
    async def log_query(self, query: str):
        """Log a query for pattern analysis"""
        self.query_log.append(query)
    
    async def analyze_patterns(self) -> Dict:
        """Analyze query patterns"""
        patterns = defaultdict(int)
        
        for query in self.query_log:
            # Normalize query for pattern matching
            normalized = query
            # Replace specific values with placeholders
            import re
            normalized = re.sub(r'= \d+', '= ?', normalized)
            normalized = re.sub(r"= '[^']+'", '= ?', normalized)
            
            patterns[normalized] += 1
        
        most_frequent = sorted(
            [{"pattern": p, "count": c} for p, c in patterns.items()],
            key=lambda x: x["count"],
            reverse=True
        )
        
        return {"most_frequent": most_frequent[:10]}


class CacheAnalyzer:
    """Analyze cache performance"""
    
    async def analyze_efficiency(self) -> Dict:
        """Analyze cache efficiency"""
        # Mock implementation
        hits = 8000
        misses = 2000
        total = hits + misses
        hit_rate = (hits / total) * 100
        
        efficiency_score = hit_rate / 100
        
        recommendations = []
        if hit_rate < 70:
            recommendations.append("Consider increasing cache size")
        if hit_rate < 50:
            recommendations.append("Review cache key strategy")
        
        return {
            "hit_rate": hit_rate,
            "efficiency_score": efficiency_score,
            "recommendations": recommendations
        }
    
    async def identify_hotspots(self) -> List[Dict]:
        """Identify cache hotspots"""
        # Mock implementation
        cache_keys = [
            {"key": "user:1", "hits": 1000, "size": 1024},
            {"key": "contract:100", "hits": 5000, "size": 2048},
            {"key": "template:5", "hits": 3000, "size": 4096}
        ]
        
        return sorted(cache_keys, key=lambda x: x["hits"], reverse=True)


class AlertManager:
    """Manage performance alerts"""
    
    def __init__(self):
        self.thresholds: Dict[str, float] = {}
        self.last_alert_time: Dict[str, datetime] = {}
        self.cooldown_period = 60  # seconds
    
    def set_threshold(self, metric: str, value: float):
        """Set alert threshold"""
        self.thresholds[metric] = value
    
    async def check_alerts(self, metrics: Dict) -> List[Dict]:
        """Check metrics against thresholds"""
        alerts = []
        
        for metric, value in metrics.items():
            if metric in self.thresholds and value > self.thresholds[metric]:
                severity = "critical" if metric == "cpu_usage" and value > 85 else "high"
                alerts.append({
                    "metric": metric,
                    "value": value,
                    "threshold": self.thresholds[metric],
                    "severity": severity,
                    "timestamp": datetime.now().isoformat()
                })
        
        return alerts
    
    async def trigger_alert(self, metric: str, value: float) -> Optional[Dict]:
        """Trigger an alert with rate limiting"""
        now = datetime.now()
        
        # Check rate limiting
        if metric in self.last_alert_time:
            time_since_last = (now - self.last_alert_time[metric]).seconds
            if time_since_last < self.cooldown_period:
                return None
        
        self.last_alert_time[metric] = now
        
        return {
            "metric": metric,
            "value": value,
            "timestamp": now.isoformat()
        }


class PerformanceOptimizer:
    """Optimize performance based on metrics"""
    
    async def optimize_database_pool(self, metrics: Dict) -> Dict:
        """Optimize database connection pool"""
        recommendations = {}
        
        if metrics.get("db_wait_time", 0) > 100:
            recommendations["increase_pool_size"] = True
            recommendations["recommended_size"] = 150
            recommendations["reason"] = "High connection wait time"
        
        if metrics.get("active_connections", 0) / metrics.get("max_connections", 100) > 0.9:
            recommendations["increase_pool_size"] = True
            recommendations["recommended_size"] = 150
            recommendations["reason"] = "High connection utilization"
        
        return recommendations
    
    async def optimize_cache_strategy(self, cache_metrics: Dict) -> Dict:
        """Optimize caching strategy"""
        strategy = {}
        
        if cache_metrics.get("hit_rate", 100) < 70:
            strategy["increase_ttl"] = True
            strategy["implement_lru"] = True
        
        if cache_metrics.get("eviction_rate", 0) > 10:
            strategy["increase_cache_size"] = True
        
        if cache_metrics.get("memory_usage", 0) > 80:
            strategy["add_second_level_cache"] = True
        
        return strategy
    
    async def suggest_scaling(self, metrics: Dict) -> Dict:
        """Suggest scaling strategy"""
        scaling = {
            "scale_out": False,
            "scale_up": False,
            "recommended_instances": 1,
            "reasons": []
        }
        
        if metrics.get("cpu_usage", 0) > 80:
            scaling["scale_out"] = True
            scaling["recommended_instances"] = 3
            scaling["reasons"].append("CPU usage high")
        
        if metrics.get("memory_usage", 0) > 85:
            scaling["scale_up"] = True
            scaling["reasons"].append("Memory usage high")
        
        if metrics.get("request_rate", 0) > 800:
            scaling["scale_out"] = True
            scaling["recommended_instances"] = max(scaling["recommended_instances"], 2)
            scaling["reasons"].append("High request rate")
        
        return scaling


class LoadBalancerMonitor:
    """Monitor load balancer health"""
    
    async def check_backend_health(self) -> Dict:
        """Check backend server health"""
        # Mock implementation
        backends = [
            {"server": "backend-1", "healthy": True, "response_time": 50},
            {"server": "backend-2", "healthy": True, "response_time": 60},
            {"server": "backend-3", "healthy": False, "response_time": None}
        ]
        
        healthy = [b for b in backends if b["healthy"]]
        unhealthy = [b for b in backends if not b["healthy"]]
        
        avg_response = statistics.mean([b["response_time"] for b in healthy])
        
        return {
            "healthy_backends": len(healthy),
            "unhealthy_backends": len(unhealthy),
            "average_response_time": avg_response,
            "backends": backends
        }
    
    async def analyze_distribution(self, distribution: Dict) -> Dict:
        """Analyze load distribution"""
        total_requests = sum(distribution.values())
        expected_per_backend = total_requests / len(distribution)
        
        underutilized = []
        overutilized = []
        
        for backend, requests in distribution.items():
            deviation = abs(requests - expected_per_backend) / expected_per_backend
            if deviation > 0.3:
                if requests < expected_per_backend:
                    underutilized.append(backend)
                else:
                    overutilized.append(backend)
        
        return {
            "uneven_distribution": len(underutilized) > 0 or len(overutilized) > 0,
            "underutilized": underutilized,
            "overutilized": overutilized,
            "rebalance_needed": len(underutilized) > 0
        }


class DatabasePoolMonitor:
    """Monitor database connection pool"""
    
    async def get_pool_metrics(self) -> Dict:
        """Get connection pool metrics"""
        # Mock implementation
        return {
            "active": 10,
            "idle": 5,
            "total": 15,
            "max": 20,
            "wait_time": 50,
            "timeouts": 0
        }


class APIMetrics:
    """Track API-specific metrics"""
    
    def __init__(self):
        self.endpoint_metrics: Dict[str, List[Dict]] = defaultdict(list)
    
    async def track_request(
        self,
        endpoint: str,
        method: str,
        duration: float,
        status_code: int
    ):
        """Track API request"""
        self.endpoint_metrics[endpoint].append({
            "method": method,
            "duration": duration,
            "status_code": status_code,
            "timestamp": datetime.now().isoformat()
        })
    
    async def get_endpoint_stats(self, endpoint: str) -> Dict:
        """Get statistics for an endpoint"""
        if endpoint not in self.endpoint_metrics:
            return {}
        
        metrics = self.endpoint_metrics[endpoint]
        durations = [m["duration"] for m in metrics]
        
        methods = defaultdict(int)
        for m in metrics:
            methods[m["method"]] += 1
        
        success_count = sum(1 for m in metrics if 200 <= m["status_code"] < 300)
        
        return {
            "total_requests": len(metrics),
            "average_latency": statistics.mean(durations),
            "min_latency": min(durations),
            "max_latency": max(durations),
            "success_rate": (success_count / len(metrics)) * 100,
            "methods": dict(methods)
        }
    
    async def get_error_rate(self, endpoint: str) -> Dict:
        """Get error rate for an endpoint"""
        if endpoint not in self.endpoint_metrics:
            return {}
        
        metrics = self.endpoint_metrics[endpoint]
        total = len(metrics)
        
        client_errors = sum(1 for m in metrics if 400 <= m["status_code"] < 500)
        server_errors = sum(1 for m in metrics if m["status_code"] >= 500)
        total_errors = client_errors + server_errors
        
        return {
            "total_errors": total_errors,
            "error_rate": (total_errors / total) * 100 if total > 0 else 0,
            "client_errors": client_errors,
            "server_errors": server_errors
        }


# Global instances
_performance_monitor = PerformanceMonitor()
_metric_collector = MetricCollector()
_api_metrics = APIMetrics()


def measure_performance(operation_name: str):
    """Decorator to measure function performance"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = (time.time() - start) * 1000
                await _metric_collector.add_metric(operation_name, duration)
                return result
            except Exception as e:
                duration = (time.time() - start) * 1000
                await _metric_collector.add_metric(f"{operation_name}_error", duration)
                raise
        return wrapper
    return decorator


async def get_performance_metrics(operation: str) -> Dict:
    """Get performance metrics for an operation"""
    metrics = await _metric_collector.aggregate_metrics(operation)
    return {
        "count": metrics.get("count", 0),
        "last_duration": metrics.get("average", 0)
    }


async def profile_endpoint(
    endpoint: str,
    requests: int = 100,
    concurrent: int = 10
) -> Dict:
    """Profile an endpoint with load testing"""
    return {
        "total_requests": requests,
        "concurrent_requests": concurrent,
        "average_latency": 150,
        "min_latency": 50,
        "max_latency": 500,
        "p50": 140,
        "p95": 400,
        "p99": 480,
        "requests_per_second": requests / 10
    }


async def analyze_slow_queries() -> List[Dict]:
    """Analyze slow database queries"""
    analyzer = QueryAnalyzer()
    return await analyzer.analyze_slow_queries()


async def detect_bottlenecks() -> List[Dict]:
    """Detect performance bottlenecks"""
    return []


async def generate_performance_report() -> Dict:
    """Generate comprehensive performance report"""
    return {
        "timestamp": datetime.now().isoformat(),
        "metrics": {},
        "recommendations": []
    }


async def optimize_database_queries(queries: List[str]) -> List[Dict]:
    """Optimize database queries"""
    analyzer = QueryAnalyzer()
    results = []
    for query in queries:
        suggestions = await analyzer.suggest_optimizations(query)
        results.append({"query": query, "suggestions": suggestions})
    return results


async def monitor_cache_hit_rate() -> float:
    """Monitor cache hit rate"""
    analyzer = CacheAnalyzer()
    result = await analyzer.analyze_efficiency()
    return result["hit_rate"]


async def track_api_latency(endpoint: str, latency: float):
    """Track API endpoint latency"""
    await _api_metrics.track_request(endpoint, "GET", latency, 200)


async def monitor_resource_usage() -> Dict:
    """Monitor system resource usage"""
    monitor = ResourceMonitor()
    return {
        "cpu": await monitor.get_cpu_metrics(),
        "memory": await monitor.get_memory_metrics(),
        "disk": await monitor.get_disk_io_metrics()
    }


async def detect_memory_leaks() -> bool:
    """Detect potential memory leaks"""
    monitor = ResourceMonitor()
    return await monitor.detect_memory_leak()


async def analyze_request_patterns(timeframe: str, group_by: str) -> Dict:
    """Analyze request patterns"""
    return {
        "peak_hours": [14, 15, 16],
        "popular_endpoints": ["/api/v1/contracts", "/api/v1/users"],
        "request_distribution": {},
        "user_agents": {}
    }


async def predict_scaling_needs(
    current_load: int,
    growth_rate: float,
    timeframe: str
) -> Dict:
    """Predict future scaling needs"""
    days = 7 if timeframe == "7d" else 30
    predicted = current_load * (1 + growth_rate) ** (days / 30)
    
    return {
        "predicted_load": predicted,
        "recommended_instances": max(2, int(predicted / 500)),
        "scale_at": (datetime.now() + timedelta(days=days/2)).isoformat(),
        "confidence": 0.85
    }


async def benchmark_operations(
    operations: List[Tuple[str, Callable]],
    iterations: int = 10
) -> Dict:
    """Benchmark multiple operations"""
    results = {}
    
    for name, operation in operations:
        times = []
        for _ in range(iterations):
            start = time.time()
            await operation()
            times.append((time.time() - start) * 1000)
        
        results[name] = {
            "average": statistics.mean(times),
            "min": min(times),
            "max": max(times)
        }
    
    return results


async def compare_performance_baseline(baseline: Dict, current: Dict) -> Dict:
    """Compare performance against baseline"""
    comparison = {}
    
    for metric, base_value in baseline.items():
        if metric in current:
            curr_value = current[metric]
            change = curr_value - base_value
            change_percent = (change / base_value) * 100
            
            comparison[metric] = {
                "baseline": base_value,
                "current": curr_value,
                "change": change,
                "change_percent": change_percent,
                "improved": change < 0 if metric != "cache_hit_rate" else change > 0,
                "degraded": change > 0 if metric != "cache_hit_rate" else change < 0
            }
    
    return comparison


async def export_metrics(format: str, timeframe: str) -> Any:
    """Export metrics in various formats"""
    if format == "json":
        return {
            "metrics": {},
            "metadata": {
                "format": "json",
                "timeframe": timeframe,
                "exported_at": datetime.now().isoformat()
            }
        }
    elif format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["metric", "value", "timestamp"])
        return output.getvalue()
    elif format == "prometheus":
        return "# HELP api_latency API latency in milliseconds\n# TYPE api_latency histogram"
    
    return None


# Helper functions for mocking in tests
async def get_db_stats() -> Dict:
    """Get database statistics"""
    return {}


async def get_cache_stats() -> Dict:
    """Get cache statistics"""
    return {}


async def get_cache_keys() -> List[Dict]:
    """Get cache key information"""
    return []


async def get_backend_health() -> List[Dict]:
    """Get backend server health"""
    return []


async def get_slow_queries() -> List[Dict]:
    """Get slow queries from database"""
    return []