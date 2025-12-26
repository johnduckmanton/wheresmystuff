#!/bin/bash

# Backup and Disaster Recovery Script for Moving & Storage System
# This script handles backup creation and restoration procedures

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"
BACKUP_BUCKET="home-inventory-backups-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Create backup bucket if it doesn't exist
create_backup_bucket() {
    log "Checking backup bucket: ${BACKUP_BUCKET}"
    
    if aws s3 ls "s3://${BACKUP_BUCKET}" 2>/dev/null; then
        log "Backup bucket already exists"
    else
        log "Creating backup bucket: ${BACKUP_BUCKET}"
        aws s3 mb "s3://${BACKUP_BUCKET}" --region "${REGION}"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "${BACKUP_BUCKET}" \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "${BACKUP_BUCKET}" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        success "Backup bucket created and configured"
    fi
}

# Backup DynamoDB table
backup_dynamodb() {
    log "Creating DynamoDB backup..."
    
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text)
    
    if [ -z "$TABLE_NAME" ]; then
        error "Could not find DynamoDB table name"
        return 1
    fi
    
    BACKUP_NAME="${TABLE_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
    
    log "Creating backup: ${BACKUP_NAME}"
    BACKUP_ARN=$(aws dynamodb create-backup \
        --table-name "${TABLE_NAME}" \
        --backup-name "${BACKUP_NAME}" \
        --region "${REGION}" \
        --query "BackupDetails.BackupArn" \
        --output text)
    
    success "DynamoDB backup created: ${BACKUP_ARN}"
    
    # Store backup metadata
    cat > "/tmp/backup-metadata.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "${ENVIRONMENT}",
    "table_name": "${TABLE_NAME}",
    "backup_name": "${BACKUP_NAME}",
    "backup_arn": "${BACKUP_ARN}",
    "region": "${REGION}"
}
EOF
    
    aws s3 cp "/tmp/backup-metadata.json" \
        "s3://${BACKUP_BUCKET}/dynamodb/${BACKUP_NAME}/metadata.json"
    
    success "Backup metadata stored"
}

# Backup S3 buckets
backup_s3_buckets() {
    log "Backing up S3 buckets..."
    
    # Get bucket names from stack outputs
    PHOTO_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
        --output text)
    
    QR_REPORT_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='QRReportBucketName'].OutputValue" \
        --output text)
    
    WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" \
        --output text)
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Backup photo bucket
    if [ -n "$PHOTO_BUCKET" ]; then
        log "Backing up photo bucket: ${PHOTO_BUCKET}"
        aws s3 sync "s3://${PHOTO_BUCKET}/" \
            "s3://${BACKUP_BUCKET}/photos/${TIMESTAMP}/" \
            --storage-class STANDARD_IA
        success "Photo bucket backed up"
    fi
    
    # Backup QR/report bucket
    if [ -n "$QR_REPORT_BUCKET" ]; then
        log "Backing up QR/report bucket: ${QR_REPORT_BUCKET}"
        aws s3 sync "s3://${QR_REPORT_BUCKET}/" \
            "s3://${BACKUP_BUCKET}/qr-reports/${TIMESTAMP}/" \
            --storage-class STANDARD_IA
        success "QR/report bucket backed up"
    fi
    
    # Backup website bucket (optional, since it's built from source)
    if [ -n "$WEBSITE_BUCKET" ]; then
        log "Backing up website bucket: ${WEBSITE_BUCKET}"
        aws s3 sync "s3://${WEBSITE_BUCKET}/" \
            "s3://${BACKUP_BUCKET}/website/${TIMESTAMP}/" \
            --storage-class STANDARD_IA
        success "Website bucket backed up"
    fi
}

# Backup CloudFormation template
backup_cloudformation() {
    log "Backing up CloudFormation template..."
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Get current template
    aws cloudformation get-template \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "TemplateBody" \
        > "/tmp/template-${TIMESTAMP}.json"
    
    # Upload to backup bucket
    aws s3 cp "/tmp/template-${TIMESTAMP}.json" \
        "s3://${BACKUP_BUCKET}/cloudformation/${TIMESTAMP}/template.json"
    
    # Get stack parameters
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Parameters" \
        > "/tmp/parameters-${TIMESTAMP}.json"
    
    aws s3 cp "/tmp/parameters-${TIMESTAMP}.json" \
        "s3://${BACKUP_BUCKET}/cloudformation/${TIMESTAMP}/parameters.json"
    
    success "CloudFormation template and parameters backed up"
}

# List available backups
list_backups() {
    log "Available backups:"
    
    echo ""
    echo "=== DynamoDB Backups ==="
    aws dynamodb list-backups \
        --region "${REGION}" \
        --query "BackupSummaries[?contains(BackupName, '${STACK_NAME}')].{Name:BackupName,Status:BackupStatus,CreationTime:BackupCreationDateTime}" \
        --output table
    
    echo ""
    echo "=== S3 Backup Folders ==="
    aws s3 ls "s3://${BACKUP_BUCKET}/" --recursive | head -20
}

