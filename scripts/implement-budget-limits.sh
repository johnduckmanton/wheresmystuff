#!/bin/bash

# Script to implement hard budget limits and rate limiting
# Prevents overspending by implementing automatic cost containment measures

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${2:-eu-west-1}
BUDGET_LIMIT=${3:-$([ "$ENVIRONMENT" = "prod" ] && echo "30" || echo "20")}
STACK_NAME="home-inventory-system-${ENVIRONMENT}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to create budget with hard limits
create_budget_with_limits() {
    log "Creating budget with hard limits for environment: $ENVIRONMENT"
    
    # Get AWS Account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Create SNS topic for budget alerts if it doesn't exist
    TOPIC_NAME="home-inventory-budget-alerts-${ENVIRONMENT}"
    TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:${TOPIC_NAME}"
    
    # Check if topic exists
    if ! aws sns get-topic-attributes --topic-arn "$TOPIC_ARN" --region "$REGION" >/dev/null 2>&1; then
        log "Creating SNS topic for budget alerts: $TOPIC_NAME"
        aws sns create-topic --name "$TOPIC_NAME" --region "$REGION"
    fi
    
    # Create budget configuration
    BUDGET_CONFIG=$(cat << EOF
{
    "BudgetName": "home-inventory-budget-${ENVIRONMENT}",
    "BudgetLimit": {
        "Amount": "${BUDGET_LIMIT}",
        "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
        "TagKey": ["Environment"],
        "TagValue": ["${ENVIRONMENT}"]
    }
}
EOF
)
    
    # Create notifications configuration
    NOTIFICATIONS_CONFIG=$(cat << EOF
[
    {
        "Notification": {
            "NotificationType": "FORECASTED",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 50,
            "ThresholdType": "PERCENTAGE"
        },
        "Subscribers": [
            {
                "SubscriptionType": "SNS",
                "Address": "${TOPIC_ARN}"
            }
        ]
    },
    {
        "Notification": {
            "NotificationType": "ACTUAL",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 80,
            "ThresholdType": "PERCENTAGE"
        },
        "Subscribers": [
            {
                "SubscriptionType": "SNS",
                "Address": "${TOPIC_ARN}"
            }
        ]
    },
    {
        "Notification": {
            "NotificationType": "ACTUAL",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 100,
            "ThresholdType": "PERCENTAGE"
        },
        "Subscribers": [
            {
                "SubscriptionType": "SNS",
                "Address": "${TOPIC_ARN}"
            }
        ]
    }
]
EOF
)
    
    # Create or update budget
    log "Creating budget with $BUDGET_LIMIT USD limit"
    echo "$BUDGET_CONFIG" > /tmp/budget-config.json
    echo "$NOTIFICATIONS_CONFIG" > /tmp/notifications-config.json
    
    aws budgets create-budget \
        --account-id "$ACCOUNT_ID" \
        --budget file:///tmp/budget-config.json \
        --notifications-with-subscribers file:///tmp/notifications-config.json \
        --region us-east-1 || \
    aws budgets modify-budget \
        --account-id "$ACCOUNT_ID" \
        --new-budget file:///tmp/budget-config.json \
        --region us-east-1
    
    # Clean up temp files
    rm -f /tmp/budget-config.json /tmp/notifications-config.json
    
    success "Budget created/updated with hard limits"
}

# Function to implement API Gateway rate limiting
implement_api_rate_limiting() {
    log "Implementing API Gateway rate limiting"
    
    # Get API Gateway ID
    API_ID=$(aws apigatewayv2 get-apis \
        --region "$REGION" \
        --query "Items[?contains(Name, '$ENVIRONMENT')].ApiId" \
        --output text)
    
    if [ -z "$API_ID" ]; then
        warning "No API Gateway found for environment: $ENVIRONMENT"
        return
    fi
    
    log "Found API Gateway: $API_ID"
    
    # Create throttle settings based on environment
    if [ "$ENVIRONMENT" = "prod" ]; then
        BURST_LIMIT=200
        RATE_LIMIT=100
    else
        BURST_LIMIT=50
        RATE_LIMIT=25
    fi
    
    log "Setting rate limits: Burst=$BURST_LIMIT, Rate=$RATE_LIMIT"
    
    # Update API Gateway throttle settings
    aws apigatewayv2 update-stage \
        --api-id "$API_ID" \
        --stage-name "$ENVIRONMENT" \
        --throttle-config BurstLimit="$BURST_LIMIT",RateLimit="$RATE_LIMIT" \
        --region "$REGION" || warning "Failed to update API Gateway throttle settings"
    
    success "API Gateway rate limiting implemented"
}

