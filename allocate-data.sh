#!/bin/bash

# Simple script to allocate existing data to default inventory
# Uses the existing migration script in the backend

echo "🏠 Allocate Existing Data to Default Inventory"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "backend/scripts/migrate-to-inventory-system.js" ]; then
    echo "❌ Error: Migration script not found. Please run this from the project root directory."
    exit 1
fi

# Set environment variables
export TABLE_NAME=${TABLE_NAME:-"home-inventory-dev"}
export AWS_REGION=${AWS_REGION:-"us-east-1"}
export USER_ID=${USER_ID:-"default-user"}

echo "📋 Configuration:"
echo "   Table: $TABLE_NAME"
echo "   Region: $AWS_REGION"
echo "   User ID: $USER_ID"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS credentials verified"

# Ask user what they want to do
echo ""
echo "What would you like to do?"
echo "1) Dry run (see what would be updated without making changes)"
echo "2) Allocate all existing data to default inventory"
echo "3) Exit"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔍 Running dry run..."
        cd backend
        DRY_RUN=true node scripts/migrate-to-inventory-system.js
        ;;
    2)
        echo ""
        echo "⚠️  WARNING: This will modify your database!"
        echo "   This will create a default inventory and assign all existing data to it."
        echo ""
        read -p "Are you sure you want to proceed? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo "🚀 Allocating existing data to default inventory..."
            cd backend
            node scripts/migrate-to-inventory-system.js
        else
            echo "❌ Operation cancelled."
            exit 0
        fi
        ;;
    3)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✅ Process completed!"
echo ""
echo "Next steps:"
echo "1. Refresh your browser"
echo "2. Check the Things, Locations, Categories, and People pages"
echo "3. Your existing data should now be visible!"