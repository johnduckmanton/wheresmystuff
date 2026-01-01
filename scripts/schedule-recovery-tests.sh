#!/bin/bash

# Schedule Recovery Tests Script
# Automates the testing schedule for disaster recovery procedures
# Can be used with cron or manual execution

set -e

# Configuration
ENVIRONMENT=${1:-prod}
TEST_TYPE=${2:-daily}
REGION=${AWS_REGION:-eu-west-1}

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

# Daily tests (automated)
run_daily_tests() {
    log "🔄 Running daily recovery tests..."
    
    # Data integrity validation
    log "Running data integrity validation..."
    if ./scripts/backup-validation.sh "${ENVIRONMENT}" integrity; then
        success "Daily data integrity validation passed"
    else
        error "Daily data integrity validation failed"
        return 1
    fi
    
    # Basic backup system check
    log "Running basic backup system check..."
    if ./scripts/backup-production.sh "${ENVIRONMENT}" list > /dev/null 2>&1; then
        success "Backup system operational"
    else
        error "Backup system check failed"
        return 1
    fi
    
    success "Daily tests completed successfully"
}

# Weekly tests
run_weekly_tests() {
    log "🔄 Running weekly recovery tests..."
    
    # Backup system functionality
    log "Testing backup system functionality..."
    if ./scripts/disaster-recovery-testing.sh "${ENVIRONMENT}" backup; then
        success "Weekly backup system test passed"
    else
        error "Weekly backup system test failed"
        return 1
    fi
    
    # PITR capability test
    log "Testing PITR capability..."
    if ./scripts/disaster-recovery-testing.sh "${ENVIRONMENT}" pitr; then
        success "Weekly PITR test passed"
    else
        error "Weekly PITR test failed"
        return 1
    fi
    
    # Recovery time validation
    log "Testing recovery time objectives..."
    if ./scripts/backup-validation.sh "${ENVIRONMENT}" timing; then
        success "Weekly timing validation passed"
    else
        error "Weekly timing validation failed"
        return 1
    fi
    
    success "Weekly tests completed successfully"
}

# Monthly tests
run_monthly_tests() {
    log "🔄 Running monthly recovery tests..."
    
    # Full backup validation
    log "Running full backup validation suite..."
    if ./scripts/backup-validation.sh "${ENVIRONMENT}" full; then
        success "Monthly backup validation passed"
    else
        error "Monthly backup validation failed"
        return 1
    fi
    
    # Infrastructure recovery test
    log "Testing infrastructure recovery procedures..."
    if ./scripts/disaster-recovery-testing.sh "${ENVIRONMENT}" infrastructure; then
        success "Monthly infrastructure test passed"
    else
        error "Monthly infrastructure test failed"
        return 1
    fi
    
    # Documentation validation
    log "Validating documentation and procedures..."
    if ./scripts/disaster-recovery-testing.sh "${ENVIRONMENT}" documentation; then
        success "Monthly documentation validation passed"
    else
        error "Monthly documentation validation failed"
        return 1
    fi
    
    success "Monthly tests completed successfully"
}

# Quarterly tests
run_quarterly_tests() {
    log "🔄 Running quarterly disaster recovery drill..."
    
    # Full disaster recovery test
    log "Running complete disaster recovery test suite..."
    if ./scripts/disaster-recovery-testing.sh "${ENVIRONMENT}" quarterly; then
        success "Quarterly disaster recovery drill passed"
    else
        error "Quarterly disaster recovery drill failed"
        return 1
    fi
    
    # Generate comprehensive report
    log "Generating quarterly report..."
    REPORT_DATE=$(date +%Y-%m-%d)
    REPORT_DIR="/tmp/quarterly-dr-report-${REPORT_DATE}"
    mkdir -p "${REPORT_DIR}"
    
    # Copy all test results
    find /tmp -name "dr-test-*" -type d -mtime -1 -exec cp -r {} "${REPORT_DIR}/" \; 2>/dev/null || true
    find /tmp -name "backup-validation-*" -type d -mtime -1 -exec cp -r {} "${REPORT_DIR}/" \; 2>/dev/null || true
    
    # Create summary report
    cat > "${REPORT_DIR}/quarterly-summary.md" << EOF
# Quarterly Disaster Recovery Report

**Date**: ${REPORT_DATE}
**Environment**: ${ENVIRONMENT}
**Region**: ${REGION}

## Test Results

### Disaster Recovery Test
- Status: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")
- Date: ${REPORT_DATE}
- Duration: [See detailed reports]

### Backup Validation
- Status: [See backup validation reports]
- Coverage: Full system validation

## Recommendations

1. Review and update emergency contacts
2. Verify backup retention policies
3. Update disaster recovery runbooks
4. Schedule next quarterly test in 3 months

## Next Actions

- [ ] Address any failed tests
- [ ] Update documentation based on findings
- [ ] Schedule team training if needed
- [ ] Plan next quarterly drill

---
Generated by: schedule-recovery-tests.sh
EOF
    
    log "Quarterly report generated: ${REPORT_DIR}/quarterly-summary.md"
    success "Quarterly tests completed successfully"
}

