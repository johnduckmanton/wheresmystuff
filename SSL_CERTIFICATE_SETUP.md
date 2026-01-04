# SSL Certificate Setup Guide

This guide walks you through setting up an SSL certificate for your custom domain with AWS Certificate Manager (ACM) for use with CloudFront.

## Prerequisites

1. **Domain Ownership**: You must own the domain you want to create a certificate for
2. **DNS Access**: You need access to modify DNS records for your domain
3. **AWS CLI**: Configured with appropriate permissions
4. **jq**: JSON parsing tool (install with `brew install jq` on macOS)

## Quick Start

### Step 1: Request Certificate

Replace `yourdomain.com` with your actual domain:

```bash
# Basic certificate for single domain
./scripts/setup-ssl-certificate.sh --domain yourdomain.com

# Include www subdomain
./scripts/setup-ssl-certificate.sh --domain yourdomain.com --include-www
```

### Step 2: Add DNS Records

The script will output DNS validation records like this:

```
📋 DNS Validation Records:
==========================

Domain: yourdomain.com
Record Type: CNAME
Record Name: _abc123def456.yourdomain.com
Record Value: _xyz789abc123.acm-validations.aws.
Status: PENDING_VALIDATION
```

**Add these records to your DNS provider:**

#### For Popular DNS Providers:

**Cloudflare:**
1. Go to DNS → Records
2. Click "Add record"
3. Type: CNAME
4. Name: `_abc123def456` (remove your domain from the end)
5. Target: `_xyz789abc123.acm-validations.aws.`
6. TTL: Auto

**GoDaddy:**
1. Go to DNS Management
2. Add Record → CNAME
3. Host: `_abc123def456`
4. Points to: `_xyz789abc123.acm-validations.aws.`
5. TTL: 1 Hour

**Namecheap:**
1. Go to Advanced DNS
2. Add New Record → CNAME
3. Host: `_abc123def456`
4. Value: `_xyz789abc123.acm-validations.aws.`
5. TTL: Automatic

### Step 3: Wait and Verify

```bash
# Check certificate status (run every few minutes)
./scripts/setup-ssl-certificate.sh --domain yourdomain.com --check-status
```

## Detailed Commands

### Check Existing Certificates

```bash
./scripts/setup-ssl-certificate.sh --domain yourdomain.com --check-existing
```

### Get DNS Validation Records

```bash
./scripts/setup-ssl-certificate.sh --domain yourdomain.com --get-dns-records
```

### Check Validation Status

```bash
./scripts/setup-ssl-certificate.sh --domain yourdomain.com --check-status
```

## Manual AWS CLI Commands

If you prefer using AWS CLI directly:

### Request Certificate

```bash
# Single domain
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# With www subdomain
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### List Certificates

```bash
aws acm list-certificates --region us-east-1
```

### Get Certificate Details

```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID \
  --region us-east-1
```

## Troubleshooting

### Common Issues

**1. Certificate Not Found**
- Make sure you're using the correct region (us-east-1)
- Check that the domain name is spelled correctly

**2. DNS Validation Stuck**
- Verify DNS records are added correctly
- Check DNS propagation: `dig _validation-record.yourdomain.com`
- Wait up to 30 minutes for DNS propagation

**3. Permission Errors**
- Ensure your AWS credentials have ACM permissions
- Required permissions: `acm:RequestCertificate`, `acm:DescribeCertificate`, `acm:ListCertificates`

**4. Domain Validation Failed**
- Ensure you own the domain
- Check that DNS records are publicly resolvable
- Remove any conflicting DNS records

### DNS Propagation Check

```bash
# Check if DNS record is propagated
dig _abc123def456.yourdomain.com CNAME

# Check from different DNS servers
nslookup _abc123def456.yourdomain.com 8.8.8.8
nslookup _abc123def456.yourdomain.com 1.1.1.1
```

### Certificate Status Meanings

- **PENDING_VALIDATION**: Waiting for DNS validation
- **ISSUED**: Certificate is ready to use
- **INACTIVE**: Certificate has expired or been revoked
- **EXPIRED**: Certificate has expired
- **VALIDATION_TIMED_OUT**: DNS validation took too long

## Next Steps

Once your certificate is **ISSUED**:

1. **Copy the Certificate ARN** (looks like `arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012`)

2. **Update your deployment configuration** with the certificate ARN

3. **Deploy to production** with custom domain support

## Security Best Practices

- **Use DNS Validation**: More secure than email validation
- **Include www Subdomain**: Covers both `yourdomain.com` and `www.yourdomain.com`
- **Monitor Expiration**: ACM auto-renews, but monitor for issues
- **Use Strong DNS Security**: Enable DNSSEC if your provider supports it

## Cost Information

- **ACM Certificates**: Free for use with AWS services
- **DNS Queries**: Minimal cost from your DNS provider
- **CloudFront**: No additional cost for custom domains

## Support

If you encounter issues:

1. Check AWS Certificate Manager console
2. Review CloudTrail logs for API errors
3. Contact your DNS provider for DNS-related issues
4. Check AWS Service Health Dashboard

## Example Complete Flow

```bash
# 1. Request certificate
./scripts/setup-ssl-certificate.sh --domain example.com --include-www

# 2. Add DNS records (shown in output)
# ... add records to your DNS provider ...

# 3. Wait and check status
./scripts/setup-ssl-certificate.sh --domain example.com --check-status

# 4. Once ISSUED, copy the ARN and update your deployment
```

The certificate ARN will look like:
```
arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

Use this ARN in your production deployment configuration.