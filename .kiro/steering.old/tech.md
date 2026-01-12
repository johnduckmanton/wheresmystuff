# Tech Stack

## Architecture
Serverless full-stack: React + TypeScript frontend, Node.js Lambda backend, DynamoDB + S3 storage

## Key Technologies
- **Frontend**: React 19.2.0, TypeScript, Vite 7.2.4, Material-UI v5, AWS Amplify auth
- **Backend**: Node.js 20.x, AWS Lambda, DynamoDB, S3, Cognito JWT, API Gateway
- **Infrastructure**: AWS SAM, CloudFormation, multi-region (eu-west-1/us-east-1)
- **Testing**: Jest 30.2.0, fast-check 4.4.0 (property-based testing)

## Common Commands
```bash
# Backend: cd backend && npm test
# Frontend: cd frontend && npm run dev (localhost:5173)
# Deploy: ./deploy.sh [stack] [env] [region]
# SAM: sam build && sam deploy --region eu-west-1
```

## Patterns
- JWT auth with Cognito, CORS security headers, rate limiting
- Single-table DynamoDB design, multi-layer caching
- Express-style Lambda routing, centralized error handling