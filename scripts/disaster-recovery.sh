#!/bin/bash

# Disaster Recovery Script
# Provides comprehensive disaster recovery capabilities using built-in AWS features
# Supports manual restoration procedures within 8 hours with up to 1 hour data loss

set -e

# Configuration
ENVIRONMENT=${1:-prod}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"
CLOUDFRONT_STACK="home-inventory-cloudfront-${ENVIRONMENT}"

# Recovery Time Objectives
RTO_HOURS=8  # Recovery Time Objective: 8 hours
RPO_HOURS=1  # Recovery Point Objective: 1 hour data loss acceptable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
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

info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Check prerequisites for disaster recovery
check_dr_prerequisites() {
    log "🔍 Checking disaster recovery prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is required but not installed"
        exit 1
    fi
    
    # Check jq for JSON processing
    if ! command -v jq &> /dev/null; then
        error "jq is required but not installed"
        exit 1
    fi
    
    # Check AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check if we can access the region
    if ! aws ec2 describe-regions --region "${REGION}" &> /dev/null; then
        error "Cannot access AWS region: ${REGION}"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Assess disaster scope and impact
assess_disaster_scope() {
    log "🔍 Assessing disaster scope and impact..."
    
    echo ""
    info "=== DISASTER RECOVERY ASSESSMENT ==="
    echo ""
    
    # Check CloudFormation stacks
    log "Checking CloudFormation stacks..."
    
    MAIN_STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].StackStatus" \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    CLOUDFRONT_STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "${CLOUDFRONT_STACK}" \
        --region "us-east-1" \
        --query "Stacks[0].StackStatus" \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    echo "Stack Status:"
    echo "- Main Stack (${STACK_NAME}): ${MAIN_STACK_STATUS}"
    echo "- CloudFront Stack (${CLOUDFRONT_STACK}): ${CLOUDFRONT_STACK_STATUS}"
    echo ""
    
    # If stacks exist, check individual resources
    if [ "$MAIN_STACK_STATUS" != "NOT_FOUND" ] && [ "$MAIN_STACK_STATUS" != "DELETE_COMPLETE" ]; then
        check_resource_health
    else
        warn "Main stack not found or deleted - full infrastructure recovery required"
    fi
    
    # Determine recovery strategy
    determine_recovery_strategy "$MAIN_STACK_STATUS" "$CLOUDFRONT_STACK_STATUS"
}

