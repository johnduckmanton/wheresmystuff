#!/bin/bash

# Production Rollback Script
# Provides rollback capabilities using DynamoDB point-in-time recovery

set -e

# Configuration
ENVIRONMENT=${1:-prod}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Get table name from CloudFormation
get_table_name() {
    log "Getting table name from CloudFormation stack: ${STACK_NAME}"
    
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$TABLE_NAME" ]; then
        error "Could not find DynamoDB table name in stack outputs"
        exit 1
    fi
    
    log "Table name: ${TABLE_NAME}"
}

# List available recovery options
list_recovery_options() {
    log "Listing available recovery options..."
    
    echo ""
    echo "=== Point-in-Time Recovery Window ==="
    
    # Get PITR details
    PITR_INFO=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription")
    
    PITR_STATUS=$(echo "$PITR_INFO" | jq -r '.PointInTimeRecoveryStatus')
    EARLIEST_TIME=$(echo "$PITR_INFO" | jq -r '.EarliestRestorableDateTime')
    LATEST_TIME=$(echo "$PITR_INFO" | jq -r '.LatestRestorableDateTime')
    
    if [ "$PITR_STATUS" = "ENABLED" ]; then
        success "Point-in-time recovery is enabled"
        log "Recovery window: ${EARLIEST_TIME} to ${LATEST_TIME}"
    else
        error "Point-in-time recovery is not enabled"
        exit 1
    fi
    
    echo ""
    echo "=== Available On-Demand Backups ==="
    
    aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupStatus=='AVAILABLE'].{Name:BackupName,CreationTime:BackupCreationDateTime,Size:BackupSizeBytes}" \
        --output table
    
    echo ""
    echo "Recovery Options:"
    echo "1. Point-in-time recovery (restore to any point within the recovery window)"
    echo "2. On-demand backup recovery (restore from a specific backup)"
}

# Validate recovery timestamp
validate_timestamp() {
    local timestamp="$1"
    
    if [ -z "$timestamp" ]; then
        error "Timestamp is required"
        return 1
    fi
    
    # Check if timestamp is within PITR window
    PITR_INFO=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription")
    
    EARLIEST_TIME=$(echo "$PITR_INFO" | jq -r '.EarliestRestorableDateTime')
    LATEST_TIME=$(echo "$PITR_INFO" | jq -r '.LatestRestorableDateTime')
    
    # Convert timestamps to epoch for comparison
    TIMESTAMP_EPOCH=$(date -d "$timestamp" +%s 2>/dev/null || echo "0")
    EARLIEST_EPOCH=$(date -d "$EARLIEST_TIME" +%s)
    LATEST_EPOCH=$(date -d "$LATEST_TIME" +%s)
    
    if [ "$TIMESTAMP_EPOCH" -eq 0 ]; then
        error "Invalid timestamp format: $timestamp"
        error "Expected format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS"
        return 1
    fi
    
    if [ "$TIMESTAMP_EPOCH" -lt "$EARLIEST_EPOCH" ]; then
        error "Timestamp is before earliest restorable time: $EARLIEST_TIME"
        return 1
    fi
    
    if [ "$TIMESTAMP_EPOCH" -gt "$LATEST_EPOCH" ]; then
        error "Timestamp is after latest restorable time: $LATEST_TIME"
        return 1
    fi
    
    success "Timestamp is valid for point-in-time recovery"
    return 0
}

