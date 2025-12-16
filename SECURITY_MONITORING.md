# Security Monitoring and Alerting

This document describes the security monitoring and alerting system implemented for the Home Inventory Management System.

## Overview

The system implements comprehensive security monitoring using AWS CloudWatch with the following components:

- **CloudWatch Alarms**: Automated alerts for security events
- **Security Dashboard**: Real-time visualization of security metrics
- **SNS Notifications**: Email alerts for security incidents
- **Audit Logging**: Detailed logging of security events

## Security Metrics

### Custom Metrics (HomeInventory/Security namespace)

1. **AuthenticationFailures**: Failed login attempts
2. **AuthorizationFailures**: Access denied events
3. **RateLimitViolations**: Rate limit exceeded events

### AWS Service Metrics

1. **WAF Blocked Requests**: Malicious requests blocked by AWS WAF
2. **API Gateway Errors**: 4xx and 5xx HTTP errors
3. **Lambda Function Errors**: Function execution failures
4. **DynamoDB Throttling**: Database throttling events

## CloudWatch Alarms

### Security Alarms

| Alarm Name | Metric | Threshold | Period | Description |
|------------|--------|-----------|---------|-------------|
| High Auth Failures | AuthenticationFailures | >10 in 10 min | 5 min | Potential brute force attack |
| High Authz Failures | AuthorizationFailures | >20 in 10 min | 5 min | Potential privilege escalation |
| Rate Limit Violations | RateLimitViolations | >5 in 5 min | 5 min | API abuse detection |
| WAF Blocks | BlockedRequests | >50 in 10 min | 5 min | High malicious traffic |

### Performance Alarms

| Alarm Name | Metric | Threshold | Period | Description |
|------------|--------|-----------|---------|-------------|
| API Error Rate | 5XXError | >10 in 10 min | 5 min | Service availability issues |
| Lambda Errors | Errors | >5 in 10 min | 5 min | Function execution problems |
| DynamoDB Throttling | ThrottledRequests | ≥1 | 5 min | Database capacity issues |

## Security Dashboard

The CloudWatch dashboard provides real-time visualization of:

### Widgets

1. **Security Events Overview**: Time series of authentication failures, authorization failures, and rate limit violations
2. **WAF Blocked Requests**: Requests blocked by AWS WAF over time
3. **Authentication Failures (24h)**: Single value widget showing total failures in last 24 hours
4. **Authorization Failures (24h)**: Single value widget showing total failures in last 24 hours
5. **Rate Limit Violations (24h)**: Single value widget showing total violations in last 24 hours
6. **API Gateway Metrics**: Request count, 4xx errors, and 5xx errors
7. **Lambda Function Metrics**: Invocations, errors, and duration
8. **DynamoDB Metrics**: Read/write capacity and throttling
9. **Recent Authentication Failures**: Log insights query showing recent failed login attempts

### Accessing the Dashboard

The dashboard URL is available in the CloudFormation stack outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name home-inventory-dev \
  --query "Stacks[0].Outputs[?OutputKey=='SecurityDashboardUrl'].OutputValue" \
  --output text
```

## Setting Up Email Notifications

### Automatic Setup

Use the provided script to set up email notifications:

```bash
./scripts/setup-security-alerts.sh [environment]
```

This script will:
1. Find the SNS topic ARN from CloudFormation
2. Subscribe your email address to security alerts
3. Display configuration summary

### Manual Setup

1. Get the SNS topic ARN:
```bash
aws cloudformation describe-stacks \
  --stack-name home-inventory-dev \
  --query "Stacks[0].Outputs[?OutputKey=='SecurityAlertsTopicArn'].OutputValue" \
  --output text
```

2. Subscribe to the topic:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:region:account:home-inventory-security-alerts-dev \
  --protocol email \
  --notification-endpoint your-email@example.com
```

3. Confirm the subscription via email

## Log Analysis

### Security Log Group

Security events are logged to: `/aws/lambda/home-inventory-security-metrics-{environment}`

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "abc123",
  "level": "ERROR",
  "eventType": "auth",
  "action": "login_failure",
  "userId": "user123",
  "ipAddress": "192.168.1.1",
  "resource": "authentication",
  "details": {
    "reason": "invalid_credentials"
  }
}
```

### Common Log Insights Queries

#### Recent Authentication Failures
```
fields @timestamp, eventType, action, userId, details
| filter eventType = "auth" and action = "login_failure"
| sort @timestamp desc
| limit 20
```

#### Authorization Failures by User
```
fields @timestamp, userId, resource, details.reason
| filter eventType = "authz_failure"
| stats count() by userId
| sort count desc
```

#### Rate Limit Violations by Endpoint
```
fields @timestamp, details.endpoint, userId
| filter eventType = "rate_limit"
| stats count() by details.endpoint
| sort count desc
```

## Incident Response

### Alert Severity Levels

1. **Critical**: WAF blocks >50 requests, DynamoDB throttling
2. **High**: Auth failures >10, API errors >10
3. **Medium**: Authz failures >20, Lambda errors >5
4. **Low**: Rate limit violations >5

### Response Procedures

#### Authentication Failure Spike
1. Check CloudWatch Logs for source IPs
2. Review failed login patterns
3. Consider temporary IP blocking if needed
4. Verify user account security

#### Authorization Failure Spike
1. Identify affected users and resources
2. Check for privilege escalation attempts
3. Review inventory access patterns
4. Validate user permissions

#### Rate Limit Violations
1. Identify source users/IPs
2. Check for automated attacks
3. Consider adjusting rate limits if legitimate traffic
4. Block malicious sources if needed

#### WAF Blocks
1. Review blocked request patterns
2. Check for new attack vectors
3. Update WAF rules if needed
4. Monitor for rule bypasses

## Maintenance

### Weekly Tasks
- Review security dashboard for trends
- Check alarm history for false positives
- Verify email notifications are working
- Review log retention settings

### Monthly Tasks
- Analyze security metrics trends
- Update alarm thresholds if needed
- Review and update incident response procedures
- Test notification systems

### Quarterly Tasks
- Security metrics review with stakeholders
- Update monitoring based on new threats
- Review and update dashboard widgets
- Conduct tabletop exercises for incident response

## Troubleshooting

### No Metrics Appearing
1. Check Lambda function permissions for CloudWatch Logs
2. Verify security logger is being called in code
3. Check log group exists and has correct name
4. Verify metric filters are configured correctly

### Alarms Not Triggering
1. Check alarm configuration and thresholds
2. Verify SNS topic permissions
3. Check email subscription status
4. Test with manual metric data points

### Dashboard Not Loading
1. Check IAM permissions for CloudWatch
2. Verify dashboard JSON syntax
3. Check metric namespaces and dimensions
4. Verify log group names in log widgets

## Security Considerations

### Log Security
- Logs contain sensitive information (user IDs, IP addresses)
- Access to logs should be restricted to security team
- Consider log encryption for sensitive environments
- Implement log retention policies

### Alert Security
- SNS topics should have restricted access
- Email notifications may contain sensitive data
- Consider using secure communication channels for critical alerts
- Implement alert acknowledgment procedures

### Monitoring the Monitors
- Set up alarms for monitoring system health
- Monitor CloudWatch API usage and costs
- Implement backup alerting mechanisms
- Regular testing of alert delivery