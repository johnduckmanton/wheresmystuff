# Database Migration Procedures

This document provides comprehensive procedures for migrating data between environments in the Home Inventory System, with a focus on production deployment and data safety.

## Overview

The migration system provides several tools for safely moving data between development and production environments:

- **Automated Migration**: `migrate-to-prod.sh` - Full automated migration with validation
- **Manual Export/Import**: `export-data.sh` and `import-data.sh` - Granular control over data transfer
- **Backup/Recovery**: `backup-production.sh` and `rollback-production.sh` - Data protection and recovery
- **Validation**: `validate-data-integrity.sh` and `validate-schema.sh` - Data integrity checks

## Prerequisites

### Required Tools

```bash
# AWS CLI v2
aws --version

# jq for JSON processing
jq --version

# Proper AWS credentials configured
aws sts get-caller-identity
```

### Required Permissions

Your AWS credentials must have the following permissions:

- **DynamoDB**: Full access to source and target tables
- **CloudFormation**: Read access to stack outputs
- **Backup**: Create and restore DynamoDB backups
- **Point-in-Time Recovery**: Enable and use PITR

### Environment Setup

```bash
# Set AWS region
export AWS_REGION=eu-west-1

# Verify both environments exist
aws cloudformation describe-stacks --stack-name home-inventory-dev
aws cloudformation describe-stacks --stack-name home-inventory-prod
```

## Migration Scenarios

### Scenario 1: Initial Production Deployment

**Situation**: First-time deployment to production with existing development data.

**Procedure**:

1. **Prepare Production Environment**
   ```bash
   # Deploy production infrastructure
   sam deploy --config-file samconfig-prod.toml
   
   # Verify deployment
   aws cloudformation describe-stacks --stack-name home-inventory-prod
   ```

2. **Validate Schema Compatibility**
   ```bash
   # Export schemas for comparison
   ./scripts/migrate-to-prod.sh dev prod migrate
   # This will validate schemas as part of the process
   ```

3. **Perform Migration**
   ```bash
   # Dry run first
   DRY_RUN=true ./scripts/migrate-to-prod.sh dev prod migrate
   
   # If dry run passes, perform actual migration
   ./scripts/migrate-to-prod.sh dev prod migrate
   ```

4. **Validate Migration**
   ```bash
   # Validate data integrity
   ./scripts/validate-data-integrity.sh prod validate
   
   # Test application functionality
   # (Manual testing required)
   ```

### Scenario 2: Regular Production Updates

**Situation**: Updating production with new development data.

**Procedure**:

1. **Create Production Backup**
   ```bash
   ./scripts/backup-production.sh prod backup
   ```

2. **Export Development Data**
   ```bash
   ./scripts/export-data.sh dev ./dev-export-$(date +%Y%m%d) export
   ```

3. **Validate Export**
   ```bash
   ./scripts/export-data.sh dev ./dev-export-$(date +%Y%m%d) validate
   ```

4. **Import to Production**
   ```bash
   # Dry run
   DRY_RUN=true ./scripts/import-data.sh prod ./dev-export-$(date +%Y%m%d) import
   
   # Actual import
   ./scripts/import-data.sh prod ./dev-export-$(date +%Y%m%d) import
   ```

5. **Validate Production Data**
   ```bash
   ./scripts/validate-data-integrity.sh prod validate
   ```

### Scenario 3: Emergency Rollback

**Situation**: Production issues requiring immediate rollback.

**Procedure**:

1. **List Available Recovery Options**
   ```bash
   ./scripts/rollback-production.sh prod list
   ```

2. **Choose Recovery Method**

   **Option A: Point-in-Time Recovery**
   ```bash
   # Restore to specific timestamp
   ./scripts/rollback-production.sh prod pitr "2024-01-15 10:30:00"
   ```

   **Option B: Backup Recovery**
   ```bash
   # Restore from specific backup
   ./scripts/rollback-production.sh prod backup "backup-name-20240115"
   ```

