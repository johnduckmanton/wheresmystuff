#!/bin/bash

# Compliance Monitoring Script
# Monitors compliance violations and generates alerts

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-prod}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"

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

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1"
}

# Function to check CloudTrail status
check_cloudtrail_status() {
    log "Checking CloudTrail status..."
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        local trail_name="home-inventory-audit-trail-$ENVIRONMENT"
        
        # Check if trail exists and is logging
        if aws cloudtrail describe-trails \
            --trail-name-list "$trail_name" \
            --region "$AWS_REGION" \
            --query 'trailList[0].Name' \
            --output text 2>/dev/null | grep -q "$trail_name"; then
            
            # Check if trail is logging
            local logging_status=$(aws cloudtrail get-trail-status \
                --name "$trail_name" \
                --region "$AWS_REGION" \
                --query 'IsLogging' \
                --output text 2>/dev/null || echo "false")
            
            if [[ "$logging_status" == "true" ]]; then
                success "CloudTrail is active and logging"
                return 0
            else
                error "CloudTrail exists but is not logging"
                return 1
            fi
        else
            error "CloudTrail not found for production environment"
            return 1
        fi
    else
        warning "CloudTrail not required for development environment"
        return 0
    fi
}

# Function to check log retention compliance
check_log_retention() {
    log "Checking log retention compliance..."
    
    local violations=0
    
    # Check CloudWatch log groups
    local log_groups=(
        "/aws/lambda/home-inventory-system-$ENVIRONMENT-ContainerFunction"
        "/aws/lambda/home-inventory-system-$ENVIRONMENT-UserManagementFunction"
        "/aws/lambda/home-inventory-system-$ENVIRONMENT-InventoryFunction"
    )
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        log_groups+=(
            "/aws/cloudtrail/home-inventory-$ENVIRONMENT"
            "/aws/apigateway/home-inventory-$ENVIRONMENT"
        )
    fi
    
    for log_group in "${log_groups[@]}"; do
        if aws logs describe-log-groups \
            --log-group-name-prefix "$log_group" \
            --region "$AWS_REGION" \
            --query 'logGroups[0].logGroupName' \
            --output text 2>/dev/null | grep -q "$log_group"; then
            
            local retention=$(aws logs describe-log-groups \
                --log-group-name-prefix "$log_group" \
                --region "$AWS_REGION" \
                --query 'logGroups[0].retentionInDays' \
                --output text 2>/dev/null || echo "null")
            
            if [[ "$retention" == "null" ]]; then
                warning "Log group $log_group has no retention policy (infinite retention)"
                ((violations++))
            elif [[ "$retention" -gt 90 ]]; then
                warning "Log group $log_group retention ($retention days) exceeds recommended 90 days"
                ((violations++))
            else
                success "Log group $log_group retention: $retention days ✅"
            fi
        else
            warning "Log group $log_group not found"
        fi
    done
    
    return $violations
}

# Function to check access control compliance
check_access_controls() {
    log "Checking access control compliance..."
    
    local violations=0
    
    # Check S3 bucket public access
    local buckets=(
        "home-inv-photos-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT"
        "home-inv-qr-reports-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT"
        "home-inv-frontend-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT"
    )
    
    for bucket in "${buckets[@]}"; do
        if aws s3api head-bucket --bucket "$bucket" --region "$AWS_REGION" 2>/dev/null; then
            local public_access=$(aws s3api get-public-access-block \
                --bucket "$bucket" \
                --region "$AWS_REGION" \
                --query 'PublicAccessBlockConfiguration' \
                --output json 2>/dev/null || echo '{}')
            
            local block_public_acls=$(echo "$public_access" | jq -r '.BlockPublicAcls // false')
            local block_public_policy=$(echo "$public_access" | jq -r '.BlockPublicPolicy // false')
            
            if [[ "$block_public_acls" == "true" && "$block_public_policy" == "true" ]]; then
                success "S3 bucket $bucket has proper public access controls ✅"
            else
                error "S3 bucket $bucket has inadequate public access controls"
                ((violations++))
            fi
        else
            warning "S3 bucket $bucket not found"
        fi
    done
    
    # Check DynamoDB encryption
    local table_name="home-inv-$ENVIRONMENT"
    if aws dynamodb describe-table \
        --table-name "$table_name" \
        --region "$AWS_REGION" >/dev/null 2>&1; then
        
        local encryption=$(aws dynamodb describe-table \
            --table-name "$table_name" \
            --region "$AWS_REGION" \
            --query 'Table.SSEDescription.Status' \
            --output text 2>/dev/null || echo "DISABLED")
        
        if [[ "$encryption" == "ENABLED" ]]; then
            success "DynamoDB table $table_name encryption: ENABLED ✅"
        else
            error "DynamoDB table $table_name encryption: DISABLED"
            ((violations++))
        fi
    else
        warning "DynamoDB table $table_name not found"
    fi
    
    return $violations
}

