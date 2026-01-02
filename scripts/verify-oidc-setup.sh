#!/bin/bash

# Script to verify GitHub OIDC setup in AWS

set -e

echo "🔍 Verifying GitHub OIDC Setup..."
echo ""

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account ID: $AWS_ACCOUNT_ID"

# Check if OIDC provider exists
echo ""
echo "🔍 Checking OIDC Provider..."
OIDC_PROVIDERS=$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[*].Arn' --output text)

if echo "$OIDC_PROVIDERS" | grep -q "token.actions.githubusercontent.com"; then
  echo "✅ OIDC Provider found"
  OIDC_PROVIDER_ARN=$(echo "$OIDC_PROVIDERS" | grep "token.actions.githubusercontent.com")
  echo "   ARN: $OIDC_PROVIDER_ARN"
else
  echo "❌ OIDC Provider NOT found"
  echo "   Please run: aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 --client-id-list sts.amazonaws.com"
  exit 1
fi

# Check development role
echo ""
echo "🔍 Checking Development Role..."
if aws iam get-role --role-name GitHubActionsRole-Dev &>/dev/null; then
  echo "✅ Development role exists"
  
  # Get trust policy
  TRUST_POLICY=$(aws iam get-role --role-name GitHubActionsRole-Dev --query 'Role.AssumeRolePolicyDocument' --output json)
  echo "   Trust Policy:"
  echo "$TRUST_POLICY" | jq '.' | sed 's/^/     /'
  
  # Check if trust policy allows the OIDC provider
  if echo "$TRUST_POLICY" | jq -e '.Statement[0].Principal.Federated' | grep -q "token.actions.githubusercontent.com"; then
    echo "✅ Trust policy references OIDC provider"
  else
    echo "❌ Trust policy does NOT reference OIDC provider"
  fi
  
  # Check if trust policy has correct conditions
  if echo "$TRUST_POLICY" | jq -e '.Statement[0].Condition' | grep -q "token.actions.githubusercontent.com:sub"; then
    echo "✅ Trust policy has subject condition"
    SUBJECT=$(echo "$TRUST_POLICY" | jq -r '.Statement[0].Condition.StringLike."token.actions.githubusercontent.com:sub"')
    echo "   Subject: $SUBJECT"
  else
    echo "❌ Trust policy missing subject condition"
  fi
else
  echo "❌ Development role NOT found"
  exit 1
fi

# Check production role
echo ""
echo "🔍 Checking Production Role..."
if aws iam get-role --role-name GitHubActionsRole-Prod &>/dev/null; then
  echo "✅ Production role exists"
  
  # Get trust policy
  TRUST_POLICY=$(aws iam get-role --role-name GitHubActionsRole-Prod --query 'Role.AssumeRolePolicyDocument' --output json)
  echo "   Trust Policy:"
  echo "$TRUST_POLICY" | jq '.' | sed 's/^/     /'
else
  echo "❌ Production role NOT found"
  exit 1
fi

# Check role policies
echo ""
echo "🔍 Checking Role Policies..."
DEV_POLICIES=$(aws iam list-attached-role-policies --role-name GitHubActionsRole-Dev --query 'AttachedPolicies[*].PolicyName' --output text)
if [ -z "$DEV_POLICIES" ]; then
  echo "⚠️  Development role has NO attached policies"
else
  echo "✅ Development role policies: $DEV_POLICIES"
fi

PROD_POLICIES=$(aws iam list-attached-role-policies --role-name GitHubActionsRole-Prod --query 'AttachedPolicies[*].PolicyName' --output text)
if [ -z "$PROD_POLICIES" ]; then
  echo "⚠️  Production role has NO attached policies"
else
  echo "✅ Production role policies: $PROD_POLICIES"
fi

echo ""
echo "✅ OIDC Setup verification complete!"
