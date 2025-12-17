# Frontend Deployment Guide

This guide explains how to deploy your React frontend to AWS using S3 and CloudFront.

## 🏗️ Architecture

Your frontend is deployed using:
- **S3 Bucket**: Hosts the static React build files
- **CloudFront**: CDN for fast global delivery and HTTPS
- **Route53** (optional): Custom domain support

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
# Deploy both backend and frontend
./scripts/deploy-frontend.sh

# Or specify custom stack name and region
./scripts/deploy-frontend.sh my-stack-name us-west-2
```

### Option 2: Manual Steps

1. **Deploy Backend Infrastructure First**:
   ```bash
   sam build
   sam deploy
   ```

2. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Deploy Frontend**:
   ```bash
   ./scripts/deploy-frontend.sh
   ```

## 🔧 Configuration

### Environment Variables

The deployment script automatically configures these environment variables:

```env
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxx
VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
VITE_S3_BUCKET=home-inventory-photos-xxxxxxxxxxxx-dev
```

### Custom Domain (Optional)

To use a custom domain:

1. **Get SSL Certificate**:
   ```bash
   # Certificate must be in us-east-1 for CloudFront
   aws acm request-certificate \
     --domain-name yourdomain.com \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Deploy with Custom Domain**:
   ```bash
   sam deploy \
     --parameter-overrides \
     CustomDomainName=yourdomain.com \
     ACMCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx
   ```

## 📁 File Structure

After deployment, your S3 bucket will contain:

```
s3://home-inventory-frontend-xxxxxxxxxxxx-dev/
├── index.html
├── assets/
│   ├── index-xxxxxxxx.js
│   ├── index-xxxxxxxx.css
│   └── ...
└── vite.svg
```

## 🌐 Access URLs

After deployment, you can access your application at:

- **CloudFront URL**: `https://xxxxxxxxxx.cloudfront.net`
- **Custom Domain** (if configured): `https://yourdomain.com`

## 🔄 Updating the Frontend

To deploy frontend changes:

```bash
# Make your changes to the frontend code
# Then redeploy
./scripts/deploy-frontend.sh
```

The script will:
1. Build the updated frontend
2. Upload new files to S3
3. Invalidate CloudFront cache
4. Your changes will be live in 2-3 minutes

## 🛠️ Troubleshooting

### Build Fails
```bash
cd frontend
npm install
npm run build
```

### CloudFront Not Updating
```bash
# Manually invalidate cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXXXXXXXXX \
  --paths "/*"
```

### Environment Variables Not Working
Check that your `.env` file in the frontend directory has the correct values:
```bash
cat frontend/.env
```

### S3 Access Denied
Ensure the bucket policy allows CloudFront access:
```bash
aws s3api get-bucket-policy --bucket your-bucket-name
```

## 📊 Monitoring

### CloudFront Metrics
- View in AWS Console: CloudFront → Distributions → Monitoring
- Key metrics: Requests, Data Transfer, Error Rate

### S3 Metrics  
- View in AWS Console: S3 → Buckets → Metrics
- Key metrics: Storage, Requests

### Costs
- CloudFront: ~$0.085 per GB transferred
- S3: ~$0.023 per GB stored
- Typical small app: $1-5/month

## 🔐 Security Features

Your deployment includes:
- **HTTPS Only**: All traffic redirected to HTTPS
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **WAF Protection**: DDoS and common attack protection
- **Private S3**: Bucket not publicly accessible

## 📝 Next Steps

1. **Set up CI/CD**: Automate deployments with GitHub Actions
2. **Custom Domain**: Configure your own domain name
3. **Monitoring**: Set up CloudWatch alarms
4. **Backup**: Configure S3 versioning

## 🆘 Support

If you encounter issues:
1. Check the deployment script output for errors
2. Verify AWS credentials are configured
3. Ensure the backend stack is deployed first
4. Check CloudFormation stack events in AWS Console