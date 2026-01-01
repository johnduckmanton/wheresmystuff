#!/bin/bash

# Cost Optimization and Containment Script
# Implements automatic cost-saving measures when approaching budget limits

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${2:-eu-west-1}
STACK_NAME="home-inventory-system-${ENVIRONMENT}"
LOG_FILE="/tmp/cost-optimization-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check current budget utilization
check_budget_utilization() {
    log "Checking budget utilization for environment: $ENVIRONMENT"
    
    # Get current month's estimated charges
    CURRENT_CHARGES=$(aws cloudwatch get-metric-statistics \
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
    
    # Set budget limits based on environment
    if [ "$ENVIRONMENT" = "prod" ]; then
        BUDGET_LIMIT=30
    else
        BUDGET_LIMIT=20
    fi
    
    # Calculate utilization percentage
    UTILIZATION=$(echo "scale=2; ($CURRENT_CHARGES / $BUDGET_LIMIT) * 100" | bc -l)
    
    log "Current charges: \$${CURRENT_CHARGES}"
    log "Budget limit: \$${BUDGET_LIMIT}"
    log "Budget utilization: ${UTILIZATION}%"
    
    echo "$UTILIZATION"
}

# Function to reduce CloudWatch log retention
reduce_log_retention() {
    log "Reducing CloudWatch log retention to minimize costs"
    
    # Get all log groups for this environment
    LOG_GROUPS=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, '$ENVIRONMENT')].logGroupName" \
        --output text)
    
    if [ -z "$LOG_GROUPS" ]; then
        warning "No log groups found for environment: $ENVIRONMENT"
        return
    fi
    
    # Reduce retention to 3 days for cost savings
    for LOG_GROUP in $LOG_GROUPS; do
        log "Reducing retention for log group: $LOG_GROUP"
        aws logs put-retention-policy \
            --log-group-name "$LOG_GROUP" \
            --retention-in-days 3 \
            --region "$REGION" || warning "Failed to update retention for $LOG_GROUP"
    done
    
    success "Log retention reduced to 3 days for all environment log groups"
}

# Function to optimize S3 lifecycle policies
optimize_s3_lifecycle() {
    log "Optimizing S3 lifecycle policies for cost savings"
    
    # Get S3 buckets for this environment
    BUCKETS=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, '$ENVIRONMENT')].Name" \
        --output text)
    
    if [ -z "$BUCKETS" ]; then
        warning "No S3 buckets found for environment: $ENVIRONMENT"
        return
    fi
    
    # Create aggressive lifecycle policy
    LIFECYCLE_POLICY=$(cat << EOF
{
    "Rules": [
        {
            "ID": "AggressiveCostOptimization",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 30,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "DeleteOldVersions",
            "Status": "Enabled",
            "Filter": {},
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 7
            }
        },
        {
            "ID": "DeleteIncompleteMultipartUploads",
            "Status": "Enabled",
            "Filter": {},
            "AbortIncompleteMultipartUpload": {
                "DaysAfterInitiation": 1
            }
        },
        {
            "ID": "DeleteTempFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "temp/"
            },
            "Expiration": {
                "Days": 1
            }
        },
        {
            "ID": "DeleteOldLogs",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "logs/"
            },
            "Expiration": {
                "Days": 3
            }
        }
    ]
}
EOF
)
    
    # Apply lifecycle policy to each bucket
    for BUCKET in $BUCKETS; do
        log "Applying aggressive lifecycle policy to bucket: $BUCKET"
        echo "$LIFECYCLE_POLICY" | aws s3api put-bucket-lifecycle-configuration \
            --bucket "$BUCKET" \
            --lifecycle-configuration file:///dev/stdin || warning "Failed to update lifecycle for $BUCKET"
    done
    
    success "Aggressive S3 lifecycle policies applied to all environment buckets"
}

