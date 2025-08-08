"""
Tests for Template Output Service with multi-language support, format preservation, and output generation.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime
import json
import tempfile
from pathlib import Path
from io import BytesIO

from app.services.template_output import (
    TemplateOutputService,
    OutputFormat,
    LanguageCode,
    FormatPreservationOptions,
    OutputGenerationOptions,
    TranslationProvider
)
from app.schemas.template import RenderContext


class TestTemplateOutputService:
    """Test cases for Template Output Service."""
    
    @pytest.fixture
    def service(self):
        """Create service instance."""
        return TemplateOutputService()
    
    @pytest.fixture
    def sample_template(self):
        """Sample template content."""
        return """
        CONTRACT AGREEMENT
        
        This agreement is entered into on {{date}} between {{party1}} and {{party2}}.
        
        {% if include_payment %}
        Payment Terms:
        - Amount: {{currency}} {{amount}}
        - Due Date: {{payment_due_date}}
        {% endif %}
        
        {% for clause in clauses %}
        {{loop.index}}. {{clause.title}}
        {{clause.content}}
        {% endfor %}
        
        Signed:
        {{party1_signature}}
        {{party2_signature}}
        """
    
    @pytest.fixture
    def render_context(self):
        """Sample render context."""
        return RenderContext(
            variables={
                'date': '2024-01-15',
                'party1': 'Acme Corporation',
                'party2': 'Beta Industries',
                'currency': 'USD',
                'amount': 150000,
                'payment_due_date': '2024-02-15',
                'include_payment': True,
                'clauses': [
                    {'title': 'Scope of Work', 'content': 'Provide consulting services'},
                    {'title': 'Confidentiality', 'content': 'Maintain strict confidentiality'}
                ],
                'party1_signature': 'John Doe',
                'party2_signature': 'Jane Smith'
            }
        )
    
    @pytest.mark.asyncio
    async def test_multi_language_support(self, service, sample_template, render_context):
        """Test multi-language template rendering."""
        # Test English (default)
        result = await service.render_with_language(
            template_content=sample_template,
            context=render_context,
            language=LanguageCode.EN
        )
        assert 'CONTRACT AGREEMENT' in result
        assert 'This agreement is entered into' in result
        
        # Test Spanish translation
        result_es = await service.render_with_language(
            template_content=sample_template,
            context=render_context,
            language=LanguageCode.ES
        )
        assert 'ACUERDO DE CONTRATO' in result_es
        assert 'Este acuerdo se celebra' in result_es
        
        # Test French translation
        result_fr = await service.render_with_language(
            template_content=sample_template,
            context=render_context,
            language=LanguageCode.FR
        )
        assert 'ACCORD CONTRACTUEL' in result_fr
        assert 'Cet accord est conclu' in result_fr
    
    @pytest.mark.asyncio
    async def test_translation_with_placeholders(self, service, render_context):
        """Test that placeholders are preserved during translation."""
        template = "The amount of {{amount}} {{currency}} is due on {{date}}."
        
        result = await service.render_with_language(
            template_content=template,
            context=render_context,
            language=LanguageCode.ES
        )
        
        assert '150000' in result
        assert 'USD' in result
        assert '2024-01-15' in result
    
    @pytest.mark.asyncio
    async def test_format_preservation_bold_italic(self, service, render_context):
        """Test preservation of bold and italic formatting."""
        template = "This is **bold text** and this is *italic text*."
        
        options = FormatPreservationOptions(
            preserve_bold=True,
            preserve_italic=True,
            preserve_underline=False,
            preserve_lists=True,
            preserve_tables=True,
            preserve_headings=True
        )
        
        result = await service.render_with_format_preservation(
            template_content=template,
            context=render_context,
            options=options
        )
        
        assert result.has_formatting
        assert '**bold text**' in result.markdown
        assert '*italic text*' in result.markdown
    
    @pytest.mark.asyncio
    async def test_format_preservation_lists(self, service, render_context):
        """Test preservation of list formatting."""
        template = """
        Items:
        - First item
        - Second item
        - Third item
        
        1. Numbered first
        2. Numbered second
        3. Numbered third
        """
        
        options = FormatPreservationOptions(preserve_lists=True)
        result = await service.render_with_format_preservation(
            template_content=template,
            context=render_context,
            options=options
        )
        
        assert '- First item' in result.markdown
        assert '1. Numbered first' in result.markdown
    
    @pytest.mark.asyncio
    async def test_format_preservation_tables(self, service, render_context):
        """Test preservation of table formatting."""
        template = """
        | Column 1 | Column 2 | Column 3 |
        |----------|----------|----------|
        | Data 1   | Data 2   | Data 3   |
        | {{party1}} | {{amount}} | {{date}} |
        """
        
        options = FormatPreservationOptions(preserve_tables=True)
        result = await service.render_with_format_preservation(
            template_content=template,
            context=render_context,
            options=options
        )
        
        assert '| Column 1 | Column 2 | Column 3 |' in result.markdown
        assert 'Acme Corporation' in result.markdown
        assert '150000' in result.markdown
    
    @pytest.mark.asyncio
    async def test_format_preservation_headings(self, service, render_context):
        """Test preservation of heading levels."""
        template = """
        # Main Heading
        ## Sub Heading
        ### Sub Sub Heading
        #### Level 4 Heading
        """
        
        options = FormatPreservationOptions(preserve_headings=True)
        result = await service.render_with_format_preservation(
            template_content=template,
            context=render_context,
            options=options
        )
        
        assert '# Main Heading' in result.markdown
        assert '## Sub Heading' in result.markdown
        assert '### Sub Sub Heading' in result.markdown
    
    @pytest.mark.asyncio
    async def test_generate_pdf_output(self, service, sample_template, render_context):
        """Test PDF generation from template."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            include_watermark=False,
            include_page_numbers=True,
            include_header_footer=True,
            header_text="Contract Agreement",
            footer_text="Confidential",
            font_size=12,
            font_family="Arial",
            margins={'top': 20, 'bottom': 20, 'left': 15, 'right': 15}
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.content is not None
        assert len(result.content) > 0
        assert result.mime_type == 'application/pdf'
        assert result.file_extension == '.pdf'
    
    @pytest.mark.asyncio
    async def test_generate_docx_output(self, service, sample_template, render_context):
        """Test DOCX generation from template."""
        options = OutputGenerationOptions(
            format=OutputFormat.DOCX,
            include_toc=True,
            include_page_numbers=True,
            styles={
                'heading1': {'bold': True, 'size': 16},
                'heading2': {'bold': True, 'size': 14},
                'normal': {'size': 11}
            }
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.DOCX
        assert result.content is not None
        assert result.mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        assert result.file_extension == '.docx'
    
    @pytest.mark.asyncio
    async def test_generate_html_output(self, service, sample_template, render_context):
        """Test HTML generation from template."""
        options = OutputGenerationOptions(
            format=OutputFormat.HTML,
            include_css=True,
            css_styles="""
                body { font-family: Arial, sans-serif; }
                h1 { color: #333; }
                .contract { margin: 20px; }
            """
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.HTML
        assert b'<html>' in result.content
        assert b'<style>' in result.content
        assert result.mime_type == 'text/html'
    
    @pytest.mark.asyncio
    async def test_generate_markdown_output(self, service, sample_template, render_context):
        """Test Markdown generation from template."""
        options = OutputGenerationOptions(format=OutputFormat.MARKDOWN)
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.MARKDOWN
        assert b'CONTRACT AGREEMENT' in result.content
        assert result.mime_type == 'text/markdown'
        assert result.file_extension == '.md'
    
    @pytest.mark.asyncio
    async def test_pdf_with_watermark(self, service, sample_template, render_context):
        """Test PDF generation with watermark."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            include_watermark=True,
            watermark_text="DRAFT",
            watermark_opacity=0.3
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('has_watermark') is True
    
    @pytest.mark.asyncio
    async def test_pdf_with_digital_signature_placeholder(self, service, sample_template, render_context):
        """Test PDF generation with digital signature placeholder."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            include_signature_fields=True,
            signature_fields=['party1_signature', 'party2_signature']
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('signature_fields_count') == 2
    
    @pytest.mark.asyncio
    async def test_docx_with_track_changes(self, service, sample_template, render_context):
        """Test DOCX generation with track changes enabled."""
        options = OutputGenerationOptions(
            format=OutputFormat.DOCX,
            enable_track_changes=True,
            author="Legal Team"
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.DOCX
        assert result.metadata.get('track_changes_enabled') is True
    
    @pytest.mark.asyncio
    async def test_multi_language_pdf_generation(self, service, sample_template, render_context):
        """Test PDF generation in multiple languages."""
        # Generate PDF in Spanish
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            language=LanguageCode.ES
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('language') == 'es'
    
    @pytest.mark.asyncio
    async def test_batch_output_generation(self, service, sample_template, render_context):
        """Test batch generation of multiple output formats."""
        formats = [OutputFormat.PDF, OutputFormat.DOCX, OutputFormat.HTML]
        
        results = await service.generate_batch_outputs(
            template_content=sample_template,
            context=render_context,
            formats=formats
        )
        
        assert len(results) == 3
        assert results[0].format == OutputFormat.PDF
        assert results[1].format == OutputFormat.DOCX
        assert results[2].format == OutputFormat.HTML
    
    @pytest.mark.asyncio
    async def test_template_with_images(self, service, render_context):
        """Test template rendering with embedded images."""
        template = """
        # Contract with Logo
        ![Company Logo]({{logo_url}})
        
        Agreement between {{party1}} and {{party2}}
        """
        
        render_context.variables['logo_url'] = 'https://example.com/logo.png'
        
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            embed_images=True
        )
        
        result = await service.generate_output(
            template_content=template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('has_images') is True
    
    @pytest.mark.asyncio
    async def test_template_with_qr_code(self, service, sample_template, render_context):
        """Test template with QR code generation."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            include_qr_code=True,
            qr_code_data="https://verify.example.com/contract/123"
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('has_qr_code') is True
    
    @pytest.mark.asyncio
    async def test_accessibility_features(self, service, sample_template, render_context):
        """Test PDF generation with accessibility features."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            accessibility_features={
                'tagged_pdf': True,
                'alt_text': True,
                'reading_order': True,
                'language_specification': True
            }
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('is_accessible') is True
    
    @pytest.mark.asyncio
    async def test_custom_fonts_embedding(self, service, sample_template, render_context):
        """Test custom font embedding in PDF."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            embed_fonts=True,
            custom_fonts=['TimesNewRoman', 'Helvetica']
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('embedded_fonts') == ['TimesNewRoman', 'Helvetica']
    
    @pytest.mark.asyncio
    async def test_encryption_and_permissions(self, service, sample_template, render_context):
        """Test PDF encryption and permission settings."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            encrypt=True,
            user_password="user123",
            owner_password="owner456",
            permissions={
                'print': True,
                'modify': False,
                'copy': False,
                'annotate': True
            }
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('is_encrypted') is True
        assert result.metadata.get('permissions') == options.permissions
    
    @pytest.mark.asyncio
    async def test_output_compression(self, service, sample_template, render_context):
        """Test output compression for size optimization."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            compress=True,
            compression_level=9
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.format == OutputFormat.PDF
        assert result.metadata.get('is_compressed') is True
        assert result.size_bytes < 100000  # Should be reasonably small
    
    @pytest.mark.asyncio
    async def test_error_handling_invalid_template(self, service, render_context):
        """Test error handling for invalid template syntax."""
        invalid_template = "{% if unclosed"
        
        with pytest.raises(ValueError, match="Invalid template syntax"):
            await service.generate_output(
                template_content=invalid_template,
                context=render_context,
                options=OutputGenerationOptions(format=OutputFormat.PDF)
            )
    
    @pytest.mark.asyncio
    async def test_error_handling_missing_variables(self, service):
        """Test error handling for missing required variables."""
        template = "Required: {{required_var}}"
        context = RenderContext(variables={})
        
        with pytest.raises(ValueError, match="Missing required variable"):
            await service.generate_output(
                template_content=template,
                context=context,
                options=OutputGenerationOptions(format=OutputFormat.PDF)
            )
    
    @pytest.mark.asyncio
    async def test_caching_rendered_templates(self, service, sample_template, render_context):
        """Test caching of rendered templates for performance."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            enable_cache=True
        )
        
        # First generation
        result1 = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        # Second generation (should use cache)
        result2 = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result1.cache_key == result2.cache_key
        assert result2.metadata.get('from_cache') is True
    
    @pytest.mark.asyncio
    async def test_template_validation_before_output(self, service, render_context):
        """Test template validation before output generation."""
        template = "{{var1}} and {{var2}}"
        render_context.variables = {'var1': 'value1'}  # Missing var2
        
        validation_result = await service.validate_template(
            template_content=template,
            context=render_context
        )
        
        assert validation_result.is_valid is False
        assert 'var2' in validation_result.missing_variables
    
    @pytest.mark.asyncio
    async def test_metadata_extraction(self, service, sample_template, render_context):
        """Test metadata extraction from generated output."""
        options = OutputGenerationOptions(
            format=OutputFormat.PDF,
            extract_metadata=True
        )
        
        result = await service.generate_output(
            template_content=sample_template,
            context=render_context,
            options=options
        )
        
        assert result.metadata.get('page_count') > 0
        assert result.metadata.get('word_count') > 0
        assert result.metadata.get('creation_date') is not None
        assert result.metadata.get('modification_date') is not None