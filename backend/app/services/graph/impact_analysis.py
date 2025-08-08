"""
Impact Analysis System - Main module
Re-exports core functionality from impact_analysis_core.py
"""
from app.services.graph.impact_analysis_core import (
    # Enums
    EntityType,
    ChangeType,
    ImpactSeverity,
    PropagationRule,
    CascadeEffect,
    
    # Data Classes
    ChangeEvent,
    ImpactNode,
    ImpactEdge,
    ImpactPath,
    ImpactResult,
    PropagationModel,
    RiskCascade,
    DependencyMap,
    WhatIfScenario,
    ImpactMetrics,
    ConfidenceScore,
    ImpactVisualization,
    ImpactReport,
    
    # Main Engine
    ImpactAnalysisEngine
)

# Additional placeholder classes for test compatibility
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class ImpactAnalyzer:
    """Placeholder for compatibility"""
    pass

@dataclass
class ChangePropagationModel:
    """Placeholder for compatibility"""
    pass

@dataclass
class RiskCascadeAnalyzer:
    """Placeholder for compatibility"""
    pass

@dataclass
class DependencyMapper:
    """Placeholder for compatibility"""
    pass

@dataclass
class ImpactVisualizer:
    """Placeholder for compatibility"""
    pass

@dataclass
class ImpactScenarioEngine:
    """Placeholder for compatibility"""
    pass

@dataclass
class ImpactSimulator:
    """Placeholder for compatibility"""
    pass

@dataclass
class WhatIfAnalyzer:
    """Placeholder for compatibility"""
    pass

@dataclass
class ImpactReportGenerator:
    """Placeholder for compatibility"""
    pass

# Exception classes
class ImpactAnalysisError(Exception):
    """Base exception for impact analysis"""
    pass

class CircularDependencyError(ImpactAnalysisError):
    """Circular dependency detected"""
    pass

class InsufficientDataError(ImpactAnalysisError):
    """Insufficient data for analysis"""
    pass

class ImpactCalculationError(ImpactAnalysisError):
    """Error calculating impact"""
    pass

class InvalidScenarioError(ImpactAnalysisError):
    """Invalid scenario configuration"""
    pass

# Re-export everything
__all__ = [
    # Core classes
    'EntityType',
    'ChangeType',
    'ImpactSeverity',
    'PropagationRule',
    'CascadeEffect',
    'ChangeEvent',
    'ImpactNode',
    'ImpactEdge',
    'ImpactPath',
    'ImpactResult',
    'PropagationModel',
    'RiskCascade',
    'DependencyMap',
    'WhatIfScenario',
    'ImpactMetrics',
    'ConfidenceScore',
    'ImpactVisualization',
    'ImpactReport',
    'ImpactAnalysisEngine',
    
    # Compatibility classes
    'ImpactAnalyzer',
    'ChangePropagationModel',
    'RiskCascadeAnalyzer',
    'DependencyMapper',
    'ImpactVisualizer',
    'ImpactScenarioEngine',
    'ImpactSimulator',
    'WhatIfAnalyzer',
    'ImpactReportGenerator',
    
    # Exceptions
    'ImpactAnalysisError',
    'CircularDependencyError',
    'InsufficientDataError',
    'ImpactCalculationError',
    'InvalidScenarioError'
]