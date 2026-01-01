#!/bin/bash

# Schema Validation Script
# Validates DynamoDB schema compatibility between source and target tables

set -e

SOURCE_SCHEMA_FILE="$1"
TARGET_SCHEMA_FILE="$2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[SCHEMA]${NC} $1"
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

# Check if files exist
if [ ! -f "$SOURCE_SCHEMA_FILE" ]; then
    error "Source schema file not found: $SOURCE_SCHEMA_FILE"
    exit 1
fi

if [ ! -f "$TARGET_SCHEMA_FILE" ]; then
    error "Target schema file not found: $TARGET_SCHEMA_FILE"
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    error "jq is required but not installed"
    exit 1
fi

log "Validating schema compatibility..."
log "Source: $SOURCE_SCHEMA_FILE"
log "Target: $TARGET_SCHEMA_FILE"

# Validation counters
ERRORS=0
WARNINGS=0

# Validate attribute definitions
validate_attributes() {
    log "Validating attribute definitions..."
    
    # Get attribute definitions
    SOURCE_ATTRS=$(jq -r '.AttributeDefinitions[] | "\(.AttributeName):\(.AttributeType)"' "$SOURCE_SCHEMA_FILE" | sort)
    TARGET_ATTRS=$(jq -r '.AttributeDefinitions[] | "\(.AttributeName):\(.AttributeType)"' "$TARGET_SCHEMA_FILE" | sort)
    
    # Check if all source attributes exist in target
    while IFS= read -r attr; do
        if ! echo "$TARGET_ATTRS" | grep -q "^$attr$"; then
            error "Missing attribute in target: $attr"
            ERRORS=$((ERRORS + 1))
        fi
    done <<< "$SOURCE_ATTRS"
    
    # Check for extra attributes in target (warnings only)
    while IFS= read -r attr; do
        if ! echo "$SOURCE_ATTRS" | grep -q "^$attr$"; then
            warn "Extra attribute in target: $attr"
            WARNINGS=$((WARNINGS + 1))
        fi
    done <<< "$TARGET_ATTRS"
    
    if [ $ERRORS -eq 0 ]; then
        success "Attribute definitions are compatible"
    fi
}

# Validate key schema
validate_key_schema() {
    log "Validating key schema..."
    
    # Get key schemas
    SOURCE_KEYS=$(jq -r '.KeySchema[] | "\(.AttributeName):\(.KeyType)"' "$SOURCE_SCHEMA_FILE" | sort)
    TARGET_KEYS=$(jq -r '.KeySchema[] | "\(.AttributeName):\(.KeyType)"' "$TARGET_SCHEMA_FILE" | sort)
    
    if [ "$SOURCE_KEYS" != "$TARGET_KEYS" ]; then
        error "Key schema mismatch!"
        echo "Source keys:"
        echo "$SOURCE_KEYS"
        echo "Target keys:"
        echo "$TARGET_KEYS"
        ERRORS=$((ERRORS + 1))
    else
        success "Key schemas match"
    fi
}

# Validate Global Secondary Indexes
validate_gsi() {
    log "Validating Global Secondary Indexes..."
    
    # Check if both have GSIs
    SOURCE_GSI_COUNT=$(jq '.GlobalSecondaryIndexes | length' "$SOURCE_SCHEMA_FILE" 2>/dev/null || echo "0")
    TARGET_GSI_COUNT=$(jq '.GlobalSecondaryIndexes | length' "$TARGET_SCHEMA_FILE" 2>/dev/null || echo "0")
    
    if [ "$SOURCE_GSI_COUNT" -eq 0 ] && [ "$TARGET_GSI_COUNT" -eq 0 ]; then
        success "No GSIs to validate"
        return 0
    fi
    
    if [ "$SOURCE_GSI_COUNT" -ne "$TARGET_GSI_COUNT" ]; then
        warn "GSI count mismatch: Source=$SOURCE_GSI_COUNT, Target=$TARGET_GSI_COUNT"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Validate each GSI
    if [ "$SOURCE_GSI_COUNT" -gt 0 ]; then
        for i in $(seq 0 $((SOURCE_GSI_COUNT - 1))); do
            SOURCE_GSI_NAME=$(jq -r ".GlobalSecondaryIndexes[$i].IndexName" "$SOURCE_SCHEMA_FILE")
            SOURCE_GSI_KEYS=$(jq -r ".GlobalSecondaryIndexes[$i].KeySchema[] | \"\(.AttributeName):\(.KeyType)\"" "$SOURCE_SCHEMA_FILE" | sort)
            
            # Find matching GSI in target
            TARGET_GSI_KEYS=$(jq -r ".GlobalSecondaryIndexes[] | select(.IndexName == \"$SOURCE_GSI_NAME\") | .KeySchema[] | \"\(.AttributeName):\(.KeyType)\"" "$TARGET_SCHEMA_FILE" | sort)
            
            if [ -z "$TARGET_GSI_KEYS" ]; then
                error "Missing GSI in target: $SOURCE_GSI_NAME"
                ERRORS=$((ERRORS + 1))
            elif [ "$SOURCE_GSI_KEYS" != "$TARGET_GSI_KEYS" ]; then
                error "GSI key schema mismatch for $SOURCE_GSI_NAME"
                echo "Source GSI keys:"
                echo "$SOURCE_GSI_KEYS"
                echo "Target GSI keys:"
                echo "$TARGET_GSI_KEYS"
                ERRORS=$((ERRORS + 1))
            else
                success "GSI $SOURCE_GSI_NAME is compatible"
            fi
        done
    fi
}

