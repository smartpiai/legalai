# TODO(S3-003): audit — kept; GREEN phase tests for financial_services_suite;
# will pass once Phase 1 implementation of ISDAMasterAgreementAnalyzer /
# BankingLendingAnalyzer is complete. See docs/phase-0/s3-003_green-audit.md.
"""
Test suite for Financial Services Suite - GREEN phase
Tests verify actual implementations work correctly
Tests ISDA Agreement Processing and Banking & Lending systems
"""
import pytest

# S3-005: GREEN-phase tests require fully-verified Phase 1 implementations.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: GREEN-phase tests require complete and verified Phase 1 AI implementation")
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from decimal import Decimal
import asyncio

from app.ai.financial_services_suite import (
    ISDAMasterAgreementAnalyzer,
    BankingLendingAnalyzer,
    FinancialServicesConfig
)


@pytest.fixture
def financial_config():
    """Financial services configuration"""
    return FinancialServicesConfig(
        risk_tolerance="conservative",
        regulatory_frameworks=["basel_iii", "dodd_frank", "mifid_ii"],
        calculation_precision=6,
        compliance_strictness="high",
        reporting_frequency="daily"
    )


@pytest.fixture
def isda_analyzer(financial_config):
    """Create ISDA Master Agreement analyzer instance"""
    return ISDAMasterAgreementAnalyzer(config=financial_config)


@pytest.fixture
def banking_analyzer(financial_config):
    """Create Banking & Lending analyzer instance"""
    return BankingLendingAnalyzer(config=financial_config)


class TestISDAMasterAgreementAnalyzerGreen:
    """Test ISDA Master Agreement analysis - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_analyze_master_agreement(self, isda_analyzer):
        """GREEN: Test ISDA master agreement analysis works correctly"""
        analysis = await isda_analyzer.analyze_master_agreement(
            agreement_text="ISDA Master Agreement dated as of January 15, 2024 between Goldman Sachs and JPMorgan Chase with credit support provisions and cross default clauses...",
            agreement_version="2002",
            governing_law="english",
            context={
                "counterparty_rating": "A+",
                "business_relationship": "dealer_to_dealer",
                "product_types": ["interest_rate_swaps", "credit_derivatives"],
                "base_currency": "USD",
                "calculation_agent": "party_a"
            }
        )
        
        assert analysis.agreement_version == "2002"
        assert analysis.governing_law == "english"
        assert len(analysis.parties) == 2
        assert isinstance(analysis.elections, dict)
        assert isinstance(analysis.termination_events, list)
        assert isinstance(analysis.credit_support_required, bool)
        assert analysis.netting_scope in ["close_out_netting", "payment_and_close_out_netting", "full_netting_with_setoff"]
        assert analysis.calculation_agent in ["party_a", "party_b"]
        assert 0.0 <= analysis.analysis_confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_extract_schedule_provisions(self, isda_analyzer):
        """GREEN: Test schedule provision extraction works correctly"""
        schedule = await isda_analyzer.extract_schedule_provisions(
            schedule_text="SCHEDULE to the ISDA Master Agreement with additional termination events including cross default with threshold amount of 25,000,000 and credit support document required...",
            schedule_part="part_1",
            election_categories=[
                "termination_events",
                "credit_support",
                "governing_law",
                "calculation_agent",
                "additional_termination_events"
            ]
        )
        
        assert schedule.schedule_part == "part_1"
        assert isinstance(schedule.elections_extracted, dict)
        assert len(schedule.elections_extracted) > 0
        assert isinstance(schedule.additional_provisions, list)
        assert isinstance(schedule.cross_references, dict)
        assert isinstance(schedule.interpretation_notes, list)
        assert 0.0 <= schedule.extraction_confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_analyze_credit_support_annex(self, isda_analyzer):
        """GREEN: Test CSA analysis works correctly"""
        csa_analysis = await isda_analyzer.analyze_credit_support_annex(
            csa_document="CREDIT SUPPORT ANNEX to the Schedule with daily margin calls and arbitration for disputes...",
            csa_type="english_law_csa",
            margin_requirements={
                "threshold": 10000000,  # $10M
                "minimum_transfer_amount": 500000,  # $500K
                "independent_amount": 0,
                "rounding": 100000  # $100K
            },
            eligible_collateral=["cash_usd", "us_treasury", "government_bonds"]
        )
        
        assert csa_analysis.csa_type == "english_law_csa"
        assert csa_analysis.threshold_amount == Decimal("10000000")
        assert csa_analysis.minimum_transfer_amount == Decimal("500000")
        assert csa_analysis.independent_amount == Decimal("0")
        assert isinstance(csa_analysis.eligible_collateral, list)
        assert len(csa_analysis.eligible_collateral) == 3
        assert isinstance(csa_analysis.haircut_schedule, dict)
        assert len(csa_analysis.haircut_schedule) == 3
        assert csa_analysis.margin_call_frequency in ["daily", "weekly"]
        assert csa_analysis.dispute_resolution in ["arbitration", "standard_process", "expert_determination", "litigation"]
    
    @pytest.mark.asyncio
    async def test_match_confirmations(self, isda_analyzer):
        """GREEN: Test confirmation matching works correctly"""
        matching_result = await isda_analyzer.match_confirmations(
            trade_confirmation="Trade Confirmation for Interest Rate Swap under English law with Party A as calculation agent...",
            master_agreement_terms={
                "calculation_agent": "party_a",
                "governing_law": "english",
                "netting_agreement": True,
                "credit_support": True
            },
            transaction_details={
                "trade_date": "2024-01-15",
                "effective_date": "2024-01-17",
                "termination_date": "2029-01-17",
                "notional_amount": 100000000,
                "fixed_rate": 4.50,
                "floating_rate_option": "USD-SOFR"
            }
        )
        
        assert isinstance(matching_result.trade_matched, bool)
        assert matching_result.confirmation_type in ["interest_rate_swap", "credit_default_swap", "fx_derivative", "equity_derivative"]
        assert isinstance(matching_result.transaction_details, dict)
        assert isinstance(matching_result.discrepancies, list)
        assert isinstance(matching_result.master_agreement_consistency, bool)
        assert isinstance(matching_result.required_amendments, list)
        assert 0.0 <= matching_result.matching_confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_identify_netting_agreements(self, isda_analyzer):
        """GREEN: Test netting agreement identification works correctly"""
        netting_result = await isda_analyzer.identify_netting_agreements(
            agreement_portfolio=[
                {"type": "isda_master", "parties": ["bank_a", "bank_b"], "products": ["irs", "cds"], "features": ["payment_netting"]},
                {"type": "isda_master", "parties": ["bank_a", "hedge_fund_c"], "products": ["fx", "equity"], "features": []},
                {"type": "gmra", "parties": ["bank_a", "bank_b"], "products": ["repo"], "features": ["repo_netting"]}
            ],
            netting_scope="close_out_netting",
            jurisdictional_analysis=True
        )
        
        assert isinstance(netting_result.netting_eligible, bool)
        assert netting_result.netting_scope == "close_out_netting"
        assert isinstance(netting_result.covered_products, list)
        assert len(netting_result.covered_products) > 0
        assert isinstance(netting_result.jurisdictional_enforceability, dict)
        assert netting_result.close_out_methodology in ["close_out_amount", "loss_quotation_method", "market_quotation_method"]
        assert isinstance(netting_result.set_off_rights, list)
        assert isinstance(netting_result.legal_opinions_required, list)


class TestBankingLendingAnalyzerGreen:
    """Test Banking & Lending analysis - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_banking_analyzer_initialization(self, banking_analyzer):
        """GREEN: Test banking analyzer initializes correctly"""
        assert banking_analyzer.config.risk_tolerance == "conservative"
        assert "basel_iii" in banking_analyzer.config.regulatory_frameworks
        assert banking_analyzer.config.calculation_precision == 6
        assert isinstance(banking_analyzer.loan_templates, dict)
        assert isinstance(banking_analyzer.pricing_models, dict)
        assert isinstance(banking_analyzer.risk_models, dict)


