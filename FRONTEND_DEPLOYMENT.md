# Frontend Deployment Guide

## Build Complete

The frontend has been successfully built and is ready for deployment. The production build is located in `frontend/dist/`.

## Deployment Options

### Option 1: Deploy to AWS S3 + CloudFront

1. **Create an S3 bucket for static website hosting:**
   ```bash
   aws s3 mb s3://home-inventory-frontend-prod
   aws s3 website s3://home-inventory-frontend-prod --index-document index.html --error-document index.html
   ```

2. **Upload the build files:**
   ```bash
   cd frontend/dist
   aws s3 sync . s3://home-inventory-frontend-prod --delete
   ```

3. **Set bucket policy for public read access:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::home-inventory-frontend-prod/*"
       }
     ]
   }
   ```

4. **Create CloudFront distribution (optional but recommended):**
   - Origin: S3 bucket website endpoint
   - Default root object: index.html
   - Error pages: Configure 404 to redirect to /index.html (for SPA routing)
   - SSL certificate: Use ACM certificate for custom domain

### Option 2: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from the frontend directory:**
   ```bash
   cd frontend
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard:**
   - VITE_AWS_REGION=us-east-1
   - VITE_USER_POOL_ID=us-east-1_qL27rL63E
   - VITE_USER_POOL_CLIENT_ID=6lcv99ikkeekm526u8slo96vb9
   - VITE_API_URL=https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
   - VITE_S3_BUCKET=home-inventory-photos-982081071280-dev

### Option 3: Deploy to Netlify

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   cd frontend
   netlify deploy --prod --dir=dist
   ```

3. **Configure redirects for SPA routing:**
   Create `frontend/dist/_redirects`:
   ```
   /*    /index.html   200
   ```

## Backend Configuration

The frontend is configured to connect to the following backend resources:

- **API URL:** https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
- **User Pool ID:** us-east-1_qL27rL63E
- **User Pool Client ID:** 6lcv99ikkeekm526u8slo96vb9
- **S3 Bucket:** home-inventory-photos-982081071280-dev
- **Region:** us-east-1

## CORS Configuration

If you encounter CORS issues after deployment, you may need to update the API Gateway CORS settings to allow your frontend domain:

1. Update `template.yaml` to restrict CORS to your domain:
   ```yaml
   CorsConfiguration:
     AllowOrigins:
       - 'https://your-domain.com'
   ```

2. Redeploy the backend:
   ```bash
   sam build && sam deploy
   ```

## Testing the Deployment

1. **Create a test user:**
   ```bash
   aws cognito-idp sign-up \
     --client-id 6lcv99ikkeekm526u8slo96vb9 \
     --username test@example.com \
     --password TestPassword123
   ```

2. **Confirm the user (admin command):**
   ```bash
   aws cognito-idp admin-confirm-sign-up \
     --user-pool-id us-east-1_qL27rL63E \
     --username test@example.com
   ```

3. **Access your deployed frontend and sign in with the test credentials**

## Next Steps

1. Choose a deployment option above and deploy the frontend
2. Configure a custom domain (optional)
3. Set up SSL/TLS certificate
4. Test the complete application end-to-end
5. Set up monitoring and logging
