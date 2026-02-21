#!/bin/bash

# Setup UPC Database API Key in AWS Secrets Manager
# Usage: ./scripts/setup-upc-api-key.sh <api-key> [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -lt 1 ]; then
    echo -e "${RED}Usage: $0 <api-key> [environment]${NC}"
    echo "Example: $0 your-api-key-here dev"
    echo ""
    echo "Environment defaults to 'dev' if not specified"
    exit 1
fi

API_KEY="$1"
ENVIRONMENT="${2:-dev}"
SECRET_NAME="home-inv-upc-api-key-${ENVIRONMENT}"
REGION="eu-west-1"

echo -e "${GREEN}🔐 Setting up UPC Database API Key in AWS Secrets Manager${NC}"
echo "=============================================="
echo "Secret Name: ${SECRET_NAME}"
echo "Region: ${REGION}"
echo "Environment: ${ENVIRONMENT}"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or no valid credentials${NC}"
    echo "Please run 'aws configure' first"
    exit 1
fi

# Check if secret already exists
echo -e "${BLUE}Checking if secret already exists...${NC}"
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Secret already exists. Updating...${NC}"
    
    # Update existing secret
    aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string "{\"apiKey\":\"$API_KEY\"}" \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Secret updated successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to update secret${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}Creating new secret...${NC}"
    
    # Create new secret
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "UPC Database API Key for barcode lookups - ${ENVIRONMENT}" \
        --secret-string "{\"apiKey\":\"$API_KEY\"}" \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Secret created successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to create secret${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Deploy your Lambda function with the updated template.yaml"
echo "2. The BarcodeFunction will automatically retrieve the API key from Secrets Manager"
echo "3. The API key is cached in memory for performance"
echo ""
echo -e "${BLUE}💡 To verify the secret:${NC}"
echo "aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION"