# Function to check backup compliance
check_backup_compliance() {
    log "Checking backup compliance..."
    
    local violations=0
    
    # Check DynamoDB point-in-time recovery
    local table_name="home-inv-$ENVIRONMENT"
    if aws dynamodb describe-table \
        --table-name "$table_name" \
        --region "$AWS_REGION" >/dev/null 2>&1; then
        
        local pitr_status=$(aws dynamodb describe-continuous-backups \
            --table-name "$table_name" \
            --region "$AWS_REGION" \
            --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
            --output text 2>/dev/null || echo "DISABLED")
        
        if [[ "$ENVIRONMENT" == "prod" ]]; then
            if [[ "$pitr_status" == "ENABLED" ]]; then
                success "DynamoDB PITR for production: ENABLED ✅"
            else
                error "DynamoDB PITR for production: DISABLED"
                ((violations++))
            fi
        else
            if [[ "$pitr_status" == "DISABLED" ]]; then
                success "DynamoDB PITR for development: DISABLED (cost optimization) ✅"
            else
                warning "DynamoDB PITR for development: ENABLED (unnecessary cost)"
            fi
        fi
    else
        warning "DynamoDB table $table_name not found"
    fi
    
    # Check S3 versioning for production
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        local buckets=(
            "home-inv-photos-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT"
            "home-inv-qr-reports-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT"
        )
        
        for bucket in "${buckets[@]}"; do
            if aws s3api head-bucket --bucket "$bucket" --region "$AWS_REGION" 2>/dev/null; then
                local versioning=$(aws s3api get-bucket-versioning \
                    --bucket "$bucket" \
                    --region "$AWS_REGION" \
                    --query 'Status' \
                    --output text 2>/dev/null || echo "Disabled")
                
                if [[ "$versioning" == "Enabled" ]]; then
                    success "S3 bucket $bucket versioning: ENABLED ✅"
                else
                    error "S3 bucket $bucket versioning: DISABLED"
                    ((violations++))
                fi
            else
                warning "S3 bucket $bucket not found"
            fi
        done
    fi
    
    return $violations
}

# Function to check monitoring compliance
check_monitoring_compliance() {
    log "Checking monitoring compliance..."
    
    local violations=0
    
    # Check CloudWatch alarms
    local required_alarms=(
        "home-inventory-high-error-rate-$ENVIRONMENT"
        "home-inventory-high-duration-$ENVIRONMENT"
        "home-inventory-dynamodb-throttling-$ENVIRONMENT"
        "home-inventory-api-5xx-errors-$ENVIRONMENT"
    )
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        required_alarms+=(
            "home-inventory-waf-blocked-requests-$ENVIRONMENT"
            "home-inventory-auth-failures-$ENVIRONMENT"
            "home-inventory-audit-trail-errors-$ENVIRONMENT"
        )
    fi
    
    for alarm in "${required_alarms[@]}"; do
        if aws cloudwatch describe-alarms \
            --alarm-names "$alarm" \
            --region "$AWS_REGION" \
            --query 'MetricAlarms[0].AlarmName' \
            --output text 2>/dev/null | grep -q "$alarm"; then
            
            local state=$(aws cloudwatch describe-alarms \
                --alarm-names "$alarm" \
                --region "$AWS_REGION" \
                --query 'MetricAlarms[0].StateValue' \
                --output text 2>/dev/null)
            
            success "CloudWatch alarm $alarm: $state ✅"
        else
            error "CloudWatch alarm $alarm: NOT FOUND"
            ((violations++))
        fi
    done
    
    return $violations
}

# Function to check GitHub environment protection
check_github_protection() {
    log "Checking GitHub environment protection..."
    
    # This would require GitHub API access, so we'll just document the requirement
    cat << EOF

GitHub Environment Protection Checklist:
- [ ] Production environment requires manual approval
- [ ] Required reviewers configured for production
- [ ] Deployment branches restricted to main/master
- [ ] Environment secrets properly configured
- [ ] Deployment logs retained for audit

Note: GitHub environment protection must be verified manually in GitHub settings.
EOF
    
    return 0
}

