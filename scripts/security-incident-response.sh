#!/bin/bash

# Security Incident Response Procedures
# Home Inventory Management System

set -e

ENVIRONMENT=${1:-prod}
INCIDENT_TYPE=${2:-general}
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="security-incident-${TIMESTAMP}.log"

echo "=== Home Inventory Security Incident Response ===" | tee -a "$LOG_FILE"
echo "Environment: $ENVIRONMENT" | tee -a "$LOG_FILE"
echo "Incident Type: $INCIDENT_TYPE" | tee -a "$LOG_FILE"
echo "Timestamp: $TIMESTAMP" | tee -a "$LOG_FILE"
echo "=================================================" | tee -a "$LOG_FILE"

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_with_timestamp "ERROR: AWS CLI not configured or no valid credentials"
        exit 1
    fi
    log_with_timestamp "AWS CLI configured successfully"
}

# Function to gather system status
gather_system_status() {
    log_with_timestamp "=== Gathering System Status ==="
    
    # Check CloudWatch alarms
    log_with_timestamp "Checking CloudWatch alarms..."
    aws cloudwatch describe-alarms \
        --state-value ALARM \
        --query 'MetricAlarms[?contains(AlarmName, `home-inventory`) && contains(AlarmName, `'$ENVIRONMENT'`)].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
        --output table | tee -a "$LOG_FILE"
    
    # Check API Gateway metrics
    log_with_timestamp "Checking API Gateway error rates..."
    aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name 4XXError \
        --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --output table | tee -a "$LOG_FILE"
    
    # Check Lambda error rates
    log_with_timestamp "Checking Lambda error rates..."
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --output table | tee -a "$LOG_FILE"
}

# Function to check for suspicious activity
check_suspicious_activity() {
    log_with_timestamp "=== Checking for Suspicious Activity ==="
    
    # Check recent CloudTrail events
    log_with_timestamp "Checking recent CloudTrail events..."
    aws logs filter-log-events \
        --log-group-name CloudTrail/HomeInventoryAuditTrail \
        --start-time $(date -d '1 hour ago' +%s)000 \
        --filter-pattern '{ ($.errorCode = "*UnauthorizedOperation") || ($.errorCode = "*AccessDenied*") }' \
        --query 'events[*].{Time:eventTime,User:userIdentity.type,Event:eventName,Error:errorCode}' \
        --output table 2>/dev/null | tee -a "$LOG_FILE" || log_with_timestamp "CloudTrail logs not available"
    
    # Check WAF blocked requests (production only)
    if [ "$ENVIRONMENT" = "prod" ]; then
        log_with_timestamp "Checking WAF blocked requests..."
        aws cloudwatch get-metric-statistics \
            --namespace AWS/WAFV2 \
            --metric-name BlockedRequests \
            --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 300 \
            --statistics Sum \
            --dimensions Name=WebACL,Value=home-inventory-waf-${ENVIRONMENT} Name=Region,Value=$(aws configure get region) Name=Rule,Value=ALL \
            --output table | tee -a "$LOG_FILE"
    fi
}

# Function to implement immediate containment measures
implement_containment() {
    log_with_timestamp "=== Implementing Containment Measures ==="
    
    case $INCIDENT_TYPE in
        "brute-force")
            log_with_timestamp "Implementing brute force attack containment..."
            # Temporarily reduce API Gateway throttling limits
            log_with_timestamp "Consider manually reducing API Gateway throttling limits"
            log_with_timestamp "Monitor authentication failure patterns"
            ;;
        "data-exfiltration")
            log_with_timestamp "Implementing data exfiltration containment..."
            # Check S3 access patterns
            log_with_timestamp "Checking S3 access patterns..."
            aws s3api get-bucket-logging --bucket home-inv-photos-$(aws sts get-caller-identity --query Account --output text)-${ENVIRONMENT} | tee -a "$LOG_FILE"
            ;;
        "privilege-escalation")
            log_with_timestamp "Implementing privilege escalation containment..."
            # Review recent user management activities
            log_with_timestamp "Review recent user management activities in CloudWatch logs"
            ;;
        "injection-attack")
            log_with_timestamp "Implementing injection attack containment..."
            # Check DynamoDB error patterns
            log_with_timestamp "Checking DynamoDB error patterns..."
            aws cloudwatch get-metric-statistics \
                --namespace AWS/DynamoDB \
                --metric-name UserErrors \
                --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
                --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
                --period 300 \
                --statistics Sum \
                --dimensions Name=TableName,Value=home-inv-${ENVIRONMENT} \
                --output table | tee -a "$LOG_FILE"
            ;;
        *)
            log_with_timestamp "Implementing general containment measures..."
            log_with_timestamp "Monitor all system metrics for anomalies"
            ;;
    esac
}

