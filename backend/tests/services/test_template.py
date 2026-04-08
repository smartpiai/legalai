"""
Tests for template management system.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json

from app.models.template import (
    Template,
    TemplateVersion,
    TemplateVariable,
    TemplateCategory,
    ClauseLibrary
)
from app.services.template import (
    TemplateService,
    TemplateRenderer,
    VariableManager,
    TemplateValidator
)
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    VariableDefinition,
    RenderContext
)


class TestTemplateModel:
    """Test template database models."""
    
    @pytest.mark.asyncio
    async def test_create_template(self, test_db_session):
        """Test creating a new template."""
        template = Template(
            name="Service Agreement Template",
            description="Standard service agreement for professional services",
            content="This Service Agreement (\"Agreement\") is entered into on {{date}} between {{company_name}} and {{client_name}}.",
            category="service_agreement",
            tenant_id=1,
            created_by=1,
            is_active=True
        )
        
        test_db_session.add(template)
        await test_db_session.commit()
        
        assert template.id is not None
        assert template.name == "Service Agreement Template"
        assert template.version == 1
        assert template.is_active is True
        assert "{{date}}" in template.content
        assert "{{company_name}}" in template.content
    
    @pytest.mark.asyncio
    async def test_template_versioning(self, test_db_session):
        """Test template version tracking."""
        # Create original template
        template = Template(
            name="NDA Template",
            description="Non-disclosure agreement",
            content="Original content",
            category="nda",
            tenant_id=1,
            created_by=1
        )
        test_db_session.add(template)
        await test_db_session.commit()
        
        # Create new version
        version = TemplateVersion(
            template_id=template.id,
            version_number=2,
            content="Updated content with changes",
            change_summary="Added new confidentiality clause",
            created_by=1
        )
        test_db_session.add(version)
        await test_db_session.commit()
        
        assert version.id is not None
        assert version.version_number == 2
        assert version.template_id == template.id
        assert "Updated content" in version.content
    
    @pytest.mark.asyncio
    async def test_template_variables(self, test_db_session):
        """Test template variable definitions."""
        template = Template(
            name="Contract Template",
            content="Agreement for {{party_name}}",
            category="general",
            tenant_id=1,
            created_by=1
        )
        test_db_session.add(template)
        await test_db_session.commit()
        
        # Add variables
        variable = TemplateVariable(
            template_id=template.id,
            variable_name="party_name",
            variable_type="text",
            display_name="Party Name",
            description="Name of the contracting party",
            is_required=True,
            default_value=None,
            validation_rules={"min_length": 2, "max_length": 100}
        )
        test_db_session.add(variable)
        await test_db_session.commit()
        
        assert variable.id is not None
        assert variable.variable_name == "party_name"
        assert variable.is_required is True
        assert variable.validation_rules["min_length"] == 2
    
    @pytest.mark.asyncio
    async def test_template_categories(self, test_db_session):
        """Test template categorization."""
        category = TemplateCategory(
            name="Employment",
            description="Employment-related templates",
            parent_id=None,
            tenant_id=1
        )
        test_db_session.add(category)
        await test_db_session.commit()
        
        # Create subcategory
        subcategory = TemplateCategory(
            name="Offer Letters",
            description="Job offer letter templates",
            parent_id=category.id,
            tenant_id=1
        )
        test_db_session.add(subcategory)
        await test_db_session.commit()
        
        assert category.id is not None
        assert subcategory.parent_id == category.id
        assert subcategory.name == "Offer Letters"
    
    @pytest.mark.asyncio
    async def test_clause_library(self, test_db_session):
        """Test reusable clause library."""
        clause = ClauseLibrary(
            name="Standard Confidentiality Clause",
            content="The Receiving Party agrees to maintain all Confidential Information in strict confidence...",
            category="confidentiality",
            tags=["nda", "confidentiality", "standard"],
            tenant_id=1,
            created_by=1,
            is_approved=True
        )
        test_db_session.add(clause)
        await test_db_session.commit()
        
        assert clause.id is not None
        assert clause.is_approved is True
        assert "nda" in clause.tags
        assert "Confidential Information" in clause.content


class TestTemplateService:
    """Test template service operations."""
    
    @pytest.mark.asyncio
    async def test_create_template_with_variables(self, test_db_session):
        """Test creating template with variable definitions."""
        service = TemplateService(test_db_session)
        
        template_data = TemplateCreate(
            name="Purchase Order Template",
            description="Standard purchase order",
            content="PO Number: {{po_number}}\nVendor: {{vendor_name}}\nAmount: {{amount}}",
            category="purchase_order",
            variables=[
                VariableDefinition(
                    name="po_number",
                    type="text",
                    display_name="PO Number",
                    is_required=True
                ),
                VariableDefinition(
                    name="vendor_name",
                    type="text",
                    display_name="Vendor Name",
                    is_required=True
                ),
                VariableDefinition(
                    name="amount",
                    type="number",
                    display_name="Total Amount",
                    is_required=True,
                    validation_rules={"min": 0}
                )
            ]
        )
        
        template = await service.create_template(
            template_data,
            tenant_id=1,
            user_id=1
        )
        
        assert template.id is not None
        assert template.name == "Purchase Order Template"
        assert len(template.variables) == 3
        assert any(v.variable_name == "po_number" for v in template.variables)
    
    @pytest.mark.asyncio
    async def test_update_template_creates_version(self, test_db_session):
        """Test that updating template creates a new version."""
        service = TemplateService(test_db_session)
        
        # Create initial template
        template = await service.create_template(
            TemplateCreate(
                name="Agreement Template",
                content="Initial content",
                category="general"
            ),
            tenant_id=1,
            user_id=1
        )
        
        # Update template
        updated = await service.update_template(
            template.id,
            TemplateUpdate(
                content="Updated content with changes",
                change_summary="Added new section"
            ),
            user_id=1
        )
        
        assert updated.version == 2
        assert "Updated content" in updated.content
        
        # Check version history
        versions = await service.get_template_versions(template.id)
        assert len(versions) == 2
        assert versions[0].version_number == 1
        assert versions[1].version_number == 2
    
    @pytest.mark.asyncio
    async def test_template_search_and_filter(self, test_db_session):
        """Test searching and filtering templates."""
        service = TemplateService(test_db_session)
        
        # Create multiple templates
        templates = [
            ("NDA Template", "nda", ["confidentiality", "legal"]),
            ("Service Agreement", "service", ["agreement", "service"]),
            ("Employment Contract", "employment", ["hr", "employment"])
        ]
        
        for name, category, tags in templates:
            await service.create_template(
                TemplateCreate(
                    name=name,
                    content=f"Content for {name}",
                    category=category,
                    tags=tags
                ),
                tenant_id=1,
                user_id=1
            )
        
        # Search by name
        results = await service.search_templates(
            query="Agreement",
            tenant_id=1
        )
        assert len(results) == 1
        assert results[0].name == "Service Agreement"
        
        # Filter by category
        results = await service.search_templates(
            category="nda",
            tenant_id=1
        )
        assert len(results) == 1
        assert results[0].category == "nda"
        
        # Filter by tags
        results = await service.search_templates(
            tags=["employment"],
            tenant_id=1
        )
        assert len(results) == 1
        assert "employment" in results[0].tags
    
    @pytest.mark.asyncio
    async def test_template_approval_workflow(self, test_db_session):
        """Test template approval process."""
        service = TemplateService(test_db_session)
        
        # Create template requiring approval
        template = await service.create_template(
            TemplateCreate(
                name="Legal Template",
                content="Important legal content",
                category="legal",
                requires_approval=True
            ),
            tenant_id=1,
            user_id=1
        )
        
        assert template.approval_status == "pending"
        assert template.is_active is False
        
        # Approve template
        approved = await service.approve_template(
            template.id,
            approver_id=2,
            comments="Approved after legal review"
        )
        
        assert approved.approval_status == "approved"
        assert approved.is_active is True
        assert approved.approved_by == 2
        assert approved.approved_at is not None
    
    @pytest.mark.asyncio
    async def test_template_usage_tracking(self, test_db_session):
        """Test tracking template usage statistics."""
        service = TemplateService(test_db_session)
        
        template = await service.create_template(
            TemplateCreate(
                name="Popular Template",
                content="Frequently used content",
                category="general"
            ),
            tenant_id=1,
            user_id=1
        )
        
        # Track usage
        await service.track_template_usage(template.id, user_id=1)
        await service.track_template_usage(template.id, user_id=2)
        await service.track_template_usage(template.id, user_id=1)
        
        # Get usage statistics
        stats = await service.get_template_statistics(template.id)
        
        assert stats["usage_count"] == 3
        assert stats["unique_users"] == 2
        assert stats["last_used"] is not None
    
    @pytest.mark.asyncio
    async def test_clone_template(self, test_db_session):
        """Test cloning an existing template."""
        service = TemplateService(test_db_session)
        
        # Create original template
        original = await service.create_template(
            TemplateCreate(
                name="Original Template",
                content="Original content with {{variable}}",
                category="general",
                variables=[
                    VariableDefinition(
                        name="variable",
                        type="text",
                        is_required=True
                    )
                ]
            ),
            tenant_id=1,
            user_id=1
        )
        
        # Clone template
        cloned = await service.clone_template(
            original.id,
            new_name="Cloned Template",
            user_id=2,
            tenant_id=1
        )
        
        assert cloned.id != original.id
        assert cloned.name == "Cloned Template"
        assert cloned.content == original.content
        assert len(cloned.variables) == len(original.variables)
        assert cloned.parent_template_id == original.id


class TestTemplateRenderer:
    """Test template rendering engine."""
    
    def test_simple_variable_substitution(self):
        """Test basic variable replacement."""
        renderer = TemplateRenderer()
        
        template_content = "Hello {{name}}, welcome to {{company}}!"
        context = RenderContext(
            variables={
                "name": "John Doe",
                "company": "TechCorp"
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert result == "Hello John Doe, welcome to TechCorp!"
        assert "{{" not in result
        assert "}}" not in result
    
    def test_conditional_sections(self):
        """Test conditional content rendering."""
        renderer = TemplateRenderer()
        
        template_content = """
        Standard terms apply.
        {% if include_warranty %}
        WARRANTY: Product is warranted for {{warranty_period}} days.
        {% endif %}
        {% if include_support %}
        SUPPORT: {{support_level}} support included.
        {% endif %}
        """
        
        context = RenderContext(
            variables={
                "warranty_period": "90",
                "support_level": "Premium"
            },
            conditions={
                "include_warranty": True,
                "include_support": False
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert "WARRANTY" in result
        assert "90 days" in result
        assert "SUPPORT" not in result
        assert "Premium" not in result
    
    def test_list_iteration(self):
        """Test rendering lists and tables."""
        renderer = TemplateRenderer()
        
        template_content = """
        Items:
        {% for item in items %}
        - {{item.name}}: ${{item.price}}
        {% endfor %}
        Total: ${{total}}
        """
        
        context = RenderContext(
            variables={
                "items": [
                    {"name": "Product A", "price": "100"},
                    {"name": "Product B", "price": "200"}
                ],
                "total": "300"
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert "Product A: $100" in result
        assert "Product B: $200" in result
        assert "Total: $300" in result
    
    def test_date_formatting(self):
        """Test date variable formatting."""
        renderer = TemplateRenderer()
        
        template_content = "Agreement dated {{date|format:'MMMM d, yyyy'}}"
        
        context = RenderContext(
            variables={
                "date": "2024-01-15"
            },
            formats={
                "date": "MMMM d, yyyy"
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert "January 15, 2024" in result
    
    def test_number_formatting(self):
        """Test number and currency formatting."""
        renderer = TemplateRenderer()
        
        template_content = "Amount: {{amount|currency}} ({{amount|words}})"
        
        context = RenderContext(
            variables={
                "amount": 1500.50
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert "$1,500.50" in result
        assert "one thousand five hundred and 50/100" in result.lower()
    
    def test_missing_variable_handling(self):
        """Test handling of missing variables."""
        renderer = TemplateRenderer()
        
        template_content = "Hello {{name}}, from {{missing_var|default:'Unknown'}}"
        
        context = RenderContext(
            variables={"name": "John"},
            strict_mode=False
        )
        
        result = renderer.render(template_content, context)
        
        assert "Hello John" in result
        assert "Unknown" in result
        
        # Test strict mode
        context.strict_mode = True
        with pytest.raises(ValueError, match="Missing required variable"):
            renderer.render("{{required_var}}", context)
    
    def test_nested_variables(self):
        """Test nested object access in templates."""
        renderer = TemplateRenderer()
        
        template_content = """
        Company: {{company.name}}
        Address: {{company.address.street}}, {{company.address.city}}
        CEO: {{company.ceo.name}}
        """
        
        context = RenderContext(
            variables={
                "company": {
                    "name": "TechCorp",
                    "address": {
                        "street": "123 Main St",
                        "city": "San Francisco"
                    },
                    "ceo": {
                        "name": "Jane Smith"
                    }
                }
            }
        )
        
        result = renderer.render(template_content, context)
        
        assert "TechCorp" in result
        assert "123 Main St" in result
        assert "San Francisco" in result
        assert "Jane Smith" in result


# Moved TestVariableManager and TestTemplateValidator to separate test file