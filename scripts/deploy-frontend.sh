#!/bin/bash

# Frontend Deployment Script for AWS
# This script builds and deploys the React frontend to S3 and CloudFront

set -e  # Exit on any error

echo "🚀 Starting Frontend Deployment to AWS..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "template.yaml" ]; then
    echo -e "${RED}❌ Error: template.yaml not found. Please run this script from the project root.${NC}"
    exit 1
fi

if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: frontend directory not found.${NC}"
    exit 1
fi

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required but not installed.${NC}" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq is required but not installed. Install with: brew install jq${NC}" >&2; exit 1; }

# Get stack name and region
BACKEND_STACK_NAME=${1:-home-inventory-system}
CLOUDFRONT_STACK_NAME=${2:-home-inventory-cloudfront}
AWS_REGION=${3:-eu-west-1}
CLOUDFRONT_REGION=${4:-us-east-1}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Backend Stack: $BACKEND_STACK_NAME"
echo "   CloudFront Stack: $CLOUDFRONT_STACK_NAME"
echo "   Backend Region: $AWS_REGION"
echo "   CloudFront Region: $CLOUDFRONT_REGION"
echo ""

# Function to get stack outputs
get_stack_outputs() {
    local stack_name=$1
    local region=$2
    aws cloudformation describe-stacks --stack-name "$stack_name" --region "$region" --query 'Stacks[0].Outputs' --output json 2>/dev/null || echo "[]"
}

# Function to extract output value
get_output_value() {
    local outputs=$1
    local key=$2
    echo "$outputs" | jq -r ".[] | select(.OutputKey==\"$key\") | .OutputValue // empty"
}

# Get backend stack outputs
echo -e "${YELLOW}🔍 Getting backend stack information...${NC}"
BACKEND_OUTPUTS=$(get_stack_outputs "$BACKEND_STACK_NAME" "$AWS_REGION")

if [ "$BACKEND_OUTPUTS" = "[]" ]; then
    echo -e "${RED}❌ Backend stack '$BACKEND_STACK_NAME' not found or has no outputs.${NC}"
    echo "   Please deploy the backend infrastructure first:"
    echo "   sam build && sam deploy --region $AWS_REGION"
    exit 1
fi

