# GitHub OIDC Setup Guide

## Overview

This guide explains how to set up GitHub OIDC (OpenID Connect) authentication for secure, keyless deployments to AWS. OIDC eliminates the need for long-lived AWS access keys in GitHub Actions, improving security by using short-lived tokens.

## Benefits of OIDC

- **Enhanced Security**: No long-lived credentials stored in GitHub
- **Automatic Token Rotation**: Tokens are short-lived and automatically rotated
- **Fine-grained Access Control**: Different roles for different environments
- **Audit Trail**: Better tracking of which workflows accessed which resources
- **Cost Effective**: No additional AWS costs for OIDC authentication

## Prerequisites

- AWS account with administrative access
- GitHub repository with Actions enabled
- AWS CLI configured locally (for setup only)

## Step 1: Create OIDC Identity Provider in AWS

### 1.1 Create the Identity Provider

```bash
# Create OIDC identity provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com
```

**Note**: The thumbprint `6938fd4d98bab03faadb97b34396831e3780aea1` is GitHub's current thumbprint. Verify the latest thumbprint from GitHub's documentation if needed.

### 1.2 Verify Identity Provider Creation

```bash
# List OIDC providers to verify creation
aws iam list-open-id-connect-providers

# Get the provider ARN (you'll need this for IAM roles)
OIDC_PROVIDER_ARN=$(aws iam list-open-id-connect-providers \
  --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)].Arn' \
  --output text)

echo "OIDC Provider ARN: $OIDC_PROVIDER_ARN"
```

## Step 2: Create IAM Roles for GitHub Actions

### 2.1 Development Environment Role

Create a trust policy for the development role:

```bash
# Create trust policy for development environment
cat > github-actions-dev-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OIDC_PROVIDER_ARN"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:environment:development"
        }
      }
    }
  ]
}
EOF

# Create the development role
aws iam create-role \
  --role-name GitHubActionsRole-Dev \
  --assume-role-policy-document file://github-actions-dev-trust-policy.json \
  --description "Role for GitHub Actions to deploy to development environment"
```

### 2.2 Production Environment Role

Create a trust policy for the production role:

```bash
# Create trust policy for production environment
cat > github-actions-prod-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OIDC_PROVIDER_ARN"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:environment:production"
        }
      }
    }
  ]
}
EOF

# Create the production role
aws iam create-role \
  --role-name GitHubActionsRole-Prod \
  --assume-role-policy-document file://github-actions-prod-trust-policy.json \
  --description "Role for GitHub Actions to deploy to production environment"
```

### 2.3 Create IAM Policies

Create a comprehensive policy for deployment permissions:

```bash
# Create deployment policy
cat > github-actions-deployment-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "s3:*",
        "apigateway:*",
        "cognito-idp:*",
        "cloudwatch:*",
        "logs:*",
        "iam:GetRole",
        "iam:PassRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:*",
        "wafv2:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "budgets:*",
        "sns:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create the policy
aws iam create-policy \
  --policy-name GitHubActionsDeploymentPolicy \
  --policy-document file://github-actions-deployment-policy.json \
  --description "Policy for GitHub Actions deployment permissions"

# Get the policy ARN
DEPLOYMENT_POLICY_ARN=$(aws iam list-policies \
  --query 'Policies[?PolicyName==`GitHubActionsDeploymentPolicy`].Arn' \
  --output text)

echo "Deployment Policy ARN: $DEPLOYMENT_POLICY_ARN"
```

### 2.4 Attach Policies to Roles

```bash
# Attach deployment policy to development role
aws iam attach-role-policy \
  --role-name GitHubActionsRole-Dev \
  --policy-arn $DEPLOYMENT_POLICY_ARN

# Attach deployment policy to production role
aws iam attach-role-policy \
  --role-name GitHubActionsRole-Prod \
  --policy-arn $DEPLOYMENT_POLICY_ARN

# Get role ARNs for GitHub Actions configuration
DEV_ROLE_ARN=$(aws iam get-role \
  --role-name GitHubActionsRole-Dev \
  --query 'Role.Arn' \
  --output text)

PROD_ROLE_ARN=$(aws iam get-role \
  --role-name GitHubActionsRole-Prod \
  --query 'Role.Arn' \
  --output text)

echo "Development Role ARN: $DEV_ROLE_ARN"
echo "Production Role ARN: $PROD_ROLE_ARN"
```

## Step 3: Configure GitHub Repository

### 3.1 Set Repository Variables

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add these **Repository variables**:

- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: `eu-west-1`
- `DEV_ROLE_ARN`: The development role ARN from Step 2.4
- `PROD_ROLE_ARN`: The production role ARN from Step 2.4

### 3.2 Configure GitHub Environments

1. Go to **Settings > Environments** in your GitHub repository
2. Create two environments:
   - `development`
   - `production`

3. For the **production** environment:
   - Enable **Required reviewers** and add team members
   - Set **Deployment branches** to `main` only
   - Add environment-specific variables if needed

## Step 4: Update GitHub Actions Workflows

### 4.1 Update CI/CD Workflow

Replace the AWS credentials configuration in `.github/workflows/ci-cd.yml`:

```yaml
# Replace this block:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_DEV }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_DEV }}
    aws-region: ${{ env.AWS_REGION }}

# With this:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.DEV_ROLE_ARN }}
    role-session-name: GitHubActions-Dev-${{ github.run_id }}
    aws-region: ${{ vars.AWS_REGION }}
```

