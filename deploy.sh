#!/bin/bash

echo "🚀 Deploying Home Inventory System - Complete Template"
echo "====================================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Set default stack name
STACK_NAME=${1:-home-inventory-system-dev}
ENVIRONMENT=${2:-dev}
REGION=${3:-eu-west-1}

echo "Stack Name: $STACK_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Deploy the complete template
echo "Deploying template.yaml with ALL functionality..."
echo "This includes:"
echo "  ✅ Core inventory management (Things, Locations, Rooms, Categories, People)"
echo "  ✅ Photo management and AI analysis"
echo "  ✅ User management and authentication"
echo "  ✅ Complete moving storage system (Containers, Packing, QR Codes, Projects)"
echo "  ✅ Storage management and alerts"
echo "  ✅ Reports and analytics"
echo "  ✅ Advanced features (Container sharing, Notifications, Collaboration)"
echo "  ✅ Data migration and synchronization"
echo "  ✅ Audit logs and performance monitoring"
echo "  ✅ CloudFront distribution with WAF protection"
echo "  ✅ Complete monitoring and alerting"
echo ""

sam deploy \
    --template-file template.yaml \
    --stack-name $STACK_NAME \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --parameter-overrides Environment=$ENVIRONMENT

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "======================="
    
    # Get the outputs
    echo "Getting deployment outputs..."
    API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
    
    echo ""
    echo "📋 DEPLOYMENT DETAILS:"
    echo "Region: $REGION"
    echo "API URL: $API_URL"
    echo "User Pool ID: $USER_POOL_ID"
    echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
    echo "CloudFront URL: $CLOUDFRONT_URL"
    echo ""
    echo "🔧 NEXT STEPS:"
    echo "1. Update your frontend configuration with the above values"
    echo "2. Create your first user in Cognito"
    echo "3. Deploy your frontend to the S3 bucket"
    echo "4. Test all functionality"
    
else
    echo ""
    echo "❌ DEPLOYMENT FAILED!"
    echo "Check the error messages above for details."
    exit 1
fi