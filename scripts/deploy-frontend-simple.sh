#!/bin/bash

# Simple Frontend Deployment Script for AWS S3 Website Hosting
# This script deploys the frontend using S3 static website hosting (without CloudFront initially)

set -e  # Exit on any error

echo "🚀 Starting Simple Frontend Deployment to AWS S3..."
echo "=================================================="

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
STACK_NAME=${1:-home-inventory-system}
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
USER_POOL_ID=$(get_output_value "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output_value "UserPoolClientId")
PHOTO_BUCKET=$(get_output_value "BucketName")

echo -e "${BLUE}📊 Stack Outputs:${NC}"
echo "   API URL: ${API_URL:-'Not found'}"
echo "   User Pool ID: ${USER_POOL_ID:-'Not found'}"
echo "   User Pool Client ID: ${USER_POOL_CLIENT_ID:-'Not found'}"
echo "   Photo Bucket: ${PHOTO_BUCKET:-'Not found'}"
echo ""

# Check if we have the required outputs
if [ -z "$API_URL" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ]; then
    echo -e "${RED}❌ Missing required stack outputs. Please ensure the backend is properly deployed.${NC}"
    exit 1
fi

# Create S3 bucket for frontend
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
FRONTEND_BUCKET="home-inventory-frontend-$ACCOUNT_ID-simple"

echo -e "${YELLOW}🪣 Setting up S3 bucket for frontend hosting...${NC}"

# Check if bucket exists
if aws s3 ls "s3://$FRONTEND_BUCKET" 2>/dev/null; then
    echo "   Bucket $FRONTEND_BUCKET already exists"
else
    echo "   Creating bucket $FRONTEND_BUCKET"
    
    # Create bucket
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb s3://$FRONTEND_BUCKET --region $AWS_REGION
    else
        aws s3 mb s3://$FRONTEND_BUCKET --region $AWS_REGION --create-bucket-configuration LocationConstraint=$AWS_REGION
    fi
fi

# Disable public access block for website hosting FIRST
echo "   Disabling public access block..."
aws s3api put-public-access-block --bucket $FRONTEND_BUCKET --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Configure bucket for static website hosting
echo "   Configuring static website hosting..."
aws s3 website s3://$FRONTEND_BUCKET --index-document index.html --error-document index.html

# Set bucket policy for public read access
echo "   Setting bucket policy for public access..."
cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$FRONTEND_BUCKET/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $FRONTEND_BUCKET --policy file:///tmp/bucket-policy.json
rm /tmp/bucket-policy.json

echo -e "${GREEN}✅ S3 bucket configured for website hosting${NC}"

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
VITE_S3_BUCKET=$PHOTO_BUCKET
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
aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET --delete

echo -e "${GREEN}✅ Files uploaded to S3 successfully!${NC}"

# Get the website URL
WEBSITE_URL="http://$FRONTEND_BUCKET.s3-website-$AWS_REGION.amazonaws.com"

echo ""
echo -e "${GREEN}🎉 Frontend deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Your application is available at:${NC}"
echo "   🌐 Website URL: $WEBSITE_URL"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Open the URL in your browser"
echo "   2. Sign up/login to start using the application"
echo "   3. Test the new category colors and icons"
echo ""
echo -e "${BLUE}🔧 To redeploy frontend changes:${NC}"
echo "   ./scripts/deploy-frontend-simple.sh"
echo ""
echo -e "${YELLOW}⚠️  Note: This uses HTTP (not HTTPS). For production, use CloudFront deployment.${NC}"