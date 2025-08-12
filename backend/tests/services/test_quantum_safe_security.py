"""
Tests for Quantum-Safe Security Service
Comprehensive test suite covering post-quantum cryptography, threat detection, and security migration
"""
import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import hashlib
import json
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.quantum_safe_security import (
    QuantumSafeSecurityService,
    QuantumCryptoAlgorithm,
    ThreatLevel,
    MigrationPhase,
    AlgorithmStrength,
    SecurityStatus,
    QuantumThreatType,
    KeyManagementProtocol
)


@pytest.fixture
def quantum_security_service():
    """Create quantum-safe security service instance."""
    return QuantumSafeSecurityService()


@pytest.fixture
def mock_tenant_id():
    """Mock tenant ID for testing."""
    return str(uuid.uuid4())


@pytest.fixture
def sample_document_data():
    """Sample document data for testing."""
    return {
        "content": "This is a test legal document that needs quantum-safe protection.",
        "metadata": {"type": "contract", "classification": "confidential"},
        "size": 1024
    }


@pytest.fixture
def sample_key_pair():
    """Sample quantum-safe key pair for testing."""
    return {
        "public_key": "quantum_safe_public_key_data",
        "private_key": "quantum_safe_private_key_data",
        "algorithm": "Kyber1024",
        "strength": 256
    }


class TestQuantumCryptographyAlgorithms:
    """Test quantum-safe cryptographic algorithms."""

    @pytest.mark.asyncio
    async def test_generate_kyber_keypair(self, quantum_security_service, mock_tenant_id):
        """Test Kyber key pair generation."""
        result = await quantum_security_service.generate_kyber_keypair(
            tenant_id=mock_tenant_id,
            security_level=1024
        )
        
        assert result is not None
        assert result["algorithm"] == QuantumCryptoAlgorithm.KYBER_1024
        assert result["public_key"] is not None
        assert result["private_key"] is not None
        assert result["key_id"] is not None
        assert result["tenant_id"] == mock_tenant_id

    @pytest.mark.asyncio
    async def test_generate_dilithium_keypair(self, quantum_security_service, mock_tenant_id):
        """Test Dilithium digital signature key pair generation."""
        result = await quantum_security_service.generate_dilithium_keypair(
            tenant_id=mock_tenant_id,
            security_level=3
        )
        
        assert result is not None
        assert result["algorithm"] == QuantumCryptoAlgorithm.DILITHIUM_3
        assert result["public_key"] is not None
        assert result["private_key"] is not None
        assert result["signature_capability"] is True

    @pytest.mark.asyncio
    async def test_generate_sphincs_keypair(self, quantum_security_service, mock_tenant_id):
        """Test SPHINCS+ hash-based signature key pair generation."""
        result = await quantum_security_service.generate_sphincs_keypair(
            tenant_id=mock_tenant_id,
            variant="sha256_256f"
        )
        
        assert result is not None
        assert result["algorithm"] == QuantumCryptoAlgorithm.SPHINCS_PLUS
        assert result["variant"] == "sha256_256f"
        assert result["public_key"] is not None
        assert result["private_key"] is not None

    @pytest.mark.asyncio
    async def test_kyber_encryption_decryption(self, quantum_security_service, mock_tenant_id, sample_document_data):
        """Test Kyber encryption and decryption flow."""
        # Generate key pair
        keypair = await quantum_security_service.generate_kyber_keypair(
            tenant_id=mock_tenant_id,
            security_level=1024
        )
        
        # Encrypt data
        encrypted_result = await quantum_security_service.kyber_encrypt(
            public_key=keypair["public_key"],
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id
        )
        
        assert encrypted_result["encrypted_data"] is not None
        assert encrypted_result["shared_secret"] is not None
        assert encrypted_result["algorithm"] == QuantumCryptoAlgorithm.KYBER_1024
        
        # Decrypt data
        decrypted_result = await quantum_security_service.kyber_decrypt(
            private_key=keypair["private_key"],
            encrypted_data=encrypted_result["encrypted_data"],
            shared_secret=encrypted_result["shared_secret"],
            tenant_id=mock_tenant_id
        )
        
        assert decrypted_result is not None
        decrypted_data = json.loads(decrypted_result.decode())
        assert decrypted_data == sample_document_data

    @pytest.mark.asyncio
    async def test_dilithium_signature_verification(self, quantum_security_service, mock_tenant_id, sample_document_data):
        """Test Dilithium signature creation and verification."""
        # Generate key pair
        keypair = await quantum_security_service.generate_dilithium_keypair(
            tenant_id=mock_tenant_id,
            security_level=3
        )
        
        # Create signature
        signature_result = await quantum_security_service.dilithium_sign(
            private_key=keypair["private_key"],
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id
        )
        
        assert signature_result["signature"] is not None
        assert signature_result["algorithm"] == QuantumCryptoAlgorithm.DILITHIUM_3
        
        # Verify signature
        verification_result = await quantum_security_service.dilithium_verify(
            public_key=keypair["public_key"],
            signature=signature_result["signature"],
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id
        )
        
        assert verification_result["valid"] is True
        assert verification_result["algorithm"] == QuantumCryptoAlgorithm.DILITHIUM_3

    @pytest.mark.asyncio
    async def test_hybrid_classical_quantum_encryption(self, quantum_security_service, mock_tenant_id, sample_document_data):
        """Test hybrid classical-quantum encryption approach."""
        result = await quantum_security_service.hybrid_encrypt(
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id,
            classical_algorithm="AES256",
            quantum_algorithm=QuantumCryptoAlgorithm.KYBER_1024
        )
        
        assert result["classical_encrypted"] is not None
        assert result["quantum_encrypted_key"] is not None
        assert result["hybrid_metadata"]["classical_algo"] == "AES256"
        assert result["hybrid_metadata"]["quantum_algo"] == QuantumCryptoAlgorithm.KYBER_1024


