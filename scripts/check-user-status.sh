#!/bin/bash

# Check the status of a specific user in the production Cognito User Pool
# Usage: ./scripts/check-user-status.sh <email>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -ne 1 ]; then
    echo -e "${RED}Usage: $0 <email>${NC}"
    echo "Example: $0 user@example.com"
    exit 1
fi

EMAIL="$1"
ENVIRONMENT="prod"
REGION="eu-west-1"

echo -e "${GREEN}🔍 Checking user status: ${EMAIL}${NC}"
echo "=================================="

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
    echo "Make sure the production stack is deployed"
    exit 1
fi

echo -e "${GREEN}✅ User Pool ID: ${USER_POOL_ID}${NC}"

# Check user details
echo -e "${BLUE}Checking user details...${NC}"
USER_INFO=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --region "$REGION" 2>/dev/null || echo "USER_NOT_FOUND")

if [ "$USER_INFO" = "USER_NOT_FOUND" ]; then
    echo -e "${RED}❌ User not found: ${EMAIL}${NC}"
    echo ""
    echo -e "${YELLOW}To create this user:${NC}"
    echo "./scripts/create-production-user.sh $EMAIL TempPass123!"
    exit 1
fi

# Parse user information
USER_STATUS=$(echo "$USER_INFO" | jq -r '.UserStatus')
USERNAME=$(echo "$USER_INFO" | jq -r '.Username')
ENABLED=$(echo "$USER_INFO" | jq -r '.Enabled')
EMAIL_VERIFIED=$(echo "$USER_INFO" | jq -r '.UserAttributes[] | select(.Name=="email_verified") | .Value')
EMAIL_ATTR=$(echo "$USER_INFO" | jq -r '.UserAttributes[] | select(.Name=="email") | .Value')

echo -e "${GREEN}✅ User found!${NC}"
echo ""
echo -e "${BLUE}User Details:${NC}"
echo "Username: $USERNAME"
echo "Email: $EMAIL_ATTR"
echo "Status: $USER_STATUS"
echo "Enabled: $ENABLED"
echo "Email Verified: $EMAIL_VERIFIED"

echo ""
echo -e "${BLUE}Status Explanation:${NC}"
case "$USER_STATUS" in
    "CONFIRMED")
        echo -e "${GREEN}✅ CONFIRMED - User can sign in normally${NC}"
        ;;
    "UNCONFIRMED")
        echo -e "${YELLOW}⚠️  UNCONFIRMED - User needs to verify their email${NC}"
        echo "The user should check their email for a verification code"
        ;;
    "FORCE_CHANGE_PASSWORD")
        echo -e "${YELLOW}⚠️  FORCE_CHANGE_PASSWORD - User must change their temporary password${NC}"
        echo "This is normal for admin-created users. The user needs to:"
        echo "1. Try to sign in with their temporary password"
        echo "2. They will be prompted to set a new password"
        echo "3. The new password must meet production requirements:"
        echo "   - Minimum 12 characters"
        echo "   - Must contain uppercase, lowercase, numbers, and symbols"
        ;;
    "RESET_REQUIRED")
        echo -e "${YELLOW}⚠️  RESET_REQUIRED - User needs a password reset${NC}"
        echo "You can reset the password using:"
        echo "aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username $EMAIL --password NewTempPass123! --permanent --region $REGION"
        ;;
    "ARCHIVED")
        echo -e "${RED}❌ ARCHIVED - User account is disabled${NC}"
        echo "You need to enable the user account"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Unknown status: $USER_STATUS${NC}"
        ;;
esac

if [ "$ENABLED" = "false" ]; then
    echo -e "${RED}❌ User account is disabled${NC}"
    echo "Enable the user with:"
    echo "aws cognito-idp admin-enable-user --user-pool-id $USER_POOL_ID --username $EMAIL --region $REGION"
fi

if [ "$EMAIL_VERIFIED" = "false" ]; then
    echo -e "${YELLOW}⚠️  Email is not verified${NC}"
    echo "Verify the email with:"
    echo "aws cognito-idp admin-update-user-attributes --user-pool-id $USER_POOL_ID --username $EMAIL --user-attributes Name=email_verified,Value=true --region $REGION"
fi

echo ""
echo -e "${BLUE}Recent sign-in attempts (if any):${NC}"
# This would require CloudWatch logs access, which might not be available
echo "Check CloudWatch logs for detailed sign-in attempts: /aws/cognito/userpools/$USER_POOL_ID"

echo ""
echo -e "${YELLOW}💡 Troubleshooting Tips:${NC}"
echo "1. If status is FORCE_CHANGE_PASSWORD, the user needs to complete password change flow"
echo "2. Check browser developer console for JavaScript errors"
echo "3. Check Network tab for failed authentication requests"
echo "4. Try signing in with a different browser or incognito mode"
echo "5. Ensure the frontend has the correct Cognito configuration"