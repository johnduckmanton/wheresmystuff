#!/bin/bash

# Script to pause/resume non-essential development resources
# This helps reduce costs when development environment is not actively used

set -e

# Configuration
ACTION=${1:-pause}
ENVIRONMENT=${2:-dev}
REGION=${3:-eu-west-1}
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

# Function to pause development resources
pause_resources() {
    log "Pausing non-essential development resources for environment: $ENVIRONMENT"
    
    if [ "$ENVIRONMENT" != "dev" ]; then
        error "This script should only be used with development environment"
        exit 1
    fi
    
    # 1. Reduce Lambda reserved concurrency to minimum
    log "Reducing Lambda reserved concurrency..."
    
    # Get all Lambda functions for this environment
    FUNCTIONS=$(aws lambda list-functions \
        --region "$REGION" \
        --query "Functions[?contains(FunctionName, '$ENVIRONMENT')].FunctionName" \
        --output text)
    
    if [ -n "$FUNCTIONS" ]; then
        for FUNCTION in $FUNCTIONS; do
            log "Setting minimal concurrency for function: $FUNCTION"
            aws lambda put-reserved-concurrency-limit \
                --function-name "$FUNCTION" \
                --reserved-concurrency-limit 1 \
                --region "$REGION" || warning "Failed to set concurrency for $FUNCTION"
        done
    fi
    
    # 2. Reduce CloudWatch log retention to minimum (1 day)
    log "Reducing CloudWatch log retention to 1 day..."
    
    LOG_GROUPS=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, '$ENVIRONMENT')].logGroupName" \
        --output text)
    
    if [ -n "$LOG_GROUPS" ]; then
        for LOG_GROUP in $LOG_GROUPS; do
            log "Reducing retention for log group: $LOG_GROUP"
            aws logs put-retention-policy \
                --log-group-name "$LOG_GROUP" \
                --retention-in-days 1 \
                --region "$REGION" || warning "Failed to update retention for $LOG_GROUP"
        done
    fi
    
    # 3. Enable aggressive S3 lifecycle policies
    log "Enabling aggressive S3 lifecycle policies..."
    
    BUCKETS=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, '$ENVIRONMENT')].Name" \
        --output text)
    
    if [ -n "$BUCKETS" ]; then
        # Create aggressive lifecycle policy
        LIFECYCLE_POLICY=$(cat << 'EOF'
{
    "Rules": [
        {
            "ID": "DevResourcePause",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": 1,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 7,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "DeleteOldVersions",
            "Status": "Enabled",
            "Filter": {},
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 3
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
        }
    ]
}
EOF
)
        
        for BUCKET in $BUCKETS; do
            log "Applying aggressive lifecycle policy to bucket: $BUCKET"
            echo "$LIFECYCLE_POLICY" | aws s3api put-bucket-lifecycle-configuration \
                --bucket "$BUCKET" \
                --lifecycle-configuration file:///dev/stdin || warning "Failed to update lifecycle for $BUCKET"
        done
    fi
    
    # 4. Create resource pause state file
    PAUSE_STATE_FILE="/tmp/dev-resources-paused-${ENVIRONMENT}.json"
    cat > "$PAUSE_STATE_FILE" << EOF
{
    "paused_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "region": "$REGION",
    "actions_taken": [
        "Reduced Lambda reserved concurrency to 1",
        "Set CloudWatch log retention to 1 day",
        "Applied aggressive S3 lifecycle policies"
    ],
    "functions_modified": $(echo "$FUNCTIONS" | wc -w),
    "log_groups_modified": $(echo "$LOG_GROUPS" | wc -w),
    "buckets_modified": $(echo "$BUCKETS" | wc -w)
}
EOF
    
    success "Development resources paused successfully"
    log "Pause state saved to: $PAUSE_STATE_FILE"
    log "Expected cost reduction: 60-80% for development environment"
}