class TestQuantumThreatDetection:
    """Test quantum threat detection and analysis."""

    @pytest.mark.asyncio
    async def test_assess_quantum_vulnerability(self, quantum_security_service, mock_tenant_id):
        """Test quantum vulnerability assessment."""
        result = await quantum_security_service.assess_quantum_vulnerability(
            tenant_id=mock_tenant_id,
            current_algorithms=["RSA-2048", "ECDSA-P256", "AES-256"]
        )
        
        assert result is not None
        assert result.overall_risk_score >= 0
        assert result.overall_risk_score <= 100
        assert hasattr(result, 'vulnerable_algorithms')
        assert hasattr(result, 'recommended_replacements')
        assert result.threat_level in [e.value for e in ThreatLevel]

    @pytest.mark.asyncio
    async def test_shors_algorithm_threat_analysis(self, quantum_security_service, mock_tenant_id):
        """Test Shor's algorithm threat analysis."""
        result = await quantum_security_service.analyze_shors_threat(
            tenant_id=mock_tenant_id,
            rsa_key_sizes=[1024, 2048, 4096],
            ecc_curves=["P-256", "P-384", "P-521"]
        )
        
        assert result["rsa_analysis"] is not None
        assert result["ecc_analysis"] is not None
        assert result["time_to_break"] is not None
        assert result["quantum_advantage_estimate"] >= 1
        assert result["threat_type"] == QuantumThreatType.SHORS_ALGORITHM

    @pytest.mark.asyncio
    async def test_grovers_algorithm_impact(self, quantum_security_service, mock_tenant_id):
        """Test Grover's algorithm impact evaluation."""
        result = await quantum_security_service.analyze_grovers_impact(
            tenant_id=mock_tenant_id,
            symmetric_algorithms=["AES-128", "AES-192", "AES-256"],
            hash_functions=["SHA-256", "SHA-384", "SHA-512"]
        )
        
        assert result["effective_key_lengths"] is not None
        assert result["security_reduction_factor"] >= 1
        assert result["recommended_key_sizes"] is not None
        assert result["threat_type"] == QuantumThreatType.GROVERS_ALGORITHM

    @pytest.mark.asyncio
    async def test_quantum_supremacy_timeline_monitoring(self, quantum_security_service, mock_tenant_id):
        """Test quantum supremacy timeline monitoring."""
        result = await quantum_security_service.monitor_quantum_supremacy_timeline(
            tenant_id=mock_tenant_id
        )
        
        assert result["current_estimate"] is not None
        assert result["confidence_level"] >= 0
        assert result["confidence_level"] <= 100
        assert result["milestone_tracking"] is not None
        assert "quantum_volume_progress" in result
        assert "logical_qubit_development" in result

    @pytest.mark.asyncio
    async def test_migration_readiness_scoring(self, quantum_security_service, mock_tenant_id):
        """Test migration readiness scoring."""
        system_inventory = {
            "applications": 50,
            "databases": 10,
            "apis": 100,
            "certificates": 200,
            "legacy_systems": 5
        }
        
        result = await quantum_security_service.calculate_migration_readiness(
            tenant_id=mock_tenant_id,
            system_inventory=system_inventory
        )
        
        assert result["readiness_score"] >= 0
        assert result["readiness_score"] <= 100
        assert result["critical_dependencies"] is not None
        assert result["estimated_migration_time"] is not None
        assert result["risk_factors"] is not None


