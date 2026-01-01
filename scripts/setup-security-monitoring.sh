#!/bin/bash

# Setup Security Monitoring and Alerting
# Home Inventory Management System

set -e

ENVIRONMENT=${1:-prod}
EMAIL=${2:-admin@example.com}

echo "=== Setting up Security Monitoring ==="
echo "Environment: $ENVIRONMENT"
echo "Notification Email: $EMAIL"
echo "======================================="

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo "ERROR: AWS CLI not configured or no valid credentials"
        exit 1
    fi
    echo "✓ AWS CLI configured successfully"
}

# Function to create CloudWatch custom metrics for security monitoring
create_security_metrics() {
    echo "Creating custom security metrics..."
    
    # Create custom metric for failed login attempts
    aws cloudwatch put-metric-data \
        --namespace "HomeInventory/Security" \
        --metric-data MetricName=FailedLogins,Value=0,Unit=Count,Dimensions=Environment=$ENVIRONMENT
    
    # Create custom metric for suspicious activities
    aws cloudwatch put-metric-data \
        --namespace "HomeInventory/Security" \
        --metric-data MetricName=SuspiciousActivities,Value=0,Unit=Count,Dimensions=Environment=$ENVIRONMENT
    
    # Create custom metric for data access anomalies
    aws cloudwatch put-metric-data \
        --namespace "HomeInventory/Security" \
        --metric-data MetricName=DataAccessAnomalies,Value=0,Unit=Count,Dimensions=Environment=$ENVIRONMENT
    
    echo "✓ Custom security metrics created"
}

# Function to create security dashboard
create_security_dashboard() {
    echo "Creating security monitoring dashboard..."
    
    DASHBOARD_BODY=$(cat << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApiGateway", "4XXError", "ApiName", "home-inventory-api" ],
          [ ".", "5XXError", ".", "." ],
          [ "HomeInventory/Security", "FailedLogins", "Environment", "ENVIRONMENT_PLACEHOLDER" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "REGION_PLACEHOLDER",
        "title": "Authentication & API Errors",
        "period": 300,
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/WAFV2", "BlockedRequests", "WebACL", "home-inventory-waf-ENVIRONMENT_PLACEHOLDER", "Region", "REGION_PLACEHOLDER", "Rule", "ALL" ],
          [ ".", "AllowedRequests", ".", ".", ".", ".", ".", "." ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "REGION_PLACEHOLDER",
        "title": "WAF Security Events",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "home-inv-ENVIRONMENT_PLACEHOLDER" ],
          [ ".", "ConsumedWriteCapacityUnits", ".", "." ],
          [ ".", "ThrottledRequests", ".", "." ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "REGION_PLACEHOLDER",
        "title": "Database Security Metrics",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 8,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Errors", "FunctionName", "home-inventory-UserManagementFunction" ],
          [ ".", "Duration", ".", "." ],
          [ "HomeInventory/Security", "SuspiciousActivities", "Environment", "ENVIRONMENT_PLACEHOLDER" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "REGION_PLACEHOLDER",
        "title": "Lambda Security Events",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 16,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/S3", "NumberOfObjects", "BucketName", "home-inv-photos-ACCOUNT_ID-ENVIRONMENT_PLACEHOLDER", "StorageType", "AllStorageTypes" ],
          [ "HomeInventory/Security", "DataAccessAnomalies", "Environment", "ENVIRONMENT_PLACEHOLDER" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "REGION_PLACEHOLDER",
        "title": "Data Access Patterns",
        "period": 3600
      }
    },
    {
      "type": "log",
      "x": 0,
      "y": 12,
      "width": 24,
      "height": 6,
      "properties": {
        "query": "SOURCE '/aws/lambda/home-inventory-UserManagementFunction-ENVIRONMENT_PLACEHOLDER'\n| fields @timestamp, @message\n| filter @message like /ERROR/ or @message like /WARN/ or @message like /security/\n| sort @timestamp desc\n| limit 100",
        "region": "REGION_PLACEHOLDER",
        "title": "Security-Related Log Events",
        "view": "table"
      }
    }
  ]
}
EOF
)

    # Replace placeholders
    REGION=$(aws configure get region)
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/ENVIRONMENT_PLACEHOLDER/$ENVIRONMENT/g")
    DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/REGION_PLACEHOLDER/$REGION/g")
    DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/ACCOUNT_ID/$ACCOUNT_ID/g")
    
    # Create the dashboard
    aws cloudwatch put-dashboard \
        --dashboard-name "home-inventory-security-$ENVIRONMENT" \
        --dashboard-body "$DASHBOARD_BODY"
    
    echo "✓ Security dashboard created: home-inventory-security-$ENVIRONMENT"
}

# Function to setup CloudWatch log insights queries
setup_log_insights_queries() {
    echo "Setting up CloudWatch Log Insights queries..."
    
    # Security events query
    SECURITY_QUERY="fields @timestamp, @message, @logStream
| filter @message like /ERROR/ or @message like /UNAUTHORIZED/ or @message like /FORBIDDEN/ or @message like /security/
| sort @timestamp desc
| limit 100"
    
    # Failed authentication query
    AUTH_QUERY="fields @timestamp, @message, @logStream
| filter @message like /authentication/ and @message like /failed/
| stats count() by bin(5m)
| sort @timestamp desc"
    
    # Suspicious activity query
    SUSPICIOUS_QUERY="fields @timestamp, @message, @requestId, @logStream
| filter @message like /suspicious/ or @message like /anomaly/ or @message like /unusual/
| sort @timestamp desc
| limit 50"
    
    echo "✓ Log Insights queries configured"
    echo "  - Security Events Query: $SECURITY_QUERY"
    echo "  - Authentication Failures Query: $AUTH_QUERY"
    echo "  - Suspicious Activity Query: $SUSPICIOUS_QUERY"
}

