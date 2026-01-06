#!/bin/bash

# Debug Production Authentication Issues
# This script helps diagnose authentication problems in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Debugging Production Authentication${NC}"
echo "========================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or no valid credentials${NC}"
    echo "Please run 'aws configure' first"
    exit 1
fi

ENVIRONMENT="prod"
STACK_NAME="home-inventory-system-prod"
REGION="eu-west-1"

echo -e "${BLUE}📋 Getting CloudFormation stack outputs...${NC}"

# Get stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "home-inventory-cloudfront-prod" \
    --region "us-east-1" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text 2>/dev/null || echo "Not found")

echo -e "${GREEN}✅ Stack Configuration:${NC}"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "API URL: $API_URL"
echo "CloudFront URL: $CLOUDFRONT_URL"
echo ""

# Check User Pool configuration
echo -e "${BLUE}🔍 Checking User Pool configuration...${NC}"
aws cognito-idp describe-user-pool \
    --user-pool-id "$USER_POOL_ID" \
    --region "$REGION" \
    --query '{
        UserPoolName: UserPool.Name,
        AllowAdminCreateUserOnly: UserPool.AdminCreateUserConfig.AllowAdminCreateUserOnly,
        AutoVerifiedAttributes: UserPool.AutoVerifiedAttributes,
        UsernameAttributes: UserPool.UsernameAttributes,
        MfaConfiguration: UserPool.MfaConfiguration,
        Status: UserPool.Status
    }' \
    --output table

echo ""

# Check User Pool Client configuration
echo -e "${BLUE}🔍 Checking User Pool Client configuration...${NC}"
aws cognito-idp describe-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-id "$USER_POOL_CLIENT_ID" \
    --region "$REGION" \
    --query '{
        ClientName: UserPoolClient.ClientName,
        ExplicitAuthFlows: UserPoolClient.ExplicitAuthFlows,
        GenerateSecret: UserPoolClient.GenerateSecret,
        SupportedIdentityProviders: UserPoolClient.SupportedIdentityProviders
    }' \
    --output table

echo ""

# List users in the User Pool
echo -e "${BLUE}👥 Checking users in User Pool...${NC}"
USERS=$(aws cognito-idp list-users \
    --user-pool-id "$USER_POOL_ID" \
    --region "$REGION" \
    --query 'Users[*].{Username:Username,Status:UserStatus,Email:Attributes[?Name==`email`].Value|[0],EmailVerified:Attributes[?Name==`email_verified`].Value|[0]}' \
    --output table)

if [ -z "$USERS" ] || echo "$USERS" | grep -q "None"; then
    echo -e "${YELLOW}⚠️  No users found in User Pool${NC}"
    echo "You may need to create a user first using:"
    echo "./scripts/create-production-user.sh user@example.com TempPass123!"
else
    echo "$USERS"
fi

echo ""

# Check frontend environment variables
echo -e "${BLUE}🌐 Checking frontend configuration...${NC}"
if [ "$CLOUDFRONT_URL" != "Not found" ]; then
    echo "Fetching frontend to check environment variables..."
    
    # Try to get the frontend and check if it has the right config
    FRONTEND_CONTENT=$(curl -s "$CLOUDFRONT_URL" || echo "Failed to fetch")
    
    if echo "$FRONTEND_CONTENT" | grep -q "VITE_USER_POOL_ID"; then
        echo -e "${GREEN}✅ Frontend appears to have environment variables${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend may not have environment variables configured${NC}"
        echo "Check if the frontend build included the correct .env.production file"
    fi
    
    # Check if we can access the frontend config endpoint (if it exists)
    CONFIG_CHECK=$(curl -s "$CLOUDFRONT_URL/config.js" 2>/dev/null || echo "No config.js found")
    if [ "$CONFIG_CHECK" != "No config.js found" ]; then
        echo "Frontend config.js content:"
        echo "$CONFIG_CHECK"
    fi
else
    echo -e "${RED}❌ CloudFront URL not found${NC}"
fi

echo ""

# Test API connectivity
echo -e "${BLUE}🔗 Testing API connectivity...${NC}"
API_HEALTH=$(curl -s "$API_URL/health" || echo "Failed to connect")
if echo "$API_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API is responding${NC}"
    echo "API Health: $API_HEALTH"
else
    echo -e "${RED}❌ API not responding properly${NC}"
    echo "Response: $API_HEALTH"
fi

echo ""

# Check CORS configuration
echo -e "${BLUE}🔒 Testing CORS configuration...${NC}"
if [ "$CLOUDFRONT_URL" != "Not found" ]; then
    CORS_TEST=$(curl -s -I -X OPTIONS "$API_URL/health" \
        -H "Origin: $CLOUDFRONT_URL" \
        -H "Access-Control-Request-Method: GET" || echo "CORS test failed")
    
    if echo "$CORS_TEST" | grep -qi "access-control-allow-origin"; then
        echo -e "${GREEN}✅ CORS is configured${NC}"
        echo "CORS headers:"
        echo "$CORS_TEST" | grep -i "access-control"
    else
        echo -e "${RED}❌ CORS may not be configured properly${NC}"
        echo "Response: $CORS_TEST"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot test CORS without CloudFront URL${NC}"
fi

echo ""
echo -e "${GREEN}🎯 Summary & Next Steps${NC}"
echo "========================"
echo ""
echo -e "${YELLOW}If sign-in 'does nothing':${NC}"
echo "1. Check browser developer console for JavaScript errors"
echo "2. Check Network tab for failed API calls"
echo "3. Verify the user exists and is in CONFIRMED status"
echo "4. Try with a different browser or incognito mode"
echo "5. Check if the user needs to change their temporary password"
echo ""
echo -e "${YELLOW}Common issues:${NC}"
echo "• User status is FORCE_CHANGE_PASSWORD (needs password reset)"
echo "• Frontend environment variables not loaded correctly"
echo "• CORS blocking the authentication request"
echo "• JavaScript errors preventing form submission"
echo "• Network connectivity issues"
echo ""
echo -e "${YELLOW}To create a test user:${NC}"
echo "./scripts/create-production-user.sh test@example.com TempPass123!"
echo ""
echo -e "${YELLOW}To check user status:${NC}"
echo "aws cognito-idp admin-get-user --user-pool-id $USER_POOL_ID --username <email> --region $REGION"