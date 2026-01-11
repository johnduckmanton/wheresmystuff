#!/bin/bash

# Frontend deployment script with environment support
set -e

# Parse command line arguments
ENVIRONMENT=${1:-dev}

# Show help if requested
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Frontend Deployment Script"
    echo "=========================="
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev|prod). Defaults to 'dev'"
    echo ""
    echo "Examples:"
    echo "  $0           # Deploy to dev environment"
    echo "  $0 dev       # Deploy to dev environment"
    echo "  $0 prod      # Deploy to prod environment"
    echo ""
    echo "This script will:"
    echo "  1. Build the frontend application"
    echo "  2. Upload files to the appropriate S3 bucket"
    echo "  3. Invalidate the CloudFront cache"
    echo ""
    exit 0
fi

echo "🚀 Deploying Frontend"
echo "===================="
echo "Environment: $ENVIRONMENT"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [dev|prod]"
    echo "Example: $0 dev"
    exit 1
fi

# Get values from CloudFormation stacks
echo "📋 Getting deployment configuration..."

S3_BUCKET=$(aws cloudformation describe-stacks --stack-name home-inventory-system-$ENVIRONMENT --region eu-west-1 --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" --output text)
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name home-inventory-cloudfront-$ENVIRONMENT --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name home-inventory-cloudfront-$ENVIRONMENT --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text)

# Validate that we got the required values
if [[ -z "$S3_BUCKET" || "$S3_BUCKET" == "None" ]]; then
    echo "❌ Failed to get S3 bucket from stack home-inventory-system-$ENVIRONMENT"
    exit 1
fi

if [[ -z "$CLOUDFRONT_ID" || "$CLOUDFRONT_ID" == "None" ]]; then
    echo "❌ Failed to get CloudFront distribution ID from stack home-inventory-cloudfront-$ENVIRONMENT"
    exit 1
fi

if [[ -z "$CLOUDFRONT_DOMAIN" || "$CLOUDFRONT_DOMAIN" == "None" ]]; then
    echo "❌ Failed to get CloudFront domain from stack home-inventory-cloudfront-$ENVIRONMENT"
    exit 1
fi

echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront ID: $CLOUDFRONT_ID"
echo "CloudFront URL: $CLOUDFRONT_DOMAIN"
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
echo "🌐 URL: $CLOUDFRONT_DOMAIN"
echo ""
echo "⏳ Cache invalidation in progress (usually takes 1-3 minutes)"
echo "💡 You can check status with: aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"