#!/bin/bash

# Admin Script Wrapper: Add User by Email to Inventory
# 
# This script provides a convenient wrapper for adding users to inventories
# with administrator role using their email address.
#
# Usage:
#   ./add-admin-user.sh <email> <inventoryId> <adminUserId>
#
# Example:
#   ./add-admin-user.sh johnduckmanton@hotmail.com inv-123 admin-user-id

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if running from backend/scripts directory
if [[ ! -f "$SCRIPT_DIR/add-user-by-email.js" ]]; then
    echo "Error: add-user-by-email.js not found in $SCRIPT_DIR"
    exit 1
fi

# Check for required environment variables
if [[ -z "$TABLE_NAME" ]]; then
    echo "Warning: TABLE_NAME environment variable not set"
    echo "Using default: home-inventory-dev"
    export TABLE_NAME="home-inventory-dev"
fi

if [[ -z "$USER_POOL_ID" ]]; then
    echo "Error: USER_POOL_ID environment variable is required"
    echo "Please set it before running this script:"
    echo "  export USER_POOL_ID=your-user-pool-id"
    exit 1
fi

# Run the Node.js script
node "$SCRIPT_DIR/add-user-by-email.js" "$@"
