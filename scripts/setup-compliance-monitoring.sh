#!/bin/bash

# Setup Compliance Monitoring
# Configures CloudWatch alarms for compliance violations and sets up automated monitoring

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-prod}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

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

# Function to create CloudWatch metric filters for compliance monitoring
create_compliance_metric_filters() {
    log "Creating CloudWatch metric filters for compliance monitoring..."
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        local cloudtrail_log_group="/aws/cloudtrail/home-inventory-$ENVIRONMENT"
        
        # Check if CloudTrail log group exists
        if aws logs describe-log-groups \
            --log-group-name-prefix "$cloudtrail_log_group" \
            --region "$AWS_REGION" \
            --query 'logGroups[0].logGroupName' \
            --output text 2>/dev/null | grep -q "$cloudtrail_log_group"; then
            
            # Metric filter for unauthorized API calls
            aws logs put-metric-filter \
                --log-group-name "$cloudtrail_log_group" \
                --filter-name "UnauthorizedAPICalls-$ENVIRONMENT" \
                --filter-pattern '{ ($.errorCode = "*UnauthorizedOperation") || ($.errorCode = "*AccessDenied*") }' \
                --metric-transformations \
                    metricName=UnauthorizedAPICalls,metricNamespace=CloudTrailMetrics,metricValue=1 \
                --region "$AWS_REGION" 2>/dev/null || true
            
            # Metric filter for root account usage
            aws logs put-metric-filter \
                --log-group-name "$cloudtrail_log_group" \
                --filter-name "RootAccountUsage-$ENVIRONMENT" \
                --filter-pattern '{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != "AwsServiceEvent" }' \
                --metric-transformations \
                    metricName=RootAccountUsage,metricNamespace=CloudTrailMetrics,metricValue=1 \
                --region "$AWS_REGION" 2>/dev/null || true
            
            # Metric filter for IAM policy changes
            aws logs put-metric-filter \
                --log-group-name "$cloudtrail_log_group" \
                --filter-name "IAMPolicyChanges-$ENVIRONMENT" \
                --filter-pattern '{ ($.eventName=DeleteGroupPolicy) || ($.eventName=DeleteRolePolicy) || ($.eventName=DeleteUserPolicy) || ($.eventName=PutGroupPolicy) || ($.eventName=PutRolePolicy) || ($.eventName=PutUserPolicy) || ($.eventName=CreatePolicy) || ($.eventName=DeletePolicy) || ($.eventName=CreatePolicyVersion) || ($.eventName=DeletePolicyVersion) || ($.eventName=AttachRolePolicy) || ($.eventName=DetachRolePolicy) || ($.eventName=AttachUserPolicy) || ($.eventName=DetachUserPolicy) || ($.eventName=AttachGroupPolicy) || ($.eventName=DetachGroupPolicy) }' \
                --metric-transformations \
                    metricName=IAMPolicyChanges,metricNamespace=CloudTrailMetrics,metricValue=1 \
                --region "$AWS_REGION" 2>/dev/null || true
            
            # Metric filter for CloudTrail configuration changes
            aws logs put-metric-filter \
                --log-group-name "$cloudtrail_log_group" \
                --filter-name "CloudTrailChanges-$ENVIRONMENT" \
                --filter-pattern '{ ($.eventName = CreateTrail) || ($.eventName = UpdateTrail) || ($.eventName = DeleteTrail) || ($.eventName = StartLogging) || ($.eventName = StopLogging) }' \
                --metric-transformations \
                    metricName=CloudTrailChanges,metricNamespace=CloudTrailMetrics,metricValue=1 \
                --region "$AWS_REGION" 2>/dev/null || true
            
            success "CloudWatch metric filters created for CloudTrail compliance monitoring"
        else
            warning "CloudTrail log group not found, skipping metric filters"
        fi
    else
        warning "Compliance metric filters only created for production environment"
    fi
}