# Restore from point-in-time
restore_from_pitr() {
    local restore_time="$1"
    
    if ! validate_timestamp "$restore_time"; then
        exit 1
    fi
    
    # Generate restore table name
    RESTORE_TABLE_NAME="${TABLE_NAME}-pitr-$(date +%Y%m%d-%H%M%S)"
    
    warn "⚠️  POINT-IN-TIME RECOVERY OPERATION"
    log "This will create a new table: ${RESTORE_TABLE_NAME}"
    log "Restore time: ${restore_time}"
    log "Original table: ${TABLE_NAME}"
    
    read -p "Continue with point-in-time recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Recovery cancelled"
        return 0
    fi
    
    log "Starting point-in-time recovery..."
    
    # Convert timestamp to ISO format if needed
    ISO_TIMESTAMP=$(date -d "$restore_time" -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    # Start the restore operation
    aws dynamodb restore-table-to-point-in-time \
        --source-table-name "${TABLE_NAME}" \
        --target-table-name "${RESTORE_TABLE_NAME}" \
        --restore-date-time "${ISO_TIMESTAMP}" \
        --region "${REGION}"
    
    log "Restore operation initiated. Table: ${RESTORE_TABLE_NAME}"
    log "Waiting for table to become active..."
    
    # Wait for table to become active
    aws dynamodb wait table-exists \
        --table-name "${RESTORE_TABLE_NAME}" \
        --region "${REGION}"
    
    success "🎉 Point-in-time recovery completed!"
    log "Restored table: ${RESTORE_TABLE_NAME}"
    
    # Show next steps
    echo ""
    log "Next steps:"
    log "1. Verify the restored data in table: ${RESTORE_TABLE_NAME}"
    log "2. Update your application to use the restored table, or"
    log "3. Use the switch-table command to swap tables"
    log ""
    log "Commands:"
    log "  # Verify data"
    log "  aws dynamodb scan --table-name ${RESTORE_TABLE_NAME} --select COUNT"
    log ""
    log "  # Switch to restored table (requires manual CloudFormation update)"
    log "  $0 ${ENVIRONMENT} switch-table ${RESTORE_TABLE_NAME}"
}

# Restore from backup
restore_from_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        error "Backup name is required"
        echo "Available backups:"
        aws dynamodb list-backups \
            --table-name "${TABLE_NAME}" \
            --region "${REGION}" \
            --query "BackupSummaries[?BackupStatus=='AVAILABLE'].BackupName" \
            --output text
        return 1
    fi
    
    # Find backup ARN
    BACKUP_ARN=$(aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupName=='${backup_name}' && BackupStatus=='AVAILABLE'].BackupArn" \
        --output text)
    
    if [ -z "$BACKUP_ARN" ] || [ "$BACKUP_ARN" = "None" ]; then
        error "Backup not found or not available: ${backup_name}"
        return 1
    fi
    
    # Generate restore table name
    RESTORE_TABLE_NAME="${TABLE_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
    
    warn "⚠️  BACKUP RECOVERY OPERATION"
    log "This will create a new table: ${RESTORE_TABLE_NAME}"
    log "Backup: ${backup_name}"
    log "Backup ARN: ${BACKUP_ARN}"
    log "Original table: ${TABLE_NAME}"
    
    read -p "Continue with backup recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Recovery cancelled"
        return 0
    fi
    
    log "Starting backup recovery..."
    
    # Start the restore operation
    aws dynamodb restore-table-from-backup \
        --target-table-name "${RESTORE_TABLE_NAME}" \
        --backup-arn "${BACKUP_ARN}" \
        --region "${REGION}"
    
    log "Restore operation initiated. Table: ${RESTORE_TABLE_NAME}"
    log "Waiting for table to become active..."
    
    # Wait for table to become active
    aws dynamodb wait table-exists \
        --table-name "${RESTORE_TABLE_NAME}" \
        --region "${REGION}"
    
    success "🎉 Backup recovery completed!"
    log "Restored table: ${RESTORE_TABLE_NAME}"
    
    # Show next steps
    echo ""
    log "Next steps:"
    log "1. Verify the restored data in table: ${RESTORE_TABLE_NAME}"
    log "2. Update your application to use the restored table, or"
    log "3. Use the switch-table command to swap tables"
    log ""
    log "Commands:"
    log "  # Verify data"
    log "  aws dynamodb scan --table-name ${RESTORE_TABLE_NAME} --select COUNT"
    log ""
    log "  # Switch to restored table (requires manual CloudFormation update)"
    log "  $0 ${ENVIRONMENT} switch-table ${RESTORE_TABLE_NAME}"
}

