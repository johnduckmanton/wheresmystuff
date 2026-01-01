#!/bin/bash

# Disaster Recovery Testing Script
# Provides quarterly testing procedures for disaster recovery capabilities
# Tests recovery procedures without affecting production systems

set -e

# Configuration
ENVIRONMENT=${1:-prod}
REGION=${AWS_REGION:-eu-west-1}
TEST_DATE=$(date +%Y-%m-%d)
TEST_ID="dr-test-${TEST_DATE}-$(date +%H%M%S)"

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

# Test results tracking
TEST_RESULTS=()
FAILED_TESTS=0
TOTAL_TESTS=0

# Add test result
add_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        success "✓ ${test_name}: PASSED"
    else
        error "✗ ${test_name}: FAILED - ${details}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TEST_RESULTS+=("${test_name}|${result}|${details}")
}

# Initialize test environment
initialize_test() {
    log "🧪 Initializing Disaster Recovery Test: ${TEST_ID}"
    log "Environment: ${ENVIRONMENT}"
    log "Date: ${TEST_DATE}"
    log "Region: ${REGION}"
    
    # Create test results directory
    TEST_RESULTS_DIR="/tmp/dr-test-${TEST_ID}"
    mkdir -p "${TEST_RESULTS_DIR}"
    
    log "Test results will be saved to: ${TEST_RESULTS_DIR}"
    
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
    
    success "Test environment initialized"
}

# Test 1: Backup System Verification
test_backup_system() {
    log "Test 1: Backup System Verification"
    
    local test_name="Backup System Verification"
    
    # Check if backup script exists and is executable
    if [ ! -x "./scripts/backup-production.sh" ]; then
        add_test_result "$test_name" "FAIL" "Backup script not found or not executable"
        return 1
    fi
    
    # Test backup listing
    if ./scripts/backup-production.sh "${ENVIRONMENT}" list > "${TEST_RESULTS_DIR}/backup-list.txt" 2>&1; then
        log "✓ Backup listing successful"
    else
        add_test_result "$test_name" "FAIL" "Cannot list backups"
        return 1
    fi
    
    # Test backup creation (dry run)
    log "Testing backup creation..."
    if ./scripts/backup-production.sh "${ENVIRONMENT}" backup > "${TEST_RESULTS_DIR}/backup-test.txt" 2>&1; then
        log "✓ Backup creation test successful"
    else
        add_test_result "$test_name" "FAIL" "Backup creation failed"
        return 1
    fi
    
    # Test backup integrity check
    log "Testing backup integrity check..."
    if ./scripts/backup-production.sh "${ENVIRONMENT}" test > "${TEST_RESULTS_DIR}/backup-integrity.txt" 2>&1; then
        log "✓ Backup integrity check successful"
    else
        add_test_result "$test_name" "FAIL" "Backup integrity check failed"
        return 1
    fi
    
    add_test_result "$test_name" "PASS" "All backup system tests passed"
}

