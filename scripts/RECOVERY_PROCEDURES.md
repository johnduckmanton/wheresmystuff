# Recovery Procedures Documentation

## Overview

This document provides detailed recovery procedures for the Home Inventory System, including recovery time objectives (RTO) and recovery point objectives (RPO). All procedures are designed to use cost-effective AWS built-in features.

## Recovery Objectives

- **Recovery Time Objective (RTO)**: 8 hours maximum
- **Recovery Point Objective (RPO)**: 1 hour maximum data loss acceptable

## Recovery Scenarios

### Scenario 1: Data Corruption or Loss

**Symptoms:**
- Application errors when accessing data
- Missing or corrupted records in DynamoDB
- User reports of lost data
- Inconsistent data states

**Recovery Procedure:**

1. **Immediate Assessment** (5-10 minutes)
   ```bash
   # Assess the situation
   ./scripts/disaster-recovery.sh prod assess
   
   # Validate current data integrity
   ./scripts/disaster-recovery.sh prod validate-data
   ```

2. **Determine Recovery Point** (5 minutes)
   - Identify when the corruption occurred
   - Choose recovery point (up to 1 hour data loss acceptable)
   - Verify point-in-time recovery availability

3. **Execute Data Recovery** (30-60 minutes)
   ```bash
   # List available recovery options
   ./scripts/rollback-production.sh prod list
   
   # Recover using point-in-time recovery (recommended)
   ./scripts/rollback-production.sh prod pitr "2024-01-15 10:30:00"
   
   # Alternative: Recover from specific backup
   ./scripts/rollback-production.sh prod backup "backup-name-20240115"
   ```

4. **Validate Recovery** (15-30 minutes)
   ```bash
   # Validate recovered data
   ./scripts/rollback-production.sh prod validate "recovered-table-name"
   
   # Test application functionality
   curl -X GET "${API_URL}/health"
   curl -X GET "${API_URL}/api/inventories" -H "Authorization: Bearer ${TOKEN}"
   ```

5. **Switch to Recovered Data** (15-30 minutes)
   - Update CloudFormation stack to use recovered table
   - Deploy updated configuration
   - Verify application functionality

**Total Estimated Time: 1-2.5 hours**

### Scenario 2: Infrastructure Failure

**Symptoms:**
- CloudFormation stack in failed state
- AWS resources not responding
- API Gateway returning 5xx errors
- Lambda functions not executing

**Recovery Procedure:**

1. **Immediate Assessment** (10-15 minutes)
   ```bash
   # Assess infrastructure status
   ./scripts/disaster-recovery.sh prod assess
   
   # Check CloudFormation stack status
   aws cloudformation describe-stacks \
     --stack-name home-inventory-prod \
     --region eu-west-1
   ```

2. **Attempt Resource Recovery** (1-2 hours)
   ```bash
   # Try to repair existing resources
   ./scripts/disaster-recovery.sh prod recover-resources
   
   # Alternative: Redeploy using SAM
   sam deploy --config-file samconfig-prod.toml --region eu-west-1
   ```

3. **If Resource Recovery Fails** (2-4 hours)
   ```bash
   # Full infrastructure rebuild
   ./scripts/disaster-recovery.sh prod full-recovery
   ```

4. **Validate Infrastructure** (30 minutes)
   ```bash
   # Validate complete recovery
   ./scripts/disaster-recovery.sh prod validate-recovery
   ```

**Total Estimated Time: 1.5-6.5 hours**

### Scenario 3: Complete System Failure

**Symptoms:**
- All services completely unavailable
- Multiple AWS resources affected
- CloudFormation stacks deleted or corrupted
- Data and infrastructure both compromised

**Recovery Procedure:**

1. **Emergency Assessment** (15 minutes)
   ```bash
   # Full system assessment
   ./scripts/disaster-recovery.sh prod assess
   
   # Generate disaster recovery report
   ./scripts/disaster-recovery.sh prod report
   ```

2. **Full System Recovery** (4-6 hours)
   ```bash
   # Complete system rebuild
   ./scripts/disaster-recovery.sh prod full-recovery
   ```

