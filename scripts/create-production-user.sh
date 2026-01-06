#!/bin/bash

# Create a user in the production Cognito User Pool
# Usage: ./scripts/create-production-user.sh <email> <temporary-password>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -ne 2 ]; then
    echo -e "${RED}Usage: $0 <email> <temporary-password>${NC}"
    echo "Example: $0 user@example.com TempPass123!"
    exit 1
fi

EMAIL="$1"
TEMP_PASSWORD="$2"
ENVIRONMENT="prod"

echo -e "${GREEN}🔍 Creating user in production Cognito User Pool${NC}"
echo "=============================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or no valid credentials${NC}"
    echo "Please run 'aws configure' first"
    exit 1
fi

# Get the User Pool ID from CloudFormation stack
echo -e "${BLUE}Getting User Pool ID from CloudFormation stack...${NC}"
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name home-inventory-system-prod \
    --region eu-west-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
    echo -e "${RED}❌ Could not find User Pool ID from CloudFormation stack${NC}"
    echo "Make sure the production stack is deployed"
    exit 1
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
    echo "Email: $EMAIL"
    echo "Temporary Password: $TEMP_PASSWORD"
    echo "User Pool ID: $USER_POOL_ID"
    echo ""
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "1. The user will need to log in with the temporary password"
    echo "2. They will be prompted to set a permanent password on first login"
    echo "3. The password must meet the production requirements:"
    echo "   - Minimum 12 characters"
    echo "   - Must contain uppercase, lowercase, numbers, and symbols"
else
    echo -e "${RED}❌ Failed to create user${NC}"
    exit 1
fi