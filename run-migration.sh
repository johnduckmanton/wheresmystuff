#!/bin/bash

# Migration script runner for inventory system
# This script helps you migrate existing data to the new inventory-based system

echo "🔄 Home Inventory System - Data Migration"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "backend/scripts/migrate-to-inventory-system.js" ]; then
    echo "❌ Error: Migration script not found. Please run this from the project root directory."
    exit 1
fi

# Set environment variables
export TABLE_NAME=${TABLE_NAME:-"home-inventory-dev"}
export AWS_REGION=${AWS_REGION:-"us-east-1"}

echo "📋 Configuration:"
echo "   Table: $TABLE_NAME"
echo "   Region: $AWS_REGION"
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
echo "1) Dry run (see what would be migrated without making changes)"
echo "2) Test migration with sample data"
echo "3) Run actual migration"
echo "4) Exit"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🔍 Running dry run migration..."
        cd backend
        DRY_RUN=true node scripts/migrate-to-inventory-system.js
        ;;
    2)
        echo ""
        echo "🧪 Running test migration..."
        cd backend
        node scripts/migrate-to-inventory-system.js --test
        ;;
    3)
        echo ""
        echo "⚠️  WARNING: This will modify your database!"
        echo "   Make sure you have a backup of your data."
        echo ""
        read -p "Are you sure you want to proceed? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo "🚀 Running actual migration..."
            cd backend
            node scripts/migrate-to-inventory-system.js
        else
            echo "❌ Migration cancelled."
            exit 0
        fi
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✅ Migration process completed!"
echo ""
echo "Next steps:"
echo "1. Test your application to make sure everything works"
echo "2. Check the AWS Console to verify the data structure"
echo "3. If something went wrong, restore from backup and contact support"