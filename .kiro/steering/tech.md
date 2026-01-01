# Technology Stack & Build System

## Architecture
- **Type**: Serverless full-stack web application
- **Deployment**: Multi-region AWS (Backend: eu-west-1, CDN: us-east-1)
- **Infrastructure**: AWS SAM (Serverless Application Model)

## Frontend Stack
- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4
- **UI Library**: Material-UI v5 (@mui/material 7.3.6)
- **Routing**: React Router DOM 7.10.1
- **State Management**: React Context API
- **Authentication**: AWS Amplify 6.15.8
- **HTTP Client**: Axios 1.13.2
- **QR Code**: @zxing/browser & @zxing/library

## Backend Stack
- **Runtime**: Node.js 20.x
- **Framework**: AWS Lambda with Express-style routing
- **Database**: DynamoDB with single-table design
- **Storage**: S3 (separate buckets for photos and QR codes)
- **Authentication**: AWS Cognito User Pools with JWT
- **API**: API Gateway HTTP API
- **CDN**: CloudFront with WAF protection

## Key Libraries & Dependencies

### Backend
- **AWS SDK**: @aws-sdk/client-* (v3.x)
- **Authentication**: jsonwebtoken, jwks-rsa
- **QR Codes**: qrcode
- **Testing**: Jest 30.2.0, fast-check 4.4.0 (property-based testing)
- **Utilities**: uuid

### Frontend
- **Date Handling**: date-fns 4.1.0
- **Data Grid**: @mui/x-data-grid 8.21.0
- **Icons**: @mui/icons-material 7.3.6
- **UUID**: uuid 13.0.0

## Common Commands

### Backend Development
```bash
# Install dependencies
cd backend && npm install

# Run tests
npm test
npm run test:watch

# Security audit
npm run audit:check
npm run security:check
```

### Frontend Development
```bash
# Install dependencies
cd frontend && npm install

# Development server
npm run dev  # Runs on http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint

# Security audit
npm run audit:check
npm run security:check
```

### Deployment
```bash
# Full deployment (backend + frontend)
./deploy.sh [stack-name] [environment] [region]

# Backend only
./scripts/deploy-backend-only.sh

# Frontend only
./scripts/deploy-frontend.sh

# SAM commands
sam build
sam deploy --region eu-west-1
```

### Testing
```bash
# Backend tests (includes property-based tests)
cd backend && npm test

# Frontend validation
cd frontend && npm run validate:workflows
```

## Build Configuration
- **Frontend**: Vite with TypeScript, ESLint 9.39.1
- **Backend**: Jest with 30s timeout for property-based tests
- **Infrastructure**: AWS SAM with CloudFormation templates
- **Environment**: Node.js 20.x, TypeScript ~5.9.3

## Development Patterns
- **Error Handling**: Centralized error responses with security logging
- **Authentication**: JWT middleware with Cognito integration
- **CORS**: Configurable origins with security headers
- **Rate Limiting**: Built-in rate limiting middleware
- **Caching**: Multi-layer (DynamoDB, CloudFront, Browser)
- **Security**: WAF, CSP headers, input validation, audit logging