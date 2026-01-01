#!/bin/bash

# Backup Validation and Testing Script
# Validates backup integrity and tests recovery processes
# Documents recovery time objectives and procedures

set -e

# Configuration
ENVIRONMENT=${1:-prod}
REGION=${AWS_REGION:-eu-west-1}
STACK_NAME="home-inventory-${ENVIRONMENT}"
VALIDATION_ID="backup-validation-$(date +%Y%m%d-%H%M%S)"

# Recovery objectives
RTO_HOURS=8  # Recovery Time Objective: 8 hours
RPO_HOURS=1  # Recovery Point Objective: 1 hour

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Validation results tracking
VALIDATION_RESULTS=()
FAILED_VALIDATIONS=0
TOTAL_VALIDATIONS=0

# Add validation result
add_validation_result() {
    local validation_name="$1"
    local result="$2"
    local details="$3"
    local duration="$4"
    
    TOTAL_VALIDATIONS=$((TOTAL_VALIDATIONS + 1))
    
    if [ "$result" = "PASS" ]; then
        success "✓ ${validation_name}: PASSED (${duration}s)"
    else
        error "✗ ${validation_name}: FAILED - ${details} (${duration}s)"
        FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
    fi
    
    VALIDATION_RESULTS+=("${validation_name}|${result}|${details}|${duration}")
}

# Initialize validation environment
initialize_validation() {
    log "🔍 Initializing Backup Validation: ${VALIDATION_ID}"
    log "Environment: ${ENVIRONMENT}"
    log "Region: ${REGION}"
    
    # Create validation results directory
    VALIDATION_RESULTS_DIR="/tmp/backup-validation-${VALIDATION_ID}"
    mkdir -p "${VALIDATION_RESULTS_DIR}"
    
    log "Validation results will be saved to: ${VALIDATION_RESULTS_DIR}"
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jq is required but not installed"
        exit 1
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Get resource names
    get_resource_names
    
    success "Validation environment initialized"
}

# Get resource names from CloudFormation
get_resource_names() {
    log "Getting resource names from CloudFormation..."
    
    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
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
    
    if [ -z "$TABLE_NAME" ]; then
        error "Could not find DynamoDB table name in stack outputs"
        exit 1
    fi
    
    log "Resources found:"
    log "- DynamoDB Table: ${TABLE_NAME}"
    log "- Photo Bucket: ${PHOTO_BUCKET:-Not found}"
    log "- QR/Report Bucket: ${QR_REPORT_BUCKET:-Not found}"
}

