# Security Infrastructure Setup Guide

This guide covers the deployment of HTTPS and AWS WAF security enhancements for the Home Inventory Management System.

## Overview

The security infrastructure includes:
- **CloudFront Distribution**: CDN with HTTPS enforcement and HTTP to HTTPS redirect
- **AWS WAF**: Web Application Firewall with managed rules for OWASP Top 10 protection
- **AWS Shield Standard**: Automatic DDoS protection (included with CloudFront)
- **Security Headers**: Comprehensive security headers via CloudFront response headers policy
- **TLS 1.2+**: Strong encryption for all communications

## Architecture

```
Internet → CloudFront (HTTPS) → AWS WAF → API Gateway → Lambda Functions
                ↓
         AWS Shield Standard
```

## Prerequisites

### 1. AWS Account Setup
- AWS CLI configured with appropriate credentials
- SAM CLI installed (`pip install aws-sam-cli`)
- Sufficient permissions to create CloudFront, WAF, and related resources

### 2. Custom Domain (Optional)
If you want to use a custom domain:
- Domain registered (can be in Route 53 or external registrar)
- ACM certificate created **in us-east-1 region** (required for CloudFront)
- DNS access to create CNAME or ALIAS records

## Deployment Steps

### Option 1: Deploy with Default CloudFront Domain

This is the simplest option - CloudFront will provide a domain like `d1234567890.cloudfront.net`:

```bash
# Build the application
sam build

# Deploy with WAF enabled (default)
sam deploy \
  --guided \
  --parameter-overrides \
    Environment=prod \
    EnableWAF=true

# Follow the prompts and accept defaults
```

### Option 2: Deploy with Custom Domain

#### Step 1: Create ACM Certificate (if not already created)

**IMPORTANT**: The certificate MUST be in the `us-east-1` region for CloudFront.

```bash
# Switch to us-east-1 region
aws acm request-certificate \
  --domain-name inventory.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Note the CertificateArn from the output
```

Validate the certificate by adding the DNS records provided by ACM.

#### Step 2: Deploy with Custom Domain

```bash
# Build the application
sam build

# Deploy with custom domain and ACM certificate
sam deploy \
  --guided \
  --parameter-overrides \
    Environment=prod \
    EnableWAF=true \
    CustomDomainName=inventory.yourdomain.com \
    ACMCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/abc-123

# Follow the prompts
```

#### Step 3: Configure DNS

After deployment, get the CloudFront domain name:

```bash
aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text
```

Create a CNAME record in your DNS:
- **Type**: CNAME
- **Name**: inventory.yourdomain.com
- **Value**: d1234567890.cloudfront.net (from above command)
- **TTL**: 300

If using Route 53, you can create an ALIAS record instead:
```bash
# Get the CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

# Create Route 53 ALIAS record (replace HOSTED_ZONE_ID)
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "inventory.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234567890.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Option 3: Deploy without WAF (Not Recommended for Production)

```bash
sam build

sam deploy \
  --guided \
  --parameter-overrides \
    Environment=dev \
    EnableWAF=false
```

## Verification

### 1. Verify HTTPS Enforcement

Test that HTTP redirects to HTTPS:

```bash
# Should return 301 or 302 redirect to HTTPS
curl -I http://d1234567890.cloudfront.net

# Should return 200 OK
curl -I https://d1234567890.cloudfront.net
```

### 2. Verify Security Headers

Check that security headers are present:

```bash
curl -I https://d1234567890.cloudfront.net

# Should see headers like:
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-content-type-options: nosniff
# x-frame-options: DENY
# x-xss-protection: 1; mode=block
# content-security-policy: default-src 'self'; ...
```

### 3. Verify WAF Protection

Test that WAF blocks malicious requests:

```bash
# Test SQL injection (should be blocked with 403)
curl -I "https://d1234567890.cloudfront.net/things?id=1' OR '1'='1"

# Test XSS (should be blocked with 403)
curl -I "https://d1234567890.cloudfront.net/things?name=<script>alert('xss')</script>"
```

### 4. Verify TLS Configuration

Check TLS version and cipher suites:

```bash
# Should show TLSv1.2 or TLSv1.3
openssl s_client -connect d1234567890.cloudfront.net:443 -tls1_2

# Should fail (TLS 1.0 and 1.1 are disabled)
openssl s_client -connect d1234567890.cloudfront.net:443 -tls1
```

## Monitoring and Logging

### CloudWatch Metrics

Monitor WAF activity:

```bash
# View WAF metrics in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=Rule,Value=ALL Name=WebACL,Value=home-inventory-waf-prod \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### CloudFront Logs

