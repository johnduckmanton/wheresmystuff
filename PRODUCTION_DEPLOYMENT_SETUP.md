# Production Deployment Setup Guide

## Overview

This guide explains how to complete the production deployment setup after applying all the CI/CD fixes. Your SSL certificate is ready, and the production workflow has been updated with all the fixes from the dev pipeline.

## GitHub Repository Variables Setup

You need to configure these variables in your GitHub repository settings:

### Required Variables

1. **CUSTOM_DOMAIN_NAME**
   - Value: `wheresmystuff.johnduckmanton.co.uk`
   - Used by: CloudFront template and backend CORS configuration

2. **ACM_CERTIFICATE_ARN**
   - Value: Your SSL certificate ARN (from AWS Certificate Manager)
   - Format: `arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID`
   - Used by: CloudFront template for custom domain SSL

3. **PROD_ROLE_ARN**
   - Value: Your production deployment IAM role ARN
   - Format: `arn:aws:iam::ACCOUNT_ID:role/GitHubActions-Production-Role`
   - Used by: GitHub Actions OIDC authentication

4. **AWS_REGION**
   - Value: `eu-west-1`
   - Used by: All AWS operations

### How to Add Variables

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **Variables** tab
4. Click **New repository variable**
5. Add each variable with its name and value

## Getting Your Certificate ARN

Since you mentioned your certificate is issued, you can get the ARN using:

```bash
# Check certificate status and get ARN
./scripts/setup-ssl-certificate.sh --domain wheresmystuff.johnduckmanton.co.uk --check-status
```

The output will show your certificate ARN that you need to add to GitHub variables.

## Production Deployment Process

Once variables are configured:

1. **Trigger Production Deployment**
   ```
   Go to GitHub Actions → "Deploy to Production" → Run workflow
   ```

2. **Monitor Deployment**
   - Backend deployment (~10-15 minutes)
   - Frontend deployment (~5-10 minutes)
   - CORS configuration update (~2-3 minutes)
   - Smoke tests (~2-3 minutes)

3. **Add Final DNS Record**
   After successful deployment, you'll get a CloudFront URL. Add this CNAME record:
   ```
   Type: CNAME
   Name: wheresmystuff
   Value: [CloudFront-URL-from-deployment] (without https://)
   TTL: 300
   ```

## Applied Fixes Summary

The production workflow now includes all fixes from the dev pipeline:

✅ **SAM Build Path Fix** - Builds from root directory instead of backend/
✅ **Template Validation** - Validates CloudFormation templates before deployment
✅ **Database Migrations** - Runs migration scripts with proper error handling
✅ **Frontend Configuration** - Rebuilds frontend with actual deployment values
✅ **CORS Configuration** - Updates backend CORS with CloudFront URL
✅ **Error Handling** - Enhanced error reporting and debugging
✅ **Custom Domain Support** - Integrated SSL certificate and domain configuration

## Expected Timeline

- **Setup GitHub variables**: 5 minutes
- **Production deployment**: 20-30 minutes
- **DNS propagation**: 5-30 minutes
- **Total**: 30-60 minutes

## Verification Steps

After deployment:

1. **API Health Check**
   ```bash
   curl https://[api-url]/health
   ```

2. **Frontend Access**
   ```bash
   curl -I https://wheresmystuff.johnduckmanton.co.uk
   ```

3. **CORS Verification**
   ```bash
   curl -I -X OPTIONS [api-url]/health -H "Origin: https://wheresmystuff.johnduckmanton.co.uk"
   ```

## Next Steps

1. **Configure GitHub variables** (see above)
2. **Run production deployment workflow**
3. **Add final DNS CNAME record** after deployment
4. **Verify all functionality** works with custom domain

## Troubleshooting

If deployment fails:

1. **Check GitHub Actions logs** for specific error messages
2. **Verify certificate ARN** is correct and certificate is issued
3. **Confirm IAM role permissions** for production deployment
4. **Check CloudFormation stack events** in AWS Console

The production deployment should now work with the same reliability as the dev deployment.