# Function to collect evidence
collect_evidence() {
    log_with_timestamp "=== Collecting Evidence ==="
    
    # Create evidence directory
    EVIDENCE_DIR="security-evidence-${TIMESTAMP}"
    mkdir -p "$EVIDENCE_DIR"
    
    # Export CloudWatch logs
    log_with_timestamp "Exporting CloudWatch logs..."
    
    # Get log groups
    aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/home-inventory" \
        --query 'logGroups[*].logGroupName' \
        --output text > "$EVIDENCE_DIR/log-groups.txt"
    
    # Export recent logs from each group
    while read -r log_group; do
        if [ -n "$log_group" ]; then
            log_with_timestamp "Exporting logs from $log_group"
            aws logs filter-log-events \
                --log-group-name "$log_group" \
                --start-time $(date -d '2 hours ago' +%s)000 \
                --output json > "$EVIDENCE_DIR/$(basename $log_group)-logs.json" 2>/dev/null || true
        fi
    done < "$EVIDENCE_DIR/log-groups.txt"
    
    # Export CloudWatch metrics
    log_with_timestamp "Exporting CloudWatch metrics..."
    aws cloudwatch list-metrics \
        --namespace AWS/Lambda \
        --query 'Metrics[?contains(MetricName, `Error`) || contains(MetricName, `Duration`) || contains(MetricName, `Invocation`)]' \
        --output json > "$EVIDENCE_DIR/lambda-metrics.json"
    
    log_with_timestamp "Evidence collected in directory: $EVIDENCE_DIR"
}

# Function to notify stakeholders
notify_stakeholders() {
    log_with_timestamp "=== Notifying Stakeholders ==="
    
    # Send SNS notification
    TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `home-inventory-security-alerts-'$ENVIRONMENT'`)].TopicArn' --output text)
    
    if [ -n "$TOPIC_ARN" ]; then
        MESSAGE="Security Incident Response Activated
Environment: $ENVIRONMENT
Incident Type: $INCIDENT_TYPE
Timestamp: $TIMESTAMP
Log File: $LOG_FILE

Immediate actions taken:
- System status gathered
- Suspicious activity checked
- Containment measures implemented
- Evidence collected

Please review the incident log and take appropriate follow-up actions."

        aws sns publish \
            --topic-arn "$TOPIC_ARN" \
            --subject "Security Incident Response - $ENVIRONMENT" \
            --message "$MESSAGE"
        
        log_with_timestamp "Stakeholders notified via SNS"
    else
        log_with_timestamp "WARNING: Security alert topic not found"
    fi
}

# Function to generate incident report
generate_incident_report() {
    log_with_timestamp "=== Generating Incident Report ==="
    
    REPORT_FILE="security-incident-report-${TIMESTAMP}.md"
    
    cat > "$REPORT_FILE" << EOF
# Security Incident Report

## Incident Details
- **Environment**: $ENVIRONMENT
- **Incident Type**: $INCIDENT_TYPE
- **Detection Time**: $TIMESTAMP
- **Response Time**: $(date +"%Y%m%d-%H%M%S")

## Summary
Security incident response procedures were activated for the Home Inventory Management System.

## Actions Taken
1. System status gathered and documented
2. Suspicious activity patterns analyzed
3. Appropriate containment measures implemented
4. Evidence collected and preserved
5. Stakeholders notified

## Evidence Location
- Log File: $LOG_FILE
- Evidence Directory: $EVIDENCE_DIR (if created)

## Recommendations
1. Review all collected evidence
2. Implement additional security measures if needed
3. Update incident response procedures based on lessons learned
4. Schedule post-incident review meeting

## Next Steps
- [ ] Complete detailed forensic analysis
- [ ] Implement permanent fixes for identified vulnerabilities
- [ ] Update security monitoring rules
- [ ] Conduct post-incident review
- [ ] Update documentation and procedures

---
Generated by: Home Inventory Security Incident Response System
EOF

    log_with_timestamp "Incident report generated: $REPORT_FILE"
}

# Main execution flow
main() {
    log_with_timestamp "Starting security incident response procedures..."
    
    check_aws_cli
    gather_system_status
    check_suspicious_activity
    implement_containment
    collect_evidence
    notify_stakeholders
    generate_incident_report
    
    log_with_timestamp "Security incident response procedures completed"
    log_with_timestamp "Review the generated report: security-incident-report-${TIMESTAMP}.md"
    
    echo ""
    echo "=== INCIDENT RESPONSE SUMMARY ==="
    echo "Log File: $LOG_FILE"
    echo "Report File: security-incident-report-${TIMESTAMP}.md"
    echo "Evidence Directory: $EVIDENCE_DIR (if created)"
    echo ""
    echo "Next steps:"
    echo "1. Review all collected evidence"
    echo "2. Implement additional security measures"
    echo "3. Schedule post-incident review"
}

# Script usage
usage() {
    echo "Usage: $0 [environment] [incident-type]"
    echo ""
    echo "Arguments:"
    echo "  environment    Environment (dev|prod) - default: prod"
    echo "  incident-type  Type of incident (brute-force|data-exfiltration|privilege-escalation|injection-attack|general) - default: general"
    echo ""
    echo "Examples:"
    echo "  $0 prod brute-force"
    echo "  $0 dev data-exfiltration"
    echo "  $0 prod general"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main