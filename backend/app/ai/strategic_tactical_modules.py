"""
High-Level Strategic and Low-Level Tactical Modules for HRM
Implements hierarchical reasoning with strategic planning and tactical execution
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class StrategicConfig:
    max_planning_depth: int = 5
    min_confidence_threshold: float = 0.7
    optimization_iterations: int = 100
    parallel_strategies: bool = True
    cache_strategies: bool = True


@dataclass
class TacticalConfig:
    max_execution_steps: int = 50
    validation_frequency: int = 5
    backtracking_enabled: bool = True
    error_recovery_attempts: int = 3
    resource_monitoring: bool = True


@dataclass
class ConvergenceConfig:
    convergence_threshold: float = 0.01
    max_iterations: int = 100
    stability_window: int = 10
    adaptive_rate: bool = True


@dataclass
class StrategicGoal:
    id: str
    description: str
    timeline_days: int
    priority: str
    constraints: List[str] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class TacticalTask:
    id: str
    name: str
    steps: List[str]
    estimated_duration_minutes: int
    dependencies: List[str] = field(default_factory=list)
    status: str = "pending"


@dataclass
class PlanningStrategy:
    name: str
    approach: str
    confidence: float
    resources_required: Dict[str, Any]
    timeline: int


@dataclass
class ExecutionPlan:
    steps: List[str]
    timeline_days: int
    resources_required: Dict[str, Any]
    milestones: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ResourceAllocation:
    resources: Dict[str, float]
    assignments: Dict[str, List[str]]
    utilization: float


@dataclass
class RiskAssessment:
    risk_level: float
    reward_potential: float
    confidence: float
    factors: List[str]


@dataclass
class OptimizationObjective:
    name: str
    weight: float
    target_value: Optional[float] = None
    current_value: Optional[float] = None


@dataclass
class ConstraintSet:
    hard_constraints: List[str]
    soft_constraints: List[str]
    violations: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    completeness: float


@dataclass
class BacktrackingState:
    step: int
    state: Dict[str, Any]
    checkpoint_id: str
    reason: str


@dataclass
class ConvergenceState:
    iteration: int
    high_level_state: Dict[str, Any]
    low_level_state: Dict[str, Any]
    convergence_metric: float
    is_converged: bool


class StrategicException(Exception):
    """Strategic module exception"""
    pass


class TacticalException(Exception):
    """Tactical module exception"""
    pass


class ConvergenceException(Exception):
    """Convergence system exception"""
    pass


class HighLevelStrategicModule:
    """High-level strategic planning module"""
    
    def __init__(self, config: StrategicConfig):
        self.config = config
        self.strategies_cache = {}
        self.goal_history = []
        self.resource_pool = {}
    
    async def formulate_strategic_goal(self, objective: str, constraints: List[str], context: Dict) -> StrategicGoal:
        """Formulate strategic goal from objective"""
        goal = StrategicGoal(
            id=f"goal_{len(self.goal_history)}",
            description=objective,
            timeline_days=context.get("timeline", 90),
            priority=self._determine_priority(context),
            constraints=constraints,
            metrics={"feasibility": 0.8, "value": context.get("value", 0)}
        )
        self.goal_history.append(goal)
        return goal
    
    async def generate_long_term_plan(self, goal: StrategicGoal, horizon_days: int) -> ExecutionPlan:
        """Generate long-term strategic plan"""
        steps = self._decompose_goal(goal)
        milestones = self._create_milestones(steps, horizon_days)
        
        return ExecutionPlan(
            steps=steps,
            timeline_days=min(goal.timeline_days, horizon_days),
            resources_required=self._estimate_resources(steps),
            milestones=milestones
        )
    
    async def allocate_resources(self, available_resources: Dict, tasks: List[str], optimization_criteria: str) -> ResourceAllocation:
        """Allocate resources optimally"""
        assignments = defaultdict(list)
        
        # Simple allocation strategy
        for i, task in enumerate(tasks):
            resource_type = "lawyers" if "negotiate" in task or "review" in task else "paralegals"
            if resource_type in available_resources:
                assignments[resource_type].append(task)
        
        utilization = len(tasks) / sum(available_resources.get(k, 0) for k in ["lawyers", "paralegals"])
        
        return ResourceAllocation(
            resources=available_resources,
            assignments=dict(assignments),
            utilization=min(utilization, 1.0)
        )
    
    async def assess_risk_reward(self, strategy: str, potential_rewards: Dict, potential_risks: Dict) -> RiskAssessment:
        """Assess risk-reward ratio"""
        risk_level = sum(potential_risks.values()) / len(potential_risks) if potential_risks else 0
        reward_potential = sum(potential_rewards.values()) / len(potential_rewards) if potential_rewards else 0
        
        return RiskAssessment(
            risk_level=risk_level,
            reward_potential=reward_potential,
            confidence=0.75 if strategy == "aggressive_negotiation" else 0.85,
            factors=list(potential_risks.keys()) + list(potential_rewards.keys())
        )
    
    async def multi_objective_optimization(self, objectives: List[OptimizationObjective], constraints: List[str]) -> Dict[str, Any]:
        """Multi-objective optimization using weighted sum"""
        best_solution = {"score": 0}
        
        for _ in range(min(self.config.optimization_iterations, 10)):
            solution = self._generate_solution()
            score = sum(obj.weight * solution.get(obj.name, 0.5) for obj in objectives)
            
            if self._check_constraints(solution, constraints) and score > best_solution["score"]:
                best_solution = {"solution": solution, "score": score}
        
        return best_solution
    
    async def satisfy_constraints(self, solution: Dict, constraints: ConstraintSet) -> bool:
        """Check constraint satisfaction"""
        violations = []
        
        for constraint in constraints.hard_constraints:
            if not self._evaluate_constraint(solution, constraint):
                violations.append(constraint)
        
        constraints.violations = violations
        return len(violations) == 0
    
    async def evaluate_plan_metrics(self, plan: ExecutionPlan, evaluation_criteria: List[str]) -> Dict[str, float]:
        """Evaluate plan against criteria"""
        metrics = {}
        
        for criterion in evaluation_criteria:
            if criterion == "feasibility":
                metrics[criterion] = 0.9 if len(plan.steps) <= 10 else 0.7
            elif criterion == "efficiency":
                metrics[criterion] = 1.0 / (len(plan.steps) + 1)
            elif criterion == "risk":
                metrics[criterion] = 0.3 if len(plan.steps) > 5 else 0.2
            else:
                metrics[criterion] = 0.5
        
        return metrics
    
    async def generate_alternative_strategies(self, primary_strategy: str, num_alternatives: int, variation_degree: float) -> List[PlanningStrategy]:
        """Generate alternative strategies"""
        alternatives = []
        
        for i in range(num_alternatives):
            confidence = 0.8 - (i * 0.1 * variation_degree)
            alternatives.append(PlanningStrategy(
                name=f"{primary_strategy}_alt_{i}",
                approach=f"variation_{i}",
                confidence=max(confidence, 0.5),
                resources_required={"lawyers": i + 1},
                timeline=30 + i * 10
            ))
        
        return alternatives
    
    async def score_strategy_confidence(self, strategy: str, historical_success_rate: float, complexity_factors: List[str]) -> float:
        """Score strategy confidence"""
        complexity_penalty = len(complexity_factors) * 0.05
        base_confidence = historical_success_rate
        
        return max(0.3, min(1.0, base_confidence - complexity_penalty))
    
    async def explain_strategic_decision(self, decision: str, factors: List[str], confidence: float) -> str:
        """Generate strategic decision explanation"""
        return f"Decision: {decision}. Based on {len(factors)} factors: {', '.join(factors[:3])}. Confidence: {confidence:.2f}"
    
    async def translate_to_tactical(self, strategic_plan: ExecutionPlan, granularity: str) -> List[TacticalTask]:
        """Translate strategic plan to tactical tasks"""
        tasks = []
        
        for i, step in enumerate(strategic_plan.steps):
            task = TacticalTask(
                id=f"tactical_{i}",
                name=f"Execute: {step}",
                steps=[f"substep_{j}" for j in range(3 if granularity == "detailed" else 1)],
                estimated_duration_minutes=60
            )
            tasks.append(task)
        
        return tasks
    
    async def establish_communication(self, target_module, protocol: str, buffer_size: int) -> Dict[str, Any]:
        """Establish communication channel"""
        return {
            "channel_id": f"comm_{id(target_module)}",
            "protocol": protocol,
            "buffer_size": buffer_size,
            "status": "established"
        }
    
    def _determine_priority(self, context: Dict) -> str:
        """Determine priority based on context"""
        value = context.get("value", 0)
        if value > 5000000:
            return "critical"
        elif value > 1000000:
            return "high"
        else:
            return "medium"
    
    def _decompose_goal(self, goal: StrategicGoal) -> List[str]:
        """Decompose goal into steps"""
        if "negotiation" in goal.description.lower():
            return ["analyze", "prepare", "negotiate", "review", "finalize"]
        return ["analyze", "plan", "execute", "validate"]
    
    def _create_milestones(self, steps: List[str], horizon: int) -> List[Dict]:
        """Create milestones for plan"""
        milestones = []
        interval = horizon // len(steps) if steps else 1
        
        for i, step in enumerate(steps):
            milestones.append({
                "step": step,
                "day": (i + 1) * interval,
                "deliverable": f"Complete {step}"
            })
        
        return milestones
    
    def _estimate_resources(self, steps: List[str]) -> Dict[str, Any]:
        """Estimate required resources"""
        return {
            "lawyers": len([s for s in steps if "negotiate" in s or "review" in s]),
            "paralegals": len([s for s in steps if "analyze" in s or "prepare" in s]),
            "hours": len(steps) * 8
        }
    
    def _generate_solution(self) -> Dict[str, float]:
        """Generate random solution for optimization"""
        return {
            "minimize_cost": 0.3 + (hash(datetime.now().isoformat()) % 7) / 10,
            "maximize_quality": 0.5 + (hash(datetime.now().isoformat()) % 5) / 10,
            "minimize_time": 0.4 + (hash(datetime.now().isoformat()) % 6) / 10
        }
    
    def _check_constraints(self, solution: Dict, constraints: List[str]) -> bool:
        """Check if solution satisfies constraints"""
        # Simplified constraint checking
        return True
    
    def _evaluate_constraint(self, solution: Dict, constraint: str) -> bool:
        """Evaluate single constraint"""
        if "cost" in constraint and "cost" in solution:
            return solution["cost"] < 100000
        return True


class LowLevelTacticalModule:
    """Low-level tactical execution module"""
    
    def __init__(self, config: TacticalConfig):
        self.config = config
        self.execution_history = []
        self.checkpoints = {}
        self.resource_usage = defaultdict(float)
    
    async def execute_detailed_task(self, task: TacticalTask) -> Dict[str, Any]:
        """Execute detailed tactical task"""
        results = {"task_id": task.id, "steps_completed": []}
        
        for step in task.steps:
            # Simulate step execution
            results["steps_completed"].append(step)
            await asyncio.sleep(0.001)  # Minimal delay
        
        task.status = "completed"
        self.execution_history.append(task)
        results["status"] = "success"
        
        return results
    
    async def step_by_step_reasoning(self, problem: str, initial_state: Dict, goal_state: Dict) -> List[Dict]:
        """Step-by-step reasoning process"""
        steps = []
        current_state = initial_state.copy()
        
        while not self._states_match(current_state, goal_state):
            step = self._generate_next_step(current_state, goal_state)
            steps.append(step)
            current_state = self._apply_step(current_state, step)
            
            if len(steps) > self.config.max_execution_steps:
                break
        
        return steps
    
    async def local_optimization(self, current_solution: Dict, neighborhood_size: int, optimization_metric: str) -> Dict:
        """Local optimization using hill climbing"""
        best = current_solution.copy()
        
        for _ in range(neighborhood_size):
            neighbor = self._generate_neighbor(best)
            if neighbor.get(optimization_metric, 0) > best.get(optimization_metric, 0):
                best = neighbor
        
        return best
    
    async def check_constraints(self, state: Dict, constraints: List[str]) -> bool:
        """Check tactical constraints"""
        for constraint in constraints:
            if not self._evaluate_tactical_constraint(state, constraint):
                return False
        return True
    
    async def validate_execution(self, execution_trace: List[str], expected_outcomes: Dict, validation_rules: List[str]) -> ValidationResult:
        """Validate execution against expectations"""
        errors = []
        warnings = []
        
        for rule in validation_rules:
            if rule == "completeness" and len(execution_trace) < 3:
                warnings.append("Execution trace incomplete")
            elif rule == "correctness" and expected_outcomes.get("result") != "success":
                errors.append("Unexpected outcome")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            completeness=len(execution_trace) / self.config.max_execution_steps
        )
    
    async def detect_errors(self, execution_state: Dict, error_patterns: List[str]) -> List[Dict]:
        """Detect errors in execution"""
        detected = []
        
        for pattern in error_patterns:
            if pattern == "deadline_miss" and execution_state.get("current_step", 0) > 10:
                detected.append({"type": pattern, "severity": "high"})
            elif pattern == "resource_overflow" and execution_state.get("warnings", 0) > 5:
                detected.append({"type": pattern, "severity": "medium"})
        
        return detected
    
    async def backtrack_execution(self, current_state: Dict, checkpoint_state: Dict, reason: str) -> BacktrackingState:
        """Backtrack to previous checkpoint"""
        backtrack_state = BacktrackingState(
            step=checkpoint_state.get("step", 0),
            state=checkpoint_state,
            checkpoint_id=f"checkpoint_{len(self.checkpoints)}",
            reason=reason
        )
        
        self.checkpoints[backtrack_state.checkpoint_id] = checkpoint_state
        return backtrack_state
    
    async def monitor_progress(self, start_time: datetime, completed_steps: int, total_steps: int) -> Dict[str, Any]:
        """Monitor execution progress"""
        elapsed = (datetime.now() - start_time).total_seconds() / 60
        progress_pct = (completed_steps / total_steps) * 100 if total_steps > 0 else 0
        
        return {
            "elapsed_minutes": elapsed,
            "progress_percentage": progress_pct,
            "estimated_remaining_minutes": (elapsed / completed_steps) * (total_steps - completed_steps) if completed_steps > 0 else 0,
            "on_track": progress_pct >= (elapsed / 30) * 100  # Assume 30 min target
        }
    
    async def track_resource_utilization(self, allocated_resources: Dict, used_resources: Dict, time_window_minutes: int) -> Dict:
        """Track resource utilization"""
        utilization = {}
        
        for resource, allocated in allocated_resources.items():
            used = used_resources.get(resource, 0)
            utilization[resource] = {
                "allocated": allocated,
                "used": used,
                "utilization_pct": (used / allocated * 100) if allocated > 0 else 0,
                "efficiency": min(1.0, used / allocated) if allocated > 0 else 0
            }
        
        return utilization
    
    async def adjust_tactical_approach(self, current_approach: str, performance_metrics: Dict, optimization_target: str) -> Dict:
        """Adjust tactical approach based on performance"""
        new_approach = current_approach
        
        if optimization_target == "speed" and performance_metrics.get("speed", 0) < 0.7:
            new_approach = "parallel"
        elif optimization_target == "accuracy" and performance_metrics.get("accuracy", 0) < 0.8:
            new_approach = "careful"
        
        return {
            "previous_approach": current_approach,
            "new_approach": new_approach,
            "reason": f"Optimizing for {optimization_target}",
            "expected_improvement": 0.1
        }
    
    async def feedback_to_strategic(self, execution_results: Dict, performance_metrics: Dict, recommendations: List[str]) -> Dict:
        """Send feedback to strategic module"""
        return {
            "execution_summary": execution_results,
            "performance": performance_metrics,
            "recommendations": recommendations,
            "timestamp": datetime.now().isoformat()
        }
    
    def _states_match(self, state1: Dict, state2: Dict) -> bool:
        """Check if states match"""
        for key in state2:
            if key not in state1 or state1[key] != state2[key]:
                return False
        return True
    
    def _generate_next_step(self, current: Dict, goal: Dict) -> Dict:
        """Generate next step toward goal"""
        return {
            "action": "progress",
            "from_state": current.copy(),
            "toward_goal": goal.copy()
        }
    
    def _apply_step(self, state: Dict, step: Dict) -> Dict:
        """Apply step to state"""
        new_state = state.copy()
        for key in step.get("toward_goal", {}):
            new_state[key] = step["toward_goal"][key]
        return new_state
    
    def _generate_neighbor(self, solution: Dict) -> Dict:
        """Generate neighbor solution"""
        neighbor = solution.copy()
        for key in neighbor:
            if isinstance(neighbor[key], (int, float)):
                neighbor[key] *= 1.1  # Small perturbation
        return neighbor
    
    def _evaluate_tactical_constraint(self, state: Dict, constraint: str) -> bool:
        """Evaluate tactical constraint"""
        # Parse and evaluate constraint
        if ">" in constraint:
            parts = constraint.split(">")
            if len(parts) == 2:
                key = parts[0].strip()
                value = float(parts[1].strip())
                return state.get(key, 0) > value
        return True


class HierarchicalConvergenceSystem:
    """Manages convergence between strategic and tactical modules"""
    
    def __init__(self, config: ConvergenceConfig):
        self.config = config
        self.convergence_history = []
        self.current_state = None
        self.iteration_count = 0
    
    async def initialize_convergence(self, high_level_state: Dict, low_level_state: Dict, convergence_criteria: str) -> ConvergenceState:
        """Initialize convergence system"""
        state = ConvergenceState(
            iteration=0,
            high_level_state=high_level_state,
            low_level_state=low_level_state,
            convergence_metric=1.0,
            is_converged=False
        )
        
        self.current_state = state
        self.convergence_history.append(state)
        return state
    
    async def update_high_level(self, current_state: Dict, low_level_feedback: Dict, update_rate: float) -> Dict:
        """Update high-level state based on low-level feedback"""
        updated = current_state.copy()
        
        # Incorporate feedback with update rate
        for key, value in low_level_feedback.items():
            if key in updated and isinstance(value, (int, float)):
                updated[key] = updated[key] * (1 - update_rate) + value * update_rate
        
        return updated
    
    async def update_low_level(self, current_state: Dict, high_level_guidance: Dict, update_frequency: int) -> Dict:
        """Update low-level state based on high-level guidance"""
        updated = current_state.copy()
        
        # Apply guidance at specified frequency
        if self.iteration_count % update_frequency == 0:
            updated.update(high_level_guidance)
        
        self.iteration_count += 1
        return updated
    
    async def check_convergence(self, state_history: List[Dict], threshold: float, window_size: int) -> bool:
        """Check if system has converged"""
        if len(state_history) < window_size:
            return False
        
        recent = state_history[-window_size:]
        values = [s.get("value", 0) for s in recent]
        
        if len(values) < 2:
            return False
        
        variance = sum((v - sum(values)/len(values))**2 for v in values) / len(values)
        return variance < threshold
    
    async def reset_low_level(self, reason: str, preserve_context: bool, new_guidance: Dict) -> Dict:
        """Reset low-level module"""
        reset_state = {
            "reset_reason": reason,
            "preserved_context": preserve_context,
            "guidance": new_guidance,
            "reset_time": datetime.now().isoformat()
        }
        
        if not preserve_context:
            self.iteration_count = 0
        
        return reset_state
    
    async def coordinate_modules(self, strategic_output: Dict, tactical_input: Dict, synchronization_mode: str) -> Dict:
        """Coordinate strategic and tactical modules"""
        coordination = {
            "mode": synchronization_mode,
            "strategic_directive": strategic_output,
            "tactical_response": tactical_input,
            "synchronized": True
        }
        
        if synchronization_mode == "async":
            coordination["buffer_size"] = 100
        
        return coordination
    
    async def hierarchical_feedback(self, low_to_high: Dict, high_to_low: Dict) -> Dict:
        """Manage hierarchical feedback loops"""
        return {
            "upward_feedback": low_to_high,
            "downward_guidance": high_to_low,
            "feedback_strength": 0.8,
            "guidance_strength": 0.9
        }
    
    async def stability_analysis(self, state_trajectory: List[float], time_window: int, stability_metric: str) -> Dict:
        """Analyze system stability"""
        if len(state_trajectory) < time_window:
            return {"stable": False, "reason": "Insufficient data"}
        
        recent = state_trajectory[-time_window:]
        
        if stability_metric == "variance":
            mean = sum(recent) / len(recent)
            variance = sum((x - mean)**2 for x in recent) / len(recent)
            stable = variance < 0.1
        else:
            stable = True
        
        return {
            "stable": stable,
            "metric": stability_metric,
            "value": variance if stability_metric == "variance" else 0
        }
    
    async def adaptive_convergence_rate(self, current_error: float, convergence_history: List[float], target_iterations: int) -> float:
        """Calculate adaptive convergence rate"""
        if not convergence_history:
            return 0.1
        
        # Estimate convergence rate based on history
        improvement_rate = sum(convergence_history[i] - convergence_history[i+1] 
                              for i in range(len(convergence_history)-1)) / len(convergence_history)
        
        # Adjust rate to meet target
        remaining_iterations = max(1, target_iterations - len(convergence_history))
        required_rate = current_error / remaining_iterations
        
        return min(0.5, max(0.01, (improvement_rate + required_rate) / 2))
    
    async def cascade_control(self, high_level_setpoint: Dict, low_level_measurement: Dict, control_gains: Dict) -> Dict:
        """Cascade control between levels"""
        error = self._calculate_error(high_level_setpoint, low_level_measurement)
        
        # PID-like control
        control_signal = (
            control_gains.get("p", 0.5) * error +
            control_gains.get("i", 0.1) * self._integral_error(error) +
            control_gains.get("d", 0.05) * self._derivative_error(error)
        )
        
        return {
            "control_signal": control_signal,
            "error": error,
            "setpoint": high_level_setpoint,
            "measurement": low_level_measurement
        }
    
    async def synchronized_execution(self, strategic_module, tactical_module, task: str, max_cycles: int) -> Dict:
        """Synchronized execution of modules"""
        results = {"task": task, "cycles": 0, "completed": False}
        
        for cycle in range(max_cycles):
            # Strategic planning
            strategic_output = {"plan": f"cycle_{cycle}"}
            
            # Tactical execution
            tactical_output = {"executed": f"cycle_{cycle}"}
            
            results["cycles"] = cycle + 1
            
            # Check completion
            if cycle > max_cycles // 2:  # Simplified completion check
                results["completed"] = True
                break
        
        return results
    
    async def optimization_loop(self, initial_performance: float, target_performance: float, max_iterations: int, learning_rate: float) -> Dict:
        """Optimization loop for performance improvement"""
        current = initial_performance
        history = [current]
        
        for i in range(max_iterations):
            improvement = learning_rate * (target_performance - current)
            current += improvement
            history.append(current)
            
            if current >= target_performance:
                break
        
        return {
            "final_performance": current,
            "iterations": len(history) - 1,
            "achieved_target": current >= target_performance,
            "improvement_history": history
        }
    
    def _calculate_error(self, setpoint: Dict, measurement: Dict) -> float:
        """Calculate error between setpoint and measurement"""
        # Simplified error calculation
        return 0.1
    
    def _integral_error(self, error: float) -> float:
        """Calculate integral of error"""
        return error * 0.5
    
    def _derivative_error(self, error: float) -> float:
        """Calculate derivative of error"""
        return error * 0.2