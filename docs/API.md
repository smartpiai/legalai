# API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication

All endpoints require authentication via Bearer token:
```
Authorization: Bearer <token>
```

## Endpoints

### Contracts

#### Upload Contract
```
POST /contracts/upload
Content-Type: multipart/form-data

file: <binary>
```

#### Get Contract
```
GET /contracts/{contract_id}
```

#### Analyze Contract
```
POST /contracts/{contract_id}/analyze
{
  "analysis_type": "full|quick|compliance"
}
```

### Analysis

#### Query Documents
```
POST /analysis/query
{
  "query": "string",
  "filters": {
    "date_from": "2024-01-01",
    "date_to": "2024-12-31",
    "contract_type": "NDA"
  }
}
```

### Workflows

#### Create Workflow
```
POST /workflows
{
  "name": "Contract Approval",
  "steps": [...]
}
```

## Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Codes

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