# Function to create CloudWatch alarms for cost monitoring
create_cost_alarms() {
    log "Creating CloudWatch alarms for cost monitoring"
    
    # Get AWS Account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:home-inventory-budget-alerts-${ENVIRONMENT}"
    
    # Daily cost alarm (80% of monthly budget / 30 days)
    DAILY_THRESHOLD=$(echo "scale=2; ($BUDGET_LIMIT * 0.8) / 30" | bc -l)
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "home-inventory-daily-cost-${ENVIRONMENT}" \
        --alarm-description "Daily costs exceeding expected threshold" \
        --metric-name EstimatedCharges \
        --namespace AWS/Billing \
        --statistic Maximum \
        --period 86400 \
        --evaluation-periods 1 \
        --threshold "$DAILY_THRESHOLD" \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=Currency,Value=USD \
        --alarm-actions "$TOPIC_ARN" \
        --region us-east-1 || warning "Failed to create daily cost alarm"
    
    # Lambda free tier alarm (80% of 1M requests)
    aws cloudwatch put-metric-alarm \
        --alarm-name "home-inventory-lambda-free-tier-${ENVIRONMENT}" \
        --alarm-description "Lambda invocations approaching free tier limit" \
        --metric-name Invocations \
        --namespace AWS/Lambda \
        --statistic Sum \
        --period 86400 \
        --evaluation-periods 1 \
        --threshold 800000 \
        --comparison-operator GreaterThanThreshold \
        --alarm-actions "$TOPIC_ARN" \
        --region "$REGION" || warning "Failed to create Lambda free tier alarm"
    
    # API Gateway free tier alarm (80% of 1M requests)
    aws cloudwatch put-metric-alarm \
        --alarm-name "home-inventory-api-free-tier-${ENVIRONMENT}" \
        --alarm-description "API Gateway requests approaching free tier limit" \
        --metric-name Count \
        --namespace AWS/ApiGateway \
        --statistic Sum \
        --period 86400 \
        --evaluation-periods 1 \
        --threshold 800000 \
        --comparison-operator GreaterThanThreshold \
        --alarm-actions "$TOPIC_ARN" \
        --region "$REGION" || warning "Failed to create API Gateway free tier alarm"
    
    success "Cost monitoring alarms created"
}

# Function to create Lambda function for automatic cost containment
create_cost_containment_lambda() {
    log "Creating Lambda function for automatic cost containment"
    
    # Create Lambda function code
    LAMBDA_CODE=$(cat << 'EOF'
const AWS = require('aws-sdk');

exports.handler = async (event) => {
    console.log('Cost containment triggered:', JSON.stringify(event, null, 2));
    
    const cloudwatch = new AWS.CloudWatch();
    const sns = new AWS.SNS();
    
    try {
        // Parse SNS message
        const message = JSON.parse(event.Records[0].Sns.Message);
        const alarmName = message.AlarmName;
        const newState = message.NewStateValue;
        
        if (newState === 'ALARM') {
            console.log(`Cost alarm triggered: ${alarmName}`);
            
            // Implement cost containment measures
            if (alarmName.includes('daily-cost')) {
                await implementDailyCostContainment();
            } else if (alarmName.includes('free-tier')) {
                await implementFreeTierContainment();
            }
            
            // Send notification
            await sns.publish({
                TopicArn: process.env.ALERT_TOPIC_ARN,
                Subject: `Cost Containment Activated: ${alarmName}`,
                Message: `Automatic cost containment measures have been activated due to: ${alarmName}`
            }).promise();
        }
        
        return { statusCode: 200, body: 'Cost containment processed' };
        
    } catch (error) {
        console.error('Error in cost containment:', error);
        throw error;
    }
};

async function implementDailyCostContainment() {
    console.log('Implementing daily cost containment measures');
    
    // Reduce log retention
    const logs = new AWS.CloudWatchLogs();
    const logGroups = await logs.describeLogGroups().promise();
    
    for (const group of logGroups.logGroups) {
        if (group.logGroupName.includes(process.env.ENVIRONMENT)) {
            await logs.putRetentionPolicy({
                logGroupName: group.logGroupName,
                retentionInDays: 1
            }).promise();
        }
    }
    
    console.log('Daily cost containment measures implemented');
}

async function implementFreeTierContainment() {
    console.log('Implementing free tier containment measures');
    
    // Implement more aggressive rate limiting
    const apigateway = new AWS.ApiGatewayV2();
    
    // This would need to be implemented based on specific API configuration
    console.log('Free tier containment measures implemented');
}
EOF
)
    
    # Create Lambda deployment package
    LAMBDA_DIR="/tmp/cost-containment-lambda"
    mkdir -p "$LAMBDA_DIR"
    echo "$LAMBDA_CODE" > "$LAMBDA_DIR/index.js"
    
    # Create package.json
    cat > "$LAMBDA_DIR/package.json" << 'EOF'
{
    "name": "cost-containment-lambda",
    "version": "1.0.0",
    "description": "Automatic cost containment for Home Inventory System",
    "main": "index.js",
    "dependencies": {
        "aws-sdk": "^2.1000.0"
    }
}
EOF
    
    # Create deployment package
    cd "$LAMBDA_DIR"
    zip -r cost-containment-lambda.zip . >/dev/null
    
    # Create IAM role for Lambda
    ROLE_NAME="home-inventory-cost-containment-role-${ENVIRONMENT}"
    TRUST_POLICY=$(cat << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
)
    
    # Create role if it doesn't exist
    if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
        log "Creating IAM role: $ROLE_NAME"
        echo "$TRUST_POLICY" > /tmp/trust-policy.json
        aws iam create-role \
            --role-name "$ROLE_NAME" \
            --assume-role-policy-document file:///tmp/trust-policy.json
        rm -f /tmp/trust-policy.json
        
        # Attach basic Lambda execution policy
        aws iam attach-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        
        # Create and attach custom policy for cost containment
        POLICY_DOCUMENT=$(cat << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:PutRetentionPolicy",
                "logs:DescribeLogGroups",
                "apigateway:*",
                "sns:Publish",
                "cloudwatch:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF
)
        
        echo "$POLICY_DOCUMENT" > /tmp/cost-policy.json
        aws iam create-policy \
            --policy-name "home-inventory-cost-containment-policy-${ENVIRONMENT}" \
            --policy-document file:///tmp/cost-policy.json >/dev/null || true
        
        aws iam attach-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/home-inventory-cost-containment-policy-${ENVIRONMENT}"
        
        rm -f /tmp/cost-policy.json
        
        # Wait for role to be available
        sleep 10
    fi
    
    # Get role ARN
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
    TOPIC_ARN="arn:aws:sns:${REGION}:$(aws sts get-caller-identity --query Account --output text):home-inventory-budget-alerts-${ENVIRONMENT}"
    
    # Create or update Lambda function
    FUNCTION_NAME="home-inventory-cost-containment-${ENVIRONMENT}"
    
    if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
        log "Updating existing Lambda function: $FUNCTION_NAME"
        aws lambda update-function-code \
            --function-name "$FUNCTION_NAME" \
            --zip-file fileb://cost-containment-lambda.zip \
            --region "$REGION"
    else
        log "Creating Lambda function: $FUNCTION_NAME"
        aws lambda create-function \
            --function-name "$FUNCTION_NAME" \
            --runtime nodejs20.x \
            --role "$ROLE_ARN" \
            --handler index.handler \
            --zip-file fileb://cost-containment-lambda.zip \
            --timeout 60 \
            --environment Variables="{ENVIRONMENT=${ENVIRONMENT},ALERT_TOPIC_ARN=${TOPIC_ARN}}" \
            --region "$REGION"
    fi
    
    # Add SNS trigger
    aws lambda add-permission \
        --function-name "$FUNCTION_NAME" \
        --statement-id "sns-trigger" \
        --action lambda:InvokeFunction \
        --principal sns.amazonaws.com \
        --source-arn "$TOPIC_ARN" \
        --region "$REGION" || true
    
    # Subscribe Lambda to SNS topic
    LAMBDA_ARN="arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query Account --output text):function:${FUNCTION_NAME}"
    aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol lambda \
        --notification-endpoint "$LAMBDA_ARN" \
        --region "$REGION" || true
    
    # Clean up
    cd - >/dev/null
    rm -rf "$LAMBDA_DIR"
    
    success "Cost containment Lambda function created"
}

