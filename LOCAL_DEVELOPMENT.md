# Local Development Guide

This guide explains how to run the Home Inventory System locally for development.

## Quick Start (Offline Mode)

The easiest way to run locally is using the built-in offline mode with mock data:

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Remove or rename the .env file to enable offline mode
mv .env .env.backup

# 3. Start the development server
npm run dev
```

The app will now run in offline mode with mock data at `http://localhost:5173`.

## Option 1: Full Offline Development (Recommended for UI work)

This mode uses mock data and doesn't require any backend services.

### Setup
```bash
cd frontend
# Remove .env to enable offline mode
rm .env
# Or create an empty .env.local
touch .env.local
npm run dev
```

### Features
- ✅ All UI components work
- ✅ Mock data for all entities
- ✅ Simulated API delays
- ✅ No network dependencies
- ✅ Perfect for frontend development

### Mock Data Included
- 2 sample inventories
- Sample things, locations, rooms, categories, people
- Realistic data structure

## Option 2: Local Backend with SAM Local

This runs the actual Lambda functions locally.

### Prerequisites
```bash
# Install SAM CLI
brew install aws-sam-cli  # macOS
# or follow: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

# Install Docker (required for SAM Local)
# Download from: https://www.docker.com/products/docker-desktop
```

### Setup
```bash
# 1. Start local API (in project root)
sam local start-api --port 3001

# 2. Configure frontend for local API
cd frontend
cat > .env.local << EOF
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=http://localhost:3001
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
EOF

# 3. Start frontend
npm run dev
```

### Features
- ✅ Real Lambda functions
- ✅ Real authentication
- ⚠️ Requires AWS credentials
- ⚠️ Requires Docker

## Option 3: Connect to Deployed Backend

Use the deployed AWS infrastructure.

### Setup
```bash
cd frontend
# Use the existing .env file (already configured)
npm run dev
```

### Features
- ✅ Full functionality
- ✅ Real data persistence
- ✅ All AWS services
- ⚠️ Requires internet connection
- ⚠️ Uses real AWS resources

## Troubleshooting

### Network Errors in Offline Mode
If you see network errors while trying to use offline mode:

1. **Check .env files**: Make sure no `VITE_API_URL` is set
```bash
cd frontend
# Remove all .env files or ensure VITE_API_URL is empty
rm .env .env.local
```

2. **Clear browser cache**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

3. **Check console**: Look for "🚀 Running in development mode with mock data"

### Authentication Issues
In offline mode, authentication is bypassed. For real authentication:

1. Use Option 2 (SAM Local) or Option 3 (Deployed)
2. Ensure Cognito credentials are correct in .env

### CORS Issues with SAM Local
If you get CORS errors with SAM Local:

```bash
# Start SAM with CORS enabled
sam local start-api --port 3001 --cors
```

### Port Conflicts
If port 3001 is in use:

```bash
# Use a different port
sam local start-api --port 3002

# Update .env.local
echo "VITE_API_URL=http://localhost:3002" >> .env.local
```

## Development Modes Summary

| Mode | Setup Complexity | Features | Best For |
|------|------------------|----------|----------|
| **Offline** | ⭐ Easy | Mock data, UI testing | Frontend development |
| **SAM Local** | ⭐⭐⭐ Medium | Real backend, local | Full-stack development |
| **Deployed** | ⭐⭐ Easy | Full functionality | Integration testing |

## Recommended Workflow

1. **Start with Offline Mode** for UI development and component work
2. **Use SAM Local** when you need to test backend integration
3. **Use Deployed** for final testing and production-like behavior

## Environment Variables Reference

### Offline Mode (.env.local empty or missing)
```bash
# No variables needed - uses mock data
```

### SAM Local Mode (.env.local)
```bash
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=http://localhost:3001
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
```

### Deployed Mode (.env)
```bash
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
```

## Next Steps

- For security testing, see `SECURITY_VERIFICATION_SUMMARY.md`
- For deployment, see `DEPLOYMENT_SUMMARY.md`
- For backend development, see `backend/README.md`