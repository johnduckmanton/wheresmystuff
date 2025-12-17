# Local Testing Setup

## Prerequisites
- Node.js (v18 or later)
- AWS CLI configured with your credentials
- SAM CLI installed

## Backend Local Testing

### 1. Start Local API Gateway
```bash
# Build the backend
sam build

# Start local API Gateway (runs on http://localhost:3000)
sam local start-api --port 3000
```

### 2. Test Individual Lambda Functions
```bash
# Test a specific function with sample event
sam local invoke ThingsFunction --event events/test-get-things.json

# Generate test events
sam local generate-event apigateway aws-proxy --method GET --path /things > events/test-get-things.json
```

## Frontend Local Testing

### 1. Update Environment Variables
Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:3000
VITE_USER_POOL_ID=us-east-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
```

### 2. Start Frontend Development Server
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

## Testing Workflow

### 1. Test Backend Changes Locally
```bash
# Terminal 1: Start local API
sam build && sam local start-api --port 3000

# Terminal 2: Test endpoints
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/inventories
```

### 2. Test Frontend Changes Locally
```bash
# Terminal 1: Keep local API running
sam local start-api --port 3000

# Terminal 2: Start frontend
cd frontend && npm run dev

# Open http://localhost:5173 in browser
```

### 3. Test Photo Functionality
```bash
# Test photo endpoint directly
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/photo?key=photos/userId/inventoryId/entityId/filename.jpg"
```

## Getting JWT Token for Testing

### Option 1: From Browser Console
1. Open https://d2m4d2elac4ekv.cloudfront.net
2. Sign in
3. Open browser console
4. Run: `localStorage.getItem('idToken')`
5. Copy the token for curl commands

### Option 2: From Frontend Code
Add temporary logging in `frontend/src/services/api.ts`:
```typescript
// In the request interceptor
console.log('JWT Token:', token);
```

## Common Issues & Solutions

### CORS Issues
- Local API runs on different port than frontend
- Add localhost:5173 to CORS configuration if needed

### Authentication Issues
- JWT tokens expire after 1 hour
- Get fresh token from browser or re-authenticate

### Photo Issues
- Ensure S3 bucket permissions allow local Lambda access
- Check photo key format: `photos/{userId}/{inventoryId}/{entityId}/{filename}`

## Deployment After Testing

### 1. Deploy Backend Only
```bash
sam build && sam deploy --no-confirm-changeset
```

### 2. Deploy Frontend Only
```bash
cd frontend
npm run build
aws s3 sync dist/ s3://home-inventory-frontend-982081071280-dev --delete
aws cloudfront create-invalidation --distribution-id E3PZJWB45EVZ3Q --paths "/*"
```

### 3. Deploy Both
```bash
# Backend
sam build && sam deploy --no-confirm-changeset

# Frontend
cd frontend && npm run build
aws s3 sync dist/ s3://home-inventory-frontend-982081071280-dev --delete
aws cloudfront create-invalidation --distribution-id E3PZJWB45EVZ3Q --paths "/*"
```

## Environment Variables Reference

### Production
- API URL: https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
- Frontend URL: https://d2m4d2elac4ekv.cloudfront.net

### Local Development
- API URL: http://localhost:3000
- Frontend URL: http://localhost:5173