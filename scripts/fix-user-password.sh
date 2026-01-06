#!/bin/bash

# Fix user password issues by setting a permanent password
# Usage: ./scripts/fix-user-password.sh <email> <new-password>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -ne 2 ]; then
    echo -e "${RED}Usage: $0 <email> <new-password>${NC}"
    echo "Example: $0 user@example.com MySecurePass123!"
    echo ""
    echo -e "${YELLOW}Password requirements for production:${NC}"
    echo "- Minimum 12 characters"
    echo "- Must contain uppercase letters"
    echo "- Must contain lowercase letters"
    echo "- Must contain numbers"
    echo "- Must contain symbols"
    exit 1
fi

EMAIL="$1"
NEW_PASSWORD="$2"
REGION="eu-west-1"

echo -e "${GREEN}🔧 Fixing user password: ${EMAIL}${NC}"
echo "================================="

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
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
    echo -e "${RED}❌ Could not find User Pool ID from CloudFormation stack${NC}"
    exit 1
fi

echo -e "${GREEN}✅ User Pool ID: ${USER_POOL_ID}${NC}"

# Check if user exists
echo -e "${BLUE}Checking if user exists...${NC}"
if ! aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$REGION" > /dev/null 2>&1; then
    echo -e "${RED}❌ User not found: ${EMAIL}${NC}"
    echo "Create the user first with: ./scripts/create-production-user.sh $EMAIL TempPass123!"
    exit 1
fi

# Set permanent password
echo -e "${BLUE}Setting permanent password...${NC}"
aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$NEW_PASSWORD" \
    --permanent \
    --region "$REGION"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Password set successfully!${NC}"
    
    # Confirm the user (in case they weren't confirmed)
    echo -e "${BLUE}Confirming user account...${NC}"
    aws cognito-idp admin-confirm-sign-up \
        --user-pool-id "$USER_POOL_ID" \
        --username "$EMAIL" \
        --region "$REGION" 2>/dev/null || echo "User already confirmed"
    
    # Verify email
    echo -e "${BLUE}Verifying email address...${NC}"
    aws cognito-idp admin-update-user-attributes \
        --user-pool-id "$USER_POOL_ID" \
        --username "$EMAIL" \
        --user-attributes Name=email_verified,Value=true \
        --region "$REGION"
    
    echo -e "${GREEN}✅ User is ready for sign-in!${NC}"
    echo ""
    echo -e "${YELLOW}📋 User Details:${NC}"
    echo "Email: $EMAIL"
    echo "Password: $NEW_PASSWORD"
    echo "Status: CONFIRMED"
    echo "Email Verified: true"
    echo ""
    echo -e "${YELLOW}🎯 Next Steps:${NC}"
    echo "1. Try signing in at your production URL"
    echo "2. If it still doesn't work, check browser developer console for errors"
    echo "3. Run ./scripts/debug-production-auth.sh for more diagnostics"
else
    echo -e "${RED}❌ Failed to set password${NC}"
    echo "Check that the password meets the requirements:"
    echo "- Minimum 12 characters"
    echo "- Must contain uppercase, lowercase, numbers, and symbols"
    exit 1
fi