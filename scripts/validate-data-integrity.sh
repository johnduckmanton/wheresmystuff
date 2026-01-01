#!/bin/bash

# Data Integrity Validation Script
# Validates data integrity and consistency in DynamoDB tables

set -e

# Configuration
ENVIRONMENT=${1:-dev}
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

# Global counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Check result tracking
check_result() {
    local result="$1"
    local message="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case "$result" in
        "pass")
            success "$message"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "fail")
            error "$message"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "warn")
            warn "$message"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
    esac
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
    
    log "Validating table: ${TABLE_NAME}"
}

# Validate table structure
validate_table_structure() {
    log "Validating table structure..."
    
    # Check if table exists
    if aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
        check_result "pass" "Table exists and is accessible"
    else
        check_result "fail" "Table does not exist or is not accessible"
        return 1
    fi
    
    # Check table status
    local table_status=$(aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.TableStatus' \
        --output text)
    
    if [ "$table_status" = "ACTIVE" ]; then
        check_result "pass" "Table status is ACTIVE"
    else
        check_result "fail" "Table status is ${table_status}, expected ACTIVE"
    fi
    
    # Check point-in-time recovery
    local pitr_status=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus" \
        --output text)
    
    if [ "$pitr_status" = "ENABLED" ]; then
        check_result "pass" "Point-in-time recovery is enabled"
    else
        check_result "warn" "Point-in-time recovery is disabled"
    fi
}

# Validate inventory structure
validate_inventories() {
    log "Validating inventory structure..."
    
    # Get all inventories
    local inventories=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND sk = :sk" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":sk": {"S": "METADATA"}
        }' \
        --query 'Items' \
        --output json)
    
    local inventory_count=$(echo "$inventories" | jq length)
    
    if [ "$inventory_count" -gt 0 ]; then
        check_result "pass" "Found ${inventory_count} inventories"
    else
        check_result "fail" "No inventories found"
        return 1
    fi
    
    # Validate each inventory
    echo "$inventories" | jq -c '.[]' | while read -r inventory; do
        local inventory_id=$(echo "$inventory" | jq -r '.pk.S' | sed 's/INVENTORY#//')
        local inventory_name=$(echo "$inventory" | jq -r '.name.S // .name // "Unknown"')
        local owner_id=$(echo "$inventory" | jq -r '.ownerId.S // .ownerId // ""')
        
        log "Validating inventory: ${inventory_name} (${inventory_id})"
        
        # Check required fields
        if [ -n "$owner_id" ]; then
            check_result "pass" "Inventory ${inventory_id} has owner ID"
        else
            check_result "fail" "Inventory ${inventory_id} missing owner ID"
        fi
        
        # Check if owner has membership record
        local owner_membership=$(aws dynamodb get-item \
            --table-name "${TABLE_NAME}" \
            --key "{\"pk\":{\"S\":\"INVENTORY#${inventory_id}\"},\"sk\":{\"S\":\"MEMBER#${owner_id}\"}}" \
            --region "${REGION}" \
            --query 'Item' \
            --output json)
        
        if [ "$owner_membership" != "null" ] && [ -n "$owner_membership" ]; then
            local role=$(echo "$owner_membership" | jq -r '.role.S // .role // ""')
            if [ "$role" = "owner" ]; then
                check_result "pass" "Owner membership exists for inventory ${inventory_id}"
            else
                check_result "fail" "Owner has incorrect role '${role}' for inventory ${inventory_id}"
            fi
        else
            check_result "fail" "Owner membership missing for inventory ${inventory_id}"
        fi
    done
}

# Validate memberships
validate_memberships() {
    log "Validating membership structure..."
    
    # Get all memberships
    local memberships=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND begins_with(sk, :sk_prefix)" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":sk_prefix": {"S": "MEMBER#"}
        }' \
        --query 'Items' \
        --output json)
    
    local membership_count=$(echo "$memberships" | jq length)
    
    if [ "$membership_count" -gt 0 ]; then
        check_result "pass" "Found ${membership_count} memberships"
    else
        check_result "fail" "No memberships found"
        return 1
    fi
    
    # Validate membership structure
    local valid_roles=("owner" "admin" "member" "readonly")
    local invalid_memberships=0
    
    echo "$memberships" | jq -c '.[]' | while read -r membership; do
        local inventory_id=$(echo "$membership" | jq -r '.inventoryId.S // .inventoryId // ""')
        local user_id=$(echo "$membership" | jq -r '.userId.S // .userId // ""')
        local role=$(echo "$membership" | jq -r '.role.S // .role // ""')
        
        # Check required fields
        if [ -z "$inventory_id" ] || [ -z "$user_id" ] || [ -z "$role" ]; then
            check_result "fail" "Membership missing required fields: inventoryId=${inventory_id}, userId=${user_id}, role=${role}"
            invalid_memberships=$((invalid_memberships + 1))
            continue
        fi
        
        # Check valid role
        local role_valid=false
        for valid_role in "${valid_roles[@]}"; do
            if [ "$role" = "$valid_role" ]; then
                role_valid=true
                break
            fi
        done
        
        if [ "$role_valid" = true ]; then
            check_result "pass" "Membership has valid role: ${role}"
        else
            check_result "fail" "Membership has invalid role: ${role}"
            invalid_memberships=$((invalid_memberships + 1))
        fi
        
        # Check if corresponding inventory exists
        local inventory_exists=$(aws dynamodb get-item \
            --table-name "${TABLE_NAME}" \
            --key "{\"pk\":{\"S\":\"INVENTORY#${inventory_id}\"},\"sk\":{\"S\":\"METADATA\"}}" \
            --region "${REGION}" \
            --query 'Item' \
            --output json)
        
        if [ "$inventory_exists" != "null" ] && [ -n "$inventory_exists" ]; then
            check_result "pass" "Inventory exists for membership: ${inventory_id}"
        else
            check_result "fail" "Inventory missing for membership: ${inventory_id}"
            invalid_memberships=$((invalid_memberships + 1))
        fi
    done
    
    if [ $invalid_memberships -eq 0 ]; then
        check_result "pass" "All memberships are valid"
    else
        check_result "fail" "Found ${invalid_memberships} invalid memberships"
    fi
}