# Validate projection types
validate_projections() {
    log "Validating GSI projections..."
    
    SOURCE_GSI_COUNT=$(jq '.GlobalSecondaryIndexes | length' "$SOURCE_SCHEMA_FILE" 2>/dev/null || echo "0")
    
    if [ "$SOURCE_GSI_COUNT" -eq 0 ]; then
        return 0
    fi
    
    for i in $(seq 0 $((SOURCE_GSI_COUNT - 1))); do
        SOURCE_GSI_NAME=$(jq -r ".GlobalSecondaryIndexes[$i].IndexName" "$SOURCE_SCHEMA_FILE")
        SOURCE_PROJECTION=$(jq -r ".GlobalSecondaryIndexes[$i].Projection.ProjectionType" "$SOURCE_SCHEMA_FILE")
        
        TARGET_PROJECTION=$(jq -r ".GlobalSecondaryIndexes[] | select(.IndexName == \"$SOURCE_GSI_NAME\") | .Projection.ProjectionType" "$TARGET_SCHEMA_FILE")
        
        if [ "$SOURCE_PROJECTION" != "$TARGET_PROJECTION" ]; then
            warn "Projection type mismatch for GSI $SOURCE_GSI_NAME: Source=$SOURCE_PROJECTION, Target=$TARGET_PROJECTION"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
}

# Generate compatibility report
generate_report() {
    log "Generating compatibility report..."
    
    echo ""
    echo "=== SCHEMA COMPATIBILITY REPORT ==="
    echo ""
    
    # Source schema summary
    echo "Source Schema Summary:"
    echo "- Attributes: $(jq '.AttributeDefinitions | length' "$SOURCE_SCHEMA_FILE")"
    echo "- Key Schema: $(jq -r '.KeySchema[] | "\(.AttributeName) (\(.KeyType))"' "$SOURCE_SCHEMA_FILE" | tr '\n' ', ' | sed 's/,$//')"
    echo "- GSIs: $(jq '.GlobalSecondaryIndexes | length' "$SOURCE_SCHEMA_FILE" 2>/dev/null || echo "0")"
    
    echo ""
    
    # Target schema summary
    echo "Target Schema Summary:"
    echo "- Attributes: $(jq '.AttributeDefinitions | length' "$TARGET_SCHEMA_FILE")"
    echo "- Key Schema: $(jq -r '.KeySchema[] | "\(.AttributeName) (\(.KeyType))"' "$TARGET_SCHEMA_FILE" | tr '\n' ', ' | sed 's/,$//')"
    echo "- GSIs: $(jq '.GlobalSecondaryIndexes | length' "$TARGET_SCHEMA_FILE" 2>/dev/null || echo "0")"
    
    echo ""
    
    # Validation results
    echo "Validation Results:"
    echo "- Errors: $ERRORS"
    echo "- Warnings: $WARNINGS"
    
    if [ $ERRORS -eq 0 ]; then
        echo "- Status: ✅ COMPATIBLE"
    else
        echo "- Status: ❌ INCOMPATIBLE"
    fi
    
    echo ""
    
    # Recommendations
    if [ $ERRORS -gt 0 ]; then
        echo "❌ MIGRATION BLOCKED - Schema incompatibilities found"
        echo "Please resolve the errors above before proceeding with migration."
    elif [ $WARNINGS -gt 0 ]; then
        echo "⚠️  MIGRATION POSSIBLE WITH WARNINGS"
        echo "Review the warnings above and proceed with caution."
    else
        echo "✅ MIGRATION SAFE - Schemas are fully compatible"
    fi
}

# Main validation function
main() {
    validate_attributes
    validate_key_schema
    validate_gsi
    validate_projections
    generate_report
    
    # Exit with error code if validation failed
    if [ $ERRORS -gt 0 ]; then
        exit 1
    fi
    
    exit 0
}

# Run main function
main