# Check if it's time for specific tests based on date
check_scheduled_tests() {
    local current_date=$(date +%Y-%m-%d)
    local day_of_month=$(date +%d)
    local day_of_week=$(date +%u)  # 1=Monday, 7=Sunday
    
    log "Checking scheduled tests for ${current_date}"
    
    # Quarterly test (1st of January, April, July, October)
    if [[ $(date +%m-%d) =~ ^(01-01|04-01|07-01|10-01)$ ]]; then
        log "Quarterly test scheduled for today"
        run_quarterly_tests
        return $?
    fi
    
    # Monthly test (1st of each month, except quarterly months)
    if [[ "$day_of_month" == "01" ]] && ! [[ $(date +%m-%d) =~ ^(01-01|04-01|07-01|10-01)$ ]]; then
        log "Monthly test scheduled for today"
        run_monthly_tests
        return $?
    fi
    
    # Weekly test (every Monday, except 1st of month)
    if [[ "$day_of_week" == "1" ]] && [[ "$day_of_month" != "01" ]]; then
        log "Weekly test scheduled for today"
        run_weekly_tests
        return $?
    fi
    
    # Daily test (every day, except when other tests run)
    if [[ "$day_of_week" != "1" ]] && [[ "$day_of_month" != "01" ]]; then
        log "Daily test scheduled for today"
        run_daily_tests
        return $?
    fi
    
    log "No scheduled tests for today"
    return 0
}

# Generate cron configuration
generate_cron_config() {
    log "Generating cron configuration..."
    
    cat << EOF
# Disaster Recovery Testing Schedule
# Add these lines to your crontab (crontab -e)

# Daily tests at 2 AM (except Mondays and 1st of month)
0 2 * * 2-7 [ \$(date +\%d) != "01" ] && /path/to/scripts/schedule-recovery-tests.sh ${ENVIRONMENT} daily

# Weekly tests at 3 AM on Mondays (except 1st of month)
0 3 * * 1 [ \$(date +\%d) != "01" ] && /path/to/scripts/schedule-recovery-tests.sh ${ENVIRONMENT} weekly

# Monthly tests at 4 AM on 1st of month (except quarterly months)
0 4 1 * * ! echo "01-01 04-01 07-01 10-01" | grep -q \$(date +\%m-\%d) && /path/to/scripts/schedule-recovery-tests.sh ${ENVIRONMENT} monthly

# Quarterly tests at 5 AM on 1st of Jan, Apr, Jul, Oct
0 5 1 1,4,7,10 * /path/to/scripts/schedule-recovery-tests.sh ${ENVIRONMENT} quarterly

# Alternative: Run scheduled check daily and let script decide
# 0 2 * * * /path/to/scripts/schedule-recovery-tests.sh ${ENVIRONMENT} scheduled

EOF
    
    log "Cron configuration generated above"
    log "To install: crontab -e and add the appropriate lines"
}

# Send notification (placeholder for integration with notification systems)
send_notification() {
    local test_type="$1"
    local status="$2"
    local details="$3"
    
    log "Notification: ${test_type} test ${status}"
    
    # Placeholder for email/Slack/SNS notification
    # Example integrations:
    
    # Email notification
    # echo "Subject: DR Test ${status}: ${test_type}" | \
    #   echo -e "Test: ${test_type}\nStatus: ${status}\nDetails: ${details}" | \
    #   sendmail admin@example.com
    
    # Slack notification
    # curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"DR Test '"${status}"': '"${test_type}"'"}' \
    #   YOUR_SLACK_WEBHOOK_URL
    
    # SNS notification
    # aws sns publish \
    #   --topic-arn "arn:aws:sns:region:account:topic" \
    #   --message "DR Test ${status}: ${test_type} - ${details}"
    
    log "Notification sent (placeholder implementation)"
}

# Main function
main() {
    case "${TEST_TYPE}" in
        daily)
            if run_daily_tests; then
                send_notification "Daily" "PASSED" "All daily tests completed successfully"
            else
                send_notification "Daily" "FAILED" "One or more daily tests failed"
                exit 1
            fi
            ;;
        weekly)
            if run_weekly_tests; then
                send_notification "Weekly" "PASSED" "All weekly tests completed successfully"
            else
                send_notification "Weekly" "FAILED" "One or more weekly tests failed"
                exit 1
            fi
            ;;
        monthly)
            if run_monthly_tests; then
                send_notification "Monthly" "PASSED" "All monthly tests completed successfully"
            else
                send_notification "Monthly" "FAILED" "One or more monthly tests failed"
                exit 1
            fi
            ;;
        quarterly)
            if run_quarterly_tests; then
                send_notification "Quarterly" "PASSED" "Quarterly disaster recovery drill completed successfully"
            else
                send_notification "Quarterly" "FAILED" "Quarterly disaster recovery drill failed"
                exit 1
            fi
            ;;
        scheduled)
            check_scheduled_tests
            ;;
        cron)
            generate_cron_config
            ;;
        *)
            echo "Usage: $0 [environment] [test_type]"
            echo ""
            echo "Arguments:"
            echo "  environment    Environment name (default: prod)"
            echo ""
            echo "Test Types:"
            echo "  daily         Run daily tests (data integrity, basic checks)"
            echo "  weekly        Run weekly tests (backup system, PITR, timing)"
            echo "  monthly       Run monthly tests (full validation, infrastructure)"
            echo "  quarterly     Run quarterly tests (complete DR drill)"
            echo "  scheduled     Check date and run appropriate scheduled test"
            echo "  cron          Generate cron configuration"
            echo ""
            echo "Environment Variables:"
            echo "  AWS_REGION    AWS region (default: eu-west-1)"
            echo ""
            echo "Testing Schedule:"
            echo "  Daily:        Data integrity validation"
            echo "  Weekly:       Backup and PITR functionality tests"
            echo "  Monthly:      Full backup validation and infrastructure tests"
            echo "  Quarterly:    Complete disaster recovery drill"
            echo ""
            echo "Examples:"
            echo "  $0 prod daily"
            echo "  $0 prod scheduled"
            echo "  $0 prod cron"
            echo ""
            echo "Automation:"
            echo "  Use 'scheduled' with cron for automatic test execution"
            echo "  Use 'cron' to generate crontab configuration"
            ;;
    esac
}

# Run main function
main "$@"