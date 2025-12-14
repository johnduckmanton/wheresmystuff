# Home Inventory System - Deployment Guide

## Prerequisites

1. **AWS CLI** - Install and configure with your AWS credentials
   ```bash
   aws configure
   ```

2. **AWS SAM CLI** - Install the AWS Serverless Application Model CLI
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Or download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   ```

3. **Node.js** - Version 20.x or later
   ```bash
   node --version
   ```

## Deployment Steps

### 1. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 2. Build the SAM Application

```bash
sam build
```

This command:
- Packages the Lambda functions
- Resolves dependencies
- Prepares the application for deployment

### 3. Deploy the Application

**First-time deployment (guided):**
```bash
sam deploy --guided
```

You'll be prompted for:
- Stack name (default: `home-inventory-system`)
- AWS Region (e.g., `us-east-1`)
- Parameter Environment (default: `dev`)
- Confirm changes before deploy
- Allow SAM CLI IAM role creation
- Save arguments to configuration file

**Subsequent deployments:**
```bash
sam deploy
```

The configuration is saved in `samconfig.toml` for future deployments.

### 4. Capture Output Values

After successful deployment, SAM will display output values:

```
CloudFormation outputs from deployed stack
---------------------------------------------------------------------------
Outputs
---------------------------------------------------------------------------
Key                 ApiUrl
Description         API Gateway endpoint URL
Value               https://xxxxx.execute-api.us-east-1.amazonaws.com/dev

Key                 UserPoolId
Description         Cognito User Pool ID
Value               us-east-1_xxxxxxxxx

Key                 UserPoolClientId
Description         Cognito User Pool Client ID
Value               xxxxxxxxxxxxxxxxxxxxxxxxxx

Key                 BucketName
Description         S3 Bucket Name for Photos
Value               home-inventory-photos-123456789012-dev

Key                 TableName
Description         DynamoDB Table Name
Value               home-inventory-dev

Key                 Region
Description         AWS Region
Value               us-east-1
---------------------------------------------------------------------------
```

**Save these values** - you'll need them for frontend configuration in later tasks.

### 5. Verify Deployment

Check that resources were created:

```bash
# List CloudFormation stacks
aws cloudformation describe-stacks --stack-name home-inventory-system

# Verify DynamoDB table
aws dynamodb describe-table --table-name home-inventory-dev

# Verify S3 bucket
aws s3 ls | grep home-inventory-photos

# Verify Cognito User Pool
aws cognito-idp describe-user-pool --user-pool-id <UserPoolId>
```

## Infrastructure Components

### Cognito User Pool
- **Purpose**: User authentication and JWT token generation
- **Password Policy**: 
  - Minimum 8 characters
  - Requires uppercase letters
  - Requires lowercase letters
  - Requires numbers
- **Username**: Email address

### DynamoDB Table
- **Name**: `home-inventory-dev`
- **Design**: Single-table design
- **Keys**:
  - Partition Key (pk): Entity type (THINGS, LOCATIONS, ROOMS, CATEGORIES, PEOPLE)
  - Sort Key (sk): UUID
- **Billing**: Pay-per-request (on-demand)
- **Features**: Point-in-time recovery enabled

### S3 Bucket
- **Name**: `home-inventory-photos-{AccountId}-dev`
- **Access**: Private (no public access)
- **CORS**: Configured for presigned URL uploads
- **Versioning**: Enabled
- **Lifecycle**: Deletes incomplete multipart uploads after 7 days

### API Gateway
- **Type**: HTTP API (lower latency than REST API)
- **Authorization**: Cognito JWT authorizer
- **CORS**: Enabled for all origins (configure for production)
- **Endpoints**:
  - `/things` - Things CRUD
  - `/locations` - Locations CRUD
  - `/rooms` - Rooms CRUD
  - `/categories` - Categories CRUD
  - `/people` - People CRUD
  - `/upload` - Photo upload presigned URL
  - `/photo/{key}` - Photo download presigned URL

## Updating the Stack

After making changes to `template.yaml`:

```bash
sam build
sam deploy
```

## Deleting the Stack

To remove all resources:

```bash
sam delete
```

**Note**: This will delete all data in DynamoDB and all photos in S3. Make sure to backup any important data first.

## Troubleshooting

### Build Errors

If `sam build` fails:
1. Check that Node.js dependencies are installed in `backend/`
2. Verify `template.yaml` syntax
3. Check CloudFormation template limits

### Deployment Errors

If `sam deploy` fails:
1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify IAM permissions for CloudFormation, Lambda, DynamoDB, S3, Cognito
3. Check for resource naming conflicts
4. Review CloudFormation events in AWS Console

### Lambda Function Errors

Check Lambda logs:
```bash
sam logs -n ThingsFunction --stack-name home-inventory-system --tail
```

## Next Steps

1. **Task 2**: Initialize frontend project with MUI CRUD Dashboard template
2. **Task 3**: Implement authentication system
3. **Task 4**: Set up backend Lambda functions and DynamoDB service layer

## Configuration for Frontend

Create a `.env` file in the frontend project with these values:

```env
VITE_API_URL=<ApiUrl from outputs>
VITE_USER_POOL_ID=<UserPoolId from outputs>
VITE_USER_POOL_CLIENT_ID=<UserPoolClientId from outputs>
VITE_BUCKET_NAME=<BucketName from outputs>
VITE_REGION=<Region from outputs>
```
