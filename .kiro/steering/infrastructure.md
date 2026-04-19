---
inclusion: fileMatch
fileMatchPattern: "template.yaml,cloudfront-template.yaml,samconfig.toml,.github/**"
---

# Infrastructure & Deployment Conventions

## AWS SAM
- Main template: `template.yaml` (backend resources in eu-west-1)
- CloudFront template: `cloudfront-template.yaml` (CDN in us-east-1)
- SAM config: `samconfig.toml`
- Build: `sam build` (cached, parallel)
- Deploy: `sam deploy --region eu-west-1`

## Lambda Defaults (from SAM Globals)
- Runtime: `nodejs20.x`
- Timeout: 30s
- Memory: 256 MB
- Tracing: Active in prod, PassThrough in dev
- All functions share environment variables: TABLE_NAME, BUCKET_NAME, USER_POOL_ID, etc.

## Parameters
Key SAM parameters to be aware of:
- `Environment`: `dev` or `prod`
- `EnableDeletionProtection`: protects DynamoDB and other resources in prod
- `LogRetentionDays`: CloudWatch log retention (default 7)
- `CloudFrontOrigin`: CORS origin URL
- `CustomDomainName`: app domain
- `ACMCertificateArn`: SSL cert for HTTPS

## Conditions
- `IsProduction`: enables enhanced security (tracing, WAF, stricter headers)
- `EnableProtection`: deletion protection for prod resources
- `EnableMFA`: Cognito SMS MFA in production

## CI/CD Pipeline (`.github/workflows/ci-cd.yml`)
Pipeline stages:
1. **Security Audit** — `npm audit --audit-level=high` on both backend and frontend
2. **Test Backend** — `npm test` in backend/
3. **Test Frontend** — `npm run lint` + `npm run build` in frontend/
4. **Build Backend** — SAM build
5. **Deploy** — SAM deploy with OIDC auth (no static credentials)
6. **Smoke Tests** — health check + frontend accessibility post-deploy

Triggers:
- Push to `main` or `develop`
- Pull requests to `main`
- Manual dispatch with environment selection

## Deployment Safety
- OIDC for AWS authentication (no long-lived keys)
- Change detection to skip unnecessary deploys
- Rollback on failure
- Separate dev/prod environments with different stack names
- Production deploys require manual workflow dispatch

## Resource Naming
- Stack: `home-inventory-system-{environment}`
- Table: `home-inventory-{environment}` (via SAM)
- S3 buckets: `home-inv-photos-{accountId}-{environment}`, plus QR code report bucket
