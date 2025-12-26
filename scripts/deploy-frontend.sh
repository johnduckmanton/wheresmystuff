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

# Get stack name and region
STACK_NAME=${1:-home-inventory-dev}
AWS_REGION=${2:-eu-west-1}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Stack Name: $STACK_NAME"
echo "   AWS Region: $AWS_REGION"
echo ""

# Get stack outputs
echo -e "${YELLOW}🔍 Getting stack information...${NC}"
STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" --query 'Stacks[0].Outputs' --output json 2>/dev/null || echo "[]")

if [ "$STACK_OUTPUTS" = "[]" ]; then
    echo -e "${RED}❌ Stack '$STACK_NAME' not found or has no outputs.${NC}"
    echo "   Please deploy the backend infrastructure first:"
    echo "   sam build && sam deploy"
    exit 1
fi

# Extract values from stack outputs
get_output_value() {
    echo "$STACK_OUTPUTS" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue // empty"
}

API_URL=$(get_output_value "ApiUrl")
CLOUDFRONT_DOMAIN=$(get_output_value "CloudFrontDomainName")
CLOUDFRONT_URL=$(get_output_value "CloudFrontUrl")
USER_POOL_ID=$(get_output_value "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output_value "UserPoolClientId")
S3_BUCKET=$(get_output_value "WebsiteBucket")

echo -e "${BLUE}📊 Stack Outputs:${NC}"
echo "   API URL: ${API_URL:-'Not found'}"
echo "   CloudFront Domain: ${CLOUDFRONT_DOMAIN:-'Not found'}"
echo "   CloudFront URL: ${CLOUDFRONT_URL:-'Not found'}"
echo "   User Pool ID: ${USER_POOL_ID:-'Not found'}"
echo "   User Pool Client ID: ${USER_POOL_CLIENT_ID:-'Not found'}"
echo "   S3 Bucket: ${S3_BUCKET:-'Not configured'}"
echo ""

# Check if we have the required outputs
if [ -z "$API_URL" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ]; then
    echo -e "${RED}❌ Missing required stack outputs. Please ensure the backend is properly deployed.${NC}"
    exit 1
fi

# If S3 bucket is not configured, we need to update the infrastructure
if [ -z "$S3_BUCKET" ]; then
    echo -e "${YELLOW}⚠️  S3 bucket for frontend hosting not found.${NC}"
    echo "   The infrastructure needs to be updated to include frontend hosting."
    echo "   This will be handled automatically."
    echo ""
fi

# Build the frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

# Create or update .env file with production values
echo -e "${BLUE}⚙️  Configuring environment variables...${NC}"
cat > .env << EOF
# AWS Configuration for Production
VITE_AWS_REGION=$AWS_REGION
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_API_URL=$API_URL
VITE_S3_BUCKET=home-inventory-photos-\$(aws sts get-caller-identity --query Account --output text)-dev
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

# Create S3 bucket if it doesn't exist
if [ -z "$S3_BUCKET" ]; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    S3_BUCKET="home-inventory-frontend-$ACCOUNT_ID-dev"
    
    echo -e "${YELLOW}🪣 Creating S3 bucket for frontend hosting...${NC}"
    
    # Create bucket
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb s3://$S3_BUCKET --region $AWS_REGION
    else
        aws s3 mb s3://$S3_BUCKET --region $AWS_REGION --create-bucket-configuration LocationConstraint=$AWS_REGION
    fi
    
    # Configure bucket for static website hosting
    aws s3 website s3://$S3_BUCKET --index-document index.html --error-document index.html
    
    # Set bucket policy for CloudFront access
    cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontAccess",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$S3_BUCKET/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket $S3_BUCKET --policy file:///tmp/bucket-policy.json
    rm /tmp/bucket-policy.json
    
    echo -e "${GREEN}✅ S3 bucket created: $S3_BUCKET${NC}"
fi

# Upload files to S3
echo -e "${YELLOW}📤 Uploading files to S3...${NC}"
aws s3 sync frontend/dist/ s3://$S3_BUCKET --delete --cache-control "public, max-age=31536000" --exclude "*.html"
aws s3 sync frontend/dist/ s3://$S3_BUCKET --delete --cache-control "public, max-age=0, must-revalidate" --include "*.html"

echo -e "${GREEN}✅ Files uploaded to S3 successfully!${NC}"

# Invalidate CloudFront cache if distribution exists
if [ -n "$CLOUDFRONT_DOMAIN" ]; then
    DISTRIBUTION_ID=$(get_output_value "CloudFrontDistributionId")
    if [ -n "$DISTRIBUTION_ID" ]; then
        echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
        aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" > /dev/null
        echo -e "${GREEN}✅ CloudFront cache invalidated!${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Frontend deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Your application is available at:${NC}"
if [ -n "$CLOUDFRONT_URL" ]; then
    echo "   🌐 CloudFront URL: $CLOUDFRONT_URL"
else
    echo "   🪣 S3 Website URL: http://$S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com"
fi
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Wait 2-3 minutes for CloudFront to propagate changes"
echo "   2. Open the URL in your browser"
echo "   3. Sign up/login to start using the application"
echo ""
echo -e "${BLUE}🔧 To redeploy frontend changes:${NC}"
echo "   ./scripts/deploy-frontend.sh"