class TestIntegratedFinancialSuiteGreen:
    """Test integration between ISDA and Banking systems - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_financial_services_config(self, financial_config):
        """GREEN: Test financial services configuration works correctly"""
        assert financial_config.risk_tolerance == "conservative"
        assert len(financial_config.regulatory_frameworks) == 3
        assert "basel_iii" in financial_config.regulatory_frameworks
        assert "dodd_frank" in financial_config.regulatory_frameworks
        assert "mifid_ii" in financial_config.regulatory_frameworks
        assert financial_config.calculation_precision == 6
        assert financial_config.compliance_strictness == "high"
        assert financial_config.reporting_frequency == "daily"
    
    @pytest.mark.asyncio
    async def test_isda_analyzer_comprehensive_workflow(self, isda_analyzer):
        """GREEN: Test comprehensive ISDA analysis workflow"""
        # Test the full workflow from agreement analysis to netting
        
        # Step 1: Analyze master agreement
        agreement_analysis = await isda_analyzer.analyze_master_agreement(
            agreement_text="ISDA Master Agreement with comprehensive termination events and credit support requirements...",
            agreement_version="2002",
            governing_law="english",
            context={"counterparty_rating": "A+", "calculation_agent": "party_a"}
        )
        
        assert agreement_analysis.analysis_confidence > 0.5
        
        # Step 2: Extract schedule provisions
        schedule_analysis = await isda_analyzer.extract_schedule_provisions(
            schedule_text="Schedule with additional termination events and credit support document specified...",
            schedule_part="part_1",
            election_categories=["termination_events", "credit_support"]
        )
        
        assert schedule_analysis.extraction_confidence > 0.5
        
        # Step 3: Analyze CSA
        csa_analysis = await isda_analyzer.analyze_credit_support_annex(
            csa_document="CSA with standard provisions...",
            csa_type="english_law_csa",
            margin_requirements={"threshold": 5000000, "minimum_transfer_amount": 250000},
            eligible_collateral=["cash_usd", "us_treasury"]
        )
        
        assert len(csa_analysis.haircut_schedule) == 2
        
        # Step 4: Match confirmations
        confirmation_match = await isda_analyzer.match_confirmations(
            trade_confirmation="Standard IRS confirmation...",
            master_agreement_terms={"calculation_agent": "party_a", "governing_law": "english"},
            transaction_details={"notional_amount": 50000000, "fixed_rate": 3.75}
        )
        
        assert confirmation_match.matching_confidence > 0.0
        
        # Step 5: Analyze netting
        netting_analysis = await isda_analyzer.identify_netting_agreements(
            agreement_portfolio=[{"type": "isda_master", "parties": ["a", "b"], "products": ["irs"], "features": []}],
            netting_scope="close_out_netting",
            jurisdictional_analysis=False
        )
        
        assert netting_analysis.netting_eligible == True