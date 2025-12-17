#!/bin/bash

# Script to update Lambda function code without full CloudFormation deployment
# This is useful when CloudFormation stack has issues but we need to update code

set -e

echo "=========================================="
echo "Updating Lambda Functions"
echo "=========================================="
echo

# Get the stack name
STACK_NAME="home-inventory-system"

# Get all Lambda functions from the stack
echo "Finding Lambda functions in stack..."
FUNCTIONS=$(aws cloudformation list-stack-resources \
  --stack-name $STACK_NAME \
  --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId" \
  --output text)

if [ -z "$FUNCTIONS" ]; then
  echo "Error: No Lambda functions found in stack $STACK_NAME"
  exit 1
fi

echo "Found functions:"
echo "$FUNCTIONS" | tr '\t' '\n'
echo

# Build the code
echo "Building Lambda code..."
cd backend
zip -r ../lambda-code.zip . -x "node_modules/*" -x "tests/*" -x ".git/*" > /dev/null
cd ..

echo "Installing dependencies..."
cd backend
npm install --production > /dev/null 2>&1
cd ..

echo "Creating deployment package..."
cd backend
zip -r ../lambda-deployment.zip . > /dev/null
cd ..

# Update each function
for FUNCTION in $FUNCTIONS; do
  echo "Updating $FUNCTION..."
  aws lambda update-function-code \
    --function-name $FUNCTION \
    --zip-file fileb://lambda-deployment.zip \
    --no-cli-pager > /dev/null
  
  if [ $? -eq 