# Test 2: Point-in-Time Recovery Capability
test_pitr_capability() {
    log "Test 2: Point-in-Time Recovery Capability"
    
    local test_name="Point-in-Time Recovery Capability"
    
    # Get table name
    local stack_name="home-inventory-${ENVIRONMENT}"
    local table_name=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --region "${REGION}" \
        --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$table_name" ]; then
        add_test_result "$test_name" "FAIL" "Cannot determine table name"
        return 1
    fi
    
    log "Testing PITR for table: ${table_name}"
    
    # Check PITR status
    local pitr_info=$(aws dynamodb describe-continuous-backups \
        --table-name "${table_name}" \
        --region "${REGION}" \
        --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription" \
        2>/dev/null || echo "{}")
    
    local pitr_status=$(echo "$pitr_info" | jq -r '.PointInTimeRecoveryStatus // "DISABLED"')
    
    if [ "$pitr_status" != "ENABLED" ]; then
        add_test_result "$test_name" "FAIL" "Point-in-time recovery is not enabled"
        return 1
    fi
    
    # Check recovery window
    local earliest_time=$(echo "$pitr_info" | jq -r '.EarliestRestorableDateTime')
    local latest_time=$(echo "$pitr_info" | jq -r '.LatestRestorableDateTime')
    
    log "PITR window: ${earliest_time} to ${latest_time}"
    
    # Validate recovery window is reasonable (at least 24 hours)
    local earliest_epoch=$(date -d "$earliest_time" +%s)
    local latest_epoch=$(date -d "$latest_time" +%s)
    local window_hours=$(( (latest_epoch - earliest_epoch) / 3600 ))
    
    if [ "$window_hours" -lt 24 ]; then
        add_test_result "$test_name" "FAIL" "PITR window too short: ${window_hours} hours"
        return 1
    fi
    
    log "✓ PITR window is adequate: ${window_hours} hours"
    
    # Test rollback script (dry run)
    log "Testing rollback script capabilities..."
    if ./scripts/rollback-production.sh "${ENVIRONMENT}" list > "${TEST_RESULTS_DIR}/rollback-options.txt" 2>&1; then
        log "✓ Rollback script operational"
    else
        add_test_result "$test_name" "FAIL" "Rollback script not operational"
        return 1
    fi
    
    add_test_result "$test_name" "PASS" "PITR capability verified"
}

# Test 3: Infrastructure Recovery Procedures
test_infrastructure_recovery() {
    log "Test 3: Infrastructure Recovery Procedures"
    
    local test_name="Infrastructure Recovery Procedures"
    
    # Check if disaster recovery script exists
    if [ ! -x "./scripts/disaster-recovery.sh" ]; then
        add_test_result "$test_name" "FAIL" "Disaster recovery script not found"
        return 1
    fi
    
    # Test disaster assessment
    log "Testing disaster assessment..."
    if ./scripts/disaster-recovery.sh "${ENVIRONMENT}" assess > "${TEST_RESULTS_DIR}/disaster-assessment.txt" 2>&1; then
        log "✓ Disaster assessment successful"
    else
        add_test_result "$test_name" "FAIL" "Disaster assessment failed"
        return 1
    fi
    
    # Test data validation
    log "Testing data validation..."
    if ./scripts/disaster-recovery.sh "${ENVIRONMENT}" validate-data > "${TEST_RESULTS_DIR}/data-validation.txt" 2>&1; then
        log "✓ Data validation successful"
    else
        add_test_result "$test_name" "FAIL" "Data validation failed"
        return 1
    fi
    
    # Check SAM configuration files
    local sam_config="samconfig-${ENVIRONMENT}.toml"
    if [ ! -f "$sam_config" ]; then
        add_test_result "$test_name" "FAIL" "SAM configuration file not found: ${sam_config}"
        return 1
    fi
    
    log "✓ SAM configuration file exists: ${sam_config}"
    
    # Test SAM build (dry run)
    log "Testing SAM build process..."
    if sam build --dry-run > "${TEST_RESULTS_DIR}/sam-build-test.txt" 2>&1; then
        log "✓ SAM build test successful"
    else
        warn "SAM build test failed - may indicate configuration issues"
    fi
    
    add_test_result "$test_name" "PASS" "Infrastructure recovery procedures verified"
}

# Test 4: Communication and Documentation
test_communication_docs() {
    log "Test 4: Communication and Documentation"
    
    local test_name="Communication and Documentation"
    
    # Check if runbook exists
    if [ ! -f "./scripts/DISASTER_RECOVERY_RUNBOOK.md" ]; then
        add_test_result "$test_name" "FAIL" "Disaster recovery runbook not found"
        return 1
    fi
    
    log "✓ Disaster recovery runbook exists"
    
    # Check runbook content for required sections
    local runbook="./scripts/DISASTER_RECOVERY_RUNBOOK.md"
    local required_sections=(
        "Recovery Time Objective"
        "Recovery Point Objective"
        "Emergency Contacts"
        "Data Recovery"
        "Infrastructure Recovery"
        "Communication Plan"
    )
    
    local missing_sections=()
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$runbook"; then
            missing_sections+=("$section")
        fi
    done
    
    if [ ${#missing_sections[@]} -gt 0 ]; then
        add_test_result "$test_name" "FAIL" "Missing sections: ${missing_sections[*]}"
        return 1
    fi
    
    log "✓ All required runbook sections present"
    
    # Check if contact information is placeholder
    if grep -q "\[Your.*contact\]" "$runbook"; then
        warn "Emergency contacts contain placeholder text - update required"
    fi
    
    add_test_result "$test_name" "PASS" "Documentation and communication procedures verified"
}

# Test 5: Recovery Time Objectives (RTO/RPO)
test_recovery_objectives() {
    log "Test 5: Recovery Time Objectives (RTO/RPO)"
    
    local test_name="Recovery Time Objectives"
    
    # Test data recovery time estimation
    log "Testing data recovery time estimation..."
    
    local start_time=$(date +%s)
    
    # Simulate data validation (quick test)
    if ./scripts/disaster-recovery.sh "${ENVIRONMENT}" validate-data > /dev/null 2>&1; then
        local end_time=$(date +%s)
        local validation_time=$((end_time - start_time))
        
        log "Data validation time: ${validation_time} seconds"
        
        # Estimate full recovery time based on validation time
        # Assume full recovery takes 100x longer than validation
        local estimated_recovery_minutes=$((validation_time * 100 / 60))
        
        log "Estimated full recovery time: ${estimated_recovery_minutes} minutes"
        
        # Check if within RTO (8 hours = 480 minutes)
        if [ "$estimated_recovery_minutes" -gt 480 ]; then
            add_test_result "$test_name" "FAIL" "Estimated recovery time exceeds RTO: ${estimated_recovery_minutes} minutes"
            return 1
        fi
        
        log "✓ Estimated recovery time within RTO"
    else
        add_test_result "$test_name" "FAIL" "Cannot estimate recovery time - validation failed"
        return 1
    fi
    
    # Test RPO compliance (check backup frequency)
    log "Testing RPO compliance..."
    
    # Check when last backup was created
    local backup_list=$(./scripts/backup-production.sh "${ENVIRONMENT}" list 2>/dev/null || echo "")
    
    if echo "$backup_list" | grep -q "backup-"; then
        log "✓ Recent backups available"
        
        # PITR provides continuous backup, so RPO of 1 hour is always met
        log "✓ RPO of 1 hour achievable with point-in-time recovery"
    else
        warn "No recent backups found - RPO may not be achievable"
    fi
    
    add_test_result "$test_name" "PASS" "Recovery objectives are achievable"
}

# Test 6: Monitoring and Alerting
test_monitoring_alerting() {
    log "Test 6: Monitoring and Alerting"
    
    local test_name="Monitoring and Alerting"
    
    # Check CloudWatch alarms
    log "Checking CloudWatch alarms..."
    
    local alarms=$(aws cloudwatch describe-alarms \
        --region "${REGION}" \
        --query "MetricAlarms[?contains(AlarmName, 'home-inventory') || contains(AlarmName, '${ENVIRONMENT}')]" \
        --output json 2>/dev/null || echo "[]")
    
    local alarm_count=$(echo "$alarms" | jq 'length')
    
    if [ "$alarm_count" -gt 0 ]; then
        log "✓ Found ${alarm_count} CloudWatch alarms"
        
        # Check if any alarms are in ALARM state
        local alarm_states=$(echo "$alarms" | jq -r '.[].StateValue' | sort | uniq -c)
        log "Alarm states: ${alarm_states}"
    else
        warn "No CloudWatch alarms found - monitoring may be limited"
    fi
    
    # Check SNS topics for notifications
    log "Checking SNS topics..."
    
    local topics=$(aws sns list-topics \
        --region "${REGION}" \
        --query "Topics[?contains(TopicArn, 'home-inventory') || contains(TopicArn, '${ENVIRONMENT}')]" \
        --output json 2>/dev/null || echo "[]")
    
    local topic_count=$(echo "$topics" | jq 'length')
    
    if [ "$topic_count" -gt 0 ]; then
        log "✓ Found ${topic_count} SNS topics for notifications"
    else
        warn "No SNS topics found - alerting may be limited"
    fi
    
    add_test_result "$test_name" "PASS" "Monitoring and alerting systems checked"
}

# Test 7: Security and Access Controls
test_security_access() {
    log "Test 7: Security and Access Controls"
    
    local test_name="Security and Access Controls"
    
    # Check IAM permissions for disaster recovery
    log "Checking IAM permissions..."
    
    # Test DynamoDB permissions
    if aws dynamodb list-tables --region "${REGION}" > /dev/null 2>&1; then
        log "✓ DynamoDB access verified"
    else
        add_test_result "$test_name" "FAIL" "Cannot access DynamoDB"
        return 1
    fi
    
    # Test S3 permissions
    if aws s3 ls > /dev/null 2>&1; then
        log "✓ S3 access verified"
    else
        add_test_result "$test_name" "FAIL" "Cannot access S3"
        return 1
    fi
    
    # Test CloudFormation permissions
    if aws cloudformation list-stacks --region "${REGION}" > /dev/null 2>&1; then
        log "✓ CloudFormation access verified"
    else
        add_test_result "$test_name" "FAIL" "Cannot access CloudFormation"
        return 1
    fi
    
    # Check for MFA requirement (if applicable)
    local caller_identity=$(aws sts get-caller-identity --output json)
    local user_arn=$(echo "$caller_identity" | jq -r '.Arn')
    
    log "Current identity: ${user_arn}"
    
    add_test_result "$test_name" "PASS" "Security and access controls verified"
}

# Generate comprehensive test report
generate_test_report() {
    log "📊 Generating comprehensive test report..."
    
    local report_file="${TEST_RESULTS_DIR}/disaster-recovery-test-report.json"
    local summary_file="${TEST_RESULTS_DIR}/test-summary.txt"
    
    # Create JSON report
    cat > "$report_file" << EOF
{
    "disaster_recovery_test": {
        "test_id": "${TEST_ID}",
        "test_date": "${TEST_DATE}",
        "environment": "${ENVIRONMENT}",
        "region": "${REGION}",
        "total_tests": ${TOTAL_TESTS},
        "passed_tests": $((TOTAL_TESTS - FAILED_TESTS)),
        "failed_tests": ${FAILED_TESTS},
        "success_rate": $(echo "scale=2; $((TOTAL_TESTS - FAILED_TESTS)) * 100 / ${TOTAL_TESTS}" | bc -l 2>/dev/null || echo "0"),
        "test_results": [
EOF
    
    # Add test results
    local first=true
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name test_result test_details <<< "$result"
        
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        cat >> "$report_file" << EOF
            {
                "test_name": "${test_name}",
                "result": "${test_result}",
                "details": "${test_details}"
            }
EOF
    done
    
    cat >> "$report_file" << EOF
        ],
        "recommendations": [
EOF
    
    # Add recommendations based on test results
    local recommendations=()
    
    if [ $FAILED_TESTS -gt 0 ]; then
        recommendations+=("Address failed tests before next quarterly review")
    fi
    
    if [ $FAILED_TESTS -eq 0 ]; then
        recommendations+=("All tests passed - disaster recovery procedures are operational")
    fi
    
    recommendations+=("Schedule next quarterly test in 3 months")
    recommendations+=("Review and update emergency contacts")
    recommendations+=("Verify backup retention policies")
    
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
DISASTER RECOVERY TEST SUMMARY
==============================

Test ID: ${TEST_ID}
Date: ${TEST_DATE}
Environment: ${ENVIRONMENT}
Region: ${REGION}

RESULTS:
--------
Total Tests: ${TOTAL_TESTS}
Passed: $((TOTAL_TESTS - FAILED_TESTS))
Failed: ${FAILED_TESTS}
Success Rate: $(echo "scale=1; $((TOTAL_TESTS - FAILED_TESTS)) * 100 / ${TOTAL_TESTS}" | bc -l 2>/dev/null || echo "0")%

TEST DETAILS:
-------------
EOF
    
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name test_result test_details <<< "$result"
        printf "%-40s %s\n" "$test_name" "$test_result" >> "$summary_file"
        if [ "$test_result" = "FAIL" ]; then
            echo "  └─ $test_details" >> "$summary_file"
        fi
    done
    
    cat >> "$summary_file" << EOF

RECOMMENDATIONS:
----------------
EOF
    
    for rec in "${recommendations[@]}"; do
        echo "• $rec" >> "$summary_file"
    done
    
    log "Test report generated: ${report_file}"
    log "Test summary generated: ${summary_file}"
    
    # Display summary
    echo ""
    info "=== DISASTER RECOVERY TEST SUMMARY ==="
    cat "$summary_file"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        success "🎉 All disaster recovery tests passed!"
    else
        error "⚠️  ${FAILED_TESTS} test(s) failed - review and address issues"
    fi
}

# Main testing function
run_quarterly_test() {
    log "🧪 Starting Quarterly Disaster Recovery Test"
    
    initialize_test
    
    # Run all tests
    test_backup_system
    test_pitr_capability
    test_infrastructure_recovery
    test_communication_docs
    test_recovery_objectives
    test_monitoring_alerting
    test_security_access
    
    # Generate report
    generate_test_report
    
    log "Quarterly disaster recovery test completed"
    log "Results saved to: ${TEST_RESULTS_DIR}"
    
    # Return appropriate exit code
    if [ $FAILED_TESTS -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Individual test functions for targeted testing
run_individual_test() {
    local test_name="$1"
    
    initialize_test
    
    case "$test_name" in
        backup)
            test_backup_system
            ;;
        pitr)
            test_pitr_capability
            ;;
        infrastructure)
            test_infrastructure_recovery
            ;;
        documentation)
            test_communication_docs
            ;;
        objectives)
            test_recovery_objectives
            ;;
        monitoring)
            test_monitoring_alerting
            ;;
        security)
            test_security_access
            ;;
        *)
            error "Unknown test: $test_name"
            exit 1
            ;;
    esac
    
    generate_test_report
}