# Restore from backup
restore_from_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        error "Backup name is required for restore operation"
        echo "Usage: $0 restore <backup_name>"
        echo ""
        echo "Available backups:"
        list_backups
        return 1
    fi
    
    warn "⚠️  RESTORE OPERATION - This will overwrite existing data!"
    read -p "Are you sure you want to restore from backup '${backup_name}'? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Restore operation cancelled"
        return 0
    fi
    
    log "Starting restore from backup: ${backup_name}"
    
    # Find backup ARN
    BACKUP_ARN=$(aws dynamodb list-backups \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupName=='${backup_name}'].BackupArn" \
        --output text)
    
    if [ -z "$BACKUP_ARN" ]; then
        error "Backup not found: ${backup_name}"
        return 1
    fi
    
    # Create new table from backup
    NEW_TABLE_NAME="${TABLE_NAME}-restored-$(date +%Y%m%d-%H%M%S)"
    
    log "Restoring to new table: ${NEW_TABLE_NAME}"
    aws dynamodb restore-table-from-backup \
        --target-table-name "${NEW_TABLE_NAME}" \
        --backup-arn "${BACKUP_ARN}" \
        --region "${REGION}"
    
    success "Table restored to: ${NEW_TABLE_NAME}"
    warn "Manual intervention required to switch to restored table"
}

# Disaster recovery procedure
disaster_recovery() {
    log "🚨 DISASTER RECOVERY PROCEDURE"
    
    warn "This will attempt to restore the entire system from backups"
    read -p "Continue with disaster recovery? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Disaster recovery cancelled"
        return 0
    fi
    
    log "Step 1: Recreating infrastructure from backup..."
    
    # Get latest CloudFormation backup
    LATEST_CF_BACKUP=$(aws s3 ls "s3://${BACKUP_BUCKET}/cloudformation/" | sort | tail -1 | awk '{print $2}')
    
    if [ -n "$LATEST_CF_BACKUP" ]; then
        log "Found CloudFormation backup: ${LATEST_CF_BACKUP}"
        
        # Download template and parameters
        aws s3 cp "s3://${BACKUP_BUCKET}/cloudformation/${LATEST_CF_BACKUP}template.json" \
            "/tmp/restore-template.json"
        aws s3 cp "s3://${BACKUP_BUCKET}/cloudformation/${LATEST_CF_BACKUP}parameters.json" \
            "/tmp/restore-parameters.json"
        
        log "CloudFormation backup downloaded"
    else
        warn "No CloudFormation backup found, using current template.yaml"
    fi
    
    log "Step 2: Restore DynamoDB data..."
    
    # List available DynamoDB backups
    echo "Available DynamoDB backups:"
    aws dynamodb list-backups \
        --region "${REGION}" \
        --query "BackupSummaries[?contains(BackupName, '${STACK_NAME}')].{Name:BackupName,Status:BackupStatus,CreationTime:BackupCreationDateTime}" \
        --output table
    
    read -p "Enter backup name to restore from: " backup_name
    restore_from_backup "$backup_name"
    
    log "Step 3: Restore S3 data..."
    
    # List available S3 backups
    echo "Available S3 backup timestamps:"
    aws s3 ls "s3://${BACKUP_BUCKET}/photos/" | awk '{print $2}'
    
    read -p "Enter timestamp to restore from (YYYYMMDD-HHMMSS): " timestamp
    
    if [ -n "$timestamp" ]; then
        log "Restoring S3 data from timestamp: ${timestamp}"
        
        # Restore photo bucket
        if aws s3 ls "s3://${BACKUP_BUCKET}/photos/${timestamp}/" &>/dev/null; then
            aws s3 sync "s3://${BACKUP_BUCKET}/photos/${timestamp}/" \
                "s3://${PHOTO_BUCKET}/"
            success "Photo bucket restored"
        fi
        
        # Restore QR/report bucket
        if aws s3 ls "s3://${BACKUP_BUCKET}/qr-reports/${timestamp}/" &>/dev/null; then
            aws s3 sync "s3://${BACKUP_BUCKET}/qr-reports/${timestamp}/" \
                "s3://${QR_REPORT_BUCKET}/"
            success "QR/report bucket restored"
        fi
    fi
    
    success "🎉 Disaster recovery procedure completed"
    warn "Please verify system functionality and update DNS/routing as needed"
}

# Main function
main() {
    case "${2:-backup}" in
        backup)
            log "Starting backup procedure for environment: ${ENVIRONMENT}"
            create_backup_bucket
            backup_dynamodb
            backup_s3_buckets
            backup_cloudformation
            success "🎉 Backup completed successfully"
            ;;
        list)
            list_backups
            ;;
        restore)
            restore_from_backup "$3"
            ;;
        disaster-recovery)
            disaster_recovery
            ;;
        *)
            echo "Usage: $0 [environment] [action] [options]"
            echo ""
            echo "Actions:"
            echo "  backup              Create full system backup (default)"
            echo "  list                List available backups"
            echo "  restore <name>      Restore from specific backup"
            echo "  disaster-recovery   Full disaster recovery procedure"
            echo ""
            echo "Examples:"
            echo "  $0 dev backup"
            echo "  $0 prod list"
            echo "  $0 dev restore my-backup-20231201-120000"
            echo "  $0 prod disaster-recovery"
            ;;
    esac
}

# Run main function
main "$@"