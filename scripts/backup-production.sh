#!/bin/bash

# Production Backup Script
# Creates backups using DynamoDB point-in-time recovery and S3 versioning

set -e

# Configuration
ENVIRONMENT=${1:-prod}
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

# Get resource names from CloudFormation
get_resource_names() {
    log "Getting resource names from CloudFormation stack: ${STACK_NAME}"
    
    # Get DynamoDB table name
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    # Get S3 bucket names
    PHOTO_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    QR_REPORT_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='QRReportBucketName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$TABLE_NAME" ]; then
        error "Could not find DynamoDB table name in stack outputs"
        exit 1
    fi
    
    log "Resources found:"
    log "- DynamoDB Table: ${TABLE_NAME}"
    log "- Photo Bucket: ${PHOTO_BUCKET:-Not found}"
    log "- QR/Report Bucket: ${QR_REPORT_BUCKET:-Not found}"
    log "- Website Bucket: ${WEBSITE_BUCKET:-Not found}"
}

# Create DynamoDB backup
create_dynamodb_backup() {
    log "Creating DynamoDB backup..."
    
    BACKUP_NAME="${TABLE_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Check if point-in-time recovery is enabled
    PITR_STATUS=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus" \
        --output text)
    
    if [ "$PITR_STATUS" != "ENABLED" ]; then
        warn "Point-in-time recovery is not enabled for ${TABLE_NAME}"
        log "Enabling point-in-time recovery..."
        
        aws dynamodb update-continuous-backups \
            --table-name "${TABLE_NAME}" \
            --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
            --region "${REGION}"
        
        success "Point-in-time recovery enabled"
    else
        log "Point-in-time recovery is already enabled"
    fi
    
    # Create on-demand backup
    log "Creating on-demand backup: ${BACKUP_NAME}"
    
    BACKUP_ARN=$(aws dynamodb create-backup \
        --table-name "${TABLE_NAME}" \
        --backup-name "${BACKUP_NAME}" \
        --region "${REGION}" \
        --query "BackupDetails.BackupArn" \
        --output text)
    
    if [ -z "$BACKUP_ARN" ]; then
        error "Failed to create backup"
        exit 1
    fi
    
    success "DynamoDB backup created: ${BACKUP_ARN}"
    
    # Store backup metadata
    BACKUP_METADATA=$(cat << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "${ENVIRONMENT}",
    "table_name": "${TABLE_NAME}",
    "backup_name": "${BACKUP_NAME}",
    "backup_arn": "${BACKUP_ARN}",
    "region": "${REGION}",
    "pitr_enabled": true,
    "backup_type": "on_demand"
}
EOF
)
    
    echo "$BACKUP_METADATA" > "/tmp/backup-metadata-$(date +%Y%m%d-%H%M%S).json"
    
    log "Backup metadata saved to /tmp/backup-metadata-$(date +%Y%m%d-%H%M%S).json"
}

# Verify S3 versioning and lifecycle policies
verify_s3_protection() {
    log "Verifying S3 bucket protection settings..."
    
    for bucket in "$PHOTO_BUCKET" "$QR_REPORT_BUCKET" "$WEBSITE_BUCKET"; do
        if [ -z "$bucket" ]; then
            continue
        fi
        
        log "Checking bucket: ${bucket}"
        
        # Check versioning status
        VERSIONING_STATUS=$(aws s3api get-bucket-versioning \
            --bucket "${bucket}" \
            --query "Status" \
            --output text 2>/dev/null || echo "None")
        
        if [ "$VERSIONING_STATUS" = "Enabled" ]; then
            success "Versioning enabled for ${bucket}"
        else
            warn "Versioning not enabled for ${bucket}"
        fi
        
        # Check lifecycle configuration
        if aws s3api get-bucket-lifecycle-configuration --bucket "${bucket}" &>/dev/null; then
            success "Lifecycle policies configured for ${bucket}"
        else
            warn "No lifecycle policies found for ${bucket}"
        fi
        
        # Check encryption
        if aws s3api get-bucket-encryption --bucket "${bucket}" &>/dev/null; then
            success "Encryption enabled for ${bucket}"
        else
            warn "Encryption not enabled for ${bucket}"
        fi
    done
}

