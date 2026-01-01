#!/bin/bash

# Data Export Script
# Exports data structures from DynamoDB for synchronization and backup purposes

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"
OUTPUT_DIR=${2:-./data-export}

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

# Create output directory
create_output_directory() {
    log "Creating output directory: ${OUTPUT_DIR}"
    
    mkdir -p "${OUTPUT_DIR}"
    
    # Create subdirectories for different data types
    mkdir -p "${OUTPUT_DIR}/inventories"
    mkdir -p "${OUTPUT_DIR}/entities"
    mkdir -p "${OUTPUT_DIR}/memberships"
    mkdir -p "${OUTPUT_DIR}/metadata"
    
    success "Output directory structure created"
}

# Export table schema
export_schema() {
    log "Exporting table schema..."
    
    aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.{TableName:TableName,AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes,BillingMode:BillingModeSummary.BillingMode,StreamSpecification:StreamSpecification,SSEDescription:SSEDescription}' \
        > "${OUTPUT_DIR}/metadata/table-schema.json"
    
    success "Schema exported to ${OUTPUT_DIR}/metadata/table-schema.json"
}

# Export inventories
export_inventories() {
    log "Exporting inventories..."
    
    aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND sk = :sk" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":sk": {"S": "METADATA"}
        }' \
        --output json > "${OUTPUT_DIR}/inventories/inventories.json"
    
    INVENTORY_COUNT=$(jq '.Items | length' "${OUTPUT_DIR}/inventories/inventories.json")
    success "Exported ${INVENTORY_COUNT} inventories"
}

# Export inventory memberships
export_memberships() {
    log "Exporting inventory memberships..."
    
    aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND begins_with(sk, :sk_prefix)" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":sk_prefix": {"S": "MEMBER#"}
        }' \
        --output json > "${OUTPUT_DIR}/memberships/memberships.json"
    
    MEMBERSHIP_COUNT=$(jq '.Items | length' "${OUTPUT_DIR}/memberships/memberships.json")
    success "Exported ${MEMBERSHIP_COUNT} memberships"
}

# Export entities by type
export_entities() {
    log "Exporting entities..."
    
    local entity_types=("THINGS" "LOCATIONS" "ROOMS" "CATEGORIES" "PEOPLE" "CONTAINERS" "PROJECTS")
    local total_entities=0
    
    for entity_type in "${entity_types[@]}"; do
        log "Exporting ${entity_type}..."
        
        aws dynamodb scan \
            --table-name "${TABLE_NAME}" \
            --region "${REGION}" \
            --filter-expression "begins_with(pk, :prefix)" \
            --expression-attribute-values "{
                \":prefix\": {\"S\": \"INVENTORY#\"}
            }" \
            --output json | jq --arg type "$entity_type" '
                {
                    Items: [
                        .Items[] | 
                        select(.pk.S | contains($type))
                    ]
                }
            ' > "${OUTPUT_DIR}/entities/${entity_type,,}.json"
        
        local count=$(jq '.Items | length' "${OUTPUT_DIR}/entities/${entity_type,,}.json")
        log "Exported ${count} ${entity_type}"
        total_entities=$((total_entities + count))
    done
    
    success "Exported ${total_entities} total entities"
}

# Export sharing links and other special data
export_special_data() {
    log "Exporting sharing links and special data..."
    
    # Export sharing links
    aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix)" \
        --expression-attribute-values '{
            ":prefix": {"S": "SHARE#"}
        }' \
        --output json > "${OUTPUT_DIR}/entities/sharing-links.json"
    
    local share_count=$(jq '.Items | length' "${OUTPUT_DIR}/entities/sharing-links.json")
    log "Exported ${share_count} sharing links"
    
    # Export notifications
    aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix)" \
        --expression-attribute-values '{
            ":prefix": {"S": "NOTIFICATION#"}
        }' \
        --output json > "${OUTPUT_DIR}/entities/notifications.json"
    
    local notification_count=$(jq '.Items | length' "${OUTPUT_DIR}/entities/notifications.json")
    log "Exported ${notification_count} notifications"
    
    # Export audit logs (if any)
    aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix)" \
        --expression-attribute-values '{
            ":prefix": {"S": "AUDIT#"}
        }' \
        --output json > "${OUTPUT_DIR}/entities/audit-logs.json"
    
    local audit_count=$(jq '.Items | length' "${OUTPUT_DIR}/entities/audit-logs.json")
    log "Exported ${audit_count} audit logs"
}

