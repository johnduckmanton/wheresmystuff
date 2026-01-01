# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for disaster recovery of the Home Inventory System production environment. The system is designed to meet the following recovery objectives:

- **Recovery Time Objective (RTO)**: 8 hours
- **Recovery Point Objective (RPO)**: 1 hour (acceptable data loss)

## Prerequisites

### Required Tools
- AWS CLI configured with appropriate permissions
- `jq` for JSON processing
- Bash shell environment
- Access to the GitHub repository with deployment scripts

### Required Permissions
- DynamoDB: Full access for backup/restore operations
- S3: Full access for bucket operations
- CloudFormation: Full access for stack operations
- API Gateway: Read/write access
- CloudWatch: Read access for monitoring
- IAM: Read access for role verification

### Emergency Contacts
- **Primary On-Call**: [Your primary contact]
- **Secondary On-Call**: [Your secondary contact]
- **AWS Support**: [Your AWS support case URL if applicable]

## Disaster Scenarios and Response

### Scenario 1: Data Corruption or Loss

**Symptoms:**
- Application errors related to data retrieval
- Missing or corrupted data in DynamoDB
- User reports of lost data

**Response Procedure:**

1. **Immediate Assessment** (5 minutes)
   ```bash
   # Assess the situation
   ./scripts/disaster-recovery.sh prod assess
   
   # Check data integrity
   ./scripts/disaster-recovery.sh prod validate-data
   ```

2. **Data Recovery** (30-60 minutes)
   ```bash
   # If data integrity issues found, recover data
   ./scripts/disaster-recovery.sh prod recover-data
   ```

3. **Validation** (15 minutes)
   ```bash
   # Validate recovery
   ./scripts/disaster-recovery.sh prod validate-recovery
   ```

### Scenario 2: Infrastructure Failure

**Symptoms:**
- CloudFormation stack in failed state
- AWS resources not accessible
- API Gateway returning errors
- Lambda functions not executing

**Response Procedure:**

1. **Immediate Assessment** (10 minutes)
   ```bash
   # Assess infrastructure status
   ./scripts/disaster-recovery.sh prod assess
   ```

2. **Resource Recovery** (1-2 hours)
   ```bash
   # Attempt to repair resources
   ./scripts/disaster-recovery.sh prod recover-resources
   ```

3. **If Resource Recovery Fails** (2-4 hours)
   ```bash
   # Full infrastructure rebuild
   ./scripts/disaster-recovery.sh prod full-recovery
   ```

### Scenario 3: Complete System Failure

**Symptoms:**
- All services unavailable
- CloudFormation stacks deleted or corrupted
- Multiple AWS resources affected

**Response Procedure:**

1. **Immediate Assessment** (10 minutes)
   ```bash
   # Full system assessment
   ./scripts/disaster-recovery.sh prod assess
   ```

2. **Full Recovery** (4-6 hours)
   ```bash
   # Complete system rebuild
   ./scripts/disaster-recovery.sh prod full-recovery
   ```

3. **Post-Recovery Validation** (30 minutes)
   ```bash
   # Comprehensive validation
   ./scripts/disaster-recovery.sh prod validate-recovery
   ```

## Detailed Recovery Procedures

### Data Recovery Using Point-in-Time Recovery

DynamoDB point-in-time recovery allows restoration to any point within the last 35 days.

**Steps:**

1. **Check PITR Status**
   ```bash
   aws dynamodb describe-continuous-backups \
     --table-name home-inv-prod \
     --region eu-west-1
   ```

2. **Determine Recovery Point**
   - Default: 1 hour ago (meets RPO requirement)
   - Custom: Specify exact timestamp if known

3. **Execute Recovery**
   ```bash
   ./scripts/rollback-production.sh prod pitr "2024-01-15 10:30:00"
   ```

4. **Switch to Recovered Table**
   - Update CloudFormation stack to use new table
   - Test application functionality
   - Delete old table once confirmed

### Infrastructure Recovery Using CloudFormation

**Steps:**

