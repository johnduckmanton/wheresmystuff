#!/bin/bash

# Test frontend authentication changes locally
# This script helps test the updated SignIn component

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing Frontend Authentication Changes${NC}"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

cd frontend

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔍 Checking TypeScript compilation...${NC}"
npx tsc --noEmit

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi

echo -e "${BLUE}🧹 Running linter...${NC}"
npm run lint

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠️  Linting issues found (but continuing)${NC}"
fi

echo -e "${BLUE}🏗️  Building frontend...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎯 Frontend Changes Summary${NC}"
echo "=========================="
echo -e "${GREEN}✅ Updated SignIn component to handle FORCE_CHANGE_PASSWORD${NC}"
echo -e "${GREEN}✅ Added AuthDebug component for troubleshooting${NC}"
echo -e "${GREEN}✅ Added better error handling and logging${NC}"
echo -e "${GREEN}✅ Added password validation for production requirements${NC}"
echo ""
echo -e "${YELLOW}📋 Testing Instructions:${NC}"
echo "1. Deploy the updated frontend to production"
echo "2. Try signing in with a user in FORCE_CHANGE_PASSWORD status"
echo "3. The app should now show a password change form"
echo "4. Visit /auth-debug to check authentication configuration"
echo ""
echo -e "${YELLOW}🚀 To deploy to production:${NC}"
echo "Run your normal deployment process or:"
echo "git add ."
echo "git commit -m 'Fix: Handle FORCE_CHANGE_PASSWORD in frontend'"
echo "git push"
echo ""
echo -e "${YELLOW}🔧 For local testing:${NC}"
echo "npm run dev  # Start development server"
echo "# Then visit http://localhost:5173/auth-debug"