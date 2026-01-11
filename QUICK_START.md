# 🚀 Quick Start: Home Inventory System

## Prerequisites Check

Run this first to make sure everything is ready:
```bash
./scripts/check-deployment-ready.sh
```

## 🎯 Complete System Deployment

```bash
# Deploy backend infrastructure
sam build
sam deploy

# Deploy CloudFront distribution (us-east-1)
aws cloudformation deploy \
  --template-file cloudfront-template.yaml \
  --stack-name home-inventory-cloudfront \
  --region us-east-1 \
  --parameter-overrides \
    ApiGatewayDomainName=YOUR_API_GATEWAY_DOMAIN \
    WebsiteBucketDomainName=YOUR_S3_BUCKET_DOMAIN

# Deploy frontend
./deploy-frontend.sh dev  # defaults to dev if no environment specified
```

This deployment includes:
1. ✅ Backend API with Lambda functions
2. 🔨 React frontend with TypeScript
3. ⚙️ Environment configuration
4. 📤 S3 storage for frontend and files
5. 🌐 CloudFront CDN with security headers
6. 🔒 WAF protection and CORS configuration
7. 📱 QR code generation and scanning system

## 📱 Access Your App

After deployment (2-3 minutes), you'll get a URL like:
```
🌐 CloudFront URL: https://d1234567890abc.cloudfront.net
```

## 🔄 Update Frontend

To deploy changes:
```bash
# Make your code changes, then:
./deploy-frontend.sh dev
```

## 🛠️ Manual Steps (if needed)

If the automated script doesn't work:

1. **Deploy Backend First**:
   ```bash
   sam build
   sam deploy --region eu-west-1
   ```

2. **Deploy CloudFront (us-east-1)**:
   ```bash
   # Get API Gateway and S3 bucket domains from backend stack outputs
   aws cloudformation deploy \
     --template-file cloudfront-template.yaml \
     --stack-name home-inventory-cloudfront \
     --region us-east-1 \
     --parameter-overrides \
       ApiGatewayDomainName=YOUR_API_DOMAIN \
       WebsiteBucketDomainName=YOUR_S3_DOMAIN
   ```

3. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. **Deploy Frontend**:
   ```bash
   ./deploy-frontend.sh dev
   ```

## 🆘 Troubleshooting

### "Stack not found" error
```bash
sam build
sam deploy --region eu-west-1
```

### "AWS credentials not configured"
```bash
aws configure
```

### Frontend build fails
```bash
cd frontend
npm install
npm run build
```

### CloudFront not updating
Wait 2-3 minutes, or manually invalidate:
```bash
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

### QR Code Images Not Displaying
- ✅ **Fixed**: S3Image component handles CORS automatically
- ✅ **Cache Cleared**: DynamoDB and CloudFront caches updated
- ✅ **Bucket Routing**: QR codes use correct S3 bucket

### Cross-Region Issues
- Backend: `eu-west-1` (Lambda, API Gateway, DynamoDB)
- CloudFront: `us-east-1` (required for CloudFront)
- Ensure both regions are properly configured

## 📊 What Gets Created

### Backend Infrastructure (eu-west-1)
- **Lambda Functions**: API handlers for containers, items, QR codes
- **DynamoDB Tables**: Data storage with caching
- **S3 Buckets**: Photos and QR code storage
- **API Gateway**: RESTful API endpoints
- **Cognito**: User authentication

### Frontend Infrastructure (us-east-1)
- **S3 Bucket**: `home-inventory-frontend-{account-id}-dev`
- **CloudFront Distribution**: Global CDN with HTTPS
- **WAF**: Web Application Firewall protection
- **Security Headers**: CSP, HSTS, frame protection

### QR Code System
- **QR Generation**: Container-specific QR codes
- **S3 Storage**: Separate bucket for QR code images
- **CORS Handling**: Frontend component for cross-origin images
- **Caching**: Optimized cache management

## 💰 Estimated Costs

- **S3**: ~$0.023/GB/month (storage)
- **CloudFront**: ~$0.085/GB (data transfer)
- **Typical small app**: $1-5/month

## 🔐 Security Features

- ✅ **HTTPS Only**: HTTP redirects to HTTPS
- ✅ **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- ✅ **WAF Protection**: AWS managed rules against common attacks
- ✅ **Private S3**: CloudFront Origin Access Control
- ✅ **CORS Configuration**: Proper cross-origin resource sharing
- ✅ **JWT Authentication**: Secure API access with Cognito
- ✅ **Input Validation**: Server-side validation and sanitization

## 🎉 Success!

Once deployed, you can:
- 📱 Access your app via the CloudFront URL
- 👤 Sign up for a new account or sign in
- 📦 Create inventories and manage containers
- 📋 Add items with photos and details
- 🏷️ Generate QR codes for containers
- 📱 Scan QR codes to view container contents
- 🎨 Use category colors and icons
- 📸 Upload and view photos with CORS handling
- 🔍 Search and filter your inventory

## 🔧 Recent System Improvements

### QR Code System (Fixed)
- ✅ **S3 Bucket Routing**: QR codes now use correct bucket (QR Reports vs Photos)
- ✅ **CORS Handling**: New S3Image component handles cross-origin image loading
- ✅ **UI Enhancement**: Container details show proper QR code generation interface
- ✅ **Cache Management**: Fixed cached placeholder data issues

### Infrastructure Recovery
- ✅ **CloudFront Template**: Recovered and validated infrastructure template
- ✅ **Multi-Region Setup**: Backend (eu-west-1) + CloudFront (us-east-1)
- ✅ **Security Headers**: CSP, HSTS, and other security configurations

---

**Need help?** 
- Check `DEPLOYMENT.md` for detailed deployment documentation
- See `INFRASTRUCTURE.md` for architecture details
- Review `.kiro/specs/qr-code-system-enhancement/` for QR code system documentation