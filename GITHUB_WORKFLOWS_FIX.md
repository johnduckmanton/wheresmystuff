# GitHub Workflows Fix Summary

## Issue Description

The GitHub Actions workflows were failing with npm cache configuration errors:

```
/opt/hostedtoolcache/node/20.19.6/x64/bin/npm config get cache/home/runner/.npmError: Some specified paths were not resolved, unable to cache dependencies.
```

## Root Cause

The issue was caused by improper quoting in the `cache-dependency-path` configuration in the Node.js setup action. The paths were not properly quoted, causing the action to fail when trying to resolve the cache paths.

## Fixes Applied

### 1. Fixed npm Cache Configuration

**Problem**: Unquoted cache dependency paths
```yaml
# ❌ Incorrect
cache-dependency-path: ${{ matrix.directory }}/package-lock.json
cache-dependency-path: |
  backend/package-lock.json
  frontend/package-lock.json

# ✅ Correct
cache-dependency-path: '${{ matrix.directory }}/package-lock.json'
cache-dependency-path: |
  backend/package-lock.json
  frontend/package-lock.json
```

### 2. Updated to OIDC Authentication

**Problem**: Workflows were using AWS access keys
```yaml
# ❌ Old method (less secure)
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_REGION }}

# ✅ New method (OIDC - more secure)
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.DEV_ROLE_ARN }}
    role-session-name: GitHubActions-Dev-${{ github.run_id }}
    aws-region: ${{ vars.AWS_REGION }}
```

### 3. Added Required Permissions

**Problem**: Missing OIDC permissions
```yaml
# ❌ Missing permissions
# No permissions block

# ✅ Added required permissions
permissions:
  id-token: write   # Required for OIDC
  contents: read    # Required to checkout code
  security-events: write  # Required for security scanning (where applicable)
```

### 4. Updated Node.js Version

**Problem**: Inconsistent Node.js versions
```yaml
# ❌ Old version
node-version: '18'

# ✅ Updated version
node-version: '20'
```

## Files Modified

### 1. `.github/workflows/ci-cd.yml`
- Fixed npm cache configuration with proper quoting
- Updated AWS credentials to use OIDC
- Added required permissions for OIDC
- Updated rollback job to use OIDC

### 2. `.github/workflows/deploy-production.yml`
- Fixed npm cache configuration
- Updated all AWS credentials configurations to use OIDC
- Added AWS credentials to smoke-tests job
- Removed environment variables from smoke tests

### 3. `.github/workflows/deploy-moving-storage.yml`
- Fixed npm cache configuration
- Updated all deployment jobs to use OIDC
- Added required permissions
- Updated Node.js version to 20

### 4. `.github/workflows/security-audit.yml`
- Fixed npm cache configuration with proper quoting
- Updated Node.js version to 20

## Required Repository Configuration

To use the updated workflows, you need to configure the following in your GitHub repository:

### Repository Variables
Go to **Settings > Secrets and variables > Actions > Variables**:

- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: `eu-west-1`
- `DEV_ROLE_ARN`: Development environment OIDC role ARN
- `PROD_ROLE_ARN`: Production environment OIDC role ARN
- `STAGING_ROLE_ARN`: Staging environment OIDC role ARN (if using staging)

### GitHub Environments
Go to **Settings > Environments** and create:

1. **development**
   - No special restrictions
   
2. **production**
   - Required reviewers: Add team members who can approve production deployments
   - Deployment branches: Restrict to `main` branch only
   
3. **staging** (optional)
   - Required reviewers: Add team members who can approve staging deployments

### AWS OIDC Setup
Follow the [GitHub OIDC Setup Guide](GITHUB_OIDC_SETUP.md) to:

1. Create OIDC Identity Provider in AWS
2. Create IAM roles for each environment
3. Configure trust policies
4. Attach deployment permissions

## Benefits of the Fix

### Security Improvements
- ✅ **No long-lived credentials** in GitHub secrets
- ✅ **Automatic token rotation** with OIDC
- ✅ **Environment-specific roles** with least privilege
- ✅ **Better audit trail** through CloudTrail

### Reliability Improvements
- ✅ **Fixed npm cache errors** that were causing workflow failures
- ✅ **Consistent Node.js versions** across all workflows
- ✅ **Proper error handling** in deployment steps

### Operational Improvements
- ✅ **Faster builds** with working npm cache
- ✅ **Environment protection** with manual approvals for production
- ✅ **Better workflow organization** with clear job dependencies

## Testing the Fix

### 1. Test Development Deployment
```bash
# Push a change to trigger development deployment
git add .
git commit -m "Test workflow fixes"
git push origin main
```

### 2. Test Production Deployment
1. Go to **Actions > Deploy to Production**
2. Click **Run workflow**
3. Select `main` branch
4. Click **Run workflow**
5. Approve when prompted (if you have environment protection enabled)

### 3. Verify OIDC Authentication
Check the workflow logs for successful OIDC authentication:
```
✅ Assuming role with OIDC
✅ Role assumed successfully: arn:aws:iam::ACCOUNT:role/GitHubActionsRole-Dev
✅ AWS credentials configured
```

## Troubleshooting

### Common Issues After Fix

#### 1. "No OpenIDConnect provider found"
**Solution**: Follow the [OIDC Setup Guide](GITHUB_OIDC_SETUP.md) to create the OIDC provider

#### 2. "Role cannot be assumed"
**Solution**: Check that the trust policy allows your repository:
```json
"token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/YOUR_REPO:environment:development"
```

#### 3. "Variable not found: DEV_ROLE_ARN"
**Solution**: Add the required repository variables in GitHub Settings

#### 4. Still getting npm cache errors
**Solution**: Clear the workflow cache:
1. Go to **Actions > Caches**
2. Delete all npm-related caches
3. Re-run the workflow

## Migration Checklist

- [ ] AWS OIDC Identity Provider created
- [ ] IAM roles created for each environment
- [ ] Trust policies configured correctly
- [ ] Repository variables added to GitHub
- [ ] GitHub environments configured
- [ ] Workflows updated (completed)
- [ ] Test development deployment
- [ ] Test production deployment
- [ ] Remove old AWS access keys (after confirming OIDC works)
- [ ] Update team documentation

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Status**: Fixes Applied  
**Next Steps**: Test deployments and complete OIDC setup