# Extract backend values
API_URL=$(get_output_value "$BACKEND_OUTPUTS" "ApiUrl")
USER_POOL_ID=$(get_output_value "$BACKEND_OUTPUTS" "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output_value "$BACKEND_OUTPUTS" "UserPoolClientId")
WEBSITE_BUCKET=$(get_output_value "$BACKEND_OUTPUTS" "WebsiteBucket")
PHOTO_BUCKET=$(get_output_value "$BACKEND_OUTPUTS" "BucketName")

echo -e "${BLUE}📊 Backend Stack Outputs:${NC}"
echo "   API URL: ${API_URL:-'Not found'}"
echo "   User Pool ID: ${USER_POOL_ID:-'Not found'}"
echo "   User Pool Client ID: ${USER_POOL_CLIENT_ID:-'Not found'}"
echo "   Website Bucket: ${WEBSITE_BUCKET:-'Not found'}"
echo "   Photo Bucket: ${PHOTO_BUCKET:-'Not found'}"
echo ""

# Check if we have the required backend outputs
if [ -z "$API_URL" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ] || [ -z "$WEBSITE_BUCKET" ]; then
    echo -e "${RED}❌ Missing required backend stack outputs. Please ensure the backend is properly deployed.${NC}"
    exit 1
fi

# Get CloudFront stack outputs (optional)
echo -e "${YELLOW}🔍 Getting CloudFront stack information...${NC}"
CLOUDFRONT_OUTPUTS=$(get_stack_outputs "$CLOUDFRONT_STACK_NAME" "$CLOUDFRONT_REGION")

CLOUDFRONT_URL=""
DISTRIBUTION_ID=""

if [ "$CLOUDFRONT_OUTPUTS" != "[]" ]; then
    CLOUDFRONT_URL=$(get_output_value "$CLOUDFRONT_OUTPUTS" "CloudFrontUrl")
    DISTRIBUTION_ID=$(get_output_value "$CLOUDFRONT_OUTPUTS" "CloudFrontDistributionId")
    
    echo -e "${BLUE}📊 CloudFront Stack Outputs:${NC}"
    echo "   CloudFront URL: ${CLOUDFRONT_URL:-'Not found'}"
    echo "   Distribution ID: ${DISTRIBUTION_ID:-'Not found'}"
else
    echo -e "${YELLOW}⚠️  CloudFront stack '$CLOUDFRONT_STACK_NAME' not found. Will use S3 website hosting only.${NC}"
fi
echo ""

# Build the frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

# Create production environment file
echo -e "${BLUE}⚙️  Configuring environment variables...${NC}"
cat > .env.production << EOF
# AWS Configuration for Production
VITE_AWS_REGION=$AWS_REGION
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_API_URL=$API_URL
VITE_S3_BUCKET=$PHOTO_BUCKET
VITE_ENVIRONMENT=production
EOF

echo "   Environment file created with production values"

# Build the application
echo "   Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend build completed successfully!${NC}"

# Go back to project root
cd ..

# Upload files to S3
echo -e "${YELLOW}📤 Uploading files to S3...${NC}"

# Upload with appropriate cache headers
# Static assets (JS, CSS, images) - long cache
aws s3 sync frontend/dist/ s3://$WEBSITE_BUCKET/ \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "*.json" \
    --exclude "*.txt"

# HTML files and manifests - short cache for SPA routing
aws s3 sync frontend/dist/ s3://$WEBSITE_BUCKET/ \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json" \
    --include "*.txt"

echo -e "${GREEN}✅ Files uploaded to S3 successfully!${NC}"

# Invalidate CloudFront cache if distribution exists
if [ -n "$DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --region $CLOUDFRONT_REGION \
        --query 'Invalidation.Id' \
        --output text)
    
    echo "   Invalidation ID: $INVALIDATION_ID"
    echo -e "${GREEN}✅ CloudFront cache invalidation started!${NC}"
    echo -e "${YELLOW}   Note: It may take 5-15 minutes for changes to propagate globally.${NC}"
else
    echo -e "${YELLOW}⚠️  No CloudFront distribution found. Skipping cache invalidation.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Frontend deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Your application is available at:${NC}"

if [ -n "$CLOUDFRONT_URL" ]; then
    echo "   🌐 CloudFront URL: $CLOUDFRONT_URL"
    echo "   📝 Recommended: Use CloudFront URL for production"
else
    # Construct S3 website URL
    S3_WEBSITE_URL="http://$WEBSITE_BUCKET.s3-website-$AWS_REGION.amazonaws.com"
    echo "   🪣 S3 Website URL: $S3_WEBSITE_URL"
    echo -e "${YELLOW}   📝 Note: Consider setting up CloudFront for better performance and HTTPS${NC}"
fi

echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
if [ -n "$DISTRIBUTION_ID" ]; then
    echo "   1. Wait 5-15 minutes for CloudFront to propagate changes globally"
    echo "   2. Open the CloudFront URL in your browser"
else
    echo "   1. Open the S3 website URL in your browser"
    echo "   2. Consider deploying CloudFront for production use"
fi
echo "   3. Sign up/login to start using the application"
echo ""
echo -e "${BLUE}🔧 To redeploy frontend changes:${NC}"
echo "   ./scripts/deploy-frontend.sh"
echo ""
echo -e "${BLUE}🔍 To check deployment status:${NC}"
if [ -n "$DISTRIBUTION_ID" ]; then
    echo "   aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID --region $CLOUDFRONT_REGION"
fi
echo "   aws s3 ls s3://$WEBSITE_BUCKET/"