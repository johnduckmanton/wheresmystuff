#!/bin/bash

# Test CORS Configuration
# Tests CORS headers from different origins

set -e

REGION="eu-west-1"
CUSTOM_DOMAIN="wheresmystuff.johnduckmanton.co.uk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get API URL from CloudFormation
log "Getting API URL from CloudFormation..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name home-inventory-system-prod \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

if [ -z "$API_URL" ]; then
    error "Could not get API URL from CloudFormation stack"
    exit 1
fi

log "API URL: $API_URL"

# Test CORS from custom domain
log "🧪 Testing CORS from custom domain: https://$CUSTOM_DOMAIN"
echo "Command: curl -I -X OPTIONS '$API_URL/health' -H 'Origin: https://$CUSTOM_DOMAIN' -H 'Access-Control-Request-Method: GET'"
echo ""

CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/health" \
    -H "Origin: https://$CUSTOM_DOMAIN" \
    -H "Access-Control-Request-Method: GET")

echo "Response headers:"
echo "$CORS_RESPONSE"
echo ""

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    ALLOWED_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | cut -d' ' -f2- | tr -d '\r')
    success "✅ CORS headers present!"
    log "Allowed Origin: $ALLOWED_ORIGIN"
    
    if echo "$ALLOWED_ORIGIN" | grep -q "$CUSTOM_DOMAIN"; then
        success "✅ Custom domain is allowed!"
    else
        warn "⚠️  Custom domain not explicitly in allowed origins"
        log "This might still work if wildcard or * is used"
    fi
else
    error "❌ No CORS headers found"
    warn "This means CORS is not configured properly"
fi

echo ""

# Test actual API call
log "🧪 Testing actual API call from custom domain..."
echo "Command: curl -s -H 'Origin: https://$CUSTOM_DOMAIN' '$API_URL/health'"
echo ""

API_RESPONSE=$(curl -s -w "HTTP_CODE:%{http_code}" -H "Origin: https://$CUSTOM_DOMAIN" "$API_URL/health")
HTTP_CODE=$(echo "$API_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$API_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

log "HTTP Status: $HTTP_CODE"
log "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" = "200" ]; then
    success "✅ API call successful!"
else
    error "❌ API call failed with status $HTTP_CODE"
fi

echo ""
log "🎯 Summary:"
if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin" && [ "$HTTP_CODE" = "200" ]; then
    success "✅ CORS is working correctly for your custom domain!"
    log "Your frontend at https://$CUSTOM_DOMAIN should be able to make API calls"
else
    error "❌ CORS configuration needs attention"
    log "Check the CloudFormation template and redeploy if needed"
fi