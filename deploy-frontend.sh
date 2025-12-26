#!/bin/bash

# Frontend deployment script using stored configuration
# This avoids repeatedly looking up the same AWS resources

set -e

# Load configuration
CONFIG_FILE="deployment-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file $CONFIG_FILE not found"
    exit 1
fi

# Extract values from config (requires jq)
if command -v jq >/dev/null 2>&1; then
    S3_BUCKET=$(jq -r '.aws.s3.frontend' "$CONFIG_FILE")
    CLOUDFRONT_ID=$(jq -r '.aws.cloudfront.distributionId' "$CONFIG_FILE")
    CLOUDFRONT_DOMAIN=$(jq -r '.aws.cloudfront.domainName' "$CONFIG_FILE")
else
    # Fallback if jq is not available
    S3_BUCKET="home-inv-frontend-982081071280-dev"
    CLOUDFRONT_ID="E3G1KKV4TAIPFR"
    CLOUDFRONT_DOMAIN="d24t9lc3ds7gry.cloudfront.net"
fi

echo "🚀 Deploying Frontend"
echo "===================="
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront: $CLOUDFRONT_ID"
echo "Domain: $CLOUDFRONT_DOMAIN"
echo ""

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Deploy to S3
echo "☁️ Uploading to S3..."
aws s3 sync frontend/dist/ s3://$S3_BUCKET --delete

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "✅ Deployment complete!"
echo "📋 Invalidation ID: $INVALIDATION_ID"
echo "🌐 URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo "⏳ Cache invalidation in progress (usually takes 1-3 minutes)"
echo "💡 You can check status with: aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"