### 4.2 Update Production Deployment Workflow

Replace the AWS credentials configuration in `.github/workflows/deploy-production.yml`:

```yaml
# Replace this block:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
    aws-region: ${{ env.AWS_REGION }}

# With this:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.PROD_ROLE_ARN }}
    role-session-name: GitHubActions-Prod-${{ github.run_id }}
    aws-region: ${{ vars.AWS_REGION }}
```

### 4.3 Add Permissions to Workflows

Add the required permissions at the top of both workflow files:

```yaml
permissions:
  id-token: write   # Required for OIDC
  contents: read    # Required to checkout code
```

## Step 5: Test OIDC Configuration

### 5.1 Test Development Deployment

```bash
# Push a test change to trigger development deployment
git add .
git commit -m "Test OIDC authentication"
git push origin main


# Monitor the GitHub Actions workflow
# The workflow should now use OIDC authentication instead of access keys
```

### 5.2 Test Production Deployment

```bash
# Trigger production deployment workflow manually
# Go to GitHub Actions > Deploy to Production > Run workflow
# Select main branch and run

# The workflow should authenticate using OIDC and deploy successfully
```

### 5.3 Verify Authentication in Logs

Check the GitHub Actions logs for successful OIDC authentication:

```
✅ Assuming role with OIDC
✅ Role assumed successfully: arn:aws:iam::ACCOUNT:role/GitHubActionsRole-Dev
✅ AWS credentials configured
```

## Step 6: Security Best Practices

### 6.1 Principle of Least Privilege

Review and refine IAM policies to grant only necessary permissions:

```bash
# Create environment-specific policies if needed
# Development might need fewer permissions than production
```

### 6.2 Monitor Role Usage

Set up CloudWatch alarms for role usage:

```bash
# Create CloudWatch alarm for unusual role usage
aws cloudwatch put-metric-alarm \
  --alarm-name "GitHubActions-UnusualRoleUsage" \
  --alarm-description "Unusual GitHub Actions role usage" \
  --metric-name "AssumeRole" \
  --namespace "AWS/IAM" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2
```

### 6.3 Regular Audit

Regularly audit role usage and permissions:

```bash
# Check recent role assumptions
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --start-time $(date -d '7 days ago' --iso-8601) \
  --end-time $(date --iso-8601)
```

## Troubleshooting

### Common Issues

#### 1. "No OpenIDConnect provider found"

**Error**: `An error occurred (InvalidIdentityToken) when calling the AssumeRoleWithWebIdentity operation`

**Solution**: Verify the OIDC provider is created correctly:
```bash
aws iam list-open-id-connect-providers
```

#### 2. "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Error**: Trust policy doesn't allow the repository

**Solution**: Check the trust policy condition matches your repository:
```bash
# The condition should match: repo:USERNAME/REPOSITORY:environment:ENVIRONMENT
"token.actions.githubusercontent.com:sub": "repo:your-username/your-repo:environment:development"
```

#### 3. "Access Denied" during deployment

**Error**: Role doesn't have sufficient permissions

**Solution**: Review and update the IAM policy attached to the role:
```bash
aws iam list-attached-role-policies --role-name GitHubActionsRole-Dev
```

#### 4. Thumbprint verification failed

**Error**: OIDC provider thumbprint is invalid

**Solution**: Update the thumbprint (GitHub may change it):
```bash
# Get current thumbprint from GitHub
openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 < /dev/null 2>/dev/null \
  | openssl x509 -fingerprint -noout -sha1 \
  | sed 's/://g' | awk -F= '{print tolower($2)}'
```

### Verification Commands

```bash
# Verify OIDC provider
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn $OIDC_PROVIDER_ARN

# Verify role trust policy
aws iam get-role --role-name GitHubActionsRole-Dev \
  --query 'Role.AssumeRolePolicyDocument'

# Test role assumption (from GitHub Actions context)
aws sts get-caller-identity
```

## Migration from Access Keys

If you're migrating from AWS access keys:

### 1. Keep Access Keys as Fallback (Temporarily)

During migration, keep the existing access keys as repository secrets for rollback purposes.

### 2. Update Workflows Gradually

Update one environment at a time (development first, then production).

### 3. Test Thoroughly

Ensure OIDC authentication works reliably before removing access keys.

### 4. Remove Access Keys

Once OIDC is working reliably:

```bash
# Delete the access keys from AWS
aws iam delete-access-key \
  --access-key-id YOUR_ACCESS_KEY_ID \
  --user-name YOUR_IAM_USER

# Remove secrets from GitHub repository
# Go to Settings > Secrets and variables > Actions
# Delete AWS_ACCESS_KEY_ID_DEV, AWS_SECRET_ACCESS_KEY_DEV, etc.
```

## Cost Considerations

OIDC authentication has **no additional AWS costs**:

- ✅ No charges for OIDC identity provider
- ✅ No charges for role assumptions
- ✅ No charges for short-lived tokens
- ✅ Reduces security management overhead

## Compliance Benefits

OIDC provides better compliance posture:

- **Audit Trail**: All role assumptions are logged in CloudTrail
- **No Long-lived Credentials**: Eliminates credential rotation requirements
- **Fine-grained Access**: Environment-specific roles and permissions
- **Automatic Expiration**: Tokens expire automatically

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d '+6 months' +%Y-%m-%d)  
**Security Level**: Enhanced with OIDC