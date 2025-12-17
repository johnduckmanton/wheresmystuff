#!/bin/bash

# Script to fix the deployment issue and redeploy

echo "🔧 Fixing CloudFormation template and redeploying..."
echo "================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📋 Deployment options:${NC}"
echo "1. Try to deploy with fixed CloudFront configuration"
echo "2. Use simple S3 website hosting (recommended for now)"
echo ""

read -p "Choose option (1 or 2): " choice

case $choice in
    1)
        echo -e "${YELLOW}🚀 Attempting CloudFront deployment...${NC}"
        sam build
        if sam deploy; then
            echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
            echo "Now run: ./scripts/deploy-frontend.sh"
        else
            echo -e "${RED}❌ CloudFront deployment failed. Try option 2.${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${YELLOW}🚀 Using simple S3 website hosting...${NC}"
        
        # Check if backend is already deployed (without frontend resources)
        if aws cloudformation describe-stacks --stack-name home-inventory-system >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend stack exists. Deploying frontend...${NC}"
            ./scripts/deploy-frontend-simple.sh
        else
            echo -e "${RED}❌ Backend stack not found. Deploy backend first:${NC}"
            echo "   sam build && sam deploy"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid option. Please choose 1 or 2.${NC}"
        exit 1
        ;;
esac