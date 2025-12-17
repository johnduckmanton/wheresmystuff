#!/bin/bash

# User Management Migration Runner
# This script helps run the user management migration with proper environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}User Management Migration Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: This script must be run from the backend directory${NC}"
    exit 1
fi

# Get the stack name from environment or use default
STACK_NAME=${STACK_NAME:-"home-inventory-dev"}

# Check if AWS SAM is available
if ! command -v sam &> /dev/null; then
    echo -e "${YELLOW}Warning: AWS SAM CLI not found. Will use environment variables directly.${NC}"
    USE_SAM=false
else
    USE_SAM=true
fi

# Function to get stack outputs
get_stack_output() {
    local output_key=$1
    if [ "$USE_SAM" = true ]; then
        sam list stack-outputs --stack-name "$STACK_NAME" --output json 2>/dev/null | \
            jq -r ".[] | select(.OutputKey==\"$output_key\") | .OutputValue" || echo ""
    else
        echo ""
    fi
}

# Get configuration from SAM stack or environment
if [ -z "$TABLE_NAME" ]; then
    TABLE_NAME=$(get_stack_output "TableName")
    if [ -z "$TABLE_NAME" ]; then
        TABLE_NAME="home-inventory-dev"
        echo -e "${YELLOW}Using default TABLE_NAME: $TABLE_NAME${NC}"
    else
        echo -e "${GREEN}Found TABLE_NAME from stack: $TABLE_NAME${NC}"
    fi
fi

if [ -z "$USER_POOL_ID" ]; then
    USER_POOL_ID=$(get_stack_output "UserPoolId")
    if [ -z "$USER_POOL_ID" ]; then
        echo -e "${YELLOW}Warning: USER_POOL_ID not found. User profile creation will be skipped.${NC}"
        echo -e "${YELLOW}Set USER_POOL_ID environment variable to enable user profile creation.${NC}"
    else
        echo -e "${GREEN}Found USER_POOL_ID from stack: $USER_POOL_ID${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Stack Name: ${GREEN}$STACK_NAME${NC}"
echo -e "  Table Name: ${GREEN}$TABLE_NAME${NC}"
echo -e "  User Pool ID: ${GREEN}${USER_POOL_ID:-'Not configured'}${NC}"
echo ""

# Check for dry run mode
if [ "$1" = "--dry-run" ] || [ "$1" = "-d" ]; then
    DRY_RUN=true
    echo -e "${YELLOW}Running in DRY RUN mode - no changes will be made${NC}"
    echo ""
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: ./run-user-management-migration.sh [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run, -d    Run in dry run mode (no changes)"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  STACK_NAME       SAM stack name (default: home-inventory-dev)"
    echo "  TABLE_NAME       DynamoDB table name (auto-detected from stack)"
    echo "  USER_POOL_ID     Cognito User Pool ID (auto-detected from stack)"
    echo ""
    exit 0
else
    DRY_RUN=false
    echo -e "${RED}⚠️  WARNING: This will modify your database!${NC}"
    echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
    read
fi

# Export environment variables
export TABLE_NAME
export USER_POOL_ID
export DRY_RUN

# Run the migration script
echo -e "${BLUE}Starting migration...${NC}"
echo ""

cd "$(dirname "$0")"
node migrate-user-management.js

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    
    if [ "$DRY_RUN" = true ]; then
        echo ""
        echo -e "${YELLOW}This was a dry run. To perform the actual migration, run:${NC}"
        echo -e "${YELLOW}  ./run-user-management-migration.sh${NC}"
    fi
else
    echo -e "${RED}❌ Migration failed with exit code $EXIT_CODE${NC}"
    exit $EXIT_CODE
fi