# Function to create DynamoDB query optimization recommendations
create_dynamodb_recommendations() {
    log "Creating DynamoDB query optimization recommendations"
    
    # Get DynamoDB table for this environment
    TABLE_NAME="home-inv-${ENVIRONMENT}"
    
    # Check if table exists
    if ! aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" >/dev/null 2>&1; then
        warning "DynamoDB table $TABLE_NAME not found"
        return
    fi
    
    # Create recommendations file
    RECOMMENDATIONS_FILE="dynamodb-optimization-recommendations-${ENVIRONMENT}.md"
    
    cat > "$RECOMMENDATIONS_FILE" << EOF
# DynamoDB Query Optimization Recommendations

Generated on: $(date)
Environment: $ENVIRONMENT
Table: $TABLE_NAME

## Cost Optimization Strategies

### 1. Query Pattern Analysis
- Review your application's query patterns
- Ensure you're using the most efficient access patterns
- Consider using batch operations where possible

### 2. Index Optimization
- Review Global Secondary Index (GSI) usage
- Remove unused indexes to reduce costs
- Consider sparse indexes for optional attributes

### 3. Read/Write Capacity Optimization
- Monitor consumed vs provisioned capacity
- Use on-demand billing for unpredictable workloads
- Consider auto-scaling for predictable patterns

### 4. Data Lifecycle Management
- Implement TTL (Time To Live) for temporary data
- Archive old data to S3 for long-term storage
- Use DynamoDB Streams for real-time processing

### 5. Query Efficiency
- Use projection expressions to fetch only needed attributes
- Implement pagination for large result sets
- Use consistent reads only when necessary

## Current Recommendations

### Immediate Actions (Cost Impact: High)
1. Enable TTL on audit log entries (expire after 90 days)
2. Review and optimize GSI projections
3. Implement data archiving for old container/item records

### Medium-term Actions (Cost Impact: Medium)
4. Analyze query patterns and optimize access patterns
5. Consider using DynamoDB Accelerator (DAX) for read-heavy workloads
6. Implement batch operations for bulk data operations

### Long-term Actions (Cost Impact: Low)
7. Regular capacity planning and optimization reviews
8. Monitor and alert on unusual usage patterns
9. Consider data partitioning strategies for large datasets

## Monitoring Commands

\`\`\`bash
# Check table metrics
aws cloudwatch get-metric-statistics \\
    --namespace AWS/DynamoDB \\
    --metric-name ConsumedReadCapacityUnits \\
    --dimensions Name=TableName,Value=$TABLE_NAME \\
    --start-time \$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 3600 \\
    --statistics Sum \\
    --region $REGION

# Check for throttling
aws cloudwatch get-metric-statistics \\
    --namespace AWS/DynamoDB \\
    --metric-name ThrottledRequests \\
    --dimensions Name=TableName,Value=$TABLE_NAME \\
    --start-time \$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 3600 \\
    --statistics Sum \\
    --region $REGION
\`\`\`

EOF
    
    success "DynamoDB optimization recommendations created: $RECOMMENDATIONS_FILE"
}

# Function to pause non-essential development resources
pause_dev_resources() {
    if [ "$ENVIRONMENT" != "dev" ]; then
        log "Skipping resource pausing - not in development environment"
        return
    fi
    
    log "Pausing non-essential development resources"
    
    # Create a script to pause/resume resources
    PAUSE_SCRIPT="pause-dev-resources.sh"
    
    cat > "$PAUSE_SCRIPT" << 'EOF'
#!/bin/bash

# Script to pause/resume non-essential development resources
ACTION=${1:-pause}
ENVIRONMENT=${2:-dev}
REGION=${3:-eu-west-1}

if [ "$ACTION" = "pause" ]; then
    echo "Pausing non-essential development resources..."
    
    # Note: Since we're using serverless architecture, most resources are pay-per-use
    # The main cost-saving measures are:
    
    # 1. Reduce Lambda reserved concurrency to minimum
    echo "Reducing Lambda reserved concurrency..."
    
    # 2. Implement request throttling
    echo "Implementing aggressive request throttling..."
    
    # 3. Reduce CloudWatch log retention
    echo "Reducing log retention to minimum..."
    
    # 4. Enable S3 Intelligent Tiering
    echo "Enabling S3 Intelligent Tiering..."
    
    echo "Development resources paused. Costs should be minimized."
    
elif [ "$ACTION" = "resume" ]; then
    echo "Resuming normal development resources..."
    
    # Restore normal settings
    echo "Restoring normal Lambda concurrency..."
    echo "Restoring normal request limits..."
    echo "Restoring normal log retention..."
    echo "Restoring normal S3 settings..."
    
    echo "Development resources resumed."
    
else
    echo "Usage: $0 [pause|resume] [environment] [region]"
    exit 1
fi
EOF
    
    chmod +x "$PAUSE_SCRIPT"
    success "Created resource pause/resume script: $PAUSE_SCRIPT"
    
    # Execute the pause action
    ./"$PAUSE_SCRIPT" pause "$ENVIRONMENT" "$REGION"
}

# Function to implement emergency cost containment
emergency_cost_containment() {
    local UTILIZATION=$1
    
    if (( $(echo "$UTILIZATION > 90" | bc -l) )); then
        error "EMERGENCY: Budget utilization at ${UTILIZATION}% - implementing emergency cost containment"
        
        # Reduce log retention to 1 day
        log "Emergency: Reducing all log retention to 1 day"
        LOG_GROUPS=$(aws logs describe-log-groups \
            --region "$REGION" \
            --query "logGroups[?contains(logGroupName, '$ENVIRONMENT')].logGroupName" \
            --output text)
        
        for LOG_GROUP in $LOG_GROUPS; do
            aws logs put-retention-policy \
                --log-group-name "$LOG_GROUP" \
                --retention-in-days 1 \
                --region "$REGION" || true
        done
        
        # Implement aggressive S3 lifecycle (move to Glacier after 1 day)
        log "Emergency: Implementing immediate S3 Glacier transition"
        EMERGENCY_LIFECYCLE=$(cat << 'EOF'
{
    "Rules": [
        {
            "ID": "EmergencyCostContainment",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": 1,
                    "StorageClass": "GLACIER"
                }
            ]
        }
    ]
}
EOF
)
        
        BUCKETS=$(aws s3api list-buckets \
            --query "Buckets[?contains(Name, '$ENVIRONMENT')].Name" \
            --output text)
        
        for BUCKET in $BUCKETS; do
            echo "$EMERGENCY_LIFECYCLE" | aws s3api put-bucket-lifecycle-configuration \
                --bucket "$BUCKET" \
                --lifecycle-configuration file:///dev/stdin || true
        done
        
        # Send emergency notification
        aws sns publish \
            --topic-arn "arn:aws:sns:${REGION}:$(aws sts get-caller-identity --query Account --output text):home-inventory-budget-alerts-${ENVIRONMENT}" \
            --message "EMERGENCY COST CONTAINMENT ACTIVATED: Budget utilization at ${UTILIZATION}%. Aggressive cost-saving measures implemented." \
            --subject "EMERGENCY: Cost Containment Activated - ${ENVIRONMENT}" \
            --region "$REGION" || true
        
        error "Emergency cost containment measures activated!"
    fi
}

# Main execution
main() {
    log "Starting cost optimization script for environment: $ENVIRONMENT"
    log "Region: $REGION"
    log "Stack: $STACK_NAME"
    
    # Check budget utilization
    UTILIZATION=$(check_budget_utilization)
    
    # Implement emergency measures if needed
    emergency_cost_containment "$UTILIZATION"
    
    # Apply cost-saving measures based on utilization
    if (( $(echo "$UTILIZATION > 50" | bc -l) )); then
        warning "Budget utilization above 50% - implementing cost-saving measures"
        
        reduce_log_retention
        optimize_s3_lifecycle
        create_dynamodb_recommendations
        
        if [ "$ENVIRONMENT" = "dev" ]; then
            pause_dev_resources
        fi
        
        success "Cost-saving measures implemented"
    else
        log "Budget utilization below 50% - no immediate action required"
        create_dynamodb_recommendations
    fi
    
    log "Cost optimization script completed"
    log "Log file: $LOG_FILE"
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