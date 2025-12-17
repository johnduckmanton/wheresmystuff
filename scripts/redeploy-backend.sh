#!/bin/bash

# Script to redeploy the backend with HTML entity decoding fixes

echo "🚀 Redeploying backend with HTML entity decoding fixes..."
echo ""

# Check if we're in the right directory
if [ ! -f "template.yaml" ]; then
    echo "❌ Error: template.yaml not found. Please run this script from the project root."
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ Error: SAM CLI is not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "📦 Building SAM application..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "🚀 Deploying to AWS..."
sam deploy

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi

echo ""
echo "✅ Backend redeployment completed!"
echo ""
echo "🔧 The following fixes have been deployed:"
echo "   • HTML entity decoding for category names and descriptions"
echo "   • HTML entity decoding for all entity types (things, locations, people, rooms)"
echo "   • Comprehensive text field decoding across all handlers"
echo ""
echo "🌐 Please refresh your browser to see the changes."
echo "   Categories should now display '&' instead of '&amp;'"