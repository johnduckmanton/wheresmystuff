# Local Development Guide

This guide explains how to run the Home Inventory System locally for development, including the QR code functionality and TypeScript frontend.

## 🚀 Quick Start (Offline Mode)

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

## 📋 Development Options

### Option 1: Full Offline Development (Recommended for UI work)

This mode uses mock data and doesn't require any backend services.

#### Setup
```bash
cd frontend
# Remove .env to enable offline mode
rm .env
# Or create an empty .env.local
touch .env.local
npm run dev
```

#### Features
- ✅ All UI components work with TypeScript
- ✅ Mock data for containers, items, locations, people
- ✅ QR code generation simulation (mock QR codes)
- ✅ S3Image component testing with mock URLs
- ✅ Material-UI v5 components
- ✅ Simulated API delays for realistic testing
- ✅ No network dependencies
- ✅ Perfect for frontend development

#### Mock Data Included
- Sample inventories with containers and items
- Mock QR code data and images
- Sample locations, rooms, categories, people
- Realistic data structure matching production schema

### Option 2: Local Backend with SAM Local

This runs the actual Lambda functions locally, including QR code generation.

#### Prerequisites
```bash
# Install SAM CLI
brew install aws-sam-cli  # macOS
# or follow: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

# Install Docker (required for SAM Local)
# Download from: https://www.docker.com/products/docker-desktop

# Install backend dependencies
cd backend
npm install
cd ..
```

#### Setup
```bash
# 1. Build SAM application
sam build

# 2. Start local API (in project root)
sam local start-api --port 3001 --cors

# 3. Configure frontend for local API
cd frontend
cat > .env.local << EOF
VITE_AWS_REGION=eu-west-1
VITE_USER_POOL_ID=eu-west-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=http://localhost:3001
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
VITE_QR_BUCKET=home-inventory-qr-reports-982081071280-dev
EOF

# 4. Start frontend
npm run dev
```

#### Features
- ✅ Real Lambda functions (containers, items, QR codes)
- ✅ Real QR code generation and validation
- ✅ Real authentication with Cognito
- ✅ TypeScript compilation and type checking
- ⚠️ Requires AWS credentials configured
- ⚠️ Requires Docker running
- ⚠️ QR code images may not display (S3 access needed)

#### QR Code Development Notes
- QR code generation works locally
- QR code images require S3 access (use Option 3 for full QR testing)
- S3Image component will show fallback UI in local mode

### Option 3: Connect to Deployed Backend

Use the deployed AWS infrastructure for full functionality including QR codes.

#### Setup
```bash
cd frontend
# Use the existing .env file (already configured for deployed backend)
npm run dev
```

#### Features
- ✅ Full functionality including QR code system
- ✅ Real data persistence in DynamoDB
- ✅ All AWS services (S3, Cognito, CloudFront)
- ✅ QR code generation, storage, and display
- ✅ S3Image component with CORS handling
- ✅ Photo upload and management
- ⚠️ Requires internet connection
- ⚠️ Uses real AWS resources (may incur costs)

#### QR Code Testing
- Generate QR codes for containers
- Test QR code scanning functionality
- Verify S3Image component CORS handling
- Test QR code caching and performance

## 🛠️ Troubleshooting

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

### TypeScript Errors
If you encounter TypeScript compilation errors:

```bash
cd frontend

# Check for type errors
npm run type-check

# Clear TypeScript cache
rm -rf node_modules/.cache
npm install

# Update type definitions
npm update @types/react @types/node
```

### Authentication Issues
In offline mode, authentication is bypassed. For real authentication:

1. Use Option 2 (SAM Local) or Option 3 (Deployed)
2. Ensure Cognito credentials are correct in .env
3. Check AWS credentials: `aws sts get-caller-identity`

### CORS Issues with SAM Local
If you get CORS errors with SAM Local:

```bash
# Start SAM with CORS enabled
sam local start-api --port 3001 --cors

# Or add CORS headers manually in template.yaml
```

### QR Code Issues in Development

#### QR Code Generation Not Working
```bash
# Check if QR code service is running
curl http://localhost:3001/containers/{id}/qr-code

# Verify environment variables
echo $VITE_QR_BUCKET
```

#### S3Image Component Not Displaying
- In offline mode: Expected behavior, shows fallback UI
- In SAM Local: May show fallback due to S3 access
- In deployed mode: Should work with CORS handling

#### QR Code Scanning Issues
- Use deployed backend (Option 3) for full QR code testing
- Camera permissions may be required in browser
- HTTPS required for camera access in production

### Port Conflicts
If port 3001 or 5173 is in use:

```bash
# Use different port for SAM
sam local start-api --port 3002

# Use different port for Vite
npm run dev -- --port 5174

# Update .env.local accordingly
echo "VITE_API_URL=http://localhost:3002" >> .env.local
```

### Docker Issues (SAM Local)
If Docker-related errors occur:

```bash
# Check Docker is running
docker ps

# Pull required images
docker pull public.ecr.aws/sam/build-nodejs20.x

# Clear Docker cache if needed
docker system prune
```

## 📊 Development Modes Summary

| Mode | Setup Complexity | Features | QR Codes | Best For |
|------|------------------|----------|----------|----------|
| **Offline** | ⭐ Easy | Mock data, UI testing | Mock QR codes | Frontend/UI development |
| **SAM Local** | ⭐⭐⭐ Medium | Real backend, local | Generation only | Backend development |
| **Deployed** | ⭐⭐ Easy | Full functionality | Full QR system | Integration testing |

