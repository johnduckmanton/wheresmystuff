#!/bin/bash

# Deploy Moving & Storage System Infrastructure
# This script deploys the complete infrastructure for the moving storage system

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check SAM CLI
    if ! command -v sam &> /dev/null; then
        error "SAM CLI is not installed"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    # Check if logged into AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        error "Not logged into AWS. Please run 'aws configure' or set AWS credentials"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Install backend dependencies
install_dependencies() {
    log "Installing backend dependencies..."
    
    cd backend
    if [ -f package.json ]; then
        npm install
        success "Backend dependencies installed"
    else
        warn "No package.json found in backend directory"
    fi
    cd ..
}

# Build and deploy infrastructure
deploy_infrastructure() {
    log "Building and deploying infrastructure..."
    
    # Build the SAM application
    log "Building SAM application..."
    sam build
    
    # Deploy the stack
    log "Deploying stack: ${STACK_NAME}"
    sam deploy \
        --stack-name "${STACK_NAME}" \
        --parameter-overrides \
            Environment="${ENVIRONMENT}" \
            EnableWAF=true \
            EnableAdvancedMonitoring=false \
        --capabilities CAPABILITY_IAM \
        --region "${REGION}" \
        --confirm-changeset \
        --resolve-s3
    
    success "Infrastructure deployed successfully"
}

# Deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    
    # Get stack outputs
    BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" \
        --output text)
    
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
        --output text)
    
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text)
    
    USER_POOL_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
        --output text)
    
    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
        --output text)
    
    # Build frontend
    cd frontend
    
    # Create environment file
    cat > .env.production << EOF
VITE_API_URL=${API_URL}
VITE_USER_POOL_ID=${USER_POOL_ID}
VITE_USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID}
VITE_REGION=${REGION}
VITE_ENVIRONMENT=${ENVIRONMENT}
EOF
    
    # Install dependencies and build
    npm install
    npm run build
    
    # Upload to S3
    log "Uploading frontend to S3..."
    aws s3 sync dist/ "s3://${BUCKET_NAME}/" --delete
    
    # Invalidate CloudFront cache
    log "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "${CLOUDFRONT_ID}" \
        --paths "/*"
    
    cd ..
    success "Frontend deployed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Add GSI indexes if needed
    if [ -f "backend/scripts/add-moving-storage-indexes.js" ]; then
        log "Adding DynamoDB GSI indexes..."
        cd backend
        node scripts/add-moving-storage-indexes.js --environment="${ENVIRONMENT}"
        cd ..
        success "Database indexes added"
    fi
    
    # Run any other migration scripts
    if [ -f "backend/scripts/migrate-moving-storage-schema.js" ]; then
        log "Running schema migration..."
        cd backend
        node scripts/migrate-moving-storage-schema.js --environment="${ENVIRONMENT}"
        cd ..
        success "Schema migration completed"
    fi
}

# Validate deployment
validate_deployment() {
    log "Validating deployment..."
    
    # Get API URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text)
    
    # Test API health
    if curl -f "${API_URL}/health" &> /dev/null; then
        success "API health check passed"
    else
        warn "API health check failed - this may be normal if health endpoint is not implemented"
    fi
    
    # Get CloudFront URL
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
        --output text)
    
    success "Deployment validation completed"
    log "Application URL: ${CLOUDFRONT_URL}"
    log "API URL: ${API_URL}"
}

# Main deployment function
main() {
    log "Starting deployment of Moving & Storage System"
    log "Environment: ${ENVIRONMENT}"
    log "Region: ${REGION}"
    log "Stack Name: ${STACK_NAME}"
    
    check_prerequisites
    install_dependencies
    deploy_infrastructure
    run_migrations
    deploy_frontend
    validate_deployment
    
    success "🎉 Moving & Storage System deployed successfully!"
    
    # Display important URLs
    echo ""
    echo "=== Deployment Summary ==="
    
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
        --output text)
    
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text)
    
    DASHBOARD_URL=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" \
        --output text)
    
    echo "Application URL: ${CLOUDFRONT_URL}"
    echo "API URL: ${API_URL}"
    echo "Monitoring Dashboard: ${DASHBOARD_URL}"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [environment] [options]"
        echo ""
        echo "Arguments:"
        echo "  environment    Deployment environment (default: dev)"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  AWS_REGION     AWS region (default: eu-west-1)"
        echo ""
        exit 0
        ;;
    *)
        main
        ;;
esac