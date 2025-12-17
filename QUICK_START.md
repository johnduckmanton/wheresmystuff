# 🚀 Quick Start: Deploy Frontend to AWS

## Prerequisites Check

Run this first to make sure everything is ready:
```bash
./scripts/check-deployment-ready.sh
```

## 🎯 One-Command Deployment

```bash
# Deploy everything (backend + frontend)
./scripts/deploy-frontend.sh
```

This script will:
1. ✅ Check if backend is deployed (deploy if needed)
2. 🔨 Build the React frontend
3. ⚙️ Configure environment variables automatically
4. 📤 Upload files to S3
5. 🌐 Configure CloudFront distribution
6. 🔄 Invalidate cache for immediate updates

## 📱 Access Your App

After deployment (2-3 minutes), you'll get a URL like:
```
🌐 CloudFront URL: https://d1234567890abc.cloudfront.net
```

## 🔄 Update Frontend

To deploy changes:
```bash
# Make your code changes, then:
./scripts/deploy-frontend.sh
```

## 🛠️ Manual Steps (if needed)

If the automated script doesn't work:

1. **Deploy Backend First**:
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

## 🆘 Troubleshooting

### "Stack not found" error
```bash
sam build
sam deploy
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

## 📊 What Gets Created

- **S3 Bucket**: `home-inventory-frontend-{account-id}-dev`
- **CloudFront Distribution**: Global CDN with HTTPS
- **Environment Config**: Automatic API/Auth configuration

## 💰 Estimated Costs

- **S3**: ~$0.023/GB/month (storage)
- **CloudFront**: ~$0.085/GB (data transfer)
- **Typical small app**: $1-5/month

## 🔐 Security Features

- ✅ HTTPS only (HTTP redirects to HTTPS)
- ✅ Security headers (CSP, HSTS, etc.)
- ✅ WAF protection against common attacks
- ✅ Private S3 bucket (CloudFront access only)

## 🎉 Success!

Once deployed, you can:
- 📱 Access your app via the CloudFront URL
- 👤 Sign up for a new account
- 📦 Create inventories and add items
- 🎨 See the new category colors and icons
- 📸 Upload photos to items

---

**Need help?** Check `FRONTEND_DEPLOYMENT.md` for detailed documentation.