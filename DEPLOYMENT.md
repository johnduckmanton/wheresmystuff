# Home Inventory System - Complete Deployment Guide

A comprehensive guide for deploying the Home Inventory System with QR code functionality across multiple AWS regions.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Quick Start](#quick-start)
4. [Detailed Deployment Steps](#detailed-deployment-steps)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Scripts](#deployment-scripts)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

## 🔧 Prerequisites

### Required Tools

- **AWS CLI** (v2.x or later)
  ```bash
  aws --version
  aws configure  # Configure with your AWS credentials
  ```

- **AWS SAM CLI** (v1.x or later)
  ```bash
  # macOS
  brew install aws-sam-cli
  
  # Or download from AWS documentation
  ```

- **Node.js** (v20.x or later)
  ```bash
  node --version  # Should be 20.x+
  npm --version   # Should be 9.x+
  ```

### AWS Permissions

Your AWS user/role needs the following permissions:

- **CloudFormation**: Full access
- **Lambda**: Full access  
- **DynamoDB**: Full access
- **S3**: Full access
- **API Gateway**: Full access
- **CloudFront**: Full access (us-east-1 only)
- **Cognito**: Full access
- **CloudWatch**: Full access
- **WAF**: Full access (optional)
- **IAM**: Role creation and policy attachment

### Environment Setup

```bash
# Set your preferred AWS region for backend
export AWS_REGION=eu-west-1

# Set environment (dev, staging, prod)
export ENVIRONMENT=dev
```

## 🏗️ Architecture Overview

### Multi-Region Setup

- **Backend Region**: `eu-west-1` (Lambda, API Gateway, DynamoDB, S3)
- **CDN Region**: `us-east-1` (CloudFront, WAF - required for global distribution)

### Core Components

| Component | Purpose | Region |
|-----------|---------|---------|
| **Lambda Functions** | API handlers and business logic | eu-west-1 |
| **API Gateway** | HTTP API with JWT authorization | eu-west-1 |
| **DynamoDB** | Single-table design with caching | eu-west-1 |
| **S3 Buckets** | Photos, QR codes, frontend hosting | eu-west-1 |
| **Cognito** | User authentication and JWT tokens | eu-west-1 |
| **CloudFront** | Global CDN with security headers | us-east-1 |
| **WAF** | Web Application Firewall protection | us-east-1 |

### Lambda Functions

| Function | Handler | Purpose |
|----------|---------|---------|
| ContainerFunction | handlers/containers.js | Container CRUD operations |
| ItemFunction | handlers/items.js | Item management within containers |
| QRCodeFunction | handlers/qrCode.js | QR code generation and scanning ✅ |
| LocationFunction | handlers/locations.js | Location and room management |
| PeopleFunction | handlers/people.js | User management and sharing |
| PhotoFunction | handlers/photo.js | Photo upload and management |

## 🚀 Quick Start

### Option 1: Automated Full Deployment (Recommended)

```bash
# Clone and setup
git clone <repository-url>
cd home-inventory-system

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Deploy everything
./scripts/deploy-full-stack.sh
```

### Option 2: Step-by-Step Deployment

```bash
# 1. Deploy backend infrastructure
sam build
sam deploy --region eu-west-1

# 2. Deploy CloudFront (get parameters from backend stack outputs)
aws cloudformation deploy \
  --template-file cloudfront-template.yaml \
  --stack-name home-inventory-cloudfront \
  --region us-east-1 \
  --parameter-overrides \
    ApiGatewayDomainName=YOUR_API_DOMAIN \
    WebsiteBucketDomainName=YOUR_S3_DOMAIN

# 3. Deploy frontend
./deploy-frontend.sh dev  # or ./deploy-frontend.sh prod
```

## 📝 Detailed Deployment Steps

### Step 1: Backend Infrastructure Deployment

#### 1.1 Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

#### 1.2 Build SAM Application

```bash
sam build --use-container
```

#### 1.3 Deploy Backend Stack

**First-time deployment:**
```bash
sam deploy --guided --region eu-west-1
```

You'll be prompted for:
- **Stack name**: `home-inventory-system` (recommended)
- **AWS Region**: `eu-west-1` (recommended)
- **Environment**: `dev` (or `staging`, `prod`)
- **Confirm changes**: `Y`
- **Allow IAM role creation**: `Y`
- **Save to config file**: `Y`

**Subsequent deployments:**
```bash
sam deploy --region eu-west-1
```

#### 1.4 Capture Backend Outputs

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs"

# Save important values
API_URL=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
```

### Step 2: CloudFront Distribution Deployment

#### 2.1 Get Backend Parameters

```bash
# Extract required parameters from backend stack
API_DOMAIN=$(echo $API_URL | sed 's|https://||' | sed 's|/dev||')
S3_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketDomainName'].OutputValue" \
  --output text)
```

#### 2.2 Deploy CloudFront Stack

```bash
aws cloudformation deploy \
  --template-file cloudfront-template.yaml \
  --stack-name home-inventory-cloudfront \
  --region us-east-1 \
  --parameter-overrides \
    Environment=dev \
    ApiGatewayDomainName=$API_DOMAIN \
    WebsiteBucketDomainName=$S3_DOMAIN \
    EnableWAF=true
```

#### 2.3 Get CloudFront URL

```bash
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-cloudfront \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

echo "CloudFront URL: $CLOUDFRONT_URL"
```

### Step 3: Frontend Deployment

#### 3.1 Configure Frontend Environment

```bash
cd frontend

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=$API_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_REGION=eu-west-1
VITE_ENVIRONMENT=dev
EOF
```

#### 3.2 Build and Deploy Frontend

```bash
# Build the React application
npm run build

# Deploy to S3
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" \
  --output text)

aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

# Invalidate CloudFront cache
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-cloudfront \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

cd ..
```

## ⚙️ Environment Configuration

### Development Environment

```yaml
Parameters:
  Environment: dev
  EnableWAF: true
  EnableAdvancedMonitoring: false
  CustomDomainName: ""  # Use CloudFront domain
  ACMCertificateArn: ""
```

### Staging Environment

```yaml
Parameters:
  Environment: staging
  EnableWAF: true
  EnableAdvancedMonitoring: true
  CustomDomainName: "staging.yourdomain.com"  # Optional
  ACMCertificateArn: "arn:aws:acm:us-east-1:..."  # If using custom domain
```

### Production Environment

```yaml
Parameters:
  Environment: prod
  EnableWAF: true
  EnableAdvancedMonitoring: true
  CustomDomainName: "app.yourdomain.com"  # Recommended
  ACMCertificateArn: "arn:aws:acm:us-east-1:..."  # Required for custom domain
```

## 🔨 Deployment Scripts

### Available Scripts

| Script | Use Case | Speed | Reliability |
|--------|----------|-------|-------------|
| `deploy-full-stack.sh` | Complete deployment | Slow | High |
| `deploy-backend-only.sh` | Backend changes only | Medium | High |
| `deploy-lambda-direct.sh` | Quick Lambda updates | Fast | Medium |
| `deploy-frontend.sh` | Frontend changes only | Medium | High |
| `deploy-container-function.sh` | Single function update | Fast | High |

### Script Usage

#### Full Stack Deployment
```bash
# Deploy everything (backend + frontend)
./scripts/deploy-full-stack.sh

# Deploy with specific environment
ENVIRONMENT=staging ./scripts/deploy-full-stack.sh
```

#### Backend Only Deployment
```bash
# Deploy backend via CloudFormation (recommended)
./scripts/deploy-backend-only.sh

# Direct Lambda deployment (faster, bypasses CloudFormation)
./scripts/deploy-lambda-direct.sh
```

#### Frontend Only Deployment
```bash
# Deploy frontend to S3 and invalidate CloudFront
./deploy-frontend.sh dev  # for development environment
./deploy-frontend.sh prod # for production environment
```

#### Single Function Update
```bash
# Update only the container function
./scripts/deploy-container-function.sh
```

### Environment Variables in Scripts

All deployment scripts automatically configure these environment variables:

```bash
# Authentication
USER_POOL_ID=eu-west-1_xxxxxxxxx
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Storage
TABLE_NAME=home-inventory-dev
BUCKET_NAME=home-inventory-photos-123456789012-dev
QR_REPORT_BUCKET_NAME=home-inventory-qr-reports-123456789012-dev

# Configuration
NODE_ENV=production
ALLOWED_ORIGINS=https://d1234567890abc.cloudfront.net,http://localhost:5173
```

## 📊 Monitoring and Maintenance

### CloudWatch Dashboard

Access the monitoring dashboard:
```bash
DASHBOARD_URL=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" \
  --output text)

echo "Dashboard: $DASHBOARD_URL"
```

### Key Metrics to Monitor

- **Lambda Duration**: Should be < 10 seconds
- **Lambda Errors**: Should be < 1%
- **DynamoDB Throttling**: Should be 0
- **API Gateway 5XX Errors**: Should be < 1%
- **CloudFront Cache Hit Ratio**: Should be > 80%

### Automated Alerts

Subscribe to alerts:
```bash
ALERT_TOPIC=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='AlertTopicArn'].OutputValue" \
  --output text)

aws sns subscribe \
  --topic-arn $ALERT_TOPIC \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region eu-west-1
```

### Regular Maintenance

**Weekly Tasks:**
- Review CloudWatch alarms and metrics
- Check cost and usage reports
- Monitor error rates and performance

**Monthly Tasks:**
- Update dependencies (`npm audit` and `npm update`)
- Review and rotate secrets if needed
- Test backup and recovery procedures

## 🔍 Troubleshooting

### Common Issues

#### 1. CloudFormation Deployment Fails

**Symptoms**: Stack creation/update fails with permission or resource errors

**Solutions**:
```bash
# Check AWS credentials and permissions
aws sts get-caller-identity
aws iam get-user

# Check CloudFormation events for specific errors
aws cloudformation describe-stack-events \
  --stack-name home-inventory-system \
  --region eu-west-1

# Use direct Lambda deployment as fallback
./scripts/deploy-lambda-direct.sh
```

#### 2. Authentication Errors (401/403)

**Symptoms**: API returns 401 Unauthorized or 403 Forbidden

**Solutions**:
```bash
# Fix authentication environment variables
./scripts/fix-all-lambda-auth.sh

# Verify Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID --region eu-west-1
```

#### 3. CORS Errors

**Symptoms**: Browser console shows CORS policy errors

**Solutions**:
```bash
# Check ALLOWED_ORIGINS environment variable
aws lambda get-function-configuration \
  --function-name home-inventory-dev-ContainerFunction \
  --region eu-west-1 \
  --query "Environment.Variables.ALLOWED_ORIGINS"

# Update CORS configuration
./scripts/deploy-lambda-direct.sh
```

#### 4. QR Code Images Not Displaying

**Symptoms**: QR codes generate but don't display in frontend

**Solutions**:
- ✅ **Already Fixed**: S3Image component handles CORS automatically
- ✅ **Cache Cleared**: DynamoDB and CloudFront caches updated
- ✅ **Bucket Routing**: QR codes use correct S3 bucket

#### 5. Frontend Build Failures

**Symptoms**: `npm run build` fails with TypeScript or dependency errors

**Solutions**:
```bash
cd frontend

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Build with verbose output
npm run build -- --verbose
```

### Debugging Commands

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name home-inventory-system \
  --region eu-west-1

# View Lambda logs
aws logs tail /aws/lambda/home-inventory-dev-ContainerFunction \
  --region eu-west-1 \
  --follow

# Test API endpoints
curl -X GET "$API_URL/health"

# Check DynamoDB table
aws dynamodb describe-table \
  --table-name home-inventory-dev \
  --region eu-west-1

# Verify S3 buckets
aws s3 ls | grep home-inventory
```

## 🔒 Security Considerations

### Security Features Implemented

- **Multi-Layer Authentication**: JWT tokens with Cognito
- **Private S3 Storage**: No public access, presigned URLs only
- **CORS Configuration**: Proper cross-origin resource sharing
- **WAF Protection**: AWS managed rules against common attacks
- **Security Headers**: CSP, HSTS, X-Frame-Options via CloudFront
- **HTTPS Enforcement**: All traffic encrypted in transit
- **Input Validation**: Server-side validation and sanitization

### Security Best Practices

1. **Enable WAF for production environments**
2. **Use AWS Secrets Manager for sensitive configuration**
3. **Enable CloudTrail for API audit logging**
4. **Regularly update dependencies and scan for vulnerabilities**
5. **Use least privilege IAM policies**
6. **Enable MFA for AWS console access**

### Security Monitoring

```bash
# Check for security events in CloudTrail
aws logs filter-log-events \
  --log-group-name CloudTrail/SecurityEvents \
  --start-time $(date -d '1 hour ago' +%s)000

# Review WAF blocked requests
aws wafv2 get-sampled-requests \
  --web-acl-arn $WAF_ARN \
  --rule-metric-name AWSManagedRulesCommonRuleSetMetric \
  --scope CLOUDFRONT \
  --time-window StartTime=$(date -d '1 hour ago' +%s),EndTime=$(date +%s) \
  --max-items 100
```

## 🎯 Performance Optimization

### Optimization Strategies

1. **Lambda Cold Starts**:
   - Minimize bundle size and dependencies
   - Use provisioned concurrency for critical functions
   - Implement connection pooling for DynamoDB

2. **DynamoDB Performance**:
   - Use single-table design with appropriate GSI indexes
   - Implement intelligent caching strategies
   - Monitor for hot partitions

3. **S3 and CloudFront**:
   - Enable compression for static assets
   - Use appropriate cache headers
   - Implement multipart uploads for large files

4. **API Gateway**:
   - Enable request/response compression
   - Use caching for read-heavy endpoints
   - Implement request throttling

### Performance Monitoring

```bash
# Check Lambda performance metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=home-inventory-dev-ContainerFunction \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average,Maximum

# Monitor DynamoDB performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=home-inventory-dev \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum
```

## 💰 Cost Optimization

### Cost Components

- **Lambda**: Pay per request and execution time
- **DynamoDB**: On-demand billing (pay per request)
- **S3**: Storage and data transfer costs
- **CloudFront**: Data transfer and requests
- **API Gateway**: Pay per API call
- **Cognito**: Pay per monthly active user

### Cost Monitoring

```bash
# Set up budget alerts
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "HomeInventoryBudget",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'

# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## 🔄 Backup and Disaster Recovery

### Automated Backups

The system includes comprehensive backup strategies:

1. **DynamoDB**: Point-in-time recovery enabled (35-day retention)
2. **S3**: Versioning enabled with lifecycle policies
3. **CloudFormation**: Templates stored in version control
4. **Application Code**: Git repository with tagged releases

### Manual Backup

```bash
# Create DynamoDB backup
aws dynamodb create-backup \
  --table-name home-inventory-dev \
  --backup-name "manual-backup-$(date +%Y%m%d-%H%M%S)" \
  --region eu-west-1

# Export S3 data
aws s3 sync s3://home-inventory-photos-123456789012-dev/ ./backup/photos/
aws s3 sync s3://home-inventory-qr-reports-123456789012-dev/ ./backup/qr-codes/
```

### Disaster Recovery

**Recovery Time Objectives (RTO)**:
- Infrastructure: 15-30 minutes
- Database: 5-15 minutes  
- File Storage: 10-60 minutes
- **Total RTO**: 30-105 minutes

**Recovery Point Objectives (RPO)**:
- Database: 5 minutes (point-in-time recovery)
- Files: 24 hours (daily backups)
- Configuration: Real-time (Git)

## 📚 Additional Resources

### Documentation Links

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

### Project Documentation

- [QUICK_START.md](QUICK_START.md) - Fast deployment guide
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) - Architecture details
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Development setup
- [.kiro/specs/](/.kiro/specs/) - Feature specifications

### Support

For issues or questions:

1. **Check this deployment guide** for common solutions
2. **Review CloudWatch logs** for error details
3. **Check GitHub issues** for known problems
4. **Create new issue** with deployment logs and error details

---

**Last Updated**: December 2024  
**Version**: 2.0 (includes QR code system and multi-region architecture)