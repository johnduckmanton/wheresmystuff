#!/bin/bash

# Create a user in the specified Cognito User Pool environment
# Usage: ./scripts/create-user.sh <environment> <email> <temporary-password>
# Environment: dev or prod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -ne 3 ]; then
    echo -e "${RED}Usage: $0 <environment> <email> <temporary-password>${NC}"
    echo "Environment: dev or prod"
    echo "Example: $0 dev user@example.com TempPass123!"
    echo "Example: $0 prod user@example.com TempPass123!"
    exit 1
fi

ENVIRONMENT="$1"
EMAIL="$2"
TEMP_PASSWORD="$3"

# Validate environment
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}❌ Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

echo -e "${GREEN}🔍 Creating user in ${ENVIRONMENT} Cognito User Pool${NC}"
echo "=============================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or no valid credentials${NC}"
    echo "Please run 'aws configure' first"
    exit 1
fi

# Get the User Pool ID based on environment
echo -e "${BLUE}Getting User Pool ID for ${ENVIRONMENT} environment...${NC}"

if [ "$ENVIRONMENT" = "prod" ]; then
    STACK_NAME="home-inventory-system-prod"
    FALLBACK_USER_POOL_ID=""
    PASSWORD_REQUIREMENTS="Minimum 12 characters, uppercase, lowercase, numbers, and symbols"
elif [ "$ENVIRONMENT" = "dev" ]; then
    STACK_NAME="home-inventory-system-dev"
    FALLBACK_USER_POOL_ID="eu-west-1_VM85YGyV9"  # From CloudFormation
    PASSWORD_REQUIREMENTS="Minimum 8 characters, uppercase, lowercase, numbers"
fi

# Try to get User Pool ID from CloudFormation
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region eu-west-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
    if [ -n "$FALLBACK_USER_POOL_ID" ]; then
        echo -e "${YELLOW}⚠️  Could not find User Pool ID from CloudFormation stack${NC}"
        echo "Using fallback User Pool ID for ${ENVIRONMENT}..."
        USER_POOL_ID="$FALLBACK_USER_POOL_ID"
    else
        echo -e "${RED}❌ Could not find User Pool ID from CloudFormation stack${NC}"
        echo "Make sure the ${ENVIRONMENT} stack is deployed"
        exit 1
    fi
fi

echo -e "${GREEN}✅ User Pool ID: ${USER_POOL_ID}${NC}"

# Create the user
echo -e "${BLUE}Creating user: ${EMAIL}${NC}"
aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --temporary-password "$TEMP_PASSWORD" \
    --message-action SUPPRESS \
    --region eu-west-1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User created successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📋 User Details:${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Email: $EMAIL"
    echo "Temporary Password: $TEMP_PASSWORD"
    echo "User Pool ID: $USER_POOL_ID"
    echo ""
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "1. The user will need to log in with the temporary password"
    echo "2. They will be prompted to set a permanent password on first login"
    echo "3. Password requirements: $PASSWORD_REQUIREMENTS"
    echo ""
    echo -e "${YELLOW}🔗 Frontend URLs:${NC}"
    if [ "$ENVIRONMENT" = "dev" ]; then
        echo "Development: http://localhost:5173 (npm run dev)"
        echo "Deployed Dev: https://wheresmystuff.johnduckmanton.co.uk"
    else
        echo "Production: https://wheresmystuff.johnduckmanton.co.uk"
    fi
else
    echo -e "${RED}❌ Failed to create user${NC}"
    exit 1
fi