# Function to generate compliance report
generate_compliance_report() {
    local total_violations=$1
    local report_file="compliance-report-$ENVIRONMENT-$(date +%Y%m%d_%H%M%S).md"
    
    log "Generating compliance report: $report_file"
    
    cat > "$report_file" << EOF
# Compliance Monitoring Report

**Environment:** $ENVIRONMENT  
**Generated:** $(date)  
**Total Violations:** $total_violations

## Executive Summary

$(if [[ $total_violations -eq 0 ]]; then
    echo "✅ **COMPLIANT** - No compliance violations detected"
else
    echo "❌ **NON-COMPLIANT** - $total_violations violation(s) detected"
fi)

## Compliance Checks

### 1. Audit Logging
$(check_cloudtrail_status >/dev/null 2>&1 && echo "✅ CloudTrail logging active" || echo "❌ CloudTrail logging issues")

### 2. Log Retention
$(check_log_retention >/dev/null 2>&1 && echo "✅ Log retention compliant" || echo "❌ Log retention violations")

### 3. Access Controls
$(check_access_controls >/dev/null 2>&1 && echo "✅ Access controls compliant" || echo "❌ Access control violations")

### 4. Backup Compliance
$(check_backup_compliance >/dev/null 2>&1 && echo "✅ Backup compliance met" || echo "❌ Backup compliance violations")

### 5. Monitoring
$(check_monitoring_compliance >/dev/null 2>&1 && echo "✅ Monitoring compliant" || echo "❌ Monitoring violations")

## Recommendations

$(if [[ $total_violations -gt 0 ]]; then
    echo "1. **Immediate Action Required:** Address the $total_violations violation(s) identified above"
    echo "2. **Review Process:** Investigate root cause of compliance violations"
    echo "3. **Preventive Measures:** Implement automated compliance checking"
else
    echo "1. **Maintain Status:** Continue current compliance practices"
    echo "2. **Regular Reviews:** Schedule monthly compliance checks"
    echo "3. **Documentation:** Keep compliance documentation updated"
fi)

## Next Steps

1. Review detailed findings in the full compliance check output
2. Create remediation plan for any violations
3. Schedule follow-up compliance check
4. Update compliance documentation as needed

---
*This report was generated automatically by the compliance monitoring system.*
EOF

    success "Compliance report generated: $report_file"
    
    # Send alert if violations found
    if [[ $total_violations -gt 0 ]]; then
        send_compliance_alert "$total_violations" "$report_file"
    fi
}

# Function to send compliance alert
send_compliance_alert() {
    local violations=$1
    local report_file=$2
    
    log "Sending compliance alert for $violations violation(s)..."
    
    # Try to send via SNS if topic exists
    local topic_arn="arn:aws:sns:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):home-inventory-security-alerts-$ENVIRONMENT"
    
    if aws sns get-topic-attributes --topic-arn "$topic_arn" --region "$AWS_REGION" >/dev/null 2>&1; then
        local message="COMPLIANCE ALERT: $violations violation(s) detected in $ENVIRONMENT environment. See report: $report_file"
        
        aws sns publish \
            --topic-arn "$topic_arn" \
            --subject "Home Inventory Compliance Alert - $ENVIRONMENT" \
            --message "$message" \
            --region "$AWS_REGION" >/dev/null 2>&1 && \
            success "Compliance alert sent via SNS" || \
            warning "Failed to send SNS alert"
    else
        warning "SNS topic not found, alert not sent"
    fi
}

# Main execution
main() {
    log "=== Home Inventory Compliance Monitoring ==="
    log "Environment: $ENVIRONMENT"
    log "Region: $AWS_REGION"
    echo
    
    local total_violations=0
    
    # Run compliance checks
    check_cloudtrail_status || ((total_violations++))
    echo
    
    check_log_retention
    local log_violations=$?
    ((total_violations += log_violations))
    echo
    
    check_access_controls
    local access_violations=$?
    ((total_violations += access_violations))
    echo
    
    check_backup_compliance
    local backup_violations=$?
    ((total_violations += backup_violations))
    echo
    
    check_monitoring_compliance
    local monitoring_violations=$?
    ((total_violations += monitoring_violations))
    echo
    
    check_github_protection
    echo
    
    # Generate report
    generate_compliance_report "$total_violations"
    
    # Summary
    echo
    if [[ $total_violations -eq 0 ]]; then
        success "Compliance check completed: NO VIOLATIONS FOUND ✅"
    else
        error "Compliance check completed: $total_violations VIOLATION(S) FOUND ❌"
    fi
    
    return $total_violations
}

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <environment>"
    echo
    echo "Arguments:"
    echo "  environment  - Environment to check (prod or dev)"
    echo
    echo "Environment Variables:"
    echo "  AWS_REGION   - AWS region (default: eu-west-1)"
    echo "  ALERT_EMAIL  - Email for alerts (default: admin@example.com)"
    echo
    echo "Examples:"
    echo "  $0 prod"
    echo "  AWS_REGION=us-east-1 $0 dev"
    echo
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "prod" && "$ENVIRONMENT" != "dev" ]]; then
    error "Environment must be 'prod' or 'dev'"
    exit 1
fi

# Check dependencies
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    error "jq not found. Please install jq for JSON processing."
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    error "AWS credentials not configured or invalid."
    exit 1
fi

# Run main function
main "$@"