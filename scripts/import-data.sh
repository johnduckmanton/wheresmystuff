#!/bin/bash

# Data Import Script
# Imports data structures to DynamoDB from exported data

set -e

# Configuration
ENVIRONMENT=${1:-dev}
IMPORT_DIR=${2:-./data-export}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="${STACK_NAME:-home-inventory-system-${ENVIRONMENT}}"
DRY_RUN=${DRY_RUN:-false}

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
    
    log "Target table: ${TABLE_NAME}"
}

# Validate import directory
validate_import_directory() {
    log "Validating import directory: ${IMPORT_DIR}"
    
    if [ ! -d "$IMPORT_DIR" ]; then
        error "Import directory not found: $IMPORT_DIR"
        exit 1
    fi
    
    # Check for required files
    local required_files=(
        "metadata/export-metadata.json"
        "metadata/table-schema.json"
        "inventories/inventories.json"
        "memberships/memberships.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "${IMPORT_DIR}/${file}" ]; then
            error "Required file not found: ${file}"
            exit 1
        fi
    done
    
    # Validate JSON format
    for file in "${IMPORT_DIR}"/*/*.json; do
        if [ -f "$file" ]; then
            if ! jq empty "$file" 2>/dev/null; then
                error "Invalid JSON format: ${file#${IMPORT_DIR}/}"
                exit 1
            fi
        fi
    done
    
    success "Import directory validation passed"
}

# Display import summary
display_import_summary() {
    log "Import Summary:"
    
    local metadata_file="${IMPORT_DIR}/metadata/export-metadata.json"
    
    if [ -f "$metadata_file" ]; then
        local export_env=$(jq -r '.environment' "$metadata_file")
        local export_timestamp=$(jq -r '.export_timestamp' "$metadata_file")
        local total_items=$(jq -r '.total_items' "$metadata_file")
        local source_table=$(jq -r '.table_name' "$metadata_file")
        
        log "Source Environment: ${export_env}"
        log "Source Table: ${source_table}"
        log "Export Timestamp: ${export_timestamp}"
        log "Total Items: ${total_items}"
        log "Target Environment: ${ENVIRONMENT}"
        log "Target Table: ${TABLE_NAME}"
        
        echo ""
        log "Data breakdown:"
        
        # Count items in each file
        for file in "${IMPORT_DIR}"/*/*.json; do
            if [ -f "$file" ] && [[ "$file" != *"metadata"* ]]; then
                local relative_path=${file#${IMPORT_DIR}/}
                local count=$(jq '.Items | length' "$file" 2>/dev/null || echo "0")
                log "  ${relative_path}: ${count} items"
            fi
        done
    fi
}

# Validate schema compatibility
validate_schema_compatibility() {
    log "Validating schema compatibility..."
    
    local source_schema="${IMPORT_DIR}/metadata/table-schema.json"
    
    # Get target table schema
    aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.{AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes}' \
        > "/tmp/target-schema.json"
    
    # Use the schema validation script
    if ! ./scripts/validate-schema.sh "$source_schema" "/tmp/target-schema.json"; then
        error "Schema validation failed - cannot proceed with import"
        exit 1
    fi
    
    success "Schema compatibility validated"
}

# Create backup before import
create_backup_before_import() {
    log "Creating backup before import..."
    
    local backup_name="${TABLE_NAME}-pre-import-$(date +%Y%m%d-%H%M%S)"
    
    if [ "$DRY_RUN" = "true" ]; then
        log "[DRY RUN] Would create backup: ${backup_name}"
        return 0
    fi
    
    local backup_arn=$(aws dynamodb create-backup \
        --table-name "${TABLE_NAME}" \
        --backup-name "${backup_name}" \
        --region "${REGION}" \
        --query "BackupDetails.BackupArn" \
        --output text)
    
    if [ -z "$backup_arn" ]; then
        error "Failed to create backup"
        exit 1
    fi
    
    success "Backup created: ${backup_arn}"
    echo "${backup_arn}" > "/tmp/import-backup-arn.txt"
}

# Import data from JSON file
import_json_file() {
    local file_path="$1"
    local description="$2"
    
    if [ ! -f "$file_path" ]; then
        warn "File not found, skipping: ${file_path}"
        return 0
    fi
    
    local item_count=$(jq '.Items | length' "$file_path")
    
    if [ "$item_count" -eq 0 ]; then
        log "No items to import from ${description}"
        return 0
    fi
    
    log "Importing ${item_count} items from ${description}..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log "[DRY RUN] Would import ${item_count} items from ${description}"
        return 0
    fi
    
    # Process items in batches of 25 (DynamoDB batch write limit)
    local batch_size=25
    local batches=$(( (item_count + batch_size - 1) / batch_size ))
    
    for ((i=0; i<batches; i++)); do
        local start=$((i * batch_size))
        
        # Create batch write request
        jq -n \
            --argjson items "$(jq ".Items[${start}:${start}+${batch_size}]" "$file_path")" \
            --arg table "${TABLE_NAME}" \
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
            }' > "/tmp/import-batch-${i}.json"
        
        # Execute batch write with retry logic
        local retry_count=0
        local max_retries=3
        
        while [ $retry_count -lt $max_retries ]; do
            if aws dynamodb batch-write-item \
                --request-items file:///tmp/import-batch-${i}.json \
                --region "${REGION}" > "/tmp/batch-result-${i}.json" 2>&1; then
                
                # Check for unprocessed items
                local unprocessed=$(jq '.UnprocessedItems | length' "/tmp/batch-result-${i}.json" 2>/dev/null || echo "0")
                
                if [ "$unprocessed" -eq 0 ]; then
                    break
                else
                    warn "Batch $((i+1))/${batches} has unprocessed items, retrying..."
                    retry_count=$((retry_count + 1))
                    sleep $((retry_count * 2))
                fi
            else
                error "Batch write failed for batch $((i+1))/${batches}"
                retry_count=$((retry_count + 1))
                sleep $((retry_count * 2))
            fi
        done
        
        if [ $retry_count -eq $max_retries ]; then
            error "Failed to import batch $((i+1))/${batches} after ${max_retries} retries"
            return 1
        fi
        
        # Progress indicator
        if [ $((i % 10)) -eq 0 ] || [ $i -eq $((batches - 1)) ]; then
            log "Progress: $((i+1))/${batches} batches completed"
        fi
        
        # Small delay to avoid throttling
        sleep 0.1
    done
    
    success "Imported ${item_count} items from ${description}"
}

# Import all data
import_all_data() {
    log "Starting data import..."
    
    # Import in order of dependencies
    
    # 1. Import inventories first
    import_json_file "${IMPORT_DIR}/inventories/inventories.json" "inventories"
    
    # 2. Import memberships
    import_json_file "${IMPORT_DIR}/memberships/memberships.json" "memberships"
    
    # 3. Import entities
    local entity_files=(
        "entities/things.json:things"
        "entities/locations.json:locations"
        "entities/rooms.json:rooms"
        "entities/categories.json:categories"
        "entities/people.json:people"
        "entities/containers.json:containers"
        "entities/projects.json:projects"
    )
    
    for entity_file in "${entity_files[@]}"; do
        local file_path="${IMPORT_DIR}/${entity_file%:*}"
        local description="${entity_file#*:}"
        import_json_file "$file_path" "$description"
    done
    
    # 4. Import special data
    import_json_file "${IMPORT_DIR}/entities/sharing-links.json" "sharing links"
    import_json_file "${IMPORT_DIR}/entities/notifications.json" "notifications"
    import_json_file "${IMPORT_DIR}/entities/audit-logs.json" "audit logs"
    
    success "Data import completed"
}

# Validate imported data
validate_imported_data() {
    log "Validating imported data..."
    
    # Get expected total from metadata
    local expected_total=$(jq '.total_items' "${IMPORT_DIR}/metadata/export-metadata.json")
    
    # Count actual items in target table
    local actual_total=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Expected items: ${expected_total}"
    log "Actual items: ${actual_total}"
    
    if [ "$expected_total" -eq "$actual_total" ]; then
        success "Item count validation passed"
    else
        warn "Item count mismatch - this may be expected if target table had existing data"
    fi
    
    # Sample validation - check a few items
    log "Performing sample data validation..."
    
    local validation_errors=0
    local sample_files=(
        "${IMPORT_DIR}/inventories/inventories.json"
        "${IMPORT_DIR}/memberships/memberships.json"
        "${IMPORT_DIR}/entities/things.json"
    )
    
    for file in "${sample_files[@]}"; do
        if [ -f "$file" ]; then
            # Get first item from file
            local sample_item=$(jq '.Items[0]' "$file" 2>/dev/null)
            
            if [ "$sample_item" != "null" ]; then
                local pk=$(echo "$sample_item" | jq -r '.pk.S // .pk')
                local sk=$(echo "$sample_item" | jq -r '.sk.S // .sk')
                
                # Check if item exists in target table
                if aws dynamodb get-item \
                    --table-name "${TABLE_NAME}" \
                    --key "{\"pk\":{\"S\":\"${pk}\"},\"sk\":{\"S\":\"${sk}\"}}" \
                    --region "${REGION}" \
                    --query 'Item' \
                    --output json | jq -e '. != null' &>/dev/null; then
                    log "✓ Sample validation passed for: ${file#${IMPORT_DIR}/}"
                else
                    warn "✗ Sample validation failed for: ${file#${IMPORT_DIR}/}"
                    validation_errors=$((validation_errors + 1))
                fi
            fi
        fi
    done
    
    if [ $validation_errors -eq 0 ]; then
        success "Sample data validation passed"
    else
        warn "Found ${validation_errors} validation issues"
    fi
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    rm -f /tmp/target-schema.json
    rm -f /tmp/import-batch-*.json
    rm -f /tmp/batch-result-*.json
    
    success "Cleanup completed"
}

# Main function
main() {
    case "${3:-import}" in
        import)
            log "🚀 Starting data import"
            log "Source: ${IMPORT_DIR}"
            log "Target Environment: ${ENVIRONMENT}"
            log "Mode: ${DRY_RUN:+DRY RUN}${DRY_RUN:-LIVE IMPORT}"
            
            if [ "$DRY_RUN" != "true" ]; then
                warn "⚠️  This will modify the target database!"
                read -p "Continue with import? (yes/no): " confirm
                
                if [ "$confirm" != "yes" ]; then
                    log "Import cancelled"
                    exit 0
                fi
            fi
            
            get_table_name
            validate_import_directory
            display_import_summary
            validate_schema_compatibility
            create_backup_before_import
            import_all_data
            validate_imported_data
            
            success "🎉 Data import completed successfully!"
            
            if [ "$DRY_RUN" != "true" ]; then
                log ""
                log "Backup information:"
                log "- Backup ARN: $(cat /tmp/import-backup-arn.txt 2>/dev/null || echo 'Not available')"
                log ""
                log "If issues occur, you can rollback using:"
                log "./scripts/rollback-production.sh ${ENVIRONMENT} backup <backup_name>"
            fi
            ;;
        validate)
            get_table_name
            validate_import_directory
            display_import_summary
            validate_schema_compatibility
            log "Import validation completed - ready for import"
            ;;
        *)
            echo "Usage: $0 [environment] [import_dir] [action]"
            echo ""
            echo "Arguments:"
            echo "  environment   Target environment (default: dev)"
            echo "  import_dir    Import directory (default: ./data-export)"
            echo ""
            echo "Actions:"
            echo "  import        Import data (default)"
            echo "  validate      Validate import readiness"
            echo ""
            echo "Environment Variables:"
            echo "  DRY_RUN       Set to 'true' for dry run mode"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 prod ./dev-export import"
            echo "  DRY_RUN=true $0 prod ./backup-data import"
            echo "  $0 dev ./data-export validate"
            ;;
    esac
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"