#!/bin/bash

# Quick CORS Fix for Custom Domain
# Deploys the updated CORS configuration to production

set -e

ENVIRONMENT="prod"
REGION="eu-west-1"
CUSTOM_DOMAIN="wheresmystuff.johnduckmanton.co.uk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "🔧 Fixing CORS configuration for custom domain: ${CUSTOM_DOMAIN}"

# Check if we're in the right directory
if [ ! -f "template.yaml" ]; then
    error "template.yaml not found. Please run this script from the project root."
    exit 1
fi

# Build the project
log "📦 Building SAM application..."
sam build --region $REGION

if [ $? -ne 0 ]; then
    error "SAM build failed"
    exit 1
fi

# Deploy with updated CORS configuration
log "🚀 Deploying CORS fix to production..."

S3_BUCKET="home-inventory-sam-deployment-prod-1766535400"

# Get current CloudFront URL from stack outputs
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name home-inventory-cloudfront-prod \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$CLOUDFRONT_URL" ]; then
    warn "Could not get CloudFront URL, using default"
    CLOUDFRONT_URL="https://dxsbdfkdwk7dz.cloudfront.net"
fi

log "CloudFront URL: $CLOUDFRONT_URL"
log "Custom Domain: https://$CUSTOM_DOMAIN"

# Deploy the backend with updated CORS
sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name home-inventory-system-prod \
    --s3-bucket "$S3_BUCKET" \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --region $REGION \
    --parameter-overrides \
        Environment=prod \
        EnableDeletionProtection=true \
        LogRetentionDays=7 \
        CloudFrontOrigin="$CLOUDFRONT_URL" \
        CustomDomainName="$CUSTOM_DOMAIN"

if [ $? -eq 0 ]; then
    success "✅ CORS configuration updated successfully!"
    
    log "🧪 Testing CORS configuration..."
    
    # Get API URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name home-inventory-system-prod \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)
    
    log "API URL: $API_URL"
    
    # Test CORS with custom domain
    log "Testing CORS from custom domain..."
    CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/health" \
        -H "Origin: https://$CUSTOM_DOMAIN" \
        -H "Access-Control-Request-Method: GET" || echo "CORS test failed")
    
    if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
        success "✅ CORS working for custom domain!"
    else
        warn "⚠️  CORS test inconclusive. Check manually:"
        echo "curl -I -X OPTIONS '$API_URL/health' -H 'Origin: https://$CUSTOM_DOMAIN' -H 'Access-Control-Request-Method: GET'"
    fi
    
    log "🎉 Deployment complete! Your custom domain should now work."
    log "   Custom Domain: https://$CUSTOM_DOMAIN"
    log "   API URL: $API_URL"
    
else
    error "❌ Deployment failed"
    exit 1
fi