3. **Comprehensive Validation** (1 hour)
   ```bash
   # Validate all systems
   ./scripts/disaster-recovery.sh prod validate-recovery
   
   # Run backup validation
   ./scripts/backup-validation.sh prod full
   ```

**Total Estimated Time: 5-7 hours**

## Detailed Recovery Procedures

### DynamoDB Data Recovery

#### Point-in-Time Recovery (Recommended)

**When to Use:**
- Data corruption within the last 35 days
- Need to recover to a specific timestamp
- Continuous backup is enabled

**Procedure:**
1. **Check PITR Status**
   ```bash
   aws dynamodb describe-continuous-backups \
     --table-name home-inv-prod \
     --region eu-west-1
   ```

2. **Determine Recovery Point**
   - Default: 1 hour ago (meets RPO)
   - Custom: Specify exact timestamp if known
   - Format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SSZ"

3. **Execute Recovery**
   ```bash
   ./scripts/rollback-production.sh prod pitr "2024-01-15 10:30:00"
   ```

4. **Monitor Progress**
   - Recovery creates a new table
   - Wait for table to become ACTIVE
   - Typically takes 1-5 minutes per GB of data

5. **Validate and Switch**
   ```bash
   # Validate recovered data
   ./scripts/rollback-production.sh prod validate "new-table-name"
   
   # Update CloudFormation to use new table
   # (Manual step - update template or parameters)
   ```

**Estimated Time: 30-60 minutes**

#### On-Demand Backup Recovery

**When to Use:**
- PITR not available or insufficient
- Need to recover from a specific backup
- Backup was created at a known good state

**Procedure:**
1. **List Available Backups**
   ```bash
   ./scripts/rollback-production.sh prod list
   ```

2. **Select Backup**
   - Choose most recent backup before the issue
   - Note backup name and creation time

3. **Execute Recovery**
   ```bash
   ./scripts/rollback-production.sh prod backup "backup-name-20240115"
   ```

4. **Validate and Switch**
   - Same as PITR procedure above

**Estimated Time: 30-90 minutes**

### Infrastructure Recovery

#### CloudFormation Stack Recovery

**When to Use:**
- Stack in failed state
- Resources partially deployed
- Configuration drift detected

**Procedure:**
1. **Assess Stack Status**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name home-inventory-prod \
     --region eu-west-1
   ```

2. **Attempt Stack Update**
   ```bash
   sam deploy --config-file samconfig-prod.toml --region eu-west-1
   ```

3. **If Update Fails, Delete and Recreate**
   ```bash
   # Delete stack (data will be preserved if deletion protection is enabled)
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

**Estimated Time: 30-120 minutes**

#### Individual Resource Recovery

**Lambda Functions:**
```bash
# Redeploy specific function
sam deploy --config-file samconfig-prod.toml --region eu-west-1 --parameter-overrides UpdateLambdaOnly=true
```

**API Gateway:**
```bash
# Check API status
aws apigatewayv2 get-api --api-id ${API_ID} --region eu-west-1

# Redeploy if needed (part of stack update)
```

**S3 Buckets:**
```bash
# Check bucket status
aws s3api head-bucket --bucket home-inv-photos-prod

# Restore from versioning if needed
aws s3api list-object-versions --bucket home-inv-photos-prod
```

### S3 Data Recovery

#### Object Version Recovery

**When to Use:**
- Files accidentally deleted or corrupted
- Need to restore previous version of objects
- S3 versioning is enabled

**Procedure:**
1. **List Object Versions**
   ```bash
   aws s3api list-object-versions \
     --bucket home-inv-photos-prod \
     --prefix "path/to/affected/files/"
   ```

2. **Identify Correct Version**
   - Find version ID before corruption/deletion
   - Note the version timestamp

3. **Restore Object**
   ```bash
   aws s3api copy-object \
     --copy-source "home-inv-photos-prod/path/to/file?versionId=version-id" \
     --bucket home-inv-photos-prod \
     --key "path/to/file"
   ```

**Estimated Time: 5-30 minutes per object**