# Validate entities
validate_entities() {
    log "Validating entity structure..."
    
    local entity_types=("THINGS" "LOCATIONS" "ROOMS" "CATEGORIES" "PEOPLE" "CONTAINERS" "PROJECTS")
    local total_entities=0
    local invalid_entities=0
    
    for entity_type in "${entity_types[@]}"; do
        log "Validating ${entity_type}..."
        
        # Get entities of this type
        local entities=$(aws dynamodb scan \
            --table-name "${TABLE_NAME}" \
            --region "${REGION}" \
            --filter-expression "begins_with(pk, :prefix)" \
            --expression-attribute-values "{
                \":prefix\": {\"S\": \"INVENTORY#\"}
            }" \
            --query 'Items' \
            --output json | jq --arg type "$entity_type" '[.[] | select(.pk.S | contains($type))]')
        
        local entity_count=$(echo "$entities" | jq length)
        total_entities=$((total_entities + entity_count))
        
        if [ "$entity_count" -gt 0 ]; then
            log "Found ${entity_count} ${entity_type}"
            
            # Validate each entity
            echo "$entities" | jq -c '.[]' | while read -r entity; do
                local pk=$(echo "$entity" | jq -r '.pk.S // .pk')
                local sk=$(echo "$entity" | jq -r '.sk.S // .sk')
                local inventory_id=$(echo "$pk" | sed -n 's/INVENTORY#\([^#]*\)#.*/\1/p')
                
                # Check if entity has required fields
                local entity_data=$(echo "$entity" | jq '.data // .')
                local entity_id=$(echo "$entity_data" | jq -r '.id.S // .id // ""')
                local entity_inventory_id=$(echo "$entity_data" | jq -r '.inventoryId.S // .inventoryId // ""')
                
                if [ -z "$entity_id" ]; then
                    check_result "fail" "Entity missing ID: ${pk}#${sk}"
                    invalid_entities=$((invalid_entities + 1))
                fi
                
                if [ -z "$entity_inventory_id" ]; then
                    check_result "fail" "Entity missing inventoryId: ${pk}#${sk}"
                    invalid_entities=$((invalid_entities + 1))
                elif [ "$entity_inventory_id" != "$inventory_id" ]; then
                    check_result "fail" "Entity inventoryId mismatch: ${pk}#${sk}"
                    invalid_entities=$((invalid_entities + 1))
                fi
                
                # Check if inventory exists for this entity
                local inventory_exists=$(aws dynamodb get-item \
                    --table-name "${TABLE_NAME}" \
                    --key "{\"pk\":{\"S\":\"INVENTORY#${inventory_id}\"},\"sk\":{\"S\":\"METADATA\"}}" \
                    --region "${REGION}" \
                    --query 'Item' \
                    --output json)
                
                if [ "$inventory_exists" = "null" ] || [ -z "$inventory_exists" ]; then
                    check_result "fail" "Inventory missing for entity: ${pk}#${sk}"
                    invalid_entities=$((invalid_entities + 1))
                fi
            done
        else
            log "No ${entity_type} found"
        fi
    done
    
    if [ $total_entities -gt 0 ]; then
        check_result "pass" "Found ${total_entities} total entities"
    else
        check_result "warn" "No entities found"
    fi
    
    if [ $invalid_entities -eq 0 ]; then
        check_result "pass" "All entities are valid"
    else
        check_result "fail" "Found ${invalid_entities} invalid entities"
    fi
}

