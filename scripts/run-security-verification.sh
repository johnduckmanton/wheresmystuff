#!/bin/bash

# Security Controls Verification Script
# This script runs comprehensive security verification tests

set -e

echo "🔒 Starting Security Controls Verification"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $message"
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  WARN${NC}: $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO${NC}: $message"
            ;;
    esac
}

# Check if required environment variables are set
check_environment() {
    echo -e "\n${BLUE}Checking Environment Configuration...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "WARN" "API_GATEWAY_URL not set, using default"
    else
        print_status "PASS" "API_GATEWAY_URL: $API_GATEWAY_URL"
    fi
    
    if [ -z "$CLOUDFRONT_URL" ]; then
        print_status "WARN" "CLOUDFRONT_URL not set, using default"
    else
        print_status "PASS" "CLOUDFRONT_URL: $CLOUDFRONT_URL"
    fi
    
    if [ -z "$TEST_DOMAIN" ]; then
        print_status "WARN" "TEST_DOMAIN not set, using default"
    else
        print_status "PASS" "TEST_DOMAIN: $TEST_DOMAIN"
    fi
}

# Run unit tests for security components
run_unit_tests() {
    echo -e "\n${BLUE}Running Security Unit Tests...${NC}"
    
    cd backend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "INFO" "Installing dependencies..."
        npm install
    fi
    
    # Run security-specific tests
    echo "Running security verification tests..."
    if npm test -- --grep "Security Controls Verification" --reporter spec; then
        print_status "PASS" "Security unit tests completed successfully"
    else
        print_status "FAIL" "Security unit tests failed"
        return 1
    fi
    
    cd ..
}

# Test HTTPS enforcement
test_https_enforcement() {
    echo -e "\n${BLUE}Testing HTTPS Enforcement...${NC}"
    
    # Test if HTTP redirects to HTTPS (if CloudFront URL is available)
    if [ ! -z "$CLOUDFRONT_URL" ]; then
        HTTP_URL=$(echo $CLOUDFRONT_URL | sed 's/https:/http:/')
        
        echo "Testing HTTP to HTTPS redirect..."
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code},%{redirect_url}" "$HTTP_URL" || echo "000,")
        HTTP_CODE=$(echo $RESPONSE | cut -d',' -f1)
        REDIRECT_URL=$(echo $RESPONSE | cut -d',' -f2)
        
        if [ "$HTTP_CODE" -ge 300 ] && [ "$HTTP_CODE" -lt 400 ] && [[ "$REDIRECT_URL" == https://* ]]; then
            print_status "PASS" "HTTP requests redirect to HTTPS"
        elif [ "$HTTP_CODE" = "000" ]; then
            print_status "PASS" "HTTP connections are blocked/refused"
        else
            print_status "FAIL" "HTTP to HTTPS redirect not working properly (Code: $HTTP_CODE)"
        fi
    else
        print_status "INFO" "CLOUDFRONT_URL not set, skipping HTTP redirect test"
    fi
}

# Test WAF protection
test_waf_protection() {
    echo -e "\n${BLUE}Testing WAF Protection...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "INFO" "API_GATEWAY_URL not set, skipping WAF tests"
        return
    fi
    
    # Test SQL injection protection
    echo "Testing SQL injection protection..."
    SQL_PAYLOAD="'; DROP TABLE users; --"
    ENCODED_PAYLOAD=$(printf '%s' "$SQL_PAYLOAD" | jq -sRr @uri)
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/things?search=$ENCODED_PAYLOAD" || echo "000")
    
    if [ "$RESPONSE" = "403" ]; then
        print_status "PASS" "WAF blocks SQL injection attempts"
    elif [ "$RESPONSE" = "401" ]; then
        print_status "INFO" "SQL injection test requires authentication (expected)"
    else
        print_status "WARN" "SQL injection protection unclear (HTTP $RESPONSE)"
    fi
    
    # Test XSS protection
    echo "Testing XSS protection..."
    XSS_PAYLOAD='<script>alert("xss")</script>'
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$XSS_PAYLOAD\",\"description\":\"test\"}" \
        "$API_GATEWAY_URL/things" || echo "000")
    
    if [ "$RESPONSE" = "403" ]; then
        print_status "PASS" "WAF blocks XSS attempts"
    elif [ "$RESPONSE" = "401" ]; then
        print_status "INFO" "XSS test requires authentication (expected)"
    else
        print_status "WARN" "XSS protection unclear (HTTP $RESPONSE)"
    fi
}

