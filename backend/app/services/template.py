"""
Template management service for the Legal AI Platform.
Handles template CRUD, versioning, rendering, and variable management.
"""
import re
import json
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from jinja2 import Template as JinjaTemplate, Environment, meta, TemplateSyntaxError
from num2words import num2words

from app.models.template import (
    Template,
    TemplateVersion,
    TemplateVariable,
    TemplateCategory,
    ClauseLibrary,
    TemplateUsage,
    TemplateStatus as ModelTemplateStatus,
    VariableType as ModelVariableType
)
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    VariableDefinition,
    RenderContext,
    TemplateStatistics,
    TemplateVersionResponse,
    ClauseLibraryCreate,
    ClauseLibraryResponse,
    TemplateStatus,
    VariableType
)
from app.core.exceptions import EntityNotFoundError, ValidationError

logger = logging.getLogger(__name__)


class TemplateService:
    """Service for managing templates."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize template service."""
        self.db = db_session
        self.renderer = TemplateRenderer()
        self.variable_manager = VariableManager()
        self.validator = TemplateValidator()
    
    async def create_template(
        self,
        template_data: TemplateCreate,
        tenant_id: int,
        user_id: int
    ) -> Template:
        """Create a new template with variables."""
        # Validate template syntax
        syntax_errors = self.validator.validate_syntax(template_data.content)
        if syntax_errors:
            raise ValidationError(f"Template syntax errors: {'; '.join(syntax_errors)}")
        
        # Create template
        template = Template(
            tenant_id=tenant_id,
            name=template_data.name,
            description=template_data.description,
            content=template_data.content,
            category=template_data.category,
            subcategory=template_data.subcategory,
            tags=template_data.tags,
            requires_approval=template_data.requires_approval,
            config=template_data.config,
            metadata_fields=template_data.metadata_fields,
            parent_template_id=template_data.parent_template_id,
            created_by=user_id,
            version=1,
            is_latest_version=True
        )
        
        # Set initial status
        if template_data.requires_approval:
            template.approval_status = ModelTemplateStatus.PENDING
            template.is_active = False
        else:
            template.approval_status = ModelTemplateStatus.APPROVED
            template.is_active = True
        
        self.db.add(template)
        await self.db.flush()
        
        # Create initial version
        version = TemplateVersion(
            template_id=template.id,
            version_number=1,
            content=template_data.content,
            change_summary="Initial version",
            change_type="major",
            created_by=user_id
        )
        self.db.add(version)
        
        # Add variables
        for var_def in template_data.variables:
            variable = TemplateVariable(
                template_id=template.id,
                variable_name=var_def.name,
                variable_type=ModelVariableType(var_def.type),
                display_name=var_def.display_name,
                description=var_def.description,
                placeholder=var_def.placeholder,
                help_text=var_def.help_text,
                is_required=var_def.is_required,
                default_value=str(var_def.default_value) if var_def.default_value else None,
                validation_rules=var_def.validation_rules,
                options=var_def.options,
                depends_on=var_def.depends_on,
                show_when=var_def.show_when,
                format_pattern=var_def.format_pattern,
                transform=var_def.transform,
                position=var_def.position,
                group_name=var_def.group_name
            )
            self.db.add(variable)
        
        await self.db.commit()
        await self.db.refresh(template)
        
        # Load relationships
        await self.db.refresh(template, ["variables"])
        
        logger.info(f"Created template {template.id} for tenant {tenant_id}")
        return template
    
    async def update_template(
        self,
        template_id: int,
        update_data: TemplateUpdate,
        user_id: int
    ) -> Template:
        """Update template and create new version if content changes."""
        # Get existing template
        query = select(Template).where(Template.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise EntityNotFoundError("Template", template_id)
        
        # Check if content is changing
        content_changed = update_data.content and update_data.content != template.content
        
        if content_changed:
            # Validate new content
            syntax_errors = self.validator.validate_syntax(update_data.content)
            if syntax_errors:
                raise ValidationError(f"Template syntax errors: {'; '.join(syntax_errors)}")
            
            # Create new version
            template.version += 1
            version = TemplateVersion(
                template_id=template.id,
                version_number=template.version,
                content=update_data.content,
                change_summary=update_data.change_summary or "Content updated",
                change_type="minor",
                created_by=user_id
            )
            self.db.add(version)
            template.content = update_data.content
        
        # Update other fields
        if update_data.name is not None:
            template.name = update_data.name
        if update_data.description is not None:
            template.description = update_data.description
        if update_data.category is not None:
            template.category = update_data.category
        if update_data.subcategory is not None:
            template.subcategory = update_data.subcategory
        if update_data.tags is not None:
            template.tags = update_data.tags
        if update_data.is_active is not None:
            template.is_active = update_data.is_active
        if update_data.requires_approval is not None:
            template.requires_approval = update_data.requires_approval
        if update_data.config is not None:
            template.config = update_data.config
        if update_data.metadata_fields is not None:
            template.metadata_fields = update_data.metadata_fields
        
        template.updated_by = user_id
        template.updated_at = datetime.utcnow()
        
        # Update variables if provided
        if update_data.variables is not None:
            # Remove existing variables
            await self.db.execute(
                select(TemplateVariable).where(
                    TemplateVariable.template_id == template_id
                )
            )
            
            # Add new variables
            for var_def in update_data.variables:
                variable = TemplateVariable(
                    template_id=template.id,
                    variable_name=var_def.name,
                    variable_type=ModelVariableType(var_def.type),
                    display_name=var_def.display_name,
                    description=var_def.description,
                    is_required=var_def.is_required,
                    default_value=str(var_def.default_value) if var_def.default_value else None,
                    validation_rules=var_def.validation_rules,
                    options=var_def.options,
                    position=var_def.position
                )
                self.db.add(variable)
        
        await self.db.commit()
        await self.db.refresh(template)
        
        logger.info(f"Updated template {template_id}, version {template.version}")
        return template
    
    async def get_template(self, template_id: int, tenant_id: int) -> Template:
        """Get template by ID."""
        query = select(Template).where(
            and_(
                Template.id == template_id,
                Template.tenant_id == tenant_id
            )
        ).options(selectinload(Template.variables))
        
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise EntityNotFoundError("Template", template_id)
        
        return template
    
    async def get_template_versions(self, template_id: int) -> List[TemplateVersion]:
        """Get all versions of a template."""
        query = select(TemplateVersion).where(
            TemplateVersion.template_id == template_id
        ).order_by(TemplateVersion.version_number)
        
        result = await self.db.execute(query)
        versions = result.scalars().all()
        
        return list(versions)
    
    async def search_templates(
        self,
        tenant_id: int,
        query: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        per_page: int = 10
    ) -> List[Template]:
        """Search and filter templates."""
        stmt = select(Template).where(Template.tenant_id == tenant_id)
        
        # Apply filters
        if query:
            stmt = stmt.where(
                or_(
                    Template.name.ilike(f"%{query}%"),
                    Template.description.ilike(f"%{query}%")
                )
            )
        
        if category:
            stmt = stmt.where(Template.category == category)
        
        if tags:
            for tag in tags:
                stmt = stmt.where(Template.tags.contains([tag]))
        
        if is_active is not None:
            stmt = stmt.where(Template.is_active == is_active)
        
        # Pagination
        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)
        
        # Include variables
        stmt = stmt.options(selectinload(Template.variables))
        
        result = await self.db.execute(stmt)
        templates = result.scalars().all()
        
        return list(templates)
    
    async def approve_template(
        self,
        template_id: int,
        approver_id: int,
        comments: Optional[str] = None
    ) -> Template:
        """Approve a template."""
        query = select(Template).where(Template.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise EntityNotFoundError("Template", template_id)
        
        template.approval_status = ModelTemplateStatus.APPROVED
        template.is_active = True
        template.approved_by = approver_id
        template.approved_at = datetime.utcnow()
        template.approval_comments = comments
        
        await self.db.commit()
        await self.db.refresh(template)
        
        logger.info(f"Template {template_id} approved by user {approver_id}")
        return template
    
    async def reject_template(
        self,
        template_id: int,
        reviewer_id: int,
        comments: str
    ) -> Template:
        """Reject a template."""
        query = select(Template).where(Template.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise EntityNotFoundError("Template", template_id)
        
        template.approval_status = ModelTemplateStatus.REJECTED
        template.is_active = False
        template.approved_by = reviewer_id
        template.approved_at = datetime.utcnow()
        template.approval_comments = comments
        
        await self.db.commit()
        await self.db.refresh(template)
        
        logger.info(f"Template {template_id} rejected by user {reviewer_id}")
        return template
    
    async def track_template_usage(
        self,
        template_id: int,
        user_id: int,
        usage_type: str = "render",
        contract_id: Optional[int] = None,
        render_time_ms: Optional[int] = None,
        variables_used: Optional[Dict[str, Any]] = None
    ):
        """Track template usage for analytics."""
        # Update template usage count
        query = select(Template).where(Template.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if template:
            template.usage_count += 1
            template.last_used_at = datetime.utcnow()
        
        # Create usage record
        usage = TemplateUsage(
            template_id=template_id,
            used_by=user_id,
            usage_type=usage_type,
            contract_id=contract_id,
            render_time_ms=render_time_ms,
            variables_used=variables_used
        )
        self.db.add(usage)
        
        await self.db.commit()
    
    async def get_template_statistics(self, template_id: int) -> Dict[str, Any]:
        """Get usage statistics for a template."""
        # Get usage records
        query = select(TemplateUsage).where(TemplateUsage.template_id == template_id)
        result = await self.db.execute(query)
        usage_records = result.scalars().all()
        
        if not usage_records:
            return {
                "usage_count": 0,
                "unique_users": 0,
                "last_used": None
            }
        
        # Calculate statistics
        unique_users = len(set(u.used_by for u in usage_records))
        last_used = max(u.used_at for u in usage_records)
        
        # Variable usage frequency
        variable_usage = {}
        for usage in usage_records:
            if usage.variables_used:
                for var_name in usage.variables_used.keys():
                    variable_usage[var_name] = variable_usage.get(var_name, 0) + 1
        
        # Average render time
        render_times = [u.render_time_ms for u in usage_records if u.render_time_ms]
        avg_render_time = sum(render_times) / len(render_times) if render_times else None
        
        return {
            "usage_count": len(usage_records),
            "unique_users": unique_users,
            "last_used": last_used,
            "most_used_variables": variable_usage,
            "average_render_time_ms": avg_render_time
        }
    
    async def clone_template(
        self,
        template_id: int,
        new_name: str,
        user_id: int,
        tenant_id: int
    ) -> Template:
        """Clone an existing template."""
        # Get original template
        query = select(Template).where(
            Template.id == template_id
        ).options(selectinload(Template.variables))
        result = await self.db.execute(query)
        original = result.scalar_one_or_none()
        
        if not original:
            raise EntityNotFoundError("Template", template_id)
        
        # Create clone
        cloned = Template(
            tenant_id=tenant_id,
            name=new_name,
            description=original.description,
            content=original.content,
            category=original.category,
            subcategory=original.subcategory,
            tags=original.tags,
            requires_approval=original.requires_approval,
            config=original.config,
            metadata_fields=original.metadata_fields,
            parent_template_id=template_id,
            created_by=user_id,
            version=1,
            is_latest_version=True,
            approval_status=ModelTemplateStatus.DRAFT,
            is_active=False
        )
        
        self.db.add(cloned)
        await self.db.flush()
        
        # Clone variables
        for var in original.variables:
            cloned_var = TemplateVariable(
                template_id=cloned.id,
                variable_name=var.variable_name,
                variable_type=var.variable_type,
                display_name=var.display_name,
                description=var.description,
                is_required=var.is_required,
                default_value=var.default_value,
                validation_rules=var.validation_rules,
                options=var.options,
                position=var.position
            )
            self.db.add(cloned_var)
        
        await self.db.commit()
        await self.db.refresh(cloned, ["variables"])
        
        logger.info(f"Cloned template {template_id} to new template {cloned.id}")
        return cloned


class TemplateRenderer:
    """Template rendering engine using Jinja2."""
    
    def __init__(self):
        """Initialize template renderer."""
        self.env = Environment(
            variable_start_string='{{',
            variable_end_string='}}',
            block_start_string='{%',
            block_end_string='%}',
            autoescape=True
        )
        
        # Add custom filters
        self.env.filters['currency'] = self._format_currency
        self.env.filters['words'] = self._number_to_words
        self.env.filters['format'] = self._format_date
        self.env.filters['default'] = lambda x, d: x if x else d
    
    def render(self, template_content: str, context: RenderContext) -> str:
        """Render template with given context."""
        try:
            template = self.env.from_string(template_content)
            
            # Prepare render context
            render_vars = context.variables.copy()
            
            # Add conditions to context
            for key, value in context.conditions.items():
                render_vars[key] = value
            
            # Render template
            rendered = template.render(**render_vars)
            
            return rendered
            
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            if context.strict_mode:
                raise ValueError(f"Missing required variable: {e}")
            return str(e)
    
    def _format_currency(self, value: float) -> str:
        """Format number as currency."""
        return f"${value:,.2f}"
    
    def _number_to_words(self, value: float) -> str:
        """Convert number to words."""
        try:
            whole = int(value)
            decimal = int((value - whole) * 100)
            
            words = num2words(whole)
            if decimal > 0:
                words += f" and {decimal}/100"
            
            return words
        except:
            return str(value)
    
    def _format_date(self, value: str, format_str: str) -> str:
        """Format date string."""
        try:
            # Parse date
            date = datetime.fromisoformat(value)
            
            # Convert format string (simplified)
            format_map = {
                'MMMM': '%B',
                'MMM': '%b',
                'MM': '%m',
                'd': '%d',
                'yyyy': '%Y',
                'yy': '%y'
            }
            
            for key, val in format_map.items():
                format_str = format_str.replace(key, val)
            
            return date.strftime(format_str)
        except:
            return value


class VariableManager:
    """Manage template variables and validation."""
    
    def extract_variables(self, template_content: str) -> Set[str]:
        """Extract variable names from template content."""
        variables = set()
        
        # Extract {{variable}} style variables
        pattern = r'\{\{([^}]+)\}\}'
        matches = re.findall(pattern, template_content)
        
        for match in matches:
            # Clean up variable name
            var_name = match.strip()
            
            # Handle filters (e.g., {{var|filter}})
            if '|' in var_name:
                var_name = var_name.split('|')[0].strip()
            
            # Handle nested access (e.g., {{obj.prop}})
            if '.' in var_name:
                var_name = var_name.split('.')[0].strip()
            
            variables.add(var_name)
        
        return variables
    
    def validate_variables(
        self,
        values: Dict[str, Any],
        definitions: List[VariableDefinition]
    ) -> List[str]:
        """Validate variable values against definitions."""
        errors = []
        
        for definition in definitions:
            value = values.get(definition.name)
            
            # Check required
            if definition.is_required and value is None:
                errors.append(f"Required variable '{definition.name}' is missing")
                continue
            
            if value is None:
                continue
            
            # Type validation
            if definition.type == VariableType.EMAIL:
                if not re.match(r'^[^@]+@[^@]+\.[^@]+$', str(value)):
                    errors.append(f"Invalid email for '{definition.name}'")
            
            elif definition.type == VariableType.NUMBER:
                try:
                    num_value = float(value)
                    rules = definition.validation_rules or {}
                    
                    if 'min' in rules and num_value < rules['min']:
                        errors.append(f"Value for '{definition.name}' is below minimum {rules['min']}")
                    
                    if 'max' in rules and num_value > rules['max']:
                        errors.append(f"Value for '{definition.name}' exceeds maximum {rules['max']}")
                except (TypeError, ValueError):
                    errors.append(f"Invalid number for '{definition.name}'")
            
            elif definition.type == VariableType.DATE:
                try:
                    date_value = datetime.fromisoformat(str(value))
                    rules = definition.validation_rules or {}
                    
                    if 'min_date' in rules:
                        min_date = datetime.fromisoformat(rules['min_date'])
                        if date_value < min_date:
                            errors.append(f"Date for '{definition.name}' is before minimum date")
                    
                    if 'max_date' in rules:
                        max_date = datetime.fromisoformat(rules['max_date'])
                        if date_value > max_date:
                            errors.append(f"Date for '{definition.name}' is after maximum date")
                except:
                    errors.append(f"Invalid date for '{definition.name}'")
        
        return errors
    
    def get_required_variables(
        self,
        values: Dict[str, Any],
        definitions: List[VariableDefinition]
    ) -> Set[str]:
        """Get list of required variables based on dependencies."""
        required = set()
        
        for definition in definitions:
            # Always required
            if definition.is_required:
                required.add(definition.name)
            
            # Conditionally required
            if definition.depends_on and definition.show_when:
                dependency_value = values.get(definition.depends_on)
                
                if dependency_value in definition.show_when.get(definition.depends_on, []):
                    required.add(definition.name)
        
        return required


class TemplateValidator:
    """Validate template syntax and content."""
    
    def validate_syntax(self, template_content: str) -> List[str]:
        """Validate template syntax."""
        errors = []
        
        # Check for unclosed variables
        if template_content.count('{{') != template_content.count('}}'):
            errors.append("Unclosed variable brackets detected")
        
        # Check for unclosed conditionals
        if_count = template_content.count('{% if')
        endif_count = template_content.count('{% endif')
        if if_count != endif_count:
            errors.append(f"Unclosed conditional: {if_count} if statements but {endif_count} endif statements")
        
        # Check for unclosed loops
        for_count = template_content.count('{% for')
        endfor_count = template_content.count('{% endfor')
        if for_count != endfor_count:
            errors.append(f"Unclosed loop: {for_count} for statements but {endfor_count} endfor statements")
        
        # Try to parse with Jinja2
        try:
            env = Environment()
            env.from_string(template_content)
        except TemplateSyntaxError as e:
            errors.append(f"Template syntax error: {str(e)}")
        
        return errors
    
    def validate_legal_content(
        self,
        template_content: str,
        template_type: str
    ) -> List[str]:
        """Validate legal content requirements."""
        warnings = []
        content_lower = template_content.lower()
        
        if template_type == "contract":
            # Check for essential legal clauses
            if "governing law" not in content_lower and "governed by" not in content_lower:
                warnings.append("Missing governing law clause")
            
            if "dispute resolution" not in content_lower and "disputes" not in content_lower:
                warnings.append("Missing dispute resolution clause")
            
            if "entire agreement" not in content_lower:
                warnings.append("Missing entire agreement clause")
        
        return warnings
    
    def validate_variable_consistency(
        self,
        template_content: str,
        variable_definitions: List[VariableDefinition]
    ) -> List[str]:
        """Check that all template variables have definitions."""
        issues = []
        
        # Extract variables from template
        manager = VariableManager()
        template_vars = manager.extract_variables(template_content)
        
        # Get defined variable names
        defined_vars = {d.name for d in variable_definitions}
        
        # Find undefined variables
        undefined = template_vars - defined_vars
        for var in undefined:
            issues.append(f"Variable '{var}' used in template but not defined")
        
        return issues