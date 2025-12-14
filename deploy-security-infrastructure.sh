#!/bin/bash

# Deploy Security Infrastructure for Home Inventory System
# This script deploys CloudFront, AWS WAF, and related security enhancements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
ENABLE_WAF="true"
CUSTOM_DOMAIN=""
ACM_CERT_ARN=""
STACK_NAME="home-inventory-system"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy security infrastructure for Home Inventory System

OPTIONS:
    -e, --environment ENV       Environment name (default: prod)
    -w, --waf BOOL             Enable WAF (true/false, default: true)
    -d, --domain DOMAIN        Custom domain name (optional)
    -c, --certificate ARN      ACM certificate ARN (required if domain specified)
    -s, --stack-name NAME      CloudFormation stack name (default: home-inventory-system)
    -h, --help                 Show this help message

EXAMPLES:
    # Deploy with default CloudFront domain
    $0

    # Deploy with custom domain
    $0 --domain inventory.example.com --certificate arn:aws:acm:us-east-1:123456789012:certificate/abc-123

    # Deploy without WAF (not recommended for production)
    $0 --waf false --environment dev

EOF
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -w|--waf)
            ENABLE_WAF="$2"
            shift 2
            ;;
        -d|--domain)
            CUSTOM_DOMAIN="$2"
            shift 2
            ;;
        -c|--certificate)
            ACM_CERT_ARN="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate inputs
if [[ -n "$CUSTOM_DOMAIN" && -z "$ACM_CERT_ARN" ]]; then
    print_error "ACM certificate ARN is required when custom domain is specified"
    exit 1
fi

if [[ -n "$ACM_CERT_ARN" ]]; then
    # Verify certificate is in us-east-1
    CERT_REGION=$(echo "$ACM_CERT_ARN" | cut -d: -f4)
    if [[ "$CERT_REGION" != "us-east-1" ]]; then
        print_error "ACM certificate must be in us-east-1 region for CloudFront"
        print_error "Current certificate region: $CERT_REGION"
        exit 1
    fi
fi

# Print configuration
print_info "Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Stack Name: $STACK_NAME"
echo "  Enable WAF: $ENABLE_WAF"
echo "  Custom Domain: ${CUSTOM_DOMAIN:-'(using CloudFront default)'}"
echo "  ACM Certificate: ${ACM_CERT_ARN:-'(using CloudFront default certificate)'}"
echo ""

# Confirm deployment
read -p "Do you want to proceed with deployment? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Check prerequisites
print_info "Checking prerequisites..."

if ! command -v sam &> /dev/null; then
    print_error "AWS SAM CLI is not installed. Please install it first."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials are not configured. Please run 'aws configure'."
    exit 1
fi

print_info "Prerequisites check passed"

# Build the application
print_info "Building application..."
sam build

if [[ $? -ne 0 ]]; then
    print_error "Build failed"
    exit 1
fi

print_info "Build completed successfully"

# Prepare deployment parameters
PARAMS="Environment=$ENVIRONMENT EnableWAF=$ENABLE_WAF"

if [[ -n "$CUSTOM_DOMAIN" ]]; then
    PARAMS="$PARAMS CustomDomainName=$CUSTOM_DOMAIN"
fi

if [[ -n "$ACM_CERT_ARN" ]]; then
    PARAMS="$PARAMS ACMCertificateArn=$ACM_CERT_ARN"
fi

# Deploy the stack
print_info "Deploying stack..."
print_info "This may take 15-30 minutes for CloudFront distribution to deploy..."

sam deploy \
    --stack-name "$STACK_NAME" \
    --parameter-overrides $PARAMS \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-fail-on-empty-changeset

if [[ $? -ne 0 ]]; then
    print_error "Deployment failed"
    exit 1
fi

print_info "Deployment completed successfully"

# Get outputs
print_info "Retrieving deployment outputs..."

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
    --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

# Print summary
echo ""
print_info "=========================================="
print_info "Deployment Summary"
print_info "=========================================="
echo ""
echo "  CloudFront URL: $CLOUDFRONT_URL"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "  Distribution ID: $DISTRIBUTION_ID"
echo "  API Gateway URL: $API_URL"
echo ""

if [[ -n "$CUSTOM_DOMAIN" ]]; then
    print_warning "Custom Domain Configuration Required:"
    echo "  1. Create a CNAME record in your DNS:"
    echo "     Name: $CUSTOM_DOMAIN"
    echo "     Value: $CLOUDFRONT_DOMAIN"
    echo "     TTL: 300"
    echo ""
    echo "  2. Wait for DNS propagation (up to 48 hours)"
    echo ""
fi

print_info "Next Steps:"
echo "  1. Wait for CloudFront distribution to fully deploy (15-30 minutes)"
echo "  2. Update frontend configuration to use: $CLOUDFRONT_URL"
echo "  3. Test HTTPS enforcement: curl -I $CLOUDFRONT_URL"
echo "  4. Verify security headers are present"
echo "  5. Test WAF protection with malicious requests"
echo ""
print_info "For detailed verification steps, see SECURITY_INFRASTRUCTURE.md"
echo ""

# Check distribution status
print_info "Checking CloudFront distribution status..."
DISTRIBUTION_STATUS=$(aws cloudfront get-distribution \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.Status' \
    --output text)

echo "  Current Status: $DISTRIBUTION_STATUS"

if [[ "$DISTRIBUTION_STATUS" == "InProgress" ]]; then
    print_warning "Distribution is still deploying. This may take 15-30 minutes."
    print_warning "You can check status with: aws cloudfront get-distribution --id $DISTRIBUTION_ID"
elif [[ "$DISTRIBUTION_STATUS" == "Deployed" ]]; then
    print_info "Distribution is fully deployed and ready to use!"
fi

echo ""
print_info "Deployment script completed successfully!"