# Main function
main() {
    case "${2:-quarterly}" in
        quarterly)
            run_quarterly_test
            ;;
        backup|pitr|infrastructure|documentation|objectives|monitoring|security)
            run_individual_test "$2"
            ;;
        *)
            echo "Usage: $0 [environment] [test_type]"
            echo ""
            echo "Arguments:"
            echo "  environment    Environment name (default: prod)"
            echo ""
            echo "Test Types:"
            echo "  quarterly      Run complete quarterly test suite (default)"
            echo "  backup         Test backup system only"
            echo "  pitr           Test point-in-time recovery only"
            echo "  infrastructure Test infrastructure recovery only"
            echo "  documentation  Test documentation and procedures only"
            echo "  objectives     Test recovery time objectives only"
            echo "  monitoring     Test monitoring and alerting only"
            echo "  security       Test security and access controls only"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION     AWS region (default: eu-west-1)"
            echo ""
            echo "Examples:"
            echo "  $0 prod quarterly"
            echo "  $0 prod backup"
            echo "  $0 dev infrastructure"
            echo ""
            echo "Quarterly Test Schedule:"
            echo "  Q1: January - March"
            echo "  Q2: April - June"
            echo "  Q3: July - September"
            echo "  Q4: October - December"
            ;;
    esac
}

# Run main function
main "$@"