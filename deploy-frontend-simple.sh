#!/bin/bash

# Simple frontend deployment script
set -e

echo "🚀 Deploying Frontend (Simple)"
echo "=============================="

# Get values from CloudFormation stacks
echo "📋 Getting deployment configuration..."

S3_BUCKET=$(aws cloudformation describe-stacks --stack-name home-inventory-system --region eu-west-1 --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" --output text)
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name home-inventory-cloudfront --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name home-inventory-cloudfront --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text)

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