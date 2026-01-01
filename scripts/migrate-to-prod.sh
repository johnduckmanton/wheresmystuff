#!/bin/bash

# Production Database Migration Script
# Migrates data from development to production environment with validation and rollback capabilities

set -e

# Configuration
SOURCE_ENV=${1:-dev}
TARGET_ENV=${2:-prod}
REGION=${AWS_REGION:-eu-west-1}
DRY_RUN=${DRY_RUN:-false}

# Stack names
SOURCE_STACK="home-inventory-${SOURCE_ENV}"
TARGET_STACK="home-inventory-${TARGET_ENV}"

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
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
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check if source stack exists
    if ! aws cloudformation describe-stacks --stack-name "${SOURCE_STACK}" --region "${REGION}" &> /dev/null; then
        error "Source stack '${SOURCE_STACK}' not found"
        exit 1
    fi
    
    # Check if target stack exists
    if ! aws cloudformation describe-stacks --stack-name "${TARGET_STACK}" --region "${REGION}" &> /dev/null; then
        error "Target stack '${TARGET_STACK}' not found"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Get table names from CloudFormation stacks
get_table_names() {
    log "Getting table names from CloudFormation stacks..."
    
    SOURCE_TABLE=$(aws cloudformation describe-stacks \
        --stack-name "${SOURCE_STACK}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text)
    
    TARGET_TABLE=$(aws cloudformation describe-stacks \
        --stack-name "${TARGET_STACK}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text)
    
    if [ -z "$SOURCE_TABLE" ] || [ -z "$TARGET_TABLE" ]; then
        error "Could not retrieve table names from CloudFormation stacks"
        exit 1
    fi
    
    log "Source table: ${SOURCE_TABLE}"
    log "Target table: ${TARGET_TABLE}"
}

# Create backup of production data
create_production_backup() {
    log "Creating backup of production data..."
    
    BACKUP_NAME="${TARGET_TABLE}-pre-migration-$(date +%Y%m%d-%H%M%S)"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "[DRY RUN] Would create backup: ${BACKUP_NAME}"
        return 0
    fi
    
    BACKUP_ARN=$(aws dynamodb create-backup \
        --table-name "${TARGET_TABLE}" \
        --backup-name "${BACKUP_NAME}" \
        --region "${REGION}" \
        --query "BackupDetails.BackupArn" \
        --output text)
    
    if [ -z "$BACKUP_ARN" ]; then
        error "Failed to create backup"
        exit 1
    fi
    
    success "Backup created: ${BACKUP_ARN}"
    
    # Store backup info for rollback
    echo "${BACKUP_ARN}" > "/tmp/migration-backup-arn.txt"
    echo "${BACKUP_NAME}" > "/tmp/migration-backup-name.txt"
}

# Validate schema compatibility
validate_schema_compatibility() {
    log "Validating schema compatibility..."
    
    # Get source table schema
    aws dynamodb describe-table \
        --table-name "${SOURCE_TABLE}" \
        --region "${REGION}" \
        --query 'Table.{AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes}' \
        > "/tmp/source-schema.json"
    
    # Get target table schema
    aws dynamodb describe-table \
        --table-name "${TARGET_TABLE}" \
        --region "${REGION}" \
        --query 'Table.{AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes}' \
        > "/tmp/target-schema.json"
    
    # Call schema validation script
    if ! ./scripts/validate-schema.sh "/tmp/source-schema.json" "/tmp/target-schema.json"; then
        error "Schema validation failed"
        exit 1
    fi
    
    success "Schema validation passed"
}

# Export data from source table
export_source_data() {
    log "Exporting data from source table..."
    
    EXPORT_FILE="/tmp/migration-data-$(date +%Y%m%d-%H%M%S).json"
    
    # Use scan to export all data (for small datasets)
    # For large datasets, consider using DynamoDB Export to S3
    aws dynamodb scan \
        --table-name "${SOURCE_TABLE}" \
        --region "${REGION}" \
        --output json > "${EXPORT_FILE}"
    
    ITEM_COUNT=$(jq '.Items | length' "${EXPORT_FILE}")
    log "Exported ${ITEM_COUNT} items to ${EXPORT_FILE}"
    
    # Store export file path for cleanup
    echo "${EXPORT_FILE}" > "/tmp/migration-export-file.txt"
}

# Import data to target table
import_target_data() {
    log "Importing data to target table..."
    
    EXPORT_FILE=$(cat "/tmp/migration-export-file.txt")
    
    if [ ! -f "${EXPORT_FILE}" ]; then
        error "Export file not found: ${EXPORT_FILE}"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        ITEM_COUNT=$(jq '.Items | length' "${EXPORT_FILE}")
        log "[DRY RUN] Would import ${ITEM_COUNT} items to ${TARGET_TABLE}"
        return 0
    fi
    
    # Process items in batches of 25 (DynamoDB batch write limit)
    BATCH_SIZE=25
    TOTAL_ITEMS=$(jq '.Items | length' "${EXPORT_FILE}")
    BATCHES=$(( (TOTAL_ITEMS + BATCH_SIZE - 1) / BATCH_SIZE ))
    
    log "Processing ${TOTAL_ITEMS} items in ${BATCHES} batches..."
    
    for ((i=0; i<BATCHES; i++)); do
        START=$((i * BATCH_SIZE))
        
        # Create batch write request
        jq -n \
            --argjson items "$(jq ".Items[${START}:${START}+${BATCH_SIZE}]" "${EXPORT_FILE}")" \
            --arg table "${TARGET_TABLE}" \
            '{
                RequestItems: {
                    ($table): [
                        $items[] | {
                            PutRequest: {
                                Item: .
                            }
                        }
                    ]
                }
            }' > "/tmp/batch-${i}.json"
        
        # Execute batch write
        aws dynamodb batch-write-item \
            --request-items file:///tmp/batch-${i}.json \
            --region "${REGION}" > /dev/null
        
        log "Processed batch $((i+1))/${BATCHES}"
        
        # Small delay to avoid throttling
        sleep 0.1
    done
    
    success "Data import completed"
}

# Validate data integrity
validate_data_integrity() {
    log "Validating data integrity..."
    
    # Get item counts
    SOURCE_COUNT=$(aws dynamodb scan \
        --table-name "${SOURCE_TABLE}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    TARGET_COUNT=$(aws dynamodb scan \
        --table-name "${TARGET_TABLE}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Source table items: ${SOURCE_COUNT}"
    log "Target table items: ${TARGET_COUNT}"
    
    if [ "$SOURCE_COUNT" != "$TARGET_COUNT" ]; then
        error "Item count mismatch! Source: ${SOURCE_COUNT}, Target: ${TARGET_COUNT}"
        return 1
    fi
    
    # Sample validation - check a few random items
    log "Performing sample data validation..."
    
    # Get a sample of items from source
    aws dynamodb scan \
        --table-name "${SOURCE_TABLE}" \
        --region "${REGION}" \
        --limit 10 \
        --query 'Items[*].{pk:pk.S,sk:sk.S}' \
        --output json > "/tmp/sample-keys.json"
    
    # Check if these items exist in target with same data
    VALIDATION_ERRORS=0
    
    while IFS= read -r item; do
        PK=$(echo "$item" | jq -r '.pk')
        SK=$(echo "$item" | jq -r '.sk')
        
        # Get item from source
        SOURCE_ITEM=$(aws dynamodb get-item \
            --table-name "${SOURCE_TABLE}" \
            --key "{\"pk\":{\"S\":\"${PK}\"},\"sk\":{\"S\":\"${SK}\"}}" \
            --region "${REGION}" \
            --query 'Item' \
            --output json)
        
        # Get item from target
        TARGET_ITEM=$(aws dynamodb get-item \
            --table-name "${TARGET_TABLE}" \
            --key "{\"pk\":{\"S\":\"${PK}\"},\"sk\":{\"S\":\"${SK}\"}}" \
            --region "${REGION}" \
            --query 'Item' \
            --output json)
        
        if [ "$SOURCE_ITEM" != "$TARGET_ITEM" ]; then
            warn "Data mismatch for item: pk=${PK}, sk=${SK}"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
    done < <(jq -c '.[]' "/tmp/sample-keys.json")
    
    if [ $VALIDATION_ERRORS -gt 0 ]; then
        error "Found ${VALIDATION_ERRORS} validation errors"
        return 1
    fi
    
    success "Data integrity validation passed"
}

# Rollback procedure
rollback_migration() {
    log "🔄 Starting rollback procedure..."
    
    if [ ! -f "/tmp/migration-backup-arn.txt" ]; then
        error "No backup ARN found for rollback"
        exit 1
    fi
    
    BACKUP_ARN=$(cat "/tmp/migration-backup-arn.txt")
    BACKUP_NAME=$(cat "/tmp/migration-backup-name.txt")
    
    warn "⚠️  ROLLBACK OPERATION - This will restore production data from backup!"
    read -p "Are you sure you want to rollback using backup '${BACKUP_NAME}'? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Rollback cancelled"
        return 0
    fi
    
    # Create new table from backup
    RESTORE_TABLE_NAME="${TARGET_TABLE}-rollback-$(date +%Y%m%d-%H%M%S)"
    
    log "Restoring from backup to: ${RESTORE_TABLE_NAME}"
    aws dynamodb restore-table-from-backup \
        --target-table-name "${RESTORE_TABLE_NAME}" \
        --backup-arn "${BACKUP_ARN}" \
        --region "${REGION}"
    
    success "Rollback table created: ${RESTORE_TABLE_NAME}"
    warn "Manual intervention required to switch CloudFormation stack to use rollback table"
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    rm -f /tmp/source-schema.json
    rm -f /tmp/target-schema.json
    rm -f /tmp/migration-data-*.json
    rm -f /tmp/batch-*.json
    rm -f /tmp/sample-keys.json
    rm -f /tmp/migration-export-file.txt
    
    success "Cleanup completed"
}

# Main migration function
run_migration() {
    log "🚀 Starting database migration"
    log "Source: ${SOURCE_ENV} (${SOURCE_TABLE})"
    log "Target: ${TARGET_ENV} (${TARGET_TABLE})"
    log "Mode: ${DRY_RUN:+DRY RUN}${DRY_RUN:-LIVE MIGRATION}"
    log ""
    
    if [ "$DRY_RUN" != "true" ]; then
        warn "⚠️  This will modify production data!"
        read -p "Continue with migration? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            log "Migration cancelled"
            exit 0
        fi
    fi
    
    # Execute migration steps
    check_prerequisites
    get_table_names
    create_production_backup
    validate_schema_compatibility
    export_source_data
    import_target_data
    validate_data_integrity
    
    success "🎉 Migration completed successfully!"
    
    if [ "$DRY_RUN" != "true" ]; then
        log ""
        log "Next steps:"
        log "1. Test the production application thoroughly"
        log "2. Monitor for any issues"
        log "3. If problems occur, run: $0 rollback"
        log ""
        log "Backup information:"
        log "- Backup ARN: $(cat /tmp/migration-backup-arn.txt 2>/dev/null || echo 'Not available')"
        log "- Backup Name: $(cat /tmp/migration-backup-name.txt 2>/dev/null || echo 'Not available')"
    fi
}

# Main function
main() {
    case "${3:-migrate}" in
        migrate)
            run_migration
            ;;
        rollback)
            rollback_migration
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo "Usage: $0 [source_env] [target_env] [action]"
            echo ""
            echo "Arguments:"
            echo "  source_env    Source environment (default: dev)"
            echo "  target_env    Target environment (default: prod)"
            echo ""
            echo "Actions:"
            echo "  migrate       Run migration (default)"
            echo "  rollback      Rollback to pre-migration backup"
            echo "  cleanup       Clean up temporary files"
            echo ""
            echo "Environment Variables:"
            echo "  DRY_RUN       Set to 'true' for dry run mode"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 dev prod migrate"
            echo "  DRY_RUN=true $0 dev prod migrate"
            echo "  $0 dev prod rollback"
            ;;
    esac
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"