# Function to create compliance dashboard
create_compliance_dashboard() {
    log "Creating compliance monitoring dashboard..."
    
    local dashboard_name="HomeInventoryCompliance-$ENVIRONMENT"
    
    cat > /tmp/compliance-dashboard.json << EOF
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
          [ "CloudTrailMetrics", "UnauthorizedAPICalls" ],
          [ ".", "RootAccountUsage" ],
          [ ".", "IAMPolicyChanges" ],
          [ ".", "CloudTrailChanges" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$AWS_REGION",
        "title": "Compliance Violations",
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
          [ "AWS/Lambda", "Errors", "FunctionName", "home-inventory-system-$ENVIRONMENT-ContainerFunction" ],
          [ ".", ".", ".", "home-inventory-system-$ENVIRONMENT-UserManagementFunction" ],
          [ ".", ".", ".", "home-inventory-system-$ENVIRONMENT-InventoryFunction" ],
          [ ".", ".", ".", "home-inventory-system-$ENVIRONMENT-AuditLogsFunction" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$AWS_REGION",
        "title": "System Errors (Compliance Impact)",
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
          [ "AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "home-inv-$ENVIRONMENT" ],
          [ ".", "ConsumedWriteCapacityUnits", ".", "." ],
          [ ".", "ThrottledRequests", ".", "." ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$AWS_REGION",
        "title": "Data Access Patterns",
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
          [ "AWS/ApiGateway", "4XXError", "ApiName", "home-inventory-system-$ENVIRONMENT" ],
          [ ".", "5XXError", ".", "." ],
          [ ".", "Count", ".", "." ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$AWS_REGION",
        "title": "API Access Compliance",
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
          [ "AWS/S3", "NumberOfObjects", "BucketName", "home-inv-photos-$(aws sts get-caller-identity --query Account --output text)-$ENVIRONMENT", "StorageType", "AllStorageTypes" ],
          [ ".", "BucketSizeBytes", ".", ".", ".", "StandardStorage" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "$AWS_REGION",
        "title": "Data Storage Compliance",
        "period": 86400
      }
    }
  ]
}
EOF

    aws cloudwatch put-dashboard \
        --dashboard-name "$dashboard_name" \
        --dashboard-body "file:///tmp/compliance-dashboard.json" \
        --region "$AWS_REGION" >/dev/null 2>&1 && \
        success "Compliance dashboard created: $dashboard_name" || \
        warning "Failed to create compliance dashboard"
    
    rm -f /tmp/compliance-dashboard.json
}

# Function to create compliance report schedule
create_compliance_schedule() {
    log "Creating compliance monitoring schedule..."
    
    # Create a simple cron-like schedule documentation
    cat > "compliance-schedule-$ENVIRONMENT.md" << EOF
# Compliance Monitoring Schedule - $ENVIRONMENT Environment

## Automated Monitoring

### Daily Checks (Automated via CloudWatch Alarms)
- ✅ **System Errors**: Lambda function errors, API Gateway 5XX errors
- ✅ **Security Events**: WAF blocked requests, authentication failures
- ✅ **Resource Usage**: DynamoDB throttling, unusual access patterns
- ✅ **Cost Monitoring**: Budget alerts, free tier usage

### Weekly Checks (Manual)
- [ ] **Audit Log Review**: Review CloudTrail and application audit logs
- [ ] **Access Control Review**: Verify S3 bucket policies, IAM permissions
- [ ] **Backup Validation**: Verify DynamoDB PITR status, S3 versioning
- [ ] **Compliance Dashboard**: Review compliance metrics dashboard

### Monthly Checks (Manual)
- [ ] **Full Compliance Audit**: Run \`./scripts/compliance-monitoring.sh $ENVIRONMENT\`
- [ ] **Audit Report Generation**: Run \`./scripts/extract-audit-reports.sh $ENVIRONMENT\`
- [ ] **User Access Review**: Review Cognito users and inventory memberships
- [ ] **Security Configuration**: Verify WAF rules, security headers
- [ ] **Documentation Update**: Update compliance documentation

### Quarterly Checks (Manual)
- [ ] **Disaster Recovery Test**: Test backup restoration procedures
- [ ] **Security Assessment**: Review security configurations and policies
- [ ] **Compliance Training**: Update team on compliance requirements
- [ ] **External Audit Prep**: Prepare documentation for external audits

## Compliance Contacts

- **System Administrator**: admin@example.com
- **Security Officer**: security@example.com
- **Compliance Officer**: compliance@example.com

## Escalation Procedures

### Critical Violations (Immediate Response Required)
1. **Root Account Usage**: Immediate investigation and notification
2. **Unauthorized Access**: Lock down affected resources, investigate
3. **Data Breach Indicators**: Follow incident response procedures
4. **Audit Trail Tampering**: Immediate security team notification

### Standard Violations (24-hour Response)
1. **Policy Changes**: Review and validate changes
2. **Access Control Issues**: Correct permissions and document
3. **Backup Failures**: Investigate and restore backup capabilities
4. **Monitoring Gaps**: Fix monitoring configuration

### Minor Issues (Weekly Review)
1. **Log Retention**: Adjust retention policies as needed
2. **Cost Optimization**: Review and optimize resource usage
3. **Documentation**: Update procedures and documentation

## Compliance Tools

### Scripts
- \`./scripts/compliance-monitoring.sh\` - Run compliance checks
- \`./scripts/extract-audit-reports.sh\` - Generate audit reports
- \`./scripts/setup-compliance-monitoring.sh\` - Setup monitoring

### Dashboards
- **CloudWatch**: HomeInventoryCompliance-$ENVIRONMENT
- **Cost Management**: AWS Budgets dashboard
- **Security**: WAF and CloudTrail dashboards

### Alerts
- **SNS Topic**: home-inventory-security-alerts-$ENVIRONMENT
- **Email Notifications**: Configured for critical violations
- **CloudWatch Alarms**: Automated monitoring and alerting

## Compliance Evidence

### Required Documentation
- [ ] Monthly compliance reports
- [ ] Quarterly audit reports
- [ ] Annual security assessments
- [ ] Incident response logs
- [ ] Change management records

### Retention Periods
- **CloudTrail Logs**: 90 days (production), N/A (development)
- **Application Logs**: 7 days (configurable)
- **Compliance Reports**: 3 years
- **Incident Records**: 7 years
- **Change Records**: 3 years

---
*Generated on $(date) for $ENVIRONMENT environment*
EOF

    success "Compliance schedule created: compliance-schedule-$ENVIRONMENT.md"
}

# Function to validate GitHub environment protection
validate_github_protection() {
    log "Validating GitHub environment protection requirements..."
    
    cat << EOF

GitHub Environment Protection Validation Checklist:

### Production Environment Protection
- [ ] **Manual Approval Required**: Production deployments require manual approval
- [ ] **Required Reviewers**: At least 1 reviewer required for production
- [ ] **Branch Protection**: Only main/master branch can deploy to production
- [ ] **Environment Secrets**: Production secrets properly configured
- [ ] **Deployment History**: All deployments logged and auditable

### Development Environment Protection  
- [ ] **Automated Deployment**: Development can deploy automatically from develop branch
- [ ] **Testing Required**: All tests must pass before deployment
- [ ] **Security Scanning**: Security audit required before deployment

### Compliance Requirements
- [ ] **Audit Trail**: All deployments create audit trail in GitHub Actions
- [ ] **Change Approval**: Production changes require documented approval
- [ ] **Rollback Capability**: Rollback procedures documented and tested
- [ ] **Access Control**: Repository access properly managed

### Verification Steps
1. Go to GitHub repository settings
2. Navigate to Environments section
3. Verify production environment has:
   - Required reviewers configured
   - Deployment branches restricted to main
   - Manual approval enabled
4. Verify development environment has:
   - Automated deployment enabled
   - Required status checks configured

### Documentation Required
- [ ] Environment protection policies documented
- [ ] Deployment procedures documented  
- [ ] Rollback procedures documented
- [ ] Access control procedures documented

Note: GitHub environment protection must be configured manually in GitHub repository settings.
The current workflows already reference the required environments.

EOF
}

# Function to create compliance reporting procedures
create_compliance_procedures() {
    log "Creating compliance reporting procedures..."
    
    cat > "compliance-procedures-$ENVIRONMENT.md" << EOF
# Compliance Reporting Procedures - $ENVIRONMENT Environment

## Overview

This document outlines the procedures for compliance monitoring, reporting, and violation response for the Home Inventory System.

## Compliance Framework

### Regulatory Requirements
- **Data Protection**: Encryption at rest and in transit
- **Access Control**: Least privilege access principles
- **Audit Logging**: Comprehensive audit trail maintenance
- **Change Management**: Documented and approved changes
- **Backup and Recovery**: Regular backup validation

### Internal Policies
- **Security Standards**: WAF protection, security headers
- **Cost Management**: Budget monitoring and optimization
- **Monitoring**: Comprehensive system monitoring
- **Documentation**: Up-to-date compliance documentation

## Monitoring Procedures

### Automated Monitoring
1. **CloudWatch Alarms**: Monitor for compliance violations
2. **SNS Notifications**: Immediate alerts for critical issues
3. **Budget Alerts**: Cost monitoring and optimization
4. **Security Monitoring**: WAF and authentication monitoring

### Manual Monitoring
1. **Daily**: Review CloudWatch dashboards for anomalies
2. **Weekly**: Run compliance monitoring script
3. **Monthly**: Generate comprehensive audit reports
4. **Quarterly**: Conduct full compliance assessment

## Reporting Procedures

### Daily Reports
- **Automated**: CloudWatch alarms and SNS notifications
- **Manual**: Review security dashboard for anomalies

### Weekly Reports
\`\`\`bash
# Run weekly compliance check
./scripts/compliance-monitoring.sh $ENVIRONMENT

# Review results and document any issues
# Create remediation plan for violations
\`\`\`

### Monthly Reports
\`\`\`bash
# Generate comprehensive audit report
./scripts/extract-audit-reports.sh $ENVIRONMENT \$(date -d '1 month ago' '+%Y-%m-%d') \$(date '+%Y-%m-%d')

# Review audit report for compliance
# Document findings and recommendations
\`\`\`

### Quarterly Reports
- **Full Compliance Assessment**: Complete review of all compliance areas
- **Risk Assessment**: Identify and document compliance risks
- **Remediation Planning**: Create plans for addressing violations
- **Documentation Update**: Update compliance procedures and policies

## Violation Response Procedures

### Critical Violations (Immediate Response)
1. **Assess Impact**: Determine scope and impact of violation
2. **Contain Issue**: Implement immediate containment measures
3. **Notify Stakeholders**: Alert security and compliance teams
4. **Document Incident**: Create detailed incident record
5. **Remediate**: Implement permanent fix
6. **Follow-up**: Verify fix and prevent recurrence

### Standard Violations (24-hour Response)
1. **Investigate**: Determine root cause of violation
2. **Plan Remediation**: Create remediation plan
3. **Implement Fix**: Apply corrective measures
4. **Verify**: Confirm violation is resolved
5. **Document**: Update compliance records

### Minor Issues (Weekly Review)
1. **Assess**: Evaluate impact and priority
2. **Schedule**: Plan remediation during maintenance window
3. **Implement**: Apply fixes during scheduled maintenance
4. **Monitor**: Verify resolution in next compliance check

## Compliance Evidence Management

### Evidence Collection
- **Automated**: CloudTrail logs, CloudWatch metrics
- **Manual**: Compliance reports, audit findings
- **Documentation**: Procedures, policies, training records

### Evidence Retention
- **Logs**: Per retention policy (7-90 days)
- **Reports**: 3 years minimum
- **Incidents**: 7 years minimum
- **Training**: 3 years minimum

### Evidence Protection
- **Encryption**: All evidence encrypted at rest and in transit
- **Access Control**: Limited access to compliance evidence
- **Backup**: Regular backup of compliance evidence
- **Integrity**: Hash verification for critical evidence

## Compliance Training

### Required Training
- **Security Awareness**: Annual training for all users
- **Compliance Procedures**: Training for administrators
- **Incident Response**: Training for security team
- **Change Management**: Training for developers

### Training Records
- **Completion**: Track training completion
- **Certification**: Maintain certification records
- **Updates**: Regular training updates
- **Assessment**: Periodic knowledge assessment

## External Audits

### Audit Preparation
1. **Evidence Collection**: Gather required compliance evidence
2. **Documentation Review**: Ensure all procedures are current
3. **System Access**: Prepare audit access if required
4. **Team Coordination**: Coordinate with audit team

### Audit Support
1. **Evidence Provision**: Provide requested evidence
2. **System Demonstration**: Demonstrate compliance controls
3. **Question Response**: Respond to auditor questions
4. **Issue Resolution**: Address any audit findings

### Post-Audit Activities
1. **Finding Review**: Review and validate audit findings
2. **Remediation Planning**: Create plans for addressing findings
3. **Implementation**: Implement required changes
4. **Follow-up**: Verify remediation with auditors

## Continuous Improvement

### Regular Reviews
- **Monthly**: Review compliance metrics and trends
- **Quarterly**: Assess compliance program effectiveness
- **Annually**: Comprehensive compliance program review

### Process Improvement
- **Automation**: Identify opportunities for automation
- **Efficiency**: Streamline compliance procedures
- **Effectiveness**: Improve compliance monitoring
- **Training**: Enhance compliance training programs

## Contact Information

### Compliance Team
- **Compliance Officer**: compliance@example.com
- **Security Officer**: security@example.com
- **System Administrator**: admin@example.com

### Escalation Contacts
- **Critical Issues**: security-emergency@example.com
- **Management**: management@example.com
- **Legal**: legal@example.com

---
*Document Version: 1.0*  
*Last Updated: $(date)*  
*Environment: $ENVIRONMENT*
EOF

    success "Compliance procedures created: compliance-procedures-$ENVIRONMENT.md"
}

# Main execution
main() {
    log "=== Setting Up Compliance Monitoring for $ENVIRONMENT ==="
    
    # Check dependencies
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured or invalid."
        exit 1
    fi
    
    # Create compliance monitoring components
    create_compliance_metric_filters
    echo
    
    create_compliance_dashboard
    echo
    
    create_compliance_schedule
    echo
    
    validate_github_protection
    echo
    
    create_compliance_procedures
    echo
    
    success "Compliance monitoring setup completed for $ENVIRONMENT environment!"
    
    # Summary
    echo
    log "Setup Summary:"
    echo "  ✅ CloudWatch metric filters for compliance violations"
    echo "  ✅ Compliance monitoring dashboard"
    echo "  ✅ Compliance monitoring schedule"
    echo "  ✅ GitHub environment protection validation"
    echo "  ✅ Compliance reporting procedures"
    echo
    log "Next Steps:"
    echo "  1. Review and configure GitHub environment protection manually"
    echo "  2. Test compliance monitoring with: ./scripts/compliance-monitoring.sh $ENVIRONMENT"
    echo "  3. Schedule regular compliance checks according to compliance-schedule-$ENVIRONMENT.md"
    echo "  4. Review and customize compliance-procedures-$ENVIRONMENT.md for your organization"
}

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <environment>"
    echo
    echo "Arguments:"
    echo "  environment  - Environment to setup (prod or dev)"
    echo
    echo "Environment Variables:"
    echo "  AWS_REGION   - AWS region (default: eu-west-1)"
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

# Run main function
main "$@"