3. **Validate Restored Data**
   ```bash
   ./scripts/rollback-production.sh prod validate "restored-table-name"
   ```

4. **Switch to Restored Table**
   ```bash
   # Follow manual guidance provided by the script
   ./scripts/rollback-production.sh prod switch-table "restored-table-name"
   ```

### Scenario 4: Data Synchronization

**Situation**: Keeping development and production data in sync.

**Procedure**:

1. **Export Production Data**
   ```bash
   ./scripts/export-data.sh prod ./prod-export-$(date +%Y%m%d) export
   ```

2. **Import to Development**
   ```bash
   ./scripts/import-data.sh dev ./prod-export-$(date +%Y%m%d) import
   ```

3. **Validate Synchronization**
   ```bash
   ./scripts/validate-data-integrity.sh dev validate
   ```

## Manual Procedures

### Manual Schema Migration

When automated schema validation fails, manual intervention may be required:

1. **Export Current Schemas**
   ```bash
   # Source schema
   aws dynamodb describe-table --table-name home-inv-dev \
     --query 'Table.{AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes}' \
     > source-schema.json
   
   # Target schema
   aws dynamodb describe-table --table-name home-inv-prod \
     --query 'Table.{AttributeDefinitions:AttributeDefinitions,KeySchema:KeySchema,GlobalSecondaryIndexes:GlobalSecondaryIndexes}' \
     > target-schema.json
   ```

2. **Compare Schemas**
   ```bash
   ./scripts/validate-schema.sh source-schema.json target-schema.json
   ```

3. **Update CloudFormation Template**
   - Modify `template.yaml` to match required schema
   - Deploy changes: `sam deploy --config-file samconfig-prod.toml`

4. **Retry Migration**
   ```bash
   ./scripts/migrate-to-prod.sh dev prod migrate
   ```

### Manual Data Repair

When data integrity validation fails:

1. **Identify Issues**
   ```bash
   ./scripts/validate-data-integrity.sh prod validate
   # Review the generated report
   ```

2. **Common Fixes**

   **Missing Inventory Memberships**:
   ```bash
   # Use the backend script to add missing memberships
   node backend/scripts/add-user-by-email.js user@example.com inventory-id admin-user-id
   ```

   **Orphaned Entities**:
   ```bash
   # Delete orphaned entities or reassign to valid inventory
   aws dynamodb delete-item --table-name home-inv-prod \
     --key '{"pk":{"S":"INVENTORY#invalid-id#THINGS"},"sk":{"S":"entity-id"}}'
   ```

   **Duplicate IDs**:
   ```bash
   # Generate new UUIDs for duplicates
   # This requires custom scripting based on specific duplicates found
   ```

3. **Re-validate**
   ```bash
   ./scripts/validate-data-integrity.sh prod validate
   ```

### Manual Backup Procedures

For additional backup safety:

1. **Create Multiple Backup Types**
   ```bash
   # On-demand backup
   aws dynamodb create-backup --table-name home-inv-prod \
     --backup-name "manual-backup-$(date +%Y%m%d-%H%M%S)"
   
   # Export to S3 (for large datasets)
   aws dynamodb export-table-to-point-in-time \
     --table-arn "arn:aws:dynamodb:region:account:table/home-inv-prod" \
     --s3-bucket "backup-bucket" \
     --s3-prefix "exports/$(date +%Y%m%d)/"
   ```

2. **Verify Backup Integrity**
   ```bash
   # List recent backups
   aws dynamodb list-backups --table-name home-inv-prod
   
   # Test restore (to temporary table)
   aws dynamodb restore-table-from-backup \
     --target-table-name "test-restore-$(date +%Y%m%d)" \
     --backup-arn "backup-arn"
   ```

## Troubleshooting

### Common Issues

**1. Schema Validation Failures**
```
Error: Key schema mismatch
```
**Solution**: Update CloudFormation template to match source schema, then redeploy.