#### Bulk Object Recovery

**For Multiple Objects:**
```bash
# Create script to restore multiple objects
#!/bin/bash
BUCKET="home-inv-photos-prod"
PREFIX="affected/path/"

aws s3api list-object-versions \
  --bucket "$BUCKET" \
  --prefix "$PREFIX" \
  --query 'Versions[?IsLatest==`false`].[Key,VersionId,LastModified]' \
  --output text | while read key version_id timestamp; do
  
  echo "Restoring $key from $timestamp"
  aws s3api copy-object \
    --copy-source "$BUCKET/$key?versionId=$version_id" \
    --bucket "$BUCKET" \
    --key "$key"
done
```

## Recovery Time Estimates

### By Scenario

| Scenario | Assessment | Recovery | Validation | Total | Within RTO |
|----------|------------|----------|------------|-------|------------|
| Data Corruption | 5-10 min | 30-60 min | 15-30 min | 50-100 min | ✅ Yes |
| Infrastructure Failure | 10-15 min | 60-240 min | 30 min | 100-285 min | ✅ Yes |
| Complete System Failure | 15 min | 240-360 min | 60 min | 315-435 min | ✅ Yes |

### By Recovery Type

| Recovery Type | Typical Time | Maximum Time | Notes |
|---------------|--------------|--------------|-------|
| PITR (Small DB) | 30 min | 60 min | <1GB data |
| PITR (Large DB) | 60 min | 120 min | >1GB data |
| Backup Restore | 45 min | 90 min | Depends on backup size |
| Infrastructure | 30 min | 240 min | Simple to complex |
| Full System | 240 min | 420 min | Complete rebuild |

All estimates are within the 8-hour RTO requirement.

## Recovery Point Objectives (RPO)

### Data Loss Scenarios

| Backup Method | RPO | Data Loss | Notes |
|---------------|-----|-----------|-------|
| Point-in-Time Recovery | 1 second | Minimal | Continuous backup |
| On-Demand Backup | Variable | Up to backup age | Manual backups |
| S3 Versioning | 0 | None | Immediate versioning |

### RPO Compliance

- **Target RPO**: 1 hour maximum data loss
- **Actual RPO**: 
  - PITR: ~1 second (continuous)
  - Backups: Depends on backup frequency
  - S3: 0 seconds (immediate versioning)

## Validation Procedures

### Post-Recovery Validation Checklist

#### Infrastructure Validation
- [ ] CloudFormation stacks deployed successfully
- [ ] All AWS resources accessible
- [ ] API Gateway responding to requests
- [ ] Lambda functions executing without errors
- [ ] S3 buckets accessible with proper permissions
- [ ] CloudFront distribution serving content

#### Data Validation
- [ ] DynamoDB table accessible
- [ ] Expected number of items present
- [ ] Sample data integrity verified
- [ ] No data corruption detected
- [ ] All data types present (inventories, containers, users)

#### Application Validation
- [ ] User authentication working
- [ ] Core workflows functional
- [ ] API endpoints responding correctly
- [ ] Frontend application loading
- [ ] QR code generation/scanning working
- [ ] Photo upload/display working

#### Performance Validation
- [ ] Response times within acceptable limits
- [ ] No error rate spikes
- [ ] CloudWatch metrics normal
- [ ] No resource throttling

### Validation Commands

```bash
# Quick health check
curl -X GET "${API_URL}/health"

# Authentication test
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Data access test
curl -X GET "${API_URL}/api/inventories" \
  -H "Authorization: Bearer ${TOKEN}"

# Database connectivity test
aws dynamodb scan \
  --table-name home-inv-prod \
  --select COUNT \
  --region eu-west-1

# S3 access test
aws s3 ls s3://home-inv-photos-prod/ --region eu-west-1
```

## Monitoring and Alerting

### Recovery Monitoring

During recovery operations, monitor:

1. **CloudFormation Events**
   ```bash
   aws cloudformation describe-stack-events \
     --stack-name home-inventory-prod \
     --region eu-west-1
   ```

