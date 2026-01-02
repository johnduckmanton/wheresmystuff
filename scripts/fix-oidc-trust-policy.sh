#!/bin/bash

# Script to fix GitHub OIDC trust policies with actual repository information

set -e

echo "🔧 Fixing GitHub OIDC Trust Policies..."
echo ""

# Get repository information from git
GITHUB_REPO=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\/\(.*\)\.git/\1\/\2/')

if [ -z "$GITHUB_REPO" ]; then
  echo "❌ Could not determine GitHub repository from git remote"
  echo "   Please ensure you have a GitHub remote configured"
  exit 1
fi

echo "📦 Repository: $GITHUB_REPO"
echo ""

# Update development role trust policy
echo "🔄 Updating Development Role Trust Policy..."
cat > /tmp/dev-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_REPO:environment:development"
        }
      }
    }
  ]
}
EOF

aws iam update-assume-role-policy \
  --role-name GitHubActionsRole-Dev \
  --policy-document file:///tmp/dev-trust-policy.json

echo "✅ Development role trust policy updated"
echo "   Subject: repo:$GITHUB_REPO:environment:development"

# Update production role trust policy
echo ""
echo "🔄 Updating Production Role Trust Policy..."
cat > /tmp/prod-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_REPO:environment:production"
        }
      }
    }
  ]
}
EOF

aws iam update-assume-role-policy \
  --role-name GitHubActionsRole-Prod \
  --policy-document file:///tmp/prod-trust-policy.json

echo "✅ Production role trust policy updated"
echo "   Subject: repo:$GITHUB_REPO:environment:production"

# Cleanup
rm -f /tmp/dev-trust-policy.json /tmp/prod-trust-policy.json

echo ""
echo "✅ OIDC trust policies fixed!"
echo ""
echo "Next steps:"
echo "1. Push your changes to GitHub"
echo "2. The workflow should now be able to assume the roles"
echo "3. Monitor the GitHub Actions logs for successful deployment"