# Generate export metadata
generate_export_metadata() {
    log "Generating export metadata..."
    
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local total_items=0
    
    # Count total items in all files
    for file in "${OUTPUT_DIR}"/*/*.json; do
        if [ -f "$file" ]; then
            local count=$(jq '.Items | length' "$file" 2>/dev/null || echo "0")
            total_items=$((total_items + count))
        fi
    done
    
    # Generate metadata
    cat > "${OUTPUT_DIR}/metadata/export-metadata.json" << EOF
{
    "export_timestamp": "${timestamp}",
    "environment": "${ENVIRONMENT}",
    "table_name": "${TABLE_NAME}",
    "region": "${REGION}",
    "total_items": ${total_items},
    "export_version": "1.0",
    "files": {
        "schema": "metadata/table-schema.json",
        "inventories": "inventories/inventories.json",
        "memberships": "memberships/memberships.json",
        "entities": {
            "things": "entities/things.json",
            "locations": "entities/locations.json",
            "rooms": "entities/rooms.json",
            "categories": "entities/categories.json",
            "people": "entities/people.json",
            "containers": "entities/containers.json",
            "projects": "entities/projects.json",
            "sharing_links": "entities/sharing-links.json",
            "notifications": "entities/notifications.json",
            "audit_logs": "entities/audit-logs.json"
        }
    }
}
EOF
    
    success "Export metadata generated: ${total_items} total items"
}

# Create export summary
create_export_summary() {
    log "Creating export summary..."
    
    echo "# Data Export Summary" > "${OUTPUT_DIR}/README.md"
    echo "" >> "${OUTPUT_DIR}/README.md"
    echo "**Export Date:** $(date)" >> "${OUTPUT_DIR}/README.md"
    echo "**Environment:** ${ENVIRONMENT}" >> "${OUTPUT_DIR}/README.md"
    echo "**Table:** ${TABLE_NAME}" >> "${OUTPUT_DIR}/README.md"
    echo "**Region:** ${REGION}" >> "${OUTPUT_DIR}/README.md"
    echo "" >> "${OUTPUT_DIR}/README.md"
    
    echo "## Files" >> "${OUTPUT_DIR}/README.md"
    echo "" >> "${OUTPUT_DIR}/README.md"
    
    # List all files with item counts
    for file in "${OUTPUT_DIR}"/*/*.json; do
        if [ -f "$file" ]; then
            local relative_path=${file#${OUTPUT_DIR}/}
            local count=$(jq '.Items | length' "$file" 2>/dev/null || echo "N/A")
            echo "- \`${relative_path}\`: ${count} items" >> "${OUTPUT_DIR}/README.md"
        fi
    done
    
    echo "" >> "${OUTPUT_DIR}/README.md"
    echo "## Usage" >> "${OUTPUT_DIR}/README.md"
    echo "" >> "${OUTPUT_DIR}/README.md"
    echo "To import this data to another environment:" >> "${OUTPUT_DIR}/README.md"
    echo "" >> "${OUTPUT_DIR}/README.md"
    echo "\`\`\`bash" >> "${OUTPUT_DIR}/README.md"
    echo "./scripts/import-data.sh [target_environment] ${OUTPUT_DIR}" >> "${OUTPUT_DIR}/README.md"
    echo "\`\`\`" >> "${OUTPUT_DIR}/README.md"
    
    success "Export summary created: ${OUTPUT_DIR}/README.md"
}

# Validate export integrity
validate_export() {
    log "Validating export integrity..."
    
    local validation_errors=0
    
    # Check if all expected files exist
    local expected_files=(
        "metadata/table-schema.json"
        "metadata/export-metadata.json"
        "inventories/inventories.json"
        "memberships/memberships.json"
        "entities/things.json"
        "entities/locations.json"
        "entities/rooms.json"
        "entities/categories.json"
        "entities/people.json"
        "entities/containers.json"
        "entities/projects.json"
        "entities/sharing-links.json"
        "entities/notifications.json"
        "entities/audit-logs.json"
    )
    
    for file in "${expected_files[@]}"; do
        if [ ! -f "${OUTPUT_DIR}/${file}" ]; then
            error "Missing file: ${file}"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Validate JSON format
    for file in "${OUTPUT_DIR}"/*/*.json; do
        if [ -f "$file" ]; then
            if ! jq empty "$file" 2>/dev/null; then
                error "Invalid JSON format: ${file#${OUTPUT_DIR}/}"
                validation_errors=$((validation_errors + 1))
            fi
        fi
    done
    
    # Check metadata consistency
    local metadata_total=$(jq '.total_items' "${OUTPUT_DIR}/metadata/export-metadata.json")
    local actual_total=0
    
    for file in "${OUTPUT_DIR}"/*/*.json; do
        if [ -f "$file" ] && [ "$file" != "${OUTPUT_DIR}/metadata/export-metadata.json" ] && [ "$file" != "${OUTPUT_DIR}/metadata/table-schema.json" ]; then
            local count=$(jq '.Items | length' "$file" 2>/dev/null || echo "0")
            actual_total=$((actual_total + count))
        fi
    done
    
    if [ "$metadata_total" -ne "$actual_total" ]; then
        error "Item count mismatch: metadata=${metadata_total}, actual=${actual_total}"
        validation_errors=$((validation_errors + 1))
    fi
    
    if [ $validation_errors -eq 0 ]; then
        success "Export validation passed"
    else
        error "Export validation failed with ${validation_errors} errors"
        exit 1
    fi
}

# Compress export
compress_export() {
    log "Compressing export..."
    
    local archive_name="data-export-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    tar -czf "${archive_name}" -C "$(dirname "${OUTPUT_DIR}")" "$(basename "${OUTPUT_DIR}")"
    
    local archive_size=$(du -h "${archive_name}" | cut -f1)
    success "Export compressed: ${archive_name} (${archive_size})"
    
    log "Archive location: $(pwd)/${archive_name}"
}

# Main function
main() {
    case "${3:-export}" in
        export)
            log "🚀 Starting data export for environment: ${ENVIRONMENT}"
            log "Output directory: ${OUTPUT_DIR}"
            
            get_table_name
            create_output_directory
            export_schema
            export_inventories
            export_memberships
            export_entities
            export_special_data
            generate_export_metadata
            create_export_summary
            validate_export
            
            success "🎉 Data export completed successfully!"
            log "Export location: ${OUTPUT_DIR}"
            
            read -p "Compress export? (yes/no): " compress
            if [ "$compress" = "yes" ]; then
                compress_export
            fi
            ;;
        validate)
            if [ ! -d "$OUTPUT_DIR" ]; then
                error "Export directory not found: $OUTPUT_DIR"
                exit 1
            fi
            validate_export
            ;;
        compress)
            if [ ! -d "$OUTPUT_DIR" ]; then
                error "Export directory not found: $OUTPUT_DIR"
                exit 1
            fi
            compress_export
            ;;
        *)
            echo "Usage: $0 [environment] [output_dir] [action]"
            echo ""
            echo "Arguments:"
            echo "  environment   Environment name (default: dev)"
            echo "  output_dir    Output directory (default: ./data-export)"
            echo ""
            echo "Actions:"
            echo "  export        Export data (default)"
            echo "  validate      Validate existing export"
            echo "  compress      Compress existing export"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 dev ./dev-export export"
            echo "  $0 prod ./prod-backup export"
            echo "  $0 dev ./data-export validate"
            ;;
    esac
}

# Run main function
main "$@"