class TestSecurityMigrationPlanning:
    """Test security migration planning capabilities."""

    @pytest.mark.asyncio
    async def test_generate_algorithm_transition_roadmap(self, quantum_security_service, mock_tenant_id):
        """Test algorithm transition roadmap generation."""
        current_state = {
            "rsa_keys": 150,
            "ecdsa_keys": 75,
            "aes_implementations": 200,
            "legacy_algorithms": 25
        }
        
        result = await quantum_security_service.generate_transition_roadmap(
            tenant_id=mock_tenant_id,
            current_state=current_state,
            target_timeline_months=24
        )
        
        assert result.phases is not None
        assert len(result.phases) > 0
        assert result.total_duration_months == 24
        assert result.migration_strategy is not None
        assert result.priority_order is not None

    @pytest.mark.asyncio
    async def test_legacy_system_compatibility_analysis(self, quantum_security_service, mock_tenant_id):
        """Test legacy system compatibility analysis."""
        legacy_systems = [
            {"name": "Legacy CRM", "crypto_apis": ["OpenSSL 1.0", "WinCrypt"]},
            {"name": "Old Database", "crypto_apis": ["Oracle Crypto", "SQL Encrypt"]},
            {"name": "Legacy App", "crypto_apis": ["Java Crypto", "Python Crypto"]}
        ]
        
        result = await quantum_security_service.analyze_legacy_compatibility(
            tenant_id=mock_tenant_id,
            legacy_systems=legacy_systems
        )
        
        assert result["compatibility_matrix"] is not None
        assert result["upgrade_requirements"] is not None
        assert result["incompatible_systems"] is not None
        assert "bridging_solutions" in result

    @pytest.mark.asyncio
    async def test_performance_impact_analysis(self, quantum_security_service, mock_tenant_id):
        """Test performance impact analysis for quantum-safe algorithms."""
        workload_profile = {
            "encryption_operations_per_second": 1000,
            "signature_operations_per_second": 500,
            "key_exchange_operations_per_hour": 100,
            "average_data_size_kb": 64
        }
        
        result = await quantum_security_service.analyze_performance_impact(
            tenant_id=mock_tenant_id,
            workload_profile=workload_profile
        )
        
        assert result["performance_comparison"] is not None
        assert result["throughput_impact"] is not None
        assert result["latency_impact"] is not None
        assert result["resource_requirements"] is not None
        assert "optimization_recommendations" in result

    @pytest.mark.asyncio
    async def test_risk_assessment_matrix(self, quantum_security_service, mock_tenant_id):
        """Test risk assessment matrix generation."""
        result = await quantum_security_service.generate_risk_assessment_matrix(
            tenant_id=mock_tenant_id,
            business_context={
                "industry": "legal_services",
                "data_sensitivity": "high",
                "regulatory_requirements": ["SOX", "GDPR", "CCPA"],
                "threat_model": "state_actor"
            }
        )
        
        assert result["risk_matrix"] is not None
        assert result["threat_scenarios"] is not None
        assert result["impact_analysis"] is not None
        assert result["mitigation_strategies"] is not None
        assert "compliance_implications" in result

    @pytest.mark.asyncio
    async def test_compliance_verification(self, quantum_security_service, mock_tenant_id):
        """Test compliance verification for quantum-safe implementations."""
        compliance_frameworks = ["NIST", "FIPS", "Common Criteria", "ISO 27001"]
        
        result = await quantum_security_service.verify_compliance(
            tenant_id=mock_tenant_id,
            frameworks=compliance_frameworks,
            implementation_details={
                "algorithms": [QuantumCryptoAlgorithm.KYBER_1024, QuantumCryptoAlgorithm.DILITHIUM_3],
                "key_management": KeyManagementProtocol.QUANTUM_SAFE_KMS,
                "certificate_chain": "quantum_safe_chain"
            }
        )
        
        assert result["compliance_status"] is not None
        assert result["framework_alignment"] is not None
        assert result["gaps_identified"] is not None
        assert "certification_readiness" in result


