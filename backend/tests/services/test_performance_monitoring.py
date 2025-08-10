"""
Performance monitoring service tests
Following TDD - RED phase: Comprehensive performance monitoring tests
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List, Any

from app.services.performance_monitoring import (
    PerformanceMonitor,
    MetricCollector,
    AlertManager,
    PerformanceOptimizer,
    ResourceMonitor,
    QueryAnalyzer,
    CacheAnalyzer,
    LoadBalancerMonitor,
    DatabasePoolMonitor,
    APIMetrics,
    measure_performance,
    profile_endpoint,
    analyze_slow_queries,
    detect_bottlenecks,
    generate_performance_report,
    optimize_database_queries,
    monitor_cache_hit_rate,
    track_api_latency,
    monitor_resource_usage,
    detect_memory_leaks,
    analyze_request_patterns,
    predict_scaling_needs,
    benchmark_operations,
    compare_performance_baseline,
    export_metrics
)


class TestPerformanceMonitor:
    """Test performance monitoring functionality"""
    
    @pytest.fixture
    def performance_monitor(self):
        """Create performance monitor instance"""
        return PerformanceMonitor()
    
    @pytest.fixture
    def metric_collector(self):
        """Create metric collector instance"""
        return MetricCollector()
    
    @pytest.fixture
    def alert_manager(self):
        """Create alert manager instance"""
        return AlertManager()
    
    @pytest.mark.asyncio
    async def test_measure_endpoint_performance(self, performance_monitor):
        """Test measuring API endpoint performance"""
        # Start measurement
        metric_id = await performance_monitor.start_measurement(
            endpoint="/api/v1/contracts",
            method="GET"
        )
        
        # Simulate processing
        await asyncio.sleep(0.1)
        
        # End measurement
        result = await performance_monitor.end_measurement(metric_id)
        
        assert result.endpoint == "/api/v1/contracts"
        assert result.method == "GET"
        assert result.duration >= 100  # At least 100ms
        assert result.timestamp is not None
    
    @pytest.mark.asyncio
    async def test_track_concurrent_requests(self, performance_monitor):
        """Test tracking multiple concurrent requests"""
        tasks = []
        
        # Simulate 10 concurrent requests
        for i in range(10):
            task = performance_monitor.track_request(
                endpoint=f"/api/v1/endpoint_{i}",
                method="GET"
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 10
        assert performance_monitor.get_concurrent_requests() == 0
        assert performance_monitor.get_peak_concurrent() >= 10
    
    @pytest.mark.asyncio
    async def test_detect_slow_endpoints(self, performance_monitor):
        """Test detection of slow API endpoints"""
        # Track fast endpoint
        await performance_monitor.track_request(
            endpoint="/api/v1/fast",
            duration=50
        )
        
        # Track slow endpoints
        for _ in range(5):
            await performance_monitor.track_request(
                endpoint="/api/v1/slow",
                duration=500
            )
        
        slow_endpoints = await performance_monitor.get_slow_endpoints(
            threshold=100
        )
        
        assert len(slow_endpoints) == 1
        assert slow_endpoints[0]["endpoint"] == "/api/v1/slow"
        assert slow_endpoints[0]["average_duration"] == 500
        assert slow_endpoints[0]["count"] == 5


class TestMetricCollector:
    """Test metric collection functionality"""
    
    @pytest.mark.asyncio
    async def test_collect_system_metrics(self):
        """Test collecting system-level metrics"""
        collector = MetricCollector()
        
        metrics = await collector.collect_system_metrics()
        
        assert "cpu_usage" in metrics
        assert "memory_usage" in metrics
        assert "disk_usage" in metrics
        assert "network_io" in metrics
        assert 0 <= metrics["cpu_usage"] <= 100
        assert 0 <= metrics["memory_usage"] <= 100
    
    @pytest.mark.asyncio
    async def test_collect_database_metrics(self):
        """Test collecting database performance metrics"""
        collector = MetricCollector()
        
        with patch("app.services.performance_monitoring.get_db_stats") as mock_stats:
            mock_stats.return_value = {
                "active_connections": 10,
                "idle_connections": 5,
                "total_queries": 1000,
                "slow_queries": 10
            }
            
            metrics = await collector.collect_database_metrics()
            
            assert metrics["active_connections"] == 10
            assert metrics["idle_connections"] == 5
            assert metrics["connection_pool_usage"] == 66.67
            assert metrics["slow_query_percentage"] == 1.0
    
    @pytest.mark.asyncio
    async def test_collect_cache_metrics(self):
        """Test collecting cache performance metrics"""
        collector = MetricCollector()
        
        with patch("app.services.performance_monitoring.get_cache_stats") as mock_stats:
            mock_stats.return_value = {
                "hits": 8500,
                "misses": 1500,
                "evictions": 100,
                "memory_usage": 256000000  # 256MB
            }
            
            metrics = await collector.collect_cache_metrics()
            
            assert metrics["hit_rate"] == 85.0
            assert metrics["miss_rate"] == 15.0
            assert metrics["total_requests"] == 10000
            assert metrics["memory_usage_mb"] == 256
    
    @pytest.mark.asyncio
    async def test_aggregate_metrics(self):
        """Test aggregating metrics over time"""
        collector = MetricCollector()
        
        # Add sample metrics
        for i in range(10):
            await collector.add_metric(
                "api_latency",
                value=100 + i * 10,
                tags={"endpoint": "/api/v1/test"}
            )
        
        aggregated = await collector.aggregate_metrics(
            metric_name="api_latency",
            period="1m"
        )
        
        assert aggregated["count"] == 10
        assert aggregated["average"] == 145
        assert aggregated["min"] == 100
        assert aggregated["max"] == 190
        assert aggregated["p50"] == 145
        assert aggregated["p95"] == 185


class TestResourceMonitor:
    """Test resource monitoring functionality"""
    
    @pytest.mark.asyncio
    async def test_monitor_cpu_usage(self):
        """Test CPU usage monitoring"""
        monitor = ResourceMonitor()
        
        cpu_metrics = await monitor.get_cpu_metrics()
        
        assert "usage_percent" in cpu_metrics
        assert "cores" in cpu_metrics
        assert "load_average" in cpu_metrics
        assert 0 <= cpu_metrics["usage_percent"] <= 100
    
    @pytest.mark.asyncio
    async def test_monitor_memory_usage(self):
        """Test memory usage monitoring"""
        monitor = ResourceMonitor()
        
        memory_metrics = await monitor.get_memory_metrics()
        
        assert "used_mb" in memory_metrics
        assert "available_mb" in memory_metrics
        assert "percent_used" in memory_metrics
        assert "swap_used_mb" in memory_metrics
    
    @pytest.mark.asyncio
    async def test_detect_memory_leaks(self):
        """Test memory leak detection"""
        monitor = ResourceMonitor()
        
        # Simulate memory growth
        with patch.object(monitor, "get_memory_metrics") as mock_memory:
            mock_memory.side_effect = [
                {"used_mb": 1000, "percent_used": 25},
                {"used_mb": 1500, "percent_used": 37.5},
                {"used_mb": 2000, "percent_used": 50},
                {"used_mb": 2500, "percent_used": 62.5}
            ]
            
            leak_detected = await monitor.detect_memory_leak(
                duration=60,
                threshold_mb=1000
            )
            
            assert leak_detected is True
            assert monitor.get_memory_growth_rate() > 0
    
    @pytest.mark.asyncio
    async def test_monitor_disk_io(self):
        """Test disk I/O monitoring"""
        monitor = ResourceMonitor()
        
        disk_metrics = await monitor.get_disk_io_metrics()
        
        assert "read_mb_per_sec" in disk_metrics
        assert "write_mb_per_sec" in disk_metrics
        assert "iops" in disk_metrics
        assert "queue_depth" in disk_metrics


class TestQueryAnalyzer:
    """Test database query analysis"""
    
    @pytest.mark.asyncio
    async def test_analyze_slow_queries(self):
        """Test analyzing slow database queries"""
        analyzer = QueryAnalyzer()
        
        with patch("app.services.performance_monitoring.get_slow_queries") as mock_queries:
            mock_queries.return_value = [
                {
                    "query": "SELECT * FROM contracts WHERE status = ?",
                    "duration": 1500,
                    "rows_examined": 50000,
                    "rows_returned": 10
                },
                {
                    "query": "SELECT * FROM users JOIN contracts ON ...",
                    "duration": 2000,
                    "rows_examined": 100000,
                    "rows_returned": 50
                }
            ]
            
            analysis = await analyzer.analyze_slow_queries()
            
            assert len(analysis) == 2
            assert analysis[0]["needs_optimization"] is True
            assert "add_index" in analysis[0]["suggestions"][0]
    
    @pytest.mark.asyncio
    async def test_suggest_query_optimizations(self):
        """Test query optimization suggestions"""
        analyzer = QueryAnalyzer()
        
        query = """
        SELECT * FROM contracts c
        JOIN users u ON c.user_id = u.id
        WHERE c.status = 'active'
        AND u.tenant_id = 1
        ORDER BY c.created_at DESC
        """
        
        suggestions = await analyzer.suggest_optimizations(query)
        
        assert len(suggestions) > 0
        assert any("index" in s.lower() for s in suggestions)
        assert any("select specific columns" in s.lower() for s in suggestions)
    
    @pytest.mark.asyncio
    async def test_analyze_query_patterns(self):
        """Test analyzing query patterns"""
        analyzer = QueryAnalyzer()
        
        # Add sample queries
        queries = [
            "SELECT * FROM contracts WHERE tenant_id = 1",
            "SELECT * FROM contracts WHERE tenant_id = 2",
            "SELECT id, name FROM users WHERE email = 'test@example.com'",
            "SELECT * FROM contracts WHERE tenant_id = 1",
        ]
        
        for query in queries:
            await analyzer.log_query(query)
        
        patterns = await analyzer.analyze_patterns()
        
        assert patterns["most_frequent"][0]["pattern"] == "SELECT * FROM contracts WHERE tenant_id = ?"
        assert patterns["most_frequent"][0]["count"] == 3


class TestCacheAnalyzer:
    """Test cache performance analysis"""
    
    @pytest.mark.asyncio
    async def test_analyze_cache_efficiency(self):
        """Test cache efficiency analysis"""
        analyzer = CacheAnalyzer()
        
        with patch("app.services.performance_monitoring.get_cache_stats") as mock_stats:
            mock_stats.return_value = {
                "hits": 8000,
                "misses": 2000,
                "evictions": 500,
                "memory_usage": 512000000
            }
            
            analysis = await analyzer.analyze_efficiency()
            
            assert analysis["hit_rate"] == 80.0
            assert analysis["efficiency_score"] >= 0.7
            assert "increase_cache_size" not in analysis["recommendations"]
    
    @pytest.mark.asyncio
    async def test_identify_cache_hotspots(self):
        """Test identifying cache hotspots"""
        analyzer = CacheAnalyzer()
        
        with patch("app.services.performance_monitoring.get_cache_keys") as mock_keys:
            mock_keys.return_value = [
                {"key": "user:1", "hits": 1000, "size": 1024},
                {"key": "contract:100", "hits": 5000, "size": 2048},
                {"key": "template:5", "hits": 3000, "size": 4096}
            ]
            
            hotspots = await analyzer.identify_hotspots()
            
            assert hotspots[0]["key"] == "contract:100"
            assert hotspots[0]["hits"] == 5000
            assert len(hotspots) == 3


class TestAlertManager:
    """Test performance alert management"""
    
    @pytest.mark.asyncio
    async def test_trigger_performance_alert(self):
        """Test triggering performance alerts"""
        manager = AlertManager()
        
        # Set thresholds
        manager.set_threshold("api_latency", 200)
        manager.set_threshold("cpu_usage", 80)
        
        # Check metrics that exceed thresholds
        alerts = await manager.check_alerts({
            "api_latency": 250,
            "cpu_usage": 90,
            "memory_usage": 60
        })
        
        assert len(alerts) == 2
        assert alerts[0]["metric"] == "api_latency"
        assert alerts[0]["severity"] == "high"
        assert alerts[1]["metric"] == "cpu_usage"
        assert alerts[1]["severity"] == "critical"
    
    @pytest.mark.asyncio
    async def test_alert_rate_limiting(self):
        """Test alert rate limiting to prevent spam"""
        manager = AlertManager()
        manager.set_threshold("api_latency", 200)
        
        # First alert should trigger
        alert1 = await manager.trigger_alert("api_latency", 250)
        assert alert1 is not None
        
        # Immediate second alert should be rate limited
        alert2 = await manager.trigger_alert("api_latency", 260)
        assert alert2 is None
        
        # After cooldown, alert should trigger again
        await asyncio.sleep(manager.cooldown_period)
        alert3 = await manager.trigger_alert("api_latency", 270)
        assert alert3 is not None


class TestPerformanceOptimizer:
    """Test performance optimization functionality"""
    
    @pytest.mark.asyncio
    async def test_auto_optimize_database_pool(self):
        """Test automatic database pool optimization"""
        optimizer = PerformanceOptimizer()
        
        metrics = {
            "db_wait_time": 500,
            "active_connections": 95,
            "max_connections": 100,
            "average_query_time": 50
        }
        
        optimizations = await optimizer.optimize_database_pool(metrics)
        
        assert optimizations["increase_pool_size"] is True
        assert optimizations["recommended_size"] == 150
        assert "High connection utilization" in optimizations["reason"]
    
    @pytest.mark.asyncio
    async def test_optimize_cache_strategy(self):
        """Test cache strategy optimization"""
        optimizer = PerformanceOptimizer()
        
        cache_metrics = {
            "hit_rate": 60,
            "eviction_rate": 20,
            "memory_usage": 90
        }
        
        strategy = await optimizer.optimize_cache_strategy(cache_metrics)
        
        assert strategy["increase_ttl"] is True
        assert strategy["implement_lru"] is True
        assert strategy["add_second_level_cache"] is True
    
    @pytest.mark.asyncio
    async def test_suggest_scaling_strategy(self):
        """Test scaling strategy suggestions"""
        optimizer = PerformanceOptimizer()
        
        metrics = {
            "cpu_usage": 85,
            "memory_usage": 70,
            "request_rate": 1000,
            "response_time": 300
        }
        
        scaling = await optimizer.suggest_scaling(metrics)
        
        assert scaling["scale_out"] is True
        assert scaling["recommended_instances"] >= 2
        assert "CPU usage high" in scaling["reasons"]


class TestLoadBalancerMonitor:
    """Test load balancer monitoring"""
    
    @pytest.mark.asyncio
    async def test_monitor_backend_health(self):
        """Test monitoring backend server health"""
        monitor = LoadBalancerMonitor()
        
        with patch("app.services.performance_monitoring.get_backend_health") as mock_health:
            mock_health.return_value = [
                {"server": "backend-1", "healthy": True, "response_time": 50},
                {"server": "backend-2", "healthy": True, "response_time": 60},
                {"server": "backend-3", "healthy": False, "response_time": None}
            ]
            
            health = await monitor.check_backend_health()
            
            assert health["healthy_backends"] == 2
            assert health["unhealthy_backends"] == 1
            assert health["average_response_time"] == 55
    
    @pytest.mark.asyncio
    async def test_detect_uneven_load_distribution(self):
        """Test detecting uneven load distribution"""
        monitor = LoadBalancerMonitor()
        
        distribution = {
            "backend-1": 500,
            "backend-2": 450,
            "backend-3": 50  # Significantly lower
        }
        
        issues = await monitor.analyze_distribution(distribution)
        
        assert issues["uneven_distribution"] is True
        assert "backend-3" in issues["underutilized"]
        assert issues["rebalance_needed"] is True


class TestAPIMetrics:
    """Test API metrics tracking"""
    
    @pytest.mark.asyncio
    async def test_track_endpoint_metrics(self):
        """Test tracking metrics for API endpoints"""
        metrics = APIMetrics()
        
        # Track multiple requests
        await metrics.track_request("/api/v1/contracts", "GET", 100, 200)
        await metrics.track_request("/api/v1/contracts", "GET", 150, 200)
        await metrics.track_request("/api/v1/contracts", "POST", 200, 201)
        await metrics.track_request("/api/v1/users", "GET", 80, 200)
        
        stats = await metrics.get_endpoint_stats("/api/v1/contracts")
        
        assert stats["total_requests"] == 3
        assert stats["average_latency"] == 150
        assert stats["success_rate"] == 100
        assert stats["methods"]["GET"] == 2
        assert stats["methods"]["POST"] == 1
    
    @pytest.mark.asyncio
    async def test_calculate_api_error_rates(self):
        """Test calculating API error rates"""
        metrics = APIMetrics()
        
        # Track requests with various status codes
        await metrics.track_request("/api/v1/test", "GET", 100, 200)
        await metrics.track_request("/api/v1/test", "GET", 100, 404)
        await metrics.track_request("/api/v1/test", "GET", 100, 500)
        await metrics.track_request("/api/v1/test", "GET", 100, 200)
        
        error_rate = await metrics.get_error_rate("/api/v1/test")
        
        assert error_rate["total_errors"] == 2
        assert error_rate["error_rate"] == 50.0
        assert error_rate["client_errors"] == 1
        assert error_rate["server_errors"] == 1


@pytest.mark.asyncio
async def test_measure_performance_decorator():
    """Test performance measurement decorator"""
    
    @measure_performance("test_operation")
    async def slow_operation():
        await asyncio.sleep(0.1)
        return "result"
    
    result = await slow_operation()
    
    assert result == "result"
    # Check that metric was recorded
    metrics = await get_performance_metrics("test_operation")
    assert metrics["count"] == 1
    assert metrics["last_duration"] >= 100


@pytest.mark.asyncio
async def test_profile_endpoint():
    """Test endpoint profiling"""
    
    profile = await profile_endpoint(
        endpoint="/api/v1/contracts",
        requests=100,
        concurrent=10
    )
    
    assert profile["total_requests"] == 100
    assert profile["concurrent_requests"] == 10
    assert "average_latency" in profile
    assert "min_latency" in profile
    assert "max_latency" in profile
    assert "p50" in profile
    assert "p95" in profile
    assert "p99" in profile
    assert "requests_per_second" in profile


@pytest.mark.asyncio
async def test_analyze_request_patterns():
    """Test analyzing request patterns"""
    
    patterns = await analyze_request_patterns(
        timeframe="1h",
        group_by="endpoint"
    )
    
    assert "peak_hours" in patterns
    assert "popular_endpoints" in patterns
    assert "request_distribution" in patterns
    assert "user_agents" in patterns


@pytest.mark.asyncio
async def test_predict_scaling_needs():
    """Test predicting scaling requirements"""
    
    prediction = await predict_scaling_needs(
        current_load=1000,
        growth_rate=0.1,
        timeframe="7d"
    )
    
    assert prediction["predicted_load"] > 1000
    assert "recommended_instances" in prediction
    assert "scale_at" in prediction
    assert "confidence" in prediction


@pytest.mark.asyncio
async def test_benchmark_operations():
    """Test benchmarking various operations"""
    
    operations = [
        ("database_query", lambda: asyncio.sleep(0.05)),
        ("cache_lookup", lambda: asyncio.sleep(0.01)),
        ("api_call", lambda: asyncio.sleep(0.1))
    ]
    
    results = await benchmark_operations(operations, iterations=10)
    
    assert len(results) == 3
    assert results["cache_lookup"]["average"] < results["database_query"]["average"]
    assert results["database_query"]["average"] < results["api_call"]["average"]


@pytest.mark.asyncio
async def test_compare_performance_baseline():
    """Test comparing performance against baseline"""
    
    baseline = {
        "api_latency": 100,
        "database_time": 50,
        "cache_hit_rate": 85
    }
    
    current = {
        "api_latency": 120,
        "database_time": 45,
        "cache_hit_rate": 90
    }
    
    comparison = await compare_performance_baseline(baseline, current)
    
    assert comparison["api_latency"]["degraded"] is True
    assert comparison["api_latency"]["change_percent"] == 20
    assert comparison["database_time"]["improved"] is True
    assert comparison["cache_hit_rate"]["improved"] is True


@pytest.mark.asyncio
async def test_export_metrics():
    """Test exporting performance metrics"""
    
    # Export as JSON
    json_export = await export_metrics(format="json", timeframe="1h")
    assert "metrics" in json_export
    assert "metadata" in json_export
    assert json_export["metadata"]["format"] == "json"
    
    # Export as CSV
    csv_export = await export_metrics(format="csv", timeframe="1h")
    assert isinstance(csv_export, str)
    assert "metric,value,timestamp" in csv_export
    
    # Export as Prometheus format
    prom_export = await export_metrics(format="prometheus", timeframe="1h")
    assert "# HELP" in prom_export
    assert "# TYPE" in prom_export