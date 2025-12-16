#!/bin/bash

# Setup Security Alerts Email Notifications
# This script helps configure email notifications for security alerts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it first."
    exit 1
fi

# Get environment parameter
ENVIRONMENT=${1:-dev}
print_status "Setting up security alerts for environment: $ENVIRONMENT"

# Get the stack name
STACK_NAME="home-inventory-$ENVIRONMENT"

# Get the SNS topic ARN from CloudFormation outputs
print_status "Getting SNS topic ARN from CloudFormation..."
SNS_TOPIC_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='SecurityAlertsTopicArn'].OutputValue" \
    --output text 2>/dev/null || echo "")

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
    print_error "Could not find SecurityAlertsTopicArn in CloudFormation stack outputs."
    print_error "Make sure the stack '$STACK_NAME' is deployed with the latest template."
    exit 1
fi

print_status "Found SNS Topic: $SNS_TOPIC_ARN"

# Prompt for email address
echo
read -p "Enter email address for security alerts: " EMAIL_ADDRESS

if [ -z "$EMAIL_ADDRESS" ]; then
    print_error "Email address is required."
    exit 1
fi

# Validate email format (basic validation)
if [[ ! "$EMAIL_ADDRESS" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    print_error "Invalid email address format."
    exit 1
fi

# Subscribe email to SNS topic
print_status "Subscribing $EMAIL_ADDRESS to security alerts..."
SUBSCRIPTION_ARN=$(aws sns subscribe \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$EMAIL_ADDRESS" \
    --query "SubscriptionArn" \
    --output text)

if [ "$SUBSCRIPTION_ARN" = "pending confirmation" ]; then
    print_status "Subscription created successfully!"
    print_warning "Please check your email and confirm the subscription."
    print_warning "You will not receive alerts until you confirm the subscription."
else
    print_status "Subscription confirmed: $SUBSCRIPTION_ARN"
fi

# Get dashboard URL
DASHBOARD_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='SecurityDashboardUrl'].OutputValue" \
    --output text 2>/dev/null || echo "")

echo
print_status "Setup complete!"
echo
echo "Security Alert Configuration:"
echo "  SNS Topic: $SNS_TOPIC_ARN"
echo "  Email: $EMAIL_ADDRESS"
echo "  Status: $([ "$SUBSCRIPTION_ARN" = "pending confirmation" ] && echo "Pending confirmation" || echo "Active")"
echo

if [ -n "$DASHBOARD_URL" ] && [ "$DASHBOARD_URL" != "None" ]; then
    echo "Security Dashboard: $DASHBOARD_URL"
    echo
fi

echo "Configured Alarms:"
echo "  • High Authentication Failure Rate (>10 failures in 10 minutes)"
echo "  • High Authorization Failure Rate (>20 failures in 10 minutes)"
echo "  • Rate Limit Violations (>5 violations in 5 minutes)"
echo "  • WAF Blocked Requests (>50 blocks in 10 minutes)"
echo "  • API Gateway Error Rate (>10 5xx errors in 10 minutes)"
echo "  • Lambda Function Errors (>5 errors in 10 minutes)"
echo "  • DynamoDB Throttling (any throttling events)"
echo

print_status "You can add more email addresses by running this script again with different emails."
print_status "To view current subscriptions, run: aws sns list-subscriptions-by-topic --topic-arn $SNS_TOPIC_ARN"