2. **DynamoDB Restore Progress**
   ```bash
   aws dynamodb describe-table \
     --table-name restored-table-name \
     --region eu-west-1
   ```

3. **CloudWatch Metrics**
   - Lambda execution metrics
   - API Gateway response times
   - DynamoDB read/write capacity
   - Error rates and counts

### Post-Recovery Monitoring

After recovery, monitor for 24-48 hours:

- Application error rates
- Performance metrics
- User activity patterns
- Data consistency
- Backup system functionality

## Communication During Recovery

### Internal Communication

1. **Immediate Notification** (Within 5 minutes)
   - Notify stakeholders of the incident
   - Provide initial assessment
   - Establish communication channel

2. **Regular Updates** (Every 30 minutes)
   - Progress updates
   - Revised time estimates
   - Any complications or delays

3. **Resolution Notification**
   - Confirm service restoration
   - Provide summary of actions taken
   - Schedule post-incident review

### User Communication

1. **Initial Notice**
   ```
   We are currently experiencing technical difficulties with our service. 
   Our team is working to resolve the issue. 
   Estimated resolution time: [X] hours.
   ```

2. **Progress Updates**
   ```
   Update: We are making progress on resolving the service issue. 
   Current status: [brief description]
   Revised estimate: [X] hours.
   ```

3. **Resolution Notice**
   ```
   Service has been restored. We apologize for any inconvenience. 
   All data has been preserved. 
   If you experience any issues, please contact support.
   ```

## Testing and Validation Schedule

### Regular Testing Schedule

- **Daily**: Automated backup validation
- **Weekly**: Recovery script functionality tests
- **Monthly**: Full backup validation suite
- **Quarterly**: Complete disaster recovery drill

### Testing Commands

```bash
# Daily automated validation
./scripts/backup-validation.sh prod integrity

# Weekly functionality test
./scripts/disaster-recovery-testing.sh prod backup
./scripts/disaster-recovery-testing.sh prod pitr

# Monthly full validation
./scripts/backup-validation.sh prod full

# Quarterly disaster recovery test
./scripts/disaster-recovery-testing.sh prod quarterly
```

## Troubleshooting Common Issues

### Issue: PITR Not Available

**Symptoms:**
- Point-in-time recovery shows "DISABLED"
- Cannot restore to specific timestamp

**Resolution:**
1. Enable PITR:
   ```bash
   aws dynamodb update-continuous-backups \
     --table-name home-inv-prod \
     --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
   ```
2. Wait 24 hours for full recovery window
3. Use on-demand backups as alternative

### Issue: CloudFormation Stack Stuck

**Symptoms:**
- Stack in UPDATE_ROLLBACK_FAILED state
- Cannot update or delete stack

**Resolution:**
1. Continue rollback:
   ```bash
   aws cloudformation continue-update-rollback \
     --stack-name home-inventory-prod
   ```
2. If unsuccessful, contact AWS Support
3. As last resort, manually delete resources

### Issue: High Recovery Time

**Symptoms:**
- Recovery taking longer than expected
- Approaching RTO limits

**Actions:**
1. Parallelize recovery operations where possible
2. Focus on critical path items first
3. Consider partial service restoration
4. Communicate delays to stakeholders

## Emergency Contacts

- **Primary On-Call**: [Your contact information]
- **Secondary On-Call**: [Backup contact]
- **AWS Support**: [Support case URL if applicable]
- **Stakeholder Notification**: [Distribution list]

## Post-Recovery Procedures

### Immediate (Within 1 hour)
- [ ] Verify all systems operational
- [ ] Confirm data integrity
- [ ] Test critical user workflows
- [ ] Monitor error rates and performance

### Short-term (Within 24 hours)
- [ ] Comprehensive system testing
- [ ] User acceptance validation
- [ ] Performance benchmarking
- [ ] Backup system verification

### Long-term (Within 1 week)
- [ ] Post-incident review
- [ ] Root cause analysis
- [ ] Process improvements
- [ ] Documentation updates
- [ ] Team training updates

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d '+3 months' +%Y-%m-%d)  
**RTO**: 8 hours  
**RPO**: 1 hour