class TestQuantumSafeKeyManagement:
    """Test quantum-safe key management system."""

    @pytest.mark.asyncio
    async def test_post_quantum_key_generation(self, quantum_security_service, mock_tenant_id):
        """Test post-quantum key generation."""
        result = await quantum_security_service.generate_post_quantum_keys(
            tenant_id=mock_tenant_id,
            key_type="master_key",
            algorithm=QuantumCryptoAlgorithm.KYBER_1024,
            security_level=256
        )
        
        assert result["key_id"] is not None
        assert result["algorithm"] == QuantumCryptoAlgorithm.KYBER_1024
        assert result["security_level"] == 256
        assert result["creation_timestamp"] is not None
        assert result["tenant_id"] == mock_tenant_id

    @pytest.mark.asyncio
    async def test_quantum_key_distribution_simulation(self, quantum_security_service, mock_tenant_id):
        """Test quantum key distribution protocol simulation."""
        result = await quantum_security_service.simulate_quantum_key_distribution(
            tenant_id=mock_tenant_id,
            protocol="BB84",
            key_length=256,
            error_rate=0.01
        )
        
        assert result["shared_key"] is not None
        assert result["protocol"] == "BB84"
        assert result["security_analysis"]["quantum_bit_error_rate"] <= 0.01
        assert result["key_establishment_success"] is True

    @pytest.mark.asyncio
    async def test_secure_key_exchange_protocols(self, quantum_security_service, mock_tenant_id):
        """Test secure key exchange protocols."""
        result = await quantum_security_service.execute_key_exchange(
            tenant_id=mock_tenant_id,
            protocol=KeyManagementProtocol.QUANTUM_SAFE_ECDH,
            party_a_key="party_a_public_key",
            party_b_key="party_b_public_key"
        )
        
        assert result["shared_secret"] is not None
        assert result["protocol"] == KeyManagementProtocol.QUANTUM_SAFE_ECDH
        assert result["key_confirmation"] is True
        assert result["forward_secrecy"] is True

    @pytest.mark.asyncio
    async def test_key_rotation_strategies(self, quantum_security_service, mock_tenant_id):
        """Test quantum-safe key rotation strategies."""
        result = await quantum_security_service.execute_key_rotation(
            tenant_id=mock_tenant_id,
            key_id="test_key_123",
            rotation_policy={
                "frequency_days": 30,
                "overlap_period_hours": 24,
                "algorithm": QuantumCryptoAlgorithm.KYBER_1024
            }
        )
        
        assert result["new_key_id"] is not None
        assert result["old_key_id"] == "test_key_123"
        assert result["transition_period"] is not None
        assert result["rollback_capability"] is True

    @pytest.mark.asyncio
    async def test_quantum_safe_certificates(self, quantum_security_service, mock_tenant_id):
        """Test quantum-safe certificate generation and management."""
        result = await quantum_security_service.generate_quantum_safe_certificate(
            tenant_id=mock_tenant_id,
            subject_info={
                "common_name": "quantum-safe.legal-ai.com",
                "organization": "Legal AI Platform",
                "country": "US"
            },
            signature_algorithm=QuantumCryptoAlgorithm.DILITHIUM_3,
            validity_years=2
        )
        
        assert result["certificate"] is not None
        assert result["private_key"] is not None
        assert result["signature_algorithm"] == QuantumCryptoAlgorithm.DILITHIUM_3
        assert result["validity_period"]["years"] == 2

    @pytest.mark.asyncio
    async def test_hsm_integration(self, quantum_security_service, mock_tenant_id):
        """Test Hardware Security Module integration."""
        result = await quantum_security_service.integrate_with_hsm(
            tenant_id=mock_tenant_id,
            hsm_config={
                "provider": "quantum_safe_hsm",
                "partition": "legal_ai_partition",
                "authentication": "mutual_tls"
            },
            key_operations=["generate", "sign", "encrypt"]
        )
        
        assert result["hsm_connection"] is not None
        assert result["supported_algorithms"] is not None
        assert result["performance_benchmarks"] is not None
        assert "security_features" in result


