"""
Test suite for External Data Integration Service
Tests legal database connections, registry lookups, and data enrichment
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from unittest.mock import Mock, patch, AsyncMock
import asyncio
import json

from app.services.external_data_integration import (
    ExternalDataService,
    DataSource,
    DataProvider,
    DataRequest,
    DataResponse,
    CompanyInfo,
    LegalCase,
    RegulatoryAlert,
    MarketData,
    CreditRating,
    ComplianceRecord,
    GeographicData,
    CurrencyRate,
    DataSourceType,
    RequestStatus,
    DataQuality,
    CacheStrategy,
    IntegrationConfig,
    DataFreshness,
    IndustryBenchmark,
    NewsItem,
    DataEnrichmentResult
)


@pytest.fixture
def integration_service():
    """Create external data integration service instance"""
    config = IntegrationConfig(
        cache_enabled=True,
        cache_ttl_seconds=3600,
        rate_limit_per_minute=100,
        retry_attempts=3,
        timeout_seconds=30
    )
    return ExternalDataService(config)


@pytest.fixture
def sample_company_request():
    """Sample company data request"""
    return DataRequest(
        request_type="company_info",
        identifier="ABC123",
        parameters={
            "jurisdiction": "Delaware",
            "include_subsidiaries": True,
            "include_officers": True
        }
    )


@pytest.fixture
def sample_legal_case():
    """Sample legal case data"""
    return LegalCase(
        case_id="2024-CV-001234",
        title="Acme Corp v. Beta LLC",
        jurisdiction="US District Court",
        status="pending",
        filing_date=datetime(2024, 1, 15),
        parties=["Acme Corp", "Beta LLC"],
        case_type="contract_dispute"
    )


class TestLegalDatabaseConnections:
    """Test legal database integration"""

    @pytest.mark.asyncio
    async def test_connect_to_legal_database(self, integration_service):
        """Test connecting to legal database"""
        provider = DataProvider(
            name="LexisNexis",
            type=DataSourceType.LEGAL_DATABASE,
            api_endpoint="https://api.lexisnexis.com/v1",
            credentials={"api_key": "test_key"}
        )
        
        connected = await integration_service.connect_provider(provider)
        
        assert connected
        assert provider.name in integration_service.active_providers

    @pytest.mark.asyncio
    async def test_search_legal_cases(self, integration_service):
        """Test searching legal cases"""
        query = {
            "search_term": "breach of contract",
            "jurisdiction": "US",
            "date_range": {"start": "2023-01-01", "end": "2024-12-31"}
        }
        
        cases = await integration_service.search_legal_cases(query)
        
        assert isinstance(cases, list)
        assert all(isinstance(case, LegalCase) for case in cases)

    @pytest.mark.asyncio
    async def test_retrieve_case_documents(self, integration_service, sample_legal_case):
        """Test retrieving case documents"""
        documents = await integration_service.retrieve_case_documents(
            sample_legal_case.case_id
        )
        
        assert isinstance(documents, list)
        assert all("document_id" in doc for doc in documents)

    @pytest.mark.asyncio
    async def test_check_case_updates(self, integration_service):
        """Test checking for case updates"""
        case_ids = ["2024-CV-001234", "2024-CV-005678"]
        
        updates = await integration_service.check_case_updates(case_ids)
        
        assert isinstance(updates, dict)
        assert all(case_id in updates for case_id in case_ids)

    @pytest.mark.asyncio
    async def test_get_legal_precedents(self, integration_service):
        """Test getting legal precedents"""
        topic = "intellectual property"
        
        precedents = await integration_service.get_legal_precedents(topic)
        
        assert isinstance(precedents, list)
        assert all("citation" in p for p in precedents)


class TestCompanyRegistryLookups:
    """Test company registry integration"""

    @pytest.mark.asyncio
    async def test_lookup_company_info(self, integration_service):
        """Test company information lookup"""
        company_info = await integration_service.lookup_company(
            identifier="12345678",
            registry="SEC_EDGAR"
        )
        
        assert isinstance(company_info, CompanyInfo)
        assert company_info.registration_number == "12345678"

    @pytest.mark.asyncio
    async def test_search_company_by_name(self, integration_service):
        """Test searching companies by name"""
        results = await integration_service.search_companies(
            name="Acme",
            jurisdiction="Delaware"
        )
        
        assert isinstance(results, list)
        assert all(isinstance(r, CompanyInfo) for r in results)

    @pytest.mark.asyncio
    async def test_get_company_officers(self, integration_service):
        """Test retrieving company officers"""
        officers = await integration_service.get_company_officers(
            company_id="ABC123"
        )
        
        assert isinstance(officers, list)
        assert all("name" in officer for officer in officers)

    @pytest.mark.asyncio
    async def test_get_company_subsidiaries(self, integration_service):
        """Test retrieving company subsidiaries"""
        subsidiaries = await integration_service.get_subsidiaries(
            company_id="ABC123"
        )
        
        assert isinstance(subsidiaries, list)
        assert all("subsidiary_id" in sub for sub in subsidiaries)

    @pytest.mark.asyncio
    async def test_verify_company_status(self, integration_service):
        """Test verifying company status"""
        status = await integration_service.verify_company_status(
            company_id="ABC123"
        )
        
        assert status in ["active", "inactive", "dissolved"]


class TestRegulatoryFeedIntegration:
    """Test regulatory feed integration"""

    @pytest.mark.asyncio
    async def test_subscribe_to_regulatory_feed(self, integration_service):
        """Test subscribing to regulatory feeds"""
        subscription = await integration_service.subscribe_regulatory_feed(
            feed_type="SEC_FILINGS",
            filters={"form_types": ["10-K", "10-Q"]}
        )
        
        assert subscription["status"] == "active"
        assert subscription["feed_type"] == "SEC_FILINGS"

    @pytest.mark.asyncio
    async def test_fetch_regulatory_alerts(self, integration_service):
        """Test fetching regulatory alerts"""
        alerts = await integration_service.fetch_regulatory_alerts(
            since=datetime.now() - timedelta(days=7)
        )
        
        assert isinstance(alerts, list)
        assert all(isinstance(alert, RegulatoryAlert) for alert in alerts)

    @pytest.mark.asyncio
    async def test_get_compliance_updates(self, integration_service):
        """Test getting compliance updates"""
        updates = await integration_service.get_compliance_updates(
            jurisdictions=["US", "EU"],
            topics=["data_privacy", "anti_money_laundering"]
        )
        
        assert isinstance(updates, list)
        assert all("update_id" in update for update in updates)

    @pytest.mark.asyncio
    async def test_check_regulatory_changes(self, integration_service):
        """Test checking for regulatory changes"""
        changes = await integration_service.check_regulatory_changes(
            regulations=["GDPR", "CCPA"],
            since_date=datetime(2024, 1, 1)
        )
        
        assert isinstance(changes, dict)
        assert all(reg in changes for reg in ["GDPR", "CCPA"])

    @pytest.mark.asyncio
    async def test_get_enforcement_actions(self, integration_service):
        """Test getting enforcement actions"""
        actions = await integration_service.get_enforcement_actions(
            entity_name="Sample Corp"
        )
        
        assert isinstance(actions, list)
        assert all("action_id" in action for action in actions)


class TestNewsAndAlertFeeds:
    """Test news and alert feed integration"""

    @pytest.mark.asyncio
    async def test_subscribe_news_feed(self, integration_service):
        """Test subscribing to news feeds"""
        subscription = await integration_service.subscribe_news_feed(
            sources=["Reuters", "Bloomberg"],
            keywords=["merger", "acquisition", "lawsuit"]
        )
        
        assert subscription["status"] == "active"
        assert len(subscription["sources"]) == 2

    @pytest.mark.asyncio
    async def test_fetch_news_items(self, integration_service):
        """Test fetching news items"""
        news = await integration_service.fetch_news(
            keywords=["contract dispute"],
            limit=10
        )
        
        assert isinstance(news, list)
        assert len(news) <= 10
        assert all(isinstance(item, NewsItem) for item in news)

    @pytest.mark.asyncio
    async def test_setup_alert_triggers(self, integration_service):
        """Test setting up alert triggers"""
        trigger = await integration_service.setup_alert(
            trigger_type="keyword_mention",
            conditions={"keywords": ["bankruptcy", "default"]},
            notification_channel="email"
        )
        
        assert trigger["status"] == "active"
        assert trigger["trigger_type"] == "keyword_mention"

    @pytest.mark.asyncio
    async def test_get_trending_topics(self, integration_service):
        """Test getting trending legal topics"""
        trends = await integration_service.get_trending_topics(
            category="legal",
            timeframe="24h"
        )
        
        assert isinstance(trends, list)
        assert all("topic" in trend for trend in trends)

    @pytest.mark.asyncio
    async def test_monitor_entity_mentions(self, integration_service):
        """Test monitoring entity mentions"""
        mentions = await integration_service.monitor_mentions(
            entities=["Acme Corp", "Beta LLC"],
            timeframe="7d"
        )
        
        assert isinstance(mentions, dict)
        assert all(entity in mentions for entity in ["Acme Corp", "Beta LLC"])


class TestMarketDataIntegration:
    """Test market data integration"""

    @pytest.mark.asyncio
    async def test_fetch_market_data(self, integration_service):
        """Test fetching market data"""
        data = await integration_service.fetch_market_data(
            symbols=["AAPL", "GOOGL"],
            data_types=["price", "volume"]
        )
        
        assert isinstance(data, dict)
        assert all(symbol in data for symbol in ["AAPL", "GOOGL"])

    @pytest.mark.asyncio
    async def test_get_financial_metrics(self, integration_service):
        """Test getting financial metrics"""
        metrics = await integration_service.get_financial_metrics(
            company_id="ABC123",
            metrics=["revenue", "profit_margin", "debt_ratio"]
        )
        
        assert isinstance(metrics, dict)
        assert all(metric in metrics for metric in ["revenue", "profit_margin"])

    @pytest.mark.asyncio
    async def test_get_market_indicators(self, integration_service):
        """Test getting market indicators"""
        indicators = await integration_service.get_market_indicators(
            indicators=["S&P500", "VIX"],
            period="1d"
        )
        
        assert isinstance(indicators, dict)
        assert all(ind in indicators for ind in ["S&P500", "VIX"])

    @pytest.mark.asyncio
    async def test_get_sector_performance(self, integration_service):
        """Test getting sector performance"""
        performance = await integration_service.get_sector_performance(
            sectors=["technology", "healthcare"],
            period="1m"
        )
        
        assert isinstance(performance, dict)
        assert all(sector in performance for sector in ["technology", "healthcare"])

    @pytest.mark.asyncio
    async def test_get_economic_indicators(self, integration_service):
        """Test getting economic indicators"""
        indicators = await integration_service.get_economic_indicators(
            country="US",
            indicators=["GDP", "unemployment_rate", "inflation"]
        )
        
        assert isinstance(indicators, dict)
        assert "GDP" in indicators


class TestCreditRatingServices:
    """Test credit rating service integration"""

    @pytest.mark.asyncio
    async def test_get_credit_rating(self, integration_service):
        """Test getting credit ratings"""
        rating = await integration_service.get_credit_rating(
            entity_id="ABC123",
            rating_agency="S&P"
        )
        
        assert isinstance(rating, CreditRating)
        assert rating.agency == "S&P"

    @pytest.mark.asyncio
    async def test_get_credit_history(self, integration_service):
        """Test getting credit history"""
        history = await integration_service.get_credit_history(
            entity_id="ABC123",
            period="5y"
        )
        
        assert isinstance(history, list)
        assert all(isinstance(r, CreditRating) for r in history)

    @pytest.mark.asyncio
    async def test_monitor_rating_changes(self, integration_service):
        """Test monitoring rating changes"""
        changes = await integration_service.monitor_rating_changes(
            entities=["ABC123", "XYZ789"]
        )
        
        assert isinstance(changes, list)
        assert all("entity_id" in change for change in changes)

    @pytest.mark.asyncio
    async def test_get_credit_risk_metrics(self, integration_service):
        """Test getting credit risk metrics"""
        metrics = await integration_service.get_credit_risk_metrics(
            entity_id="ABC123"
        )
        
        assert isinstance(metrics, dict)
        assert "default_probability" in metrics

    @pytest.mark.asyncio
    async def test_compare_credit_ratings(self, integration_service):
        """Test comparing credit ratings"""
        comparison = await integration_service.compare_ratings(
            entities=["ABC123", "XYZ789"],
            agencies=["S&P", "Moody's"]
        )
        
        assert isinstance(comparison, dict)
        assert all(entity in comparison for entity in ["ABC123", "XYZ789"])


class TestComplianceDatabases:
    """Test compliance database integration"""

    @pytest.mark.asyncio
    async def test_check_compliance_status(self, integration_service):
        """Test checking compliance status"""
        status = await integration_service.check_compliance_status(
            entity_id="ABC123",
            regulations=["GDPR", "SOX"]
        )
        
        assert isinstance(status, dict)
        assert all(reg in status for reg in ["GDPR", "SOX"])

    @pytest.mark.asyncio
    async def test_get_compliance_records(self, integration_service):
        """Test getting compliance records"""
        records = await integration_service.get_compliance_records(
            entity_id="ABC123",
            record_type="audit"
        )
        
        assert isinstance(records, list)
        assert all(isinstance(r, ComplianceRecord) for r in records)

    @pytest.mark.asyncio
    async def test_check_sanctions_lists(self, integration_service):
        """Test checking sanctions lists"""
        result = await integration_service.check_sanctions(
            entity_name="Sample Corp",
            lists=["OFAC", "EU_SANCTIONS"]
        )
        
        assert isinstance(result, dict)
        assert "is_sanctioned" in result

    @pytest.mark.asyncio
    async def test_get_compliance_certificates(self, integration_service):
        """Test getting compliance certificates"""
        certificates = await integration_service.get_certificates(
            entity_id="ABC123",
            cert_types=["ISO27001", "SOC2"]
        )
        
        assert isinstance(certificates, list)
        assert all("certificate_id" in cert for cert in certificates)

    @pytest.mark.asyncio
    async def test_verify_licenses(self, integration_service):
        """Test verifying licenses"""
        licenses = await integration_service.verify_licenses(
            entity_id="ABC123",
            license_types=["business", "professional"]
        )
        
        assert isinstance(licenses, list)
        assert all("license_status" in lic for lic in licenses)


class TestIndustryBenchmarks:
    """Test industry benchmark integration"""

    @pytest.mark.asyncio
    async def test_get_industry_benchmarks(self, integration_service):
        """Test getting industry benchmarks"""
        benchmarks = await integration_service.get_industry_benchmarks(
            industry="technology",
            metrics=["revenue_growth", "profit_margin"]
        )
        
        assert isinstance(benchmarks, IndustryBenchmark)
        assert benchmarks.industry == "technology"

    @pytest.mark.asyncio
    async def test_compare_to_industry(self, integration_service):
        """Test comparing entity to industry"""
        comparison = await integration_service.compare_to_industry(
            entity_id="ABC123",
            industry="technology",
            metrics=["revenue", "employees"]
        )
        
        assert isinstance(comparison, dict)
        assert "percentile_rank" in comparison

    @pytest.mark.asyncio
    async def test_get_peer_comparison(self, integration_service):
        """Test peer comparison"""
        comparison = await integration_service.compare_peers(
            entity_id="ABC123",
            peer_ids=["XYZ789", "DEF456"]
        )
        
        assert isinstance(comparison, dict)
        assert all(peer in comparison for peer in ["XYZ789", "DEF456"])

    @pytest.mark.asyncio
    async def test_get_industry_trends(self, integration_service):
        """Test getting industry trends"""
        trends = await integration_service.get_industry_trends(
            industry="technology",
            period="5y"
        )
        
        assert isinstance(trends, list)
        assert all("trend_name" in trend for trend in trends)

    @pytest.mark.asyncio
    async def test_get_best_practices(self, integration_service):
        """Test getting industry best practices"""
        practices = await integration_service.get_best_practices(
            industry="legal_services",
            category="contract_management"
        )
        
        assert isinstance(practices, list)
        assert all("practice_id" in practice for practice in practices)


class TestGeographicData:
    """Test geographic data integration"""

    @pytest.mark.asyncio
    async def test_get_jurisdiction_info(self, integration_service):
        """Test getting jurisdiction information"""
        info = await integration_service.get_jurisdiction_info(
            jurisdiction="Delaware"
        )
        
        assert isinstance(info, GeographicData)
        assert info.jurisdiction == "Delaware"

    @pytest.mark.asyncio
    async def test_get_tax_rates(self, integration_service):
        """Test getting tax rates"""
        rates = await integration_service.get_tax_rates(
            jurisdiction="Delaware",
            tax_types=["corporate", "sales"]
        )
        
        assert isinstance(rates, dict)
        assert all(tax in rates for tax in ["corporate", "sales"])

    @pytest.mark.asyncio
    async def test_get_regulatory_requirements(self, integration_service):
        """Test getting regulatory requirements"""
        requirements = await integration_service.get_regulatory_requirements(
            jurisdiction="California",
            business_type="technology"
        )
        
        assert isinstance(requirements, list)
        assert all("requirement_id" in req for req in requirements)

    @pytest.mark.asyncio
    async def test_compare_jurisdictions(self, integration_service):
        """Test comparing jurisdictions"""
        comparison = await integration_service.compare_jurisdictions(
            jurisdictions=["Delaware", "Nevada"],
            factors=["tax_rate", "filing_fees", "privacy_laws"]
        )
        
        assert isinstance(comparison, dict)
        assert all(j in comparison for j in ["Delaware", "Nevada"])

    @pytest.mark.asyncio
    async def test_get_geographic_restrictions(self, integration_service):
        """Test getting geographic restrictions"""
        restrictions = await integration_service.get_restrictions(
            activity="data_processing",
            jurisdictions=["EU", "California"]
        )
        
        assert isinstance(restrictions, list)
        assert all("restriction_type" in r for r in restrictions)


class TestCurrencyConversion:
    """Test currency conversion integration"""

    @pytest.mark.asyncio
    async def test_get_exchange_rates(self, integration_service):
        """Test getting exchange rates"""
        rates = await integration_service.get_exchange_rates(
            base_currency="USD",
            target_currencies=["EUR", "GBP", "JPY"]
        )
        
        assert isinstance(rates, dict)
        assert all(curr in rates for curr in ["EUR", "GBP", "JPY"])

    @pytest.mark.asyncio
    async def test_convert_currency(self, integration_service):
        """Test currency conversion"""
        result = await integration_service.convert_currency(
            amount=1000,
            from_currency="USD",
            to_currency="EUR",
            date=datetime(2024, 1, 1)
        )
        
        assert isinstance(result, CurrencyRate)
        assert result.from_currency == "USD"
        assert result.to_currency == "EUR"

    @pytest.mark.asyncio
    async def test_get_historical_rates(self, integration_service):
        """Test getting historical rates"""
        rates = await integration_service.get_historical_rates(
            currency_pair="USD/EUR",
            start_date=datetime(2023, 1, 1),
            end_date=datetime(2024, 1, 1)
        )
        
        assert isinstance(rates, list)
        assert all(isinstance(r, CurrencyRate) for r in rates)

    @pytest.mark.asyncio
    async def test_calculate_forex_exposure(self, integration_service):
        """Test calculating forex exposure"""
        exposure = await integration_service.calculate_forex_exposure(
            positions={"EUR": 100000, "GBP": 50000},
            base_currency="USD"
        )
        
        assert isinstance(exposure, dict)
        assert "total_exposure" in exposure

    @pytest.mark.asyncio
    async def test_get_currency_volatility(self, integration_service):
        """Test getting currency volatility"""
        volatility = await integration_service.get_currency_volatility(
            currency_pair="USD/EUR",
            period="30d"
        )
        
        assert isinstance(volatility, float)
        assert volatility >= 0


class TestDataCachingAndFreshness:
    """Test data caching and freshness"""

    @pytest.mark.asyncio
    async def test_cache_data_response(self, integration_service):
        """Test caching data responses"""
        request = DataRequest(
            request_type="company_info",
            identifier="ABC123"
        )
        
        response = DataResponse(
            request_id=request.request_id,
            data={"name": "Test Company"},
            source="SEC",
            timestamp=datetime.utcnow()
        )
        
        cached = await integration_service.cache_response(request, response)
        
        assert cached
        assert request.request_id in integration_service.cache

    @pytest.mark.asyncio
    async def test_retrieve_cached_data(self, integration_service):
        """Test retrieving cached data"""
        request = DataRequest(
            request_type="company_info",
            identifier="ABC123"
        )
        
        # Cache some data first
        response = DataResponse(
            request_id=request.request_id,
            data={"name": "Test Company"},
            source="SEC",
            timestamp=datetime.utcnow()
        )
        await integration_service.cache_response(request, response)
        
        # Retrieve from cache
        cached_response = await integration_service.get_cached_response(request)
        
        assert cached_response is not None
        assert cached_response.data["name"] == "Test Company"

    @pytest.mark.asyncio
    async def test_check_data_freshness(self, integration_service):
        """Test checking data freshness"""
        timestamp = datetime.utcnow() - timedelta(hours=2)
        
        freshness = await integration_service.check_freshness(
            timestamp=timestamp,
            max_age_hours=1
        )
        
        assert freshness == DataFreshness.STALE

    @pytest.mark.asyncio
    async def test_invalidate_cache(self, integration_service):
        """Test cache invalidation"""
        request = DataRequest(
            request_type="company_info",
            identifier="ABC123"
        )
        
        # Cache and then invalidate
        response = DataResponse(
            request_id=request.request_id,
            data={"name": "Test Company"},
            source="SEC",
            timestamp=datetime.utcnow()
        )
        await integration_service.cache_response(request, response)
        
        invalidated = await integration_service.invalidate_cache(request.request_id)
        
        assert invalidated
        assert request.request_id not in integration_service.cache

    @pytest.mark.asyncio
    async def test_cache_strategy_application(self, integration_service):
        """Test applying cache strategies"""
        strategy = CacheStrategy.TIME_BASED
        ttl = 3600  # 1 hour
        
        configured = await integration_service.configure_cache_strategy(
            strategy=strategy,
            ttl_seconds=ttl
        )
        
        assert configured
        assert integration_service.cache_strategy == strategy


class TestDataEnrichmentAndQuality:
    """Test data enrichment and quality"""

    @pytest.mark.asyncio
    async def test_enrich_entity_data(self, integration_service):
        """Test enriching entity data"""
        entity = {
            "id": "ABC123",
            "name": "Acme Corp",
            "type": "company"
        }
        
        enriched = await integration_service.enrich_entity(
            entity=entity,
            sources=["company_registry", "news", "credit_rating"]
        )
        
        assert isinstance(enriched, DataEnrichmentResult)
        assert enriched.entity_id == "ABC123"
        assert len(enriched.enrichments) > 0

    @pytest.mark.asyncio
    async def test_validate_data_quality(self, integration_service):
        """Test data quality validation"""
        data = {
            "company_name": "Acme Corp",
            "registration_number": "12345678",
            "jurisdiction": "Delaware"
        }
        
        quality = await integration_service.validate_quality(data)
        
        assert isinstance(quality, DataQuality)
        assert quality.score >= 0 and quality.score <= 1

    @pytest.mark.asyncio
    async def test_cross_reference_data(self, integration_service):
        """Test cross-referencing data sources"""
        entity_id = "ABC123"
        
        cross_ref = await integration_service.cross_reference(
            entity_id=entity_id,
            sources=["SEC", "company_registry", "news"]
        )
        
        assert isinstance(cross_ref, dict)
        assert "consistency_score" in cross_ref

    @pytest.mark.asyncio
    async def test_merge_data_sources(self, integration_service):
        """Test merging data from multiple sources"""
        data_sources = [
            {"source": "SEC", "data": {"revenue": 1000000}},
            {"source": "news", "data": {"recent_news": ["merger announced"]}}
        ]
        
        merged = await integration_service.merge_data(data_sources)
        
        assert isinstance(merged, dict)
        assert "revenue" in merged
        assert "recent_news" in merged

    @pytest.mark.asyncio
    async def test_detect_data_anomalies(self, integration_service):
        """Test detecting data anomalies"""
        data = {
            "revenue": -1000000,  # Anomaly: negative revenue
            "employees": 0,  # Anomaly: no employees
            "founded": "2025"  # Anomaly: future date
        }
        
        anomalies = await integration_service.detect_anomalies(data)
        
        assert isinstance(anomalies, list)
        assert len(anomalies) >= 3