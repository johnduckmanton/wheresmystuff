#!/bin/bash

# Simple Categories Import Script
# Imports categories one by one using put-item instead of batch-write-item

set -e

ENVIRONMENT=${1:-dev}
CATEGORIES_FILE="./data-export/entities/categories.json"
REGION="eu-west-1"
TABLE_NAME="home-inv-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

log "🏷️  Starting simple categories import"
log "📁 Categories file: ${CATEGORIES_FILE}"
log "🗄️  Target table: ${TABLE_NAME}"
log "🌍 Region: ${REGION}"

if [ ! -f "$CATEGORIES_FILE" ]; then
    error "Categories file not found: $CATEGORIES_FILE"
    exit 1
fi

# Get total count
TOTAL_ITEMS=$(jq '.Items | length' "$CATEGORIES_FILE")
log "📊 Total categories to import: ${TOTAL_ITEMS}"

# Import each category individually
IMPORTED=0
FAILED=0

for i in $(seq 0 $((TOTAL_ITEMS - 1))); do
    # Extract single item
    ITEM=$(jq ".Items[$i]" "$CATEGORIES_FILE")
    CATEGORY_NAME=$(echo "$ITEM" | jq -r '.entityData.M.name.S')
    
    log "Importing category $((i + 1))/${TOTAL_ITEMS}: ${CATEGORY_NAME}"
    
    # Write item to temp file
    echo "$ITEM" > "/tmp/category-${i}.json"
    
    # Import the item
    if aws dynamodb put-item \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --item "file:///tmp/category-${i}.json" \
        --no-cli-pager > /dev/null 2>&1; then
        
        success "✓ Imported: ${CATEGORY_NAME}"
        IMPORTED=$((IMPORTED + 1))
    else
        error "✗ Failed to import: ${CATEGORY_NAME}"
        FAILED=$((FAILED + 1))
    fi
    
    # Clean up temp file
    rm -f "/tmp/category-${i}.json"
    
    # Small delay to avoid throttling
    sleep 0.1
done

echo ""
log "📊 Import Summary:"
log "   ✅ Successfully imported: ${IMPORTED}"
log "   ❌ Failed to import: ${FAILED}"
log "   📈 Total processed: ${TOTAL_ITEMS}"

if [ $FAILED -eq 0 ]; then
    success "🎉 All categories imported successfully!"
else
    warn "⚠️  Some categories failed to import"
    exit 1
fi