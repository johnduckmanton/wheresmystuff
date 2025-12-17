#!/bin/bash

# Script to check if the environment is ready for frontend deployment

echo "🔍 Checking Deployment Readiness..."
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

READY=true

# Check AWS CLI
if command -v aws >/dev/null 2>&1; then
    echo -e "${GREEN}✅ AWS CLI installed${NC}"
    
    # Check AWS credentials
    if aws sts get-caller-identity >/dev/null 2>&1; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        echo -e "${GREEN}✅ AWS credentials configured (Account: $ACCOUNT_ID)${NC}"
    else
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        echo "   Run: aws configure"
        READY=false
    fi
else
    echo -e "${RED}❌ AWS CLI not installed${NC}"
    echo "   Install from: https://aws.amazon.com/cli/"
    READY=false
fi

# Check Node.js and npm
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js installed ($NODE_VERSION)${NC}"
else
    echo -e "${RED}❌ Node.js not installed${NC}"
    echo "   Install from: https://nodejs.org/"
    READY=false
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm installed ($NPM_VERSION)${NC}"
else
    echo -e "${RED}❌ npm not installed${NC}"
    READY=false
fi

# Check SAM CLI
if command -v sam >/dev/null 2>&1; then
    SAM_VERSION=$(sam --version | head -n1)
    echo -e "${GREEN}✅ SAM CLI installed ($SAM_VERSION)${NC}"
else
    echo -e "${YELLOW}⚠️  SAM CLI not installed (optional for frontend-only deployment)${NC}"
    echo "   Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
fi

# Check project structure
if [ -f "template.yaml" ]; then
    echo -e "${GREEN}✅ SAM template found${NC}"
else
    echo -e "${RED}❌ template.yaml not found${NC}"
    echo "   Make sure you're in the project root directory"
    READY=false
fi

if [ -d "frontend" ]; then
    echo -e "${GREEN}✅ Frontend directory found${NC}"
    
    if [ -f "frontend/package.json" ]; then
        echo -e "${GREEN}✅ Frontend package.json found${NC}"
    else
        echo -e "${RED}❌ Frontend package.json not found${NC}"
        READY=false
    fi
    
    if [ -f "frontend/vite.config.ts" ] || [ -f "frontend/vite.config.js" ]; then
        echo -e "${GREEN}✅ Vite config found${NC}"
    else
        echo -e "${YELLOW}⚠️  Vite config not found (may be using different build tool)${NC}"
    fi
else
    echo -e "${RED}❌ Frontend directory not found${NC}"
    READY=false
fi

# Check if backend is deployed
STACK_NAME=${1:-home-inventory-dev}
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend stack '$STACK_NAME' is deployed${NC}"
    
    # Check for required outputs
    OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[].OutputKey' --output text 2>/dev/null)
    
    if echo "$OUTPUTS" | grep -q "ApiUrl"; then
        echo -e "${GREEN}✅ API URL output found${NC}"
    else
        echo -e "${RED}❌ API URL output missing from stack${NC}"
        READY=false
    fi
    
    if echo "$OUTPUTS" | grep -q "UserPoolId"; then
        echo -e "${GREEN}✅ User Pool ID output found${NC}"
    else
        echo -e "${RED}❌ User Pool ID output missing from stack${NC}"
        READY=false
    fi
    
else
    echo -e "${RED}❌ Backend stack '$STACK_NAME' not found${NC}"
    echo "   Deploy backend first: sam build && sam deploy"
    READY=false
fi

echo ""
if [ "$READY" = true ]; then
    echo -e "${GREEN}🎉 Everything looks good! Ready to deploy frontend.${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "   1. Run: ./scripts/deploy-frontend.sh"
    echo "   2. Wait 2-3 minutes for CloudFront propagation"
    echo "   3. Open the provided URL in your browser"
    echo ""
else
    echo -e "${RED}❌ Please fix the issues above before deploying.${NC}"
    echo ""
    echo -e "${YELLOW}📋 Common fixes:${NC}"
    echo "   • Install missing tools (AWS CLI, Node.js, SAM CLI)"
    echo "   • Configure AWS credentials: aws configure"
    echo "   • Deploy backend first: sam build && sam deploy"
    echo "   • Make sure you're in the project root directory"
    exit 1
fi