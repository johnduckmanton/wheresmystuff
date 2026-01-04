# DNS Setup Guide for wheresmystuff.johnduckmanton.co.uk

This guide explains exactly how to add DNS records for your SSL certificate validation and final domain setup.

## Overview

You'll need to add **two different DNS records** at different times:

1. **Certificate Validation Record** (CNAME) - for SSL certificate validation
2. **Final Domain Record** (CNAME) - to point your subdomain to CloudFront

## Step 1: Certificate Validation DNS Record

### What You'll Get from the Script

When you run:
```bash
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk
```

You'll see output like this:
```
📋 DNS Validation Records:
==========================

Domain: wheresmystuff.johnduckmanton.co.uk
Record Type: CNAME
Record Name: _1a2b3c4d5e6f7g8h.wheresmystuff.johnduckmanton.co.uk
Record Value: _9z8y7x6w5v4u3t2s.acm-validations.aws.
Status: PENDING_VALIDATION
```

### How to Add This Record

The **Record Name** is the tricky part. You need to:

1. **Take the full Record Name**: `_1a2b3c4d5e6f7g8h.wheresmystuff.johnduckmanton.co.uk`
2. **Remove your domain from the end**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
3. **Use this shortened version** in your DNS provider

## DNS Provider Instructions

### If You Don't Know Your DNS Provider

Check who manages your DNS:
```bash
# Find your DNS provider
dig NS johnduckmanton.co.uk

# Or use online tools
# Visit: https://www.whatsmydns.net/#NS/johnduckmanton.co.uk
```

Common results:
- `ns1.123-reg.co.uk` = 123-reg
- `dns1.namecheap.com` = Namecheap  
- `ns1.godaddy.com` = GoDaddy
- `cloudflare.com` = Cloudflare
- `awsdns-` = Route 53

### 123-reg (Popular UK Provider)

1. **Log in** to your 123-reg account
2. **Go to** "Manage Domains" → Select `johnduckmanton.co.uk`
3. **Click** "Manage DNS"
4. **Click** "Add DNS Record"
5. **Fill in**:
   - **Type**: CNAME
   - **Hostname**: `_1a2b3c4d5e6f7g8h.wheresmystuff` (your actual validation string)
   - **Destination**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.` (your actual validation target)
   - **TTL**: 300 (5 minutes)
6. **Click** "Add Record"

### Namecheap

1. **Log in** to Namecheap
2. **Go to** Domain List → Manage `johnduckmanton.co.uk`
3. **Click** "Advanced DNS" tab
4. **Click** "Add New Record"
5. **Fill in**:
   - **Type**: CNAME Record
   - **Host**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
   - **Value**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.`
   - **TTL**: Automatic
6. **Click** "Save All Changes"

### GoDaddy

1. **Log in** to GoDaddy
2. **Go to** "My Products" → DNS for `johnduckmanton.co.uk`
3. **Click** "Add" button
4. **Fill in**:
   - **Type**: CNAME
   - **Name**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
   - **Value**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.`
   - **TTL**: 1 Hour
5. **Click** "Save"

### Cloudflare

1. **Log in** to Cloudflare
2. **Select** `johnduckmanton.co.uk` domain
3. **Go to** DNS → Records
4. **Click** "Add record"
5. **Fill in**:
   - **Type**: CNAME
   - **Name**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
   - **Target**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.`
   - **Proxy status**: DNS only (gray cloud)
   - **TTL**: Auto
6. **Click** "Save"

### LCN.com

1. **Log in** to your LCN account at https://www.lcn.com/
2. **Go to** "My Account" → "Domain Management"
3. **Find** `johnduckmanton.co.uk` and click "Manage"
4. **Click** "DNS Management" or "DNS Zone Editor"
5. **Click** "Add Record" or "Add New Record"
6. **Fill in**:
   - **Type**: CNAME
   - **Name/Host**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
   - **Target/Value**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.`
   - **TTL**: 300 (or leave default)
7. **Click** "Add Record" or "Save"

### AWS Route 53

1. **Go to** Route 53 Console
2. **Click** "Hosted zones"
3. **Select** `johnduckmanton.co.uk`
4. **Click** "Create record"
5. **Fill in**:
   - **Record name**: `_1a2b3c4d5e6f7g8h.wheresmystuff`
   - **Record type**: CNAME
   - **Value**: `_9z8y7x6w5v4u3t2s.acm-validations.aws.`
   - **TTL**: 300
6. **Click** "Create records"

## Step 2: Verify Certificate Validation

After adding the DNS record, wait 5-30 minutes and check:

```bash
# Check if DNS record is working
dig _1a2b3c4d5e6f7g8h.wheresmystuff.johnduckmanton.co.uk CNAME

