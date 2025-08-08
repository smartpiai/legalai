"""
CRM Integration modules
"""
from .salesforce_connector import (
    SalesforceConnector,
    SalesforceAuth,
    SalesforceConfig,
    SalesforceAccount,
    SalesforceDeal,
    SalesforceContact,
    SalesforceWebhook,
    FieldMapping,
    SyncStatus,
    SyncDirection,
    OAuth2Token,
    SalesforceError,
    AuthenticationError,
    SyncError,
    RateLimitError
)

__all__ = [
    'SalesforceConnector',
    'SalesforceAuth',
    'SalesforceConfig',
    'SalesforceAccount',
    'SalesforceDeal',
    'SalesforceContact',
    'SalesforceWebhook',
    'FieldMapping',
    'SyncStatus',
    'SyncDirection',
    'OAuth2Token',
    'SalesforceError',
    'AuthenticationError',
    'SyncError',
    'RateLimitError'
]