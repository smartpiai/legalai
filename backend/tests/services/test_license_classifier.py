"""
License Type Classification Engine Tests
Following TDD - RED phase: Comprehensive test suite for license type classifier
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json
from decimal import Decimal

from app.services.license_classifier import (
    LicenseClassifierService,
    LicensePattern,
    ClassificationRule,
    TextAnalyzer,
    FeatureExtractor,
    LicenseTypePredictor,
    ClassificationResult,
    ConfidenceScore,
    LicenseFeatures,
    SemanticAnalysis,
    ContractualTerms,
    LegalLanguageProcessor,
    TrainingData,
    ModelPerformance,
    ValidationMetrics,
    ClassificationError,
    ModelAccuracy,
    FeatureImportance,
    LicenseTypeEnum,
    ClassificationMethod,
    AnalysisDepth,
    ProcessingMode,
    ValidationLevel
)
from app.models.licensing import LicenseDocument, ClassificationHistory
from app.core.exceptions import ClassificationError, ModelError, ValidationError


class TestLicenseClassifierService:
    """Test suite for license type classification engine"""

    @pytest.fixture
    def mock_postgres(self):
        """Mock PostgreSQL connection"""
        db = AsyncMock()
        db.query = AsyncMock()
        db.execute = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.expire = AsyncMock()
        return redis

    @pytest.fixture
    def mock_ml_model(self):
        """Mock ML model"""
        model = AsyncMock()
        model.predict = AsyncMock()
        model.train = AsyncMock()
        model.evaluate = AsyncMock()
        return model

    @pytest.fixture
    def mock_nlp_processor(self):
        """Mock NLP processor"""
        nlp = AsyncMock()
        nlp.tokenize = AsyncMock()
        nlp.extract_entities = AsyncMock()
        nlp.analyze_sentiment = AsyncMock()
        return nlp

    @pytest.fixture
    def classifier_service(
        self,
        mock_postgres,
        mock_redis,
        mock_ml_model,
        mock_nlp_processor
    ):
        """Create license classifier service instance"""
        return LicenseClassifierService(
            postgres=mock_postgres,
            redis=mock_redis,
            ml_model=mock_ml_model,
            nlp_processor=mock_nlp_processor
        )

    @pytest.fixture
    def sample_perpetual_license(self):
        """Sample perpetual license text"""
        return """
        PERPETUAL SOFTWARE LICENSE AGREEMENT
        
        This Agreement grants the Licensee a perpetual, non-exclusive, non-transferable 
        license to use the Software. The license is valid for the lifetime of the Software 
        and does not expire. Payment is made once at the time of purchase.
        
        The Licensee may install and use the Software on a single computer system 
        indefinitely, subject to the terms and conditions herein.
        """

    @pytest.fixture
    def sample_subscription_license(self):
        """Sample subscription license text"""
        return """
        SOFTWARE SUBSCRIPTION AGREEMENT
        
        This is a subscription-based license valid for 12 months from the activation date.
        The license must be renewed annually for continued use. Monthly fees apply.
        
        Subscription includes software updates, maintenance, and technical support.
        Failure to renew will result in license termination and software deactivation.
        """

    @pytest.fixture
    def sample_concurrent_license(self):
        """Sample concurrent license text"""
        return """
        CONCURRENT USER LICENSE AGREEMENT
        
        This license permits up to 10 concurrent users to access the Software 
        simultaneously. The total number of active sessions cannot exceed the 
        licensed concurrent user limit at any given time.
        
        Network-based license management ensures compliance with concurrent usage limits.
        """

    # Test License Text Analysis

    @pytest.mark.asyncio
    async def test_analyze_license_text(self, classifier_service, sample_perpetual_license):
        """Test basic license text analysis"""
        result = await classifier_service.analyze_license_text(
            license_text=sample_perpetual_license,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, SemanticAnalysis)
        assert result.key_terms is not None
        assert result.legal_concepts is not None
        assert result.licensing_patterns is not None

    @pytest.mark.asyncio
    async def test_extract_features(self, classifier_service, sample_subscription_license):
        """Test feature extraction from license text"""
        features = await classifier_service.extract_features(
            license_text=sample_subscription_license,
            tenant_id="tenant-123"
        )
        
        assert isinstance(features, LicenseFeatures)
        assert features.textual_features is not None
        assert features.semantic_features is not None
        assert features.structural_features is not None

    @pytest.mark.asyncio
    async def test_identify_license_patterns(self, classifier_service, sample_concurrent_license):
        """Test license pattern identification"""
        patterns = await classifier_service.identify_patterns(
            license_text=sample_concurrent_license,
            tenant_id="tenant-123"
        )
        
        assert isinstance(patterns, list)
        assert all(isinstance(p, LicensePattern) for p in patterns)
        assert len(patterns) > 0

    @pytest.mark.asyncio
    async def test_classify_perpetual_license(self, classifier_service, sample_perpetual_license):
        """Test classification of perpetual license"""
        result = await classifier_service.classify_license_type(
            license_text=sample_perpetual_license,
            method=ClassificationMethod.HYBRID,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.predicted_type == LicenseTypeEnum.PERPETUAL
        assert result.confidence_score > 0.7
        assert "perpetual" in result.reasoning.lower()

    @pytest.mark.asyncio
    async def test_classify_subscription_license(self, classifier_service, sample_subscription_license):
        """Test classification of subscription license"""
        result = await classifier_service.classify_license_type(
            license_text=sample_subscription_license,
            method=ClassificationMethod.ML_BASED,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.predicted_type == LicenseTypeEnum.SUBSCRIPTION
        assert result.confidence_score > 0.8
        assert "subscription" in result.reasoning.lower()

    @pytest.mark.asyncio
    async def test_classify_concurrent_license(self, classifier_service, sample_concurrent_license):
        """Test classification of concurrent license"""
        result = await classifier_service.classify_license_type(
            license_text=sample_concurrent_license,
            method=ClassificationMethod.RULE_BASED,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.predicted_type == LicenseTypeEnum.CONCURRENT
        assert result.confidence_score > 0.75

    # Test Different Classification Methods

    @pytest.mark.asyncio
    async def test_rule_based_classification(self, classifier_service):
        """Test rule-based classification method"""
        license_text = "This perpetual license grants unlimited usage rights"
        
        result = await classifier_service.classify_with_rules(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.method == ClassificationMethod.RULE_BASED
        assert result.predicted_type in [t for t in LicenseTypeEnum]

    @pytest.mark.asyncio
    async def test_ml_based_classification(self, classifier_service):
        """Test ML-based classification method"""
        license_text = "Annual subscription with monthly billing cycles"
        
        result = await classifier_service.classify_with_ml(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.method == ClassificationMethod.ML_BASED
        assert hasattr(result, 'feature_importance')

    @pytest.mark.asyncio
    async def test_hybrid_classification(self, classifier_service):
        """Test hybrid classification method"""
        license_text = "Term license valid for 3 years with renewal options"
        
        result = await classifier_service.classify_with_hybrid(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.method == ClassificationMethod.HYBRID
        assert hasattr(result, 'rule_confidence')
        assert hasattr(result, 'ml_confidence')

    # Test Feature Engineering

    @pytest.mark.asyncio
    async def test_extract_textual_features(self, classifier_service):
        """Test textual feature extraction"""
        license_text = "Software license with installation and usage rights"
        
        features = await classifier_service.extract_textual_features(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert "word_count" in features
        assert "sentence_count" in features
        assert "keyword_density" in features
        assert "legal_term_frequency" in features

    @pytest.mark.asyncio
    async def test_extract_semantic_features(self, classifier_service):
        """Test semantic feature extraction"""
        license_text = "Perpetual rights granted for commercial software usage"
        
        features = await classifier_service.extract_semantic_features(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert "sentiment_score" in features
        assert "topic_distribution" in features
        assert "entity_types" in features
        assert "concept_similarity" in features

    @pytest.mark.asyncio
    async def test_extract_structural_features(self, classifier_service):
        """Test structural feature extraction"""
        license_text = """
        Section 1: License Grant
        Section 2: Payment Terms
        Section 3: Usage Rights
        """
        
        features = await classifier_service.extract_structural_features(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert "section_count" in features
        assert "clause_density" in features
        assert "paragraph_structure" in features
        assert "formatting_patterns" in features

    # Test Model Training and Evaluation

    @pytest.mark.asyncio
    async def test_train_classification_model(self, classifier_service):
        """Test model training"""
        training_data = TrainingData(
            license_texts=["perpetual license", "subscription agreement"],
            license_types=[LicenseTypeEnum.PERPETUAL, LicenseTypeEnum.SUBSCRIPTION],
            features_matrix=[[1, 0, 1], [0, 1, 0]]
        )
        
        result = await classifier_service.train_model(
            training_data=training_data,
            model_type="random_forest",
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ModelPerformance)
        assert result.accuracy > 0
        assert result.precision > 0
        assert result.recall > 0

    @pytest.mark.asyncio
    async def test_evaluate_model_performance(self, classifier_service):
        """Test model evaluation"""
        test_data = TrainingData(
            license_texts=["test license 1", "test license 2"],
            license_types=[LicenseTypeEnum.TERM, LicenseTypeEnum.FLOATING],
            features_matrix=[[1, 1, 0], [0, 0, 1]]
        )
        
        metrics = await classifier_service.evaluate_model(
            test_data=test_data,
            tenant_id="tenant-123"
        )
        
        assert isinstance(metrics, ValidationMetrics)
        assert hasattr(metrics, 'confusion_matrix')
        assert hasattr(metrics, 'classification_report')

    @pytest.mark.asyncio
    async def test_model_cross_validation(self, classifier_service):
        """Test cross-validation"""
        validation_result = await classifier_service.cross_validate_model(
            k_folds=5,
            tenant_id="tenant-123"
        )
        
        assert "mean_accuracy" in validation_result
        assert "std_accuracy" in validation_result
        assert "fold_scores" in validation_result

    # Test Rule Management

    @pytest.mark.asyncio
    async def test_create_classification_rule(self, classifier_service):
        """Test creating classification rules"""
        rule = ClassificationRule(
            name="perpetual_license_rule",
            pattern=r"perpetual|lifetime|permanent",
            license_type=LicenseTypeEnum.PERPETUAL,
            confidence=0.9,
            priority=1
        )
        
        result = await classifier_service.create_rule(
            rule=rule,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.name == "perpetual_license_rule"

    @pytest.mark.asyncio
    async def test_update_classification_rule(self, classifier_service):
        """Test updating classification rules"""
        rule_id = "rule-123"
        updates = {
            "confidence": 0.95,
            "priority": 2
        }
        
        result = await classifier_service.update_rule(
            rule_id=rule_id,
            updates=updates,
            tenant_id="tenant-123"
        )
        
        assert result.confidence == 0.95
        assert result.priority == 2

    @pytest.mark.asyncio
    async def test_delete_classification_rule(self, classifier_service):
        """Test deleting classification rules"""
        rule_id = "rule-456"
        
        result = await classifier_service.delete_rule(
            rule_id=rule_id,
            tenant_id="tenant-123"
        )
        
        assert result["deleted"] is True

    @pytest.mark.asyncio
    async def test_get_classification_rules(self, classifier_service):
        """Test retrieving classification rules"""
        rules = await classifier_service.get_rules(
            license_type=LicenseTypeEnum.SUBSCRIPTION,
            tenant_id="tenant-123"
        )
        
        assert isinstance(rules, list)
        assert all(isinstance(r, ClassificationRule) for r in rules)

    # Test Batch Processing

    @pytest.mark.asyncio
    async def test_batch_classify_licenses(self, classifier_service):
        """Test batch classification"""
        license_texts = [
            "Perpetual software license",
            "Annual subscription agreement",
            "Term license for 5 years"
        ]
        
        results = await classifier_service.batch_classify(
            license_texts=license_texts,
            batch_size=10,
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, list)
        assert len(results) == len(license_texts)
        assert all(isinstance(r, ClassificationResult) for r in results)

    @pytest.mark.asyncio
    async def test_parallel_processing(self, classifier_service):
        """Test parallel processing capabilities"""
        license_texts = [f"License text {i}" for i in range(20)]
        
        results = await classifier_service.process_parallel(
            license_texts=license_texts,
            max_workers=4,
            tenant_id="tenant-123"
        )
        
        assert len(results) == 20
        assert all(isinstance(r, ClassificationResult) for r in results)

    # Test Confidence Scoring

    @pytest.mark.asyncio
    async def test_calculate_confidence_score(self, classifier_service):
        """Test confidence score calculation"""
        features = LicenseFeatures(
            textual_features={"perpetual_keywords": 5},
            semantic_features={"confidence": 0.85},
            structural_features={"section_count": 8}
        )
        
        confidence = await classifier_service.calculate_confidence(
            features=features,
            prediction=LicenseTypeEnum.PERPETUAL,
            tenant_id="tenant-123"
        )
        
        assert isinstance(confidence, ConfidenceScore)
        assert 0 <= confidence.overall_score <= 1
        assert confidence.feature_contributions is not None

    @pytest.mark.asyncio
    async def test_confidence_threshold_validation(self, classifier_service):
        """Test confidence threshold validation"""
        result = await classifier_service.validate_confidence_threshold(
            classification_result=ClassificationResult(
                predicted_type=LicenseTypeEnum.TERM,
                confidence_score=0.6,
                method=ClassificationMethod.HYBRID,
                reasoning="Term-based keywords detected"
            ),
            minimum_confidence=0.7,
            tenant_id="tenant-123"
        )
        
        assert result["meets_threshold"] is False
        assert "requires_manual_review" in result

    # Test Error Handling and Edge Cases

    @pytest.mark.asyncio
    async def test_handle_empty_license_text(self, classifier_service):
        """Test handling empty license text"""
        with pytest.raises(ClassificationError):
            await classifier_service.classify_license_type(
                license_text="",
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_invalid_license_text(self, classifier_service):
        """Test handling invalid license text"""
        with pytest.raises(ValidationError):
            await classifier_service.classify_license_type(
                license_text=None,
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_model_failure(self, classifier_service):
        """Test handling ML model failures"""
        # Mock model failure
        classifier_service.ml_model.predict.side_effect = Exception("Model error")
        
        # Should fallback to rule-based classification
        result = await classifier_service.classify_license_type(
            license_text="Perpetual license agreement",
            method=ClassificationMethod.HYBRID,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.method == ClassificationMethod.RULE_BASED  # Fallback

    @pytest.mark.asyncio
    async def test_handle_ambiguous_classification(self, classifier_service):
        """Test handling ambiguous classifications"""
        license_text = "Mixed terms with both perpetual and subscription elements"
        
        result = await classifier_service.classify_license_type(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ClassificationResult)
        assert result.confidence_score < 0.8  # Lower confidence for ambiguous text
        assert "ambiguous" in result.reasoning.lower()

    # Test Performance and Optimization

    @pytest.mark.asyncio
    async def test_classification_performance(self, classifier_service):
        """Test classification performance metrics"""
        start_time = datetime.utcnow()
        
        await classifier_service.classify_license_type(
            license_text="Standard software license agreement",
            tenant_id="tenant-123"
        )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        assert processing_time < 5.0  # Should complete within 5 seconds

    @pytest.mark.asyncio
    async def test_caching_mechanism(self, classifier_service):
        """Test result caching"""
        license_text = "Cached license text for testing"
        
        # First call
        result1 = await classifier_service.classify_license_type(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        # Second call should use cache
        result2 = await classifier_service.classify_license_type(
            license_text=license_text,
            tenant_id="tenant-123"
        )
        
        assert result1.predicted_type == result2.predicted_type
        # Verify cache was used (mock redis.get should be called)

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_model_isolation(self, classifier_service):
        """Test model isolation between tenants"""
        license_text = "Tenant-specific license text"
        
        # Classify for tenant A
        result_a = await classifier_service.classify_license_type(
            license_text=license_text,
            tenant_id="tenant-A"
        )
        
        # Classify for tenant B
        result_b = await classifier_service.classify_license_type(
            license_text=license_text,
            tenant_id="tenant-B"
        )
        
        # Results should be independent (different tenant models)
        assert isinstance(result_a, ClassificationResult)
        assert isinstance(result_b, ClassificationResult)

    @pytest.mark.asyncio
    async def test_tenant_rule_isolation(self, classifier_service):
        """Test rule isolation between tenants"""
        rule = ClassificationRule(
            name="tenant_specific_rule",
            pattern=r"custom_pattern",
            license_type=LicenseTypeEnum.CUSTOM,
            confidence=0.8,
            priority=1
        )
        
        # Create rule for tenant A
        await classifier_service.create_rule(
            rule=rule,
            tenant_id="tenant-A"
        )
        
        # Get rules for tenant B
        rules_b = await classifier_service.get_rules(
            tenant_id="tenant-B"
        )
        
        # Tenant B should not see tenant A's rules
        assert not any(r.name == "tenant_specific_rule" for r in rules_b)

    # Test Integration Features

    @pytest.mark.asyncio
    async def test_export_classification_model(self, classifier_service):
        """Test model export functionality"""
        export_result = await classifier_service.export_model(
            model_version="v1.0",
            format="pickle",
            tenant_id="tenant-123"
        )
        
        assert "export_path" in export_result
        assert "model_size" in export_result
        assert export_result["status"] == "success"

    @pytest.mark.asyncio
    async def test_import_classification_model(self, classifier_service):
        """Test model import functionality"""
        import_result = await classifier_service.import_model(
            model_path="/models/classifier_v2.pkl",
            tenant_id="tenant-123"
        )
        
        assert "import_status" in import_result
        assert "model_version" in import_result
        assert import_result["import_status"] == "success"

    @pytest.mark.asyncio
    async def test_get_classification_history(self, classifier_service):
        """Test classification history retrieval"""
        history = await classifier_service.get_classification_history(
            limit=50,
            tenant_id="tenant-123"
        )
        
        assert isinstance(history, list)
        assert all("classification_id" in h for h in history)
        assert all("timestamp" in h for h in history)

    @pytest.mark.asyncio
    async def test_generate_classification_report(self, classifier_service):
        """Test classification report generation"""
        report = await classifier_service.generate_classification_report(
            period="monthly",
            include_metrics=True,
            tenant_id="tenant-123"
        )
        
        assert "total_classifications" in report
        assert "accuracy_metrics" in report
        assert "license_type_distribution" in report
        assert "confidence_distribution" in report