# Check health of individual resources
check_resource_health() {
    log "Checking individual resource health..."
    
    # Get resource names from CloudFormation
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    PHOTO_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    API_GATEWAY_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayId'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    echo "Resource Health Check:"
    
    # Check DynamoDB table
    if [ -n "$TABLE_NAME" ]; then
        TABLE_STATUS=$(aws dynamodb describe-table \
            --table-name "${TABLE_NAME}" \
            --region "${REGION}" \
            --query "Table.TableStatus" \
            --output text 2>/dev/null || echo "NOT_FOUND")
        echo "- DynamoDB Table (${TABLE_NAME}): ${TABLE_STATUS}"
        
        if [ "$TABLE_STATUS" = "ACTIVE" ]; then
            # Check point-in-time recovery status
            PITR_STATUS=$(aws dynamodb describe-continuous-backups \
                --table-name "${TABLE_NAME}" \
                --region "${REGION}" \
                --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus" \
                --output text 2>/dev/null || echo "UNKNOWN")
            echo "  - Point-in-Time Recovery: ${PITR_STATUS}"
        fi
    else
        echo "- DynamoDB Table: NOT_FOUND"
    fi
    
    # Check S3 buckets
    if [ -n "$PHOTO_BUCKET" ]; then
        if aws s3api head-bucket --bucket "${PHOTO_BUCKET}" 2>/dev/null; then
            echo "- S3 Photo Bucket (${PHOTO_BUCKET}): ACCESSIBLE"
            
            # Check versioning
            VERSIONING_STATUS=$(aws s3api get-bucket-versioning \
                --bucket "${PHOTO_BUCKET}" \
                --query "Status" \
                --output text 2>/dev/null || echo "None")
            echo "  - Versioning: ${VERSIONING_STATUS}"
        else
            echo "- S3 Photo Bucket (${PHOTO_BUCKET}): NOT_ACCESSIBLE"
        fi
    else
        echo "- S3 Photo Bucket: NOT_FOUND"
    fi
    
    # Check API Gateway
    if [ -n "$API_GATEWAY_ID" ]; then
        if aws apigatewayv2 get-api --api-id "${API_GATEWAY_ID}" --region "${REGION}" &>/dev/null; then
            echo "- API Gateway (${API_GATEWAY_ID}): ACCESSIBLE"
        else
            echo "- API Gateway (${API_GATEWAY_ID}): NOT_ACCESSIBLE"
        fi
    else
        echo "- API Gateway: NOT_FOUND"
    fi
    
    echo ""
}

# Determine recovery strategy based on assessment
determine_recovery_strategy() {
    local main_stack_status="$1"
    local cloudfront_stack_status="$2"
    
    log "Determining recovery strategy..."
    
    echo "Recovery Strategy Recommendations:"
    echo ""
    
    if [ "$main_stack_status" = "CREATE_COMPLETE" ] || [ "$main_stack_status" = "UPDATE_COMPLETE" ]; then
        if [ -n "$TABLE_NAME" ] && [ "$TABLE_STATUS" = "ACTIVE" ]; then
            info "✓ PARTIAL RECOVERY: Infrastructure intact, data recovery may be needed"
            echo "  Recommended actions:"
            echo "  1. Check data integrity: $0 ${ENVIRONMENT} validate-data"
            echo "  2. If data issues found: $0 ${ENVIRONMENT} recover-data"
            echo "  3. Test application functionality"
        else
            warn "⚠ INFRASTRUCTURE RECOVERY: Stack exists but resources damaged"
            echo "  Recommended actions:"
            echo "  1. Attempt resource recovery: $0 ${ENVIRONMENT} recover-resources"
            echo "  2. If unsuccessful: $0 ${ENVIRONMENT} full-recovery"
        fi
    else
        error "🚨 FULL DISASTER RECOVERY: Complete infrastructure rebuild required"
        echo "  Recommended actions:"
        echo "  1. Full recovery: $0 ${ENVIRONMENT} full-recovery"
        echo "  2. Data recovery: $0 ${ENVIRONMENT} recover-data"
        echo "  3. Validation: $0 ${ENVIRONMENT} validate-recovery"
    fi
    
    echo ""
    warn "⏰ Recovery Time Objective (RTO): ${RTO_HOURS} hours"
    warn "📊 Recovery Point Objective (RPO): Up to ${RPO_HOURS} hour data loss acceptable"
}

# Validate data integrity
validate_data_integrity() {
    log "🔍 Validating data integrity..."
    
    if [ -z "$TABLE_NAME" ]; then
        error "Cannot validate data - table name not found"
        return 1
    fi
    
    # Check if table exists and is accessible
    if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
        error "Table not accessible: ${TABLE_NAME}"
        return 1
    fi
    
    # Get basic table statistics
    ITEM_COUNT=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    TABLE_SIZE=$(aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.TableSizeBytes' \
        --output text)
    
    log "Data integrity check results:"
    log "- Total items: ${ITEM_COUNT}"
    log "- Table size: ${TABLE_SIZE} bytes"
    
    # Sample data validation
    log "Performing sample data validation..."
    
    # Check for required data structures
    INVENTORY_COUNT=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"INVENTORY#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    CONTAINER_COUNT=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"CONTAINER#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    USER_COUNT=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"USER#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Data structure validation:"
    log "- Inventories: ${INVENTORY_COUNT}"
    log "- Containers: ${CONTAINER_COUNT}"
    log "- Users: ${USER_COUNT}"
    
    # Check for data corruption indicators
    VALIDATION_ERRORS=0
    
    # Sample a few items and check structure
    SAMPLE_ITEMS=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --limit 10 \
        --query 'Items[*]' \
        --output json)
    
    # Basic structure validation
    if echo "$SAMPLE_ITEMS" | jq -e 'length > 0' >/dev/null; then
        log "✓ Sample items found and accessible"
    else
        warn "✗ No sample items found or data structure issues"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
    
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        success "Data integrity validation passed"
        return 0
    else
        error "Data integrity validation failed with ${VALIDATION_ERRORS} errors"
        return 1
    fi
}

# Recover data using point-in-time recovery
recover_data() {
    log "🔄 Starting data recovery procedure..."
    
    if [ -z "$TABLE_NAME" ]; then
        error "Cannot recover data - table name not found"
        exit 1
    fi
    
    # Check point-in-time recovery availability
    PITR_INFO=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription" 2>/dev/null || echo "{}")
    
    PITR_STATUS=$(echo "$PITR_INFO" | jq -r '.PointInTimeRecoveryStatus // "DISABLED"')
    
    if [ "$PITR_STATUS" != "ENABLED" ]; then
        error "Point-in-time recovery is not enabled for ${TABLE_NAME}"
        log "Checking for available backups..."
        
        # List available backups
        AVAILABLE_BACKUPS=$(aws dynamodb list-backups \
            --table-name "${TABLE_NAME}" \
            --region "${REGION}" \
            --query "BackupSummaries[?BackupStatus=='AVAILABLE']" \
            --output json)
        
        BACKUP_COUNT=$(echo "$AVAILABLE_BACKUPS" | jq 'length')
        
        if [ "$BACKUP_COUNT" -gt 0 ]; then
            log "Found ${BACKUP_COUNT} available backups"
            echo "$AVAILABLE_BACKUPS" | jq -r '.[] | "- \(.BackupName) (\(.BackupCreationDateTime))"'
            
            warn "Manual intervention required:"
            warn "1. Choose a backup from the list above"
            warn "2. Run: ./scripts/rollback-production.sh ${ENVIRONMENT} backup <backup_name>"
        else
            error "No backups available for recovery"
            error "Data recovery not possible - consider full system rebuild"
        fi
        
        return 1
    fi
    
    # Get recovery window
    EARLIEST_TIME=$(echo "$PITR_INFO" | jq -r '.EarliestRestorableDateTime')
    LATEST_TIME=$(echo "$PITR_INFO" | jq -r '.LatestRestorableDateTime')
    
    log "Point-in-time recovery window:"
    log "- Earliest: ${EARLIEST_TIME}"
    log "- Latest: ${LATEST_TIME}"
    
    # Calculate recovery point (1 hour ago to meet RPO)
    RECOVERY_TIME=$(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    log "Recommended recovery time: ${RECOVERY_TIME}"
    
    warn "⚠️  DATA RECOVERY OPERATION"
    warn "This will create a new table with data from: ${RECOVERY_TIME}"
    warn "Up to 1 hour of recent data may be lost (within RPO)"
    
    read -p "Continue with data recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Data recovery cancelled"
        return 0
    fi
    
    # Execute point-in-time recovery
    log "Executing point-in-time recovery..."
    ./scripts/rollback-production.sh "${ENVIRONMENT}" pitr "${RECOVERY_TIME}"
    
    success "Data recovery initiated - check rollback script output for details"
}

# Recover infrastructure resources
recover_resources() {
    log "🔄 Starting resource recovery procedure..."
    
    warn "⚠️  RESOURCE RECOVERY OPERATION"
    warn "This will attempt to repair or recreate damaged infrastructure resources"
    
    read -p "Continue with resource recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Resource recovery cancelled"
        return 0
    fi
    
    # Try to update the CloudFormation stack to repair resources
    log "Attempting CloudFormation stack update to repair resources..."
    
    if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${REGION}" &>/dev/null; then
        log "Stack exists - attempting repair update..."
        
        # Use existing SAM configuration to redeploy
        if [ -f "samconfig-${ENVIRONMENT}.toml" ]; then
            log "Redeploying using SAM configuration..."
            sam deploy --config-file "samconfig-${ENVIRONMENT}.toml" --region "${REGION}"
            
            if [ $? -eq 0 ]; then
                success "Resource recovery completed successfully"
                log "Validating recovered resources..."
                check_resource_health
            else
                error "Resource recovery failed - full recovery may be required"
                return 1
            fi
        else
            error "SAM configuration file not found: samconfig-${ENVIRONMENT}.toml"
            return 1
        fi
    else
        warn "Stack not found - full recovery required"
        return 1
    fi
}

# Full disaster recovery procedure
full_recovery() {
    log "🚨 Starting FULL DISASTER RECOVERY procedure..."
    
    warn "⚠️  FULL DISASTER RECOVERY OPERATION"
    warn "This will rebuild the entire infrastructure from scratch"
    warn "Estimated time: 2-4 hours (within ${RTO_HOURS} hour RTO)"
    
    read -p "Continue with full disaster recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Full disaster recovery cancelled"
        return 0
    fi
    
    # Step 1: Deploy infrastructure
    log "Step 1/4: Deploying infrastructure..."
    
    if [ -f "samconfig-${ENVIRONMENT}.toml" ]; then
        sam build
        sam deploy --config-file "samconfig-${ENVIRONMENT}.toml" --region "${REGION}"
        
        if [ $? -ne 0 ]; then
            error "Infrastructure deployment failed"
            return 1
        fi
        
        success "Infrastructure deployment completed"
    else
        error "SAM configuration file not found: samconfig-${ENVIRONMENT}.toml"
        return 1
    fi
    
    # Step 2: Deploy CloudFront (if needed)
    log "Step 2/4: Deploying CloudFront distribution..."
    
    if [ -f "samconfig-cloudfront-${ENVIRONMENT}.toml" ]; then
        sam deploy \
            --template-file cloudfront-template.yaml \
            --config-file "samconfig-cloudfront-${ENVIRONMENT}.toml" \
            --region "us-east-1"
        
        if [ $? -ne 0 ]; then
            warn "CloudFront deployment failed - continuing with main recovery"
        else
            success "CloudFront deployment completed"
        fi
    else
        warn "CloudFront configuration not found - skipping CloudFront deployment"
    fi
    
    # Step 3: Recover data
    log "Step 3/4: Recovering data..."
    
    # Get new table name
    get_resource_names
    
    if [ -n "$TABLE_NAME" ]; then
        # Check for available backups or PITR
        if ! validate_data_integrity; then
            log "Data recovery needed..."
            recover_data
        else
            log "Data appears to be intact"
        fi
    else
        error "Could not determine table name after infrastructure deployment"
        return 1
    fi
    
    # Step 4: Validate recovery
    log "Step 4/4: Validating full recovery..."
    validate_recovery
    
    success "🎉 Full disaster recovery completed!"
    
    log ""
    log "Recovery Summary:"
    log "- Infrastructure: Rebuilt"
    log "- Data: Recovered (up to ${RPO_HOURS} hour loss acceptable)"
    log "- Total time: $(date)"
    log ""
    log "Next steps:"
    log "1. Test application functionality thoroughly"
    log "2. Update DNS/domain settings if needed"
    log "3. Notify users of service restoration"
    log "4. Document lessons learned"
}

# Get resource names from CloudFormation (helper function)
get_resource_names() {
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    PHOTO_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    API_GATEWAY_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayId'].OutputValue" \
        --output text 2>/dev/null || echo "")
}

# Validate complete recovery
validate_recovery() {
    log "🔍 Validating complete recovery..."
    
    # Check infrastructure
    log "Validating infrastructure..."
    check_resource_health
    
    # Check data integrity
    log "Validating data integrity..."
    if ! validate_data_integrity; then
        warn "Data integrity issues detected - may require additional recovery steps"
    fi
    
    # Basic functionality test
    log "Testing basic functionality..."
    
    if [ -n "$API_GATEWAY_ID" ]; then
        # Get API Gateway URL
        API_URL=$(aws apigatewayv2 get-api \
            --api-id "${API_GATEWAY_ID}" \
            --region "${REGION}" \
            --query 'ApiEndpoint' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$API_URL" ]; then
            log "Testing API endpoint: ${API_URL}"
            
            # Simple health check
            if curl -s -f "${API_URL}/health" >/dev/null 2>&1; then
                success "✓ API endpoint responding"
            else
                warn "✗ API endpoint not responding - may need additional configuration"
            fi
        fi
    fi
    
    success "Recovery validation completed"
}

# Generate disaster recovery report
generate_dr_report() {
    log "📊 Generating disaster recovery report..."
    
    REPORT_FILE="/tmp/disaster-recovery-report-$(date +%Y%m%d-%H%M%S).json"
    
    # Collect system status
    assess_disaster_scope > /tmp/dr-assessment.txt 2>&1
    
    # Create comprehensive report
    cat > "$REPORT_FILE" << EOF
{
    "disaster_recovery_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "${ENVIRONMENT}",
        "region": "${REGION}",
        "rto_hours": ${RTO_HOURS},
        "rpo_hours": ${RPO_HOURS},
        "stack_status": {
            "main_stack": "${MAIN_STACK_STATUS:-UNKNOWN}",
            "cloudfront_stack": "${CLOUDFRONT_STACK_STATUS:-UNKNOWN}"
        },
        "resources": {
            "dynamodb_table": "${TABLE_NAME:-NOT_FOUND}",
            "s3_bucket": "${PHOTO_BUCKET:-NOT_FOUND}",
            "api_gateway": "${API_GATEWAY_ID:-NOT_FOUND}"
        },
        "data_integrity": {
            "total_items": "${ITEM_COUNT:-UNKNOWN}",
            "table_size_bytes": "${TABLE_SIZE:-UNKNOWN}",
            "pitr_status": "${PITR_STATUS:-UNKNOWN}"
        },
        "recovery_options": [
            "validate-data: Check data integrity",
            "recover-data: Recover data using PITR/backups",
            "recover-resources: Repair infrastructure resources",
            "full-recovery: Complete infrastructure rebuild"
        ]
    }
}
EOF
    
    log "Report generated: ${REPORT_FILE}"
    
    # Display summary
    echo ""
    info "=== DISASTER RECOVERY REPORT SUMMARY ==="
    jq -r '.disaster_recovery_report | 
        "Environment: \(.environment)",
        "RTO: \(.rto_hours) hours",
        "RPO: \(.rpo_hours) hour",
        "Main Stack: \(.stack_status.main_stack)",
        "DynamoDB: \(.resources.dynamodb_table)",
        "S3 Bucket: \(.resources.s3_bucket)"' "$REPORT_FILE"
    echo ""
}

# Main function
main() {
    case "${2:-assess}" in
        assess)
            check_dr_prerequisites
            assess_disaster_scope
            generate_dr_report
            ;;
        validate-data)
            check_dr_prerequisites
            get_resource_names
            validate_data_integrity
            ;;
        recover-data)
            check_dr_prerequisites
            get_resource_names
            recover_data
            ;;
        recover-resources)
            check_dr_prerequisites
            recover_resources
            ;;
        full-recovery)
            check_dr_prerequisites
            full_recovery
            ;;
        validate-recovery)
            check_dr_prerequisites
            get_resource_names
            validate_recovery
            ;;
        report)
            check_dr_prerequisites
            generate_dr_report
            ;;
        *)
            echo "Usage: $0 [environment] [action]"
            echo ""
            echo "Arguments:"
            echo "  environment       Environment name (default: prod)"
            echo ""
            echo "Actions:"
            echo "  assess           Assess disaster scope and determine strategy (default)"
            echo "  validate-data    Validate data integrity"
            echo "  recover-data     Recover data using point-in-time recovery"
            echo "  recover-resources Repair infrastructure resources"
            echo "  full-recovery    Complete disaster recovery (infrastructure + data)"
            echo "  validate-recovery Validate recovery completion"
            echo "  report           Generate disaster recovery report"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION       AWS region (default: eu-west-1)"
            echo ""
            echo "Recovery Objectives:"
            echo "  RTO (Recovery Time Objective): ${RTO_HOURS} hours"
            echo "  RPO (Recovery Point Objective): ${RPO_HOURS} hour data loss acceptable"
            echo ""
            echo "Examples:"
            echo "  $0 prod assess"
            echo "  $0 prod validate-data"
            echo "  $0 prod recover-data"
            echo "  $0 prod full-recovery"
            echo ""
            echo "Disaster Recovery Workflow:"
            echo "  1. $0 prod assess              # Assess damage and determine strategy"
            echo "  2. $0 prod validate-data       # Check if data recovery is needed"
            echo "  3. $0 prod recover-data        # Recover data if needed"
            echo "  4. $0 prod recover-resources   # Repair infrastructure if needed"
            echo "  5. $0 prod validate-recovery   # Validate complete recovery"
            ;;
    esac
}

# Run main function
main "$@"