# Validate referential integrity
validate_referential_integrity() {
    log "Validating referential integrity..."
    
    # Check for orphaned entities (entities without valid inventory)
    log "Checking for orphaned entities..."
    
    local orphaned_count=0
    
    # Get all inventory IDs
    local inventory_ids=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND sk = :sk" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":sk": {"S": "METADATA"}
        }' \
        --query 'Items[].pk.S' \
        --output json | jq -r '.[] | sub("INVENTORY#"; "") | sub("#.*"; "")')
    
    # Check entities for valid inventory references
    local all_entities=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND sk <> :metadata AND NOT begins_with(sk, :member)" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":metadata": {"S": "METADATA"},
            ":member": {"S": "MEMBER#"}
        }' \
        --query 'Items' \
        --output json)
    
    echo "$all_entities" | jq -c '.[]' | while read -r entity; do
        local pk=$(echo "$entity" | jq -r '.pk.S // .pk')
        local inventory_id=$(echo "$pk" | sed -n 's/INVENTORY#\([^#]*\)#.*/\1/p')
        
        if ! echo "$inventory_ids" | grep -q "^${inventory_id}$"; then
            check_result "fail" "Orphaned entity found: ${pk}"
            orphaned_count=$((orphaned_count + 1))
        fi
    done
    
    if [ $orphaned_count -eq 0 ]; then
        check_result "pass" "No orphaned entities found"
    else
        check_result "fail" "Found ${orphaned_count} orphaned entities"
    fi
}

# Check data consistency
validate_data_consistency() {
    log "Validating data consistency..."
    
    # Check for duplicate IDs within inventories
    log "Checking for duplicate entity IDs..."
    
    local duplicate_count=0
    
    # This is a simplified check - in a real system you'd want more comprehensive duplicate detection
    local entity_ids=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :prefix) AND sk <> :metadata AND NOT begins_with(sk, :member)" \
        --expression-attribute-values '{
            ":prefix": {"S": "INVENTORY#"},
            ":metadata": {"S": "METADATA"},
            ":member": {"S": "MEMBER#"}
        }' \
        --query 'Items[].sk.S' \
        --output json)
    
    local unique_ids=$(echo "$entity_ids" | jq -r '.[]' | sort | uniq)
    local total_ids=$(echo "$entity_ids" | jq -r '.[]' | wc -l)
    local unique_count=$(echo "$unique_ids" | wc -l)
    
    if [ "$total_ids" -eq "$unique_count" ]; then
        check_result "pass" "No duplicate entity IDs found"
    else
        duplicate_count=$((total_ids - unique_count))
        check_result "warn" "Found ${duplicate_count} potential duplicate entity IDs"
    fi
}

# Generate validation report
generate_validation_report() {
    log "Generating validation report..."
    
    local report_file="validation-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Data Integrity Validation Report

**Environment:** ${ENVIRONMENT}
**Table:** ${TABLE_NAME}
**Region:** ${REGION}
**Validation Date:** $(date)

## Summary

- Total Checks: ${TOTAL_CHECKS}
- Passed: ${PASSED_CHECKS}
- Failed: ${FAILED_CHECKS}
- Warnings: ${WARNING_CHECKS}

## Status

EOF
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo "✅ **VALIDATION PASSED** - No critical issues found" >> "$report_file"
    else
        echo "❌ **VALIDATION FAILED** - ${FAILED_CHECKS} critical issues found" >> "$report_file"
    fi
    
    if [ $WARNING_CHECKS -gt 0 ]; then
        echo "⚠️  **${WARNING_CHECKS} warnings** - Review recommended" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Recommendations

EOF
    
    if [ $FAILED_CHECKS -gt 0 ]; then
        echo "1. **Critical Issues:** Address all failed checks before proceeding with production deployment" >> "$report_file"
        echo "2. **Data Repair:** Use data repair scripts to fix integrity issues" >> "$report_file"
        echo "3. **Re-validation:** Run validation again after fixes" >> "$report_file"
    fi
    
    if [ $WARNING_CHECKS -gt 0 ]; then
        echo "4. **Warnings:** Review warning items and consider fixes" >> "$report_file"
    fi
    
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -eq 0 ]; then
        echo "✅ Data is ready for production deployment" >> "$report_file"
    fi
    
    success "Validation report generated: ${report_file}"
}

# Main function
main() {
    case "${2:-validate}" in
        validate)
            log "🔍 Starting data integrity validation for environment: ${ENVIRONMENT}"
            
            get_table_name
            validate_table_structure
            validate_inventories
            validate_memberships
            validate_entities
            validate_referential_integrity
            validate_data_consistency
            
            echo ""
            log "=== VALIDATION SUMMARY ==="
            log "Total Checks: ${TOTAL_CHECKS}"
            log "Passed: ${PASSED_CHECKS}"
            log "Failed: ${FAILED_CHECKS}"
            log "Warnings: ${WARNING_CHECKS}"
            
            generate_validation_report
            
            if [ $FAILED_CHECKS -eq 0 ]; then
                success "🎉 Data integrity validation completed successfully!"
                exit 0
            else
                error "💥 Data integrity validation failed with ${FAILED_CHECKS} critical issues"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [environment] [action]"
            echo ""
            echo "Arguments:"
            echo "  environment   Environment name (default: dev)"
            echo ""
            echo "Actions:"
            echo "  validate      Validate data integrity (default)"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 dev validate"
            echo "  $0 prod validate"
            ;;
    esac
}

# Run main function
main "$@"