# List available backups
list_backups() {
    log "Listing available backups..."
    
    echo ""
    echo "=== DynamoDB On-Demand Backups ==="
    aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupStatus=='AVAILABLE'].{Name:BackupName,Status:BackupStatus,CreationTime:BackupCreationDateTime,Size:BackupSizeBytes}" \
        --output table
    
    echo ""
    echo "=== Point-in-Time Recovery Status ==="
    aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription" \
        --output table
    
    echo ""
    echo "=== S3 Bucket Versions (Sample) ==="
    for bucket in "$PHOTO_BUCKET" "$QR_REPORT_BUCKET"; do
        if [ -n "$bucket" ]; then
            echo "Bucket: ${bucket}"
            aws s3api list-object-versions \
                --bucket "${bucket}" \
                --max-items 5 \
                --query "Versions[*].{Key:Key,VersionId:VersionId,LastModified:LastModified,Size:Size}" \
                --output table 2>/dev/null || echo "No versions found or access denied"
            echo ""
        fi
    done
}

# Test backup integrity
test_backup_integrity() {
    log "Testing backup integrity..."
    
    # Get the most recent backup
    LATEST_BACKUP=$(aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupStatus=='AVAILABLE'] | sort_by(@, &BackupCreationDateTime) | [-1].BackupArn" \
        --output text)
    
    if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "None" ]; then
        warn "No available backups found for testing"
        return 0
    fi
    
    log "Testing backup: ${LATEST_BACKUP}"
    
    # Get backup details
    aws dynamodb describe-backup \
        --backup-arn "${LATEST_BACKUP}" \
        --region "${REGION}" \
        --query "BackupDescription.{Name:BackupDetails.BackupName,Status:BackupDetails.BackupStatus,CreationTime:BackupDetails.BackupCreationDateTime,Size:BackupDetails.BackupSizeBytes}" \
        --output table
    
    success "Backup integrity check completed"
}

# Cleanup old backups (keep last 7 days)
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last 7 days)..."
    
    # Calculate cutoff date (7 days ago)
    CUTOFF_DATE=$(date -d '7 days ago' +%Y-%m-%d)
    
    # List backups older than cutoff date
    OLD_BACKUPS=$(aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupCreationDateTime < '${CUTOFF_DATE}'].BackupArn" \
        --output text)
    
    if [ -z "$OLD_BACKUPS" ] || [ "$OLD_BACKUPS" = "None" ]; then
        log "No old backups found to clean up"
        return 0
    fi
    
    log "Found old backups to delete:"
    echo "$OLD_BACKUPS" | tr '\t' '\n'
    
    read -p "Delete these old backups? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        echo "$OLD_BACKUPS" | tr '\t' '\n' | while read -r backup_arn; do
            if [ -n "$backup_arn" ]; then
                log "Deleting backup: ${backup_arn}"
                aws dynamodb delete-backup \
                    --backup-arn "${backup_arn}" \
                    --region "${REGION}"
                success "Deleted backup: ${backup_arn}"
            fi
        done
    else
        log "Backup cleanup cancelled"
    fi
}

# Main function
main() {
    case "${2:-backup}" in
        backup)
            log "🔄 Starting backup procedure for environment: ${ENVIRONMENT}"
            get_resource_names
            create_dynamodb_backup
            verify_s3_protection
            success "🎉 Backup procedure completed"
            ;;
        list)
            get_resource_names
            list_backups
            ;;
        test)
            get_resource_names
            test_backup_integrity
            ;;
        cleanup)
            get_resource_names
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 [environment] [action]"
            echo ""
            echo "Arguments:"
            echo "  environment   Environment name (default: prod)"
            echo ""
            echo "Actions:"
            echo "  backup        Create backup (default)"
            echo "  list          List available backups"
            echo "  test          Test backup integrity"
            echo "  cleanup       Clean up old backups"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 prod backup"
            echo "  $0 dev list"
            echo "  $0 prod cleanup"
            ;;
    esac
}

# Run main function
main "$@"