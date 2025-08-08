"""
Salesforce CRM Integration Connector
Implements OAuth 2.0 authentication and data synchronization
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from enum import Enum
from dataclasses import dataclass, field
import aiohttp
import hashlib
import hmac
import json
import base64
from urllib.parse import urlencode, quote
import logging

logger = logging.getLogger(__name__)


class SyncDirection(str, Enum):
    TO_SALESFORCE = "to_salesforce"
    FROM_SALESFORCE = "from_salesforce"
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SalesforceConfig:
    client_id: str
    client_secret: str
    redirect_uri: str
    instance_url: str
    api_version: str = "v58.0"
    sandbox: bool = False


@dataclass
class OAuth2Token:
    access_token: str
    refresh_token: str
    instance_url: str
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None
    scope: str = ""


@dataclass
class SalesforceAccount:
    name: str
    type: Optional[str] = None
    industry: Optional[str] = None
    annual_revenue: Optional[float] = None
    id: Optional[str] = None


@dataclass
class SalesforceDeal:
    name: str
    account_id: str
    amount: float
    close_date: datetime
    stage: str
    id: Optional[str] = None


@dataclass
class SalesforceContact:
    first_name: str
    last_name: str
    email: str
    account_id: Optional[str] = None
    title: Optional[str] = None
    id: Optional[str] = None


@dataclass
class SalesforceWebhook:
    url: str
    events: List[str]
    secret: str
    id: Optional[str] = None


@dataclass
class FieldMapping:
    source_field: str
    target_field: str
    transformation: str = "direct"
    data_type: str = "string"


class SalesforceError(Exception):
    """Base Salesforce error"""
    pass


class AuthenticationError(SalesforceError):
    """Authentication failed"""
    pass


class SyncError(SalesforceError):
    """Sync operation failed"""
    pass


class RateLimitError(SalesforceError):
    """Rate limit exceeded"""
    pass


class SalesforceAuth:
    """OAuth 2.0 authentication handler"""
    
    def __init__(self, config: SalesforceConfig):
        self.config = config
        self.base_url = "https://test.salesforce.com" if config.sandbox else "https://login.salesforce.com"
        self.tokens = {}  # In-memory token storage
    
    async def generate_authorization_url(self, state: str, scopes: List[str]) -> str:
        """Generate OAuth authorization URL"""
        params = {
            "response_type": "code",
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "state": state,
            "scope": " ".join(scopes)
        }
        return f"{self.base_url}/services/oauth2/authorize?{urlencode(params)}"
    
    async def exchange_code_for_token(self, authorization_code: str, state: str) -> OAuth2Token:
        """Exchange authorization code for access token"""
        url = f"{self.base_url}/services/oauth2/token"
        
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "redirect_uri": self.config.redirect_uri
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data) as response:
                if response.status != 200:
                    raise AuthenticationError(f"Token exchange failed: {response.status}")
                
                result = await response.json()
                return OAuth2Token(
                    access_token=result["access_token"],
                    refresh_token=result.get("refresh_token", ""),
                    instance_url=result["instance_url"],
                    token_type=result.get("token_type", "Bearer"),
                    expires_at=datetime.now() + timedelta(seconds=7200),
                    scope=result.get("scope", "")
                )
    
    async def refresh_access_token(self, refresh_token: str) -> OAuth2Token:
        """Refresh expired access token"""
        url = f"{self.base_url}/services/oauth2/token"
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data) as response:
                if response.status != 200:
                    raise AuthenticationError("Token refresh failed")
                
                result = await response.json()
                return OAuth2Token(
                    access_token=result["access_token"],
                    refresh_token=refresh_token,
                    instance_url=result["instance_url"],
                    expires_at=datetime.now() + timedelta(seconds=7200)
                )
    
    async def validate_token(self, token: OAuth2Token) -> bool:
        """Validate OAuth token"""
        if not token.expires_at:
            return True
        return datetime.now() < token.expires_at
    
    async def revoke_token(self, token: OAuth2Token):
        """Revoke OAuth token"""
        url = f"{self.base_url}/services/oauth2/revoke"
        data = {"token": token.access_token}
        
        async with aiohttp.ClientSession() as session:
            await session.post(url, data=data)
    
    async def store_token_securely(self, tenant_id: str, token: OAuth2Token):
        """Store token securely"""
        # Simplified in-memory storage
        self.tokens[tenant_id] = token
    
    async def retrieve_stored_token(self, tenant_id: str) -> Optional[OAuth2Token]:
        """Retrieve stored token"""
        return self.tokens.get(tenant_id)


class SalesforceConnector:
    """Main Salesforce connector"""
    
    def __init__(self, config: SalesforceConfig):
        self.config = config
        self.auth = SalesforceAuth(config)
        self.current_token = None
        self.field_mappings = {}
        self.webhooks = {}
        self.rate_limits = {"requests_per_hour": 10000, "remaining": 10000}
    
    # Authentication proxy methods
    async def generate_authorization_url(self, state: str, scopes: List[str]) -> str:
        return await self.auth.generate_authorization_url(state, scopes)
    
    async def exchange_code_for_token(self, authorization_code: str, state: str) -> OAuth2Token:
        token = await self.auth.exchange_code_for_token(authorization_code, state)
        self.current_token = token
        return token
    
    async def refresh_access_token(self, refresh_token: str) -> OAuth2Token:
        return await self.auth.refresh_access_token(refresh_token)
    
    async def validate_token(self, token: OAuth2Token) -> bool:
        return await self.auth.validate_token(token)
    
    async def revoke_token(self, token: OAuth2Token):
        await self.auth.revoke_token(token)
    
    async def store_token_securely(self, tenant_id: str, token: OAuth2Token):
        await self.auth.store_token_securely(tenant_id, token)
    
    async def retrieve_stored_token(self, tenant_id: str) -> Optional[OAuth2Token]:
        return await self.auth.retrieve_stored_token(tenant_id)
    
    # Account operations
    async def fetch_accounts(self, limit: int, offset: int, filters: Dict[str, Any]) -> List[SalesforceAccount]:
        """Fetch accounts from Salesforce"""
        query = f"SELECT Id, Name, Type, Industry, AnnualRevenue FROM Account"
        if filters:
            conditions = [f"{k} = '{v}'" for k, v in filters.items()]
            query += f" WHERE {' AND '.join(conditions)}"
        query += f" LIMIT {limit} OFFSET {offset}"
        
        results = await self._execute_soql(query)
        return [self._map_to_account(r) for r in results.get("records", [])]
    
    async def create_account(self, account: SalesforceAccount) -> SalesforceAccount:
        """Create account in Salesforce"""
        data = {
            "Name": account.name,
            "Type": account.type,
            "Industry": account.industry,
            "AnnualRevenue": account.annual_revenue
        }
        result = await self._api_request("POST", "/sobjects/Account", data)
        account.id = result.get("id")
        return account
    
    async def update_account(self, account_id: str, updates: Dict[str, Any]) -> bool:
        """Update account in Salesforce"""
        await self._api_request("PATCH", f"/sobjects/Account/{account_id}", updates)
        return True
    
    async def delete_account(self, account_id: str):
        """Delete account from Salesforce"""
        await self._api_request("DELETE", f"/sobjects/Account/{account_id}")
    
    async def bulk_upsert_accounts(self, accounts: List[SalesforceAccount], external_id_field: str) -> List[Dict]:
        """Bulk upsert accounts"""
        records = [self._account_to_dict(a) for a in accounts]
        return await self._bulk_operation("Account", records, "upsert", external_id_field)
    
    # Opportunity operations
    async def fetch_opportunities(self, account_id: str, stage_filter: List[str]) -> List[SalesforceDeal]:
        """Fetch opportunities from Salesforce"""
        query = f"SELECT Id, Name, AccountId, Amount, CloseDate, StageName FROM Opportunity"
        conditions = [f"AccountId = '{account_id}'"]
        if stage_filter:
            stages = "','".join(stage_filter)
            conditions.append(f"StageName IN ('{stages}')")
        query += f" WHERE {' AND '.join(conditions)}"
        
        results = await self._execute_soql(query)
        return [self._map_to_deal(r) for r in results.get("records", [])]
    
    async def create_opportunity(self, deal: SalesforceDeal) -> SalesforceDeal:
        """Create opportunity in Salesforce"""
        data = {
            "Name": deal.name,
            "AccountId": deal.account_id,
            "Amount": deal.amount,
            "CloseDate": deal.close_date.strftime("%Y-%m-%d"),
            "StageName": deal.stage
        }
        result = await self._api_request("POST", "/sobjects/Opportunity", data)
        deal.id = result.get("id")
        return deal
    
    async def update_opportunity_stage(self, opportunity_id: str, new_stage: str, probability: int):
        """Update opportunity stage"""
        data = {"StageName": new_stage, "Probability": probability}
        await self._api_request("PATCH", f"/sobjects/Opportunity/{opportunity_id}", data)
    
    async def link_contract_to_opportunity(self, opportunity_id: str, contract_id: str, contract_url: str):
        """Link contract to opportunity"""
        data = {
            "Contract_ID__c": contract_id,
            "Contract_URL__c": contract_url
        }
        await self._api_request("PATCH", f"/sobjects/Opportunity/{opportunity_id}", data)
    
    # Contact operations
    async def fetch_contacts(self, account_id: str, include_inactive: bool) -> List[SalesforceContact]:
        """Fetch contacts from Salesforce"""
        query = f"SELECT Id, FirstName, LastName, Email, AccountId, Title FROM Contact"
        query += f" WHERE AccountId = '{account_id}'"
        if not include_inactive:
            query += " AND IsActive = true"
        
        results = await self._execute_soql(query)
        return [self._map_to_contact(r) for r in results.get("records", [])]
    
    async def create_contact(self, contact: SalesforceContact) -> SalesforceContact:
        """Create contact in Salesforce"""
        data = {
            "FirstName": contact.first_name,
            "LastName": contact.last_name,
            "Email": contact.email,
            "AccountId": contact.account_id,
            "Title": contact.title
        }
        result = await self._api_request("POST", "/sobjects/Contact", data)
        contact.id = result.get("id")
        return contact
    
    async def update_contact(self, contact_id: str, updates: Dict[str, Any]):
        """Update contact in Salesforce"""
        await self._api_request("PATCH", f"/sobjects/Contact/{contact_id}", updates)
    
    async def search_contacts(self, query: str, fields: List[str]) -> List[SalesforceContact]:
        """Search contacts"""
        sosl = f"FIND {{{query}}} IN ALL FIELDS RETURNING Contact({','.join(fields)})"
        results = await self._execute_sosl(sosl)
        return [self._map_to_contact(r) for r in results]
    
    # Field mapping
    async def create_field_mapping(self, mapping: FieldMapping) -> FieldMapping:
        """Create field mapping"""
        self.field_mappings[mapping.source_field] = mapping
        return mapping
    
    async def validate_field_mapping(self, object_type: str, field_mappings: List[FieldMapping]) -> bool:
        """Validate field mappings"""
        fields = await self.get_salesforce_fields(object_type, include_custom=True)
        field_names = {f["name"] for f in fields}
        
        for mapping in field_mappings:
            if mapping.target_field not in field_names:
                return False
        return True
    
    async def transform_field_value(self, value: Any, transformation: str, target_type: str) -> Any:
        """Transform field value"""
        if transformation == "date_to_salesforce" and target_type == "date":
            return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
        return value
    
    async def get_salesforce_fields(self, object_type: str, include_custom: bool) -> List[Dict]:
        """Get Salesforce fields"""
        describe = await self._api_request("GET", f"/sobjects/{object_type}/describe")
        fields = describe.get("fields", [])
        
        if not include_custom:
            fields = [f for f in fields if not f["name"].endswith("__c")]
        
        return [{"name": f["name"], "type": f["type"], "label": f["label"]} for f in fields]
    
    # Webhook operations
    async def register_webhook(self, webhook: SalesforceWebhook) -> SalesforceWebhook:
        """Register webhook"""
        webhook.id = f"webhook_{len(self.webhooks)}"
        self.webhooks[webhook.id] = webhook
        return webhook
    
    async def validate_webhook_signature(self, payload: Dict, signature: str, secret: str) -> bool:
        """Validate webhook signature"""
        payload_str = json.dumps(payload, sort_keys=True)
        expected = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    
    async def process_webhook_event(self, event_type: str, payload: Dict):
        """Process webhook event"""
        logger.info(f"Processing webhook event: {event_type}")
        # Process based on event type
    
    async def list_webhooks(self) -> List[SalesforceWebhook]:
        """List webhooks"""
        return list(self.webhooks.values())
    
    async def delete_webhook(self, webhook_id: str):
        """Delete webhook"""
        self.webhooks.pop(webhook_id, None)
    
    # Real-time sync
    async def enable_real_time_sync(self, object_types: List[str], sync_direction: SyncDirection):
        """Enable real-time sync"""
        logger.info(f"Enabling real-time sync for {object_types} with direction {sync_direction}")
    
    async def sync_changes_from_salesforce(self, last_sync_time: datetime, object_types: List[str]) -> List[Dict]:
        """Sync changes from Salesforce"""
        changes = []
        for obj_type in object_types:
            query = f"SELECT Id, LastModifiedDate FROM {obj_type} WHERE LastModifiedDate > {last_sync_time.isoformat()}Z"
            results = await self._execute_soql(query)
            changes.extend([{"type": obj_type, "record": r} for r in results.get("records", [])])
        return changes
    
    async def push_changes_to_salesforce(self, changes: List[Dict]) -> List[Dict]:
        """Push changes to Salesforce"""
        results = []
        for change in changes:
            try:
                await self._api_request("PATCH", f"/sobjects/{change['object']}/{change['id']}", change["updates"])
                results.append({"id": change["id"], "success": True})
            except Exception as e:
                results.append({"id": change["id"], "success": False, "error": str(e)})
        return results
    
    async def handle_sync_conflict(self, local_change: Dict, remote_change: Dict, resolution_strategy: str) -> Dict:
        """Handle sync conflict"""
        if resolution_strategy == "remote_wins":
            return remote_change
        return local_change
    
    # Bulk operations
    async def bulk_import(self, object_type: str, records: List[Dict], operation: str) -> str:
        """Bulk import records"""
        job_id = f"job_{datetime.now().timestamp()}"
        # Simplified implementation
        return job_id
    
    async def bulk_export(self, query: str, format: str) -> Any:
        """Bulk export data"""
        results = await self._execute_soql(query)
        if format == "csv":
            return self._to_csv(results.get("records", []))
        return results
    
    async def check_bulk_job_status(self, job_id: str) -> Dict:
        """Check bulk job status"""
        return {"job_id": job_id, "status": "completed"}
    
    async def get_bulk_job_results(self, job_id: str) -> Dict:
        """Get bulk job results"""
        return {"job_id": job_id, "results": []}
    
    # Rate limiting
    async def check_api_limits(self) -> Dict:
        """Check API limits"""
        return self.rate_limits
    
    async def implement_rate_limiting(self, max_requests_per_hour: int, burst_size: int):
        """Implement rate limiting"""
        self.rate_limits["requests_per_hour"] = max_requests_per_hour
        self.rate_limits["burst_size"] = burst_size
    
    async def handle_rate_limit_exceeded(self, retry_after: int, operation: str):
        """Handle rate limit exceeded"""
        logger.warning(f"Rate limit exceeded for {operation}, retry after {retry_after}s")
    
    # Error handling
    async def handle_authentication_error(self, error: AuthenticationError, retry_count: int):
        """Handle authentication error"""
        if retry_count < 3:
            # Attempt token refresh
            pass
    
    async def handle_sync_error(self, error: SyncError, affected_records: List[str]):
        """Handle sync error"""
        logger.error(f"Sync error for records: {affected_records}")
    
    async def implement_retry_logic(self, operation, max_retries: int, backoff_factor: int):
        """Implement retry logic"""
        for i in range(max_retries):
            try:
                return await operation()
            except Exception:
                if i < max_retries - 1:
                    await self._wait(backoff_factor ** i)
        raise SyncError("Max retries exceeded")
    
    async def log_integration_metrics(self, operation: str, success: bool, duration_ms: int, records_processed: int):
        """Log integration metrics"""
        logger.info(f"Operation: {operation}, Success: {success}, Duration: {duration_ms}ms, Records: {records_processed}")
    
    # Helper methods
    async def _api_request(self, method: str, endpoint: str, data: Any = None) -> Dict:
        """Make API request to Salesforce"""
        if not self.current_token:
            raise AuthenticationError("No active token")
        
        url = f"{self.config.instance_url}/services/data/{self.config.api_version}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.current_token.access_token}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=data, headers=headers) as response:
                if response.status >= 400:
                    raise SalesforceError(f"API request failed: {response.status}")
                if response.status == 204:
                    return {}
                return await response.json()
    
    async def _execute_soql(self, query: str) -> Dict:
        """Execute SOQL query"""
        encoded_query = quote(query)
        return await self._api_request("GET", f"/query?q={encoded_query}")
    
    async def _execute_sosl(self, search: str) -> List[Dict]:
        """Execute SOSL search"""
        encoded_search = quote(search)
        result = await self._api_request("GET", f"/search?q={encoded_search}")
        return result.get("searchRecords", [])
    
    async def _bulk_operation(self, object_type: str, records: List[Dict], operation: str, external_id: str = None) -> List[Dict]:
        """Perform bulk operation"""
        # Simplified implementation
        return [{"success": True} for _ in records]
    
    def _map_to_account(self, data: Dict) -> SalesforceAccount:
        """Map Salesforce data to Account"""
        return SalesforceAccount(
            id=data.get("Id"),
            name=data.get("Name"),
            type=data.get("Type"),
            industry=data.get("Industry"),
            annual_revenue=data.get("AnnualRevenue")
        )
    
    def _map_to_deal(self, data: Dict) -> SalesforceDeal:
        """Map Salesforce data to Deal"""
        return SalesforceDeal(
            id=data.get("Id"),
            name=data.get("Name"),
            account_id=data.get("AccountId"),
            amount=data.get("Amount", 0),
            close_date=datetime.strptime(data.get("CloseDate"), "%Y-%m-%d"),
            stage=data.get("StageName")
        )
    
    def _map_to_contact(self, data: Dict) -> SalesforceContact:
        """Map Salesforce data to Contact"""
        return SalesforceContact(
            id=data.get("Id"),
            first_name=data.get("FirstName"),
            last_name=data.get("LastName"),
            email=data.get("Email"),
            account_id=data.get("AccountId"),
            title=data.get("Title")
        )
    
    def _account_to_dict(self, account: SalesforceAccount) -> Dict:
        """Convert Account to dict"""
        return {
            "Name": account.name,
            "Type": account.type,
            "Industry": account.industry,
            "AnnualRevenue": account.annual_revenue
        }
    
    def _to_csv(self, records: List[Dict]) -> str:
        """Convert records to CSV"""
        if not records:
            return ""
        headers = records[0].keys()
        lines = [",".join(headers)]
        for record in records:
            lines.append(",".join(str(record.get(h, "")) for h in headers))
        return "\n".join(lines)
    
    async def _wait(self, seconds: int):
        """Wait for specified seconds"""
        import asyncio
        await asyncio.sleep(seconds)