CloudFront access logs are stored in the S3 bucket:
- Bucket: `home-inventory-cloudfront-logs-{AccountId}-{Environment}`
- Prefix: `cloudfront-logs/`
- Retention: 90 days (automatic deletion)

Query logs:
```bash
aws s3 ls s3://home-inventory-cloudfront-logs-123456789012-prod/cloudfront-logs/
```

### WAF Logs (Optional)

To enable WAF logging to S3 or CloudWatch Logs:

```bash
# Create S3 bucket for WAF logs
aws s3 mb s3://aws-waf-logs-home-inventory-123456789012

# Enable WAF logging
aws wafv2 put-logging-configuration \
  --logging-configuration \
    ResourceArn=arn:aws:wafv2:us-east-1:123456789012:global/webacl/home-inventory-waf-prod/abc-123,\
    LogDestinationConfigs=arn:aws:s3:::aws-waf-logs-home-inventory-123456789012
```

## Cost Considerations

### CloudFront
- **Data Transfer**: $0.085/GB for first 10 TB/month (US/Europe)
- **Requests**: $0.0075 per 10,000 HTTPS requests
- **Estimated**: ~$10-50/month for small to medium traffic

### AWS WAF
- **WebACL**: $5.00/month
- **Rules**: $1.00/month per rule (2 managed rule groups = $2/month)
- **Requests**: $0.60 per 1 million requests
- **Estimated**: ~$7-15/month for small to medium traffic

### AWS Shield Standard
- **Free** with CloudFront (automatic DDoS protection)

### Total Estimated Cost
- **Small traffic** (< 100GB, < 1M requests): ~$20-30/month
- **Medium traffic** (100-500GB, 1-5M requests): ~$50-100/month

## Troubleshooting

### CloudFront Distribution Not Working

1. Check distribution status:
```bash
aws cloudfront get-distribution --id E1234567890ABC
```

2. Wait for distribution to deploy (can take 15-30 minutes)

3. Check origin configuration - ensure API Gateway endpoint is correct

### WAF Blocking Legitimate Requests

1. Check WAF logs to identify which rule is blocking:
```bash
aws wafv2 list-logging-configurations --scope CLOUDFRONT
```

2. Temporarily disable specific rules to test:
   - Edit the SAM template
   - Change `None: {}` to `Count: {}` in the rule's OverrideAction
   - Redeploy

3. Add exceptions for specific IP addresses or patterns if needed

### Custom Domain Not Working

1. Verify ACM certificate is in us-east-1:
```bash
aws acm list-certificates --region us-east-1
```

2. Check certificate status (must be "ISSUED"):
```bash
aws acm describe-certificate --certificate-arn YOUR_CERT_ARN --region us-east-1
```

3. Verify DNS CNAME record is correct:
```bash
dig inventory.yourdomain.com
```

4. Wait for DNS propagation (can take up to 48 hours)

### CORS Errors

If you see CORS errors in the browser:

1. Verify the CloudFront URL is used in frontend configuration
2. Check that API Gateway CORS is configured correctly
3. Ensure S3 bucket CORS allows the CloudFront domain

## Security Best Practices

### 1. Regular Updates
- Review WAF logs weekly for blocked attacks
- Update managed rule groups when AWS releases new versions
- Monitor AWS Security Bulletins

### 2. Certificate Management
- Set up ACM certificate renewal reminders (auto-renews if DNS validated)
- Monitor certificate expiration in CloudWatch

### 3. Access Control
- Restrict CloudFormation stack modification permissions
- Use IAM roles with least privilege
- Enable CloudTrail for audit logging

### 4. Monitoring
- Set up CloudWatch alarms for:
  - High WAF block rate
  - CloudFront 4xx/5xx error rates
  - Unusual traffic patterns
- Review CloudFront and WAF logs regularly

### 5. Incident Response
- Document incident response procedures
- Test WAF rule changes in non-production first
- Keep rollback procedures ready

## Next Steps

After deploying the infrastructure:

1. **Update Frontend Configuration**: Update the frontend to use the CloudFront URL
2. **Test All Endpoints**: Verify all API endpoints work through CloudFront
3. **Enable Additional Security**: Implement rate limiting, audit logging, and input validation (subsequent tasks)
4. **Set Up Monitoring**: Configure CloudWatch alarms and dashboards
5. **Document URLs**: Update documentation with the new CloudFront URL

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Shield Documentation](https://docs.aws.amazon.com/shield/)
- [ACM Certificate Documentation](https://docs.aws.amazon.com/acm/)
- [CloudFront Security Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/security-best-practices.html)
