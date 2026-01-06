#!/bin/bash

# Categories CSV Import Script
# Imports categories from CSV file using the API endpoint

set -e

ENVIRONMENT=${1:-dev}
CATEGORIES_FILE=${2:-"categories.csv"}
REGION="eu-west-1"

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

log "🏷️  Starting CSV categories import"
log "📁 Categories file: ${CATEGORIES_FILE}"
log "🌍 Environment: ${ENVIRONMENT}"
log "🌍 Region: ${REGION}"

if [ ! -f "$CATEGORIES_FILE" ]; then
    error "Categories file not found: $CATEGORIES_FILE"
    exit 1
fi

# Check if file is CSV
if [[ ! "$CATEGORIES_FILE" =~ \.csv$ ]]; then
    error "File must be a CSV file (*.csv)"
    exit 1
fi

# Get API URL based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    API_URL="https://f8bwpf2rcf.execute-api.eu-west-1.amazonaws.com/prod"
else
    API_URL="https://your-dev-api-url.execute-api.eu-west-1.amazonaws.com/dev"
fi

log "🔗 API URL: ${API_URL}"

# Read CSV content
CSV_CONTENT=$(cat "$CATEGORIES_FILE")
TOTAL_LINES=$(wc -l < "$CATEGORIES_FILE")
TOTAL_CATEGORIES=$((TOTAL_LINES - 1)) # Subtract header row

log "📊 Total categories to import: ${TOTAL_CATEGORIES}"

# Note: This script requires manual authentication setup
# In a real implementation, you would need to:
# 1. Get JWT token from Cognito
# 2. Get inventory ID from user
# 3. Make authenticated API call

warn "⚠️  This script requires manual setup:"
warn "   1. Update API_URL for your environment"
warn "   2. Add authentication (JWT token)"
warn "   3. Specify inventory ID"
warn "   4. Make API call to /categories endpoint with csvData"

log "📋 CSV file is ready for import through the web interface"
log "   File: ${CATEGORIES_FILE}"
log "   Categories: ${TOTAL_CATEGORIES}"

success "🎉 CSV file validated and ready for import!"

# Example of what the API call would look like:
cat << EOF

Example API call (requires authentication):
curl -X POST "${API_URL}/categories" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "csvData": "$(cat "$CATEGORIES_FILE" | sed 's/"/\\"/g' | tr '\n' '\\n')",
    "inventoryId": "YOUR_INVENTORY_ID"
  }'

EOF