#!/bin/bash

# Test and Deploy Script
# Usage: ./scripts/test-and-deploy.sh [backend|frontend|both]

set -e

DEPLOY_TYPE=${1:-both}

echo "🚀 Starting deployment process for: $DEPLOY_TYPE"

# Function to deploy backend
deploy_backend() {
    echo "📦 Building and deploying backend..."
    sam build
    sam deploy --no-confirm-changeset
    echo "✅ Backend deployed successfully"
}

# Function to deploy frontend
deploy_frontend() {
    echo "🎨 Building and deploying frontend..."
    cd frontend
    npm run build
    cd ..
    aws s3 sync frontend/dist/ s3://home-inventory-frontend-982081071280-dev --delete
    aws cloudfront create-invalidation --distribution-id E3PZJWB45EVZ3Q --paths "/*"
    echo "✅ Frontend deployed successfully"
}

# Deploy based on argument
case $DEPLOY_TYPE in
    "backend")
        deploy_backend
        ;;
    "frontend")
        deploy_frontend
        ;;
    "both")
        deploy_backend
        deploy_frontend
        ;;
    *)
        echo "❌ Invalid deployment type. Use: backend, frontend, or both"
        exit 1
        ;;
esac

echo "🎉 Deployment complete!"
echo "🌐 Application URL: https://d2m4d2elac4ekv.cloudfront.net"
echo "🔗 API URL: https://f5jrvv9716.execute-api.eu-west-1.amazonaws.com/dev"