1. **Check Stack Status**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name home-inventory-prod \
     --region eu-west-1
   ```

2. **Attempt Stack Update**
   ```bash
   sam deploy --config-file samconfig-prod.toml --region eu-west-1
   ```

3. **If Stack Update Fails**
   ```bash
   # Delete and recreate stack
   aws cloudformation delete-stack \
     --stack-name home-inventory-prod \
     --region eu-west-1
   
   # Wait for deletion
   aws cloudformation wait stack-delete-complete \
     --stack-name home-inventory-prod \
     --region eu-west-1
   
   # Redeploy
   sam deploy --config-file samconfig-prod.toml --region eu-west-1
   ```

### S3 Data Recovery

S3 versioning provides protection against accidental deletion or corruption.

**Steps:**

1. **List Object Versions**
   ```bash
   aws s3api list-object-versions \
     --bucket home-inv-photos-prod \
     --prefix "path/to/affected/files/"
   ```

2. **Restore Previous Version**
   ```bash
   aws s3api copy-object \
     --copy-source "bucket/key?versionId=version-id" \
     --bucket home-inv-photos-prod \
     --key "path/to/file"
   ```

## Recovery Time Estimates

| Scenario | Assessment | Recovery | Validation | Total |
|----------|------------|----------|------------|-------|
| Data Corruption | 5 min | 30-60 min | 15 min | 50-80 min |
| Infrastructure Failure | 10 min | 1-2 hours | 30 min | 1.5-2.5 hours |
| Complete System Failure | 10 min | 4-6 hours | 30 min | 4.5-6.5 hours |

All scenarios are within the 8-hour RTO requirement.

## Communication Plan

### Internal Communication

1. **Immediate Notification** (Within 5 minutes)
   - Notify primary stakeholders
   - Create incident ticket/channel
   - Begin assessment

2. **Status Updates** (Every 30 minutes)
   - Progress updates to stakeholders
   - ETA adjustments if needed
   - Resource requirements

3. **Resolution Notification**
   - Service restoration announcement
   - Post-incident review scheduling

### User Communication

1. **Service Disruption Notice**
   - Acknowledge the issue
   - Provide estimated resolution time
   - Suggest workarounds if available

2. **Progress Updates**
   - Regular updates on recovery progress
   - Revised ETAs if needed

3. **Service Restoration**
   - Confirm service is restored
   - Apologize for inconvenience
   - Provide summary of resolution

## Post-Recovery Procedures

### Immediate Post-Recovery (Within 1 hour)

1. **Functionality Testing**
   ```bash
   # Test critical user workflows
   curl -X GET "${API_URL}/health"
   curl -X GET "${API_URL}/api/inventories" -H "Authorization: Bearer ${TOKEN}"
   ```

2. **Performance Monitoring**
   - Check CloudWatch metrics
   - Monitor error rates
   - Verify response times

3. **Data Integrity Verification**
   ```bash
   ./scripts/disaster-recovery.sh prod validate-data
   ```

### Short-term Post-Recovery (Within 24 hours)

1. **Comprehensive Testing**
   - Full application functionality test
   - User acceptance testing
   - Performance benchmarking

2. **Backup Verification**
   ```bash
   ./scripts/backup-production.sh prod backup
   ./scripts/backup-production.sh prod test
   ```

3. **Security Review**
   - Verify all security controls
   - Check access logs
   - Validate encryption settings

### Long-term Post-Recovery (Within 1 week)

1. **Post-Incident Review**
   - Document what happened
   - Identify root cause
   - Create improvement plan

2. **Process Improvements**
   - Update runbooks based on lessons learned
   - Improve monitoring and alerting
   - Enhance backup procedures

3. **Training Updates**
   - Update team training materials
   - Conduct recovery drill review
   - Share lessons learned

## Troubleshooting Common Issues

### Issue: Point-in-Time Recovery Not Available

**Symptoms:**
- PITR status shows "DISABLED"
- Cannot restore to specific timestamp

**Resolution:**
1. Check for available on-demand backups
2. Use most recent backup for restoration
3. Accept potential data loss beyond backup time

### Issue: CloudFormation Stack Stuck in UPDATE_ROLLBACK_FAILED

**Symptoms:**
- Stack cannot be updated or deleted
- Resources in inconsistent state

**Resolution:**
1. Continue rollback with skip resources:
   ```bash
   aws cloudformation continue-update-rollback \
     --stack-name home-inventory-prod \
     --resources-to-skip ResourceLogicalId
   ```

2. If unsuccessful, contact AWS Support

### Issue: S3 Bucket Access Denied

**Symptoms:**
- Cannot access S3 buckets
- Permission errors in logs

**Resolution:**
1. Check IAM policies and roles
2. Verify bucket policies
3. Check for bucket-level blocks

### Issue: API Gateway Not Responding

**Symptoms:**
- API endpoints return 5xx errors
- Gateway timeout errors

**Resolution:**
1. Check Lambda function logs
2. Verify API Gateway configuration
3. Check VPC connectivity if applicable

## Testing and Validation

### Recovery Testing Schedule

- **Monthly**: Data recovery test (non-production)
- **Quarterly**: Full disaster recovery drill
- **Annually**: Complete runbook review and update

### Validation Checklist

- [ ] All CloudFormation stacks deployed successfully
- [ ] DynamoDB table accessible and contains expected data
- [ ] S3 buckets accessible with proper permissions
- [ ] API Gateway responding to requests
- [ ] Lambda functions executing without errors
- [ ] CloudFront distribution serving content
- [ ] Application functionality verified
- [ ] User authentication working
- [ ] Data integrity confirmed
- [ ] Backup systems operational

## Appendix

### Useful Commands

```bash
# Quick health check
./scripts/disaster-recovery.sh prod assess

# Check all backups
./scripts/backup-production.sh prod list

# Validate current system
./scripts/disaster-recovery.sh prod validate-data

# Generate DR report
./scripts/disaster-recovery.sh prod report
```

### Log Locations

- **CloudFormation Events**: AWS Console > CloudFormation > Stack > Events
- **Lambda Logs**: CloudWatch Logs > /aws/lambda/function-name
- **API Gateway Logs**: CloudWatch Logs > API-Gateway-Execution-Logs
- **DynamoDB Metrics**: CloudWatch > DynamoDB metrics

### Emergency Procedures

If all automated recovery fails:

1. **Contact AWS Support** (if applicable)
2. **Manual resource recreation** using AWS Console
3. **Data export/import** using DynamoDB tools
4. **DNS failover** to maintenance page if available

### Recovery Metrics

Track these metrics for each recovery:

- **Detection Time**: Time from incident to detection
- **Response Time**: Time from detection to response start
- **Recovery Time**: Time from response start to service restoration
- **Data Loss**: Amount of data lost (should be < 1 hour)
- **User Impact**: Number of users affected

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d '+3 months' +%Y-%m-%d)