class TestRealTimeMonitoring:
    """Test real-time monitoring and alerting capabilities."""

    @pytest.mark.asyncio
    async def test_quantum_threat_intelligence_feeds(self, quantum_security_service, mock_tenant_id):
        """Test quantum threat intelligence feed processing."""
        result = await quantum_security_service.process_threat_intelligence(
            tenant_id=mock_tenant_id,
            feed_sources=["NIST", "NCSC", "quantum_research_labs"],
            time_window_hours=24
        )
        
        assert result["new_threats"] is not None
        assert result["algorithm_updates"] is not None
        assert result["vulnerability_reports"] is not None
        assert result["risk_level_changes"] is not None

    @pytest.mark.asyncio
    async def test_algorithm_strength_monitoring(self, quantum_security_service, mock_tenant_id):
        """Test continuous algorithm strength monitoring."""
        result = await quantum_security_service.monitor_algorithm_strength(
            tenant_id=mock_tenant_id,
            algorithms_in_use=[
                QuantumCryptoAlgorithm.KYBER_1024,
                QuantumCryptoAlgorithm.DILITHIUM_3,
                QuantumCryptoAlgorithm.SPHINCS_PLUS
            ]
        )
        
        assert result["strength_assessments"] is not None
        assert result["degradation_indicators"] is not None
        assert result["upgrade_recommendations"] is not None
        assert "monitoring_alerts" in result

    @pytest.mark.asyncio
    async def test_performance_metrics_tracking(self, quantum_security_service, mock_tenant_id):
        """Test performance metrics tracking."""
        result = await quantum_security_service.track_performance_metrics(
            tenant_id=mock_tenant_id,
            metric_types=["encryption_speed", "signature_speed", "key_generation_speed"],
            time_period_hours=24
        )
        
        assert result["performance_trends"] is not None
        assert result["bottleneck_analysis"] is not None
        assert result["optimization_opportunities"] is not None
        assert "baseline_comparisons" in result

    @pytest.mark.asyncio
    async def test_security_event_correlation(self, quantum_security_service, mock_tenant_id):
        """Test security event correlation."""
        security_events = [
            {"type": "key_rotation", "timestamp": datetime.utcnow(), "severity": "info"},
            {"type": "algorithm_deprecation", "timestamp": datetime.utcnow(), "severity": "warning"},
            {"type": "quantum_attack_simulation", "timestamp": datetime.utcnow(), "severity": "high"}
        ]
        
        result = await quantum_security_service.correlate_security_events(
            tenant_id=mock_tenant_id,
            events=security_events,
            correlation_window_minutes=60
        )
        
        assert result["correlated_incidents"] is not None
        assert result["attack_patterns"] is not None
        assert result["risk_indicators"] is not None
        assert "recommended_actions" in result

    @pytest.mark.asyncio
    async def test_automated_alerting_system(self, quantum_security_service, mock_tenant_id):
        """Test automated alerting system."""
        alert_conditions = {
            "quantum_advantage_threshold": 0.8,
            "algorithm_deprecation": True,
            "performance_degradation_percentage": 20,
            "security_breach_indicators": True
        }
        
        result = await quantum_security_service.configure_automated_alerts(
            tenant_id=mock_tenant_id,
            alert_conditions=alert_conditions,
            notification_channels=["email", "slack", "webhook"]
        )
        
        assert result["alert_rules"] is not None
        assert result["escalation_procedures"] is not None
        assert result["notification_configuration"] is not None
        assert "alert_testing_results" in result