# Check certificate status
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk --check-status
```

## Step 3: Final Domain DNS Record (After Deployment)

Once your certificate is **ISSUED** and you've deployed to production, you'll get a CloudFront URL like:
```
https://d1234567890.cloudfront.net
```

### Add the Final CNAME Record

Using the same DNS provider interface:

**For the subdomain record:**
- **Type**: CNAME
- **Name/Host**: `wheresmystuff`
- **Value/Target**: `d1234567890.cloudfront.net` (without https://)
- **TTL**: 300 (5 minutes)

### Provider-Specific Instructions

**123-reg:**
- Hostname: `wheresmystuff`
- Destination: `d1234567890.cloudfront.net`

**Namecheap:**
- Host: `wheresmystuff`
- Value: `d1234567890.cloudfront.net`

**GoDaddy:**
- Name: `wheresmystuff`
- Value: `d1234567890.cloudfront.net`

**Cloudflare:**
- Name: `wheresmystuff`
- Target: `d1234567890.cloudfront.net`
- Proxy status: DNS only (gray cloud) initially, can enable proxy later

**Route 53:**
- Record name: `wheresmystuff`
- Value: `d1234567890.cloudfront.net`

## Common Issues and Solutions

### Issue 1: "Record Name Too Long"

Some DNS providers have character limits. If you get this error:

1. **Check the exact format** your provider expects
2. **Try without the domain suffix** (most providers auto-add it)
3. **Contact your DNS provider** if the validation string is genuinely too long

### Issue 2: "Invalid Characters"

The validation strings contain underscores and long random strings:
- **This is normal** - AWS generates these
- **Don't modify the strings** - use them exactly as provided
- **Some providers** may show warnings but will accept them

### Issue 3: "DNS Not Propagating"

```bash
# Check DNS propagation from different servers
dig @8.8.8.8 _validation-string.wheresmystuff.johnduckmanton.co.uk CNAME
dig @1.1.1.1 _validation-string.wheresmystuff.johnduckmanton.co.uk CNAME

# Check from multiple locations
# Visit: https://www.whatsmydns.net/#CNAME/_validation-string.wheresmystuff.johnduckmanton.co.uk
```

### Issue 4: "Certificate Still Pending"

- **Wait longer**: DNS can take up to 30 minutes
- **Check the record**: Ensure it's exactly as AWS provided
- **Try deleting and re-adding** the DNS record
- **Check for typos** in the validation strings

## Verification Commands

### Check DNS Record is Live
```bash
# Replace with your actual validation string
dig _1a2b3c4d5e6f7g8h.wheresmystuff.johnduckmanton.co.uk CNAME
```

### Check Certificate Status
```bash
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk --check-status
```

### Check Final Domain (After Deployment)
```bash
# Test the final domain
curl -I https://wheresmystuff.johnduckmanton.co.uk
```

## Timeline

1. **Add validation record**: 2-5 minutes
2. **DNS propagation**: 5-30 minutes  
3. **Certificate issued**: 1-5 minutes after DNS validates
4. **Deploy to production**: 10-15 minutes
5. **Add final CNAME**: 2-5 minutes
6. **Final DNS propagation**: 5-30 minutes

**Total time**: Usually 30-60 minutes from start to finish.

## Need Help?

If you're stuck:

1. **Tell me your DNS provider** and I can give specific instructions
2. **Share the exact validation strings** (they're not sensitive)
3. **Check your DNS provider's documentation** for CNAME record format
4. **Try the DNS propagation checker**: https://www.whatsmydns.net/

## Example Complete Flow

```bash
# 1. Request certificate
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk

# 2. Add DNS validation record (shown in output)
# ... add to your DNS provider ...

# 3. Wait and check
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk --check-status

# 4. Deploy to production (once certificate is ISSUED)
# ... GitHub Actions deployment ...

# 5. Add final CNAME record
# wheresmystuff → d1234567890.cloudfront.net

# 6. Test
curl -I https://wheresmystuff.johnduckmanton.co.uk
```

Your final result: **https://wheresmystuff.johnduckmanton.co.uk** 🎉