## 🔄 Recommended Workflow

1. **Start with Offline Mode** for UI development and component work
   - Perfect for TypeScript development
   - Test Material-UI components
   - Develop QR code UI without backend

2. **Use SAM Local** when you need to test backend integration
   - Test API endpoints
   - Verify authentication flows
   - Debug Lambda functions

3. **Use Deployed** for final testing and QR code functionality
   - Test complete QR code workflow
   - Verify S3Image CORS handling
   - Production-like behavior testing

## 🔧 Development Tools and Setup

### TypeScript Development

The frontend is built with TypeScript for better development experience:

```bash
cd frontend

# Type checking
npm run type-check

# Build with type checking
npm run build

# Development with hot reload and type checking
npm run dev
```

### Code Quality Tools

```bash
# ESLint for code quality
npm run lint

# Prettier for code formatting (if configured)
npm run format

# Run all checks
npm run check-all
```

### Component Development

Key components for development:

- **ContainerDetailDialog.tsx**: Enhanced with QR code integration
- **QRCodeGenerator.tsx**: QR code generation UI
- **S3Image.tsx**: CORS-handling image component
- **Material-UI Components**: Using v5 with TypeScript

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run tests (if available)
npm test

# Lint backend code
npm run lint

# Check for security vulnerabilities
npm audit
```

## 🌐 Environment Variables Reference

### Offline Mode (.env.local empty or missing)
```bash
# No variables needed - uses mock data
# QR codes will be mocked
# S3Image component shows fallback UI
```

### SAM Local Mode (.env.local)
```bash
VITE_AWS_REGION=eu-west-1
VITE_USER_POOL_ID=eu-west-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=http://localhost:3001
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
VITE_QR_BUCKET=home-inventory-qr-reports-982081071280-dev
```

### Deployed Mode (.env)
```bash
VITE_AWS_REGION=eu-west-1
VITE_USER_POOL_ID=eu-west-1_qL27rL63E
VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
VITE_API_URL=https://f5jrvv9716.execute-api.eu-west-1.amazonaws.com/dev
VITE_S3_BUCKET=home-inventory-photos-982081071280-dev
VITE_QR_BUCKET=home-inventory-qr-reports-982081071280-dev
VITE_CLOUDFRONT_URL=https://d1234567890abc.cloudfront.net
```

## 🧪 Testing QR Code Features

### In Offline Mode
- QR code generation UI works with mock data
- S3Image component shows fallback interface
- Container detail dialog displays QR code options
- No actual QR code images generated

### In SAM Local Mode
- QR code generation API works
- QR code validation and decoding works
- S3 image storage may not work (shows fallback)
- Authentication required for QR endpoints

### In Deployed Mode
- Full QR code generation and storage
- S3Image component handles CORS automatically
- QR code scanning with camera (HTTPS required)
- Complete end-to-end QR code workflow

## 🔍 Debugging Tips

### Frontend Debugging
```bash
# Enable verbose logging
VITE_DEBUG=true npm run dev

# Check network requests in browser DevTools
# Look for API calls to /containers/{id}/qr-code

# TypeScript errors
npm run type-check
```

### Backend Debugging (SAM Local)
```bash
# View Lambda logs
sam logs -n ContainerFunction --stack-name home-inventory-system --tail

# Debug specific function
sam local invoke QRCodeFunction --event events/qr-code-event.json

# Check environment variables
sam local start-api --debug
```

### QR Code Debugging
```bash
# Test QR code generation endpoint
curl -X POST http://localhost:3001/containers/test-id/qr-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check QR code bucket access
aws s3 ls s3://home-inventory-qr-reports-982081071280-dev/
```

## 📚 Next Steps and Resources

### Development Resources
- **TypeScript Documentation**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **React + TypeScript**: [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- **Material-UI v5**: [MUI Documentation](https://mui.com/material-ui/getting-started/overview/)
- **Vite**: [Vite Guide](https://vitejs.dev/guide/)

### Project Documentation
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- **Architecture**: See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for system architecture
- **QR Code System**: See [.kiro/specs/qr-code-system-enhancement/](.kiro/specs/qr-code-system-enhancement/) for QR code specifications
- **API Documentation**: See backend handler files for API endpoint details

### Development Best Practices
1. **Use TypeScript**: Take advantage of type safety and IntelliSense
2. **Component Testing**: Test components in offline mode first
3. **API Integration**: Use SAM Local for backend testing
4. **QR Code Testing**: Use deployed mode for complete QR functionality
5. **Code Quality**: Run linting and type checking regularly

### Common Development Tasks

#### Adding New Components
```bash
cd frontend/src/components
# Create new TypeScript component
touch NewComponent.tsx
# Follow existing patterns for props and types
```

#### Adding New API Endpoints
```bash
cd backend/handlers
# Create new handler file
touch newHandler.js
# Update template.yaml with new Lambda function
# Update frontend API client
```

#### Testing QR Code Changes
1. Develop UI in offline mode
2. Test generation in SAM Local mode  
3. Test full workflow in deployed mode
4. Verify S3Image CORS handling

### Performance Tips
- Use React DevTools for component debugging
- Monitor network requests in browser DevTools
- Use TypeScript strict mode for better error catching
- Implement proper error boundaries for production

---

**Happy Coding!** 🚀

For additional help:
- Check the troubleshooting section above
- Review the project specifications in `.kiro/specs/`
- Look at existing component implementations for patterns