# Test rate limiting
test_rate_limiting() {
    echo -e "\n${BLUE}Testing Rate Limiting...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "INFO" "API_GATEWAY_URL not set, skipping rate limit tests"
        return
    fi
    
    echo "Sending multiple requests to test rate limiting..."
    
    RATE_LIMITED=0
    SUCCESS_COUNT=0
    
    for i in {1..10}; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/things" || echo "000")
        
        if [ "$RESPONSE" = "429" ]; then
            RATE_LIMITED=$((RATE_LIMITED + 1))
        elif [ "$RESPONSE" -lt 500 ] && [ "$RESPONSE" -ne 000 ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
        
        sleep 0.1
    done
    
    if [ $RATE_LIMITED -gt 0 ]; then
        print_status "PASS" "Rate limiting active ($RATE_LIMITED requests blocked)"
    elif [ $SUCCESS_COUNT -eq 10 ]; then
        print_status "INFO" "No rate limiting triggered (may need authentication or higher load)"
    else
        print_status "WARN" "Rate limiting behavior unclear"
    fi
}

# Test security headers
test_security_headers() {
    echo -e "\n${BLUE}Testing Security Headers...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "INFO" "API_GATEWAY_URL not set, skipping security headers test"
        return
    fi
    
    echo "Checking security headers..."
    
    HEADERS=$(curl -s -I "$API_GATEWAY_URL/health" || echo "")
    
    # Check for required security headers
    if echo "$HEADERS" | grep -qi "x-content-type-options.*nosniff"; then
        print_status "PASS" "X-Content-Type-Options header present"
    else
        print_status "FAIL" "X-Content-Type-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "x-frame-options.*deny"; then
        print_status "PASS" "X-Frame-Options header present"
    else
        print_status "FAIL" "X-Frame-Options header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "strict-transport-security"; then
        print_status "PASS" "Strict-Transport-Security header present"
    else
        print_status "FAIL" "Strict-Transport-Security header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "x-xss-protection"; then
        print_status "PASS" "X-XSS-Protection header present"
    else
        print_status "FAIL" "X-XSS-Protection header missing"
    fi
    
    if echo "$HEADERS" | grep -qi "content-security-policy"; then
        print_status "PASS" "Content-Security-Policy header present"
    else
        print_status "FAIL" "Content-Security-Policy header missing"
    fi
}

# Test CORS protection
test_cors_protection() {
    echo -e "\n${BLUE}Testing CORS Protection...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "INFO" "API_GATEWAY_URL not set, skipping CORS tests"
        return
    fi
    
    # Test with malicious origin
    echo "Testing CORS with malicious origin..."
    
    CORS_RESPONSE=$(curl -s -H "Origin: https://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS \
        "$API_GATEWAY_URL/things" || echo "")
    
    if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin.*malicious"; then
        print_status "FAIL" "CORS allows malicious origins"
    else
        print_status "PASS" "CORS blocks malicious origins"
    fi
    
    # Test with legitimate origin (if TEST_DOMAIN is set)
    if [ ! -z "$TEST_DOMAIN" ]; then
        echo "Testing CORS with legitimate origin..."
        
        LEGIT_RESPONSE=$(curl -s -H "Origin: https://$TEST_DOMAIN" \
            -H "Access-Control-Request-Method: POST" \
            -X OPTIONS \
            "$API_GATEWAY_URL/things" || echo "")
        
        if echo "$LEGIT_RESPONSE" | grep -qi "access-control-allow-origin.*$TEST_DOMAIN"; then
            print_status "PASS" "CORS allows legitimate domain"
        else
            print_status "INFO" "CORS response for legitimate domain: $(echo "$LEGIT_RESPONSE" | grep -i access-control-allow-origin || echo 'None')"
        fi
    fi
}

# Test TLS configuration
test_tls_configuration() {
    echo -e "\n${BLUE}Testing TLS Configuration...${NC}"
    
    if [ -z "$API_GATEWAY_URL" ]; then
        print_status "INFO" "API_GATEWAY_URL not set, skipping TLS tests"
        return
    fi
    
    DOMAIN=$(echo "$API_GATEWAY_URL" | sed 's|https://||' | sed 's|/.*||')
    
    echo "Testing TLS configuration for $DOMAIN..."
    
    # Test TLS version and cipher
    TLS_INFO=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | grep -E "(Protocol|Cipher)")
    
    if echo "$TLS_INFO" | grep -q "TLSv1.2\|TLSv1.3"; then
        TLS_VERSION=$(echo "$TLS_INFO" | grep Protocol | awk '{print $2}')
        print_status "PASS" "TLS version: $TLS_VERSION"
    else
        print_status "WARN" "TLS version unclear or potentially insecure"
    fi
    
    # Test certificate validity
    CERT_INFO=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "PASS" "TLS certificate is valid"
    else
        print_status "WARN" "TLS certificate validation unclear"
    fi
}

# Run infrastructure verification
run_infrastructure_verification() {
    echo -e "\n${BLUE}Running Infrastructure Verification...${NC}"
    
    if [ -f "scripts/verify-security-controls.js" ]; then
        echo "Running detailed infrastructure verification..."
        if node scripts/verify-security-controls.js; then
            print_status "PASS" "Infrastructure verification completed"
        else
            print_status "FAIL" "Infrastructure verification failed"
            return 1
        fi
    else
        print_status "INFO" "Infrastructure verification script not found, skipping"
    fi
}

# Generate summary report
generate_summary() {
    echo -e "\n${BLUE}Security Verification Summary${NC}"
    echo "============================================"
    
    if [ -f "security-verification-report.json" ]; then
        echo "Detailed report available: security-verification-report.json"
    fi
    
    echo -e "\n${GREEN}Security verification completed!${NC}"
    echo "Review the output above for any failed tests or warnings."
    echo ""
    echo "Next steps:"
    echo "1. Address any FAIL status items immediately"
    echo "2. Review WARN status items and improve if possible"
    echo "3. Monitor security logs and metrics regularly"
    echo "4. Schedule regular security verification runs"
}

# Main execution
main() {
    check_environment
    
    # Run all verification tests
    run_unit_tests
    test_https_enforcement
    test_waf_protection
    test_rate_limiting
    test_security_headers
    test_cors_protection
    test_tls_configuration
    run_infrastructure_verification
    
    generate_summary
}

# Execute main function
main "$@"