# Switch to restored table (guidance only)
switch_table_guidance() {
    local new_table_name="$1"
    
    if [ -z "$new_table_name" ]; then
        error "New table name is required"
        return 1
    fi
    
    warn "⚠️  TABLE SWITCH OPERATION"
    log "This operation requires manual CloudFormation stack update"
    log "Current table: ${TABLE_NAME}"
    log "New table: ${new_table_name}"
    
    echo ""
    log "Manual steps required:"
    echo ""
    echo "1. Update your CloudFormation template or SAM configuration:"
    echo "   - Modify the DynamoDB table resource to use the new table name"
    echo "   - Or add a parameter to specify the table name"
    echo ""
    echo "2. Deploy the updated stack:"
    echo "   sam deploy --config-file samconfig-${ENVIRONMENT}.toml --parameter-overrides TableName=${new_table_name}"
    echo ""
    echo "3. Verify the application is working with the new table"
    echo ""
    echo "4. Once verified, you can delete the old table:"
    echo "   aws dynamodb delete-table --table-name ${TABLE_NAME}"
    echo ""
    
    warn "IMPORTANT: Test thoroughly before deleting the original table!"
}

# Validate restored data
validate_restored_data() {
    local restored_table="$1"
    
    if [ -z "$restored_table" ]; then
        error "Restored table name is required"
        return 1
    fi
    
    log "Validating restored data in table: ${restored_table}"
    
    # Check if table exists
    if ! aws dynamodb describe-table --table-name "${restored_table}" --region "${REGION}" &>/dev/null; then
        error "Table not found: ${restored_table}"
        return 1
    fi
    
    # Get item counts
    ORIGINAL_COUNT=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    RESTORED_COUNT=$(aws dynamodb scan \
        --table-name "${restored_table}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Item count comparison:"
    log "- Original table (${TABLE_NAME}): ${ORIGINAL_COUNT} items"
    log "- Restored table (${restored_table}): ${RESTORED_COUNT} items"
    
    if [ "$ORIGINAL_COUNT" -eq "$RESTORED_COUNT" ]; then
        success "Item counts match"
    else
        warn "Item count mismatch - this may be expected depending on restore time"
    fi
    
    # Sample data validation
    log "Performing sample data validation..."
    
    # Get a few sample items from original table
    SAMPLE_ITEMS=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --limit 5 \
        --query 'Items[*].{pk:pk,sk:sk}' \
        --output json)
    
    VALIDATION_ERRORS=0
    
    echo "$SAMPLE_ITEMS" | jq -c '.[]' | while read -r item; do
        PK=$(echo "$item" | jq -r '.pk.S // .pk')
        SK=$(echo "$item" | jq -r '.sk.S // .sk')
        
        # Check if item exists in restored table
        if aws dynamodb get-item \
            --table-name "${restored_table}" \
            --key "{\"pk\":{\"S\":\"${PK}\"},\"sk\":{\"S\":\"${SK}\"}}" \
            --region "${REGION}" \
            --query 'Item' \
            --output json | jq -e '. != null' &>/dev/null; then
            log "✓ Sample item found: pk=${PK}, sk=${SK}"
        else
            warn "✗ Sample item missing: pk=${PK}, sk=${SK}"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
    done
    
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        success "Sample data validation passed"
    else
        warn "Found ${VALIDATION_ERRORS} validation issues"
    fi
}

# Main function
main() {
    case "${2:-list}" in
        list)
            get_table_name
            list_recovery_options
            ;;
        pitr)
            get_table_name
            restore_from_pitr "$3"
            ;;
        backup)
            get_table_name
            restore_from_backup "$3"
            ;;
        switch-table)
            get_table_name
            switch_table_guidance "$3"
            ;;
        validate)
            get_table_name
            validate_restored_data "$3"
            ;;
        *)
            echo "Usage: $0 [environment] [action] [options]"
            echo ""
            echo "Arguments:"
            echo "  environment   Environment name (default: prod)"
            echo ""
            echo "Actions:"
            echo "  list                    List recovery options (default)"
            echo "  pitr <timestamp>        Restore from point-in-time"
            echo "  backup <backup_name>    Restore from backup"
            echo "  switch-table <name>     Switch to restored table (guidance)"
            echo "  validate <table_name>   Validate restored data"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 prod list"
            echo "  $0 prod pitr '2024-01-15 10:30:00'"
            echo "  $0 prod backup 'my-backup-20240115'"
            echo "  $0 prod validate 'home-inv-prod-pitr-20240115-103000'"
            echo ""
            echo "Timestamp formats for PITR:"
            echo "  - '2024-01-15 10:30:00'"
            echo "  - '2024-01-15T10:30:00'"
            echo "  - '2024-01-15T10:30:00Z'"
            ;;
    esac
}

# Run main function
main "$@"