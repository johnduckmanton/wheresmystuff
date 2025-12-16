# Dependency Vulnerability Scanning

This document describes the dependency vulnerability scanning setup for the Home Inventory Management System.

## Overview

The project implements comprehensive dependency vulnerability scanning to identify and address security vulnerabilities in third-party packages. This includes both automated scanning in CI/CD pipelines and regular dependency updates.

## Components

### 1. NPM Audit Scripts

Both backend and frontend `package.json` files include security audit scripts:

- `npm run audit` - Run basic audit
- `npm run audit:fix` - Attempt automatic fixes
- `npm run audit:check` - Check for high/critical vulnerabilities
- `npm run security:check` - Production-only high/critical vulnerability check

### 2. GitHub Actions Workflows

#### Security Audit Workflow (`.github/workflows/security-audit.yml`)
- Runs on push, pull requests, and daily schedule
- Scans both backend and frontend dependencies
- Fails build on high or critical vulnerabilities
- Generates audit reports as artifacts

#### CI/CD Pipeline (`.github/workflows/ci-cd.yml`)
- Integrates security audit as first step
- Blocks deployment if vulnerabilities found
- Runs tests only after security validation
- Final production dependency check before build

### 3. Dependabot Configuration (`.github/dependabot.yml`)
- Weekly automated dependency updates
- Prioritizes security updates
- Groups security updates together
- Includes GitHub Actions dependencies

## Security Levels

The scanning focuses on **high** and **critical** vulnerabilities:

- **Critical**: Immediate security risk, blocks deployment
- **High**: Significant security risk, blocks deployment  
- **Moderate**: Monitored but doesn't block deployment
- **Low**: Informational only

## Usage

### Local Development

```bash
# Check for vulnerabilities
cd backend && npm run security:check
cd frontend && npm run security:check

# Fix vulnerabilities automatically
cd backend && npm run audit:fix
cd frontend && npm run audit:fix

# View detailed audit report
cd backend && npm audit
cd frontend && npm audit
```

### CI/CD Pipeline

The security audit runs automatically on:
- Every push to main/develop branches
- Every pull request to main
- Daily at 2 AM UTC (scheduled)

### Dependabot Updates

Dependabot automatically:
- Scans for vulnerable dependencies weekly
- Creates pull requests for security updates
- Groups related updates together
- Labels PRs appropriately for review

## Monitoring and Response

### Daily Monitoring
- Review Dependabot PRs for security updates
- Check GitHub Security tab for new advisories
- Monitor CI/CD pipeline for audit failures

### Incident Response
1. **Critical Vulnerability Detected**:
   - Immediate assessment of impact
   - Apply fixes or workarounds
   - Update dependencies
   - Deploy security patches

2. **Build Failures**:
   - Review audit reports in CI artifacts
   - Prioritize high/critical fixes
   - Update or replace vulnerable packages
   - Test fixes thoroughly

### Reporting
- Audit reports stored as CI artifacts (30 days)
- Security summary in GitHub Actions
- Vulnerability tracking in GitHub Security tab

## Best Practices

### For Developers
- Run `npm audit` before committing changes
- Review Dependabot PRs promptly
- Test security updates thoroughly
- Keep dependencies up to date

### For Security Team
- Review weekly Dependabot reports
- Monitor security advisories
- Conduct quarterly dependency reviews
- Update scanning policies as needed

## Configuration

### Audit Levels
Current configuration fails builds on:
- High severity vulnerabilities
- Critical severity vulnerabilities
- Production dependencies only (excludes devDependencies)

### Update Schedule
- Dependabot: Weekly on Mondays at 9 AM
- Security audit: Daily at 2 AM UTC
- Manual audits: Before each release

## Troubleshooting

### Common Issues

1. **False Positives**:
   - Review vulnerability details
   - Check if dev-only dependency
   - Consider audit exceptions if needed

2. **Unfixable Vulnerabilities**:
   - Look for alternative packages
   - Implement workarounds
   - Document risk acceptance

3. **Build Failures**:
   - Check audit artifacts for details
   - Run local audit for debugging
   - Update vulnerable packages

### Commands

```bash
# View vulnerability details
npm audit --json

# Check specific package
npm audit --package=package-name

# Skip dev dependencies
npm audit --production

# Generate audit report
npm audit --json > audit-report.json
```

## Integration with Requirements

This implementation satisfies the following security requirements:

- **10.1**: Automated vulnerability scanning with npm audit
- **10.2**: Build failure on high/critical vulnerabilities  
- **10.3**: Remediation guidance through audit reports
- **10.4**: Re-scanning on dependency updates via CI/CD
- **10.5**: Production deployment only with clean dependencies

## Maintenance

### Weekly Tasks
- Review Dependabot PRs
- Check for new security advisories
- Update audit policies if needed

### Monthly Tasks  
- Review audit reports and trends
- Update scanning configuration
- Assess new vulnerability sources

### Quarterly Tasks
- Full dependency security review
- Update scanning tools and policies
- Security team training on new threats