#!/bin/bash

# Home Inventory System - Deployment Verification Script

set -e

echo "=========================================="
echo "Home Inventory System - Deployment Verification"
echo "=========================================="
echo ""

# Configuration from deployment outputs
USER_POOL_ID="us-east-1_qL27rL63E"
CLIENT_ID="6lcv99ikkeekm526u8slo96vb9"
API_URL="https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev"
BUCKET_NAME="home-inventory-photos-982081071280-dev"
TABLE_NAME="home-inventory-dev"
REGION="us-east-1"

echo "Configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  API URL: $API_URL"
echo "  Bucket: $BUCKET_NAME"
echo "  Table: $TABLE_NAME"
echo "  Region: $REGION"
echo ""

# 1. Verify AWS Resources
echo "1. Verifying AWS Resources..."
echo "   - Checking DynamoDB table..."
aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "     ✓ DynamoDB table exists"
else
    echo "     ✗ DynamoDB table not found"
    exit 1
fi

echo "   - Checking S3 bucket..."
aws s3 ls "s3://$BUCKET_NAME" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "     ✓ S3 bucket exists"
else
    echo "     ✗ S3 bucket not found"
    exit 1
fi

echo "   - Checking Cognito User Pool..."
aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "     ✓ Cognito User Pool exists"
else
    echo "     ✗ Cognito User Pool not found"
    exit 1
fi

echo ""

# 2. Verify Lambda Functions
echo "2. Verifying Lambda Functions..."
FUNCTIONS=("ThingsFunction" "LocationsFunction" "RoomsFunction" "CategoriesFunction" "PeopleFunction" "PhotoFunction")
for func in "${FUNCTIONS[@]}"; do
    # Check if any function with this name exists (with random suffix)
    FOUND=$(aws lambda list-functions --region "$REGION" --query "Functions[?contains(FunctionName, '$func')].FunctionName" --output text 2>/dev/null)
    if [ -n "$FOUND" ]; then
        echo "   ✓ $func deployed"
    else
        echo "   ✗ $func not found"
    fi
done

echo ""

# 3. Verify API Gateway
echo "3. Verifying API Gateway..."
echo "   - Testing API endpoint (should return 401 without auth)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/things")
if [ "$HTTP_CODE" = "401" ]; then
    echo "     ✓ API Gateway is responding (401 Unauthorized as expected)"
else
    echo "     ⚠ API Gateway returned HTTP $HTTP_CODE (expected 401)"
fi

echo ""

# 4. Create Test User
echo "4. Creating test user..."
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"

echo "   - Signing up user: $TEST_EMAIL"
aws cognito-idp sign-up \
    --client-id "$CLIENT_ID" \
    --username "$TEST_EMAIL" \
    --password "$TEST_PASSWORD" \
    --region "$REGION" \
    > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "     ✓ User signed up successfully"
    
    echo "   - Confirming user..."
    aws cognito-idp admin-confirm-sign-up \
        --user-pool-id "$USER_POOL_ID" \
        --username "$TEST_EMAIL" \
        --region "$REGION" \
        > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "     ✓ User confirmed successfully"
    else
        echo "     ✗ Failed to confirm user"
    fi
else
    echo "     ⚠ User signup failed (may already exist)"
fi

echo ""

# 5. Test Authentication
echo "5. Testing Authentication..."
echo "   - Initiating auth..."
AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$CLIENT_ID" \
    --auth-parameters "USERNAME=$TEST_EMAIL,PASSWORD=$TEST_PASSWORD" \
    --region "$REGION" \
    2>&1)

if [ $? -eq 0 ]; then
    echo "     ✓ Authentication successful"
    
    # Extract JWT token
    JWT_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"IdToken":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$JWT_TOKEN" ]; then
        echo "     ✓ JWT token obtained"
        
        # 6. Test API with Authentication
        echo ""
        echo "6. Testing API Endpoints with Authentication..."
        
        # Test GET /things
        echo "   - Testing GET /things..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_URL/things")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "     ✓ GET /things returned 200"
        else
            echo "     ✗ GET /things returned $HTTP_CODE"
        fi
        
        # Test GET /locations
        echo "   - Testing GET /locations..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_URL/locations")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "     ✓ GET /locations returned 200"
        else
            echo "     ✗ GET /locations returned $HTTP_CODE"
        fi
        
        # Test GET /categories
        echo "   - Testing GET /categories..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_URL/categories")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "     ✓ GET /categories returned 200"
        else
            echo "     ✗ GET /categories returned $HTTP_CODE"
        fi
        
        # Test GET /people
        echo "   - Testing GET /people..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_URL/people")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "     ✓ GET /people returned 200"
        else
            echo "     ✗ GET /people returned $HTTP_CODE"
        fi
        
        # Test GET /rooms
        echo "   - Testing GET /rooms..."
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_URL/rooms")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "     ✓ GET /rooms returned 200"
        else
            echo "     ✗ GET /rooms returned $HTTP_CODE"
        fi
    else
        echo "     ✗ Failed to extract JWT token"
    fi
else
    echo "     ✗ Authentication failed"
    echo "$AUTH_RESPONSE"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Test User Credentials:"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
echo ""
echo "You can now:"
echo "1. Start the frontend development server:"
echo "   cd frontend && npm run dev"
echo ""
echo "2. Sign in with the test credentials above"
echo ""
echo "3. Test all CRUD operations through the UI"
echo ""
