# Operational Procedures

## Overview

This document provides comprehensive operational procedures for the Home Inventory System production environment. It covers daily, weekly, and monthly operational tasks designed to maintain system health, optimize costs, ensure security, and validate backup/recovery capabilities.

**Operational Goals**:
- Maintain 99.9% uptime
- Keep monthly costs under $50
- Ensure data protection and security
- Proactive issue detection and resolution

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Operations](#weekly-operations)
3. [Monthly Operations](#monthly-operations)
4. [Cost Optimization Checklists](#cost-optimization-checklists)
5. [Security Monitoring Procedures](#security-monitoring-procedures)
6. [Backup and Recovery Testing](#backup-and-recovery-testing)
7. [Performance Monitoring](#performance-monitoring)
8. [Incident Response Procedures](#incident-response-procedures)

## Daily Operations

### Morning Health Check (5-10 minutes)

**Frequency**: Every weekday at 9:00 AM  
**Responsible**: On-call engineer or designated team member

#### System Health Validation

```bash
#!/bin/bash
# Daily health check script

echo "=== Daily Health Check - $(date) ==="

# 1. API Health Check
echo "Checking API health..."
API_URL="https://your-prod-api.execute-api.eu-west-1.amazonaws.com/prod"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ API Health: OK"
else
    echo "❌ API Health: FAILED (Status: $HEALTH_STATUS)"
    # Alert team
fi

# 2. CloudFront Status
echo "Checking CloudFront distribution..."
CLOUDFRONT_URL="https://your-cloudfront-domain.cloudfront.net"
CF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL")

if [ "$CF_STATUS" = "200" ]; then
    echo "✅ CloudFront: OK"
else
    echo "❌ CloudFront: FAILED (Status: $CF_STATUS)"
fi

# 3. Database Connectivity
echo "Checking DynamoDB connectivity..."
DB_STATUS=$(aws dynamodb describe-table \
    --table-name home-inv-prod \
    --region eu-west-1 \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null)

if [ "$DB_STATUS" = "ACTIVE" ]; then
    echo "✅ DynamoDB: OK"
else
    echo "❌ DynamoDB: FAILED (Status: $DB_STATUS)"
fi

# 4. Lambda Function Status
echo "Checking Lambda functions..."
LAMBDA_ERRORS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Sum \
    --region eu-west-1 \
    --query 'Datapoints[0].Sum' \
    --output text)

if [ "$LAMBDA_ERRORS" = "None" ] || [ "$LAMBDA_ERRORS" = "0.0" ]; then
    echo "✅ Lambda Functions: No errors in last 24h"
else
    echo "⚠️ Lambda Functions: $LAMBDA_ERRORS errors in last 24h"
fi

echo "=== Health Check Complete ==="
```

#### Cost Monitoring Check

```bash
#!/bin/bash
# Daily cost monitoring

echo "=== Daily Cost Check - $(date) ==="

# 1. Current month spending
CURRENT_COST=$(aws ce get-cost-and-usage \
    --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
    --output text)

echo "Current month cost: $${CURRENT_COST}"

# 2. Budget status
BUDGET_USED=$(aws budgets describe-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget-name "home-inventory-prod" \
    --query 'Budget.CalculatedSpend.ActualSpend.Amount' \
    --output text 2>/dev/null)

BUDGET_LIMIT=$(aws budgets describe-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget-name "home-inventory-prod" \
    --query 'Budget.BudgetLimit.Amount' \
    --output text 2>/dev/null)

if [ ! -z "$BUDGET_USED" ] && [ ! -z "$BUDGET_LIMIT" ]; then
    BUDGET_PERCENT=$(echo "scale=1; $BUDGET_USED * 100 / $BUDGET_LIMIT" | bc)
    echo "Budget utilization: ${BUDGET_PERCENT}% (${BUDGET_USED}/${BUDGET_LIMIT})"
    
    if (( $(echo "$BUDGET_PERCENT > 80" | bc -l) )); then
        echo "⚠️ WARNING: Budget utilization above 80%"
        # Trigger cost optimization procedures
        ./scripts/implement-budget-limits.sh prod warning
    fi
fi

echo "=== Cost Check Complete ==="
```

#### Error Rate Monitoring

```bash
#!/bin/bash
# Daily error monitoring

echo "=== Daily Error Monitoring - $(date) ==="

# 1. API Gateway 4xx/5xx errors
API_4XX=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name 4XXError \
    --dimensions Name=ApiName,Value=home-inventory-prod \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Sum \
    --region eu-west-1 \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null)

API_5XX=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name 5XXError \
    --dimensions Name=ApiName,Value=home-inventory-prod \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Sum \
    --region eu-west-1 \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null)

echo "API Gateway 4XX errors (24h): ${API_4XX:-0}"
echo "API Gateway 5XX errors (24h): ${API_5XX:-0}"

# 2. DynamoDB throttling
DB_THROTTLES=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name ThrottledRequests \
    --dimensions Name=TableName,Value=home-inv-prod \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Sum \
    --region eu-west-1 \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null)

echo "DynamoDB throttles (24h): ${DB_THROTTLES:-0}"

if [ "${DB_THROTTLES:-0}" != "0" ]; then
    echo "⚠️ WARNING: DynamoDB throttling detected"
fi

echo "=== Error Monitoring Complete ==="
```

### Daily Checklist

- [ ] API health check passed
- [ ] CloudFront distribution responding
- [ ] DynamoDB table active and accessible
- [ ] Lambda functions executing without errors
- [ ] Cost within daily budget projection
- [ ] No critical errors in last 24 hours
- [ ] Security alerts reviewed (if any)
- [ ] Backup status verified

## Weekly Operations

### Weekly System Review (30-45 minutes)

**Frequency**: Every Monday at 10:00 AM  
**Responsible**: DevOps engineer or system administrator

#### Performance Analysis

```bash
#!/bin/bash
# Weekly performance review

echo "=== Weekly Performance Review - $(date) ==="

# 1. Lambda performance metrics
echo "Lambda Performance (7 days):"
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 604800 \
    --statistics Average,Maximum \
    --region eu-west-1 \
    --query 'Datapoints[0].[Average,Maximum]' \
    --output table

# 2. API Gateway latency
echo "API Gateway Latency (7 days):"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name Latency \
    --dimensions Name=ApiName,Value=home-inventory-prod \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 604800 \
    --statistics Average,Maximum \
    --region eu-west-1 \
    --query 'Datapoints[0].[Average,Maximum]' \
    --output table

# 3. DynamoDB consumed capacity
echo "DynamoDB Consumed Capacity (7 days):"
aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name ConsumedReadCapacityUnits \
    --dimensions Name=TableName,Value=home-inv-prod \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 604800 \
    --statistics Sum \
    --region eu-west-1 \
    --query 'Datapoints[0].Sum' \
    --output text

echo "=== Performance Review Complete ==="
```

#### Security Review

```bash
#!/bin/bash
# Weekly security review

echo "=== Weekly Security Review - $(date) ==="

# 1. Failed authentication attempts
echo "Checking failed authentication attempts..."
FAILED_AUTHS=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/home-inventory-prod-AuthFunction" \
    --filter-pattern "ERROR" \
    --start-time $(date -d '7 days ago' +%s)000 \
    --query 'length(events)' \
    --output text 2>/dev/null)

echo "Failed authentication attempts (7 days): ${FAILED_AUTHS:-0}"

# 2. GitHub Actions OIDC role usage
echo "Checking GitHub Actions role assumptions..."
ROLE_ASSUMPTIONS=$(aws logs filter-log-events \
    --log-group-name "CloudTrail" \
    --filter-pattern "AssumeRoleWithWebIdentity" \
    --start-time $(date -d '7 days ago' +%s)000 \
    --query 'length(events)' \
    --output text 2>/dev/null)

echo "GitHub Actions role assumptions (7 days): ${ROLE_ASSUMPTIONS:-0}"

# 3. WAF blocked requests
echo "Checking WAF blocked requests..."
if [ ! -z "$WAF_ARN" ]; then
    WAF_BLOCKS=$(aws wafv2 get-sampled-requests \
        --web-acl-arn $WAF_ARN \
        --rule-metric-name AWSManagedRulesCommonRuleSetMetric \
        --scope CLOUDFRONT \
        --time-window StartTime=$(date -d '7 days ago' +%s),EndTime=$(date +%s) \
        --max-items 100 \
        --region us-east-1 \
        --query 'length(SampledRequests)' \
        --output text 2>/dev/null)
    
    echo "WAF blocked requests (7 days): ${WAF_BLOCKS:-0}"
fi

# 4. Unusual API access patterns
echo "Checking for unusual access patterns..."
UNUSUAL_IPS=$(aws logs filter-log-events \
    --log-group-name "API-Gateway-Execution-Logs" \
    --start-time $(date -d '7 days ago' +%s)000 \
    --query 'events[].message' \
    --output text 2>/dev/null | grep -o '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' | sort | uniq -c | sort -nr | head -10)

echo "Top IP addresses (7 days):"
echo "$UNUSUAL_IPS"

# 5. OIDC token usage audit
echo "Auditing OIDC token usage..."
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --query 'Events[?contains(Username, `GitHubActions`)].{Time:EventTime,User:Username,Role:Resources[0].ResourceName}' \
    --output table

echo "=== Security Review Complete ==="
```

#### Cost Optimization Review

```bash
#!/bin/bash
# Weekly cost optimization

echo "=== Weekly Cost Optimization - $(date) ==="

# 1. Generate cost report
./scripts/cost-monitoring-report.js prod weekly

# 2. Check for optimization opportunities
echo "Checking DynamoDB optimization opportunities..."
./scripts/optimize-dynamodb-queries.js prod

# 3. S3 storage analysis
echo "Analyzing S3 storage costs..."
PHOTO_BUCKET_SIZE=$(aws s3api list-objects-v2 \
    --bucket home-inv-photos-prod \
    --query 'sum(Contents[].Size)' \
    --output text 2>/dev/null)

QR_BUCKET_SIZE=$(aws s3api list-objects-v2 \
    --bucket home-inv-qr-reports-prod \
    --query 'sum(Contents[].Size)' \
    --output text 2>/dev/null)

echo "Photo bucket size: $(echo "scale=2; $PHOTO_BUCKET_SIZE / 1024 / 1024" | bc) MB"
echo "QR bucket size: $(echo "scale=2; $QR_BUCKET_SIZE / 1024 / 1024" | bc) MB"

# 4. CloudWatch log retention optimization
echo "Checking log retention settings..."
aws logs describe-log-groups \
    --log-group-name-prefix "/aws/lambda/home-inventory-prod" \
    --query 'logGroups[?retentionInDays>`7`].[logGroupName,retentionInDays]' \
    --output table

echo "=== Cost Optimization Complete ==="
```

### Weekly Checklist

- [ ] Performance metrics reviewed and within acceptable ranges
- [ ] Security events analyzed and addressed
- [ ] Cost optimization opportunities identified
- [ ] Log retention policies optimized
- [ ] S3 lifecycle policies reviewed
- [ ] CloudWatch alarms functioning correctly
- [ ] Backup integrity verified
- [ ] Documentation updated (if needed)

## Monthly Operations

### Monthly System Audit (2-3 hours)

**Frequency**: First Monday of each month  
**Responsible**: Senior DevOps engineer or system architect

#### Comprehensive Cost Analysis

```bash
#!/bin/bash
# Monthly comprehensive cost analysis

echo "=== Monthly Cost Analysis - $(date) ==="

# 1. Generate detailed cost report
./scripts/monthly-cost-report.sh prod comprehensive

# 2. Free tier usage analysis
echo "Analyzing free tier usage..."
aws ce get-usage-forecast \
    --time-period Start=$(date +%Y-%m-01),End=$(date -d '+1 month' +%Y-%m-01) \
    --metric BLENDED_COST \
    --granularity MONTHLY \
    --query 'Total.Amount' \
    --output text

# 3. Service-by-service breakdown
echo "Service cost breakdown:"
aws ce get-cost-and-usage \
    --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-01) \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE \
    --query 'ResultsByTime[0].Groups[].[Keys[0],Metrics.BlendedCost.Amount]' \
    --output table

# 4. Cost optimization recommendations
echo "Generating cost optimization recommendations..."
./scripts/cost-optimization.sh prod monthly

echo "=== Cost Analysis Complete ==="
```

#### Security Audit

```bash
#!/bin/bash
# Monthly security audit

echo "=== Monthly Security Audit - $(date) ==="

# 1. Run comprehensive security verification
./scripts/verify-security-implementation.js prod

# 2. IAM policy review
echo "Reviewing IAM policies..."
aws iam list-roles \
    --query 'Roles[?contains(RoleName, `home-inventory-prod`)].[RoleName,CreateDate]' \
    --output table

# 3. S3 bucket security review
echo "Reviewing S3 bucket security..."
aws s3api get-bucket-policy --bucket home-inv-photos-prod
aws s3api get-bucket-acl --bucket home-inv-photos-prod

# 4. Encryption verification
echo "Verifying encryption settings..."
aws dynamodb describe-table \
    --table-name home-inv-prod \
    --query 'Table.SSEDescription' \
    --region eu-west-1

# 5. Certificate expiration check
echo "Checking SSL certificate expiration..."
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    aws acm list-certificates \
        --region us-east-1 \
        --query 'CertificateSummaryList[?DomainName==`'$CUSTOM_DOMAIN'`].[DomainName,Status,NotAfter]' \
        --output table
fi

echo "=== Security Audit Complete ==="
```

#### Disaster Recovery Testing

```bash
#!/bin/bash
# Monthly disaster recovery test

echo "=== Monthly DR Test - $(date) ==="

# 1. Backup validation
echo "Validating backups..."
./scripts/backup-validation.sh prod monthly

# 2. Point-in-time recovery test
echo "Testing point-in-time recovery..."
./scripts/disaster-recovery-testing.sh prod monthly

# 3. Infrastructure recovery test
echo "Testing infrastructure recovery procedures..."
# Note: This should be done in a test environment
echo "Infrastructure recovery test scheduled for test environment"

# 4. Documentation review
echo "Reviewing disaster recovery documentation..."
echo "Last updated: $(stat -c %y scripts/DISASTER_RECOVERY_RUNBOOK.md)"

echo "=== DR Test Complete ==="
```

### Monthly Checklist

- [ ] Comprehensive cost analysis completed
- [ ] Budget forecasts updated
- [ ] Security audit passed
- [ ] IAM policies reviewed and optimized
- [ ] Encryption settings verified
- [ ] SSL certificates checked for expiration
- [ ] Disaster recovery procedures tested
- [ ] Backup integrity validated
- [ ] Performance benchmarks updated
- [ ] Compliance requirements verified
- [ ] Documentation updated
- [ ] Team training needs assessed

## Cost Optimization Checklists

### Daily Cost Optimization (5 minutes)

```bash
#!/bin/bash
# Daily cost optimization checklist

echo "=== Daily Cost Optimization - $(date) ==="

# Check current spending against daily budget
DAILY_BUDGET=$(echo "scale=2; 50 / $(date +%d)" | bc)  # $50/month divided by days in month
CURRENT_DAILY=$(aws ce get-cost-and-usage \
    --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+1 day' +%Y-%m-%d) \
    --granularity DAILY \
    --metrics BlendedCost \
    --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
    --output text 2>/dev/null)

echo "Daily budget: $${DAILY_BUDGET}"
echo "Current daily cost: $${CURRENT_DAILY:-0}"

# Quick wins for cost reduction
if (( $(echo "${CURRENT_DAILY:-0} > $DAILY_BUDGET" | bc -l) )); then
    echo "⚠️ Daily cost exceeds budget - implementing quick optimizations"
    
    # Reduce log retention for non-critical logs
    aws logs put-retention-policy \
        --log-group-name "/aws/lambda/home-inventory-prod-HealthFunction" \
        --retention-in-days 3
    
    # Check for unused resources
    echo "Checking for optimization opportunities..."
fi

echo "=== Daily Cost Optimization Complete ==="
```

**Daily Cost Checklist**:
- [ ] Current spending within daily budget projection
- [ ] No unexpected cost spikes detected
- [ ] Free tier usage monitored
- [ ] Quick optimization applied if needed

### Weekly Cost Optimization (15 minutes)

```bash
#!/bin/bash
# Weekly cost optimization checklist

echo "=== Weekly Cost Optimization - $(date) ==="

# 1. Lambda optimization
echo "Optimizing Lambda functions..."
for FUNCTION in $(aws lambda list-functions \
    --query 'Functions[?contains(FunctionName, `home-inventory-prod`)].FunctionName' \
    --output text); do
    
    # Check memory utilization
    MAX_MEMORY=$(aws logs filter-log-events \
        --log-group-name "/aws/lambda/$FUNCTION" \
        --start-time $(date -d '7 days ago' +%s)000 \
        --filter-pattern "[REPORT]" \
        --query 'events[].message' \
        --output text | grep -o 'Max Memory Used: [0-9]*' | awk '{print $4}' | sort -n | tail -1)
    
    ALLOCATED_MEMORY=$(aws lambda get-function-configuration \
        --function-name $FUNCTION \
        --query 'MemorySize' \
        --output text)
    
    if [ ! -z "$MAX_MEMORY" ] && [ "$MAX_MEMORY" -lt $((ALLOCATED_MEMORY / 2)) ]; then
        echo "⚠️ $FUNCTION: Consider reducing memory from ${ALLOCATED_MEMORY}MB (max used: ${MAX_MEMORY}MB)"
    fi
done

# 2. S3 lifecycle optimization
echo "Optimizing S3 lifecycle policies..."
./scripts/cost-optimization.sh prod s3-lifecycle

# 3. CloudWatch log optimization
echo "Optimizing CloudWatch logs..."
aws logs describe-log-groups \
    --log-group-name-prefix "/aws/lambda/home-inventory-prod" \
    --query 'logGroups[?retentionInDays>`7`]' \
    --output table

echo "=== Weekly Cost Optimization Complete ==="
```

**Weekly Cost Checklist**:
- [ ] Lambda memory allocation optimized
- [ ] S3 lifecycle policies updated
- [ ] CloudWatch log retention optimized
- [ ] DynamoDB query patterns analyzed
- [ ] API Gateway caching reviewed
- [ ] CloudFront cache hit ratio optimized

### Monthly Cost Optimization (30 minutes)

```bash
#!/bin/bash
# Monthly cost optimization checklist

echo "=== Monthly Cost Optimization - $(date) ==="

# 1. Comprehensive resource review
./scripts/cost-optimization.sh prod comprehensive

# 2. Reserved capacity analysis
echo "Analyzing reserved capacity opportunities..."
# Note: For production systems with predictable load

# 3. Architecture optimization review
echo "Reviewing architecture for cost optimization..."
echo "- Single-table DynamoDB design efficiency"
echo "- Lambda cold start optimization"
echo "- API Gateway vs. Lambda function URLs"
echo "- CloudFront caching strategies"

# 4. Free tier maximization
echo "Maximizing free tier usage..."
./scripts/monthly-cost-report.sh prod free-tier

echo "=== Monthly Cost Optimization Complete ==="
```

**Monthly Cost Checklist**:
- [ ] Architecture reviewed for cost efficiency
- [ ] Reserved capacity opportunities evaluated
- [ ] Free tier usage maximized
- [ ] Cost allocation tags updated
- [ ] Budget thresholds adjusted if needed
- [ ] Cost optimization roadmap updated

## Security Monitoring Procedures

### Daily Security Monitoring (10 minutes)

```bash
#!/bin/bash
# Daily security monitoring

echo "=== Daily Security Monitoring - $(date) ==="

# 1. Authentication failures
FAILED_LOGINS=$(aws logs filter-log-events \
    --log-group-name "/aws/lambda/home-inventory-prod-AuthFunction" \
    --filter-pattern "ERROR" \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --query 'length(events)' \
    --output text 2>/dev/null)

echo "Failed login attempts (24h): ${FAILED_LOGINS:-0}"

if [ "${FAILED_LOGINS:-0}" -gt 10 ]; then
    echo "⚠️ WARNING: High number of failed login attempts"
    # Trigger security alert
fi

# 2. Unusual API access patterns
echo "Checking for unusual API access..."
aws logs filter-log-events \
    --log-group-name "API-Gateway-Execution-Logs" \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --filter-pattern "5XX" \
    --query 'length(events)' \
    --output text 2>/dev/null

# 3. WAF activity (if enabled)
if [ ! -z "$WAF_ARN" ]; then
    echo "Checking WAF blocked requests..."
    aws wafv2 get-sampled-requests \
        --web-acl-arn $WAF_ARN \
        --rule-metric-name AWSManagedRulesCommonRuleSetMetric \
        --scope CLOUDFRONT \
        --time-window StartTime=$(date -d '24 hours ago' +%s),EndTime=$(date +%s) \
        --max-items 10 \
        --region us-east-1 \
        --query 'length(SampledRequests)' \
        --output text 2>/dev/null
fi

echo "=== Daily Security Monitoring Complete ==="
```

**Daily Security Checklist**:
- [ ] Failed authentication attempts reviewed
- [ ] API error patterns analyzed
- [ ] WAF blocked requests reviewed (if applicable)
- [ ] No suspicious IP addresses detected
- [ ] CloudTrail logs reviewed for admin actions

### Weekly Security Procedures (20 minutes)

```bash
#!/bin/bash
# Weekly security procedures

echo "=== Weekly Security Procedures - $(date) ==="

# 1. Security configuration verification
./scripts/verify-security-implementation.js prod

# 2. Access pattern analysis
echo "Analyzing access patterns..."
aws logs insights start-query \
    --log-group-name "/aws/lambda/home-inventory-prod-ContainerFunction" \
    --start-time $(date -d '7 days ago' +%s) \
    --end-time $(date +%s) \
    --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'

# 3. Certificate and key rotation check
echo "Checking certificate expiration..."
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    aws acm describe-certificate \
        --certificate-arn $CERT_ARN \
        --region us-east-1 \
        --query 'Certificate.[DomainName,Status,NotAfter]' \
        --output table
fi

# 4. IAM policy compliance
echo "Verifying IAM policy compliance..."
aws iam simulate-principal-policy \
    --policy-source-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/home-inventory-prod-LambdaExecutionRole" \
    --action-names "dynamodb:GetItem" "dynamodb:PutItem" \
    --resource-arns "arn:aws:dynamodb:eu-west-1:$(aws sts get-caller-identity --query Account --output text):table/home-inv-prod"

echo "=== Weekly Security Procedures Complete ==="
```

**Weekly Security Checklist**:
- [ ] Security configuration verified
- [ ] Access patterns analyzed for anomalies
- [ ] GitHub Actions OIDC role usage audited
- [ ] SSL certificates checked for expiration
- [ ] IAM policies validated for least privilege
- [ ] Security patches reviewed and applied
- [ ] Vulnerability scans completed
- [ ] OIDC token usage patterns reviewed

### Monthly Security Audit (45 minutes)

```bash
#!/bin/bash
# Monthly security audit

echo "=== Monthly Security Audit - $(date) ==="

# 1. Comprehensive security scan
./scripts/run-security-verification.sh prod

# 2. Compliance check
./scripts/compliance-monitoring.sh prod audit

# 3. Penetration testing (if applicable)
echo "Scheduling penetration testing..."
# Note: This should be done by security professionals

# 4. Security training review
echo "Reviewing security training requirements..."
echo "Last security training: [Date]"
echo "Next security training: [Date]"

echo "=== Monthly Security Audit Complete ==="
```

**Monthly Security Checklist**:
- [ ] Comprehensive security scan completed
- [ ] Compliance requirements verified
- [ ] Penetration testing scheduled/completed
- [ ] Security incident response plan reviewed
- [ ] Team security training updated
- [ ] Security documentation updated

## Backup and Recovery Testing

### Daily Backup Verification (5 minutes)

```bash
#!/bin/bash
# Daily backup verification

echo "=== Daily Backup Verification - $(date) ==="

# 1. Check point-in-time recovery status
PITR_STATUS=$(aws dynamodb describe-continuous-backups \
    --table-name home-inv-prod \
    --region eu-west-1 \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
    --output text)

echo "Point-in-time recovery status: $PITR_STATUS"

if [ "$PITR_STATUS" != "ENABLED" ]; then
    echo "❌ ERROR: Point-in-time recovery is not enabled"
    # Alert team
fi

# 2. Check recent backups
RECENT_BACKUPS=$(aws dynamodb list-backups \
    --table-name home-inv-prod \
    --time-range-lower-bound $(date -d '24 hours ago' +%s) \
    --query 'length(BackupSummaries)' \
    --output text)

echo "Recent backups (24h): $RECENT_BACKUPS"

# 3. S3 versioning status
VERSIONING_STATUS=$(aws s3api get-bucket-versioning \
    --bucket home-inv-photos-prod \
    --query 'Status' \
    --output text)

echo "S3 versioning status: $VERSIONING_STATUS"

echo "=== Daily Backup Verification Complete ==="
```

**Daily Backup Checklist**:
- [ ] Point-in-time recovery enabled and functioning
- [ ] S3 versioning enabled
- [ ] Backup monitoring alerts configured
- [ ] No backup failures in last 24 hours

### Weekly Backup Testing (15 minutes)

```bash
#!/bin/bash
# Weekly backup testing

echo "=== Weekly Backup Testing - $(date) ==="

# 1. Test backup creation
echo "Testing backup creation..."
BACKUP_NAME="weekly-test-$(date +%Y%m%d-%H%M%S)"
aws dynamodb create-backup \
    --table-name home-inv-prod \
    --backup-name $BACKUP_NAME \
    --region eu-west-1

# 2. Validate backup integrity
./scripts/backup-validation.sh prod weekly

# 3. Test S3 object recovery
echo "Testing S3 object recovery..."
# Create a test object and verify versioning
echo "test-content-$(date)" > test-file.txt
aws s3 cp test-file.txt s3://home-inv-photos-prod/test/
aws s3 rm s3://home-inv-photos-prod/test/test-file.txt
aws s3api list-object-versions --bucket home-inv-photos-prod --prefix test/

# Clean up
rm test-file.txt

echo "=== Weekly Backup Testing Complete ==="
```

**Weekly Backup Checklist**:
- [ ] Backup creation tested successfully
- [ ] Backup integrity validated
- [ ] S3 object recovery tested
- [ ] Backup retention policies verified
- [ ] Recovery time objectives validated

### Monthly Recovery Testing (60 minutes)

```bash
#!/bin/bash
# Monthly recovery testing

echo "=== Monthly Recovery Testing - $(date) ==="

# 1. Full disaster recovery simulation
./scripts/disaster-recovery-testing.sh prod monthly

# 2. Point-in-time recovery test
echo "Testing point-in-time recovery..."
# Note: This should be done in a test environment
echo "PITR test scheduled for test environment"

# 3. Infrastructure recovery test
echo "Testing infrastructure recovery..."
# Note: This should be done in a test environment
echo "Infrastructure recovery test scheduled for test environment"

# 4. Recovery documentation review
echo "Reviewing recovery documentation..."
echo "Last updated: $(stat -c %y scripts/DISASTER_RECOVERY_RUNBOOK.md)"

echo "=== Monthly Recovery Testing Complete ==="
```

**Monthly Recovery Checklist**:
- [ ] Full disaster recovery simulation completed
- [ ] Point-in-time recovery tested
- [ ] Infrastructure recovery procedures validated
- [ ] Recovery time objectives met
- [ ] Recovery documentation updated
- [ ] Team recovery training completed

## Performance Monitoring

### Daily Performance Monitoring (5 minutes)

```bash
#!/bin/bash
# Daily performance monitoring

echo "=== Daily Performance Monitoring - $(date) ==="

# 1. API response times
API_LATENCY=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ApiGateway \
    --metric-name Latency \
    --dimensions Name=ApiName,Value=home-inventory-prod \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Average \
    --region eu-west-1 \
    --query 'Datapoints[0].Average' \
    --output text)

echo "Average API latency (24h): ${API_LATENCY:-N/A} ms"

# 2. Lambda duration
LAMBDA_DURATION=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Average \
    --region eu-west-1 \
    --query 'Datapoints[0].Average' \
    --output text)

echo "Average Lambda duration (24h): ${LAMBDA_DURATION:-N/A} ms"

# 3. DynamoDB response times
DB_LATENCY=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name SuccessfulRequestLatency \
    --dimensions Name=TableName,Value=home-inv-prod Name=Operation,Value=GetItem \
    --start-time $(date -d '24 hours ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 86400 \
    --statistics Average \
    --region eu-west-1 \
    --query 'Datapoints[0].Average' \
    --output text)

echo "Average DynamoDB latency (24h): ${DB_LATENCY:-N/A} ms"

echo "=== Daily Performance Monitoring Complete ==="
```

**Daily Performance Checklist**:
- [ ] API response times within acceptable limits (<2000ms)
- [ ] Lambda execution times optimized (<5000ms)
- [ ] DynamoDB response times normal (<100ms)
- [ ] No performance degradation detected

### Weekly Performance Analysis (20 minutes)

```bash
#!/bin/bash
# Weekly performance analysis

echo "=== Weekly Performance Analysis - $(date) ==="

# 1. Trend analysis
echo "Analyzing performance trends..."
./scripts/monthly-cost-report.sh prod performance

# 2. Bottleneck identification
echo "Identifying performance bottlenecks..."
# Check for Lambda cold starts
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 3600 \
    --statistics Maximum \
    --region eu-west-1 \
    --query 'Datapoints[?Maximum>`10000`]' \
    --output table

# 3. Cache hit ratio analysis
echo "Analyzing CloudFront cache performance..."
aws cloudwatch get-metric-statistics \
    --namespace AWS/CloudFront \
    --metric-name CacheHitRate \
    --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
    --start-time $(date -d '7 days ago' --iso-8601) \
    --end-time $(date --iso-8601) \
    --period 604800 \
    --statistics Average \
    --region us-east-1 \
    --query 'Datapoints[0].Average' \
    --output text

echo "=== Weekly Performance Analysis Complete ==="
```

**Weekly Performance Checklist**:
- [ ] Performance trends analyzed
- [ ] Bottlenecks identified and addressed
- [ ] Cache hit ratios optimized (>80%)
- [ ] Cold start optimization reviewed
- [ ] Performance benchmarks updated

## Incident Response Procedures

### Incident Classification

**Severity Levels**:

- **Critical (P1)**: Complete service outage, data loss, security breach
- **High (P2)**: Major functionality impaired, significant performance degradation
- **Medium (P3)**: Minor functionality issues, moderate performance impact
- **Low (P4)**: Cosmetic issues, minimal impact

### Incident Response Workflow

#### P1 - Critical Incidents (Response Time: 15 minutes)

```bash
#!/bin/bash
# P1 incident response

echo "=== P1 CRITICAL INCIDENT RESPONSE ==="
echo "Incident ID: $1"
echo "Start Time: $(date)"

# 1. Immediate assessment
./scripts/disaster-recovery.sh prod assess

# 2. Implement immediate containment
if [ "$2" = "security" ]; then
    ./scripts/security-incident-response.sh prod isolate
elif [ "$2" = "outage" ]; then
    # Check if rollback is needed
    ./scripts/rollback-production.sh prod list
fi

# 3. Notify stakeholders
echo "Notifying stakeholders..."
# Send alerts to team and management

# 4. Begin recovery procedures
echo "Initiating recovery procedures..."
# Follow disaster recovery runbook

echo "=== P1 INCIDENT RESPONSE INITIATED ==="
```

#### P2 - High Priority Incidents (Response Time: 30 minutes)

```bash
#!/bin/bash
# P2 incident response

echo "=== P2 HIGH PRIORITY INCIDENT RESPONSE ==="
echo "Incident ID: $1"
echo "Start Time: $(date)"

# 1. Detailed assessment
./scripts/disaster-recovery.sh prod assess

# 2. Identify root cause
echo "Analyzing logs for root cause..."
aws logs tail /aws/lambda/home-inventory-prod-ContainerFunction \
    --region eu-west-1 \
    --since 1h

# 3. Implement fix or workaround
echo "Implementing fix/workaround..."
# Apply appropriate fix based on issue type

# 4. Monitor for resolution
echo "Monitoring for resolution..."

echo "=== P2 INCIDENT RESPONSE INITIATED ==="
```

### Post-Incident Procedures

```bash
#!/bin/bash
# Post-incident procedures

echo "=== POST-INCIDENT PROCEDURES ==="
echo "Incident ID: $1"
echo "Resolution Time: $(date)"

# 1. Validate resolution
./scripts/disaster-recovery.sh prod validate-recovery

# 2. Document lessons learned
echo "Documenting lessons learned..."
# Create post-incident report

# 3. Update procedures
echo "Updating procedures based on lessons learned..."
# Update runbooks and procedures

# 4. Schedule follow-up review
echo "Scheduling post-incident review meeting..."

echo "=== POST-INCIDENT PROCEDURES COMPLETE ==="
```

## Appendix

### Automation Scripts

All operational procedures can be automated using the following scripts:

- `scripts/daily-operations.sh` - Daily health checks and monitoring
- `scripts/weekly-operations.sh` - Weekly reviews and optimizations
- `scripts/monthly-operations.sh` - Monthly audits and testing
- `scripts/cost-monitoring-report.js` - Cost analysis and optimization
- `scripts/backup-validation.sh` - Backup integrity testing
- `scripts/disaster-recovery-testing.sh` - Recovery procedure testing

### Monitoring Dashboards

Create CloudWatch dashboards for:

1. **System Health Dashboard**
   - API Gateway metrics
   - Lambda performance
   - DynamoDB metrics
   - Error rates

2. **Cost Monitoring Dashboard**
   - Daily/monthly spending
   - Service breakdown
   - Budget utilization
   - Free tier usage

3. **Security Dashboard**
   - Failed authentication attempts
   - WAF blocked requests
   - Unusual access patterns
   - Security alerts

### Alert Configuration

Set up CloudWatch alarms for:

- API Gateway 5xx error rate > 1%
- Lambda error rate > 1%
- DynamoDB throttling events
- Cost exceeding 80% of budget
- Failed authentication attempts > 10/hour

### Contact Information

**Escalation Contacts**:
- On-call Engineer: [Contact info]
- DevOps Lead: [Contact info]
- Security Officer: [Contact info]
- Management: [Contact info]

**External Support**:
- AWS Support: [Support case URL]
- GitHub Support: [For CI/CD issues]

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d '+1 month' +%Y-%m-%d)  
**Operational Target**: 99.9% uptime, <$50/month cost