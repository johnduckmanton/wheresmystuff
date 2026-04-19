---
inclusion: auto
---

# Project Overview — Home Inventory System ("Where's My Stuff")

## What This Is
A full-stack serverless web application for tracking personal belongings across locations, containers, and rooms. Features QR code scanning, moving project management, container sharing, and AI-powered photo analysis.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite, Material-UI v7, deployed via CloudFront
- **Backend**: AWS Lambda (Node.js 20.x) with Express-style routing per handler
- **Database**: DynamoDB single-table design (partition key `pk`, sort key `sk`, GSI1)
- **Storage**: S3 (separate buckets for photos and QR codes)
- **Auth**: AWS Cognito User Pools with JWT verification via JWKS
- **API**: API Gateway HTTP API
- **IaC**: AWS SAM (`template.yaml`)
- **CI/CD**: GitHub Actions (`.github/workflows/ci-cd.yml`)

## Regions
- Backend resources: `eu-west-1`
- CloudFront + WAF: `us-east-1`

## Key Directories
```
backend/handlers/    → Lambda handler functions (one per API resource)
backend/services/    → Business logic layer
backend/middleware/  → Auth, rate limiting, CORS, security headers
backend/models/      → DynamoDB data models
backend/utils/       → Validation, response formatting, error handling
backend/tests/       → Jest tests
frontend/src/components/  → React components (flat structure, feature-named)
frontend/src/services/    → API client (ApiClient class in api.ts)
frontend/src/contexts/    → React Context providers
frontend/src/types/       → TypeScript type definitions
frontend/src/hooks/       → Custom React hooks
frontend/src/pages/       → Page-level components
frontend/src/tests/       → Vitest tests
```

## DynamoDB Key Patterns
All data lives in a single table `home-inventory-{environment}` using composite keys:
- Inventories: `pk=INVENTORY#{id}`, `sk=METADATA`
- Members: `pk=INVENTORY#{id}`, `sk=MEMBER#{userId}`
- Entities: `pk=INVENTORY#{id}#THINGS|LOCATIONS|ROOMS|CATEGORIES|PEOPLE`, `sk={entityId}`
- Rate limits: `pk=RATELIMIT#{userId}#{endpoint}`, `sk={windowStart}` (with TTL)
- Audit logs: `pk=AUDITLOG#{date}`, `sk={timestamp}#{logId}`

Reference: `backend/docs/dynamodb-schema.md`