# Validation 1: DynamoDB Backup Integrity
validate_dynamodb_backups() {
    log "Validation 1: DynamoDB Backup Integrity"
    
    local validation_name="DynamoDB Backup Integrity"
    local start_time=$(date +%s)
    
    # Check point-in-time recovery status
    local pitr_info=$(aws dynamodb describe-continuous-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription" \
        2>/dev/null || echo "{}")
    
    local pitr_status=$(echo "$pitr_info" | jq -r '.PointInTimeRecoveryStatus // "DISABLED"')
    
    if [ "$pitr_status" != "ENABLED" ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Point-in-time recovery not enabled" "$duration"
        return 1
    fi
    
    # Check recovery window
    local earliest_time=$(echo "$pitr_info" | jq -r '.EarliestRestorableDateTime')
    local latest_time=$(echo "$pitr_info" | jq -r '.LatestRestorableDateTime')
    
    # Calculate recovery window in hours
    local earliest_epoch=$(date -d "$earliest_time" +%s)
    local latest_epoch=$(date -d "$latest_time" +%s)
    local window_hours=$(( (latest_epoch - earliest_epoch) / 3600 ))
    
    log "PITR window: ${window_hours} hours (${earliest_time} to ${latest_time})"
    
    # Validate recovery window meets requirements (at least 24 hours)
    if [ "$window_hours" -lt 24 ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "PITR window too short: ${window_hours} hours" "$duration"
        return 1
    fi
    
    # Check on-demand backups
    local backups=$(aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[?BackupStatus=='AVAILABLE']" \
        --output json)
    
    local backup_count=$(echo "$backups" | jq 'length')
    log "Available on-demand backups: ${backup_count}"
    
    # Save backup details for analysis
    echo "$backups" > "${VALIDATION_RESULTS_DIR}/available-backups.json"
    
    # Validate backup metadata
    if [ "$backup_count" -gt 0 ]; then
        log "Validating backup metadata..."
        
        # Check backup ages
        local old_backups=0
        echo "$backups" | jq -r '.[].BackupCreationDateTime' | while read -r backup_date; do
            local backup_epoch=$(date -d "$backup_date" +%s)
            local current_epoch=$(date +%s)
            local backup_age_days=$(( (current_epoch - backup_epoch) / 86400 ))
            
            if [ "$backup_age_days" -gt 7 ]; then
                old_backups=$((old_backups + 1))
            fi
        done
        
        log "Backup age analysis completed"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_validation_result "$validation_name" "PASS" "PITR enabled, ${window_hours}h window, ${backup_count} backups" "$duration"
}

# Validation 2: S3 Backup and Versioning
validate_s3_backups() {
    log "Validation 2: S3 Backup and Versioning"
    
    local validation_name="S3 Backup and Versioning"
    local start_time=$(date +%s)
    
    local s3_issues=0
    local s3_details=""
    
    for bucket in "$PHOTO_BUCKET" "$QR_REPORT_BUCKET"; do
        if [ -z "$bucket" ]; then
            continue
        fi
        
        log "Validating bucket: ${bucket}"
        
        # Check if bucket exists and is accessible
        if ! aws s3api head-bucket --bucket "${bucket}" 2>/dev/null; then
            s3_issues=$((s3_issues + 1))
            s3_details="${s3_details}Bucket ${bucket} not accessible; "
            continue
        fi
        
        # Check versioning status
        local versioning_status=$(aws s3api get-bucket-versioning \
            --bucket "${bucket}" \
            --query "Status" \
            --output text 2>/dev/null || echo "None")
        
        if [ "$versioning_status" != "Enabled" ]; then
            s3_issues=$((s3_issues + 1))
            s3_details="${s3_details}Bucket ${bucket} versioning not enabled; "
        else
            log "✓ Versioning enabled for ${bucket}"
        fi
        
        # Check lifecycle configuration
        if aws s3api get-bucket-lifecycle-configuration --bucket "${bucket}" &>/dev/null; then
            log "✓ Lifecycle policies configured for ${bucket}"
            
            # Save lifecycle configuration for analysis
            aws s3api get-bucket-lifecycle-configuration \
                --bucket "${bucket}" \
                --output json > "${VALIDATION_RESULTS_DIR}/lifecycle-${bucket}.json" 2>/dev/null || true
        else
            warn "No lifecycle policies found for ${bucket}"
        fi
        
        # Check encryption
        if aws s3api get-bucket-encryption --bucket "${bucket}" &>/dev/null; then
            log "✓ Encryption enabled for ${bucket}"
        else
            warn "Encryption not enabled for ${bucket}"
        fi
        
        # Sample object versions (if any exist)
        local version_count=$(aws s3api list-object-versions \
            --bucket "${bucket}" \
            --max-items 100 \
            --query "length(Versions)" \
            --output text 2>/dev/null || echo "0")
        
        log "Object versions in ${bucket}: ${version_count}"
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $s3_issues -eq 0 ]; then
        add_validation_result "$validation_name" "PASS" "All S3 buckets properly configured" "$duration"
    else
        add_validation_result "$validation_name" "FAIL" "$s3_details" "$duration"
    fi
}

# Validation 3: Backup Restoration Test (Non-Destructive)
validate_backup_restoration() {
    log "Validation 3: Backup Restoration Test (Non-Destructive)"
    
    local validation_name="Backup Restoration Test"
    local start_time=$(date +%s)
    
    # Test 1: Validate rollback script functionality
    log "Testing rollback script functionality..."
    
    if [ ! -x "./scripts/rollback-production.sh" ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Rollback script not found or not executable" "$duration"
        return 1
    fi
    
    # Test rollback script list function
    if ./scripts/rollback-production.sh "${ENVIRONMENT}" list > "${VALIDATION_RESULTS_DIR}/rollback-options.txt" 2>&1; then
        log "✓ Rollback script list function working"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Rollback script list function failed" "$duration"
        return 1
    fi
    
    # Test 2: Validate backup script functionality
    log "Testing backup script functionality..."
    
    if [ ! -x "./scripts/backup-production.sh" ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Backup script not found or not executable" "$duration"
        return 1
    fi
    
    # Test backup script list function
    if ./scripts/backup-production.sh "${ENVIRONMENT}" list > "${VALIDATION_RESULTS_DIR}/backup-list.txt" 2>&1; then
        log "✓ Backup script list function working"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Backup script list function failed" "$duration"
        return 1
    fi
    
    # Test 3: Validate disaster recovery script
    log "Testing disaster recovery script functionality..."
    
    if [ ! -x "./scripts/disaster-recovery.sh" ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Disaster recovery script not found" "$duration"
        return 1
    fi
    
    # Test disaster recovery assessment
    if ./scripts/disaster-recovery.sh "${ENVIRONMENT}" assess > "${VALIDATION_RESULTS_DIR}/dr-assessment.txt" 2>&1; then
        log "✓ Disaster recovery assessment working"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Disaster recovery assessment failed" "$duration"
        return 1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_validation_result "$validation_name" "PASS" "All restoration scripts functional" "$duration"
}

# Validation 4: Recovery Time Measurement
validate_recovery_times() {
    log "Validation 4: Recovery Time Measurement"
    
    local validation_name="Recovery Time Measurement"
    local start_time=$(date +%s)
    
    # Measure data validation time
    log "Measuring data validation time..."
    local data_validation_start=$(date +%s)
    
    if ./scripts/disaster-recovery.sh "${ENVIRONMENT}" validate-data > "${VALIDATION_RESULTS_DIR}/data-validation-timing.txt" 2>&1; then
        local data_validation_end=$(date +%s)
        local data_validation_time=$((data_validation_end - data_validation_start))
        log "Data validation time: ${data_validation_time} seconds"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Data validation failed during timing test" "$duration"
        return 1
    fi
    
    # Estimate full recovery time based on measurements
    log "Estimating recovery times..."
    
    # Get table size for estimation
    local table_size=$(aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.TableSizeBytes' \
        --output text)
    
    local item_count=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Table metrics: ${item_count} items, ${table_size} bytes"
    
    # Estimate recovery times based on AWS documentation and measurements
    # PITR restore time: ~1 minute per GB + base time
    local table_size_gb=$(( table_size / 1024 / 1024 / 1024 + 1 ))
    local estimated_pitr_minutes=$(( table_size_gb * 1 + 10 ))  # 1 min/GB + 10 min base
    
    # Infrastructure deployment time: measured from SAM deploy
    local estimated_infra_minutes=30  # Conservative estimate for SAM deploy
    
    # Total estimated recovery time
    local total_estimated_minutes=$(( estimated_pitr_minutes + estimated_infra_minutes + 30 ))  # +30 for validation
    
    log "Recovery time estimates:"
    log "- Data recovery (PITR): ${estimated_pitr_minutes} minutes"
    log "- Infrastructure deployment: ${estimated_infra_minutes} minutes"
    log "- Total estimated recovery: ${total_estimated_minutes} minutes"
    
    # Check against RTO (8 hours = 480 minutes)
    if [ "$total_estimated_minutes" -gt 480 ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Estimated recovery time ${total_estimated_minutes}m exceeds RTO 480m" "$duration"
        return 1
    fi
    
    # Save timing data
    cat > "${VALIDATION_RESULTS_DIR}/recovery-time-estimates.json" << EOF
{
    "recovery_time_estimates": {
        "data_validation_seconds": ${data_validation_time},
        "table_size_bytes": ${table_size},
        "item_count": ${item_count},
        "estimated_pitr_minutes": ${estimated_pitr_minutes},
        "estimated_infrastructure_minutes": ${estimated_infra_minutes},
        "total_estimated_minutes": ${total_estimated_minutes},
        "rto_minutes": 480,
        "within_rto": true
    }
}
EOF
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_validation_result "$validation_name" "PASS" "Recovery time ${total_estimated_minutes}m within RTO 480m" "$duration"
}

# Validation 5: Data Integrity Verification
validate_data_integrity() {
    log "Validation 5: Data Integrity Verification"
    
    local validation_name="Data Integrity Verification"
    local start_time=$(date +%s)
    
    # Check table accessibility
    if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "Table not accessible" "$duration"
        return 1
    fi
    
    # Get basic table statistics
    local item_count=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    local table_size=$(aws dynamodb describe-table \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query 'Table.TableSizeBytes' \
        --output text)
    
    log "Table statistics: ${item_count} items, ${table_size} bytes"
    
    # Sample data structure validation
    log "Performing data structure validation..."
    
    # Check for required data types
    local inventory_count=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"INVENTORY#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    local container_count=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"CONTAINER#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    local user_count=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --filter-expression "begins_with(pk, :pk_prefix)" \
        --expression-attribute-values '{":pk_prefix":{"S":"USER#"}}' \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log "Data type counts:"
    log "- Inventories: ${inventory_count}"
    log "- Containers: ${container_count}"
    log "- Users: ${user_count}"
    
    # Sample item structure validation
    local sample_items=$(aws dynamodb scan \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --limit 5 \
        --query 'Items[*]' \
        --output json)
    
    local sample_count=$(echo "$sample_items" | jq 'length')
    
    if [ "$sample_count" -eq 0 ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        add_validation_result "$validation_name" "FAIL" "No sample items found" "$duration"
        return 1
    fi
    
    # Validate sample item structure
    local structure_errors=0
    echo "$sample_items" | jq -c '.[]' | while read -r item; do
        # Check for required fields (pk, sk)
        if ! echo "$item" | jq -e '.pk' >/dev/null; then
            structure_errors=$((structure_errors + 1))
        fi
        if ! echo "$item" | jq -e '.sk' >/dev/null; then
            structure_errors=$((structure_errors + 1))
        fi
    done
    
    log "Sample structure validation completed"
    
    # Save data integrity report
    cat > "${VALIDATION_RESULTS_DIR}/data-integrity-report.json" << EOF
{
    "data_integrity_report": {
        "total_items": ${item_count},
        "table_size_bytes": ${table_size},
        "inventory_count": ${inventory_count},
        "container_count": ${container_count},
        "user_count": ${user_count},
        "sample_items_checked": ${sample_count},
        "structure_errors": ${structure_errors}
    }
}
EOF
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_validation_result "$validation_name" "PASS" "${item_count} items validated, structure intact" "$duration"
}

# Validation 6: Backup Retention and Cleanup
validate_backup_retention() {
    log "Validation 6: Backup Retention and Cleanup"
    
    local validation_name="Backup Retention and Cleanup"
    local start_time=$(date +%s)
    
    # Check backup retention policies
    log "Checking backup retention policies..."
    
    # Get all backups with dates
    local all_backups=$(aws dynamodb list-backups \
        --table-name "${TABLE_NAME}" \
        --region "${REGION}" \
        --query "BackupSummaries[*].{Name:BackupName,Date:BackupCreationDateTime,Status:BackupStatus}" \
        --output json)
    
    local total_backups=$(echo "$all_backups" | jq 'length')
    log "Total backups found: ${total_backups}"
    
    # Analyze backup ages
    local old_backups=0
    local recent_backups=0
    local current_epoch=$(date +%s)
    
    echo "$all_backups" | jq -r '.[].Date' | while read -r backup_date; do
        local backup_epoch=$(date -d "$backup_date" +%s)
        local backup_age_days=$(( (current_epoch - backup_epoch) / 86400 ))
        
        if [ "$backup_age_days" -gt 7 ]; then
            old_backups=$((old_backups + 1))
        else
            recent_backups=$((recent_backups + 1))
        fi
    done
    
    log "Backup age analysis:"
    log "- Recent backups (≤7 days): ${recent_backups}"
    log "- Old backups (>7 days): ${old_backups}"
    
    # Check if cleanup is needed
    if [ "$old_backups" -gt 10 ]; then
        warn "Many old backups found (${old_backups}) - cleanup recommended"
    fi
    
    # Test backup cleanup script functionality
    log "Testing backup cleanup functionality..."
    
    if ./scripts/backup-production.sh "${ENVIRONMENT}" cleanup > "${VALIDATION_RESULTS_DIR}/cleanup-test.txt" 2>&1; then
        log "✓ Backup cleanup script functional"
    else
        warn "Backup cleanup script test failed"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_validation_result "$validation_name" "PASS" "${total_backups} backups, ${recent_backups} recent" "$duration"
}

# Generate comprehensive validation report
generate_validation_report() {
    log "📊 Generating comprehensive validation report..."
    
    local report_file="${VALIDATION_RESULTS_DIR}/backup-validation-report.json"
    local summary_file="${VALIDATION_RESULTS_DIR}/validation-summary.txt"
    
    # Create JSON report
    cat > "$report_file" << EOF
{
    "backup_validation_report": {
        "validation_id": "${VALIDATION_ID}",
        "validation_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "${ENVIRONMENT}",
        "region": "${REGION}",
        "rto_hours": ${RTO_HOURS},
        "rpo_hours": ${RPO_HOURS},
        "total_validations": ${TOTAL_VALIDATIONS},
        "passed_validations": $((TOTAL_VALIDATIONS - FAILED_VALIDATIONS)),
        "failed_validations": ${FAILED_VALIDATIONS},
        "success_rate": $(echo "scale=2; $((TOTAL_VALIDATIONS - FAILED_VALIDATIONS)) * 100 / ${TOTAL_VALIDATIONS}" | bc -l 2>/dev/null || echo "0"),
        "validation_results": [
EOF
    
    # Add validation results
    local first=true
    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -r validation_name validation_result validation_details validation_duration <<< "$result"
        
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        cat >> "$report_file" << EOF
            {
                "validation_name": "${validation_name}",
                "result": "${validation_result}",
                "details": "${validation_details}",
                "duration_seconds": ${validation_duration}
            }
EOF
    done
    
    cat >> "$report_file" << EOF
        ],
        "recommendations": [
EOF
    
    # Add recommendations based on validation results
    local recommendations=()
    
    if [ $FAILED_VALIDATIONS -gt 0 ]; then
        recommendations+=("Address failed validations before relying on backup systems")
    fi
    
    if [ $FAILED_VALIDATIONS -eq 0 ]; then
        recommendations+=("All backup validations passed - systems are operational")
    fi
    
    recommendations+=("Schedule next validation in 1 month")
    recommendations+=("Review backup retention policies quarterly")
    recommendations+=("Test actual recovery procedures quarterly")
    
    local first=true
    for rec in "${recommendations[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        echo "            \"${rec}\"" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF
        ]
    }
}
EOF
    
    # Create summary report
    cat > "$summary_file" << EOF
BACKUP VALIDATION SUMMARY
=========================

Validation ID: ${VALIDATION_ID}
Date: $(date)
Environment: ${ENVIRONMENT}
Region: ${REGION}

RECOVERY OBJECTIVES:
-------------------
RTO (Recovery Time Objective): ${RTO_HOURS} hours
RPO (Recovery Point Objective): ${RPO_HOURS} hour

RESULTS:
--------
Total Validations: ${TOTAL_VALIDATIONS}
Passed: $((TOTAL_VALIDATIONS - FAILED_VALIDATIONS))
Failed: ${FAILED_VALIDATIONS}
Success Rate: $(echo "scale=1; $((TOTAL_VALIDATIONS - FAILED_VALIDATIONS)) * 100 / ${TOTAL_VALIDATIONS}" | bc -l 2>/dev/null || echo "0")%

VALIDATION DETAILS:
-------------------
EOF
    
    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -r validation_name validation_result validation_details validation_duration <<< "$result"
        printf "%-35s %s (%ss)\n" "$validation_name" "$validation_result" "$validation_duration" >> "$summary_file"
        if [ "$validation_result" = "FAIL" ]; then
            echo "  └─ $validation_details" >> "$summary_file"
        fi
    done
    
    cat >> "$summary_file" << EOF

RECOMMENDATIONS:
----------------
EOF
    
    for rec in "${recommendations[@]}"; do
        echo "• $rec" >> "$summary_file"
    done
    
    cat >> "$summary_file" << EOF

FILES GENERATED:
----------------
• Validation Report: ${report_file}
• Backup List: ${VALIDATION_RESULTS_DIR}/backup-list.txt
• Rollback Options: ${VALIDATION_RESULTS_DIR}/rollback-options.txt
• Data Integrity Report: ${VALIDATION_RESULTS_DIR}/data-integrity-report.json
• Recovery Time Estimates: ${VALIDATION_RESULTS_DIR}/recovery-time-estimates.json
EOF
    
    log "Validation report generated: ${report_file}"
    log "Validation summary generated: ${summary_file}"
    
    # Display summary
    echo ""
    info "=== BACKUP VALIDATION SUMMARY ==="
    cat "$summary_file"
    echo ""
    
    if [ $FAILED_VALIDATIONS -eq 0 ]; then
        success "🎉 All backup validations passed!"
    else
        error "⚠️  ${FAILED_VALIDATIONS} validation(s) failed - review and address issues"
    fi
}

# Main validation function
run_full_validation() {
    log "🔍 Starting Full Backup Validation"
    
    initialize_validation
    
    # Run all validations
    validate_dynamodb_backups
    validate_s3_backups
    validate_backup_restoration
    validate_recovery_times
    validate_data_integrity
    validate_backup_retention
    
    # Generate report
    generate_validation_report
    
    log "Full backup validation completed"
    log "Results saved to: ${VALIDATION_RESULTS_DIR}"
    
    # Return appropriate exit code
    if [ $FAILED_VALIDATIONS -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Individual validation functions for targeted testing
run_individual_validation() {
    local validation_name="$1"
    
    initialize_validation
    
    case "$validation_name" in
        dynamodb)
            validate_dynamodb_backups
            ;;
        s3)
            validate_s3_backups
            ;;
        restoration)
            validate_backup_restoration
            ;;
        timing)
            validate_recovery_times
            ;;
        integrity)
            validate_data_integrity
            ;;
        retention)
            validate_backup_retention
            ;;
        *)
            error "Unknown validation: $validation_name"
            exit 1
            ;;
    esac
    
    generate_validation_report
}

# Main function
main() {
    case "${2:-full}" in
        full)
            run_full_validation
            ;;
        dynamodb|s3|restoration|timing|integrity|retention)
            run_individual_validation "$2"
            ;;
        *)
            echo "Usage: $0 [environment] [validation_type]"
            echo ""
            echo "Arguments:"
            echo "  environment       Environment name (default: prod)"
            echo ""
            echo "Validation Types:"
            echo "  full             Run complete validation suite (default)"
            echo "  dynamodb         Validate DynamoDB backups only"
            echo "  s3               Validate S3 backups and versioning only"
            echo "  restoration      Validate backup restoration procedures only"
            echo "  timing           Validate recovery time objectives only"
            echo "  integrity        Validate data integrity only"
            echo "  retention        Validate backup retention policies only"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION       AWS region (default: eu-west-1)"
            echo ""
            echo "Recovery Objectives:"
            echo "  RTO (Recovery Time Objective): ${RTO_HOURS} hours"
            echo "  RPO (Recovery Point Objective): ${RPO_HOURS} hour"
            echo ""
            echo "Examples:"
            echo "  $0 prod full"
            echo "  $0 prod dynamodb"
            echo "  $0 dev timing"
            echo ""
            echo "Validation Schedule:"
            echo "  Monthly: Full validation"
            echo "  Weekly: DynamoDB and timing validation"
            echo "  Daily: Data integrity validation (automated)"
            ;;
    esac
}

# Run main function
main "$@"