class TestTenantIsolation:
    """Test multi-tenant isolation for quantum-safe security."""

    @pytest.mark.asyncio
    async def test_tenant_key_isolation(self, quantum_security_service):
        """Test that tenant keys are properly isolated."""
        tenant_a = str(uuid.uuid4())
        tenant_b = str(uuid.uuid4())
        
        # Generate keys for both tenants
        key_a = await quantum_security_service.generate_kyber_keypair(
            tenant_id=tenant_a,
            security_level=1024
        )
        
        key_b = await quantum_security_service.generate_kyber_keypair(
            tenant_id=tenant_b,
            security_level=1024
        )
        
        # Verify keys are different and isolated
        assert key_a["key_id"] != key_b["key_id"]
        assert key_a["tenant_id"] == tenant_a
        assert key_b["tenant_id"] == tenant_b
        
        # Attempt cross-tenant access should fail
        result = await quantum_security_service.get_tenant_keys(
            tenant_id=tenant_a,
            key_id=key_b["key_id"]
        )
        # Should return None for cross-tenant access
        assert result is None

    @pytest.mark.asyncio
    async def test_tenant_threat_assessment_isolation(self, quantum_security_service):
        """Test that threat assessments are tenant-isolated."""
        tenant_a = str(uuid.uuid4())
        tenant_b = str(uuid.uuid4())
        
        # Generate assessments for both tenants
        assessment_a = await quantum_security_service.assess_quantum_vulnerability(
            tenant_id=tenant_a,
            current_algorithms=["RSA-2048"]
        )
        
        assessment_b = await quantum_security_service.assess_quantum_vulnerability(
            tenant_id=tenant_b,
            current_algorithms=["ECDSA-P256"]
        )
        
        # Verify assessments are isolated
        assert assessment_a.assessment_id != assessment_b.assessment_id
        assert assessment_a.tenant_id == tenant_a
        assert assessment_b.tenant_id == tenant_b

    @pytest.mark.asyncio
    async def test_tenant_migration_plan_isolation(self, quantum_security_service):
        """Test that migration plans are tenant-isolated."""
        tenant_a = str(uuid.uuid4())
        tenant_b = str(uuid.uuid4())
        
        # Generate migration plans for both tenants
        plan_a = await quantum_security_service.generate_transition_roadmap(
            tenant_id=tenant_a,
            current_state={"rsa_keys": 100},
            target_timeline_months=12
        )
        
        plan_b = await quantum_security_service.generate_transition_roadmap(
            tenant_id=tenant_b,
            current_state={"ecdsa_keys": 50},
            target_timeline_months=24
        )
        
        # Verify plans are isolated
        assert plan_a.plan_id != plan_b.plan_id
        assert plan_a.tenant_id == tenant_a
        assert plan_b.tenant_id == tenant_b


class TestErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_invalid_algorithm_selection(self, quantum_security_service, mock_tenant_id):
        """Test handling of invalid algorithm selection."""
        with pytest.raises(ValueError):
            await quantum_security_service.generate_kyber_keypair(
                tenant_id=mock_tenant_id,
                security_level=999  # Invalid security level
            )

    @pytest.mark.asyncio
    async def test_corrupted_key_handling(self, quantum_security_service, mock_tenant_id):
        """Test handling of corrupted keys."""
        with pytest.raises(Exception):
            await quantum_security_service.kyber_decrypt(
                private_key="corrupted_key_data",
                encrypted_data="test_data",
                shared_secret="test_secret",
                tenant_id=mock_tenant_id
            )

    @pytest.mark.asyncio
    async def test_excessive_workload_handling(self, quantum_security_service, mock_tenant_id):
        """Test handling of excessive workload scenarios."""
        # Test with extremely high workload
        workload_profile = {
            "encryption_operations_per_second": 1000000,  # Excessive load
            "signature_operations_per_second": 500000,
            "key_exchange_operations_per_hour": 10000,
            "average_data_size_kb": 10240
        }
        
        result = await quantum_security_service.analyze_performance_impact(
            tenant_id=mock_tenant_id,
            workload_profile=workload_profile
        )
        
        # Should still return results but with warnings
        assert result is not None
        assert "performance_warnings" in result
        assert result["resource_requirements"]["recommended_scaling"] is not None


class TestIntegrationScenarios:
    """Test integration scenarios with existing systems."""

    @pytest.mark.asyncio
    async def test_document_encryption_integration(self, quantum_security_service, mock_tenant_id, sample_document_data):
        """Test integration with document encryption workflows."""
        # Simulate full document encryption workflow
        keypair = await quantum_security_service.generate_kyber_keypair(
            tenant_id=mock_tenant_id,
            security_level=1024
        )
        
        encrypted_result = await quantum_security_service.kyber_encrypt(
            public_key=keypair["public_key"],
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id
        )
        
        # Simulate document storage with quantum-safe encryption
        document_record = {
            "document_id": str(uuid.uuid4()),
            "tenant_id": mock_tenant_id,
            "encryption_algorithm": encrypted_result["algorithm"],
            "encrypted_data": encrypted_result["encrypted_data"],
            "key_reference": keypair["key_id"]
        }
        
        assert document_record["encryption_algorithm"] == QuantumCryptoAlgorithm.KYBER_1024
        assert document_record["encrypted_data"] is not None

    @pytest.mark.asyncio
    async def test_contract_signature_integration(self, quantum_security_service, mock_tenant_id, sample_document_data):
        """Test integration with contract signature workflows."""
        # Simulate contract signing with quantum-safe signatures
        keypair = await quantum_security_service.generate_dilithium_keypair(
            tenant_id=mock_tenant_id,
            security_level=3
        )
        
        signature_result = await quantum_security_service.dilithium_sign(
            private_key=keypair["private_key"],
            data=json.dumps(sample_document_data).encode(),
            tenant_id=mock_tenant_id
        )
        
        # Simulate contract record with quantum-safe signature
        contract_signature = {
            "contract_id": str(uuid.uuid4()),
            "tenant_id": mock_tenant_id,
            "signature_algorithm": signature_result["algorithm"],
            "signature": signature_result["signature"],
            "signer_key_id": keypair["key_id"],
            "timestamp": datetime.utcnow()
        }
        
        assert contract_signature["signature_algorithm"] == QuantumCryptoAlgorithm.DILITHIUM_3
        assert contract_signature["signature"] is not None