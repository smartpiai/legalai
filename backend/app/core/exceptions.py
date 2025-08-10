"""
Custom exception classes for the Legal AI Platform.
"""


class LegalAIException(Exception):
    """Base exception class for Legal AI Platform."""
    pass


class EntityNotFoundError(LegalAIException):
    """Raised when a requested entity is not found."""
    
    def __init__(self, entity_type: str, entity_id: int):
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(f"{entity_type} with ID {entity_id} not found")


class ServiceUnavailableError(LegalAIException):
    """Raised when a required service is unavailable."""
    pass


class AuthenticationError(LegalAIException):
    """Raised when authentication fails."""
    pass


class AuthorizationError(LegalAIException):
    """Raised when user lacks required permissions."""
    pass


class ValidationError(LegalAIException):
    """Raised when data validation fails."""
    pass


class ProcessingError(LegalAIException):
    """Raised when document processing fails."""
    pass


class AIServiceError(LegalAIException):
    """Raised when AI service operations fail."""
    pass


class ReportError(LegalAIException):
    """Base exception for report-related errors."""
    pass


class PermissionError(LegalAIException):
    """Raised when user lacks required permissions for a specific resource."""
    pass


class InvalidFileTypeError(LegalAIException):
    """Raised when file type is not supported."""
    pass