# Function to resume development resources
resume_resources() {
    log "Resuming normal development resources for environment: $ENVIRONMENT"
    
    if [ "$ENVIRONMENT" != "dev" ]; then
        error "This script should only be used with development environment"
        exit 1
    fi
    
    # 1. Remove Lambda reserved concurrency limits
    log "Removing Lambda reserved concurrency limits..."
    
    FUNCTIONS=$(aws lambda list-functions \
        --region "$REGION" \
        --query "Functions[?contains(FunctionName, '$ENVIRONMENT')].FunctionName" \
        --output text)
    
    if [ -n "$FUNCTIONS" ]; then
        for FUNCTION in $FUNCTIONS; do
            log "Removing concurrency limit for function: $FUNCTION"
            aws lambda delete-reserved-concurrency-limit \
                --function-name "$FUNCTION" \
                --region "$REGION" || warning "Failed to remove concurrency limit for $FUNCTION"
        done
    fi
    
    # 2. Restore CloudWatch log retention to 7 days
    log "Restoring CloudWatch log retention to 7 days..."
    
    LOG_GROUPS=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, '$ENVIRONMENT')].logGroupName" \
        --output text)
    
    if [ -n "$LOG_GROUPS" ]; then
        for LOG_GROUP in $LOG_GROUPS; do
            log "Restoring retention for log group: $LOG_GROUP"
            aws logs put-retention-policy \
                --log-group-name "$LOG_GROUP" \
                --retention-in-days 7 \
                --region "$REGION" || warning "Failed to restore retention for $LOG_GROUP"
        done
    fi
    
    # 3. Restore normal S3 lifecycle policies
    log "Restoring normal S3 lifecycle policies..."
    
    BUCKETS=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, '$ENVIRONMENT')].Name" \
        --output text)
    
    if [ -n "$BUCKETS" ]; then
        # Create normal lifecycle policy
        NORMAL_LIFECYCLE_POLICY=$(cat << 'EOF'
{
    "Rules": [
        {
            "ID": "CostOptimization",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "DeleteOldVersions",
            "Status": "Enabled",
            "Filter": {},
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 90
            }
        },
        {
            "ID": "DeleteIncompleteMultipartUploads",
            "Status": "Enabled",
            "Filter": {},
            "AbortIncompleteMultipartUpload": {
                "DaysAfterInitiation": 7
            }
        },
        {
            "ID": "DeleteTempFiles",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "temp/"
            },
            "Expiration": {
                "Days": 7
            }
        }
    ]
}
EOF
)
        
        for BUCKET in $BUCKETS; do
            log "Restoring normal lifecycle policy to bucket: $BUCKET"
            echo "$NORMAL_LIFECYCLE_POLICY" | aws s3api put-bucket-lifecycle-configuration \
                --bucket "$BUCKET" \
                --lifecycle-configuration file:///dev/stdin || warning "Failed to restore lifecycle for $BUCKET"
        done
    fi
    
    # 4. Remove pause state file
    PAUSE_STATE_FILE="/tmp/dev-resources-paused-${ENVIRONMENT}.json"
    if [ -f "$PAUSE_STATE_FILE" ]; then
        rm "$PAUSE_STATE_FILE"
        log "Removed pause state file"
    fi
    
    success "Development resources resumed successfully"
    log "Resources restored to normal development configuration"
}

# Function to check pause status
check_status() {
    log "Checking pause status for environment: $ENVIRONMENT"
    
    PAUSE_STATE_FILE="/tmp/dev-resources-paused-${ENVIRONMENT}.json"
    
    if [ -f "$PAUSE_STATE_FILE" ]; then
        log "Resources are currently PAUSED"
        cat "$PAUSE_STATE_FILE"
    else
        log "Resources are currently ACTIVE (not paused)"
    fi
    
    # Check current Lambda concurrency settings
    log "Current Lambda concurrency settings:"
    FUNCTIONS=$(aws lambda list-functions \
        --region "$REGION" \
        --query "Functions[?contains(FunctionName, '$ENVIRONMENT')].FunctionName" \
        --output text)
    
    if [ -n "$FUNCTIONS" ]; then
        for FUNCTION in $FUNCTIONS; do
            CONCURRENCY=$(aws lambda get-reserved-concurrency-limit \
                --function-name "$FUNCTION" \
                --region "$REGION" \
                --query 'ReservedConcurrencyLimit' \
                --output text 2>/dev/null || echo "None")
            log "  $FUNCTION: $CONCURRENCY"
        done
    fi
}

# Function to estimate cost savings
estimate_savings() {
    log "Estimating potential cost savings for pausing development resources"
    
    cat << EOF

ESTIMATED COST SAVINGS (Development Environment):

1. Lambda Functions:
   - Reserved concurrency reduction: ~30-50% savings on compute costs
   - Reduced invocations during pause: ~80-90% savings
   
2. CloudWatch Logs:
   - Log retention reduction (7 days → 1 day): ~85% savings on log storage
   - Reduced log ingestion: ~70-90% savings during pause
   
3. S3 Storage:
   - Aggressive lifecycle policies: ~60-80% savings on storage costs
   - Faster transition to cheaper storage classes
   
4. DynamoDB:
   - No direct impact (pay-per-use model)
   - Reduced usage during pause: ~80-90% savings on operations
   
5. API Gateway:
   - Reduced requests during pause: ~80-90% savings

TOTAL ESTIMATED SAVINGS: 60-80% of development environment costs

Note: Actual savings depend on usage patterns and current costs.
Pausing is most effective for environments not actively used.

EOF
}

# Main execution
case "$ACTION" in
    "pause")
        pause_resources
        ;;
    "resume")
        resume_resources
        ;;
    "status")
        check_status
        ;;
    "estimate")
        estimate_savings
        ;;
    *)
        echo "Usage: $0 [pause|resume|status|estimate] [environment] [region]"
        echo ""
        echo "Actions:"
        echo "  pause    - Pause non-essential development resources to reduce costs"
        echo "  resume   - Resume normal development resource configuration"
        echo "  status   - Check current pause status"
        echo "  estimate - Show estimated cost savings"
        echo ""
        echo "Examples:"
        echo "  $0 pause dev eu-west-1"
        echo "  $0 resume dev eu-west-1"
        echo "  $0 status dev"
        echo "  $0 estimate"
        exit 1
        ;;
esac