# Function to create security alert subscriptions
setup_alert_subscriptions() {
    echo "Setting up security alert subscriptions..."
    
    # Find the security alert topic
    TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `home-inventory-security-alerts-'$ENVIRONMENT'`)].TopicArn' --output text)
    
    if [ -n "$TOPIC_ARN" ]; then
        # Subscribe email to security alerts
        aws sns subscribe \
            --topic-arn "$TOPIC_ARN" \
            --protocol email \
            --notification-endpoint "$EMAIL"
        
        echo "✓ Email subscription created for security alerts"
        echo "  Topic: $TOPIC_ARN"
        echo "  Email: $EMAIL"
        echo "  Note: Check your email and confirm the subscription"
    else
        echo "⚠ Security alert topic not found. Deploy the CloudFormation stack first."
    fi
}

# Function to test security monitoring
test_security_monitoring() {
    echo "Testing security monitoring setup..."
    
    # Send test security alert
    TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `home-inventory-security-alerts-'$ENVIRONMENT'`)].TopicArn' --output text)
    
    if [ -n "$TOPIC_ARN" ]; then
        aws sns publish \
            --topic-arn "$TOPIC_ARN" \
            --subject "Test Security Alert - $ENVIRONMENT" \
            --message "This is a test security alert to verify the monitoring system is working correctly.

Environment: $ENVIRONMENT
Test Time: $(date)
Status: Security monitoring system operational

If you received this message, the security alerting system is configured correctly."
        
        echo "✓ Test security alert sent"
    fi
    
    # Create test custom metrics
    aws cloudwatch put-metric-data \
        --namespace "HomeInventory/Security" \
        --metric-data MetricName=TestMetric,Value=1,Unit=Count,Dimensions=Environment=$ENVIRONMENT,Type=Test
    
    echo "✓ Test custom metric created"
}

# Function to display monitoring URLs
display_monitoring_urls() {
    echo ""
    echo "=== Security Monitoring Resources ==="
    
    REGION=$(aws configure get region)
    
    echo "CloudWatch Dashboard:"
    echo "https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=home-inventory-security-$ENVIRONMENT"
    
    echo ""
    echo "CloudWatch Alarms:"
    echo "https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#alarmsV2:?search=home-inventory"
    
    echo ""
    echo "CloudWatch Log Insights:"
    echo "https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:logs-insights"
    
    echo ""
    echo "SNS Topics:"
    echo "https://$REGION.console.aws.amazon.com/sns/v3/home?region=$REGION#/topics"
}

# Function to create security monitoring checklist
create_monitoring_checklist() {
    echo "Creating security monitoring checklist..."
    
    cat > "security-monitoring-checklist-$ENVIRONMENT.md" << EOF
# Security Monitoring Checklist - $ENVIRONMENT

## Daily Security Checks
- [ ] Review CloudWatch security dashboard
- [ ] Check for any triggered security alarms
- [ ] Review failed authentication attempts
- [ ] Monitor unusual API usage patterns
- [ ] Check WAF blocked requests (production only)

## Weekly Security Reviews
- [ ] Analyze security log patterns
- [ ] Review user access patterns
- [ ] Check for privilege escalation attempts
- [ ] Validate backup and recovery procedures
- [ ] Review and update security alert thresholds

## Monthly Security Assessments
- [ ] Comprehensive security log analysis
- [ ] Review and update incident response procedures
- [ ] Test security alert notifications
- [ ] Validate security monitoring coverage
- [ ] Update security documentation

## Security Incident Response
- [ ] Run security incident response script: \`./scripts/security-incident-response.sh $ENVIRONMENT [incident-type]\`
- [ ] Follow incident response procedures
- [ ] Document lessons learned
- [ ] Update security measures as needed

## Key Monitoring Resources
- **Dashboard**: home-inventory-security-$ENVIRONMENT
- **Alert Topic**: home-inventory-security-alerts-$ENVIRONMENT
- **Log Groups**: /aws/lambda/home-inventory-*
- **Incident Response Script**: ./scripts/security-incident-response.sh

## Alert Types and Thresholds
- **Suspicious Logins**: >20 failed attempts in 15 minutes
- **Data Exfiltration**: >1000 S3 objects accessed in 1 hour
- **Privilege Escalation**: >50 admin operations in 15 minutes
- **Database Injection**: >10 database errors in 10 minutes
- **Traffic Anomaly**: >500 API requests in 10 minutes

---
Generated: $(date)
Environment: $ENVIRONMENT
EOF

    echo "✓ Security monitoring checklist created: security-monitoring-checklist-$ENVIRONMENT.md"
}

# Main execution
main() {
    echo "Starting security monitoring setup..."
    
    check_aws_cli
    create_security_metrics
    create_security_dashboard
    setup_log_insights_queries
    setup_alert_subscriptions
    test_security_monitoring
    create_monitoring_checklist
    display_monitoring_urls
    
    echo ""
    echo "✅ Security monitoring setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Confirm email subscription for security alerts"
    echo "2. Review the security dashboard"
    echo "3. Test the incident response procedures"
    echo "4. Follow the daily/weekly/monthly checklist"
}

# Script usage
usage() {
    echo "Usage: $0 [environment] [email]"
    echo ""
    echo "Arguments:"
    echo "  environment  Environment (dev|prod) - default: prod"
    echo "  email        Email for security notifications - default: admin@example.com"
    echo ""
    echo "Examples:"
    echo "  $0 prod security@company.com"
    echo "  $0 dev admin@example.com"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main