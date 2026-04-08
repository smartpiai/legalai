"""
Tests for database performance optimization service.
Following TDD methodology - RED phase: failing tests first.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")

import asyncio
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from neo4j import AsyncSession as Neo4jAsyncSession
from qdrant_client import QdrantClient

from app.services.database_performance import (
    DatabasePerformanceService,
    QueryAnalysis,
    IndexRecommendation,
    ConnectionPoolMetrics,
    CacheMetrics,
    PerformanceReport,
    OptimizationStrategy,
    DatabaseType,
    QueryOptimizer,
    IndexManager,
    ConnectionPoolManager,
    CacheOptimizer,
    PerformanceMonitor,
    MultiTenantOptimizer
)


class TestQueryAnalysis:
    """Test query analysis functionality."""

    @pytest.fixture
    async def performance_service(self, test_db_session):
        """Create performance service instance."""
        service = DatabasePerformanceService()
        await service.initialize()
        return service

    @pytest.mark.asyncio
    async def test_analyze_slow_query_basic(self, performance_service):
        """Test basic slow query analysis."""
        query = "SELECT * FROM contracts WHERE tenant_id = 1 AND status = 'active'"
        
        analysis = await performance_service.analyze_query(query)
        
        assert isinstance(analysis, QueryAnalysis)
        assert analysis.query == query
        assert analysis.execution_time > 0
        assert analysis.cost_estimate > 0
        assert len(analysis.recommendations) > 0

    @pytest.mark.asyncio
    async def test_analyze_query_with_explain_plan(self, performance_service):
        """Test query analysis with explain plan."""
        query = "SELECT c.*, u.name FROM contracts c JOIN users u ON c.user_id = u.id WHERE c.tenant_id = 1"
        
        analysis = await performance_service.analyze_query(query, include_explain=True)
        
        assert analysis.explain_plan is not None
        assert "Seq Scan" in analysis.explain_plan or "Index Scan" in analysis.explain_plan
        assert analysis.tables_accessed == ["contracts", "users"]

    @pytest.mark.asyncio
    async def test_detect_missing_indexes(self, performance_service):
        """Test detection of missing indexes."""
        # This should identify missing indexes on frequently queried columns
        recommendations = await performance_service.detect_missing_indexes()
        
        assert isinstance(recommendations, list)
        assert all(isinstance(rec, IndexRecommendation) for rec in recommendations)
        
        # Should recommend index on tenant_id for multi-tenant queries
        tenant_index_found = any(
            "tenant_id" in rec.columns and rec.table_name in ["contracts", "documents", "users"]
            for rec in recommendations
        )
        assert tenant_index_found

    @pytest.mark.asyncio
    async def test_identify_redundant_indexes(self, performance_service):
        """Test identification of redundant indexes."""
        redundant_indexes = await performance_service.identify_redundant_indexes()
        
        assert isinstance(redundant_indexes, list)
        # Should detect if we have both (a) and (a,b) indexes where (a,b) can replace (a)

    @pytest.mark.asyncio
    async def test_query_rewriting_suggestions(self, performance_service):
        """Test query rewriting suggestions."""
        inefficient_query = "SELECT * FROM contracts WHERE UPPER(title) = 'TEST'"
        
        analysis = await performance_service.analyze_query(inefficient_query)
        
        # Should suggest using functional index or avoiding UPPER in WHERE clause
        suggestions = [rec for rec in analysis.recommendations if "rewrite" in rec.lower()]
        assert len(suggestions) > 0

    @pytest.mark.asyncio
    async def test_prepared_statement_optimization(self, performance_service):
        """Test prepared statement optimization analysis."""
        query = "SELECT * FROM contracts WHERE tenant_id = $1 AND status = $2"
        
        optimization = await performance_service.optimize_prepared_statement(query)
        
        assert optimization is not None
        assert optimization.parameter_count == 2
        assert optimization.cache_hit_ratio >= 0


class TestIndexManagement:
    """Test index management functionality."""

    @pytest.fixture
    async def index_manager(self):
        """Create index manager instance."""
        return IndexManager()

    @pytest.mark.asyncio
    async def test_index_usage_statistics(self, index_manager, test_db_session):
        """Test index usage statistics collection."""
        stats = await index_manager.get_index_usage_stats(test_db_session)
        
        assert isinstance(stats, dict)
        assert all(isinstance(table_stats, dict) for table_stats in stats.values())

    @pytest.mark.asyncio
    async def test_create_missing_index(self, index_manager, test_db_session):
        """Test automatic index creation."""
        recommendation = IndexRecommendation(
            table_name="contracts",
            columns=["tenant_id", "status"],
            index_type="btree",
            estimated_benefit=0.8,
            reason="Frequent WHERE clause usage"
        )
        
        result = await index_manager.create_index(test_db_session, recommendation)
        
        assert result.success
        assert result.index_name is not None

    @pytest.mark.asyncio
    async def test_composite_index_optimization(self, index_manager, test_db_session):
        """Test composite index optimization."""
        query_patterns = [
            "SELECT * FROM contracts WHERE tenant_id = ? AND status = ?",
            "SELECT * FROM contracts WHERE tenant_id = ? AND created_at > ?",
            "SELECT * FROM contracts WHERE tenant_id = ?"
        ]
        
        recommendations = await index_manager.optimize_composite_indexes(
            test_db_session, query_patterns
        )
        
        assert len(recommendations) > 0
        # Should recommend (tenant_id, status) and (tenant_id, created_at) composite indexes

    @pytest.mark.asyncio
    async def test_index_maintenance_scheduling(self, index_manager):
        """Test index maintenance scheduling."""
        schedule = await index_manager.create_maintenance_schedule()
        
        assert isinstance(schedule, dict)
        assert "reindex" in schedule
        assert "analyze" in schedule
        assert "vacuum" in schedule


class TestConnectionPoolManagement:
    """Test connection pool management functionality."""

    @pytest.fixture
    async def pool_manager(self):
        """Create connection pool manager instance."""
        return ConnectionPoolManager()

    @pytest.mark.asyncio
    async def test_connection_pool_monitoring(self, pool_manager):
        """Test connection pool monitoring."""
        metrics = await pool_manager.get_pool_metrics(DatabaseType.POSTGRESQL)
        
        assert isinstance(metrics, ConnectionPoolMetrics)
        assert metrics.total_connections >= 0
        assert metrics.active_connections >= 0
        assert metrics.idle_connections >= 0

    @pytest.mark.asyncio
    async def test_connection_leak_detection(self, pool_manager):
        """Test connection leak detection."""
        leaks = await pool_manager.detect_connection_leaks()
        
        assert isinstance(leaks, list)
        # Each leak should have connection info and duration

    @pytest.mark.asyncio
    async def test_pool_size_optimization(self, pool_manager):
        """Test pool size optimization recommendations."""
        optimization = await pool_manager.optimize_pool_size(DatabaseType.POSTGRESQL)
        
        assert optimization.recommended_pool_size > 0
        assert optimization.recommended_max_overflow >= 0
        assert optimization.confidence_score > 0

    @pytest.mark.asyncio
    async def test_connection_retry_logic(self, pool_manager):
        """Test connection retry logic."""
        retry_config = await pool_manager.optimize_retry_strategy()
        
        assert retry_config.max_retries > 0
        assert retry_config.backoff_factor > 0
        assert retry_config.max_delay > 0

    @pytest.mark.asyncio
    async def test_multi_database_pool_management(self, pool_manager):
        """Test multi-database pool management."""
        all_metrics = await pool_manager.get_all_pool_metrics()
        
        assert DatabaseType.POSTGRESQL in all_metrics
        assert DatabaseType.REDIS in all_metrics
        assert DatabaseType.NEO4J in all_metrics
        assert DatabaseType.QDRANT in all_metrics


class TestCacheOptimization:
    """Test cache optimization functionality."""

    @pytest.fixture
    async def cache_optimizer(self):
        """Create cache optimizer instance."""
        return CacheOptimizer()

    @pytest.mark.asyncio
    async def test_cache_hit_ratio_monitoring(self, cache_optimizer):
        """Test cache hit ratio monitoring."""
        metrics = await cache_optimizer.get_cache_metrics()
        
        assert isinstance(metrics, CacheMetrics)
        assert 0 <= metrics.hit_ratio <= 1
        assert metrics.total_hits >= 0
        assert metrics.total_misses >= 0

    @pytest.mark.asyncio
    async def test_cache_invalidation_strategy(self, cache_optimizer):
        """Test cache invalidation strategy optimization."""
        strategy = await cache_optimizer.optimize_invalidation_strategy()
        
        assert strategy.ttl_recommendations is not None
        assert strategy.invalidation_patterns is not None

    @pytest.mark.asyncio
    async def test_cache_warm_up_procedures(self, cache_optimizer):
        """Test cache warm-up procedures."""
        warm_up_plan = await cache_optimizer.create_warmup_plan()
        
        assert isinstance(warm_up_plan, list)
        assert all(hasattr(item, 'key_pattern') for item in warm_up_plan)

    @pytest.mark.asyncio
    async def test_distributed_cache_management(self, cache_optimizer):
        """Test distributed cache management."""
        distribution_strategy = await cache_optimizer.optimize_distribution()
        
        assert distribution_strategy.sharding_key is not None
        assert distribution_strategy.replication_factor > 0

    @pytest.mark.asyncio
    async def test_cache_size_optimization(self, cache_optimizer):
        """Test cache size optimization."""
        size_recommendation = await cache_optimizer.optimize_cache_size()
        
        assert size_recommendation.recommended_memory_mb > 0
        assert size_recommendation.max_keys > 0

    @pytest.mark.asyncio
    async def test_ttl_management(self, cache_optimizer):
        """Test TTL management optimization."""
        ttl_strategy = await cache_optimizer.optimize_ttl_strategy()
        
        assert ttl_strategy.default_ttl > 0
        assert isinstance(ttl_strategy.pattern_specific_ttls, dict)


class TestPerformanceMonitoring:
    """Test performance monitoring functionality."""

    @pytest.fixture
    async def performance_monitor(self):
        """Create performance monitor instance."""
        return PerformanceMonitor()

    @pytest.mark.asyncio
    async def test_real_time_metrics_collection(self, performance_monitor):
        """Test real-time performance metrics collection."""
        metrics = await performance_monitor.collect_real_time_metrics()
        
        assert isinstance(metrics, dict)
        assert DatabaseType.POSTGRESQL in metrics
        assert "query_latency" in metrics[DatabaseType.POSTGRESQL]
        assert "throughput" in metrics[DatabaseType.POSTGRESQL]

    @pytest.mark.asyncio
    async def test_deadlock_detection(self, performance_monitor):
        """Test deadlock detection."""
        deadlocks = await performance_monitor.detect_deadlocks()
        
        assert isinstance(deadlocks, list)
        # Each deadlock should have transaction info and queries involved

    @pytest.mark.asyncio
    async def test_lock_monitoring(self, performance_monitor):
        """Test lock monitoring."""
        lock_info = await performance_monitor.monitor_locks()
        
        assert isinstance(lock_info, dict)
        assert "active_locks" in lock_info
        assert "waiting_locks" in lock_info

    @pytest.mark.asyncio
    async def test_transaction_analysis(self, performance_monitor):
        """Test transaction analysis."""
        transaction_metrics = await performance_monitor.analyze_transactions()
        
        assert transaction_metrics.avg_duration > 0
        assert transaction_metrics.long_running_count >= 0
        assert transaction_metrics.rollback_ratio >= 0

    @pytest.mark.asyncio
    async def test_replication_lag_monitoring(self, performance_monitor):
        """Test replication lag monitoring."""
        # Mock replication setup for testing
        with patch.object(performance_monitor, '_has_replication', return_value=True):
            lag_metrics = await performance_monitor.monitor_replication_lag()
            
            assert lag_metrics.max_lag_seconds >= 0
            assert lag_metrics.avg_lag_seconds >= 0

    @pytest.mark.asyncio
    async def test_table_statistics_collection(self, performance_monitor):
        """Test table statistics collection."""
        stats = await performance_monitor.collect_table_statistics()
        
        assert isinstance(stats, dict)
        # Should include table sizes, row counts, and index usage


class TestMultiTenantOptimization:
    """Test multi-tenant optimization functionality."""

    @pytest.fixture
    async def mt_optimizer(self):
        """Create multi-tenant optimizer instance."""
        return MultiTenantOptimizer()

    @pytest.mark.asyncio
    async def test_tenant_specific_optimization(self, mt_optimizer, test_db_session):
        """Test tenant-specific query optimization."""
        tenant_id = 1
        optimization = await mt_optimizer.optimize_for_tenant(test_db_session, tenant_id)
        
        assert optimization.tenant_id == tenant_id
        assert len(optimization.recommended_indexes) >= 0
        assert optimization.estimated_improvement > 0

    @pytest.mark.asyncio
    async def test_resource_allocation_per_tenant(self, mt_optimizer):
        """Test resource allocation recommendations per tenant."""
        allocations = await mt_optimizer.recommend_resource_allocation()
        
        assert isinstance(allocations, dict)
        # Should have allocations for different tenants based on usage

    @pytest.mark.asyncio
    async def test_tenant_data_distribution_analysis(self, mt_optimizer, test_db_session):
        """Test tenant data distribution analysis."""
        distribution = await mt_optimizer.analyze_data_distribution(test_db_session)
        
        assert isinstance(distribution, dict)
        assert "tenant_sizes" in distribution
        assert "data_skew" in distribution

    @pytest.mark.asyncio
    async def test_cross_tenant_performance_impact(self, mt_optimizer):
        """Test cross-tenant performance impact analysis."""
        impact_analysis = await mt_optimizer.analyze_cross_tenant_impact()
        
        assert impact_analysis.isolation_score >= 0
        assert len(impact_analysis.interference_patterns) >= 0


class TestPerformanceReporting:
    """Test performance reporting functionality."""

    @pytest.fixture
    async def performance_service(self):
        """Create performance service instance."""
        service = DatabasePerformanceService()
        await service.initialize()
        return service

    @pytest.mark.asyncio
    async def test_generate_performance_dashboard(self, performance_service):
        """Test performance dashboard generation."""
        dashboard = await performance_service.generate_dashboard()
        
        assert isinstance(dashboard, dict)
        assert "overview" in dashboard
        assert "query_performance" in dashboard
        assert "index_usage" in dashboard
        assert "cache_metrics" in dashboard

    @pytest.mark.asyncio
    async def test_automated_performance_alerts(self, performance_service):
        """Test automated performance alerts."""
        alerts = await performance_service.check_performance_alerts()
        
        assert isinstance(alerts, list)
        # Each alert should have severity, type, and message

    @pytest.mark.asyncio
    async def test_trend_analysis(self, performance_service):
        """Test performance trend analysis."""
        trends = await performance_service.analyze_performance_trends(
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now()
        )
        
        assert isinstance(trends, dict)
        assert "query_latency_trend" in trends
        assert "throughput_trend" in trends

    @pytest.mark.asyncio
    async def test_capacity_planning(self, performance_service):
        """Test capacity planning recommendations."""
        capacity_plan = await performance_service.generate_capacity_plan()
        
        assert capacity_plan.projected_growth_rate > 0
        assert capacity_plan.recommended_scaling_actions is not None

    @pytest.mark.asyncio
    async def test_sla_monitoring(self, performance_service):
        """Test SLA monitoring."""
        sla_status = await performance_service.monitor_sla_compliance()
        
        assert 0 <= sla_status.availability_percentage <= 100
        assert sla_status.avg_response_time > 0
        assert isinstance(sla_status.violations, list)

    @pytest.mark.asyncio
    async def test_cost_optimization_recommendations(self, performance_service):
        """Test cost optimization recommendations."""
        cost_optimization = await performance_service.analyze_cost_optimization()
        
        assert cost_optimization.potential_savings >= 0
        assert len(cost_optimization.recommendations) >= 0


class TestBenchmarkingAndOptimization:
    """Test benchmarking and optimization execution."""

    @pytest.fixture
    async def performance_service(self):
        """Create performance service instance."""
        service = DatabasePerformanceService()
        await service.initialize()
        return service

    @pytest.mark.asyncio
    async def test_performance_benchmarking(self, performance_service):
        """Test performance benchmarking."""
        benchmark_results = await performance_service.run_performance_benchmark()
        
        assert benchmark_results.baseline_performance > 0
        assert benchmark_results.optimized_performance >= benchmark_results.baseline_performance
        assert len(benchmark_results.test_queries) > 0

    @pytest.mark.asyncio
    async def test_automated_optimization_execution(self, performance_service):
        """Test automated optimization execution."""
        optimization_plan = await performance_service.create_optimization_plan()
        
        assert isinstance(optimization_plan.strategies, list)
        assert all(isinstance(strategy, OptimizationStrategy) for strategy in optimization_plan.strategies)

        # Execute safe optimizations
        execution_results = await performance_service.execute_optimization_plan(
            optimization_plan, safe_mode=True
        )
        
        assert execution_results.success_count >= 0
        assert execution_results.failure_count >= 0

    @pytest.mark.asyncio
    async def test_rollback_optimization_changes(self, performance_service):
        """Test rollback of optimization changes."""
        # First create a checkpoint
        checkpoint = await performance_service.create_checkpoint()
        assert checkpoint.checkpoint_id is not None

        # Then test rollback
        rollback_result = await performance_service.rollback_to_checkpoint(checkpoint.checkpoint_id)
        assert rollback_result.success

    @pytest.mark.asyncio
    async def test_a_b_testing_optimizations(self, performance_service):
        """Test A/B testing of optimizations."""
        test_config = await performance_service.setup_ab_test(
            control_config="current",
            treatment_config="optimized"
        )
        
        assert test_config.test_id is not None
        assert test_config.traffic_split > 0

        # Simulate running the test
        results = await performance_service.analyze_ab_test_results(test_config.test_id)
        assert results.statistical_significance >= 0

    @pytest.mark.asyncio
    async def test_comprehensive_performance_report(self, performance_service):
        """Test comprehensive performance report generation."""
        report = await performance_service.generate_comprehensive_report()
        
        assert isinstance(report, PerformanceReport)
        assert report.executive_summary is not None
        assert len(report.detailed_findings) > 0
        assert len(report.recommendations) > 0
        assert report.roi_analysis is not None


class TestErrorHandlingAndEdgeCases:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_invalid_query_analysis(self):
        """Test handling of invalid queries."""
        service = DatabasePerformanceService()
        await service.initialize()
        
        invalid_query = "SELECT * FROM non_existent_table WHERE invalid_syntax"
        
        with pytest.raises(Exception):
            await service.analyze_query(invalid_query)

    @pytest.mark.asyncio
    async def test_database_connection_failure(self):
        """Test handling of database connection failures."""
        service = DatabasePerformanceService()
        
        # Mock connection failure
        with patch.object(service, '_get_db_connection', side_effect=Exception("Connection failed")):
            with pytest.raises(Exception):
                await service.collect_real_time_metrics()

    @pytest.mark.asyncio
    async def test_insufficient_permissions(self):
        """Test handling of insufficient database permissions."""
        service = DatabasePerformanceService()
        await service.initialize()
        
        # Mock permission error
        with patch.object(service, '_execute_query', side_effect=Exception("Permission denied")):
            with pytest.raises(Exception):
                await service.detect_missing_indexes()

    @pytest.mark.asyncio
    async def test_concurrent_optimization_execution(self):
        """Test handling of concurrent optimization execution."""
        service = DatabasePerformanceService()
        await service.initialize()
        
        # Test that concurrent optimizations are handled safely
        tasks = [
            service.optimize_prepared_statement("SELECT * FROM contracts WHERE tenant_id = $1"),
            service.optimize_prepared_statement("SELECT * FROM documents WHERE tenant_id = $1"),
            service.optimize_prepared_statement("SELECT * FROM users WHERE tenant_id = $1")
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        assert len(results) == 3
        # At least some should succeed, none should cause system failure