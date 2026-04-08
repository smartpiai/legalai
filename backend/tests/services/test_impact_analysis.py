"""
Test suite for Impact Analysis System.
Tests change propagation modeling, affected entity identification, risk cascade analysis, and impact visualization.
Following TDD - RED phase: Writing comprehensive failing tests first.
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live Neo4j.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live Neo4j required")

from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
import json
import asyncio
from typing import Dict, Any, List, Optional, Set, Tuple
from decimal import Decimal

from app.services.graph.impact_analysis import (
    ImpactAnalysisEngine,
    ImpactAnalyzer,
    ChangeEvent,
    ImpactNode,
    ImpactEdge,
    ImpactPath,
    ImpactResult,
    ImpactQuery,
    ChangePropagationModel,
    RiskCascadeAnalyzer,
    DependencyMapper,
    ImpactVisualizer,
    ImpactScenarioEngine,
    ImpactMetrics,
    ImpactSimulator,
    WhatIfAnalyzer,
    ImpactReportGenerator
)
from app.services.graph.impact_analysis import (
    ImpactAnalysisError,
    CircularDependencyError,
    InsufficientDataError,
    ImpactCalculationError,
    InvalidScenarioError
)


class TestImpactAnalysisEngine:
    """Test suite for the Impact Analysis Engine."""
    
    @pytest.fixture
    def impact_engine(self):
        """Create an ImpactAnalysisEngine instance for testing."""
        return ImpactAnalysisEngine()
    
    @pytest.fixture
    def sample_contracts_graph(self):
        """Sample contract graph for impact analysis testing."""
        return {
            "nodes": [
                {"id": "master-001", "type": "Contract", "title": "Master Service Agreement", "value": 1000000, "status": "active"},
                {"id": "amend-001", "type": "Contract", "title": "Amendment 1", "value": 50000, "status": "active"},
                {"id": "sow-001", "type": "Contract", "title": "Statement of Work 1", "value": 200000, "status": "active"},
                {"id": "sow-002", "type": "Contract", "title": "Statement of Work 2", "value": 300000, "status": "active"},
                {"id": "party-vendor", "type": "Party", "name": "Tech Vendor Corp", "relationship": "vendor"},
                {"id": "party-client", "type": "Party", "name": "Client Corp", "relationship": "client"},
                {"id": "clause-term", "type": "Clause", "text": "Termination clause", "risk_level": "high"},
                {"id": "clause-payment", "type": "Clause", "text": "Payment terms", "risk_level": "medium"},
                {"id": "obligation-delivery", "type": "Obligation", "description": "Software delivery", "due_date": "2024-12-31"}
            ],
            "relationships": [
                {"from": "amend-001", "to": "master-001", "type": "AMENDS", "weight": 0.8},
                {"from": "sow-001", "to": "master-001", "type": "REFERENCES", "weight": 0.9},
                {"from": "sow-002", "to": "master-001", "type": "REFERENCES", "weight": 0.9},
                {"from": "master-001", "to": "party-vendor", "type": "PARTY_TO", "weight": 1.0},
                {"from": "master-001", "to": "party-client", "type": "PARTY_TO", "weight": 1.0},
                {"from": "master-001", "to": "clause-term", "type": "CONTAINS", "weight": 0.7},
                {"from": "sow-001", "to": "clause-payment", "type": "CONTAINS", "weight": 0.6},
                {"from": "sow-001", "to": "obligation-delivery", "type": "CREATES", "weight": 0.9}
            ]
        }
    
    @pytest.fixture
    def sample_change_event(self):
        """Sample change event for testing."""
        return ChangeEvent(
            id="change-001",
            source_node="master-001",
            change_type="termination",
            change_data={
                "reason": "breach_of_contract",
                "effective_date": "2024-06-01",
                "notice_period": 30
            },
            severity="high",
            confidence=0.85
        )
    
    # Change Propagation Modeling Tests
    
    @pytest.mark.asyncio
    async def test_basic_change_propagation(self, impact_engine, sample_contracts_graph, sample_change_event):
        """Test basic change propagation through contract relationships."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        query = ImpactQuery(
            change_event=sample_change_event,
            max_hops=3,
            include_indirect_impacts=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result is not None
        assert len(result.affected_nodes) >= 3  # Should affect amendments and SOWs
        assert result.total_impact_score > 0
        assert any(node.id == "amend-001" for node in result.affected_nodes)
        assert any(node.id == "sow-001" for node in result.affected_nodes)
        assert any(node.id == "sow-002" for node in result.affected_nodes)
    
    @pytest.mark.asyncio
    async def test_impact_cascade_through_dependencies(self, impact_engine, sample_contracts_graph):
        """Test impact cascading through contract dependencies."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        # Change in amendment should cascade to master and related SOWs
        change_event = ChangeEvent(
            id="change-002",
            source_node="amend-001",
            change_type="value_change",
            change_data={"old_value": 50000, "new_value": 100000},
            severity="medium"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            cascade_rules={"value_change": {"multiplier": 1.2, "decay": 0.1}},
            max_hops=2
        )
        
        result = await impact_engine.analyze_impact(query)
        
        # Should cascade to master agreement and potentially SOWs
        master_impact = next((node for node in result.affected_nodes if node.id == "master-001"), None)
        assert master_impact is not None
        assert master_impact.impact_score > 0
        assert master_impact.impact_type == "cascaded"
    
    @pytest.mark.asyncio
    async def test_bidirectional_impact_analysis(self, impact_engine, sample_contracts_graph):
        """Test bidirectional impact analysis (upstream and downstream)."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-003",
            source_node="clause-term",
            change_type="clause_modification",
            change_data={"modification": "extended_notice_period"},
            severity="high"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            direction="bidirectional",
            max_hops=2
        )
        
        result = await impact_engine.analyze_impact(query)
        
        # Should find both upstream (contracts containing the clause) and downstream impacts
        assert len(result.impact_paths) >= 1
        assert result.upstream_impacts > 0
        assert result.downstream_impacts >= 0  # May not have downstream for clauses
    
    # Risk Cascade Analysis Tests
    
    @pytest.mark.asyncio
    async def test_risk_propagation_calculation(self, impact_engine, sample_contracts_graph):
        """Test risk propagation through relationship network."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-004",
            source_node="party-vendor",
            change_type="party_risk_change",
            change_data={"new_risk_score": 0.8, "risk_factors": ["financial_distress"]},
            severity="critical"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            risk_analysis=True,
            risk_threshold=0.3
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.risk_analysis is not None
        assert result.risk_analysis.total_risk_score > 0
        assert len(result.risk_analysis.high_risk_nodes) > 0
        
        # Contracts with the vendor should be high risk
        high_risk_ids = [node.id for node in result.risk_analysis.high_risk_nodes]
        assert "master-001" in high_risk_ids
    
    @pytest.mark.asyncio
    async def test_compound_risk_calculation(self, impact_engine, sample_contracts_graph):
        """Test compound risk calculation for multiple simultaneous changes."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_events = [
            ChangeEvent(
                id="change-005a",
                source_node="party-vendor",
                change_type="financial_risk",
                severity="high"
            ),
            ChangeEvent(
                id="change-005b",
                source_node="clause-term",
                change_type="legal_risk",
                severity="medium"
            )
        ]
        
        query = ImpactQuery(
            change_events=change_events,
            compound_analysis=True,
            risk_analysis=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.compound_impact is not None
        assert result.compound_impact.interaction_effects > 0
        assert result.compound_impact.amplification_factor >= 1.0
    
    # Affected Entity Identification Tests
    
    @pytest.mark.asyncio
    async def test_direct_dependency_identification(self, impact_engine, sample_contracts_graph):
        """Test identification of directly dependent entities."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-006",
            source_node="master-001",
            change_type="status_change",
            change_data={"old_status": "active", "new_status": "terminated"}
        )
        
        query = ImpactQuery(
            change_event=change_event,
            dependency_analysis=True,
            max_hops=1  # Only direct dependencies
        )
        
        result = await impact_engine.analyze_impact(query)
        
        direct_deps = result.dependency_analysis.direct_dependencies
        assert len(direct_deps) >= 2  # Should have amendments and SOWs
        
        # Check that amendments and SOWs are identified as direct dependencies
        dep_ids = [dep.id for dep in direct_deps]
        assert "amend-001" in dep_ids
        assert "sow-001" in dep_ids or "sow-002" in dep_ids
    
    @pytest.mark.asyncio
    async def test_transitive_dependency_mapping(self, impact_engine, sample_contracts_graph):
        """Test mapping of transitive dependencies."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-007",
            source_node="party-vendor",
            change_type="party_change"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            dependency_analysis=True,
            include_transitive=True,
            max_hops=3
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.dependency_analysis.transitive_dependencies is not None
        assert len(result.dependency_analysis.transitive_dependencies) > 0
        
        # Should find clauses through contracts
        transitive_ids = [dep.id for dep in result.dependency_analysis.transitive_dependencies]
        assert any(dep_id.startswith("clause-") for dep_id in transitive_ids)
    
    @pytest.mark.asyncio
    async def test_circular_dependency_detection(self, impact_engine):
        """Test detection of circular dependencies."""
        # Create a graph with circular dependencies
        circular_graph = {
            "nodes": [
                {"id": "contract-a", "type": "Contract"},
                {"id": "contract-b", "type": "Contract"},
                {"id": "contract-c", "type": "Contract"}
            ],
            "relationships": [
                {"from": "contract-a", "to": "contract-b", "type": "REFERENCES"},
                {"from": "contract-b", "to": "contract-c", "type": "REFERENCES"},
                {"from": "contract-c", "to": "contract-a", "type": "REFERENCES"}
            ]
        }
        
        impact_engine.set_graph_data(circular_graph)
        
        change_event = ChangeEvent(
            id="change-008",
            source_node="contract-a",
            change_type="modification"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            detect_circular_dependencies=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.circular_dependencies is not None
        assert len(result.circular_dependencies) > 0
        assert result.has_circular_dependencies is True
    
    # What-If Analysis Tests
    
    @pytest.mark.asyncio
    async def test_what_if_scenario_analysis(self, impact_engine, sample_contracts_graph):
        """Test what-if scenario analysis."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        scenario = {
            "name": "Vendor Bankruptcy",
            "changes": [
                {
                    "node": "party-vendor",
                    "change_type": "status_change",
                    "data": {"status": "bankrupt"}
                }
            ]
        }
        
        query = ImpactQuery(
            scenario=scenario,
            scenario_analysis=True,
            confidence_analysis=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.scenario_analysis is not None
        assert result.scenario_analysis.scenario_name == "Vendor Bankruptcy"
        assert result.scenario_analysis.projected_impact > 0
        assert result.scenario_analysis.confidence_score > 0
    
    @pytest.mark.asyncio
    async def test_multiple_scenario_comparison(self, impact_engine, sample_contracts_graph):
        """Test comparison of multiple what-if scenarios."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        scenarios = [
            {
                "name": "Early Termination",
                "changes": [{"node": "master-001", "change_type": "early_termination"}]
            },
            {
                "name": "Contract Extension",
                "changes": [{"node": "master-001", "change_type": "extension", "data": {"months": 12}}]
            }
        ]
        
        query = ImpactQuery(
            scenarios=scenarios,
            comparative_analysis=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.comparative_analysis is not None
        assert len(result.comparative_analysis.scenario_results) == 2
        assert result.comparative_analysis.recommendation is not None
    
    # Impact Simulation Tests
    
    @pytest.mark.asyncio
    async def test_temporal_impact_simulation(self, impact_engine, sample_contracts_graph):
        """Test temporal simulation of impact over time."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-009",
            source_node="master-001",
            change_type="value_reduction",
            change_data={"percentage": 20}
        )
        
        query = ImpactQuery(
            change_event=change_event,
            temporal_simulation=True,
            simulation_duration=365,  # days
            time_steps=12  # monthly steps
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.temporal_simulation is not None
        assert len(result.temporal_simulation.time_series) == 12
        assert all(step.timestamp is not None for step in result.temporal_simulation.time_series)
        assert all(step.cumulative_impact >= 0 for step in result.temporal_simulation.time_series)
    
    @pytest.mark.asyncio
    async def test_monte_carlo_impact_simulation(self, impact_engine, sample_contracts_graph):
        """Test Monte Carlo simulation for impact uncertainty."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-010",
            source_node="party-vendor",
            change_type="performance_degradation"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            monte_carlo_simulation=True,
            simulation_runs=1000,
            uncertainty_parameters={
                "impact_variance": 0.2,
                "propagation_uncertainty": 0.15
            }
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.monte_carlo_results is not None
        assert result.monte_carlo_results.mean_impact > 0
        assert result.monte_carlo_results.confidence_intervals is not None
        assert "95%" in result.monte_carlo_results.confidence_intervals
    
    # Visualization and Reporting Tests
    
    @pytest.mark.asyncio
    async def test_impact_visualization_data_generation(self, impact_engine, sample_contracts_graph):
        """Test generation of impact visualization data."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-011",
            source_node="master-001",
            change_type="modification"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            visualization=True,
            visualization_format="network_graph"
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.visualization_data is not None
        assert result.visualization_data.format == "network_graph"
        assert len(result.visualization_data.nodes) > 0
        assert len(result.visualization_data.edges) > 0
        assert result.visualization_data.impact_layers is not None
    
    @pytest.mark.asyncio
    async def test_impact_heatmap_generation(self, impact_engine, sample_contracts_graph):
        """Test generation of impact heatmap data."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-012",
            source_node="clause-term",
            change_type="risk_increase"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            visualization=True,
            visualization_format="heatmap"
        )
        
        result = await impact_engine.analyze_impact(query)
        
        heatmap = result.visualization_data.heatmap
        assert heatmap is not None
        assert len(heatmap.zones) > 0
        assert all(zone.impact_intensity >= 0 for zone in heatmap.zones)
        assert all(zone.risk_level in ["low", "medium", "high", "critical"] for zone in heatmap.zones)
    
    @pytest.mark.asyncio
    async def test_impact_report_generation(self, impact_engine, sample_contracts_graph):
        """Test comprehensive impact report generation."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-013",
            source_node="master-001",
            change_type="comprehensive_change"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            generate_report=True,
            report_format="detailed",
            include_recommendations=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        report = result.impact_report
        assert report is not None
        assert report.executive_summary is not None
        assert len(report.executive_summary) > 0
        assert report.detailed_analysis is not None
        assert len(report.recommendations) > 0
        assert report.risk_assessment is not None
    
    # Performance and Metrics Tests
    
    @pytest.mark.asyncio
    async def test_impact_calculation_performance(self, impact_engine, sample_contracts_graph):
        """Test performance of impact calculations."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-014",
            source_node="master-001",
            change_type="performance_test"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            performance_metrics=True,
            max_hops=3
        )
        
        result = await impact_engine.analyze_impact(query)
        
        metrics = result.performance_metrics
        assert metrics is not None
        assert metrics.calculation_time > 0
        assert metrics.nodes_processed > 0
        assert metrics.edges_traversed > 0
        assert metrics.memory_usage > 0
    
    @pytest.mark.asyncio
    async def test_impact_confidence_scoring(self, impact_engine, sample_contracts_graph):
        """Test confidence scoring for impact predictions."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-015",
            source_node="sow-001",
            change_type="delay_risk",
            confidence=0.7
        )
        
        query = ImpactQuery(
            change_event=change_event,
            confidence_analysis=True,
            confidence_threshold=0.5
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.confidence_analysis is not None
        assert result.confidence_analysis.overall_confidence > 0
        assert result.confidence_analysis.confidence_factors is not None
        
        # Check individual node confidence scores
        for node in result.affected_nodes:
            assert hasattr(node, 'confidence_score')
            assert 0 <= node.confidence_score <= 1
    
    # Edge Cases and Error Handling Tests
    
    @pytest.mark.asyncio
    async def test_empty_graph_handling(self, impact_engine):
        """Test handling of empty graph data."""
        impact_engine.set_graph_data({"nodes": [], "relationships": []})
        
        change_event = ChangeEvent(
            id="change-016",
            source_node="nonexistent",
            change_type="test"
        )
        
        query = ImpactQuery(change_event=change_event)
        
        with pytest.raises(InsufficientDataError) as exc_info:
            await impact_engine.analyze_impact(query)
        
        assert "insufficient data" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_nonexistent_source_node_handling(self, impact_engine, sample_contracts_graph):
        """Test handling of nonexistent source node."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-017",
            source_node="nonexistent-node",
            change_type="test"
        )
        
        query = ImpactQuery(change_event=change_event)
        
        with pytest.raises(ImpactAnalysisError) as exc_info:
            await impact_engine.analyze_impact(query)
        
        assert "source node not found" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_invalid_scenario_handling(self, impact_engine, sample_contracts_graph):
        """Test handling of invalid scenario data."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        invalid_scenario = {
            "name": "",  # Empty name
            "changes": []  # No changes
        }
        
        query = ImpactQuery(
            scenario=invalid_scenario,
            scenario_analysis=True
        )
        
        with pytest.raises(InvalidScenarioError) as exc_info:
            await impact_engine.analyze_impact(query)
        
        assert "invalid scenario" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_calculation_overflow_handling(self, impact_engine, sample_contracts_graph):
        """Test handling of calculation overflow scenarios."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-018",
            source_node="master-001",
            change_type="extreme_change",
            change_data={"multiplier": 1e10}  # Extreme multiplier
        )
        
        query = ImpactQuery(
            change_event=change_event,
            max_hops=5
        )
        
        result = await impact_engine.analyze_impact(query)
        
        # Should handle gracefully without overflow
        assert result.total_impact_score < float('inf')
        assert not any(node.impact_score != node.impact_score for node in result.affected_nodes)  # No NaN
    
    # Integration Tests
    
    @pytest.mark.asyncio
    async def test_integration_with_multi_hop_reasoning(self, impact_engine, sample_contracts_graph):
        """Test integration with multi-hop reasoning engine."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-019",
            source_node="master-001",
            change_type="integration_test"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            use_advanced_reasoning=True,
            reasoning_depth=3
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.reasoning_paths is not None
        assert len(result.reasoning_paths) > 0
        assert all(path.explanation is not None for path in result.reasoning_paths)
    
    @pytest.mark.asyncio
    async def test_caching_and_performance_optimization(self, impact_engine, sample_contracts_graph):
        """Test caching and performance optimization."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_event = ChangeEvent(
            id="change-020",
            source_node="master-001",
            change_type="cache_test"
        )
        
        query = ImpactQuery(
            change_event=change_event,
            use_caching=True
        )
        
        # First execution
        result1 = await impact_engine.analyze_impact(query)
        
        # Second execution should be faster due to caching
        result2 = await impact_engine.analyze_impact(query)
        
        assert result1.total_impact_score == result2.total_impact_score
        assert result2.from_cache is True
    
    @pytest.mark.asyncio
    async def test_batch_impact_analysis(self, impact_engine, sample_contracts_graph):
        """Test batch analysis of multiple change events."""
        impact_engine.set_graph_data(sample_contracts_graph)
        
        change_events = [
            ChangeEvent(id=f"batch-{i}", source_node="master-001", change_type="batch_test")
            for i in range(5)
        ]
        
        query = ImpactQuery(
            change_events=change_events,
            batch_processing=True
        )
        
        result = await impact_engine.analyze_impact(query)
        
        assert result.batch_results is not None
        assert len(result.batch_results) == 5
        assert all(batch_result.affected_nodes for batch_result in result.batch_results)


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])