**2. Permission Errors**
```
Error: User is not authorized to perform: dynamodb:CreateBackup
```
**Solution**: Add required IAM permissions or use a role with sufficient privileges.

**3. Throttling Issues**
```
Error: ProvisionedThroughputExceededException
```
**Solution**: Reduce batch size in scripts or temporarily increase table capacity.

**4. Data Integrity Failures**
```
Error: Found orphaned entities
```
**Solution**: Use manual data repair procedures to fix integrity issues.

### Recovery Procedures

**If Migration Fails Mid-Process**:

1. **Stop the migration** (Ctrl+C)
2. **Check what was migrated**:
   ```bash
   ./scripts/validate-data-integrity.sh prod validate
   ```
3. **Rollback if necessary**:
   ```bash
   ./scripts/rollback-production.sh prod backup "pre-migration-backup"
   ```
4. **Fix the issue** and retry

**If Production Becomes Unstable**:

1. **Immediate rollback**:
   ```bash
   ./scripts/rollback-production.sh prod pitr "timestamp-before-migration"
   ```
2. **Validate rollback**:
   ```bash
   ./scripts/validate-data-integrity.sh prod validate
   ```
3. **Investigate root cause** before retrying

## Best Practices

### Pre-Migration Checklist

- [ ] Production backup created
- [ ] Schema compatibility validated
- [ ] Dry run completed successfully
- [ ] Maintenance window scheduled
- [ ] Rollback plan prepared
- [ ] Team notified

### During Migration

- [ ] Monitor AWS CloudWatch for errors
- [ ] Keep terminal session active
- [ ] Document any issues encountered
- [ ] Validate each major step

### Post-Migration

- [ ] Data integrity validation passed
- [ ] Application functionality tested
- [ ] Performance metrics normal
- [ ] Backup retention configured
- [ ] Documentation updated

### Security Considerations

- **Credentials**: Use IAM roles instead of access keys when possible
- **Encryption**: Ensure data is encrypted in transit and at rest
- **Audit**: All migration activities are logged in CloudTrail
- **Access**: Limit migration permissions to authorized personnel only

## Monitoring and Alerting

### CloudWatch Metrics to Monitor

- DynamoDB read/write capacity utilization
- Lambda function errors and duration
- API Gateway 4xx/5xx errors
- Application-specific metrics

### Setting Up Alerts

```bash
# Create CloudWatch alarm for high error rates
aws cloudwatch put-metric-alarm \
  --alarm-name "HighErrorRate-Production" \
  --alarm-description "High error rate in production" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2
```

## Cost Optimization

### Backup Retention

- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months
- Use lifecycle policies for S3 exports

### Resource Management

- Use on-demand billing for DynamoDB
- Implement S3 lifecycle policies
- Monitor and optimize Lambda memory allocation
- Use CloudFront caching to reduce API calls

## Compliance and Audit

### Audit Trail

All migration activities are automatically logged:

- CloudTrail logs all AWS API calls
- Migration scripts log all operations
- Backup creation and restoration events
- Data validation results

### Compliance Requirements

- **Data Retention**: Follow organizational data retention policies
- **Change Management**: Document all production changes
- **Access Control**: Maintain principle of least privilege
- **Disaster Recovery**: Test recovery procedures quarterly

## Support and Escalation

### Internal Escalation

1. **Level 1**: Development team member
2. **Level 2**: Senior developer or DevOps engineer
3. **Level 3**: System architect or CTO

### External Support

- AWS Support (if applicable)
- Community forums for open-source tools
- Professional services for complex migrations

### Emergency Contacts

Maintain an updated list of emergency contacts for:
- On-call engineers
- AWS account administrators
- Business stakeholders
- External vendors (if applicable)

---

**Document Version**: 1.0  
**Last Updated**: $(date)  
**Next Review**: $(date -d '+3 months')