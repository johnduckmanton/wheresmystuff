# DynamoDB Backup Strategy

## Overview
The production environment uses a multi-layered backup approach for maximum data protection at minimal cost.

## Backup Methods

### 1. Point-in-Time Recovery (PITR)
- **Status**: Enabled in production
- **Coverage**: Continuous backups for 35 days
- **Cost**: ~$0.20 per GB-month (based on table size)
- **Use case**: Quick recovery from accidental deletes or updates
- **Recovery**: Can restore to any point in time within the last 35 days

### 2. AWS Backup (Daily Scheduled)
- **Status**: Configured for production
- **Schedule**: Daily at 2 AM UTC
- **Retention**: 30 days
- **Cold Storage**: Moves to cold storage after 7 days
- **Cost**: 
  - Warm storage: $0.05 per GB-month (first 7 days)
  - Cold storage: $0.01 per GB-month (days 8-30)
  - Restore: $0.02 per GB (warm), $0.10 per GB (cold)
- **Use case**: Long-term retention, compliance, disaster recovery

## Cost Estimation

For a 1 GB DynamoDB table:
- **PITR**: ~$0.20/month
- **AWS Backup**:
  - 7 days warm: 7 backups × 1 GB × $0.05 = $0.35/month
  - 23 days cold: 23 backups × 1 GB × $0.01 = $0.23/month
  - **Total**: ~$0.58/month

**Combined total**: ~$0.78/month for comprehensive backup coverage

## Deployment

Deploy the backup configuration:

```bash
# Production deployment
sam build
sam deploy --config-env prod
```

## Verify Backups

Check backup status:

```bash
# List backup vaults
aws backup list-backup-vaults --region eu-west-1

# List backups in vault
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name home-inv-backup-vault-prod \
  --region eu-west-1

# Check PITR status
aws dynamodb describe-continuous-backups \
  --table-name home-inv-prod \
  --region eu-west-1
```

## Restore from Backup

### Restore from PITR:
```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name home-inv-prod \
  --target-table-name home-inv-prod-restored \
  --restore-date-time "2026-02-22T12:00:00Z" \
  --region eu-west-1
```

### Restore from AWS Backup:
```bash
# List recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name home-inv-backup-vault-prod \
  --region eu-west-1

# Restore (use recovery point ARN from above)
aws backup start-restore-job \
  --recovery-point-arn <RECOVERY_POINT_ARN> \
  --iam-role-arn <BACKUP_ROLE_ARN> \
  --metadata '{"targetTableName":"home-inv-prod-restored"}' \
  --region eu-west-1
```

## Cost Optimization Tips

1. **Adjust retention**: Reduce from 30 to 7 days if long-term retention isn't needed
2. **Cold storage**: Already configured to move backups after 7 days
3. **PITR**: Consider disabling if AWS Backup is sufficient (saves ~$0.20/month)
4. **Monitor size**: Regularly check table size to estimate costs

## Monitoring

The backup configuration includes:
- Automatic daily backups at 2 AM UTC
- 60-minute start window
- 120-minute completion window
- Automatic lifecycle management (warm → cold storage)

## Best Practices

1. **Test restores**: Periodically test backup restoration to verify integrity
2. **Monitor costs**: Use AWS Cost Explorer to track backup costs
3. **Tag resources**: All backups are tagged with Environment and Purpose
4. **Document procedures**: Keep this document updated with any changes
5. **Verify success**: Check AWS Backup console for successful backup jobs

## Backup Selection

The backup plan automatically selects resources based on:
- Resource type: DynamoDB tables
- Tag: `Environment=prod`
- Specific resource: `home-inv-prod` table

## Troubleshooting

### Backup fails
- Check IAM role permissions
- Verify table exists and is ACTIVE
- Check CloudWatch Logs for backup service

### High costs
- Review retention period (reduce if possible)
- Verify cold storage transition is working
- Check for duplicate backup plans

### Restore fails
- Ensure target table name doesn't exist
- Verify IAM role has restore permissions
- Check recovery point is available (not expired)