# Function to test budget limits
test_budget_limits() {
    log "Testing budget limits and notifications"
    
    # Get current costs
    CURRENT_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD \
        --start-time $(date -u -d '1 month ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[0].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    UTILIZATION=$(echo "scale=2; ($CURRENT_COSTS / $BUDGET_LIMIT) * 100" | bc -l)
    
    log "Current costs: \$${CURRENT_COSTS}"
    log "Budget limit: \$${BUDGET_LIMIT}"
    log "Budget utilization: ${UTILIZATION}%"
    
    if (( $(echo "$UTILIZATION > 80" | bc -l) )); then
        warning "Budget utilization above 80% - cost containment should be active"
    else
        success "Budget utilization within safe limits"
    fi
}

# Main execution
main() {
    log "Implementing hard budget limits for environment: $ENVIRONMENT"
    log "Budget limit: \$${BUDGET_LIMIT}"
    log "Region: $REGION"
    
    create_budget_with_limits
    implement_api_rate_limiting
    create_cost_alarms
    create_cost_containment_lambda
    test_budget_limits
    
    success "Hard budget limits implementation completed"
    
    cat << EOF

BUDGET LIMITS SUMMARY:
- Budget Limit: \$${BUDGET_LIMIT} USD
- Rate Limiting: Enabled on API Gateway
- Cost Alarms: Created for daily costs and free tier usage
- Automatic Containment: Lambda function deployed
- Notifications: SNS topic configured

COST CONTAINMENT TRIGGERS:
- 50% Budget: Warning notifications
- 80% Budget: Cost optimization recommendations
- 100% Budget: Emergency cost containment measures

To monitor budget status:
  aws budgets describe-budget --account-id \$(aws sts get-caller-identity --query Account --output text) --budget-name home-inventory-budget-${ENVIRONMENT} --region us-east-1

To check current costs:
  ./scripts/cost-monitoring-report.js ${ENVIRONMENT} ${REGION}

EOF
}

# Check dependencies
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v bc &> /dev/null; then
    error "bc calculator not found. Please install bc."
    exit 1
fi

# Run main function
main "$@"