#!/bin/bash

# Script to deploy backend without frontend resources to avoid CloudFormation issues

echo "🔧 Deploying backend without frontend resources..."
echo "==============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create a temporary template without frontend resources
echo -e "${YELLOW}📝 Creating temporary template without frontend resources...${NC}"

# Backup original template
cp template.yaml template.yaml.backup

# Remove frontend resources from template
sed -i.tmp '/# S3 Bucket for Frontend Website Hosting/,/# Cognito User Pool/d' template.yaml
sed -i.tmp '/# CloudFront Origin Access Control for S3/,/# S3 Bucket Policy for CloudFront Access/d' template.yaml

# Also remove WebsiteBucket from outputs
sed -i.tmp '/WebsiteBucket:/,/Name: !Sub \${AWS::StackName}-WebsiteBucket/d' template.yaml

# Fix CloudFront distribution to only have API origin
cat > /tmp/cloudfront-fix.yaml << 'EOF'
        # Default cache behavior for API
        DefaultCacheBehavior:
          TargetOriginId: ApiGatewayOrigin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
            - OPTIONS
            - PUT
            - POST
            - PATCH
            - DELETE
          CachedMethods:
            - GET
            - HEAD
            - OPTIONS
          Compress: true
          
          # Cache policy for API (no caching for dynamic content)
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled managed policy
          
          # Origin request policy to forward all headers, query strings, and cookies
          OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac  # AllViewer managed policy
          
          # Response headers policy for security headers
          ResponseHeadersPolicyId: !Ref CloudFrontSecurityHeadersPolicy
        
        # Origins configuration
        Origins:
          # API Gateway Origin
          - Id: ApiGatewayOrigin
            DomainName: !Sub ${HttpApi}.execute-api.${AWS::Region}.amazonaws.com
            OriginPath: !Sub /${Environment}
            CustomOriginConfig:
              HTTPSPort: 443
              OriginProtocolPolicy: https-only
              OriginSSLProtocols:
                - TLSv1.2
EOF

# Replace the CloudFront configuration
sed -i.tmp '/# Default cache behavior for frontend (S3)/,/# Custom error responses for SPA routing/c\
        # Default cache behavior for API\
        DefaultCacheBehavior:\
          TargetOriginId: ApiGatewayOrigin\
          ViewerProtocolPolicy: redirect-to-https\
          AllowedMethods:\
            - GET\
            - HEAD\
            - OPTIONS\
            - PUT\
            - POST\
            - PATCH\
            - DELETE\
          CachedMethods:\
            - GET\
            - HEAD\
            - OPTIONS\
          Compress: true\
          \
          # Cache policy for API (no caching for dynamic content)\
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled managed policy\
          \
          # Origin request policy to forward all headers, query strings, and cookies\
          OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac  # AllViewer managed policy\
          \
          # Response headers policy for security headers\
          ResponseHeadersPolicyId: !Ref CloudFrontSecurityHeadersPolicy\
        \
        # Origins configuration\
        Origins:\
          # API Gateway Origin\
          - Id: ApiGatewayOrigin\
            DomainName: !Sub ${HttpApi}.execute-api.${AWS::Region}.amazonaws.com\
            OriginPath: !Sub /${Environment}\
            CustomOriginConfig:\
              HTTPSPort: 443\
              OriginProtocolPolicy: https-only\
              OriginSSLProtocols:\
                - TLSv1.2\
        \
        # Custom error responses' template.yaml

echo -e "${YELLOW}🚀 Deploying backend only...${NC}"
sam build

if sam deploy; then
    echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Deploy frontend using simple S3 hosting:"
    echo "   ./scripts/deploy-frontend-simple.sh"
    echo ""
    echo "2. Or restore full template and try CloudFront again:"
    echo "   mv template.yaml.backup template.yaml"
    echo "   sam build && sam deploy"
    
    # Restore original template
    mv template.yaml.backup template.yaml
    rm -f template.yaml.tmp
else
    echo -e "${RED}❌ Backend deployment failed.${NC}"
    # Restore original template
    mv template.yaml.backup template.yaml
    rm -f template.yaml.tmp
    exit 1
fi